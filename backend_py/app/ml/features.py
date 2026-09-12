"""Single definition of the model's feature set, shared by import, training, inference, simulator and UI metadata.

Matches the columns of data/land_acquisition_dataset.csv (see app/ml/dataset.py).
"""
from dataclasses import asdict, dataclass

import pandas as pd

STAGES = [
    "Survey",
    "Notification",
    "Objection",
    "Ownership Verification",
    "Approval",
    "Award",
    "Compensation",
    "Possession",
]
PROJECT_TYPES = ["Highway", "Railway", "Irrigation", "Industrial", "Public Infrastructure"]
PRIORITIES = ["Normal", "High", "Critical"]
PROJECT_CATEGORIES = ["Major Infrastructure", "Development Project"]

# A case has a "significant delay" when expected_additional_delay_days exceeds this (about the top 25% of the dataset).
HIGH_DELAY_THRESHOLD_DAYS = 75
RISK_BANDS = {"High": 0.65, "Medium": 0.35}
RISK_DEFINITION = f"Probability that the additional delay exceeds {HIGH_DELAY_THRESHOLD_DAYS} days"

# code feature -> (source text column, ordered values)
CATEGORICAL = {
    "stage_index": ("acquisition_stage", STAGES),
    "project_type_code": ("project_type", PROJECT_TYPES),
    "priority_code": ("priority", PRIORITIES),
    "project_category_code": ("project_category", PROJECT_CATEGORIES),
}


@dataclass(frozen=True)
class Feature:
    name: str
    label: str
    category: str
    min: float
    max: float
    step: float = 1
    editable: bool = True
    kind: str = "number"  # number | flag | category


FEATURES: list[Feature] = [
    Feature("land_area_acres", "Land area (acres)", "Project Scale", 1, 1000),
    Feature("number_of_landowners", "Number of landowners", "Project Scale", 1, 100),
    Feature("number_of_land_parcels", "Number of land parcels", "Project Scale", 1, 60),
    Feature("affected_villages", "Affected villages", "Project Scale", 0, 20),
    Feature("affected_households", "Affected households", "Project Scale", 0, 80),
    Feature("private_land_pct", "Private land (%)", "Land Profile", 0, 100, 0.1),
    Feature("approval_pending", "Approval pending", "Approval Delays", 0, 1, kind="flag"),
    Feature("notification_pending", "Notification pending", "Approval Delays", 0, 1, kind="flag"),
    Feature("compensation_pending", "Compensation pending", "Compensation Issues", 0, 1, kind="flag"),
    Feature("compensation_amount_lakh", "Compensation amount (₹ lakh)", "Compensation Issues", 1, 4000, 0.01),
    Feature("budget_release_delay_days", "Budget release delay (days)", "Compensation Issues", 0, 20),
    Feature("dispute_count", "Disputes", "Legal Disputes", 0, 15),
    Feature("court_case", "Court case", "Legal Disputes", 0, 1, kind="flag"),
    Feature("objection_count", "Landowner objections", "Landowner Objections", 0, 15),
    Feature("survey_completed", "Survey completed", "Documentation Issues", 0, 1, kind="flag"),
    Feature("ownership_verification_pending", "Ownership verification pending", "Documentation Issues", 0, 1, kind="flag"),
    Feature("pending_documents", "Pending documents", "Documentation Issues", 0, 15),
    Feature("missing_documents", "Missing documents", "Documentation Issues", 0, 10),
    Feature("stage_index", "Acquisition stage", "Stage Delays", 0, len(STAGES) - 1, kind="category"),
    Feature("days_in_current_stage", "Days in current stage", "Stage Delays", 0, 200),
    Feature("previous_stage_delay_days", "Previous-stage delay (days)", "Stage Delays", 0, 120),
    Feature("total_processing_days", "Total processing days", "Stage Delays", 0, 400),
    Feature("staff_workload_ratio", "Staff workload ratio", "Administrative Capacity", 0, 1, 0.01),
    Feature("seasonal_factor", "Seasonal factor", "Administrative Capacity", 0.8, 1.2, 0.01, editable=False),
    Feature("district_historical_delay_rate", "District historical delay rate", "Historical Patterns", 0, 1, 0.001, editable=False),
    Feature("historical_average_delay_days", "Historical avg. delay (days)", "Historical Patterns", 0, 150, 0.1, editable=False),
    Feature("similar_case_average_delay_days", "Similar-case avg. delay (days)", "Historical Patterns", 0, 150, 0.1, editable=False),
    Feature("project_type_code", "Project type", "Project Profile", 0, len(PROJECT_TYPES) - 1, editable=False, kind="category"),
    Feature("priority_code", "Priority", "Project Profile", 0, len(PRIORITIES) - 1, editable=False, kind="category"),
    Feature("project_category_code", "Project category", "Project Profile", 0, len(PROJECT_CATEGORIES) - 1, editable=False, kind="category"),
]
FEATURE_NAMES = [f.name for f in FEATURES]
FEATURE_BY_NAME = {f.name: f for f in FEATURES}
NUMERIC_FEATURES = [f.name for f in FEATURES if f.kind != "category"]
DRIVER_CATEGORIES = list(dict.fromkeys(f.category for f in FEATURES))


def feature_metadata() -> list[dict]:
    return [asdict(f) for f in FEATURES]


def risk_level(probability: float) -> str:
    if probability >= RISK_BANDS["High"]:
        return "High"
    if probability >= RISK_BANDS["Medium"]:
        return "Medium"
    return "Low"


def features_from_record(record: dict) -> dict:
    """Map a case record (DB row dict, dataset row or assessment input) to the model feature vector."""
    row = {name: record.get(name) for name in FEATURE_NAMES}
    for code, (text_col, values) in CATEGORICAL.items():
        if row.get(code) is None:
            row[code] = values.index(record[text_col])
    return row


def to_frame(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame([{n: float(r[n]) for n in FEATURE_NAMES} for r in rows], columns=FEATURE_NAMES)


def display_value(name: str, value: float) -> str:
    if name in CATEGORICAL:
        return CATEGORICAL[name][1][int(round(value))]
    if FEATURE_BY_NAME[name].kind == "flag":
        return "Yes" if value >= 0.5 else "No"
    if name.endswith("_pct"):
        return f"{value:.1f}%"
    if name in {"district_historical_delay_rate", "staff_workload_ratio", "seasonal_factor"}:
        return f"{value:.2f}"
    if name == "compensation_amount_lakh":
        return f"₹{value:,.2f} L"
    if float(value).is_integer():
        return f"{int(value)}"
    return f"{value:.1f}"
