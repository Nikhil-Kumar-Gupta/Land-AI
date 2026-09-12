const otpStore = new Map();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function saveOTP(email, otp) {
  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  });
}

function verifyOTP(email, otp) {
  const record = otpStore.get(email.toLowerCase());

  if (!record) {
    return {
      valid: false,
      message: "OTP not found. Please request a new OTP."
    };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email.toLowerCase());

    return {
      valid: false,
      message: "OTP has expired. Please request a new OTP."
    };
  }

  if (record.otp !== otp) {
    return {
      valid: false,
      message: "Invalid OTP."
    };
  }

  otpStore.delete(email.toLowerCase());

  return {
    valid: true
  };
}

module.exports = {
  generateOTP,
  saveOTP,
  verifyOTP
};