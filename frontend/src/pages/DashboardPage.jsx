import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import {
  Bell,
  Building2,
  ClipboardList,
  Clock3,
  IndianRupee,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Wallet
} from "lucide-react";

import DashboardCard from "../components/DashboardCard";
import DistrictMap from "../components/DistrictMap";
import { COLORS, ChartBox, DivergingBars, RiskLevelBars, axisProps, barRadius, gridProps, stageShort, tooltipProps } from "../components/charts";
import { DataState, PageHeader, RiskBadge, Section, SeverityBadge, SyntheticNotice } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { formatCr, formatDays, formatNumber, formatPct } from "../utils/format";

function KpiGrid({ k }) {
  const highShare = k.total_cases ? (k.high_risk_cases / k.total_cases) * 100 : 0;
  return (
    <div className="kpi-grid">
      <DashboardCard icon={<Building2 size={22} />} title="Total Projects" value={formatNumber(k.total_projects)} description={`Project type × state groups across ${k.total_districts} districts`} type="blue" />
      <DashboardCard icon={<ClipboardList size={22} />} title="Total Acquisition Cases" value={formatNumber(k.total_cases)} description={`${formatNumber(k.ready_cases)} in 'ready to occupy' zones`} type="slate" />
      <DashboardCard icon={<ShieldAlert size={22} />} title="High Risk Cases" value={formatNumber(k.high_risk_cases)} description={`${highShare.toFixed(1)}% of cases rated High by the model`} type="red" />
      <DashboardCard icon={<Clock3 size={22} />} title="Average Delay" value={formatDays(k.avg_delay_days)} description="Delay accumulated in previous stages" type="orange" />
      <DashboardCard icon={<TrendingUp size={22} />} title="Predicted Delay" value={formatDays(k.avg_predicted_delay_days)} description="Mean model-predicted additional delay" type="purple" />
      <DashboardCard icon={<Wallet size={22} />} title="Budget Utilization" value={formatPct(k.budget_utilization_pct)} description={`${formatCr(k.utilized_amount)} of ${formatCr(k.total_budget)} (synthetic)`} type="green" />
      <DashboardCard icon={<IndianRupee size={22} />} title="Cost Overrun" value={formatCr(k.cost_overrun)} description={`${formatPct(k.cost_overrun_pct, 2)} above estimate (synthetic)`} type="red" />
      <DashboardCard icon={<Bell size={22} />} title="Active Alerts" value={formatNumber(k.active_alerts)} description="Unacknowledged model & budget alerts" type="orange" />
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi("/dashboard");
  const gis = useApi("/gis/districts");

  const bands = data?.risk_info?.bands;

  return (
    <>
      <PageHeader
        eyebrow="EXECUTIVE OVERVIEW"
        title="Land Acquisition Risk Dashboard"
        subtitle="Portfolio-wide delay risk, drivers, land readiness and budget position from the trained prediction model."
        actions={
          <button className="secondary-button" onClick={reload} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />

      <DataState loading={loading} error={error} onRetry={reload} empty={data && data.kpis.total_cases === 0} emptyTitle="No cases yet" emptyMessage="Run the seed script to import and score the dataset.">
        {data && (
          <>
            <KpiGrid k={data.kpis} />

            <div className="grid-2">
              <Section title="Risk Overview" subtitle={`${data.risk_info.definition}. High ≥ ${bands.High * 100}%, Medium ≥ ${bands.Medium * 100}%.`}>
                <RiskLevelBars distribution={data.risk_distribution} />
              </Section>

              <Section title="Delay Drivers" subtitle="Average additional delay (days) the model attributes to each driver category, via SHAP">
                <DivergingBars
                  data={data.delay_drivers.map(d => ({ label: d.category, value: d.avg_added_delay_days }))}
                  unit=" d"
                  labelWidth={170}
                />
              </Section>
            </div>

            <div className="grid-2">
              <Section title="Risk Factors" subtitle="Global SHAP importance: mean absolute impact on risk (percentage points)">
                <ChartBox height={Math.max(200, data.risk_factors.length * 32 + 30)}>
                  <BarChart data={data.risk_factors} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
                    <CartesianGrid stroke={COLORS.grid} horizontal={false} />
                    <XAxis type="number" {...axisProps} tickFormatter={v => `${v} pp`} />
                    <YAxis type="category" dataKey="label" width={200} {...axisProps} tick={{ fill: "#52514e", fontSize: 11 }} />
                    <Tooltip {...tooltipProps} formatter={v => [`${v} pp`, "Mean |SHAP|"]} />
                    <Bar dataKey="mean_abs_impact_pp" fill={COLORS.series[0]} radius={3} maxBarSize={18} />
                  </BarChart>
                </ChartBox>
              </Section>

              <Section title="Stage-wise Delays" subtitle="Average delay from previous stages vs model-predicted additional delay">
                <ChartBox height={300}>
                  <BarChart data={data.stages.map(s => ({ ...s, short: stageShort(s.stage) }))} margin={{ top: 8, right: 8, left: -8, bottom: 16 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="short" {...axisProps} interval={0} angle={-25} textAnchor="end" />
                    <YAxis {...axisProps} tickFormatter={v => `${v}d`} />
                    <Tooltip {...tooltipProps} labelFormatter={(_, p) => p?.[0]?.payload?.stage} formatter={(v, n) => [formatDays(v), n]} />
                    <Legend iconType="square" iconSize={10} verticalAlign="top" />
                    <Bar name="Previous-stage delay" dataKey="avg_delay_days" fill={COLORS.series[0]} radius={barRadius} maxBarSize={24} />
                    <Bar name="Predicted additional delay" dataKey="avg_predicted_delay_days" fill={COLORS.series[1]} radius={barRadius} maxBarSize={24} />
                  </BarChart>
                </ChartBox>
              </Section>
            </div>

            <div className="grid-main">
              <Section title="District / Region Analysis" subtitle="Average model risk by district">
                <ChartBox height={Math.max(260, data.districts.length * 22 + 30)}>
                  <BarChart data={data.districts} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
                    <CartesianGrid stroke={COLORS.grid} horizontal={false} />
                    <XAxis type="number" domain={[0, "auto"]} {...axisProps} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="district" width={140} {...axisProps} tick={{ fill: "#52514e", fontSize: 11 }} />
                    <Tooltip
                      {...tooltipProps}
                      formatter={(v, n, p) => [`${v}% · ${p.payload.high_risk}/${p.payload.cases} high-risk cases`, `Avg. risk (${p.payload.state})`]}
                    />
                    <Bar dataKey="avg_risk_pct" fill={COLORS.series[0]} radius={3} maxBarSize={14} />
                  </BarChart>
                </ChartBox>
              </Section>

              <Section title="Recent Alerts" subtitle="Highest-severity unacknowledged alerts" actions={<Link className="link-button" to="/alerts">View all</Link>}>
                {data.recent_alerts.length === 0 ? (
                  <p className="muted-text">No active alerts.</p>
                ) : (
                  <div className="alert-list">
                    {data.recent_alerts.map(a => (
                      <div className="alert-item" key={a.id}>
                        <SeverityBadge severity={a.severity} />
                        <div className="alert-item-body">
                          <strong>{a.title}</strong>
                          <p>{a.message}</p>
                          <div className="alert-meta">
                            <span>{a.district}, {a.state}</span>
                            <Link className="link-button" to={`/cases/${a.case_id}`}>Open case</Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>

            <Section title="High Priority Reviews" subtitle="Cases ranked by model risk" actions={<Link className="link-button" to="/priority">Full priority list</Link>}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Case</th>
                      <th>District</th>
                      <th>Stage</th>
                      <th>Risk</th>
                      <th className="num">Predicted delay</th>
                      <th>Main risk driver</th>
                      <th>Budget</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.priority.map(p => (
                      <tr key={p.id}>
                        <td><span className="rank">{p.priority_rank}</span></td>
                        <td>
                          <div className="cell-main">{p.case_code}</div>
                          <div className="cell-sub">{p.project_name}</div>
                        </td>
                        <td>{p.district}</td>
                        <td>{p.acquisition_stage}</td>
                        <td><RiskBadge level={p.risk_level} pct={p.risk_pct} /></td>
                        <td className="num">{formatDays(p.predicted_delay_days)}</td>
                        <td>{p.main_risk_driver}</td>
                        <td>{p.budget_issue}</td>
                        <td><Link className="link-button" to={`/cases/${p.id}`}>Review</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <div className="grid-2">
              <Section title="Project Performance" subtitle="Model risk and delay by project group">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th className="num">Cases</th>
                        <th className="num">High risk</th>
                        <th className="num">Avg. risk</th>
                        <th className="num">Pred. delay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.projects.map(p => (
                        <tr key={p.project_id}>
                          <td>
                            <div className="cell-main">{p.project_name}</div>
                            <div className="cell-sub">{p.districts}</div>
                          </td>
                          <td className="num">{p.cases}</td>
                          <td className="num">{p.high_risk}</td>
                          <td className="num">{formatPct(p.avg_risk_pct)}</td>
                          <td className="num">{formatDays(p.avg_predicted_delay_days)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section title="Budget / Cost Analysis" subtitle="Budget utilisation and cost overrun by project (synthetic budget figures)" actions={<Link className="link-button" to="/budget">Details</Link>}>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th className="num">Budget</th>
                        <th className="num">Utilised</th>
                        <th className="num">Overrun</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.projects.map(p => (
                        <tr key={p.project_id}>
                          <td className="cell-main">{p.project_code}</td>
                          <td className="num">{formatCr(p.total_budget)}</td>
                          <td className="num">{formatPct(p.budget_utilization_pct)}</td>
                          <td className={`num ${p.cost_overrun_pct > 15 ? "text-danger" : ""}`}>
                            {formatCr(p.cost_overrun)} ({formatPct(p.cost_overrun_pct)})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>

            <Section title="GIS Land Readiness Map" subtitle="Ready-to-occupy vs not-ready zones per district. Click a district to open it on the full map." actions={<Link className="link-button" to="/map">Open full map</Link>}>
              <DataState loading={gis.loading} error={gis.error} onRetry={gis.reload} empty={gis.data?.items.length === 0}>
                {gis.data && (
                  <DistrictMap districts={gis.data.items} height={420} onSelect={d => navigate(`/map?district=${encodeURIComponent(d.district)}`)} />
                )}
              </DataState>
            </Section>

            <SyntheticNotice />
          </>
        )}
      </DataState>
    </>
  );
}

export default DashboardPage;
