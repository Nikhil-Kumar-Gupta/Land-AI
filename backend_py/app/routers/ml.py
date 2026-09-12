"""What-if simulator, ad-hoc assessment, and model information - all using the trained model."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..config import IS_POSTGRES
from ..database import get_db
from ..ml.explain import delay_drivers, recommended_actions
from ..ml.features import (
    CATEGORICAL,
    FEATURE_BY_NAME,
    NUMERIC_FEATURES,
    PRIORITIES,
    PROJECT_CATEGORIES,
    PROJECT_TYPES,
    RISK_DEFINITION,
    STAGES,
    display_value,
    feature_metadata,
    features_from_record,
)
from ..ml.inference import model_service
from ..models import AcquisitionCase, Prediction
from ..schemas import AssessmentRequest, SimulationRequest
from ..security import get_current_business
from ..services.serialize import case_features, case_record, case_summary
from ..services.zones import ZONE_LABELS, readiness_zone

router = APIRouter(tags=["ml"], dependencies=[Depends(get_current_business)])


def _check(name: str, value: float) -> None:
    f = FEATURE_BY_NAME.get(name)
    if f is None or not f.editable:
        raise HTTPException(422, f"'{name}' is not an adjustable factor.")
    if not (f.min <= value <= f.max):
        raise HTTPException(422, f"{f.label} must be between {f.min} and {f.max}.")


@router.get("/simulator/features")
def simulator_features():
    medians = model_service.info().get("preprocessing", {}).get("medians", {})
    return {
        "features": feature_metadata(),
        "defaults": {k: round(v, 2) for k, v in medians.items()},
        "stages": STAGES, "project_types": PROJECT_TYPES,
        "priorities": PRIORITIES, "project_categories": PROJECT_CATEGORIES,
        "risk_definition": RISK_DEFINITION,
    }


@router.post("/simulator/{case_id}")
def simulate(case_id: int, req: SimulationRequest, db: Session = Depends(get_db)):
    c = db.scalar(select(AcquisitionCase).where(AcquisitionCase.id == case_id)
                  .options(joinedload(AcquisitionCase.project), joinedload(AcquisitionCase.prediction)))
    if c is None:
        raise HTTPException(404, "Case not found.")
    if c.prediction is None:
        raise HTTPException(409, "This case has not been scored by the model yet.")

    original = case_features(c)
    simulated = dict(original)
    changed = []
    for name, value in req.changes.items():
        _check(name, value)
        if float(value) != float(original[name]):
            simulated[name] = value
            changed.append({"feature": name, "label": FEATURE_BY_NAME[name].label,
                            "from": display_value(name, original[name]), "to": display_value(name, value)})

    sim = model_service.predict([simulated])[0]
    p = c.prediction
    orig_pct, sim_pct = p.risk_probability * 100, sim["risk_probability"] * 100
    sim_record = {**case_record(c), **simulated}
    sim_zone = readiness_zone(sim_record)
    return {
        "case": case_summary(c),
        "original": {"risk_pct": round(orig_pct, 1), "risk_level": p.risk_level,
                     "predicted_delay_days": p.predicted_delay_days, "zone_label": ZONE_LABELS[c.zone]},
        "simulated": {"risk_pct": round(sim_pct, 1), "risk_level": sim["risk_level"],
                      "predicted_delay_days": sim["predicted_delay_days"], "zone_label": ZONE_LABELS[sim_zone]},
        "risk_change_pp": round(sim_pct - orig_pct, 1),
        "delay_change_days": round(sim["predicted_delay_days"] - p.predicted_delay_days, 0),
        "changed_factors": changed,
        "simulated_shap_risk": sim["shap_risk"][:8],
        "simulated_delay_drivers": delay_drivers(sim["shap_delay"]),
        "simulated_recommendations": recommended_actions(sim["shap_risk"], sim_record),
        "note": "Simulation only - the stored prediction for this case is unchanged.",
    }


@router.post("/assessment")
def assessment(req: AssessmentRequest):
    medians = model_service.info().get("preprocessing", {}).get("medians", {})
    values = {name: medians.get(name, 0.0) for name in NUMERIC_FEATURES}
    for name, value in req.features.items():
        if name in CATEGORICAL:
            raise HTTPException(422, f"Send '{CATEGORICAL[name][0]}' as text instead of '{name}'.")
        f = FEATURE_BY_NAME.get(name)
        if f is None:
            raise HTTPException(422, f"Unknown factor '{name}'.")
        if not (f.min <= value <= f.max):
            raise HTTPException(422, f"{f.label} must be between {f.min} and {f.max}.")
        values[name] = value
    record = {**values, "project_type": req.project_type, "acquisition_stage": req.acquisition_stage,
              "priority": req.priority, "project_category": req.project_category}
    features = features_from_record(record)
    r = model_service.predict([features])[0]
    zone = readiness_zone(features)
    return {
        "input": record,
        "risk_pct": round(r["risk_probability"] * 100, 1),
        "risk_level": r["risk_level"],
        "risk_definition": RISK_DEFINITION,
        "predicted_delay_days": r["predicted_delay_days"],
        "base_risk_pct": round(r["base_risk"] * 100, 1),
        "base_delay_days": round(r["base_delay"], 0),
        "zone_label": ZONE_LABELS[zone],
        "shap_risk": r["shap_risk"],
        "shap_delay": r["shap_delay"],
        "delay_drivers": delay_drivers(r["shap_delay"]),
        "recommendations": recommended_actions(r["shap_risk"], features),
        "model_version": model_service.model_version,
        "note": "Ad-hoc assessment - not stored in the database. Factors left blank use dataset medians.",
    }


@router.get("/model/info")
def model_info(db: Session = Depends(get_db)):
    info = model_service.info()
    scored = db.scalar(select(func.count(Prediction.id))) or 0
    last = db.scalar(select(func.max(Prediction.scored_at)))
    return {
        **info,
        "feature_metadata": feature_metadata(),
        "serving": {
            "scored_cases": scored,
            "last_scored_at": last.isoformat() if last else None,
            "database": "PostgreSQL + PostGIS" if IS_POSTGRES else "SQLite (development fallback)",
        },
    }
