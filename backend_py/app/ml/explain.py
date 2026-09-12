"""Deterministic summaries of model output: delay drivers by category and recommended actions.

These only describe existing SHAP values and case facts - they never change a numerical prediction.
"""
from collections import defaultdict

from .features import DRIVER_CATEGORIES, STAGES

# Minimum SHAP contribution (probability points) for a factor to trigger an action.
ACTION_THRESHOLD = 0.01


def delay_drivers(shap_delay: list[dict]) -> list[dict]:
    """Sum SHAP delay contributions (days) per driver category; positive = adds delay."""
    totals: dict[str, float] = defaultdict(float)
    for item in shap_delay:
        totals[item["category"]] += item["shap"]
    return [
        {"category": c, "days": round(totals[c], 1)}
        for c in sorted(DRIVER_CATEGORIES, key=lambda c: totals[c], reverse=True)
        if c in totals
    ]


def top_positive(items: list[dict]) -> dict | None:
    positives = [i for i in items if i["shap"] > 0]
    return max(positives, key=lambda i: i["shap"]) if positives else None


def _n(case: dict, key: str) -> int:
    return int(round(float(case.get(key) or 0)))


def _action(item: dict, case: dict) -> str | None:
    f = item["feature"]
    if f == "court_case":
        return "Seek an early hearing or mediation for the pending court case and proceed on undisputed parcels meanwhile."
    if f == "dispute_count":
        return f"Resolve {_n(case, 'dispute_count')} dispute(s) through joint ownership/boundary verification with the revenue department."
    if f == "objection_count":
        return f"Hold grievance hearings for {_n(case, 'objection_count')} landowner objection(s) and record dispositions."
    if f in {"compensation_pending", "compensation_amount_lakh", "budget_release_delay_days"}:
        return (f"Expedite compensation disbursement - budget release currently takes "
                f"{_n(case, 'budget_release_delay_days')} days.")
    if f in {"approval_pending", "notification_pending"}:
        return "Escalate the pending approval / notification to the district-level review committee."
    if f in {"pending_documents", "missing_documents", "ownership_verification_pending", "survey_completed"}:
        return (f"Close documentation gaps ({_n(case, 'pending_documents')} pending, {_n(case, 'missing_documents')} "
                f"missing) and complete survey and ownership verification.")
    if f in {"days_in_current_stage", "previous_stage_delay_days", "total_processing_days", "stage_index"}:
        stage = STAGES[_n(case, "stage_index")] if case.get("stage_index") is not None else "current"
        return (f"Set a deadline and weekly review for the '{stage}' stage "
                f"({_n(case, 'days_in_current_stage')} days in stage so far).")
    if f == "staff_workload_ratio":
        return f"Staff workload ratio is {float(case.get('staff_workload_ratio') or 0):.2f} - assign additional revenue staff."
    if f in {"land_area_acres", "number_of_landowners", "number_of_land_parcels", "affected_villages", "affected_households"}:
        return "Split the acquisition into smaller parcel packages and deploy additional survey and negotiation teams."
    if f in {"district_historical_delay_rate", "historical_average_delay_days", "similar_case_average_delay_days", "seasonal_factor"}:
        return "District and similar-case history show elevated delays - build schedule buffers and review progress fortnightly."
    return None


def recommended_actions(shap_risk: list[dict], case: dict, limit: int = 4) -> list[str]:
    actions: list[str] = []
    for item in sorted(shap_risk, key=lambda i: i["shap"], reverse=True):
        if item["shap"] < ACTION_THRESHOLD or len(actions) >= limit:
            break
        text = _action(item, case)
        if text and text not in actions:
            actions.append(text)
    return actions or ["No factor materially increases the model risk - continue standard monitoring."]
