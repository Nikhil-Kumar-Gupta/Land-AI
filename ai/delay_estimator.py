def estimate_delay(
    risk_score,
    disputes=0,
    pending_cases=0
):
    delay_months = round(
        1
        + risk_score / 14
        + disputes / 15
        + pending_cases / 30
    )

    return max(1, delay_months)


def estimate_financial_exposure(
    land_value,
    delay_months
):
    monthly_cost = land_value * 0.0035

    total_exposure = (
        monthly_cost * delay_months
    )

    return {
        "monthly_delay_cost": round(
            monthly_cost,
            2
        ),
        "total_delay_exposure": round(
            total_exposure,
            2
        )
    }


if __name__ == "__main__":

    risk_score = 65

    delay = estimate_delay(
        risk_score=risk_score,
        disputes=4,
        pending_cases=6
    )

    exposure = estimate_financial_exposure(
        land_value=50000000,
        delay_months=delay
    )

    print("Delay Estimation")
    print("----------------")
    print(f"Expected Delay: {delay} months")
    print(
        f"Monthly Cost: ₹{exposure['monthly_delay_cost']:,.0f}"
    )
    print(
        f"Total Exposure: ₹{exposure['total_delay_exposure']:,.0f}"
    )