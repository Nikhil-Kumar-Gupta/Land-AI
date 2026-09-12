from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import distinct, func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..ml.explain import delay_drivers, recommended_actions
from ..ml.features import RISK_DEFINITION, STAGES
from ..models import AcquisitionCase, Alert, Prediction, Project
from ..security import get_current_business
from ..services.analytics import frame, load_cases, stage_risk_for
from ..services.serialize import case_factors, case_record, case_summary
from ..services.zones import ZONE_LABELS, ZONE_RULE

router = APIRouter(prefix="/cases", tags=["cases"], dependencies=[Depends(get_current_business)])

SORTS = {
    "risk": Prediction.risk_probability,
    "predicted_delay": Prediction.predicted_delay_days,
    "current_delay": AcquisitionCase.previous_stage_delay_days,
    "case_code": AcquisitionCase.case_code,
    "district": AcquisitionCase.district,
    "stage": AcquisitionCase.stage_index,
    "project": Project.name,
    "cost_overrun": AcquisitionCase.actual_cost - AcquisitionCase.estimated_cost,
}


@router.get("/filters")
def filters(db: Session = Depends(get_db)):
    return {
        "states": sorted(db.scalars(select(distinct(AcquisitionCase.state)))),
        "districts": sorted(db.scalars(select(distinct(AcquisitionCase.district)))),
        "projects": [{"id": p.id, "code": p.code, "name": p.name} for p in db.scalars(select(Project).order_by(Project.name))],
        "stages": STAGES,
        "statuses": sorted(db.scalars(select(distinct(AcquisitionCase.status)))),
        "risk_levels": ["High", "Medium", "Low"],
        "zones": [{"value": k, "label": v} for k, v in ZONE_LABELS.items()],
    }


@router.get("")
def list_cases(
    db: Session = Depends(get_db),
    search: str | None = Query(None, max_length=100),
    state: str | None = None,
    district: str | None = None,
    project_id: int | None = None,
    stage: str | None = None,
    status: str | None = None,
    zone: Literal["ready", "not_ready"] | None = None,
    risk_level: Literal["High", "Medium", "Low"] | None = None,
    sort: Literal[tuple(SORTS)] = "risk",  # type: ignore[valid-type]
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q = select(AcquisitionCase).join(Project).outerjoin(Prediction)
    if search:
        term = f"%{search.strip().lower()}%"
        q = q.where(or_(func.lower(AcquisitionCase.case_code).like(term), func.lower(AcquisitionCase.state).like(term),
                        func.lower(AcquisitionCase.district).like(term), func.lower(Project.name).like(term)))
    for column, value in ((AcquisitionCase.state, state), (AcquisitionCase.district, district),
                          (AcquisitionCase.project_id, project_id), (AcquisitionCase.acquisition_stage, stage),
                          (AcquisitionCase.status, status), (AcquisitionCase.zone, zone), (Prediction.risk_level, risk_level)):
        if value:
            q = q.where(column == value)

    total = db.scalar(select(func.count()).select_from(q.subquery()))
    col = SORTS[sort]
    q = q.order_by(col.desc() if order == "desc" else col.asc(), AcquisitionCase.id)
    q = q.options(joinedload(AcquisitionCase.project), joinedload(AcquisitionCase.prediction))
    items = db.scalars(q.offset((page - 1) * page_size).limit(page_size)).unique().all()
    return {
        "items": [case_summary(c) for c in items],
        "total": total, "page": page, "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/{case_id}")
def case_detail(case_id: int, db: Session = Depends(get_db)):
    c = db.scalar(select(AcquisitionCase).where(AcquisitionCase.id == case_id)
                  .options(joinedload(AcquisitionCase.project), joinedload(AcquisitionCase.prediction)))
    if c is None:
        raise HTTPException(404, "Case not found.")
    p = c.prediction
    if p is None:
        raise HTTPException(409, "This case has not been scored by the model yet.")
    alerts = db.scalars(select(Alert).where(Alert.case_id == c.id)).all()
    return {
        "case": case_summary(c),
        "factors": case_factors(c),
        "zone_rule": ZONE_RULE,
        "prediction": {
            "risk_probability": p.risk_probability, "risk_pct": round(p.risk_probability * 100, 1),
            "risk_level": p.risk_level, "predicted_delay_days": p.predicted_delay_days,
            "base_risk_pct": round(p.base_risk * 100, 1), "base_delay_days": round(p.base_delay, 0),
            "model_version": p.model_version, "scored_at": p.scored_at.isoformat(),
            "risk_definition": RISK_DEFINITION,
        },
        "shap_risk": p.shap_risk,
        "shap_delay": p.shap_delay,
        "delay_drivers": delay_drivers(p.shap_delay),
        "risk_factors": [i for i in p.shap_risk if i["shap"] > 0][:6],
        "stage_risk": stage_risk_for(frame(load_cases(db)), c.stage_index),
        "recommendations": recommended_actions(p.shap_risk, case_record(c)),
        "alerts": [{"id": a.id, "type": a.alert_type, "severity": a.severity, "title": a.title,
                    "message": a.message, "is_acknowledged": a.is_acknowledged} for a in alerts],
    }
