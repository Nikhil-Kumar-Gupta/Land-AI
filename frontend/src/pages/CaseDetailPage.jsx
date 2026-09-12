import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  IndianRupee,
  Layers,
  MapPinned,
  ShieldAlert,
  TrendingUp
} from "lucide-react";

import DashboardCard from "../components/DashboardCard";
import { DivergingBars, ShapChart } from "../components/charts";
import { DataState, PageHeader, RiskBadge, Section, SeverityBadge, SyntheticNotice } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { formatCr, formatDate, formatDays, formatPct, riskClass } from "../utils/format";

function CaseDetailPage() {
  const { caseId } = useParams();
  const { data, loading, error, reload } = useApi(`/cases/${caseId}`);

  return (
    <>
      <PageHeader
        eyebrow="RISK ANALYSIS"
        title={data ? `Case ${data.case.case_code}` : "Case risk analysis"}
        subtitle={data ? `${data.case.project_name} · ${data.case.district}, ${data.case.state} · ${data.case.priority} priority` : ""}
        actions={
          <>
            <Link className="secondary-button" to="/cases">
              <ArrowLeft size={16} /> All cases
            </Link>
            {data && (
              <Link className="secondary-button" to={`/map?district=${encodeURIComponent(data.case.district)}`}>
                <MapPinned size={16} /> District map
              </Link>
            )}
            {data && (
              <Link className="primary-button" to={`/simulator?case=${data.case.id}`}>
                <FlaskConical size={16} /> Run What-If
              </Link>
            )}
          </>
        }
      />

      <DataState loading={loading} error={error} onRetry={reload}>
        {data && <CaseDetail d={data} />}
      </DataState>
    </>
  );
}

function CaseDetail({ d }) {
  const { case: c, prediction: p } = d;
  const cls = riskClass(p.risk_level);

  return (
    <>
      <section className="decision-banner">
        <div className="decision-left">
          <div className={`risk-circle ${cls}`}>
            <ShieldAlert size={26} />
            <strong>{p.risk_pct.toFixed(1)}%</strong>
            <span>risk</span>
          </div>
          <div>
            <div className="decision-label">MODEL DELAY RISK</div>
            <h2>{p.risk_level} risk</h2>
            <p>
              {p.risk_definition} · model {p.model_version} · scored {formatDate(p.scored_at)}
            </p>
          </div>
        </div>
        <div className="decision-metrics">
          <div>
            <span>Predicted extra delay</span>
            <strong>{formatDays(p.predicted_delay_days)}</strong>
          </div>
          <div>
            <span>Recorded (dataset)</span>
            <strong>{formatDays(c.recorded_additional_delay_days)}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{c.status}</strong>
          </div>
        </div>
      </section>

      <div className="kpi-grid">
        <DashboardCard icon={<Layers size={22} />} title="Stage Risk" value={d.stage_risk.level} description={`${d.stage_risk.stage}: ${formatPct(d.stage_risk.high_risk_share_pct)} high-risk vs ${formatPct(d.stage_risk.portfolio_high_risk_share_pct)} overall · this case ${formatDays(c.days_in_current_stage)} in stage (avg ${formatDays(d.stage_risk.avg_days_in_stage)})`} type="purple" />
        <DashboardCard icon={<MapPinned size={22} />} title="Land Zone" value={c.zone_label} description={c.blockers.length ? `Blockers: ${c.blockers.join(", ")}` : "No owner-readiness blockers"} type={c.zone === "ready" ? "green" : "red"} />
        <DashboardCard icon={<TrendingUp size={22} />} title="Top Delay Driver" value={c.top_delay_driver} description={`Top risk factor: ${c.top_risk_factor}`} type="orange" />
        <DashboardCard icon={<IndianRupee size={22} />} title="Cost Overrun" value={formatCr(c.cost_overrun)} description={`${formatPct(c.cost_overrun_pct)} over estimated cost (synthetic)`} type={c.cost_overrun_pct > 15 ? "red" : "green"} />
      </div>

      <div className="grid-2">
        <Section title="SHAP Explanation — Risk" subtitle={`Contribution of each factor to this case's risk, from a baseline of ${p.base_risk_pct}% (percentage points)`}>
          <ShapChart items={d.shap_risk} unit="pp" limit={10} />
        </Section>

        <Section title="Delay Drivers" subtitle={`Days each driver category adds to or removes from the predicted delay (baseline ${formatDays(p.base_delay_days)})`}>
          <DivergingBars data={d.delay_drivers.map(x => ({ label: x.category, value: x.days }))} unit=" d" labelWidth={170} />
        </Section>
      </div>

      <div className="grid-2">
        <Section title="Major Risk Factors" subtitle="Factors that increase this case's risk the most" icon={<AlertTriangle size={20} />}>
          {d.risk_factors.length === 0 ? (
            <p className="muted-text">No factor increases the risk above the baseline.</p>
          ) : (
            <div className="reason-list">
              {d.risk_factors.map((f, i) => (
                <div className="reason-item" key={f.feature}>
                  <div className="reason-number">{i + 1}</div>
                  <span>
                    <strong>{f.label}</strong> = {f.display_value} · {f.category} · +{(f.shap * 100).toFixed(1)} pp risk
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Recommended Actions" subtitle="Derived from the factors that drive this prediction" icon={<CheckCircle2 size={20} />}>
          <div className="recommendation-list">
            {d.recommendations.map(r => (
              <div className="recommendation-item" key={r}>
                <CheckCircle2 size={18} />
                <span>{r}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid-2">
        <Section title="Case Facts" subtitle="Model input factors from the dataset (* = missing in the file, filled with the dataset median)">
          <div className="snapshot-list fact-grid">
            {d.factors.map(f => (
              <div key={f.feature}>
                <span>{f.label}{f.imputed ? " *" : ""}</span>
                <strong>{f.display_value}</strong>
              </div>
            ))}
            <div>
              <span>Recorded 'delayed' flag</span>
              <strong>{c.delayed_recorded ? "Yes" : "No"}</strong>
            </div>
            <div>
              <span>Project category</span>
              <strong>{c.project_category}</strong>
            </div>
          </div>
        </Section>

        <Section title="Budget & Cost" subtitle="Compensation from the dataset; other figures are synthetic, derived at import">
          <div className="snapshot-list">
            <div><span>Compensation amount (dataset)</span><strong>{formatCr(c.compensation_amount)}</strong></div>
            <div><span>Estimated cost (synthetic)</span><strong>{formatCr(c.estimated_cost)}</strong></div>
            <div><span>Utilised to date (synthetic)</span><strong>{formatCr(c.utilized_amount)} ({formatPct(c.utilization_pct)})</strong></div>
            <div><span>Remaining budget</span><strong>{formatCr(c.remaining_budget)}</strong></div>
            <div><span>Actual / revised cost (synthetic)</span><strong>{formatCr(c.actual_cost)}</strong></div>
            <div>
              <span>Cost overrun</span>
              <strong className={c.cost_overrun_pct > 15 ? "text-danger" : ""}>
                {formatCr(c.cost_overrun)} ({formatPct(c.cost_overrun_pct)})
              </strong>
            </div>
          </div>

          <div className="section-title">Zone rule</div>
          <p className="muted-text">{d.zone_rule}</p>

          {d.alerts.length > 0 && (
            <>
              <div className="section-title">Alerts for this case</div>
              <div className="alert-list">
                {d.alerts.map(a => (
                  <div className="alert-item" key={a.id}>
                    <SeverityBadge severity={a.severity} />
                    <div className="alert-item-body">
                      <strong>{a.title}</strong>
                      <p>{a.message}</p>
                      {a.is_acknowledged && <span className="chip">Acknowledged</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>
      </div>

      <Section title="SHAP Explanation — Predicted Delay" subtitle={`Contribution of each factor to the predicted additional delay in days (baseline ${formatDays(p.base_delay_days)})`}>
        <ShapChart items={d.shap_delay} unit="days" limit={10} />
      </Section>

      <div className="chips" style={{ marginBottom: 16 }}>
        <RiskBadge level={p.risk_level} pct={p.risk_pct} />
        <span className="chip">{c.project_type}</span>
        <span className="chip">{c.acquisition_stage}</span>
        <span className="chip">{c.land_area_acres} acres</span>
      </div>

      <SyntheticNotice />
    </>
  );
}

export default CaseDetailPage;
