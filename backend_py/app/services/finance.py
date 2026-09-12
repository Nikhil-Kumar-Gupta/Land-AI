"""Derived financial figures - computed only here, from stored (SYNTHETIC) values."""

COST_OVERRUN_ALERT_PCT = 15.0


def case_finance(estimated_cost: float, compensation_amount: float, utilized_amount: float, actual_cost: float) -> dict:
    estimated = float(estimated_cost or 0)
    utilized = float(utilized_amount or 0)
    actual = float(actual_cost or 0)
    overrun = actual - estimated
    return {
        "estimated_cost": round(estimated, 2),
        "compensation_amount": round(float(compensation_amount or 0), 2),
        "utilized_amount": round(utilized, 2),
        "actual_cost": round(actual, 2),
        "remaining_budget": round(estimated - utilized, 2),
        "cost_overrun": round(overrun, 2),
        "cost_overrun_pct": round(overrun / estimated * 100, 2) if estimated else 0.0,
        "utilization_pct": round(utilized / estimated * 100, 2) if estimated else 0.0,
    }


def budget_issue(fin: dict) -> str:
    if fin["cost_overrun_pct"] > COST_OVERRUN_ALERT_PCT:
        return f"Cost overrun +{fin['cost_overrun_pct']:.1f}%"
    if fin["utilization_pct"] > 90:
        return "Case budget nearly exhausted"
    if fin["cost_overrun_pct"] > 5:
        return f"Minor overrun +{fin['cost_overrun_pct']:.1f}%"
    return "Within budget"
