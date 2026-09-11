"""
Inference checks for backend/app.py
Run: python backend/test_inference.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from app import (  # noqa: E402
    ALWAYS_MISSING,
    app,
    build_model_frame,
    creatinine_mg_dl,
    fahrenheit_to_celsius,
    load_artifacts,
    normalize_inhibitor,
    normalize_phenotype,
    normalize_previous_response,
)

load_artifacts()
client = TestClient(app)


def base_patient(**overrides):
    patient = {
        "age": 32,
        "sex": "Female",
        "weight_kg": 70,
        "BMI": None,
        "baseline_pain": 8,
        "eGFR": 90,
        "serum_creatinine": None,
        "creatinine_unit": "mg/dL",
        "vital_signs": [],
        "opioid_tolerance": "No",
        "SCD_genotype": "HbSS",
        "CYP2D6_genotype_available": "Yes",
        "genotype_activity_score": 2.0,
        "genotype_predicted_phenotype": "Normal metabolizer",
        "functional_phenotype": "Normal metabolizer",
        "CYP2D6_inhibitor_strength": "None",
        "CNS_depressant_present": "No",
    }
    patient.update(overrides)
    return patient


def check(name, ok, detail=""):
    if ok:
        print(f"PASS  {name}")
        return 0
    print(f"FAIL  {name}  {detail}")
    return 1


def main() -> int:
    failed = 0

    health = client.get("/health")
    body = health.json()
    failed += check(
        "/health or model load succeeds",
        health.status_code == 200 and body.get("model_loaded") is True and body.get("model_type") == "Linear Regression",
        str(body),
    )

    payload = {
        "patient": base_patient(),
        "candidates": [
            {"candidate_opioid": "Morphine", "previous_response_this_opioid": "Unknown"},
            {"candidate_opioid": "Hydromorphone", "previous_response_this_opioid": "Favorable"},
        ],
    }
    response = client.post("/predict", json=payload)
    data = response.json()
    preds = data.get("predictions") or []
    failed += check(
        "valid Morphine + Hydromorphone produces two numeric predictions",
        response.status_code == 200
        and len(preds) == 2
        and all(isinstance(item.get("predicted_delta_pain_60"), (int, float)) for item in preds)
        and {item["candidate_opioid"] for item in preds} == {"Morphine", "Hydromorphone"}
        and preds[0]["predicted_delta_pain_60"] >= preds[1]["predicted_delta_pain_60"],
        str(data),
    )

    unknown = client.post(
        "/predict",
        json={
            "patient": base_patient(),
            "candidates": [{"candidate_opioid": "Hydrocodone", "previous_response_this_opioid": "Unknown"}],
        },
    )
    failed += check(
        "unknown candidate opioid is rejected",
        unknown.status_code in {400, 422},
        f"status={unknown.status_code} body={unknown.text}",
    )

    empty = client.post("/predict", json={"patient": base_patient(), "candidates": []})
    failed += check(
        "empty candidate list is rejected",
        empty.status_code in {400, 422},
        f"status={empty.status_code}",
    )

    sparse = client.post(
        "/predict",
        json={
            "patient": base_patient(
                BMI=None,
                serum_creatinine=None,
                vital_signs=[],
                SCD_genotype=None,
                genotype_activity_score=None,
                genotype_predicted_phenotype=None,
                functional_phenotype=None,
                CYP2D6_inhibitor_strength=None,
            ),
            "candidates": [{"candidate_opioid": "Fentanyl", "previous_response_this_opioid": None}],
        },
    )
    failed += check(
        "missing optional features do not crash prediction",
        sparse.status_code == 200 and len(sparse.json().get("predictions") or []) == 1,
        sparse.text,
    )

    failed += check(
        'runtime "Normal metabolizer" normalizes to training "Normal"',
        normalize_phenotype("Normal metabolizer") == "Normal"
        and normalize_phenotype("Poor metabolizer") == "Poor"
        and normalize_phenotype("Ultrarapid metabolizer") == "Ultrarapid",
    )

    failed += check(
        'runtime no-inhibitor state does not become literal "None"',
        normalize_inhibitor("None") is None and normalize_inhibitor("Strong") == "Strong",
    )

    converted = creatinine_mg_dl(88.4, "µmol/L")
    failed += check(
        "µmol/L creatinine converts correctly to mg/dL",
        converted is not None and abs(converted - 1.0) < 1e-9,
        f"got {converted}",
    )
    failed += check(
        "missing creatinine remains missing",
        creatinine_mg_dl(None, "µmol/L") is None,
    )

    temp_c = fahrenheit_to_celsius(98.6)
    failed += check(
        "Fahrenheit temperature converts correctly to Celsius",
        temp_c is not None and abs(temp_c - 37.0) < 0.05,
        f"got {temp_c}",
    )

    from app import CandidateIn, PatientIn

    frame, missing = build_model_frame(
        PatientIn(**base_patient(vital_signs=[{"name": "Temperature", "value": "98.6", "unit": "°F"}])),
        [CandidateIn(candidate_opioid="Morphine", previous_response_this_opioid="Adverse")],
    )
    failed += check(
        "missing VOC/MME/duration remain missing rather than fabricated",
        all(frame[col].isna().all() for col in ALWAYS_MISSING)
        and set(ALWAYS_MISSING).issubset(set(missing)),
        f"missing={missing} voc={frame['VOC_history_prior_year'].tolist()}",
    )
    failed += check(
        "Adverse previous response normalizes to Adverse/intolerant",
        frame.loc[0, "previous_response_this_opioid"] == "Adverse/intolerant"
        and normalize_previous_response(None) == "Unknown",
    )
    import pandas as pd

    failed += check(
        "inhibitor None becomes missing in the model frame",
        pd.isna(frame.loc[0, "CYP2D6_inhibitor_strength"]),
        str(frame.loc[0, "CYP2D6_inhibitor_strength"]),
    )
    failed += check(
        "predicted phenotype stored as training Normal",
        frame.loc[0, "genotype_predicted_phenotype"] == "Normal",
        str(frame.loc[0, "genotype_predicted_phenotype"]),
    )
    temp_frame, _ = build_model_frame(
        PatientIn(**base_patient(vital_signs=[{"name": "Temperature", "value": "98.6", "unit": "°F"}])),
        [CandidateIn(candidate_opioid="Morphine")],
    )
    failed += check(
        "Fahrenheit vital is converted in the model frame",
        abs(float(temp_frame.loc[0, "temperature_C"]) - 37.0) < 0.05,
        str(temp_frame.loc[0, "temperature_C"]),
    )
    cr_frame, _ = build_model_frame(
        PatientIn(**base_patient(serum_creatinine=88.4, creatinine_unit="µmol/L")),
        [CandidateIn(candidate_opioid="Morphine")],
    )
    failed += check(
        "creatinine conversion is applied in the model frame",
        abs(float(cr_frame.loc[0, "serum_creatinine_mg_dL"]) - 1.0) < 1e-9,
        str(cr_frame.loc[0, "serum_creatinine_mg_dL"]),
    )

    extra_cols = set(frame.columns) - set(
        __import__("app").schema["numeric_features"] + __import__("app").schema["categorical_features"]
    )
    failed += check("model frame has no extra columns", extra_cols == set(), str(extra_cols))

    print("")
    total = 15
    passed = total - failed
    # recount from failed variable which is a count of failures
    print(f"{'ok' if failed == 0 else 'FAILED'}: {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
