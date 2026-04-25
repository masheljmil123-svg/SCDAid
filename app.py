from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal
import joblib
import os
import numpy as np
import pandas as pd

app = FastAPI(title="SCDAid Phenotype API")

# CORS: allows your website to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load trained model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "phenotype_model.joblib")
model = joblib.load(MODEL_PATH)


class PatientInput(BaseModel):
    age: float = Field(..., ge=0, le=120)
    weight: float = Field(..., ge=2, le=250)
    egfr: float = Field(..., ge=0, le=200)

    sex: Literal["F", "M"]
    cyp2d6_inhibitor: Literal["yes", "no"]

    prior_codeine_response: Literal["effective", "ineffective", "toxicity"]
    prior_tramadol_response: Literal["effective", "ineffective", "toxicity"]


@app.get("/")
def root():
    return {"message": "SCDAid API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict_phenotype")
def predict(inp: PatientInput):

    # Send data to the model as a DataFrame with the same column names used in training
    X = pd.DataFrame([{
        "age": inp.age,
        "weight": inp.weight,
        "egfr": inp.egfr,
        "sex": inp.sex,
        "cyp2d6_inhibitor": inp.cyp2d6_inhibitor,
        "prior_codeine_response": inp.prior_codeine_response,
        "prior_tramadol_response": inp.prior_tramadol_response
    }])

    probabilities = model.predict_proba(X)[0]

    if hasattr(model, "classes_"):
        classes = model.classes_
    elif hasattr(model, "named_steps") and "clf" in model.named_steps:
        classes = model.named_steps["clf"].classes_
    else:
        return {"error": "Model classes not found"}

    predicted = classes[int(np.argmax(probabilities))]

    probs_dict = {
        str(cls): float(prob)
        for cls, prob in zip(classes, probabilities)
    }

    top = float(np.max(probabilities))

    if top >= 0.75:
        confidence = "high"
    elif top >= 0.55:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "predicted": str(predicted),
        "confidence": confidence,
        "probabilities": probs_dict,
        "clinical_note": "Prototype prediction only. Not a substitute for CYP2D6 genotyping or clinical judgment."
    }
