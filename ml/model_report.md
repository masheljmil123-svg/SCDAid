# SCDAid response-model report

**Evaluation label:** simulation-only / synthetic oracle evaluation.

This is a proof-of-concept trained on synthetic potential outcomes. It is not clinical validation and must not be described as real-world predictive performance.

Generated (UTC): 2026-09-11T11:37:54.825271+00:00

## Dataset counts

- Encounter rows: 2000
- Candidate rows (all): 12000
- Candidate rows after `training_eligible == Yes`: 11703
- Development rows: 9377
- Held-out test rows: 2326
- Development patients: 400
- Held-out patients: 100
- Patient overlap: 0

## Leakage audit

Predictors are an explicit pretreatment allow-list. Post-treatment / target-derived fields were excluded.

- Used features: age, weight_kg, BMI, baseline_pain, VOC_history_prior_year, eGFR, serum_creatinine_mg_dL, heart_rate_bpm, SBP_mmHg, DBP_mmHg, resp_rate_min, SpO2_pct, temperature_C, baseline_opioid_daily_MME, baseline_opioid_continuous_days, genotype_activity_score, sex, SCD_genotype, opioid_tolerance, CNS_depressant_present, CYP2D6_genotype_available, genotype_predicted_phenotype, functional_phenotype, CYP2D6_inhibitor_strength, candidate_opioid, previous_response_this_opioid
- Missing requested features: none
- Allergy used as predictor: False
- Eligibility used as predictor: False

Excluded leakage-related columns:

- `ED_LOS_hours`
- `admission_probability`
- `clinically_meaningful_60_ge_1_3`
- `clinically_meaningful_disposition_ge_1_4`
- `clinically_meaningful_disposition_ge_30pct`
- `delta_pain_60`
- `delta_pain_disposition`
- `disposition`
- `eligibility_status`
- `observed_opioid_eligibility`
- `observed_rule_reason`
- `pain_120min`
- `pain_180min`
- `pain_30min`
- `pain_60min`
- `pain_90min`
- `pain_at_disposition`
- `percent_pain_reduction_60`
- `percent_pain_reduction_disposition`
- `potential_clinically_meaningful_60_ge_1_3`
- `potential_clinically_meaningful_disposition_ge_1_4`
- `potential_clinically_meaningful_disposition_ge_30pct`
- `potential_delta_pain_disposition`
- `potential_pain_120`
- `potential_pain_180`
- `potential_pain_30`
- `potential_pain_60`
- `potential_pain_90`
- `potential_pain_disposition`
- `potential_percent_reduction_60`
- `potential_percent_reduction_disposition`
- `rescue_repeat_needed`
- `rule_reasons`
- `serious_opioid_AE_naturalistic`
- `switch_needed`
- `synthetic_rescue_probability`
- `synthetic_switch_probability`
- `training_eligible`

## Treatment distributions

### Training-eligible candidate opioid counts

- Fentanyl: 1995
- Oxycodone: 1992
- Morphine: 1991
- Hydromorphone: 1985
- Codeine: 1875
- Tramadol: 1865

### Naturalistic `opioid_administered` (encounter dataset)

- Morphine: 1693
- Hydromorphone: 197
- Fentanyl: 97
- Oxycodone: 7
- Tramadol: 5
- Codeine: 1

> Morphine dominates the naturalistic encounter distribution. Ranking was therefore trained on the more balanced candidate/potential-outcome table, not on observed administered treatment.

## Cross-validation (Development, grouped by patient_id)

Model selection used grouped Development CV only. Held-out test was not used for selection.

| Model | MAE | RMSE | Top-1 agreement | Mean ranking regret | Median ranking regret | Selected params |
|---|---:|---:|---:|---:|---:|---|
| linear_regression | 0.3281 | 0.4058 | 0.3156 | 0.3984 | 0.3000 | `{}` |
| random_forest | 0.3292 | 0.4073 | 0.3018 | 0.4113 | 0.3200 | `{'max_depth': 8, 'min_samples_leaf': 2, 'n_estimators': 150}` |
| xgboost | 0.3287 | 0.4071 | 0.3093 | 0.4077 | 0.3000 | `{'learning_rate': 0.05, 'max_depth': 3, 'n_estimators': 150}` |

## Selected model

- Name: **linear_regression**
- Reason: Selected by lowest mean grouped-Development-CV ranking regret, with MAE then RMSE as tie-breakers. Held-out test performance was not used for model choice. Ranking regret is the primary selection metric because the intended task is ranking eligible candidate opioids, not isolated row-wise regression.
- Parameters: `{}`

## Held-out synthetic test performance

- MAE: 0.328784
- RMSE: 0.404984
- Top-1 agreement: 0.329949
- Mean ranking regret: 0.396447
- Median ranking regret: 0.3
- Test encounters: 394
- Test rows: 2326

## Subgroup findings (held-out synthetic test)

Do not interpret these as fairness or clinical equity results. Subgroups with fewer than 50 rows (MAE) or 30 encounters (ranking) are marked insufficient.

### sex

```json
{
  "Female": {
    "mae": {
      "n_rows": 1228,
      "mae": 0.330599,
      "insufficient_sample": false
    },
    "ranking": {
      "top1_agreement": 0.328502,
      "mean_ranking_regret": 0.386473,
      "median_ranking_regret": 0.3,
      "n_encounters": 207,
      "mean_eligible_candidates": 5.932,
      "insufficient_sample": false
    }
  },
  "Male": {
    "mae": {
      "n_rows": 1098,
      "mae": 0.326753,
      "insufficient_sample": false
    },
    "ranking": {
      "top1_agreement": 0.331551,
      "mean_ranking_regret": 0.407487,
      "median_ranking_regret": 0.2,
      "n_encounters": 187,
      "mean_eligible_candidates": 5.872,
      "insufficient_sample": false
    }
  }
}
```

### genotype_available

```json
{
  "No": {
    "mae": {
      "n_rows": 1626,
      "mae": 0.331381,
      "insufficient_sample": false
    },
    "ranking": {
      "top1_agreement": 0.345455,
      "mean_ranking_regret": 0.385455,
      "median_ranking_regret": 0.3,
      "n_encounters": 275,
      "mean_eligible_candidates": 5.913,
      "insufficient_sample": false
    }
  },
  "Yes": {
    "mae": {
      "n_rows": 700,
      "mae": 0.322751,
      "insufficient_sample": false
    },
    "ranking": {
      "top1_agreement": 0.294118,
      "mean_ranking_regret": 0.421849,
      "median_ranking_regret": 0.3,
      "n_encounters": 119,
      "mean_eligible_candidates": 5.882,
      "insufficient_sample": false
    }
  }
}
```

### opioid_tolerance

```json
{
  "No": {
    "mae": {
      "n_rows": 2192,
      "mae": 0.328321,
      "insufficient_sample": false
    },
    "ranking": {
      "top1_agreement": 0.336927,
      "mean_ranking_regret": 0.386253,
      "median_ranking_regret": 0.2,
      "n_encounters": 371,
      "mean_eligible_candidates": 5.908,
      "insufficient_sample": false
    }
  },
  "Yes": {
    "mae": {
      "n_rows": 134,
      "mae": 0.336353,
      "insufficient_sample": false
    },
    "ranking": {
      "top1_agreement": 0.217391,
      "mean_ranking_regret": 0.56087,
      "median_ranking_regret": 0.8,
      "n_encounters": 23,
      "mean_eligible_candidates": 5.826,
      "insufficient_sample": true
    }
  }
}
```

### egfr

```json
{
  "eGFR<60": {
    "mae": {
      "n_rows": 36,
      "mae": null,
      "insufficient_sample": true
    },
    "ranking": {
      "top1_agreement": 0.5,
      "mean_ranking_regret": 0.4,
      "median_ranking_regret": 0.3,
      "n_encounters": 6,
      "mean_eligible_candidates": 6.0,
      "insufficient_sample": true
    }
  },
  "eGFR>=60": {
    "mae": {
      "n_rows": 2290,
      "mae": 0.328349,
      "insufficient_sample": false
    },
    "ranking": {
      "top1_agreement": 0.32732,
      "mean_ranking_regret": 0.396392,
      "median_ranking_regret": 0.3,
      "n_encounters": 388,
      "mean_eligible_candidates": 5.902,
      "insufficient_sample": false
    }
  }
}
```

### voc_utilization

```json
{
  "high_VOC(>=6)": {
    "mae": {
      "n_rows": 646,
      "mae": 0.334115,
      "insufficient_sample": false
    },
    "ranking": {
      "top1_agreement": 0.290909,
      "mean_ranking_regret": 0.432727,
      "median_ranking_regret": 0.4,
      "n_encounters": 110,
      "mean_eligible_candidates": 5.873,
      "insufficient_sample": false
    }
  },
  "lower_VOC(<6)": {
    "mae": {
      "n_rows": 1680,
      "mae": 0.326734,
      "insufficient_sample": false
    },
    "ranking": {
      "top1_agreement": 0.34507,
      "mean_ranking_regret": 0.382394,
      "median_ranking_regret": 0.2,
      "n_encounters": 284,
      "mean_eligible_candidates": 5.915,
      "insufficient_sample": false
    }
  }
}
```

### candidate_opioid_mae

```json
{
  "Codeine": {
    "n_rows": 386,
    "mae": 0.282575,
    "insufficient_sample": false
  },
  "Fentanyl": {
    "n_rows": 389,
    "mae": 0.368823,
    "insufficient_sample": false
  },
  "Hydromorphone": {
    "n_rows": 394,
    "mae": 0.366593,
    "insufficient_sample": false
  },
  "Morphine": {
    "n_rows": 388,
    "mae": 0.373829,
    "insufficient_sample": false
  },
  "Oxycodone": {
    "n_rows": 390,
    "mae": 0.291914,
    "insufficient_sample": false
  },
  "Tramadol": {
    "n_rows": 379,
    "mae": 0.287269,
    "insufficient_sample": false
  }
}
```

### model_selected_opioid_ranking

```json
{
  "Codeine": {
    "n_encounters": 0,
    "mean_ranking_regret": null,
    "insufficient_sample": true
  },
  "Fentanyl": {
    "n_encounters": 44,
    "mean_ranking_regret": 0.293182,
    "median_ranking_regret": 0.2,
    "insufficient_sample": false
  },
  "Hydromorphone": {
    "n_encounters": 88,
    "mean_ranking_regret": 0.4125,
    "median_ranking_regret": 0.25,
    "insufficient_sample": false
  },
  "Morphine": {
    "n_encounters": 262,
    "mean_ranking_regret": 0.408397,
    "median_ranking_regret": 0.3,
    "insufficient_sample": false
  },
  "Oxycodone": {
    "n_encounters": 0,
    "mean_ranking_regret": null,
    "insufficient_sample": true
  },
  "Tramadol": {
    "n_encounters": 0,
    "mean_ranking_regret": null,
    "insufficient_sample": true
  }
}
```

## Limitations

- Performance reflects recovery of an evidence-informed synthetic simulation and does not establish clinical predictive validity.
- Training used synthetic potential outcomes, so the model may learn the simulator's structural assumptions rather than real clinical response.
- Naturalistic prescribing in the encounter file is highly Morphine-imbalanced; candidate-level training reduces that treatment-selection bias but remains simulated.
- Ranking metrics compare model choices with a synthetic oracle, not with clinician-judged best therapy.
- Allergy/intolerance and eligibility are intentionally excluded from ML features because they belong to the rule-based safety engine.

