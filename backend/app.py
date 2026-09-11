"""
SCDAid FastAPI inference service.

This backend performs treatment-response ML prediction only.
It does not reimplement CYP2D6, phenoconversion, or clinical-safety rules.
Those remain in the verified JavaScript modules.

Evaluation scope: synthetic proof-of-concept. Not clinical validation.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import List, Optional, Union

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from starlette.middleware.sessions import SessionMiddleware

from auth_routes import router as auth_router
from config import COOKIE_SAMESITE, COOKIE_SECURE, cors_origins, session_secret
from db import init_db

ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT / "ml" / "models" / "scdaid_response_model.joblib"
SCHEMA_PATH = ROOT / "ml" / "models" / "feature_schema.json"

ALLOWED_CANDIDATES = (
    "Morphine",
    "Hydromorphone",
    "Fentanyl",
    "Oxycodone",
    "Codeine",
    "Tramadol",
)

ALWAYS_MISSING = (
    "VOC_history_prior_year",
    "baseline_opioid_daily_MME",
    "baseline_opioid_continuous_days",
)

PHENOTYPE_MAP = {
    "poor metabolizer": "Poor",
    "intermediate metabolizer": "Intermediate",
    "normal metabolizer": "Normal",
    "ultrarapid metabolizer": "Ultrarapid",
    "poor": "Poor",
    "intermediate": "Intermediate",
    "normal": "Normal",
    "ultrarapid": "Ultrarapid",
}

PREVIOUS_RESPONSE_MAP = {
    "favorable": "Favorable",
    "inadequate": "Inadequate",
    "adverse": "Adverse/intolerant",
    "adverse/intolerant": "Adverse/intolerant",
    "unknown": "Unknown",
    "mixed/partial": "Mixed/partial",
}

MODEL_TYPE_LABELS = {
    "linear_regression": "Linear Regression",
}

schema: dict = {}
model = None


class VitalSign(BaseModel):
    name: Optional[str] = None
    value: Optional[Union[str, float, int]] = None
    unit: Optional[str] = None


class CandidateIn(BaseModel):
    candidate_opioid: str
    previous_response_this_opioid: Optional[str] = None

    @field_validator("candidate_opioid")
    @classmethod
    def known_opioid(cls, value: str) -> str:
        if value not in ALLOWED_CANDIDATES:
            raise ValueError(
                f"Unknown candidate opioid {value!r}. "
                f"Allowed: {', '.join(ALLOWED_CANDIDATES)}."
            )
        return value


class PatientIn(BaseModel):
    age: Optional[Union[float, int]] = None
    sex: Optional[str] = None
    weight_kg: Optional[Union[float, int]] = None
    BMI: Optional[Union[float, int]] = None
    baseline_pain: Optional[Union[float, int]] = None
    eGFR: Optional[Union[float, int]] = None
    serum_creatinine: Optional[Union[float, int]] = None
    creatinine_unit: Optional[str] = None
    vital_signs: List[VitalSign] = Field(default_factory=list)
    opioid_tolerance: Optional[str] = None
    SCD_genotype: Optional[str] = None
    CYP2D6_genotype_available: Optional[str] = None
    genotype_activity_score: Optional[Union[float, int]] = None
    genotype_predicted_phenotype: Optional[str] = None
    functional_phenotype: Optional[str] = None
    CYP2D6_inhibitor_strength: Optional[str] = None
    CNS_depressant_present: Optional[str] = None


class PredictRequest(BaseModel):
    patient: PatientIn
    candidates: List[CandidateIn]

    @field_validator("candidates")
    @classmethod
    def at_least_one(cls, value: List[CandidateIn]) -> List[CandidateIn]:
        if not value:
            raise ValueError("At least one candidate opioid is required.")
        names = [item.candidate_opioid for item in value]
        if len(names) != len(set(names)):
            raise ValueError("Duplicate candidate opioids are not allowed.")
        return value


def _empty_to_none(value):
    if value is None:
        return None
    if isinstance(value, str) and value.strip() == "":
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def to_float(value) -> float | None:
    value = _empty_to_none(value)
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return number


def normalize_phenotype(value) -> str | None:
    value = _empty_to_none(value)
    if value is None:
        return None
    return PHENOTYPE_MAP.get(str(value).strip().lower())


def normalize_inhibitor(value) -> str | None:
    value = _empty_to_none(value)
    if value is None:
        return None
    label = str(value).strip()
    lowered = label.lower()
    if lowered in {"none", "unknown", "nan"}:
        return None
    if lowered == "strong":
        return "Strong"
    if lowered == "moderate":
        return "Moderate"
    return label


def normalize_previous_response(value) -> str:
    value = _empty_to_none(value)
    if value is None:
        return "Unknown"
    mapped = PREVIOUS_RESPONSE_MAP.get(str(value).strip().lower())
    return mapped or "Unknown"


def normalize_scd_genotype(value) -> str | None:
    value = _empty_to_none(value)
    if value is None:
        return None
    label = str(value).strip()
    if label == "Other":
        return "Other confirmed SCD"
    return label


def creatinine_mg_dl(value, unit: str | None) -> float | None:
    amount = to_float(value)
    if amount is None:
        return None
    unit_label = str(unit or "").strip().lower().replace("μ", "µ")
    if unit_label in {"µmol/l", "umol/l", "μmol/l"}:
        return amount / 88.4
    return amount


def fahrenheit_to_celsius(value) -> float | None:
    amount = to_float(value)
    if amount is None:
        return None
    return (amount - 32.0) * 5.0 / 9.0


def _normalize_name(value: str | None) -> str:
    text = str(value or "").strip().lower()
    text = text.replace("₂", "2").replace("spo2", "spo2")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _vital_value(row: VitalSign | dict) -> str | float | int | None:
    if isinstance(row, VitalSign):
        return row.value
    return row.get("value")


def _vital_unit(row: VitalSign | dict) -> str:
    if isinstance(row, VitalSign):
        return str(row.unit or "")
    return str(row.get("unit") or "")


def _vital_name(row: VitalSign | dict) -> str:
    if isinstance(row, VitalSign):
        return _normalize_name(row.name)
    return _normalize_name(row.get("name"))


def extract_vitals(rows: list | None) -> dict:
    extracted = {
        "heart_rate_bpm": None,
        "SBP_mmHg": None,
        "DBP_mmHg": None,
        "resp_rate_min": None,
        "SpO2_pct": None,
        "temperature_C": None,
    }
    for row in rows or []:
        name = _vital_name(row)
        unit = _vital_unit(row).strip()
        unit_norm = unit.lower().replace("°", "")
        value = _vital_value(row)

        if name in {"heart rate", "hr"}:
            if unit_norm in {"", "bpm"}:
                extracted["heart_rate_bpm"] = to_float(value)
            continue

        if name in {"respiratory rate", "resp rate", "rr"}:
            if unit_norm in {"", "breaths/min", "breaths min", "/min"}:
                extracted["resp_rate_min"] = to_float(value)
            continue

        if name in {"spo2", "sp o2", "oxygen saturation"}:
            if unit_norm in {"", "%"}:
                extracted["SpO2_pct"] = to_float(value)
            continue

        if name in {"temperature", "temp"}:
            if unit_norm in {"f", "°f", "fahrenheit"}:
                extracted["temperature_C"] = fahrenheit_to_celsius(value)
            elif unit_norm in {"c", "°c", "celsius"}:
                extracted["temperature_C"] = to_float(value)
            else:
                extracted["temperature_C"] = None
            continue

        if name in {"blood pressure", "bp"}:
            text = str(value or "")
            match = re.match(r"^\s*(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)\s*$", text)
            if match:
                extracted["SBP_mmHg"] = to_float(match.group(1))
                extracted["DBP_mmHg"] = to_float(match.group(2))
            continue

        if name in {"sbp", "systolic"}:
            extracted["SBP_mmHg"] = to_float(value)
        if name in {"dbp", "diastolic"}:
            extracted["DBP_mmHg"] = to_float(value)

    return extracted


def patient_features(patient: PatientIn) -> dict:
    vitals = extract_vitals(patient.vital_signs)
    features = {
        "age": to_float(patient.age),
        "weight_kg": to_float(patient.weight_kg),
        "BMI": to_float(patient.BMI),
        "baseline_pain": to_float(patient.baseline_pain),
        "VOC_history_prior_year": None,
        "eGFR": to_float(patient.eGFR),
        "serum_creatinine_mg_dL": creatinine_mg_dl(patient.serum_creatinine, patient.creatinine_unit),
        "heart_rate_bpm": vitals["heart_rate_bpm"],
        "SBP_mmHg": vitals["SBP_mmHg"],
        "DBP_mmHg": vitals["DBP_mmHg"],
        "resp_rate_min": vitals["resp_rate_min"],
        "SpO2_pct": vitals["SpO2_pct"],
        "temperature_C": vitals["temperature_C"],
        "baseline_opioid_daily_MME": None,
        "baseline_opioid_continuous_days": None,
        "genotype_activity_score": to_float(patient.genotype_activity_score),
        "sex": _empty_to_none(patient.sex),
        "SCD_genotype": normalize_scd_genotype(patient.SCD_genotype),
        "opioid_tolerance": _empty_to_none(patient.opioid_tolerance),
        "CNS_depressant_present": _empty_to_none(patient.CNS_depressant_present),
        "CYP2D6_genotype_available": _empty_to_none(patient.CYP2D6_genotype_available),
        "genotype_predicted_phenotype": normalize_phenotype(patient.genotype_predicted_phenotype),
        "functional_phenotype": normalize_phenotype(patient.functional_phenotype),
        "CYP2D6_inhibitor_strength": normalize_inhibitor(patient.CYP2D6_inhibitor_strength),
    }
    return features


def missing_runtime_features(features: dict) -> list[str]:
    missing = []
    for name in schema.get("numeric_features", []) + schema.get("categorical_features", []):
        if name in {"candidate_opioid", "previous_response_this_opioid"}:
            continue
        value = features.get(name)
        if value is None or (isinstance(value, float) and not math.isfinite(value)):
            missing.append(name)
    return missing


def build_model_frame(patient: PatientIn, candidates: list[CandidateIn]) -> tuple[pd.DataFrame, list[str]]:
    base = patient_features(patient)
    numeric = schema["numeric_features"]
    categorical = schema["categorical_features"]
    ordered = numeric + categorical
    rows = []
    for candidate in candidates:
        row = dict(base)
        row["candidate_opioid"] = candidate.candidate_opioid
        row["previous_response_this_opioid"] = normalize_previous_response(
            candidate.previous_response_this_opioid
        )
        rows.append({key: row.get(key) for key in ordered})
    frame = pd.DataFrame(rows, columns=ordered)
    for column in numeric:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    for column in categorical:
        frame[column] = frame[column].where(pd.notnull(frame[column]), np.nan)
    extra = [column for column in frame.columns if column not in ordered]
    if extra:
        raise RuntimeError(f"Refusing extra model columns: {extra}")
    return frame[ordered], missing_runtime_features(base)


def load_artifacts() -> None:
    global schema, model
    if not MODEL_PATH.exists() or not SCHEMA_PATH.exists():
        raise FileNotFoundError(f"Model artifacts not found at {MODEL_PATH} / {SCHEMA_PATH}")
    schema = json.loads(SCHEMA_PATH.read_text())
    model = joblib.load(MODEL_PATH)


def model_type_label() -> str:
    key = schema.get("selected_model", "")
    return MODEL_TYPE_LABELS.get(key, key or "unknown")


app = FastAPI(
    title="SCDAid API",
    description="Synthetic proof-of-concept treatment-response prediction and Google account authentication. Not clinical validation.",
    version="0.1.0",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=session_secret(),
    same_site=COOKIE_SAMESITE,
    https_only=COOKIE_SECURE,
    max_age=60 * 60 * 24 * 30,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)
app.include_router(auth_router)


@app.on_event("startup")
def startup() -> None:
    init_db()
    load_artifacts()


@app.get("/health")
def health():
    loaded = model is not None
    return {
        "status": "ok" if loaded else "error",
        "model_loaded": loaded,
        "model_type": model_type_label() if loaded else None,
        "evaluation_scope": "synthetic proof-of-concept",
    }


@app.post("/predict")
def predict(payload: PredictRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded.")

    frame, missing = build_model_frame(payload.patient, payload.candidates)
    raw = np.asarray(model.predict(frame), dtype=float)
    predictions = []
    for candidate, value in zip(payload.candidates, raw):
        if not np.isfinite(value):
            raise HTTPException(
                status_code=500,
                detail=f"Non-finite prediction for {candidate.candidate_opioid}.",
            )
        predictions.append(
            {
                "candidate_opioid": candidate.candidate_opioid,
                "predicted_delta_pain_60": round(float(value), 2),
                "predicted_delta_pain_60_raw": float(value),
            }
        )
    predictions.sort(key=lambda item: item["predicted_delta_pain_60_raw"], reverse=True)
    return {
        "predictions": predictions,
        "model": {
            "name": model_type_label(),
            "target": "delta pain at 60 minutes",
            "evaluation_scope": "synthetic proof-of-concept",
        },
        "missing_runtime_features": missing,
        "disclaimer": (
            "Simulation-based proof-of-concept. Performance reflects recovery of an "
            "evidence-informed synthetic simulation and does not establish clinical predictive validity."
        ),
    }
