"""SYNTHETIC DATA GENERATOR - NOT REAL GOVERNMENT DATA.

Produces a deterministic (seeded) synthetic land-acquisition dataset for development and demonstration:

  data/projects.csv          12 synthetic projects (district names are real Telangana districts,
                             project names, budgets and all figures are invented)
  data/active_cases.csv      ongoing acquisition cases that are loaded into the database and scored by the model
  data/historical_cases.csv  completed synthetic cases with known final delay, used ONLY for model training

The latent delay process is an explicit formula over the acquisition factors plus noise, so the
trained model learns realistic-looking relationships. Financial figures are synthetic as well.

Run:  python data/generate_dataset.py
"""
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.ml.features import HIGH_DELAY_THRESHOLD_DAYS, PROJECT_TYPES, STAGES  # noqa: E402

SEED = 2026
OUT_DIR = Path(__file__).resolve().parent
REFERENCE_DATE = date(2026, 9, 1)  # snapshot date of the synthetic data
N_HISTORICAL = 3000

# district: (centroid lat, centroid lng, jitter degrees, synthetic land rate INR per acre)
DISTRICTS = {
    "Hyderabad": (17.385, 78.487, 0.05, 32_000_000),
    "Rangareddy": (17.250, 78.300, 0.13, 14_000_000),
    "Medchal-Malkajgiri": (17.560, 78.540, 0.08, 16_000_000),
    "Sangareddy": (17.620, 78.080, 0.14, 6_500_000),
    "Siddipet": (18.100, 78.850, 0.14, 3_200_000),
    "Yadadri Bhuvanagiri": (17.510, 78.890, 0.12, 4_000_000),
    "Warangal": (17.970, 79.590, 0.12, 3_800_000),
    "Karimnagar": (18.430, 79.130, 0.13, 3_000_000),
    "Nalgonda": (17.050, 79.270, 0.14, 2_600_000),
    "Khammam": (17.250, 80.150, 0.13, 2_400_000),
    "Mahabubnagar": (16.740, 77.990, 0.14, 2_200_000),
    "Nizamabad": (18.670, 78.100, 0.13, 2_500_000),
    "Adilabad": (19.660, 78.530, 0.14, 1_600_000),
}

# code, name, type, districts, start date, number of active cases
PROJECTS = [
    ("NRR-A", "Northern Ring Road - Section A", "Highway",
     ["Sangareddy", "Medchal-Malkajgiri", "Siddipet", "Yadadri Bhuvanagiri"], date(2023, 4, 1), 48),
    ("AMC-2", "Airport Metro Corridor - Phase 2", "Urban Infrastructure", ["Hyderabad", "Rangareddy"], date(2023, 9, 15), 36),
    ("CDP-21", "Canal Distributary Package 21", "Irrigation", ["Karimnagar", "Siddipet", "Nizamabad"], date(2022, 11, 1), 44),
    ("EIC-1", "Eastern Industrial Corridor - Node 1", "Industrial Corridor", ["Yadadri Bhuvanagiri", "Warangal"], date(2023, 6, 1), 38),
    ("TRL-3", "Third Rail Line - Southern Section", "Railway", ["Warangal", "Khammam"], date(2023, 1, 10), 40),
    ("SH-14", "State Highway 14 Widening", "Highway", ["Medchal-Malkajgiri", "Warangal"], date(2024, 2, 1), 30),
    ("PIP-1", "Pharma Industrial Park", "Industrial Corridor", ["Rangareddy"], date(2023, 3, 20), 28),
    ("LIS-5", "Lift Irrigation Scheme - Reservoir 5", "Irrigation", ["Mahabubnagar", "Rangareddy"], date(2022, 8, 1), 42),
    ("PTL-400", "400 kV Transmission Line - North", "Power Transmission", ["Adilabad", "Nizamabad"], date(2024, 1, 5), 32),
    ("NBL-1", "Nalgonda Bypass & Logistics Park", "Highway", ["Nalgonda"], date(2024, 5, 1), 26),
    ("FPA-2", "Food Park Access Roads", "Industrial Corridor", ["Khammam"], date(2024, 8, 1), 22),
    ("SUR-2", "Suburban Rail Extension - Phase 2", "Railway", ["Medchal-Malkajgiri", "Sangareddy"], date(2023, 11, 1), 34),
]

TYPE_DELAY_BASE = {
    "Highway": 10, "Railway": 25, "Irrigation": 40,
    "Industrial Corridor": 0, "Urban Infrastructure": 30, "Power Transmission": -15,
}
TYPE_REHAB_PER_ACRE = {
    "Highway": 0.08, "Railway": 0.10, "Irrigation": 0.30,
    "Industrial Corridor": 0.12, "Urban Infrastructure": 0.20, "Power Transmission": 0.02,
}
STAGE_PROBS = [0.14, 0.18, 0.18, 0.20, 0.18, 0.12]
STAGE_SPEND = [0.0, 0.03, 0.08, 0.30, 0.70, 0.95]  # share of cost typically disbursed by stage

SYLLABLES_A = ["Kon", "Ram", "Ven", "Gan", "Mal", "Shan", "Nar", "Bhu", "Kist", "Sri", "Pedda", "Chinna", "Laxmi", "Yella"]
SYLLABLES_B = ["apur", "ampet", "aguda", "apally", "aram", "anagar", "apalem", "avaram", "igiri", "akunta"]


def _village(rng: np.random.Generator) -> str:
    return f"{rng.choice(SYLLABLES_A)}{rng.choice(SYLLABLES_B)}"


def sample_factors(rng: np.random.Generator, ptype: str) -> dict:
    area = float(np.clip(rng.lognormal(np.log(35), 0.75), 2, 600))
    owners = int(np.clip(round(area * rng.uniform(0.3, 1.4)), 1, 450))
    clearance = float(np.clip(rng.normal(74, 14), 20, 100))
    pending = int(min(15, rng.poisson(0.6 + (100 - clearance) / 22)))
    wait = float(np.clip(pending * rng.uniform(12, 55) + rng.normal(0, 8), 0, 400))
    ratio = float(np.clip(rng.normal(0.92, 0.14), 0.5, 1.35))
    shortfall = max(0.0, 1 - ratio)
    doc_gap = float(np.clip(rng.beta(2, 6) * 100, 0, 95))
    comp_disputes = int(min(60, rng.poisson(owners * 0.02 * (1 + shortfall * 5))))
    legal = int(min(20, rng.poisson(0.2 + comp_disputes * 0.15 + doc_gap / 45)))
    rehab = int(min(500, rng.poisson(area * TYPE_REHAB_PER_ACRE[ptype])))
    objections = int(min(100, rng.poisson(owners * 0.04 * (1 + shortfall * 3) + rehab * 0.05)))
    resistance = int(np.clip(round(1 + objections / 6 + rehab / 40 + rng.normal(0, 0.8)), 1, 5))
    stage = int(rng.choice(len(STAGES), p=STAGE_PROBS))
    return {
        "land_area_acres": round(area, 1),
        "num_landowners": owners,
        "pending_approvals": pending,
        "approval_wait_days": round(wait, 0),
        "govt_clearance_pct": round(clearance, 0),
        "compensation_disputes": comp_disputes,
        "compensation_to_market_ratio": round(ratio, 2),
        "legal_cases": legal,
        "documentation_gap_pct": round(doc_gap, 0),
        "landowner_objections": objections,
        "stakeholder_resistance": resistance,
        "rehab_families": rehab,
        "stage_index": stage,
    }


def latent_final_delay(rng: np.random.Generator, f: dict, ptype: str) -> float:
    shortfall = max(0.0, 1 - f["compensation_to_market_ratio"])
    delay = (
        TYPE_DELAY_BASE[ptype]
        + 0.45 * f["approval_wait_days"]
        + 6 * f["pending_approvals"]
        + 0.9 * (100 - f["govt_clearance_pct"])
        + 5 * f["compensation_disputes"]
        + 160 * shortfall
        + 18 * f["legal_cases"]
        + 0.9 * f["documentation_gap_pct"]
        + 1.4 * f["landowner_objections"]
        + 9 * f["stakeholder_resistance"]
        + 0.15 * f["rehab_families"]
        + 0.05 * f["num_landowners"]
        + rng.normal(0, 25)
    )
    return max(0.0, delay)


def generate_projects_and_cases(rng: np.random.Generator):
    projects, cases = [], []
    for code, name, ptype, districts, start, n_cases in PROJECTS:
        project_cost = 0.0
        for i in range(1, n_cases + 1):
            district = str(rng.choice(districts))
            lat0, lng0, jitter, rate = DISTRICTS[district]
            f = sample_factors(rng, ptype)
            final_delay = latent_final_delay(rng, f, ptype)
            stage = f["stage_index"]
            progress = (stage + rng.uniform(0.2, 0.9)) / len(STAGES)
            current_delay = int(round(final_delay * progress * rng.uniform(0.7, 1.15)))

            max_offset = max(30, (REFERENCE_DATE - start).days - 60)
            notification = start + timedelta(days=int(rng.integers(0, max_offset)))
            planned_completion = notification + timedelta(days=int(rng.integers(540, 900)))

            if f["legal_cases"] >= 4 and rng.random() < 0.5:
                status = "Stalled - Litigation"
            elif current_delay > HIGH_DELAY_THRESHOLD_DAYS:
                status = "Severely Delayed"
            elif current_delay > 45:
                status = "Delayed"
            else:
                status = "On Track"

            case_rate = rate * rng.uniform(0.7, 1.3)
            estimated = f["land_area_acres"] * case_rate * 1.15  # incl. R&R provisions
            compensation = f["land_area_acres"] * case_rate * f["compensation_to_market_ratio"]
            overrun_frac = (
                0.01 + final_delay / 1600 + f["compensation_disputes"] * 0.004 + f["legal_cases"] * 0.01
                + rng.normal(0, 0.03)
            )
            actual = estimated * (1 + overrun_frac)
            utilized = min(actual, actual * STAGE_SPEND[stage] * rng.uniform(0.85, 1.05))
            project_cost += estimated

            cases.append({
                "case_code": f"{code}-{i:03d}",
                "project_code": code,
                "district": district,
                "village": _village(rng),
                "latitude": round(lat0 + rng.uniform(-jitter, jitter), 5),
                "longitude": round(lng0 + rng.uniform(-jitter, jitter), 5),
                "acquisition_stage": STAGES[stage],
                "status": status,
                "notification_date": notification.isoformat(),
                "planned_completion_date": planned_completion.isoformat(),
                "current_delay_days": current_delay,
                **f,
                "estimated_cost": round(estimated, 0),
                "compensation_amount": round(compensation, 0),
                "utilized_amount": round(utilized, 0),
                "actual_cost": round(actual, 0),
            })
        projects.append({
            "code": code,
            "name": name,
            "project_type": ptype,
            "districts": ", ".join(districts),
            "start_date": start.isoformat(),
            "total_budget": round(project_cost * rng.uniform(1.05, 1.15), 0),  # incl. contingency
        })
    return pd.DataFrame(projects), pd.DataFrame(cases)


def generate_historical(rng: np.random.Generator) -> pd.DataFrame:
    rows = []
    for _ in range(N_HISTORICAL):
        ptype = str(rng.choice(PROJECT_TYPES))
        district = str(rng.choice(list(DISTRICTS)))
        f = sample_factors(rng, ptype)
        final_delay = latent_final_delay(rng, f, ptype)
        rows.append({
            "district": district,
            "project_type": ptype,
            "project_type_code": PROJECT_TYPES.index(ptype),
            **f,
            "final_delay_days": round(final_delay, 0),
            "high_delay": int(final_delay > HIGH_DELAY_THRESHOLD_DAYS),
        })
    return pd.DataFrame(rows)


def main() -> None:
    rng = np.random.default_rng(SEED)
    projects, cases = generate_projects_and_cases(rng)
    historical = generate_historical(rng)
    projects.to_csv(OUT_DIR / "projects.csv", index=False)
    cases.to_csv(OUT_DIR / "active_cases.csv", index=False)
    historical.to_csv(OUT_DIR / "historical_cases.csv", index=False)
    print(f"SYNTHETIC dataset written to {OUT_DIR}")
    print(f"  projects: {len(projects)}  active cases: {len(cases)}  historical (training): {len(historical)}")
    print(f"  historical high-delay rate: {historical['high_delay'].mean():.1%}  "
          f"median final delay: {historical['final_delay_days'].median():.0f} days")


if __name__ == "__main__":
    main()
