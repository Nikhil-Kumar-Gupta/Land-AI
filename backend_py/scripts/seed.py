"""Import the project dataset into the database, train the model, and score every case.

  python -m scripts.seed              # create tables, import dataset if DB is empty, train if needed, score
  python -m scripts.seed --retrain    # also retrain the model, then rescore
  python -m scripts.seed --rescore    # only rescore existing cases with the current model

Dataset: DATASET_PATH (default data/land_acquisition_dataset.csv) - CSV or Excel with the columns listed in
app/ml/dataset.py. Existing rows are never deleted: cases are only imported when the projects table is empty.

SYNTHETIC finance: the dataset only has compensation_amount_lakh. estimated_cost, utilized_amount and actual_cost are
derived here (seeded, reproducible) and flagged finance_is_synthetic=True.
"""
import argparse
from collections import defaultdict

import numpy as np
from sqlalchemy import func, select

from app.config import IS_POSTGRES, logger, settings
from app.database import SessionLocal, init_db
from app.geo import DISTRICT_CENTROIDS
from app.ml import train as train_module
from app.ml.dataset import load_dataset
from app.ml.features import NUMERIC_FEATURES
from app.ml.inference import model_service
from app.models import AcquisitionCase, Business, District, Project
from app.security import hash_password
from app.services.scoring import score_cases
from app.services.zones import readiness_zone

SEED = 2026
DEMO_PASSWORD = "Demo@1234"
DEMO_BUSINESSES = [
    {"business_id": "LAND001", "gst_number": "36ABCDE1234F1Z5", "email": "nikhilgupta9052@gmail.com",
     "name": "LandBuild Infrastructure Pvt. Ltd.", "phone": "9000000001"},
    {"business_id": "CONST002", "gst_number": "29ABCDE5678G1Z2", "email": "admin@constructa.com",
     "name": "Constructa Projects", "phone": "9000000002"},
]
# Typical share of cost disbursed by the time a case reaches each stage (Survey ... Possession).
STAGE_SPEND = [0.0, 0.02, 0.03, 0.05, 0.08, 0.30, 0.70, 0.95]
TYPE_ABBR = {"Highway": "HWY", "Railway": "RLY", "Irrigation": "IRR", "Industrial": "IND", "Public Infrastructure": "PUB"}
STATE_ABBR = {"Telangana": "TG", "Andhra Pradesh": "AP", "Karnataka": "KA", "Maharashtra": "MH", "Odisha": "OD"}


def seed_businesses(db) -> None:
    for b in DEMO_BUSINESSES:
        if db.scalar(select(Business).where(Business.email == b["email"])) is None:
            db.add(Business(**b, password_hash=hash_password(DEMO_PASSWORD), is_verified=True))
    db.commit()


def case_status(r: dict) -> str:
    if r["court_case"]:
        return "Stalled - Litigation"
    if r["previous_stage_delay_days"] > 25:
        return "Severely Delayed"
    if r["previous_stage_delay_days"] > 10:
        return "Delayed"
    return "On Track"


def synthetic_finance(r: dict, rng: np.random.Generator) -> dict:
    compensation = float(r["compensation_amount_lakh"]) * 1e5
    estimated = compensation * rng.uniform(1.15, 1.35)  # + R&R, administrative costs and contingency
    overrun_frac = (0.01 + r["expected_additional_delay_days"] / 900 + r["dispute_count"] * 0.008
                    + r["court_case"] * 0.05 + r["budget_release_delay_days"] / 200 + rng.normal(0, 0.03))
    actual = estimated * (1 + overrun_frac)
    utilized = min(actual, actual * STAGE_SPEND[int(r["stage_index"])] * rng.uniform(0.85, 1.05))
    return {"compensation_amount": round(compensation, 0), "estimated_cost": round(estimated, 0),
            "actual_cost": round(actual, 0), "utilized_amount": round(utilized, 0)}


def import_dataset(db) -> None:
    if db.scalar(select(func.count(Project.id))):
        print("Cases already present - skipping import.")
        return
    df, info = load_dataset()
    rng = np.random.default_rng(SEED)

    districts: dict[tuple[str, str], District] = {}
    for (state, name) in sorted(set(zip(df["state"], df["district"]))):
        lat, lng = DISTRICT_CENTROIDS.get((state, name), (None, None))
        if lat is None:
            logger.warning("No coordinates for district %s, %s - it will not appear on the map.", name, state)
        d = District(name=name, state=state, latitude=lat, longitude=lng)
        if IS_POSTGRES and lat is not None:
            from geoalchemy2.elements import WKTElement
            d.geom = WKTElement(f"POINT({lng} {lat})", srid=4326)
        db.add(d)
        districts[(state, name)] = d

    projects: dict[tuple[str, str], Project] = {}
    project_districts = defaultdict(set)
    for (ptype, state), g in df.groupby(["project_type", "state"]):
        p = Project(code=f"{TYPE_ABBR.get(ptype, ptype[:3].upper())}-{STATE_ABBR.get(state, state[:2].upper())}",
                    name=f"{ptype} - {state}", project_type=ptype, state=state, districts="", total_budget=0.0)
        db.add(p)
        projects[(ptype, state)] = p
    db.flush()

    estimated_by_project = defaultdict(float)
    for r in df.to_dict(orient="records"):
        key = (r["project_type"], r["state"])
        fin = synthetic_finance(r, rng)
        estimated_by_project[key] += fin["estimated_cost"]
        project_districts[key].add(r["district"])
        db.add(AcquisitionCase(
            case_code=r["case_id"], project_id=projects[key].id, district_id=districts[(r["state"], r["district"])].id,
            state=r["state"], district=r["district"], acquisition_stage=r["acquisition_stage"],
            stage_index=int(r["stage_index"]), status=case_status(r), priority=r["priority"],
            project_category=r["project_category"], zone=readiness_zone(r),
            **{f: float(r[f]) for f in NUMERIC_FEATURES},
            government_land_pct=float(r["government_land_pct"]),
            imputed_fields=r["imputed_fields"] or None,
            delayed_recorded=int(r["delayed"]),
            recorded_additional_delay_days=float(r["expected_additional_delay_days"]),
            **fin,
        ))
    for key, p in projects.items():
        p.total_budget = round(estimated_by_project[key] * 1.10, 0)  # 10% contingency over case estimates
        p.districts = ", ".join(sorted(project_districts[key]))
    db.commit()
    print(f"Imported {info['rows']} cases, {len(projects)} projects, {len(districts)} districts from {info['file']}. "
          f"Imputed values: {info['imputed_counts']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--retrain", action="store_true")
    parser.add_argument("--rescore", action="store_true")
    args = parser.parse_args()

    print(f"Database: {'PostgreSQL/PostGIS' if IS_POSTGRES else 'SQLite (development fallback)'}")
    init_db()
    with SessionLocal() as db:
        if not args.rescore:
            seed_businesses(db)
            import_dataset(db)
        if args.retrain or not (settings.ARTIFACT_DIR / "risk_model.joblib").exists():
            metrics = train_module.train()
            model_service.reload()
            print(f"Trained model {metrics['model_version']}: risk={metrics['risk_model']['selected']}, "
                  f"delay={metrics['delay_model']['selected']}")
        n = score_cases(db)
        print(f"Scored {n} cases with model {model_service.model_version}.")


if __name__ == "__main__":
    main()
