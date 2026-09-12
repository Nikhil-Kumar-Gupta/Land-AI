def calculate_risk(
    disputes=0,
    pending_cases=0,
    over_price=0,
    govt_clearance=70
):
    risk = (
        disputes * 1.5
        + pending_cases * 0.8
        + over_price * 0.7
        + (100 - govt_clearance) * 0.5
    )

    risk = max(5, min(95, risk))

    if risk >= 70:
        status = "High Risk"
    elif risk >= 40:
        status = "Moderate Risk"
    else:
        status = "Low Risk"

    return {
        "risk_score": round(risk, 2),
        "status": status
    }


if __name__ == "__main__":

    result = calculate_risk(
        disputes=4,
        pending_cases=6,
        over_price=7,
        govt_clearance=65
    )

    print("Land Acquisition Risk")
    print("---------------------")
    print(f"Risk Score: {result['risk_score']}")
    print(f"Status: {result['status']}")