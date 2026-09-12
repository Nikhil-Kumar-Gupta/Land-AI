import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck
} from "lucide-react";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTo = location.state?.from || "/dashboard";

  const [identifier, setIdentifier] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtp, setDemoOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const notice = location.state?.notice;

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function requestOTP(e) {
    e?.preventDefault();
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const data = await api("/auth/login", { method: "POST", auth: false, body: { identifier, password } });
      setEmail(data.email);
      setOtpSent(true);
      setOtp("");
      setDemoOtp(data.demo_otp || "");
      setMessage(data.message);
    } catch (err) {
      const detail = err.data?.detail;
      if (err.status === 403 && detail?.needs_verification) {
        navigate("/register", { state: { verifyEmail: detail.email, demoOtp: detail.demo_otp } });
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function resendOTP() {
    try {
      setLoading(true);
      setError("");
      const data = await api("/auth/resend-otp", { method: "POST", auth: false, body: { email, purpose: "login" } });
      setDemoOtp(data.demo_otp || "");
      setOtp("");
      setMessage("A new OTP has been generated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOTP(e) {
    e?.preventDefault();
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const data = await api("/auth/login/verify", { method: "POST", auth: false, body: { email, otp } });
      login(data.access_token, data.business);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">

      <div className="login-background"></div>

      <div className="login-container">

        <Link to="/" className="back-link">
          <ArrowLeft size={15} /> Back to home
        </Link>

        <div className="login-brand">

          <div className="large-brand-icon">
            <BrainCircuit size={38} />
          </div>

          <div>
            <h1>LandAI</h1>

            <p>
              Acquisition Intelligence Platform
            </p>
          </div>

        </div>

        <div className="login-card">

          <div className="login-card-header">

            <div className="security-icon">
              <ShieldCheck size={25} />
            </div>

            <div>
              <h2>
                Business Login
              </h2>

              <p>
                {otpSent ? `Step 2 of 2 · OTP sent to ${email}` : "Step 1 of 2 · Secure access for authorized project teams"}
              </p>
            </div>

          </div>

          {notice && !otpSent && <div className="info-banner">{notice}</div>}

          {!otpSent ? (

            <form onSubmit={requestOTP}>

              <div className="form-group">
                <label htmlFor="identifier">Business email or Business ID</label>
                <div className="input-wrapper">
                  <Mail size={18} />
                  <input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="business@example.com"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <Lock size={18} />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="primary-button"
                disabled={loading || !identifier || !password}
              >
                {loading ? "Verifying…" : "Continue"}
                {!loading && <ArrowRight size={18} />}
              </button>

            </form>

          ) : (

            <form onSubmit={verifyOTP}>

              <div className="otp-box">
                <label htmlFor="otp">Enter OTP</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  autoFocus
                />
              </div>

              {demoOtp && (
                <div className="demo-otp">
                  <span>Demo OTP:</span>
                  <strong>{demoOtp}</strong>
                </div>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying…" : "Verify & Continue"}
                {!loading && <ArrowRight size={18} />}
              </button>

              <button type="button" className="secondary-button" onClick={resendOTP} disabled={loading}>
                <RefreshCw size={16} />
                Generate New OTP
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setOtpSent(false);
                  setMessage("");
                  setError("");
                }}
                disabled={loading}
              >
                <ArrowLeft size={16} /> Use a different account
              </button>

            </form>

          )}

          {message && (
            <div className="success-message">
              {message}
            </div>
          )}

          {error && (
            <div className="error-message form-error">
              {error}
            </div>
          )}

          <div className="login-footer">
            <span>🔒 Password + OTP · OTP valid for 5 minutes</span>
            <Link to="/register">Register</Link>
          </div>

        </div>

        <p className="prototype-label">
          LandAI Prototype • AI-driven land
          acquisition decision support
        </p>

      </div>

    </div>
  );
}

export default LoginPage;
