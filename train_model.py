import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import joblib

rng = np.random.default_rng(42)

N = 3000

# Simulated CYP2D6 phenotype distribution
phenotypes = rng.choice(
    ["PM", "IM", "NM", "UM"],
    size=N,
    p=[0.10, 0.35, 0.45, 0.10]
)


def simulate_response(pheno, inhibitor):
    base = {
        "effective": 0.45,
        "ineffective": 0.45,
        "toxicity": 0.10
    }

    if pheno == "PM":
        base = {
            "effective": 0.15,
            "ineffective": 0.75,
            "toxicity": 0.10
        }

    elif pheno == "IM":
        base = {
            "effective": 0.30,
            "ineffective": 0.60,
            "toxicity": 0.10
        }

    elif pheno == "NM":
        base = {
            "effective": 0.55,
            "ineffective": 0.35,
            "toxicity": 0.10
        }

    elif pheno == "UM":
        base = {
            "effective": 0.40,
            "ineffective": 0.20,
            "toxicity": 0.40
        }

    # CYP2D6 inhibitor reduces functional CYP2D6 activity
    if inhibitor == "yes":
        base = {
            "effective": max(0.05, base["effective"] - 0.15),
            "ineffective": min(0.90, base["ineffective"] + 0.20),
            "toxicity": base["toxicity"],
        }

    total = sum(base.values())

    probs = [
        base["effective"] / total,
        base["ineffective"] / total,
        base["toxicity"] / total
    ]

    return rng.choice(
        ["effective", "ineffective", "toxicity"],
        p=probs
    )


# Simulated patient features
age = rng.integers(18, 55, size=N)
weight = rng.normal(70, 15, size=N).clip(40, 140)
egfr = rng.normal(95, 25, size=N).clip(15, 160)
inhibitor = rng.choice(["yes", "no"], size=N, p=[0.18, 0.82])
sex = rng.choice(["F", "M"], size=N)

prior_codeine_response = [
    simulate_response(p, inh)
    for p, inh in zip(phenotypes, inhibitor)
]

prior_tramadol_response = [
    simulate_response(p, inh)
    for p, inh in zip(phenotypes, inhibitor)
]

df = pd.DataFrame({
    "age": age,
    "weight": weight,
    "egfr": egfr,
    "sex": sex,
    "cyp2d6_inhibitor": inhibitor,
    "prior_codeine_response": prior_codeine_response,
    "prior_tramadol_response": prior_tramadol_response,
    "phenotype": phenotypes
})

y = df["phenotype"]
X = df.drop(columns=["phenotype"])

cat_cols = [
    "sex",
    "cyp2d6_inhibitor",
    "prior_codeine_response",
    "prior_tramadol_response"
]

num_cols = [
    "age",
    "weight",
    "egfr"
]

preprocess = ColumnTransformer(
    transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
        ("num", "passthrough", num_cols),
    ]
)

clf = LogisticRegression(
    max_iter=600,
    class_weight="balanced",
    multi_class="multinomial"
)

model = Pipeline(
    steps=[
        ("preprocess", preprocess),
        ("clf", clf)
    ]
)

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

model.fit(X_train, y_train)

# Model evaluation
y_pred = model.predict(X_test)

print("Accuracy:", accuracy_score(y_test, y_pred))

print("\nClassification Report:")
print(classification_report(y_test, y_pred))

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))

joblib.dump(model, "phenotype_model.joblib")

print("\nModel trained and saved as phenotype_model.joblib")
