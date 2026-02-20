from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = joblib.load("phenotype_model.joblib")

class PatientInput(BaseModel):
    age: float
    weight: float
    egfr: float
    sex: str
    cyp2d6_inhibitor: str
    prior_codeine_response: str
    prior_tramadol_response: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict_phenotype")
def predict(inp: PatientInput):
    X = pd.DataFrame([inp.dict()])
    proba = model.predict_proba(X)[0]
    classes = list(model.named_steps["clf"].classes_)
    pred = classes[int(proba.argmax())]
    probs = {cls: float(p) for cls, p in zip(classes, proba)}

    confidence = max(proba)
    conf_level = "high" if confidence >= 0.7 else ("medium" if confidence >= 0.5 else "low")

    return {
        "predicted": pred,
        "confidence": conf_level,
        "probabilities": probs
    }