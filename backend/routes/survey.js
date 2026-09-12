const express = require("express");
const router = express.Router();

const {
  createSurvey,
  getSurveys
} = require("../models/Survey");

router.post("/", (req, res) => {
  try {
    const survey = createSurvey(req.body);

    res.status(201).json({
      success: true,
      message: "Survey data saved successfully.",
      survey
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to save survey data."
    });
  }
});

router.get("/", (req, res) => {
  res.json({
    success: true,
    surveys: getSurveys()
  });
});

module.exports = router;