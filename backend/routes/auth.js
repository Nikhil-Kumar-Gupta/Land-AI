const express = require("express");
const router = express.Router();

const {
  findBusinessByEmail
} = require("../models/Business");

const {
  generateOTP,
  saveOTP,
  verifyOTP
} = require("../utils/otp");

router.post("/request-otp", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Business email is required."
    });
  }

  const business = findBusinessByEmail(email);

  if (!business) {
    return res.status(404).json({
      success: false,
      message: "Business email is not registered."
    });
  }

  const otp = generateOTP();

  saveOTP(email, otp);

  console.log("---------------------------------");
  console.log(`OTP for ${email}: ${otp}`);
  console.log("---------------------------------");

  res.json({
    success: true,
    message: "OTP generated successfully.",
    demoOtp: otp
  });
});

router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required."
    });
  }

  const result = verifyOTP(email, otp);

  if (!result.valid) {
    return res.status(401).json({
      success: false,
      message: result.message
    });
  }

  const business = findBusinessByEmail(email);

  if (!business) {
    return res.status(404).json({
      success: false,
      message: "Business not found."
    });
  }

  res.json({
    success: true,
    message: "Login successful.",
    token: `demo-token-${Date.now()}`,
    business
  });
});

module.exports = router;