"""Dashboard, analytics, budget, priority review and GIS endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..config import IS_POSTGRES
from ..database import get_db
from ..ml.explain import recommended_actions
from ..ml.features import RISK_BANDS, RISK_DEFINITION
from ..models import AcquisitionCase, Alert, District
from ..security import get_current_business
from ..services import analytics as A
from ..services.finance import budget_issue
from ..services.serialize import case_record, case_summary
from ..services.zones import ZONE_LABELS, ZONE_RULE

router = APIRouter(tags=["portfolio"], dependencies=[Depends(get_current_business)])

RISK_INFO = {"definition": RISK_DEFINITION, "bands": RISK_BANDS}


def alert_dict(a: Alert) -> dict:
    return {
        "id": a.id, "case_id": a.case_id, "case_code": a.case.case_code, "district": a.case.district,
        "state": a.case.state, "project_name": a.case.project.name, "type": a.alert_type, "severity": a.severity,
        "title": a.title, "message": a.message, "is_acknowledged": a.is_acknowledged,
        "created_at": a.created_at.isoformat(),
        "risk_pct": round(a.case.prediction.risk_probability * 100, 1) if a.case.prediction else None,
    }


SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2}


def recent_alerts(db: Session, limit: int) -> list[dict]:
    alerts = db.scalars(select(Alert).where(Alert.is_acknowledged.is_(False))
                        .options(joinedload(Alert.case).joinedload(AcquisitionCase.project),
                                 joinedload(Alert.case).joinedload(AcquisitionCase.prediction))).unique().all()
    alerts.sort(key=lambda a: (SEVERITY_ORDER.get(a.severity, 9),
                               -(a.case.prediction.risk_probability if a.case.prediction else 0)))
    return [alert_dict(a) for a in alerts[:limit]]


def priority_list(cases: list[AcquisitionCase], limit: int, levels: set[str]) -> list[dict]:
    ranked = sorted((c for c in cases if c.prediction and c.prediction.risk_level in levels),
                    key=lambda c: (-c.prediction.risk_probability, -c.prediction.predicted_delay_days))
    rows = []
    for rank, c in enumerate(ranked[:limit], start=1):
        s = case_summary(c)
        rows.append({
            "priority_rank": rank, **s,
            "main_risk_driver": c.prediction.top_risk_factor,
            "budget_issue": budget_issue(s),
            "next_action": recommended_actions(c.prediction.shap_risk, case_record(c), limit=1)[0],
        })
    return rows


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    cases = A.load_cases(db)
    df = A.frame(cases)
    return {
        "risk_info": RISK_INFO,
        "kpis": A.kpis(db, df),
        "risk_distribution": A.risk_distribution(df),
        "delay_drivers": A.portfolio_delay_drivers(cases),
        "risk_factors": A.portfolio_risk_factors(cases, limit=8),
        "districts": A.district_analysis(df),
        "states": A.state_analysis(df),
        "projects": A.project_performance(db, df),
        "stages": A.stage_analysis(df),
        "priority": priority_list(cases, 8, {"High"}),
        "recent_alerts": recent_alerts(db, 6),
    }


@router.get("/analytics")
def analytics(db: Session = Depends(get_db)):
    cases = A.load_cases(db)
    df = A.frame(cases)
    return {
        "risk_info": RISK_INFO,
        "districts": A.district_analysis(df),
        "states": A.state_analysis(df),
        "projects": A.project_performance(db, df),
        "stages": A.stage_analysis(df),
        "risk_distribution": A.risk_distribution(df),
        **A.distributions(df),
        "delay_drivers": A.portfolio_delay_drivers(cases),
        "risk_factors": A.portfolio_risk_factors(cases),
    }


@router.get("/budget")
def budget(db: Session = Depends(get_db)):
    cases = A.load_cases(db)
    df = A.frame(cases)
    top_overruns, districts = [], []
    if not df.empty:
        summary_cols = [k for k in case_summary(cases[0]).keys()]
        top = df.sort_values("cost_overrun", ascending=False).head(10)[summary_cols]
        top_overruns = top.to_dict(orient="records")
        for r in top_overruns:
            r["budget_issue"] = budget_issue(r)
        g = df.assign(overrun=df["actual_cost"] - df["estimated_cost"]).groupby("district").agg(
            estimated_cost=("estimated_cost", "sum"), actual_cost=("actual_cost", "sum"),
            compensation_amount=("compensation_amount", "sum"),
            utilized_amount=("utilized_amount", "sum"), overrun=("overrun", "sum"))
        districts = sorted([{
            "district": d, "estimated_cost": round(r.estimated_cost, 0), "actual_cost": round(r.actual_cost, 0),
            "compensation_amount": round(r.compensation_amount, 0),
            "utilized_amount": round(r.utilized_amount, 0), "cost_overrun": round(r.overrun, 0),
            "cost_overrun_pct": round(r.overrun / r.estimated_cost * 100, 2) if r.estimated_cost else 0,
        } for d, r in g.iterrows()], key=lambda x: x["cost_overrun_pct"], reverse=True)
    return {
        "kpis": A.kpis(db, df),
        "projects": A.project_performance(db, df),
        "districts": districts,
        "top_overrun_cases": top_overruns,
        "data_notice": ("Compensation amounts come from the dataset. Estimated cost, utilised amount and actual cost are "
                        "SYNTHETIC values derived from compensation, stage and delay during import - not government records."),
    }


@router.get("/priority")
def priority(db: Session = Depends(get_db), limit: int = Query(25, ge=1, le=200),
             include_medium: bool = False):
    levels = {"High", "Medium"} if include_medium else {"High"}
    return {"items": priority_list(A.load_cases(db), limit, levels)}


@router.get("/gis/districts")
def gis_districts(db: Session = Depends(get_db)):
    cases = A.load_cases(db)
    items = A.district_geo(db, cases, A.frame(cases))
    if IS_POSTGRES:  # read HQ points from PostGIS geometry
        coords = {(s, n): (lat, lng) for s, n, lat, lng in db.execute(
            select(District.state, District.name, func.ST_Y(District.geom), func.ST_X(District.geom)))}
        for d in items:
            lat, lng = coords.get((d["state"], d["district"]), (None, None))
            d["latitude"], d["longitude"] = lat, lng
    return {
        "items": items,
        "zone_rule": ZONE_RULE,
        "zone_labels": ZONE_LABELS,
        "spatial_backend": "PostGIS" if IS_POSTGRES else "lat/lng columns",
        "notice": ("Case coordinates are not in the dataset. Districts are placed at their headquarters; zone circles are "
                   "schematic - circle area equals the zone's total acreage, not surveyed boundaries."),
    }
