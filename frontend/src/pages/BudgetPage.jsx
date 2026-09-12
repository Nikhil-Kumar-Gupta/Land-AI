import React from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { IndianRupee, PiggyBank, TrendingUp, Wallet } from "lucide-react";

import DashboardCard from "../components/DashboardCard";
import { COLORS, ChartBox, axisProps, barRadius, gridProps, tooltipProps } from "../components/charts";
import { DataState, PageHeader, RiskBadge, Section, SyntheticNotice } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { formatCr, formatPct } from "../utils/format";

function BudgetPage() {
  const { data, loading, error, reload } = useApi("/budget");

  return (
    <>
      <PageHeader
        eyebrow="FINANCIAL MONITORING"
        title="Budget & Cost Analysis"
        subtitle="Compensation comes from the dataset; sanctioned budget, utilisation and actual cost are synthetic values derived at import. Overrun is computed from the stored values."
      />

      <DataState loading={loading} error={error} onRetry={reload} empty={data?.projects.length === 0} emptyTitle="No financial data">
        {data && (
          <>
            <div className="kpi-grid">
              <DashboardCard icon={<Wallet size={22} />} title="Total Sanctioned Budget" value={formatCr(data.kpis.total_budget)} description={`${data.kpis.total_projects} projects`} type="blue" />
              <DashboardCard icon={<PiggyBank size={22} />} title="Utilised to Date" value={formatCr(data.kpis.utilized_amount)} description={`${formatPct(data.kpis.budget_utilization_pct)} of sanctioned budget`} type="green" />
              <DashboardCard icon={<IndianRupee size={22} />} title="Cost Overrun" value={formatCr(data.kpis.cost_overrun)} description="Revised/actual cost minus estimated cost" type="red" />
              <DashboardCard icon={<TrendingUp size={22} />} title="Overrun Rate" value={formatPct(data.kpis.cost_overrun_pct, 2)} description="Across all case estimates" type="orange" />
            </div>

            <div className="grid-2">
              <Section title="Estimated vs Actual Cost by Project" subtitle="₹ crore">
                <ChartBox height={310}>
                  <BarChart data={data.projects.map(p => ({ ...p, est: +(p.estimated_cost / 1e7).toFixed(1), act: +(p.actual_cost / 1e7).toFixed(1) }))} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="project_code" {...axisProps} interval={0} angle={-30} textAnchor="end" />
                    <YAxis {...axisProps} />
                    <Tooltip {...tooltipProps} labelFormatter={(_, p) => p?.[0]?.payload?.project_name} formatter={(v, n) => [`₹${v} Cr`, n]} />
                    <Legend iconType="square" iconSize={10} verticalAlign="top" />
                    <Bar name="Estimated cost" dataKey="est" fill={COLORS.series[0]} radius={barRadius} maxBarSize={20} />
                    <Bar name="Actual / revised cost" dataKey="act" fill={COLORS.series[1]} radius={barRadius} maxBarSize={20} />
                  </BarChart>
                </ChartBox>
              </Section>

              <Section title="Cost Overrun by District" subtitle="Overrun as % of estimated cost">
                <ChartBox height={310}>
                  <BarChart data={data.districts} margin={{ top: 8, right: 8, left: -6, bottom: 30 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="district" {...axisProps} interval={0} angle={-35} textAnchor="end" />
                    <YAxis {...axisProps} tickFormatter={v => `${v}%`} />
                    <Tooltip {...tooltipProps} formatter={(v, n, p) => [`${v}% (${formatCr(p.payload.cost_overrun)})`, "Cost overrun"]} />
                    <Bar dataKey="cost_overrun_pct" fill={COLORS.series[1]} radius={barRadius} maxBarSize={30} />
                  </BarChart>
                </ChartBox>
              </Section>
            </div>

            <Section title="Project Budget Register" subtitle="Budget utilisation and cost overrun per project">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th className="num">Sanctioned budget</th>
                      <th className="num">Estimated cost</th>
                      <th className="num">Utilised</th>
                      <th className="num">Remaining</th>
                      <th className="num">Utilisation</th>
                      <th className="num">Actual / revised</th>
                      <th className="num">Overrun</th>
                      <th className="num">Avg. risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projects.map(p => (
                      <tr key={p.project_id}>
                        <td>
                          <div className="cell-main">{p.project_name}</div>
                          <div className="cell-sub">{p.project_code} · {p.project_type}</div>
                        </td>
                        <td className="num">{formatCr(p.total_budget)}</td>
                        <td className="num">{formatCr(p.estimated_cost)}</td>
                        <td className="num">{formatCr(p.utilized_amount)}</td>
                        <td className="num">{formatCr(p.remaining_budget)}</td>
                        <td className="num">{formatPct(p.budget_utilization_pct)}</td>
                        <td className="num">{formatCr(p.actual_cost)}</td>
                        <td className={`num ${p.cost_overrun_pct > 15 ? "text-danger" : ""}`}>
                          {formatCr(p.cost_overrun)} ({formatPct(p.cost_overrun_pct)})
                        </td>
                        <td className="num">{formatPct(p.avg_risk_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Largest Cost Overruns" subtitle="Top 10 cases by absolute cost overrun">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Case</th>
                      <th>District</th>
                      <th className="num">Estimated</th>
                      <th className="num">Actual / revised</th>
                      <th className="num">Overrun</th>
                      <th>Budget issue</th>
                      <th>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_overrun_cases.map(c => (
                      <tr key={c.id}>
                        <td>
                          <Link className="cell-main" to={`/cases/${c.id}`}>{c.case_code}</Link>
                          <div className="cell-sub">{c.project_name}</div>
                        </td>
                        <td>{c.district}</td>
                        <td className="num">{formatCr(c.estimated_cost)}</td>
                        <td className="num">{formatCr(c.actual_cost)}</td>
                        <td className="num text-danger">{formatCr(c.cost_overrun)} ({formatPct(c.cost_overrun_pct)})</td>
                        <td>{c.budget_issue}</td>
                        <td><RiskBadge level={c.risk_level} pct={c.risk_pct} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <SyntheticNotice>{data.data_notice}</SyntheticNotice>
          </>
        )}
      </DataState>
    </>
  );
}

export default BudgetPage;
