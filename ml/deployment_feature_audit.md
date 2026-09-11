# SCDAid deployment feature parity audit

**Purpose:** Map every trained model feature to a runtime website source before an API is built.

**Evaluation reminder:** The model is a synthetic proof-of-concept. This audit is about feature plumbing, not clinical validity.

**Inspected:**

- `ml/models/feature_schema.json`
- `src/data/formState.js`
- `src/data/clinicalLists.js`
- `src/components/PatientAssessment.jsx`
- `src/logic/cyp2d6.js`
- `src/logic/phenoconversion.js`
- `src/logic/clinicalSafety.js`

**Not used for runtime PGx/CNS derivation:** `src/data/derivedFlags.js` (frontend mock).

**Rules used in this audit:**

- Do not invent runtime values for unavailable features.
- Do not silently substitute clinical defaults (normal heart rate, normal creatinine, MME = 0 from drug name, invented height).
- Empty / not entered → `null` / `NaN`. The saved pipeline imputes numeric medians and categorical `"Unknown"`.
- BMI is used only if entered. There is no height field, so BMI cannot be calculated.
- Vital signs are taken only from actually entered `form.vitalSigns` rows.
- Daily MME and continuous duration are not estimated from opioid name/dose/route.

---

## Summary counts

| Classification | Count | Features |
|---|---:|---|
| Direct UI input | 10 | `age`, `weight_kg`, `BMI`, `baseline_pain`, `eGFR`, `serum_creatinine_mg_dL`, `sex`, `SCD_genotype`, `opioid_tolerance`, `CYP2D6_genotype_available` |
| Derived from UI | 7 | `heart_rate_bpm`, `SBP_mmHg`, `DBP_mmHg`, `resp_rate_min`, `SpO2_pct`, `temperature_C`, `previous_response_this_opioid` |
| Derived from verified PGx logic | 4 | `genotype_activity_score`, `genotype_predicted_phenotype`, `functional_phenotype`, `CYP2D6_inhibitor_strength` |
| Derived from verified safety logic | 2 | `CNS_depressant_present`, `candidate_opioid` |
| Currently unavailable | 3 | `VOC_history_prior_year`, `baseline_opioid_daily_MME`, `baseline_opioid_continuous_days` |
| **Total** | **26** | |

**Exact unavailable features:**

1. `VOC_history_prior_year`
2. `baseline_opioid_daily_MME`
3. `baseline_opioid_continuous_days`

The existing Linear Regression pipeline can still produce a prediction if those fields are passed as `null`/`NaN`. That is statistically compatible with training-time imputation. It is **not** equivalent to having observed those pretreatment variables.

---

## Category value comparison (training vs website)

| Feature | Training labels | Website runtime labels | Normalization required before API prediction |
|---|---|---|---|
| `sex` | `Female`, `Male` | `Male`, `Female` (`SEX_OPTIONS`) | None. Exact match. Empty select → `null`. |
| `SCD_genotype` | `HbSS`, `HbSβ-thalassemia`, `Other confirmed SCD` | Suggested: `HbSS`, `HbSC`, `Other`. `SearchSelect` also allows free text. | **Yes.** See mapping below. `HbSC` was not a training class. |
| `opioid_tolerance` | `Yes`, `No` | `Yes`, `No` | None. Empty → `null`. |
| `CNS_depressant_present` | `Yes`, `No` | Derived Yes/No from `clinicalSafety.js` explicit list | None after derivation. |
| `CYP2D6_genotype_available` | `Yes`, `No` | `Yes`, `No` (`form.genotypeAvailable`) | None. |
| `genotype_predicted_phenotype` | `Normal`, `Intermediate`, `Ultrarapid`, `Poor`, plus NaN | `cyp2d6.js`: `Normal metabolizer`, `Intermediate metabolizer`, `Ultrarapid metabolizer`, `Poor metabolizer`, or `null` | **Yes.** Strip/map ` metabolizer` suffix. |
| `functional_phenotype` | Same short labels as predicted phenotype, plus NaN | `phenoconversion.js` uses the same long CPIC phrases as `cyp2d6.js` | **Yes.** Same phenotype mapping. |
| `CYP2D6_inhibitor_strength` | `Strong`, `Moderate`, NaN (no `None`) | `phenoconversion.js`: `Strong`, `Moderate`, `None` | **Yes.** Map `None` → `null` (not the string `"None"`). |
| `candidate_opioid` | `Morphine`, `Hydromorphone`, `Fentanyl`, `Oxycodone`, `Codeine`, `Tramadol` | `clinicalSafety.js` `CANDIDATE_OPIOIDS`: same six spellings | None. |
| `previous_response_this_opioid` | `Unknown`, `Mixed/partial`, `Favorable`, `Inadequate`, `Adverse/intolerant` | `Favorable`, `Inadequate`, `Adverse`, `Unknown` | **Yes.** `Adverse` → `Adverse/intolerant`. No UI value for `Mixed/partial`. Missing row → `Unknown`. |

### Required phenotype mapping

| Runtime (`cyp2d6.js` / `phenoconversion.js`) | Training / model |
|---|---|
| `Poor metabolizer` | `Poor` |
| `Intermediate metabolizer` | `Intermediate` |
| `Normal metabolizer` | `Normal` |
| `Ultrarapid metabolizer` | `Ultrarapid` |
| `null` | `null` |

### Required SCD genotype mapping

| Runtime | Training / model | Notes |
|---|---|---|
| `HbSS` | `HbSS` | Exact. |
| `HbSC` | no training class | Pass through as `HbSC` **or** `null`. `OneHotEncoder(handle_unknown="ignore")` will ignore it. Do not map to `HbSS`. |
| `Other` | `Other confirmed SCD` | Documented synonym mapping. |
| `HbSβ-thalassemia` (only if typed as free text) | `HbSβ-thalassemia` | Exact if entered. Not in the UI suggestion list. |

### Required previous-response mapping

| Runtime (`PREVIOUS_RESPONSE_OPTIONS`) | Training / model |
|---|---|
| `Favorable` | `Favorable` |
| `Inadequate` | `Inadequate` |
| `Adverse` | `Adverse/intolerant` |
| `Unknown` | `Unknown` |
| no row for that candidate | `Unknown` (explicit audit rule) |
| `Mixed/partial` | not collectable in current UI | Do not invent this class. |

---

## Feature-by-feature audit

Readiness: **Ready** = can be sent with only type coercion; **Ready with mapping** = available after documented label/unit mapping; **Partial** = source exists but often missing or weakly structured; **Unavailable** = not captured in a usable way.

### Numerical features

| Model feature | Classification | Runtime source | Runtime field | Transformation | Missing-value behavior | Category / unit notes | Readiness |
|---|---|---|---|---|---|---|---|
| `age` | Direct UI input | Patient Assessment | `form.age` | `Number(form.age)` | Empty/invalid → `null` | Years; required in current form validation | Ready |
| `weight_kg` | Direct UI input | Patient Assessment | `form.weight` | `Number(form.weight)` | Empty/invalid → `null` | Field is `weight`, unit kg. Rename only. | Ready |
| `BMI` | Direct UI input | Patient Assessment | `form.bmi` | `Number(form.bmi)` if entered | If blank, **leave `null`**. There is **no height field**. Do not invent height or calculate BMI from weight alone. | Optional UI field | Ready (optional) |
| `baseline_pain` | Direct UI input | Patient Assessment | `form.baselinePainScore` | Numeric 0–10 | Required in UI; if absent → `null` | Training used continuous baseline pain; UI is integer slider | Ready |
| `VOC_history_prior_year` | Currently unavailable | Patient Assessment | `form.vocHistory` | **Do not parse free text into a VOC count.** | Always `null` for the API unless a future numeric field is added | UI is a free-text textarea (“configurable summary”), not an integer prior-year count. Training used `int`. | Unavailable |
| `eGFR` | Direct UI input | Patient Assessment | `form.egfr` | `Number(form.egfr)` | Empty/invalid → `null` | Required for safety engine; same value can be reused for ML | Ready |
| `serum_creatinine_mg_dL` | Direct UI input | Patient Assessment | `form.serumCreatinine` + `form.creatinineUnit` | If unit is `mg/dL`, use the number. If unit is `µmol/L`, convert with `µmol/L / 88.4`. This is unit conversion of an entered lab, not a default. | If creatinine is blank → `null`. Do **not** assume a normal creatinine. | Conditional UI field | Ready with mapping |
| `heart_rate_bpm` | Derived from UI | `form.vitalSigns[]` `{id,name,value,unit}` | First row whose name matches `heart rate` (case-insensitive) and whose unit is `bpm` or blank-with-numeric-value only if unit is `bpm` | Use entered numeric `value`. No assumed rest HR. | If no matching entered row → `null` | Suggestion label is `Heart rate`; unit suggestion `bpm` | Partial (only if entered) |
| `SBP_mmHg` | Derived from UI | `form.vitalSigns[]` | Blood-pressure row | If name matches `blood pressure` and value is `sys/dia` (e.g. `120/80`), use systolic. If a row is explicitly named SBP, use that number. | No BP row / unparseable value → `null`. Do not invent SBP. | UI stores one “Blood pressure” field, not separate SBP/DBP fields | Partial (only if entered) |
| `DBP_mmHg` | Derived from UI | `form.vitalSigns[]` | Blood-pressure row | Same as SBP, using diastolic from `sys/dia`. | If only one number is entered, **do not** copy it to both SBP and DBP; set the missing side `null`. | Same as SBP | Partial (only if entered) |
| `resp_rate_min` | Derived from UI | `form.vitalSigns[]` | Name matches `respiratory rate`; unit `breaths/min` | Numeric `value` | No matching row → `null` | Suggestion: `Respiratory rate` | Partial (only if entered) |
| `SpO2_pct` | Derived from UI | `form.vitalSigns[]` | Name matches `spo2` / `spo₂` / `sp o2`; unit `%` | Numeric `value` | No matching row → `null` | UI suggestion is `SpO₂` (unicode subscript) | Partial (only if entered) |
| `temperature_C` | Derived from UI | `form.vitalSigns[]` | Name matches `temperature` | If unit is `°C`, use value. If unit is `°F`, convert `(F - 32) * 5/9`. If unit is missing, **do not assume Celsius** → `null`. | No matching row → `null` | Do not assume a normal temperature | Partial (only if entered) |
| `baseline_opioid_daily_MME` | Currently unavailable | Patient Assessment | `form.noBaselineOpioid`, `form.baselineOpioids[]` `{drug,dose,route}` | **Do not estimate MME from opioid name, free-text dose, or route.** Optional exception only: if `noBaselineOpioid === true`, the clinician explicitly recorded no baseline opioid therapy, and `0` may be passed. If baseline opioid rows exist, pass `null`. | Otherwise `null` | Dose is unstructured text. No MME field exists. | Unavailable |
| `baseline_opioid_continuous_days` | Currently unavailable | Patient Assessment | same as above | **No duration field exists.** Do not infer days from drug name. Optional `0` only when `noBaselineOpioid === true`. If opioid rows exist, pass `null`. | Otherwise `null` | Training used a numeric duration | Unavailable |
| `genotype_activity_score` | Derived from verified PGx logic | `calculateCYP2D6ActivityScore` in `cyp2d6.js` | `activityScore` | Call with `allele1`, `allele2`, `hasCnv`, `copyNumber`, `duplicatedAllele` only when `form.genotypeAvailable === 'Yes'` | Genotype No, unknown allele, or CNV error → `null` (do not default unknown alleles to 1) | Matches training’s numeric activity score | Ready with mapping |

### Categorical features

| Model feature | Classification | Runtime source | Runtime field | Transformation | Missing-value behavior | Category normalization | Readiness |
|---|---|---|---|---|---|---|---|
| `sex` | Direct UI input | Patient Assessment | `form.sex` | None | `""` → `null` | `Male`/`Female` match training | Ready |
| `SCD_genotype` | Direct UI input | Patient Assessment | `form.scdGenotype` | Apply SCD mapping table | Blank → `null` | **Mismatch:** UI `HbSC` / `Other` vs training `HbSβ-thalassemia` / `Other confirmed SCD` | Ready with mapping |
| `opioid_tolerance` | Direct UI input | Patient Assessment | `form.opioidTolerance` | None | Unselected → `null` | `Yes`/`No` match training | Ready |
| `CNS_depressant_present` | Derived from verified safety logic | `clinicalSafety.js` `CNS_DEPRESSANT_MEDICATIONS` + `form.medications` | Exact trim+lowercase match against `lorazepam`, `diazepam`, `clonazepam`, `gabapentin`, `pregabalin`, `zolpidem` | `Yes` if ≥1 match, `No` if medication list is non-empty and no match | If `medications` is empty → `null` (do not assume No). **Do not use `derivedFlags.js`.** | Training uses `Yes`/`No` | Ready with mapping |
| `CYP2D6_genotype_available` | Direct UI input | Patient Assessment | `form.genotypeAvailable` | None | Unselected → `null` | `Yes`/`No` match training | Ready |
| `genotype_predicted_phenotype` | Derived from verified PGx logic | `cyp2d6.js` `predictedPhenotype` | `calculateCYP2D6ActivityScore(...).predictedPhenotype` | Apply phenotype mapping (long → short) | Genotype No / score error → `null`. Do not invent a phenotype. | **Mismatch:** runtime `Normal metabolizer` vs training `Normal` | Ready with mapping |
| `functional_phenotype` | Derived from verified PGx logic | `phenoconversion.js` `functionalPhenotype` | `applyPhenoconversion({ genotypeAvailable, activityScore, predictedPhenotype, medications }).functionalPhenotype` | Same short-label mapping. When genotype is available and conversion succeeds, pass functional phenotype even if it equals predicted (training stored it whenever genotype existed). Do **not** copy the UI assembler rule that hides functional phenotype unless an inhibitor is present. | Genotype No or conversion error → `null` | Same phenotype mismatch as above | Ready with mapping |
| `CYP2D6_inhibitor_strength` | Derived from verified PGx logic | `phenoconversion.js` `getCYP2D6Inhibition` / `inhibitorExposure` | Explicit list: strong `fluoxetine`, `paroxetine`, `bupropion`; moderate `duloxetine`, `mirabegron` | `Strong`/`Moderate` unchanged. **`None` → `null`** so the imputer emits training-like `Unknown`. Do not send the string `None`. | No matching inhibitor → `null` | Training never used `None`; it used NaN | Ready with mapping |
| `candidate_opioid` | Derived from verified safety logic | `clinicalSafety.js` `CANDIDATE_OPIOIDS` | Ranking loop supplies one of the six names per row | None | Must always be one of the six; do not score Avoid-excluded rows if the product rule is “ML ranks eligible candidates only” | Spellings match training exactly | Ready |
| `previous_response_this_opioid` | Derived from UI | Patient Assessment | `form.previousResponses[]` `{opioid, response}` | For the candidate being scored, find the row whose `opioid` equals that candidate (case-insensitive exact name). Use that row’s `response` after label mapping. Do not use the other five previous-response columns. | If no row for that opioid → **`Unknown`** (audit-specified default, not a clinical guess) | `Adverse` → `Adverse/intolerant`. UI cannot produce `Mixed/partial`. | Ready with mapping |

---

## Vital-sign extraction notes

`form.vitalSigns` is a dynamic list of `{ id, name, value, unit }`. It is empty by default. Names and units are suggestions, not required enums.

Suggested names: `Heart rate`, `Blood pressure`, `Respiratory rate`, `SpO₂`, `Temperature`.  
Suggested units: `bpm`, `mmHg`, `breaths/min`, `%`, `°C`, `°F`.

Match **only actually entered rows**. If a clinician never adds a heart-rate row, `heart_rate_bpm` is `null`. Do not fill a normal adult HR.

Blood pressure is a single combined field in the UI, while the model expects `SBP_mmHg` and `DBP_mmHg`. Parsing `120/80` is allowed because both numbers were entered. Inventing the missing number is not.

---

## Baseline opioid therapy notes

Current UI structure:

- `form.noBaselineOpioid` checkbox
- else `form.baselineOpioids[]` with `{ id, drug, dose, route }`

There is **no** daily MME field and **no** continuous-days field. Free-text `dose` plus opioid name is not an MME.

| Situation | `baseline_opioid_daily_MME` | `baseline_opioid_continuous_days` |
|---|---|---|
| `noBaselineOpioid === true` | Optional documented `0` (explicit “no baseline opioid therapy”) | Optional documented `0` |
| One or more `{drug, dose, route}` rows | `null` — do not calculate MME | `null` — duration not captured |
| Neither (invalid form) | `null` | `null` |

---

## PGx runtime wiring (verified modules only)

When `form.genotypeAvailable === 'Yes'`:

1. `calculateCYP2D6ActivityScore({ allele1, allele2, hasCnv, copyNumber, duplicatedAllele })`
2. `applyPhenoconversion({ genotypeAvailable: true, activityScore, predictedPhenotype, medications: form.medications })`

When `form.genotypeAvailable === 'No'`:

1. Do not invent `activityScore` or a phenotype.
2. Still call `applyPhenoconversion` / `getCYP2D6Inhibition` for inhibitor strength.
3. Send `genotype_activity_score = null`, `genotype_predicted_phenotype = null`, `functional_phenotype = null`, `CYP2D6_inhibitor_strength = Strong|Moderate|null`.

`derivedFlags.js` inhibitor lists (`quinidine`, `terbinafine`, `amiodarone`, plus substring matching) must **not** be used for ML features.

---

## CNS runtime wiring (verified safety list only)

Use `clinicalSafety.js`:

```
lorazepam, diazepam, clonazepam, gabapentin, pregabalin, zolpidem
```

Exact trim + lowercase match. No class inference.

Do **not** use `derivedFlags.js` CNS list (`alprazolam`, `midazolam`, `diphenhydramine`, `promethazine`, plus `includes()` matching).

---

## Can the saved pipeline still predict?

**Yes, with missingness handled by training-time imputers.**

Saved preprocessing (`feature_schema.json`):

- Numeric: median imputation; StandardScaler (linear regression)
- Categorical: constant `"Unknown"` imputation; `OneHotEncoder(handle_unknown="ignore")`
- Fit on Development split only

Therefore:

- Unavailable numerics (`VOC_history_prior_year`, MME, duration, unentered vitals, blank BMI/creatinine) can be `NaN`.
- Unmapped categoricals (`HbSC`, string `"None"`, long phenotype labels) should still be **normalized first**. Relying on `handle_unknown="ignore"` is a silent fallback, not a substitute for the phenotype / inhibitor / previous-response mappings above.
- The model can emit a number. That number remains **synthetic-oracle recovery**, and features imputed as “typical training median/Unknown” will not carry that patient’s true value.

---

## Category mismatches that must be normalized before API prediction

These are required, not optional:

1. Phenotype long labels → short training labels (`Normal metabolizer` → `Normal`, etc.).
2. Inhibitor `None` → `null` (training used NaN, imputed as `Unknown`).
3. Previous response `Adverse` → `Adverse/intolerant`.
4. Previous response missing for a candidate → `Unknown`.
5. SCD `Other` → `Other confirmed SCD` (documented synonym). Do not map `HbSC` onto another genotype.
6. Creatinine `µmol/L` → `mg/dL` if a value was entered.
7. Temperature `°F` → `°C` only when that unit was entered.
8. Candidate opioid names: already aligned; keep exact spelling from `CANDIDATE_OPIOIDS`.

---

## Files modified in this step

- Created: `ml/deployment_feature_audit.md`

**Confirm:** no React UI files, no `mockRecommendation.js`, no `clinicalSafety.js`, no `cyp2d6.js`, no `phenoconversion.js`, and no trained model / schema files were modified. No retraining was performed.
