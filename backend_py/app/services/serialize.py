"""One serializer for a case so every page shows identical figures."""
from ..ml.features import FEATURE_NAMES, FEATURES, display_value, features_from_record
from ..models import AcquisitionCase
from .finance import case_finance
from .zones import ZONE_LABELS, blockers


def case_record(c: AcquisitionCase) -> dict:
    record = {name: getattr(c, name) for name in FEATURE_NAMES if hasattr(c, name)}
    record.update(project_type=c.project.project_type, acquisition_stage=c.acquisition_stage,
                  priority=c.priority, project_category=c.project_category)
    return record


def case_features(c: AcquisitionCase) -> dict:
    return features_from_record(case_record(c))


def case_summary(c: AcquisitionCase) -> dict:
    p = c.prediction
    record = case_record(c)
    return {
        "id": c.id,
        "case_code": c.case_code,
        "project_id": c.project_id,
        "project_code": c.project.code,
        "project_name": c.project.name,
        "project_type": c.project.project_type,
        "project_category": c.project_category,
        "priority": c.priority,
        "state": c.state,
        "district": c.district,
        "acquisition_stage": c.acquisition_stage,
        "stage_index": c.stage_index,
        "status": c.status,
        "zone": c.zone,
        "zone_label": ZONE_LABELS[c.zone],
        "blockers": blockers(record),
        "current_delay_days": c.previous_stage_delay_days,
        "days_in_current_stage": c.days_in_current_stage,
        "land_area_acres": c.land_area_acres,
        "delayed_recorded": bool(c.delayed_recorded),
        "recorded_additional_delay_days": c.recorded_additional_delay_days,
        "imputed_fields": [f for f in (c.imputed_fields or "").split(",") if f],
        "risk_probability": round(p.risk_probability, 4) if p else None,
        "risk_pct": round(p.risk_probability * 100, 1) if p else None,
        "risk_level": p.risk_level if p else None,
        "predicted_delay_days": p.predicted_delay_days if p else None,
        "top_risk_factor": p.top_risk_factor if p else None,
        "top_delay_driver": p.top_delay_driver if p else None,
        "is_synthetic": c.is_synthetic,
        "finance_is_synthetic": c.finance_is_synthetic,
        **case_finance(c.estimated_cost, c.compensation_amount, c.utilized_amount, c.actual_cost),
    }


def case_factors(c: AcquisitionCase) -> list[dict]:
    feats = case_features(c)
    imputed = set((c.imputed_fields or "").split(","))
    return [
        {"feature": f.name, "label": f.label, "category": f.category, "value": feats[f.name],
         "display_value": display_value(f.name, feats[f.name]), "imputed": f.name in imputed}
        for f in FEATURES
    ]
