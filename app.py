from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import os
import numpy as np

app = FastAPI(title="SCDAid Phenotype API")

# 🔓 CORS (يسمح لأي موقع يكلم الـ API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# تحميل الموديل
MODEL_PATH = os.path.join(os.path.dirname(__file__), "phenotype_model.joblib")
model = joblib.load(MODEL_PATH)


class PatientInput(BaseModel):
    age: float
    weight: float
    egfr: float
    sex: str
    cyp2d6_inhibitor: str
    prior_codeine_response: str
    prior_tramadol_response: str


@app.get("/")
def root():
    return {"message": "SCDAid API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict_phenotype")
def predict(inp: PatientInput):

    # نحول البيانات لقائمة بنفس ترتيب التدريب
    X = [[
        inp.age,
        inp.weight,
        inp.egfr,
        inp.sex,
        inp.cyp2d6_inhibitor,
        inp.prior_codeine_response,
        inp.prior_tramadol_response
    ]]

    # التنبؤ بالاحتمالات
    probabilities = model.predict_proba(X)[0]

    # استخراج الكلاسات سواء الموديل Pipeline أو مباشر
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

    # حساب مستوى الثقة
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
        "probabilities": probs_dict
    }
