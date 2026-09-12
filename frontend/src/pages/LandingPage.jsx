import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  BrainCircuit,
  Clock3,
  Database,
  IndianRupee,
  ListOrdered,
  Map,
  ShieldAlert,
  Sparkles,
  Workflow
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

const FEATURES = [
  {
    icon: ShieldAlert,
    title: "Predictive risk monitoring",
    text: "A trained gradient-boosted model estimates the probability that each acquisition case faces a significant additional delay."
  },
  {
    icon: Clock3,
    title: "Early delay detection",
    text: "Predicted delay in days for every case, compared with the delay observed so far, to flag problems before they escalate."
  },
  {
    icon: Map,
    title: "GIS visualisation",
    text: "District map with 'ready to occupy' and 'owners not ready to sell' land zones and builder-relevant district profiles."
  },
  {
    icon: IndianRupee,
    title: "Cost & budget monitoring",
    text: "Sanctioned budget, utilisation, compensation and cost overrun tracked per case, project and district."
  },
  {
    icon: ListOrdered,
    title: "Priority case review",
    text: "High-risk cases ranked by model risk, with the main risk driver and a recommended next action."
  },
  {
    icon: Sparkles,
    title: "Explainable decisions",
    text: "SHAP explanations show which factors push each prediction up or down, so decisions stay transparent."
  }
];

const PIPELINE = ["Case data", "Feature engineering", "ML model", "Risk & delay prediction", "SHAP explanation", "Dashboard"];

function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="brand">
          <div className="brand-icon">
            <BrainCircuit size={23} />
          </div>
          <div>
            <div className="brand-name">LandAI</div>
            <div className="brand-subtitle">Acquisition Intelligence</div>
          </div>
        </div>
        <div className="landing-actions">
          {isAuthenticated ? (
            <Link className="primary-button" to="/dashboard">
              Open Dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link className="secondary-button" to="/register">
                Register
              </Link>
              <Link className="primary-button" to="/login">
                Sign In <ArrowRight size={16} />
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="landing-hero">
        <div className="eyebrow">DECISION SUPPORT FOR INFRASTRUCTURE LAND ACQUISITION</div>
        <h1>Predictive Analytics System for Early Detection of Land Acquisition Delays</h1>
        <p>
          LandAI brings acquisition cases, approvals, disputes, compensation and budgets into one place, and uses a
          trained machine-learning model to predict which cases are likely to be delayed — and why.
        </p>
        <div className="landing-cta">
          <Link className="primary-button large" to={isAuthenticated ? "/dashboard" : "/login"}>
            {isAuthenticated ? "Go to dashboard" : "Sign in to the platform"} <ArrowRight size={18} />
          </Link>
          {!isAuthenticated && (
            <Link className="secondary-button" to="/register">
              Register your organisation
            </Link>
          )}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-grid">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div className="landing-card" key={title}>
              <div className="section-icon">
                <Icon size={20} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-pipeline-card">
          <div className="card-header">
            <div>
              <h2>How predictions are produced</h2>
              <p>Every risk score shown in the platform comes from the trained model — never from manual entry or text generation.</p>
            </div>
            <Workflow size={22} />
          </div>
          <div className="pipeline">
            {PIPELINE.map((step, i) => (
              <React.Fragment key={step}>
                <div className="pipeline-step">
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {step}
                </div>
                {i < PIPELINE.length - 1 && <ArrowRight size={16} className="pipeline-arrow" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-two">
        <div className="landing-card">
          <div className="section-icon">
            <BellRing size={20} />
          </div>
          <h3>Alerts that follow the model</h3>
          <p>Alerts are raised automatically for cases the model rates High risk, for cost overruns above 15%, and for stage delays beyond 30 days.</p>
        </div>
        <div className="landing-card">
          <div className="section-icon">
            <Database size={20} />
          </div>
          <h3>Prototype data</h3>
          <p>
            This prototype runs on a <strong>synthetic</strong> land-acquisition dataset (3,000 cases across five states), with
            derived synthetic budget figures. It is not real government data.
          </p>
        </div>
      </section>

      <footer className="landing-footer">LandAI Prototype · AI-driven land acquisition decision support</footer>
    </div>
  );
}

export default LandingPage;
