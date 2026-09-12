import React from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Layers,
  MapPinned,
  ShieldAlert,
  TrendingUp
} from "lucide-react";

import DashboardCard from "../components/DashboardCard";
import { DivergingBars, ShapChart } from "../components/charts";
import { formatDays, riskClass } from "../utils/format";

/** Result of an ad-hoc assessment (see SurveyForm). */
function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const analysis = location.state?.result;

  if (!analysis) {
    return <Navigate to="/assessment" replace />;
  }

  const input = analysis.input;
  const statusClass = riskClass(analysis.risk_level);
  const topDriver = analysis.delay_drivers.find(d => d.days > 0);

  return (
    <>
      <div className="analysis-heading">
        <div>
          <div className="eyebrow">AI DECISION SUPPORT</div>
          <h1>Acquisition Risk Analysis</h1>
          <p>
            {input.project_type} • {input.acquisition_stage} • {input.priority} priority • {input.land_area_acres} acres • {input.number_of_landowners} landowners
          </p>
        </div>
        <button className="secondary-button" onClick={() => navigate("/assessment")}>
          <ArrowLeft size={17} />
          Modify Survey
        </button>
      </div>

      <section className="decision-banner">
        <div className="decision-left">
          <div className={`risk-circle ${statusClass}`}>
            <ShieldAlert size={30} />
            <strong>{analysis.risk_pct.toFixed(1)}</strong>
            <span>/ 100</span>
          </div>
          <div>
            <div className="decision-label">OVERALL ACQUISITION RISK</div>
            <h2>{analysis.risk_level} Risk</h2>
            <p>{analysis.risk_definition} — trained model {analysis.model_version}.</p>
          </div>
        </div>
        <div className="decision-status">
          <span className={`status-pill ${statusClass}`}>{analysis.risk_level} Risk</span>
        </div>
      </section>

      <div className="dashboard-grid">
        <DashboardCard icon={<Clock3 size={22} />} title="Predicted Extra Delay" value={formatDays(analysis.predicted_delay_days)} description="Model-predicted additional delay" type="blue" />
        <DashboardCard icon={<TrendingUp size={22} />} title="Baseline Risk" value={`${analysis.base_risk_pct}%`} description="Average risk before case factors" type="purple" />
        <DashboardCard icon={<Layers size={22} />} title="Top Delay Driver" value={topDriver ? topDriver.category : "None"} description={topDriver ? `Adds ${topDriver.days} days` : "No driver adds delay"} type="orange" />
        <DashboardCard icon={<MapPinned size={22} />} title="Land Zone" value={analysis.zone_label} description="Owner-readiness rule applied to the inputs" type="green" />
      </div>

      <div className="analysis-grid">
        <section className="analysis-card">
          <div className="card-header">
            <div>
              <h2>SHAP Explanation</h2>
              <p>How each factor moves the risk from the {analysis.base_risk_pct}% baseline (percentage points).</p>
            </div>
            <AlertTriangle size={22} />
          </div>
          <ShapChart items={analysis.shap_risk} unit="pp" limit={10} />
        </section>

        <section className="analysis-card">
          <div className="card-header">
            <div>
              <h2>Delay Drivers</h2>
              <p>Days each driver category adds to the predicted delay (baseline {formatDays(analysis.base_delay_days)}).</p>
            </div>
          </div>
          <DivergingBars data={analysis.delay_drivers.map(d => ({ label: d.category, value: d.days }))} unit=" d" labelWidth={170} />
        </section>
      </div>

      <div className="analysis-grid">
        <section className="analysis-card">
          <div className="card-header">
            <div>
              <h2>Recommended Actions</h2>
              <p>Suggested actions to reduce acquisition time and cost.</p>
            </div>
            <CheckCircle2 size={22} />
          </div>
          <div className="recommendation-list">
            {analysis.recommendations.map(r => (
              <div className="recommendation-item" key={r}>
                <CheckCircle2 size={18} />
                <span>{r}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="analysis-card">
          <div className="card-header">
            <div>
              <h2>Decision Snapshot</h2>
              <p>Inputs used for this assessment.</p>
            </div>
          </div>
          <div className="snapshot-list">
            {analysis.shap_risk.map(i => (
              <div key={i.feature}>
                <span>{i.label}</span>
                <strong>{i.display_value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="prototype-disclaimer">
        <strong>Prototype Notice:</strong> {analysis.note} The model is trained on a SYNTHETIC dataset; government records
        and a model trained on real outcomes are required before real-world use.
      </div>
    </>
  );
}

export default AnalysisPage;
