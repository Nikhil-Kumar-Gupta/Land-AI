# LandAI — Predictive Analytics System for Early Detection of Land Acquisition Delays

> **SYNTHETIC DATA.** Case records come from `backend_py/data/land_acquisition_dataset.csv`
> (originally `land_acquisition_synthetic_dataset_v2.csv.xls`, a synthetic dataset). Budget, utilisation and actual-cost
> figures are synthetic values derived from it during import. None of it is real government data.

## Architecture

```
data/land_acquisition_dataset.csv ─► app/ml/dataset.py (validate, median-impute, encode)
        ├─► app/ml/train.py ─► model_artifacts/ (XGBoost/RF + metrics.json + SHAP background)
        └─► scripts/seed.py ─► PostgreSQL/PostGIS (districts, projects, cases + synthetic finance)
                                     │
            app/services/scoring.py (model + SHAP → predictions table → alerts table)
                                     │
FastAPI (backend_py/app, JWT) ─► /api/* ─► React + Vite (frontend/, proxied at /api)
```

- **Risk %**: classifier for P(`expected_additional_delay_days` > 75) — about the worst 25% of cases.
  **Predicted delay**: regressor on `expected_additional_delay_days`. XGBoost and Random Forest are both trained;
  the better hold-out score is kept (see the Model page). Risk levels: High ≥ 65%, Medium ≥ 35%.
- **SHAP**: `shap.TreeExplainer` (interventional); per-case values are persisted so every page agrees.
- **Zones** (`app/services/zones.py`): *Ready to occupy* = no court case, ≤ 2 disputes, ≤ 2 objections and compensation
  not pending; otherwise *Owners not ready to sell*.
- **Map**: the dataset has no case coordinates, so districts are placed at their headquarters (`app/geo.py`); the two
  zone circles per district are schematic, with circle area equal to the zone's total acreage.
- **Projects**: groups of project type × state (the dataset has no project names).
- **Alerts**: High model risk, cost overrun > 15%, previous-stage delay > 30 days.
- **Recommendations** are deterministic templates chosen from the largest positive SHAP factors; no LLM is used.

## Using your own dataset
Put a CSV or Excel file with the same columns (see `REQUIRED_COLUMNS` in `app/ml/dataset.py`) at
`backend_py/data/land_acquisition_dataset.csv`, or set `DATASET_PATH` in `backend_py/.env`. Excel `.xlsx` needs
`pip install openpyxl`. Then, on an **empty** database, run the seed with `--retrain`. New districts need an entry in
`app/geo.py` to appear on the map.

## Setup

### 1. Database (PostgreSQL + PostGIS)
Install PostgreSQL with PostGIS, create a database, create `backend_py/.env` from `.env.example` and set
`DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@localhost:5432/sanket_ai`. Without it, a local SQLite file
(`backend_py/sanket_dev.db`) is used for development.

### 2. Backend
```powershell
cd backend_py
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m scripts.seed          # import dataset, train, score
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```
`--retrain` retrains the models; `--rescore` rescores existing cases. The seed never deletes existing rows.

### 3. Frontend
```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### Demo accounts
`LAND001` / `nikhilgupta9052@gmail.com` and `CONST002` / `admin@constructa.com` — password `Demo@1234`.
With `OTP_DEV_MODE=true` the OTP is shown on screen; set it to `false` and configure SMTP for real email delivery.

## Legacy code
`backend/` (Node/Express prototype), `ai/` (formula scripts) and `backend_py/data/generate_dataset.py` (earlier
generated data) are not used by the application.
