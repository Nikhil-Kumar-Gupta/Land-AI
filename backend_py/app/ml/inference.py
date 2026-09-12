"""Model inference + SHAP explanations. The only place where risk scores and predicted delays are produced."""
import json
import threading

import joblib
import numpy as np
import pandas as pd
import shap

from ..config import settings
from .features import FEATURE_BY_NAME, FEATURE_NAMES, display_value, risk_level, to_frame


class ModelNotTrainedError(RuntimeError):
    pass


class ModelService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._loaded = False

    def _load(self) -> None:
        with self._lock:
            if self._loaded:
                return
            art = settings.ARTIFACT_DIR
            if not (art / "risk_model.joblib").exists():
                raise ModelNotTrainedError("Model artifacts not found. Run `python -m scripts.seed` first.")
            self.risk_model = joblib.load(art / "risk_model.joblib")
            self.delay_model = joblib.load(art / "delay_model.joblib")
            self.metrics = json.loads((art / "metrics.json").read_text())
            background = pd.read_csv(art / "shap_background.csv")[FEATURE_NAMES].astype(float)
            self.risk_explainer = shap.TreeExplainer(
                self.risk_model, data=background, model_output="probability",
                feature_perturbation="interventional",
            )
            self.delay_explainer = shap.TreeExplainer(
                self.delay_model, data=background, feature_perturbation="interventional"
            )
            self._loaded = True

    def reload(self) -> None:
        self._loaded = False
        self._load()

    @property
    def model_version(self) -> str:
        self._load()
        return self.metrics["model_version"]

    def info(self) -> dict:
        self._load()
        return self.metrics

    @staticmethod
    def _positive_class(values, expected):
        values = np.asarray(values)
        if values.ndim == 3:  # (n, features, classes) e.g. sklearn classifiers
            values = values[:, :, 1]
        expected = np.atleast_1d(np.asarray(expected, dtype=float))
        return values, float(expected[-1])

    def predict(self, feature_rows: list[dict]) -> list[dict]:
        """Predict risk + delay with SHAP contributions for each feature row."""
        self._load()
        X = to_frame(feature_rows)
        proba = self.risk_model.predict_proba(X)[:, 1]
        delay = np.clip(self.delay_model.predict(X), 0, None)

        risk_shap, base_risk = self._positive_class(self.risk_explainer.shap_values(X), self.risk_explainer.expected_value)
        delay_shap, base_delay = self._positive_class(self.delay_explainer.shap_values(X), self.delay_explainer.expected_value)

        results = []
        for i in range(len(X)):
            row = X.iloc[i]
            results.append({
                "risk_probability": float(proba[i]),
                "risk_level": risk_level(float(proba[i])),
                "predicted_delay_days": float(round(delay[i])),
                "base_risk": base_risk,
                "base_delay": base_delay,
                "shap_risk": self._contributions(row, risk_shap[i]),
                "shap_delay": self._contributions(row, delay_shap[i]),
            })
        return results

    @staticmethod
    def _contributions(row: pd.Series, values: np.ndarray) -> list[dict]:
        items = []
        for name, value in zip(FEATURE_NAMES, values):
            f = FEATURE_BY_NAME[name]
            items.append({
                "feature": name,
                "label": f.label,
                "category": f.category,
                "value": float(row[name]),
                "display_value": display_value(name, float(row[name])),
                "shap": round(float(value), 6),
            })
        items.sort(key=lambda x: abs(x["shap"]), reverse=True)
        return items


model_service = ModelService()
