"""Score cases with the trained model, persist predictions, and derive alerts from them."""
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..ml.explain import delay_drivers, top_positive
from ..ml.inference import model_service
from ..models import AcquisitionCase, Alert, Prediction, utcnow
from .finance import COST_OVERRUN_ALERT_PCT, case_finance
from .serialize import case_features

# Delay accumulated in previous stages above which a delay alert is raised (~ top 10% of the dataset).
STAGE_DELAY_ALERT_DAYS = 30


def score_cases(db: Session) -> int:
    cases = db.scalars(
        select(AcquisitionCase).options(joinedload(AcquisitionCase.project), joinedload(AcquisitionCase.prediction))
    ).unique().all()
    if not cases:
        return 0

    results = model_service.predict([case_features(c) for c in cases])
    version, now = model_service.model_version, utcnow()

    for case, r in zip(cases, results):
        top_risk = top_positive(r["shap_risk"])
        drivers = [d for d in delay_drivers(r["shap_delay"]) if d["days"] > 0]
        values = {
            "risk_probability": r["risk_probability"],
            "risk_level": r["risk_level"],
            "predicted_delay_days": r["predicted_delay_days"],
            "base_risk": r["base_risk"],
            "base_delay": r["base_delay"],
            "top_risk_factor": top_risk["label"] if top_risk else "None",
            "top_delay_driver": drivers[0]["category"] if drivers else "None",
            "shap_risk": r["shap_risk"],
            "shap_delay": r["shap_delay"],
            "model_version": version,
            "scored_at": now,
        }
        if case.prediction is None:
            case.prediction = Prediction(**values)
        else:
            for key, value in values.items():
                setattr(case.prediction, key, value)

    db.flush()
    sync_alerts(db, cases)
    db.commit()
    return len(cases)


def _desired_alerts(c: AcquisitionCase) -> dict[str, dict]:
    desired: dict[str, dict] = {}
    p = c.prediction
    if p and p.risk_level == "High":
        desired["HIGH_RISK"] = {
            "severity": "critical" if p.risk_probability >= 0.85 else "high",
            "title": f"High delay risk - {c.case_code}",
            "message": (f"Model risk {p.risk_probability * 100:.0f}%; predicted additional delay "
                        f"{p.predicted_delay_days:.0f} days. Main risk factor: {p.top_risk_factor}."),
        }
    fin = case_finance(c.estimated_cost, c.compensation_amount, c.utilized_amount, c.actual_cost)
    if fin["cost_overrun_pct"] > COST_OVERRUN_ALERT_PCT:
        desired["COST_OVERRUN"] = {
            "severity": "high" if fin["cost_overrun_pct"] > 25 else "medium",
            "title": f"Cost overrun - {c.case_code}",
            "message": (f"Revised cost exceeds the estimate by {fin['cost_overrun_pct']:.1f}% "
                        f"(INR {fin['cost_overrun'] / 1e7:.2f} Cr, synthetic budget)."),
        }
    if c.previous_stage_delay_days > STAGE_DELAY_ALERT_DAYS:
        desired["DELAY"] = {
            "severity": "high" if c.previous_stage_delay_days > 45 else "medium",
            "title": f"Stage delay threshold exceeded - {c.case_code}",
            "message": (f"{c.previous_stage_delay_days:.0f} days of delay from previous stages (now at "
                        f"'{c.acquisition_stage}') exceeds the {STAGE_DELAY_ALERT_DAYS}-day threshold."),
        }
    return desired


def sync_alerts(db: Session, cases: list[AcquisitionCase]) -> None:
    """Idempotently align the alerts table with current predictions and stored case data."""
    existing = {(a.case_id, a.alert_type): a for a in db.scalars(select(Alert))}
    seen = set()
    for c in cases:
        for alert_type, data in _desired_alerts(c).items():
            key = (c.id, alert_type)
            seen.add(key)
            alert = existing.get(key)
            if alert is None:
                db.add(Alert(case_id=c.id, alert_type=alert_type, **data))
            else:
                alert.severity, alert.title, alert.message = data["severity"], data["title"], data["message"]
    for key, alert in existing.items():
        if key not in seen:  # condition resolved
            db.delete(alert)
