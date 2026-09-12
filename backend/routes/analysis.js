const express = require("express");
const router = express.Router();

const {
  findByPincode
} = require("../models/LandRecord");

function calculateAnalysis(data) {
  const disputes = Number(data.disputes || 0);
  const pendingCases = Number(data.pendingCases || 0);
  const overPrice = Number(data.overPrice || 0);
  const govtClearance = Number(data.govtClearance || 70);
  const landValue = Number(data.landValue || 0);

  let riskScore =
    disputes * 1.5 +
    pendingCases * 0.8 +
    overPrice * 0.7 +
    (100 - govtClearance) * 0.5;

  riskScore = Math.max(5, Math.min(95, riskScore));

  let status;

  if (riskScore >= 70) {
    status = "High Risk";
  } else if (riskScore >= 40) {
    status = "Moderate Risk";
  } else {
    status = "Low Risk";
  }

  const delayMonths = Math.max(
    1,
    Math.round(
      1 +
      riskScore / 14 +
      disputes / 15 +
      pendingCases / 30
    )
  );

  const monthlyDelayCost = landValue * 0.0035;

  const totalDelayExposure =
    monthlyDelayCost * delayMonths;

  const reasons = [];

  if (disputes > 2) {
    reasons.push("High number of land ownership disputes");
  }

  if (pendingCases > 3) {
    reasons.push("Pending legal or administrative cases");
  }

  if (overPrice > 5) {
    reasons.push("Landowners demanding above-market prices");
  }

  if (govtClearance < 70) {
    reasons.push("Low government clearance confidence");
  }

  if (reasons.length === 0) {
    reasons.push("No major delay driver detected");
  }

  const recommendations = [];

  if (disputes > 2) {
    recommendations.push(
      "Prioritize legally clear parcels and verify ownership documents before negotiation."
    );
  }

  if (pendingCases > 3) {
    recommendations.push(
      "Start legal verification early and maintain a dedicated case-resolution workflow."
    );
  }

  if (overPrice > 5) {
    recommendations.push(
      "Compare nearby market rates and negotiate using valuation evidence."
    );
  }

  if (govtClearance < 70) {
    recommendations.push(
      "Obtain additional government records and clearance verification before acquisition."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Proceed with acquisition while continuously monitoring survey and government records."
    );
  }

  return {
    riskScore: Number(riskScore.toFixed(1)),
    status,
    expectedDelayMonths: delayMonths,
    monthlyDelayCost: Number(monthlyDelayCost.toFixed(2)),
    totalDelayExposure: Number(totalDelayExposure.toFixed(2)),
    govtClearance,
    reasons,
    recommendations
  };
}

router.post("/", (req, res) => {
  try {
    const analysis = calculateAnalysis(req.body);

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Analysis failed."
    });
  }
});

router.get("/pincode/:pincode", (req, res) => {
  const records = findByPincode(req.params.pincode);

  res.json({
    success: true,
    count: records.length,
    records
  });
});

module.exports = router;