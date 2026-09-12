"""Portfolio analytics computed from the database (cases + persisted predictions)."""
from collections import Counter, defaultdict

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..ml.explain import delay_drivers
from ..ml.features import FEATURE_BY_NAME, NUMERIC_FEATURES, STAGES
from ..models import AcquisitionCase, Alert, District, Project
from .serialize import case_record, case_summary
from .zones import NOT_READY, READY, ZONE_LABELS, blockers

RISK_LEVELS = ["Low", "Medium", "High"]


def load_cases(db: Session) -> list[AcquisitionCase]:
    return db.scalars(
        select(AcquisitionCase).options(joinedload(AcquisitionCase.project), joinedload(AcquisitionCase.prediction))
    ).unique().all()


def frame(cases: list[AcquisitionCase]) -> pd.DataFrame:
    rows = []
    for c in cases:
        if c.prediction is None:
            continue
        record = case_record(c)
        rows.append({**{f: record[f] for f in NUMERIC_FEATURES}, **case_summary(c)})
    df = pd.DataFrame(rows)
    if not df.empty:
        df["is_high"] = df["risk_level"] == "High"
    return df


def _r(value, digits=1):
    return None if pd.isna(value) else round(float(value), digits)


def kpis(db: Session, df: pd.DataFrame) -> dict:
    total_budget = db.scalar(select(func.coalesce(func.sum(Project.total_budget), 0.0))) or 0.0
    active_alerts = db.scalar(select(func.count(Alert.id)).where(Alert.is_acknowledged.is_(False))) or 0
    if df.empty:
        return {"total_projects": db.scalar(select(func.count(Project.id))) or 0, "total_cases": 0,
                "high_risk_cases": 0, "avg_delay_days": 0, "avg_predicted_delay_days": 0,
                "budget_utilization_pct": 0, "total_budget": total_budget, "utilized_amount": 0,
                "cost_overrun": 0, "cost_overrun_pct": 0, "active_alerts": active_alerts, "avg_risk_pct": 0,
                "ready_cases": 0, "total_districts": 0}
    estimated = df["estimated_cost"].sum()
    overrun = (df["actual_cost"] - df["estimated_cost"]).sum()
    utilized = df["utilized_amount"].sum()
    return {
        "total_projects": int(df["project_id"].nunique()),
        "total_cases": int(len(df)),
        "total_districts": int(df["district"].nunique()),
        "high_risk_cases": int(df["is_high"].sum()),
        "ready_cases": int((df["zone"] == READY).sum()),
        "avg_risk_pct": _r(df["risk_pct"].mean()),
        "avg_delay_days": _r(df["current_delay_days"].mean(), 1),
        "avg_predicted_delay_days": _r(df["predicted_delay_days"].mean(), 0),
        "total_budget": round(float(total_budget), 0),
        "utilized_amount": round(float(utilized), 0),
        "budget_utilization_pct": _r(utilized / total_budget * 100 if total_budget else 0),
        "cost_overrun": round(float(overrun), 0),
        "cost_overrun_pct": _r(overrun / estimated * 100 if estimated else 0, 2),
        "active_alerts": int(active_alerts),
    }


def risk_distribution(df: pd.DataFrame) -> list[dict]:
    counts = df["risk_level"].value_counts() if not df.empty else {}
    return [{"level": lvl, "count": int(counts.get(lvl, 0))} for lvl in RISK_LEVELS]


def _category_days(cases) -> tuple[dict, dict, int]:
    totals, affected, n = defaultdict(float), defaultdict(int), 0
    for c in cases:
        if not c.prediction:
            continue
        n += 1
        for d in delay_drivers(c.prediction.shap_delay):
            if d["days"] > 0:
                totals[d["category"]] += d["days"]
                if d["days"] >= 3:
                    affected[d["category"]] += 1
    return totals, affected, n


def portfolio_delay_drivers(cases: list[AcquisitionCase]) -> list[dict]:
    """Mean SHAP-attributed added delay (days) per driver category across all scored cases."""
    totals, affected, n = _category_days(cases)
    if not n:
        return []
    rows = [{"category": k, "avg_added_delay_days": round(v / n, 1), "cases_affected": affected[k]}
            for k, v in totals.items()]
    return sorted(rows, key=lambda r: r["avg_added_delay_days"], reverse=True)


def portfolio_risk_factors(cases: list[AcquisitionCase], limit: int = 10) -> list[dict]:
    """Global SHAP importance: mean |contribution| to risk (percentage points) per feature."""
    abs_sum, pos_sum, n = defaultdict(float), defaultdict(float), 0
    for c in cases:
        if not c.prediction:
            continue
        n += 1
        for item in c.prediction.shap_risk:
            abs_sum[item["feature"]] += abs(item["shap"])
            pos_sum[item["feature"]] += max(item["shap"], 0)
    if not n:
        return []
    rows = [{
        "feature": f, "label": FEATURE_BY_NAME[f].label, "category": FEATURE_BY_NAME[f].category,
        "mean_abs_impact_pp": round(abs_sum[f] / n * 100, 2),
        "mean_risk_increase_pp": round(pos_sum[f] / n * 100, 2),
    } for f in abs_sum]
    return sorted(rows, key=lambda r: r["mean_abs_impact_pp"], reverse=True)[:limit]


def _group_stats(df: pd.DataFrame, key: str) -> list[dict]:
    if df.empty:
        return []
    g = df.groupby(key).agg(
        cases=("id", "count"), high_risk=("is_high", "sum"), avg_risk_pct=("risk_pct", "mean"),
        avg_delay_days=("current_delay_days", "mean"), avg_predicted_delay_days=("predicted_delay_days", "mean"),
    ).reset_index()
    rows = [{
        key: getattr(r, key), "cases": int(r.cases), "high_risk": int(r.high_risk),
        "high_risk_share_pct": _r(r.high_risk / r.cases * 100), "avg_risk_pct": _r(r.avg_risk_pct),
        "avg_delay_days": _r(r.avg_delay_days), "avg_predicted_delay_days": _r(r.avg_predicted_delay_days, 0),
    } for r in g.itertuples()]
    return sorted(rows, key=lambda r: r["avg_risk_pct"], reverse=True)


def district_analysis(df: pd.DataFrame) -> list[dict]:
    rows = _group_stats(df, "district")
    states = df.groupby("district")["state"].first().to_dict() if not df.empty else {}
    for r in rows:
        r["state"] = states.get(r["district"])
    return rows


def state_analysis(df: pd.DataFrame) -> list[dict]:
    return _group_stats(df, "state")


def project_performance(db: Session, df: pd.DataFrame) -> list[dict]:
    projects = {p.id: p for p in db.scalars(select(Project))}
    if df.empty:
        return []
    df = df.assign(overrun=df["actual_cost"] - df["estimated_cost"])
    g = df.groupby("project_id").agg(
        cases=("id", "count"), high_risk=("is_high", "sum"), avg_risk_pct=("risk_pct", "mean"),
        avg_delay_days=("current_delay_days", "mean"), avg_predicted_delay_days=("predicted_delay_days", "mean"),
        estimated_cost=("estimated_cost", "sum"), actual_cost=("actual_cost", "sum"),
        utilized_amount=("utilized_amount", "sum"), overrun=("overrun", "sum"),
    )
    rows = []
    for pid, r in g.iterrows():
        p = projects[pid]
        rows.append({
            "project_id": pid, "project_code": p.code, "project_name": p.name, "project_type": p.project_type,
            "state": p.state, "districts": p.districts, "cases": int(r.cases), "high_risk": int(r.high_risk),
            "avg_risk_pct": _r(r.avg_risk_pct), "avg_delay_days": _r(r.avg_delay_days),
            "avg_predicted_delay_days": _r(r.avg_predicted_delay_days, 0),
            "total_budget": round(p.total_budget, 0), "estimated_cost": round(r.estimated_cost, 0),
            "actual_cost": round(r.actual_cost, 0), "utilized_amount": round(r.utilized_amount, 0),
            "remaining_budget": round(p.total_budget - r.utilized_amount, 0),
            "budget_utilization_pct": _r(r.utilized_amount / p.total_budget * 100 if p.total_budget else 0),
            "cost_overrun": round(r.overrun, 0),
            "cost_overrun_pct": _r(r.overrun / r.estimated_cost * 100 if r.estimated_cost else 0, 2),
        })
    return sorted(rows, key=lambda r: r["avg_risk_pct"], reverse=True)


def stage_analysis(df: pd.DataFrame) -> list[dict]:
    rows = []
    for idx, stage in enumerate(STAGES):
        s = df[df["stage_index"] == idx] if not df.empty else df
        n = len(s)
        rows.append({
            "stage": stage, "stage_index": idx, "cases": int(n),
            "high_risk": int(s["is_high"].sum()) if n else 0,
            "high_risk_share_pct": _r(s["is_high"].mean() * 100) if n else 0,
            "avg_delay_days": _r(s["current_delay_days"].mean()) if n else 0,
            "avg_predicted_delay_days": _r(s["predicted_delay_days"].mean(), 0) if n else 0,
            "avg_days_in_stage": _r(s["days_in_current_stage"].mean()) if n else 0,
            "avg_risk_pct": _r(s["risk_pct"].mean()) if n else 0,
        })
    return rows


def stage_risk_for(df: pd.DataFrame, stage_index: int) -> dict:
    s = df[df["stage_index"] == stage_index]
    share = s["is_high"].mean() if len(s) else 0
    overall = df["is_high"].mean() if len(df) else 0
    ratio = share / overall if overall else 0
    return {
        "stage": STAGES[stage_index], "cases_in_stage": int(len(s)),
        "high_risk_share_pct": _r(share * 100), "portfolio_high_risk_share_pct": _r(overall * 100),
        "avg_delay_days": _r(s["current_delay_days"].mean()) if len(s) else 0,
        "avg_days_in_stage": _r(s["days_in_current_stage"].mean()) if len(s) else 0,
        "avg_predicted_delay_days": _r(s["predicted_delay_days"].mean(), 0) if len(s) else 0,
        "level": "High" if ratio >= 1.2 else "Medium" if ratio >= 0.8 else "Low",
    }


def histogram(series: pd.Series, edges: list[float], fmt) -> list[dict]:
    labels = [fmt(edges[i], edges[i + 1]) for i in range(len(edges) - 1)]
    counts = pd.cut(series, bins=edges, right=False, include_lowest=True).value_counts(sort=False)
    return [{"bin": labels[i], "count": int(v)} for i, v in enumerate(counts.values)]


def distributions(df: pd.DataFrame) -> dict:
    if df.empty:
        return {"risk_histogram": [], "delay_histogram": [], "current_delay_histogram": []}
    top = max(float(df["predicted_delay_days"].max()), float(df["current_delay_days"].max())) + 1
    edges = [0, 15, 30, 45, 60, 75, 90, 105, max(120, top)]
    fmt = lambda a, b: f"{int(a)}-{int(b)}d" if b <= 105 else f"{int(a)}d+"  # noqa: E731
    return {
        "risk_histogram": histogram(df["risk_pct"], list(range(0, 101, 10)) + [100.0001],
                                    lambda a, b: f"{int(a)}-{min(int(b), 100)}%")[:10],
        "delay_histogram": histogram(df["predicted_delay_days"], edges, fmt),
        "current_delay_histogram": histogram(df["current_delay_days"], edges, fmt),
    }


def _zone_stats(z: pd.DataFrame) -> dict:
    n = len(z)
    acres = float(z["land_area_acres"].sum()) if n else 0.0
    return {
        "cases": int(n),
        "acres": round(acres, 1),
        "avg_risk_pct": _r(z["risk_pct"].mean()) if n else None,
        "high_risk": int(z["is_high"].sum()) if n else 0,
        "avg_predicted_delay_days": _r(z["predicted_delay_days"].mean(), 0) if n else None,
        "compensation_per_acre_lakh": _r(z["compensation_amount_lakh"].sum() / acres, 2) if acres else None,
        "landowners": int(z["number_of_landowners"].sum()) if n else 0,
    }


def district_geo(db: Session, cases: list[AcquisitionCase], df: pd.DataFrame) -> list[dict]:
    """Builder-oriented district summaries with the two owner-readiness zones."""
    if df.empty:
        return []
    districts = {(d.state, d.name): d for d in db.scalars(select(District))}
    by_district: dict[str, list] = defaultdict(list)
    for c in cases:
        if c.prediction:
            by_district[c.district].append(c)

    out = []
    for (state, name), g in df.groupby(["state", "district"]):
        d = districts.get((state, name))
        acres = float(g["land_area_acres"].sum())
        ready, not_ready = g[g["zone"] == READY], g[g["zone"] == NOT_READY]
        blocker_counts = Counter(b for r in not_ready.to_dict(orient="records") for b in blockers(r))
        totals, _, n = _category_days(by_district[name])
        drivers = sorted(({"category": k, "avg_days": round(v / n, 1)} for k, v in totals.items()),
                         key=lambda x: x["avg_days"], reverse=True)[:3] if n else []
        overrun = float((g["actual_cost"] - g["estimated_cost"]).sum())
        estimated = float(g["estimated_cost"].sum())
        out.append({
            "district": name, "state": state,
            "latitude": d.latitude if d else None, "longitude": d.longitude if d else None,
            "cases": int(len(g)), "total_acres": round(acres, 1),
            "ready_share_pct": _r(ready["land_area_acres"].sum() / acres * 100) if acres else 0,
            "zones": {READY: {"label": ZONE_LABELS[READY], **_zone_stats(ready)},
                      NOT_READY: {"label": ZONE_LABELS[NOT_READY], **_zone_stats(not_ready),
                                  "blockers": dict(blocker_counts.most_common())}},
            "avg_risk_pct": _r(g["risk_pct"].mean()), "high_risk": int(g["is_high"].sum()),
            "avg_predicted_delay_days": _r(g["predicted_delay_days"].mean(), 0),
            "avg_current_delay_days": _r(g["current_delay_days"].mean()),
            "compensation_per_acre_lakh": _r(g["compensation_amount_lakh"].sum() / acres, 2) if acres else None,
            "private_land_pct": _r((g["private_land_pct"] * g["land_area_acres"]).sum() / acres) if acres else None,
            "government_land_pct": _r(100 - (g["private_land_pct"] * g["land_area_acres"]).sum() / acres) if acres else None,
            "landowners": int(g["number_of_landowners"].sum()),
            "households": int(g["affected_households"].sum()),
            "total_disputes": int(g["dispute_count"].sum()), "court_cases": int(g["court_case"].sum()),
            "avg_objections": _r(g["objection_count"].mean(), 2),
            "avg_days_in_stage": _r(g["days_in_current_stage"].mean()),
            "historical_delay_rate": _r(g["district_historical_delay_rate"].mean(), 3),
            "estimated_cost": round(estimated, 0),
            "cost_overrun_pct": _r(overrun / estimated * 100 if estimated else 0, 2),
            "stage_mix": [{"stage": s, "cases": int((g["acquisition_stage"] == s).sum())} for s in STAGES],
            "project_types": [{"type": k, "cases": int(v)} for k, v in g["project_type"].value_counts().items()],
            "top_delay_drivers": drivers,
        })
    return sorted(out, key=lambda r: (r["state"], r["district"]))
