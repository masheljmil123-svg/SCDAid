# SCDAid

Hybrid evidence-based and machine-learning clinical decision-support research prototype for opioid strategy ranking in adult sickle-cell vaso-occlusive crisis.

The included datasets are synthetic simulation data. No real patient-level clinical data are included in this repository.

The current ML model is a proof-of-concept trained on evidence-informed synthetic simulation data and has not established clinical predictive validity.

## Overview

SCDAid is a research prototype that combines:

- verified rule-based clinical modules (CYP2D6 activity scoring, phenoconversion, and clinical safety)
- a proof-of-concept machine-learning ranker trained on synthetic treatment-response outcomes
- a React clinician workspace for adult vaso-occlusive crisis (VOC) assessment

It is a **simulation-based proof-of-concept**, not a medical device and not a substitute for clinical judgment.

## Architecture

| Layer | Stack | Deployment |
| --- | --- | --- |
| Frontend | React + Vite | GitHub Pages (`https://<github-username>.github.io/SCDAid/`) |
| Backend | FastAPI | Deployed separately (for example Render) |
| Database | SQLAlchemy via `DATABASE_URL` | SQLite locally; PostgreSQL in production |
| Authentication | Google OAuth 2.0 / OpenID Connect (Authlib) | HttpOnly session cookie; public signup |

The frontend talks to the API through `VITE_API_BASE_URL` in production. Local development may fall back to a backend on port 8000.

Rule engines remain in JavaScript. The backend does **not** reimplement CYP2D6, phenoconversion, or clinical-safety logic. It loads the trained model for treatment-response prediction only.

## Repository structure

```
src/                  React UI, routing, and verified JS clinical modules
src/logic/            CYP2D6, phenoconversion, clinical safety (+ checks)
backend/             FastAPI inference + Google authentication
ml/                   Training script, reports, synthetic datasets, model
ml/models/            Trained proof-of-concept joblib model + feature schema
ml/data/              Synthetic encounter and candidate CSVs
.github/workflows/    GitHub Pages deployment
```

## Rule-based clinical modules

These modules are the source of truth for pharmacogenomic and safety screening:

- `src/logic/cyp2d6.js` — genotype activity score and predicted phenotype
- `src/logic/phenoconversion.js` — inhibitor-adjusted functional phenotype
- `src/logic/clinicalSafety.js` — eligibility / caution / avoid screening

Corresponding `*.check.js` files are lightweight regression checks. Do not treat them as clinical validation.

## ML proof-of-concept model

- Artifact: `ml/models/scdaid_response_model.joblib`
- Schema: `ml/models/feature_schema.json`
- Training: `ml/train_model.py`
- Reports: `ml/model_report.md`, `ml/model_report.json`, `ml/deployment_feature_audit.md`

The current ML model is a proof-of-concept trained on evidence-informed synthetic simulation data and has not established clinical predictive validity.

## Synthetic data

The included datasets are synthetic simulation data. No real patient-level clinical data are included in this repository.

- `ml/data/SCDAid_Synthetic_Encounters_v3.csv`
- `ml/data/SCDAid_Treatment_Candidates_v3.csv`

IDs such as `P0001` / `E00001` are simulated labels, not medical-record numbers.

## Reproducibility

1. Create a Python environment and install `ml/requirements.txt`.
2. Confirm the synthetic CSVs are present under `ml/data/`.
3. Run `python ml/train_model.py` to retrain (optional; the committed model is the proof-of-concept artifact).
4. Review `ml/model_report.md` for simulation-only metrics, leakage audit notes, and subgroup summaries.

Retraining is not required to run the application.

## Local development

**Frontend**

```bash
npm install
npm run dev -- --host localhost --port 5182
```

**Backend** (from the repository root)

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cp backend/.env.example backend/.env   # then fill in secrets locally; never commit .env
backend/.venv/bin/uvicorn app:app --app-dir backend --host 127.0.0.1 --port 8000
```

Google sign-in needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `backend/.env`. Keep `localhost` vs `127.0.0.1` consistent so the session cookie is sent.

## Testing

```bash
node src/logic/cyp2d6.check.js
node src/logic/phenoconversion.check.js
node src/logic/clinicalSafety.check.js
backend/.venv/bin/python backend/test_inference.py
backend/.venv/bin/python backend/test_auth.py
npm run build
```

GitHub Pages production build (base path `/SCDAid/`):

```bash
VITE_BASE=/SCDAid/ npm run build
npx vite preview --base /SCDAid/ --host 127.0.0.1 --port 4173
```

Then open `http://127.0.0.1:4173/SCDAid/` and `http://127.0.0.1:4173/SCDAid/assessment`.

## Public deployment

**Frontend (this repository)**

- GitHub Actions workflow: `.github/workflows/deploy-pages.yml`
- After creating the public `SCDAid` repository, enable GitHub Pages with **GitHub Actions** as the source
- Optional repository variable: `VITE_API_BASE_URL` (the deployed FastAPI origin, no trailing slash)

**Backend (later, not deployed by this workflow)**

Example production start command:

```bash
uvicorn app:app --app-dir backend --host 0.0.0.0 --port $PORT
```

`render.yaml` is a secret-free template for a future Render web service. Set environment variables in the host dashboard, not in git.

## Environment variables

**Backend** (`backend/.env`, gitignored). Names only; see `backend/.env.example`:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
FRONTEND_URL=
DATABASE_URL=
SESSION_SECRET=
```

Production should also set `COOKIE_SECURE=true`. If the frontend and API are on different sites (GitHub Pages → a hosted API), use `COOKIE_SAMESITE=none` with `COOKIE_SECURE=true`.

**Frontend build**

```
VITE_API_BASE_URL=https://your-api.example.com
VITE_BASE=/SCDAid/
```

Never place `GOOGLE_CLIENT_SECRET` or `SESSION_SECRET` in Vite, GitHub Actions frontend secrets, or browser JavaScript.

## Limitations

- Not clinical validation and not a licensed medical device
- Synthetic-oracle ranking does not establish real-world predictive performance
- Dose selection is not implemented
- Saved cases / history are not yet bound to user accounts
- Public Google signup is intentional for the research prototype; do not store real clinical records in this stack without an appropriate governance framework

## Citation

Please cite this software using `CITATION.cff`. Replace placeholder publication fields with the article DOI when it is available. Do not invent a DOI.

Simulation-based proof-of-concept. Performance reflects recovery of an evidence-informed synthetic simulation and does not establish clinical predictive validity.
