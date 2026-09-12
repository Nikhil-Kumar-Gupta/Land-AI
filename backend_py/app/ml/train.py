"""Train the delay-risk classifier and additional-delay regressor on the project dataset.

Risk target:  significant_delay = expected_additional_delay_days > HIGH_DELAY_THRESHOLD_DAYS
Delay target: expected_additional_delay_days

For each task an XGBoost model and a Random Forest are trained; the candidate with the better hold-out score
(ROC-AUC for risk, MAE for delay) is kept. The choice and all metrics are written to model_artifacts/metrics.json,
which the Model Architecture page displays as-is.

Run:  python -m app.ml.train
"""
import hashlib
import json
from datetime import datetime, timezone

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier, XGBRegressor

from ..config import settings
from .dataset import dataset_path, load_dataset
from .features import FEATURE_NAMES, RISK_BANDS, RISK_DEFINITION

RANDOM_STATE = 42


def _classifier_candidates():
    return {
        "XGBoost Classifier": XGBClassifier(
            n_estimators=300, max_depth=4, learning_rate=0.05, subsample=0.9, colsample_bytree=0.9,
            eval_metric="logloss", random_state=RANDOM_STATE, n_jobs=-1,
            enable_categorical=False,  # all features are numeric codes; required for interventional TreeSHAP
        ),
        "Random Forest Classifier": RandomForestClassifier(
            n_estimators=300, max_depth=10, min_samples_leaf=5, random_state=RANDOM_STATE, n_jobs=-1,
        ),
    }


def _regressor_candidates():
    return {
        "XGBoost Regressor": XGBRegressor(
            n_estimators=400, max_depth=4, learning_rate=0.05, subsample=0.9, colsample_bytree=0.9,
            random_state=RANDOM_STATE, n_jobs=-1, enable_categorical=False,
        ),
        "Random Forest Regressor": RandomForestRegressor(
            n_estimators=300, max_depth=12, min_samples_leaf=4, random_state=RANDOM_STATE, n_jobs=-1,
        ),
    }


def train() -> dict:
    df, info = load_dataset()
    X = df[FEATURE_NAMES].astype(float)
    y_cls = df["significant_delay"].astype(int)
    y_reg = df["expected_additional_delay_days"].astype(float)

    X_tr, X_te, yc_tr, yc_te, yr_tr, yr_te = train_test_split(
        X, y_cls, y_reg, test_size=0.2, random_state=RANDOM_STATE, stratify=y_cls
    )

    cls_results, best_cls, best_auc = {}, None, -1.0
    for name, model in _classifier_candidates().items():
        model.fit(X_tr, yc_tr)
        proba = model.predict_proba(X_te)[:, 1]
        pred = (proba >= 0.5).astype(int)
        m = {
            "roc_auc": round(float(roc_auc_score(yc_te, proba)), 4),
            "accuracy": round(float(accuracy_score(yc_te, pred)), 4),
            "precision": round(float(precision_score(yc_te, pred, zero_division=0)), 4),
            "recall": round(float(recall_score(yc_te, pred)), 4),
            "f1": round(float(f1_score(yc_te, pred)), 4),
        }
        cls_results[name] = m
        if m["roc_auc"] > best_auc:
            best_auc, best_cls = m["roc_auc"], (name, model)

    reg_results, best_reg, best_mae = {}, None, float("inf")
    for name, model in _regressor_candidates().items():
        model.fit(X_tr, yr_tr)
        pred = np.clip(model.predict(X_te), 0, None)
        m = {
            "mae_days": round(float(mean_absolute_error(yr_te, pred)), 2),
            "r2": round(float(r2_score(yr_te, pred)), 4),
        }
        reg_results[name] = m
        if m["mae_days"] < best_mae:
            best_mae, best_reg = m["mae_days"], (name, model)

    settings.ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_cls[1], settings.ARTIFACT_DIR / "risk_model.joblib")
    joblib.dump(best_reg[1], settings.ARTIFACT_DIR / "delay_model.joblib")
    # Background sample for interventional SHAP
    X_tr.sample(n=min(100, len(X_tr)), random_state=RANDOM_STATE).to_csv(
        settings.ARTIFACT_DIR / "shap_background.csv", index=False
    )

    data_hash = hashlib.sha256(dataset_path().read_bytes()).hexdigest()[:12]
    trained_at = datetime.now(timezone.utc)
    metrics = {
        "model_version": f"v{trained_at:%Y%m%d%H%M}-{data_hash[:6]}",
        "trained_at": trained_at.isoformat(),
        "dataset": {
            "file": info["file"],
            "synthetic": True,
            "rows": info["rows"],
            "columns": info["columns"],
            "train_rows": int(len(X_tr)),
            "test_rows": int(len(X_te)),
            "positive_rate": round(float(y_cls.mean()), 4),
            "sha256_prefix": data_hash,
        },
        "preprocessing": {
            "imputation": "Median of each numeric column",
            "imputed_counts": info["imputed_counts"],
            "medians": info["medians"],
            "dropped_columns": info["dropped_columns"],
            "encoding": "Stage (ordered), project type, priority and project category as integer codes",
            "split": "80/20 stratified on the significant-delay label, random_state=42",
        },
        "target": {"risk": RISK_DEFINITION, "delay": "Expected additional delay (days)"},
        "risk_bands": RISK_BANDS,
        "features": FEATURE_NAMES,
        "risk_model": {"selected": best_cls[0], "candidates": cls_results},
        "delay_model": {"selected": best_reg[0], "candidates": reg_results},
        "explainability": "SHAP TreeExplainer (interventional, background of 100 training rows)",
    }
    (settings.ARTIFACT_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))
    return metrics


if __name__ == "__main__":
    result = train()
    print(json.dumps({k: result[k] for k in ("model_version", "risk_model", "delay_model")}, indent=2))
