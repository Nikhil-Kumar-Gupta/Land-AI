from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import AcquisitionCase, Alert, utcnow
from ..security import get_current_business
from .portfolio import SEVERITY_ORDER, alert_dict

router = APIRouter(prefix="/alerts", tags=["alerts"], dependencies=[Depends(get_current_business)])


@router.get("")
def list_alerts(db: Session = Depends(get_db), status: Literal["active", "acknowledged", "all"] = "active",
                severity: str | None = None, alert_type: str | None = None):
    q = select(Alert).options(joinedload(Alert.case).joinedload(AcquisitionCase.project),
                              joinedload(Alert.case).joinedload(AcquisitionCase.prediction))
    if status != "all":
        q = q.where(Alert.is_acknowledged.is_(status == "acknowledged"))
    if severity:
        q = q.where(Alert.severity == severity)
    if alert_type:
        q = q.where(Alert.alert_type == alert_type)
    alerts = db.scalars(q).unique().all()
    alerts.sort(key=lambda a: (SEVERITY_ORDER.get(a.severity, 9),
                               -(a.case.prediction.risk_probability if a.case.prediction else 0)))
    items = [alert_dict(a) for a in alerts]
    summary = {s: sum(1 for i in items if i["severity"] == s) for s in SEVERITY_ORDER}
    return {"items": items, "count": len(items), "by_severity": summary}


@router.post("/{alert_id}/acknowledge")
def acknowledge(alert_id: int, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(404, "Alert not found.")
    alert.is_acknowledged = True
    alert.acknowledged_at = utcnow()
    db.commit()
    return {"message": "Alert acknowledged.", "id": alert_id}
