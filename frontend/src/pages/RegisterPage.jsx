import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BrainCircuit, Building2, RefreshCw } from "lucide-react";

import { api } from "../api/client";

const EMPTY = { business_id: "", name: "", email: "", password: "", confirm: "", gst_number: "", phone: "" };

function RegisterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const verifyEmail = location.state?.verifyEmail;

  const [step, setStep] = useState(verifyEmail ? "otp" : "form");
  const [form, setForm] = useState({ ...EMPTY, email: verifyEmail || "" });
  const [otp, setOtp] = useState("");
  const [demoOtp, setDemoOtp] = useState(location.state?.demoOtp || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(verifyEmail ? "Your email is not verified yet. Enter the OTP to complete registration." : "");

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  async function run(fn) {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    run(async () => {
      const { confirm, ...body } = form;
      const data = await api("/auth/register", { method: "POST", auth: false, body: { ...body, name: body.name || null } });
      setDemoOtp(data.demo_otp || "");
      setMessage(data.message);
      setStep("otp");
    });
  }

  function verify() {
    run(async () => {
      await api("/auth/register/verify", { method: "POST", auth: false, body: { email: form.email, otp } });
      navigate("/login", { replace: true, state: { notice: "Email verified. Sign in to continue.", email: form.email } });
    });
  }

  function resend() {
    run(async () => {
      const data = await api("/auth/resend-otp", { method: "POST", auth: false, body: { email: form.email, purpose: "register" } });
      setDemoOtp(data.demo_otp || "");
      setOtp("");
      setMessage("A new OTP has been generated.");
    });
  }

  return (
    <div className="login-page">
      <div className="login-background"></div>

      <div className="login-container wide">
        <Link to="/" className="back-link">
          <ArrowLeft size={15} /> Back to home
        </Link>

        <div className="login-brand">
          <div className="large-brand-icon">
            <BrainCircuit size={38} />
          </div>
          <div>
            <h1>LandAI</h1>
            <p>Acquisition Intelligence Platform</p>
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-header">
            <div className="security-icon">
              <Building2 size={25} />
            </div>
            <div>
              <h2>{step === "form" ? "Register your business" : "Verify your email"}</h2>
              <p>{step === "form" ? "Create an account for your project team" : `Enter the 6-digit OTP sent to ${form.email}`}</p>
            </div>
          </div>

          {step === "form" ? (
            <form onSubmit={submit} noValidate>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="bid">Business ID *</label>
                  <input id="bid" value={form.business_id} onChange={e => update("business_id", e.target.value)} placeholder="LAND003" required />
                </div>
                <div className="form-group">
                  <label htmlFor="bname">Business name</label>
                  <input id="bname" value={form.name} onChange={e => update("name", e.target.value)} placeholder="Company Pvt. Ltd." />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="email">Business email *</label>
                  <input id="email" type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="business@example.com" required />
                </div>
                <div className="form-group">
                  <label htmlFor="pw">Password *</label>
                  <input id="pw" type="password" value={form.password} onChange={e => update("password", e.target.value)} placeholder="Min. 8 chars, letters & numbers" autoComplete="new-password" required />
                </div>
                <div className="form-group">
                  <label htmlFor="pw2">Confirm password *</label>
                  <input id="pw2" type="password" value={form.confirm} onChange={e => update("confirm", e.target.value)} autoComplete="new-password" required />
                </div>
                <div className="form-group">
                  <label htmlFor="gst">GST number *</label>
                  <input id="gst" value={form.gst_number} maxLength={15} onChange={e => update("gst_number", e.target.value.toUpperCase())} placeholder="36ABCDE1234F1Z5" required />
                </div>
                <div className="form-group">
                  <label htmlFor="phone">Phone number *</label>
                  <input id="phone" value={form.phone} maxLength={13} onChange={e => update("phone", e.target.value.replace(/[^\d+]/g, ""))} placeholder="9876543210" required />
                </div>
              </div>
              <button className="primary-button" type="submit" disabled={loading || !form.business_id || !form.email || !form.password || !form.gst_number || !form.phone}>
                {loading ? "Submitting…" : "Register & send OTP"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          ) : (
            <>
              <div className="otp-box">
                <label htmlFor="otp">Enter OTP</label>
                <input id="otp" type="text" inputMode="numeric" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="000000" />
              </div>
              {demoOtp && (
                <div className="demo-otp">
                  <span>Demo OTP:</span>
                  <strong>{demoOtp}</strong>
                </div>
              )}
              <button className="primary-button" onClick={verify} disabled={loading || otp.length !== 6}>
                {loading ? "Verifying…" : "Verify email"}
                {!loading && <ArrowRight size={18} />}
              </button>
              <button className="secondary-button" onClick={resend} disabled={loading}>
                <RefreshCw size={16} /> Generate new OTP
              </button>
            </>
          )}

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message form-error">{error}</div>}

          <div className="login-footer">
            <span>Already registered?</span>
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
