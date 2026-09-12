"""Owner-readiness zones used on the district map."""

READY = "ready"
NOT_READY = "not_ready"
ZONE_LABELS = {READY: "Ready to occupy", NOT_READY: "Owners not ready to sell"}
ZONE_RULE = ("Ready to occupy = no court case, at most 2 disputes, at most 2 objections and compensation not pending. "
             "All other cases = Owners not ready to sell.")


def readiness_zone(r: dict) -> str:
    ready = (r["court_case"] == 0 and r["dispute_count"] <= 2 and r["objection_count"] <= 2
             and r["compensation_pending"] == 0)
    return READY if ready else NOT_READY


def blockers(r: dict) -> list[str]:
    out = []
    if r["court_case"]:
        out.append("Court case")
    if r["dispute_count"] > 2:
        out.append("Disputes > 2")
    if r["objection_count"] > 2:
        out.append("Objections > 2")
    if r["compensation_pending"]:
        out.append("Compensation pending")
    return out
