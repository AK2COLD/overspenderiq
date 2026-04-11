"""
Prediction module for OverspenderIQ.
Loads the pre-trained Random Forest model and returns
overspend_probability + is_overspender for a feature vector.
"""

import os
import numpy as np
import pandas as pd
import joblib
from dotenv import load_dotenv

load_dotenv()

MODEL_PATH    = os.getenv("MODEL_PATH",    "ml/model.pkl")
FEATURES_PATH = os.getenv("FEATURES_PATH", "ml/model_features.joblib")

_model         = None
_feature_names = None


def _load():
    global _model, _feature_names
    if _model is None:
        _model         = joblib.load(MODEL_PATH)
        _feature_names = joblib.load(FEATURES_PATH)


def get_feature_names() -> list[str]:
    _load()
    return _feature_names


def predict(feature_vector: dict) -> dict:
    """
    Accept a dict of {feature_name: value} and return:
      {overspend_probability: float, is_overspender: bool}
    Missing features default to 0.
    """
    _load()
    row = {f: feature_vector.get(f, 0.0) for f in _feature_names}
    X   = pd.DataFrame([row])[_feature_names]
    prob = float(_model.predict_proba(X)[0, 1])
    return {
        "overspend_probability": round(prob, 4),
        "is_overspender":        prob >= 0.5,
    }


def get_feature_importances() -> list[dict]:
    """Return sorted list of {feature, importance} dicts."""
    _load()
    importances = _model.feature_importances_
    pairs = sorted(
        zip(_feature_names, importances),
        key=lambda x: x[1],
        reverse=True,
    )
    return [{"feature": f, "importance": round(float(i), 6)} for f, i in pairs]
