#!/usr/bin/env python3
"""
SCDAid proof-of-concept ranking-model training pipeline.

This script trains on synthetic potential outcomes
(SCDAid_Treatment_Candidates_v3.csv) merged with pretreatment encounter
characteristics. All metrics are simulation-only / synthetic oracle
evaluation. They do not establish clinical predictive validity.
"""

from __future__ import annotations

import json
import math
import warnings
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import GroupKFold, ParameterGrid
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBRegressor

warnings.filterwarnings("ignore", category=UserWarning)

SEED = 42
N_SPLITS = 5
HIGH_VOC_THRESHOLD = 6  # documented high-utilization cutoff (upper quartile of VOC history)
MIN_SUBGROUP_ROWS = 50
MIN_SUBGROUP_ENCOUNTERS = 30

ML_DIR = Path(__file__).resolve().parent
DATA_DIR = ML_DIR / "data"
MODELS_DIR = ML_DIR / "models"
CANDIDATES_PATH = DATA_DIR / "SCDAid_Treatment_Candidates_v3.csv"
ENCOUNTERS_PATH = DATA_DIR / "SCDAid_Synthetic_Encounters_v3.csv"
MODEL_PATH = MODELS_DIR / "scdaid_response_model.joblib"
SCHEMA_PATH = MODELS_DIR / "feature_schema.json"
REPORT_JSON_PATH = ML_DIR / "model_report.json"
REPORT_MD_PATH = ML_DIR / "model_report.md"

TARGET = "potential_delta_pain_60"

NUMERIC_FEATURES = [
    "age",
    "weight_kg",
    "BMI",
    "baseline_pain",
    "VOC_history_prior_year",
    "eGFR",
    "serum_creatinine_mg_dL",
    "heart_rate_bpm",
    "SBP_mmHg",
    "DBP_mmHg",
    "resp_rate_min",
    "SpO2_pct",
    "temperature_C",
    "baseline_opioid_daily_MME",
    "baseline_opioid_continuous_days",
    "genotype_activity_score",
]

CATEGORICAL_FEATURES = [
    "sex",
    "SCD_genotype",
    "opioid_tolerance",
    "CNS_depressant_present",
    "CYP2D6_genotype_available",
    "genotype_predicted_phenotype",
    "functional_phenotype",
    "CYP2D6_inhibitor_strength",
    "candidate_opioid",
    "previous_response_this_opioid",
]

ID_FIELDS = ["patient_id", "encounter_id", "split"]

ENCOUNTER_ONLY_COLUMNS = [
    "age",
    "sex",
    "weight_kg",
    "BMI",
    "VOC_history_prior_year",
    "serum_creatinine_mg_dL",
    "heart_rate_bpm",
    "SBP_mmHg",
    "DBP_mmHg",
    "resp_rate_min",
    "SpO2_pct",
    "temperature_C",
    "SCD_genotype",
    "baseline_opioid_daily_MME",
    "baseline_opioid_continuous_days",
    "genotype_activity_score",
]

LEAKAGE_TOKENS = [
    "potential_pain",
    "potential_delta",
    "potential_percent",
    "potential_clinically",
    "synthetic_rescue",
    "synthetic_switch",
    "pain_30min",
    "pain_60min",
    "pain_90min",
    "pain_120min",
    "pain_180min",
    "pain_at_disposition",
    "delta_pain",
    "percent_pain",
    "clinically_meaningful",
    "rescue",
    "switch",
    "ed_los",
    "admission_probability",
    "disposition",
    "serious_opioid_ae",
    "eligibility_status",
    "training_eligible",
    "rule_reasons",
    "observed_opioid_eligibility",
    "observed_rule_reason",
]

EXPLICIT_EXCLUSIONS = [
    "allergy_intolerance",
    "prev_resp_morphine",
    "prev_resp_hydromorphone",
    "prev_resp_fentanyl",
    "prev_resp_oxycodone",
    "prev_resp_tramadol",
    "prev_resp_codeine",
    "dose_strategy",
    "renal_band",
    "hepatic_status",
    "AST_U_L",
    "ALT_U_L",
    "total_bilirubin_mg_dL",
    "current_medications",
    "comorbidities",
    "CYP2D6_allele1",
    "CYP2D6_allele2",
    "copy_number_variation",
    "adjusted_activity_score",
    "inhibitor_factor",
    "phenoconversion",
    "opioid_administered",
]


def leaky_column(name: str) -> bool:
    lowered = name.lower()
    return any(token in lowered for token in LEAKAGE_TOKENS)


def load_tables() -> tuple[pd.DataFrame, pd.DataFrame]:
    if not CANDIDATES_PATH.exists() or not ENCOUNTERS_PATH.exists():
        raise FileNotFoundError(
            f"Expected synthetic datasets at {CANDIDATES_PATH} and {ENCOUNTERS_PATH}."
        )
    candidates = pd.read_csv(CANDIDATES_PATH)
    encounters = pd.read_csv(ENCOUNTERS_PATH)
    return candidates, encounters


def merge_training_frame(candidates: pd.DataFrame, encounters: pd.DataFrame) -> pd.DataFrame:
    eligible = candidates[candidates["training_eligible"] == "Yes"].copy()
    enc_cols = ["encounter_id"] + [c for c in ENCOUNTER_ONLY_COLUMNS if c in encounters.columns]
    missing_enc = [c for c in ENCOUNTER_ONLY_COLUMNS if c not in encounters.columns]
    merged = eligible.merge(encounters[enc_cols], on="encounter_id", how="left", validate="many_to_one")
    merged.attrs["missing_encounter_features"] = missing_enc
    return merged


def confirm_patient_separation(frame: pd.DataFrame) -> dict:
    development_ids = set(frame.loc[frame["split"] == "Development", "patient_id"].unique())
    test_ids = set(frame.loc[frame["split"] == "Held-out test", "patient_id"].unique())
    overlap = sorted(development_ids & test_ids)
    if overlap:
        raise RuntimeError(
            "Patient leakage detected: the same patient_id appears in Development and "
            f"Held-out test ({len(overlap)} patients). Training stopped."
        )
    return {
        "development_patients": len(development_ids),
        "held_out_patients": len(test_ids),
        "overlapping_patients": 0,
        "patient_leakage": False,
    }


def leakage_audit(merged: pd.DataFrame, candidates: pd.DataFrame, encounters: pd.DataFrame) -> dict:
    used = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    missing_requested = [c for c in used if c not in merged.columns]
    source_columns = sorted(set(merged.columns) | set(candidates.columns) | set(encounters.columns))
    excluded_leakage = sorted({c for c in source_columns if leaky_column(c) and c != TARGET})
    excluded_ids = [c for c in ID_FIELDS if c in source_columns]
    excluded_explicit = [c for c in EXPLICIT_EXCLUSIONS if c in source_columns]
    unused_source = [
        c
        for c in source_columns
        if c not in used
        and c not in excluded_ids
        and c != TARGET
        and c not in excluded_leakage
        and c not in excluded_explicit
    ]
    for col in used:
        if leaky_column(col):
            raise RuntimeError(f"Allow-listed predictor {col} matches a leakage token.")
    return {
        "requested_features": used,
        "missing_requested_features": missing_requested,
        "used_features": [c for c in used if c in merged.columns],
        "excluded_leakage_columns": excluded_leakage,
        "excluded_id_fields": excluded_ids,
        "excluded_non_predictor_columns": excluded_explicit,
        "other_unused_source_columns": unused_source,
        "target": TARGET,
        "target_not_used_as_predictor": True,
        "allergy_used_as_predictor": False,
        "eligibility_used_as_predictor": False,
    }


def prepare_xy(frame: pd.DataFrame, numeric: list[str], categorical: list[str]):
    work = frame.copy()
    for col in numeric:
        work[col] = pd.to_numeric(work[col], errors="coerce")
    for col in categorical:
        raw = work[col]
        work[col] = [
            np.nan if pd.isna(value) or str(value).strip() == "" else str(value)
            for value in raw.tolist()
        ]
    X = work[numeric + categorical]
    y = work[TARGET].astype(float)
    meta = work[ID_FIELDS + ["candidate_opioid", "sex", "opioid_tolerance", "CYP2D6_genotype_available", "eGFR", "VOC_history_prior_year"]].copy()
    return X, y, meta


def make_pipeline(
    numeric: list[str],
    categorical: list[str],
    estimator,
    scale_numeric: bool,
    drop_first: bool = False,
) -> Pipeline:
    numeric_steps = [("imputer", SimpleImputer(strategy="median"))]
    if scale_numeric:
        numeric_steps.append(("scaler", StandardScaler()))
    encoder_kwargs = {"handle_unknown": "ignore", "sparse_output": False}
    if drop_first:
        encoder_kwargs["drop"] = "first"
    categorical_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="constant", fill_value="Unknown")),
            ("onehot", OneHotEncoder(**encoder_kwargs)),
        ]
    )
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline(numeric_steps), numeric),
            ("cat", categorical_pipe, categorical),
        ],
        remainder="drop",
    )
    return Pipeline([("preprocess", preprocessor), ("model", estimator)])


def regression_metrics(y_true, y_pred) -> dict:
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(math.sqrt(mean_squared_error(y_true, y_pred)))
    return {"mae": round(mae, 6), "rmse": round(rmse, 6), "n_rows": int(len(y_true))}


def ranking_metrics(meta: pd.DataFrame, y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    frame = meta.copy()
    frame["y_true"] = np.asarray(y_true, dtype=float)
    frame["y_pred"] = np.asarray(y_pred, dtype=float)
    agreements = []
    regrets = []
    n_candidates = []
    for _, group in frame.groupby("encounter_id", sort=False):
        if group.empty:
            continue
        pred_idx = group["y_pred"].idxmax()
        true_idx = group["y_true"].idxmax()
        selected = group.loc[pred_idx, "candidate_opioid"]
        oracle = group.loc[true_idx, "candidate_opioid"]
        agreements.append(bool(selected == oracle))
        regrets.append(float(group.loc[true_idx, "y_true"] - group.loc[pred_idx, "y_true"]))
        n_candidates.append(int(len(group)))
    if not agreements:
        return {
            "top1_agreement": None,
            "mean_ranking_regret": None,
            "median_ranking_regret": None,
            "n_encounters": 0,
        }
    return {
        "top1_agreement": round(float(np.mean(agreements)), 6),
        "mean_ranking_regret": round(float(np.mean(regrets)), 6),
        "median_ranking_regret": round(float(np.median(regrets)), 6),
        "n_encounters": int(len(agreements)),
        "mean_eligible_candidates": round(float(np.mean(n_candidates)), 3),
    }


def _finite_metric(value, worst=float("inf")) -> float:
    if value is None or not np.isfinite(value):
        return worst
    return float(value)


def grouped_cv(pipeline_builder, param_grid, X, y, meta, groups) -> dict:
    cv = GroupKFold(n_splits=N_SPLITS)
    best = None
    all_configs = []
    grid = list(ParameterGrid(param_grid)) or [{}]
    for params in grid:
        fold_rows = []
        for fold, (train_idx, val_idx) in enumerate(cv.split(X, y, groups), start=1):
            model = pipeline_builder(params)
            model.fit(X.iloc[train_idx], y.iloc[train_idx])
            pred = np.asarray(model.predict(X.iloc[val_idx]), dtype=float)
            y_val = y.iloc[val_idx].to_numpy()
            reg = regression_metrics(y_val, pred)
            rank = ranking_metrics(meta.iloc[val_idx], y_val, pred)
            fold_rows.append({**reg, **rank, "fold": fold})
        summary = {
            "params": params,
            "mae_mean": round(float(np.mean([r["mae"] for r in fold_rows])), 6),
            "mae_std": round(float(np.std([r["mae"] for r in fold_rows])), 6),
            "rmse_mean": round(float(np.mean([r["rmse"] for r in fold_rows])), 6),
            "rmse_std": round(float(np.std([r["rmse"] for r in fold_rows])), 6),
            "top1_agreement_mean": round(float(np.mean([r["top1_agreement"] for r in fold_rows])), 6),
            "mean_ranking_regret_mean": round(
                float(np.mean([r["mean_ranking_regret"] for r in fold_rows])), 6
            ),
            "median_ranking_regret_mean": round(
                float(np.mean([r["median_ranking_regret"] for r in fold_rows])), 6
            ),
            "folds": fold_rows,
        }
        all_configs.append(summary)
        score = (
            _finite_metric(summary["mean_ranking_regret_mean"]),
            _finite_metric(summary["mae_mean"]),
            _finite_metric(summary["rmse_mean"]),
            -_finite_metric(summary["top1_agreement_mean"], worst=-1.0),
        )
        if best is None or score < best["score"]:
            best = {"score": score, "summary": summary}
    return {"configs": all_configs, "selected": best["summary"]}


def subgroup_eval(meta: pd.DataFrame, y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    frame = meta.copy()
    frame["y_true"] = np.asarray(y_true, dtype=float)
    frame["y_pred"] = np.asarray(y_pred, dtype=float)
    frame["egfr_band"] = np.where(frame["eGFR"] < 60, "eGFR<60", "eGFR>=60")
    frame["voc_band"] = np.where(
        frame["VOC_history_prior_year"] >= HIGH_VOC_THRESHOLD,
        f"high_VOC(>={HIGH_VOC_THRESHOLD})",
        f"lower_VOC(<{HIGH_VOC_THRESHOLD})",
    )

    def row_mae(mask: pd.Series) -> dict:
        n = int(mask.sum())
        if n < MIN_SUBGROUP_ROWS:
            return {"n_rows": n, "mae": None, "insufficient_sample": True}
        return {
            "n_rows": n,
            "mae": round(float(mean_absolute_error(frame.loc[mask, "y_true"], frame.loc[mask, "y_pred"])), 6),
            "insufficient_sample": False,
        }

    def encounter_rank(mask: pd.Series) -> dict:
        sub = frame.loc[mask]
        rank = ranking_metrics(sub, sub["y_true"].to_numpy(), sub["y_pred"].to_numpy())
        if rank["n_encounters"] < MIN_SUBGROUP_ENCOUNTERS:
            return {**rank, "insufficient_sample": True}
        return {**rank, "insufficient_sample": False}

    encounter_first = frame.drop_duplicates("encounter_id")

    results = {
        "sex": {},
        "genotype_available": {},
        "opioid_tolerance": {},
        "egfr": {},
        "voc_utilization": {},
        "candidate_opioid_mae": {},
        "model_selected_opioid_ranking": {},
    }

    for value in sorted(encounter_first["sex"].dropna().astype(str).unique()):
        enc_ids = set(encounter_first.loc[encounter_first["sex"].astype(str) == value, "encounter_id"])
        mask = frame["encounter_id"].isin(enc_ids)
        results["sex"][value] = {"mae": row_mae(mask), "ranking": encounter_rank(mask)}

    for value in sorted(encounter_first["CYP2D6_genotype_available"].dropna().astype(str).unique()):
        enc_ids = set(
            encounter_first.loc[
                encounter_first["CYP2D6_genotype_available"].astype(str) == value, "encounter_id"
            ]
        )
        mask = frame["encounter_id"].isin(enc_ids)
        results["genotype_available"][str(value)] = {"mae": row_mae(mask), "ranking": encounter_rank(mask)}

    for value in sorted(encounter_first["opioid_tolerance"].dropna().astype(str).unique()):
        enc_ids = set(
            encounter_first.loc[encounter_first["opioid_tolerance"].astype(str) == value, "encounter_id"]
        )
        mask = frame["encounter_id"].isin(enc_ids)
        results["opioid_tolerance"][str(value)] = {"mae": row_mae(mask), "ranking": encounter_rank(mask)}

    for value in ["eGFR<60", "eGFR>=60"]:
        enc_ids = set(encounter_first.loc[encounter_first["egfr_band"] == value, "encounter_id"])
        mask = frame["encounter_id"].isin(enc_ids)
        results["egfr"][value] = {"mae": row_mae(mask), "ranking": encounter_rank(mask)}

    for value in sorted(encounter_first["voc_band"].unique()):
        enc_ids = set(encounter_first.loc[encounter_first["voc_band"] == value, "encounter_id"])
        mask = frame["encounter_id"].isin(enc_ids)
        results["voc_utilization"][str(value)] = {"mae": row_mae(mask), "ranking": encounter_rank(mask)}

    for opioid in sorted(frame["candidate_opioid"].dropna().astype(str).unique()):
        mask = frame["candidate_opioid"].astype(str) == opioid
        results["candidate_opioid_mae"][opioid] = row_mae(mask)

    selected_rows = []
    for _, group in frame.groupby("encounter_id", sort=False):
        selected_rows.append(group.loc[group["y_pred"].idxmax()])
    selected = pd.DataFrame(selected_rows)
    for opioid in sorted(frame["candidate_opioid"].dropna().astype(str).unique()):
        sub = selected[selected["candidate_opioid"].astype(str) == opioid]
        if len(sub) < MIN_SUBGROUP_ENCOUNTERS:
            results["model_selected_opioid_ranking"][opioid] = {
                "n_encounters": int(len(sub)),
                "mean_ranking_regret": None,
                "insufficient_sample": True,
            }
            continue
        regrets = []
        for encounter_id in sub["encounter_id"]:
            g = frame[frame["encounter_id"] == encounter_id]
            oracle = float(g["y_true"].max())
            chosen = float(g.loc[g["y_pred"].idxmax(), "y_true"])
            regrets.append(oracle - chosen)
        results["model_selected_opioid_ranking"][opioid] = {
            "n_encounters": int(len(sub)),
            "mean_ranking_regret": round(float(np.mean(regrets)), 6),
            "median_ranking_regret": round(float(np.median(regrets)), 6),
            "insufficient_sample": False,
        }

    return results


def write_markdown(report: dict) -> str:
    cv = report["cross_validation"]
    lines = [
        "# SCDAid response-model report",
        "",
        "**Evaluation label:** simulation-only / synthetic oracle evaluation.",
        "",
        "This is a proof-of-concept trained on synthetic potential outcomes. "
        "It is not clinical validation and must not be described as real-world predictive performance.",
        "",
        f"Generated (UTC): {report['generated_at_utc']}",
        "",
        "## Dataset counts",
        "",
        f"- Encounter rows: {report['dataset_counts']['encounter_rows']}",
        f"- Candidate rows (all): {report['dataset_counts']['candidate_rows_all']}",
        f"- Candidate rows after `training_eligible == Yes`: {report['dataset_counts']['candidate_rows_training_eligible']}",
        f"- Development rows: {report['dataset_counts']['development_rows']}",
        f"- Held-out test rows: {report['dataset_counts']['held_out_rows']}",
        f"- Development patients: {report['patient_separation']['development_patients']}",
        f"- Held-out patients: {report['patient_separation']['held_out_patients']}",
        f"- Patient overlap: {report['patient_separation']['overlapping_patients']}",
        "",
        "## Leakage audit",
        "",
        "Predictors are an explicit pretreatment allow-list. Post-treatment / target-derived fields were excluded.",
        "",
        f"- Used features: {', '.join(report['leakage_audit']['used_features'])}",
        f"- Missing requested features: {report['leakage_audit']['missing_requested_features'] or 'none'}",
        f"- Allergy used as predictor: {report['leakage_audit']['allergy_used_as_predictor']}",
        f"- Eligibility used as predictor: {report['leakage_audit']['eligibility_used_as_predictor']}",
        "",
        "Excluded leakage-related columns:",
        "",
    ]
    for col in report["leakage_audit"]["excluded_leakage_columns"]:
        lines.append(f"- `{col}`")
    lines.extend(
        [
            "",
            "## Treatment distributions",
            "",
            "### Training-eligible candidate opioid counts",
            "",
        ]
    )
    for opioid, count in report["treatment_distributions"]["training_eligible_candidate_counts"].items():
        lines.append(f"- {opioid}: {count}")
    lines.extend(["", "### Naturalistic `opioid_administered` (encounter dataset)", ""])
    for opioid, count in report["treatment_distributions"]["naturalistic_opioid_administered"].items():
        lines.append(f"- {opioid}: {count}")
    lines.extend(
        [
            "",
            "> Morphine dominates the naturalistic encounter distribution. Ranking was therefore trained on the more balanced candidate/potential-outcome table, not on observed administered treatment.",
            "",
            "## Cross-validation (Development, grouped by patient_id)",
            "",
            "Model selection used grouped Development CV only. Held-out test was not used for selection.",
            "",
            "| Model | MAE | RMSE | Top-1 agreement | Mean ranking regret | Median ranking regret | Selected params |",
            "|---|---:|---:|---:|---:|---:|---|",
        ]
    )
    for name, block in cv.items():
        selected = block["selected"]
        lines.append(
            "| {name} | {mae:.4f} | {rmse:.4f} | {top1:.4f} | {regret:.4f} | {med:.4f} | `{params}` |".format(
                name=name,
                mae=selected["mae_mean"],
                rmse=selected["rmse_mean"],
                top1=selected["top1_agreement_mean"],
                regret=selected["mean_ranking_regret_mean"],
                med=selected["median_ranking_regret_mean"],
                params=selected["params"] or {},
            )
        )
    sel = report["selected_model"]
    lines.extend(
        [
            "",
            "## Selected model",
            "",
            f"- Name: **{sel['name']}**",
            f"- Reason: {sel['reason']}",
            f"- Parameters: `{sel['params']}`",
            "",
            "## Held-out synthetic test performance",
            "",
            f"- MAE: {report['held_out']['mae']}",
            f"- RMSE: {report['held_out']['rmse']}",
            f"- Top-1 agreement: {report['held_out']['top1_agreement']}",
            f"- Mean ranking regret: {report['held_out']['mean_ranking_regret']}",
            f"- Median ranking regret: {report['held_out']['median_ranking_regret']}",
            f"- Test encounters: {report['held_out']['n_encounters']}",
            f"- Test rows: {report['held_out']['n_rows']}",
            "",
            "## Subgroup findings (held-out synthetic test)",
            "",
            "Do not interpret these as fairness or clinical equity results. "
            f"Subgroups with fewer than {MIN_SUBGROUP_ROWS} rows (MAE) or "
            f"{MIN_SUBGROUP_ENCOUNTERS} encounters (ranking) are marked insufficient.",
            "",
        ]
    )
    for family, values in report["subgroups"].items():
        lines.append(f"### {family}")
        lines.append("")
        lines.append(f"```json\n{json.dumps(values, indent=2)}\n```")
        lines.append("")
    lines.extend(
        [
            "## Limitations",
            "",
            "- Performance reflects recovery of an evidence-informed synthetic simulation and does not establish clinical predictive validity.",
            "- Training used synthetic potential outcomes, so the model may learn the simulator's structural assumptions rather than real clinical response.",
            "- Naturalistic prescribing in the encounter file is highly Morphine-imbalanced; candidate-level training reduces that treatment-selection bias but remains simulated.",
            "- Ranking metrics compare model choices with a synthetic oracle, not with clinician-judged best therapy.",
            "- Allergy/intolerance and eligibility are intentionally excluded from ML features because they belong to the rule-based safety engine.",
            "",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> None:
    np.random.seed(SEED)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    candidates, encounters = load_tables()
    merged = merge_training_frame(candidates, encounters)
    patient_sep = confirm_patient_separation(merged)
    audit = leakage_audit(merged, candidates, encounters)
    if audit["missing_requested_features"]:
        print("WARNING: requested features missing after merge:")
        for col in audit["missing_requested_features"]:
            print(f"  - {col}")

    numeric = [c for c in NUMERIC_FEATURES if c in merged.columns]
    categorical = [c for c in CATEGORICAL_FEATURES if c in merged.columns]

    development = merged[merged["split"] == "Development"].copy()
    held_out = merged[merged["split"] == "Held-out test"].copy()
    X_dev, y_dev, meta_dev = prepare_xy(development, numeric, categorical)
    X_test, y_test, meta_test = prepare_xy(held_out, numeric, categorical)
    groups = development["patient_id"].to_numpy()

    def lr_builder(params):
        return make_pipeline(
            numeric,
            categorical,
            LinearRegression(**params),
            scale_numeric=True,
            drop_first=True,
        )

    def rf_builder(params):
        estimator = RandomForestRegressor(random_state=SEED, n_jobs=-1, **params)
        return make_pipeline(numeric, categorical, estimator, scale_numeric=False)

    def xgb_builder(params):
        estimator = XGBRegressor(
            random_state=SEED,
            n_jobs=-1,
            objective="reg:squarederror",
            tree_method="hist",
            **params,
        )
        return make_pipeline(numeric, categorical, estimator, scale_numeric=False)

    print("Running grouped CV: Linear Regression")
    lr_cv = grouped_cv(lr_builder, {}, X_dev, y_dev, meta_dev, groups)
    print("Running grouped CV: Random Forest")
    rf_cv = grouped_cv(
        rf_builder,
        {
            "n_estimators": [150],
            "max_depth": [8, 16],
            "min_samples_leaf": [2, 5],
        },
        X_dev,
        y_dev,
        meta_dev,
        groups,
    )
    print("Running grouped CV: XGBoost")
    xgb_cv = grouped_cv(
        xgb_builder,
        {
            "n_estimators": [150],
            "max_depth": [3, 6],
            "learning_rate": [0.05, 0.1],
        },
        X_dev,
        y_dev,
        meta_dev,
        groups,
    )

    cv_blocks = {
        "linear_regression": lr_cv,
        "random_forest": rf_cv,
        "xgboost": xgb_cv,
    }

    def selection_tuple(block):
        s = block["selected"]
        return (
            s["mean_ranking_regret_mean"],
            s["mae_mean"],
            s["rmse_mean"],
            -s["top1_agreement_mean"],
        )

    selected_name = min(cv_blocks, key=lambda name: selection_tuple(cv_blocks[name]))
    selected_block = cv_blocks[selected_name]
    selected_params = selected_block["selected"]["params"]
    builders = {
        "linear_regression": lr_builder,
        "random_forest": rf_builder,
        "xgboost": xgb_builder,
    }
    final_model = builders[selected_name](selected_params)
    print(f"Fitting selected model on full Development set: {selected_name} {selected_params}")
    final_model.fit(X_dev, y_dev)
    test_pred = final_model.predict(X_test)
    held = {
        **regression_metrics(y_test, test_pred),
        **ranking_metrics(meta_test, y_test.to_numpy(), test_pred),
    }
    subgroups = subgroup_eval(meta_test, y_test.to_numpy(), test_pred)

    reason = (
        "Selected by lowest mean grouped-Development-CV ranking regret, with MAE then RMSE "
        "as tie-breakers. Held-out test performance was not used for model choice. "
        "Ranking regret is the primary selection metric because the intended task is "
        "ranking eligible candidate opioids, not isolated row-wise regression."
    )

    naturalistic = encounters["opioid_administered"].value_counts(dropna=False).to_dict()
    eligible_counts = merged["candidate_opioid"].value_counts().to_dict()
    eligible_dev = development["candidate_opioid"].value_counts().to_dict()

    schema = {
        "evaluation_label": "simulation-only / synthetic oracle evaluation",
        "target": TARGET,
        "target_interpretation": "baseline pain minus simulated pain at 60 minutes; higher is more improvement",
        "numeric_features": numeric,
        "categorical_features": categorical,
        "feature_types": {
            **{c: "numeric" for c in numeric},
            **{c: "categorical" for c in categorical},
        },
        "id_fields_not_used_as_predictors": ID_FIELDS,
        "excluded_for_leakage": audit["excluded_leakage_columns"],
        "preprocessing": {
            "numeric": "median imputation; StandardScaler for linear regression only",
            "categorical": 'constant "Unknown" imputation; OneHotEncoder(handle_unknown="ignore")',
            "fit_on": "Development split only",
        },
        "selected_model": selected_name,
        "selected_params": selected_params,
        "random_seed": SEED,
    }

    report = {
        "evaluation_label": "simulation-only / synthetic oracle evaluation",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_counts": {
            "encounter_rows": int(len(encounters)),
            "candidate_rows_all": int(len(candidates)),
            "candidate_rows_training_eligible": int(len(merged)),
            "development_rows": int(len(development)),
            "held_out_rows": int(len(held_out)),
            "development_encounters": int(development["encounter_id"].nunique()),
            "held_out_encounters": int(held_out["encounter_id"].nunique()),
        },
        "patient_separation": patient_sep,
        "leakage_audit": audit,
        "treatment_distributions": {
            "training_eligible_candidate_counts": {k: int(v) for k, v in eligible_counts.items()},
            "development_candidate_counts": {k: int(v) for k, v in eligible_dev.items()},
            "naturalistic_opioid_administered": {str(k): int(v) for k, v in naturalistic.items()},
            "candidate_balance_note": "After filtering training_eligible==Yes, candidate opioid counts are approximately balanced across the six opioids.",
            "naturalistic_imbalance_note": "The encounter dataset is highly Morphine-dominated and is not the training table.",
        },
        "features_used": numeric + categorical,
        "cross_validation": cv_blocks,
        "selected_model": {
            "name": selected_name,
            "params": selected_params,
            "reason": reason,
            "development_cv": selected_block["selected"],
        },
        "held_out": held,
        "subgroups": subgroups,
        "warnings": [
            "Training on synthetic potential outcomes may make the model learn the simulator's structural assumptions.",
            "Performance reflects recovery of an evidence-informed synthetic simulation and does not establish clinical predictive validity.",
        ],
        "limitations": [
            "Performance reflects recovery of an evidence-informed synthetic simulation and does not establish clinical predictive validity.",
            "This is simulation-only / synthetic oracle evaluation, not clinical validation or real-world predictive performance.",
        ],
        "artifact_paths": {
            "model": str(MODEL_PATH.relative_to(ML_DIR.parent)),
            "feature_schema": str(SCHEMA_PATH.relative_to(ML_DIR.parent)),
            "report_json": str(REPORT_JSON_PATH.relative_to(ML_DIR.parent)),
            "report_md": str(REPORT_MD_PATH.relative_to(ML_DIR.parent)),
        },
    }

    joblib.dump(final_model, MODEL_PATH)
    SCHEMA_PATH.write_text(json.dumps(schema, indent=2) + "\n")
    REPORT_JSON_PATH.write_text(json.dumps(report, indent=2) + "\n")
    REPORT_MD_PATH.write_text(write_markdown(report))

    print("")
    print("Training complete (synthetic oracle evaluation only).")
    print(f"Selected model: {selected_name} {selected_params}")
    print(f"Held-out MAE={held['mae']} RMSE={held['rmse']} top1={held['top1_agreement']} regret={held['mean_ranking_regret']}")
    print(f"Saved {MODEL_PATH}")
    print(f"Saved {SCHEMA_PATH}")
    print(f"Saved {REPORT_JSON_PATH}")
    print(f"Saved {REPORT_MD_PATH}")


if __name__ == "__main__":
    main()
