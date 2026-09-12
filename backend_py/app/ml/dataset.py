"""Load and validate the land-acquisition dataset (CSV or Excel) - shared by training and database import.

The file supplied for this project (data/land_acquisition_dataset.csv, originally
land_acquisition_synthetic_dataset_v2.csv.xls) is SYNTHETIC data - it is plain CSV text despite the .xls name.
"""
from pathlib import Path

import pandas as pd

from ..config import settings
from .features import CATEGORICAL, HIGH_DELAY_THRESHOLD_DAYS, NUMERIC_FEATURES

TEXT_COLUMNS = ["case_id", "state", "district", "project_type", "project_category", "priority", "current_stage"]
TARGET_COLUMNS = ["delayed", "expected_additional_delay_days"]
# Not used as model inputs: government_land_pct = 100 - private_land_pct; state/district are represented by
# district_historical_delay_rate; 'delayed' and 'expected_additional_delay_days' are recorded outcomes.
DROPPED_COLUMNS = {
    "government_land_pct": "Redundant: always 100 - private_land_pct",
    "state / district": "Location effect represented by district_historical_delay_rate",
    "delayed": "Recorded outcome flag - shown on cases, not a model input",
}
REQUIRED_COLUMNS = TEXT_COLUMNS + NUMERIC_FEATURES + ["government_land_pct"] + TARGET_COLUMNS


def dataset_path() -> Path:
    return Path(settings.DATASET_PATH)


def _read(path: Path) -> pd.DataFrame:
    magic = path.read_bytes()[:8]
    if magic.startswith(b"PK"):  # .xlsx
        return pd.read_excel(path, engine="openpyxl")
    if magic.startswith(b"\xd0\xcf\x11\xe0"):  # legacy .xls
        return pd.read_excel(path, engine="xlrd")
    return pd.read_csv(path)


def load_dataset(path: Path | None = None) -> tuple[pd.DataFrame, dict]:
    path = Path(path or dataset_path())
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")
    df = _read(path)
    df.columns = [str(c).strip() for c in df.columns]

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {', '.join(missing)}")
    for c in TEXT_COLUMNS:
        df[c] = df[c].astype(str).str.strip()
    if df["case_id"].duplicated().any():
        raise ValueError("Dataset contains duplicate case_id values.")
    df = df.rename(columns={"current_stage": "acquisition_stage"})

    for code, (text_col, values) in CATEGORICAL.items():
        unknown = sorted(set(df[text_col]) - set(values))
        if unknown:
            raise ValueError(f"Unknown {text_col} values: {unknown}. Expected one of {values}.")
        df[code] = df[text_col].map(values.index)

    # Median imputation for missing numeric inputs; imputed fields are recorded per case.
    medians = {c: float(df[c].median()) for c in NUMERIC_FEATURES}
    missing_mask = df[NUMERIC_FEATURES].isna()
    df["imputed_fields"] = missing_mask.apply(lambda r: ",".join(r.index[r]), axis=1)
    df[NUMERIC_FEATURES] = df[NUMERIC_FEATURES].fillna(medians)
    for t in TARGET_COLUMNS:
        if df[t].isna().any():
            raise ValueError(f"Target column '{t}' has missing values.")

    df["significant_delay"] = (df["expected_additional_delay_days"] > HIGH_DELAY_THRESHOLD_DAYS).astype(int)
    info = {
        "file": f"data/{path.name}" if path.parent == settings.DATA_DIR else str(path),
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "imputed_counts": {c: int(n) for c, n in missing_mask.sum().items() if n},
        "medians": medians,
        "dropped_columns": DROPPED_COLUMNS,
    }
    return df, info
