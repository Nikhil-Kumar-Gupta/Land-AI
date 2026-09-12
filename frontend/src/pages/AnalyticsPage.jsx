import React from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { COLORS, ChartBox, DivergingBars, RiskLevelBars, axisProps, barRadius, gridProps, stageShort, tooltipProps } from "../components/charts";
import { DataState, PageHeader, Section, SyntheticNotice } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { formatDays, formatPct } from "../utils/format";

function SingleBars({ data, x, y, name, unit = "", height = 280, color = COLORS.series[0], angle = 0 }) {
  return (
    <ChartBox height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: angle ? 34 : 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={x} {...axisProps} interval={0} angle={angle} textAnchor={angle ? "end" : "middle"} />
        <YAxis {...axisProps} tickFormatter={v => `${v}${unit}`} />
        <Tooltip {...tooltipProps} formatter={v => [`${v}${unit}`, name]} />
        <Bar dataKey={y} name={name} fill={color} radius={barRadius} maxBarSize={32} />
      </BarChart>
    </ChartBox>
  );
}

function AnalyticsPage() {
  const { data, loading, error, reload } = useApi("/analytics");

  const delayDist = data
    ? data.delay_histogram.map((b, i) => ({ bin: b.bin, predicted: b.count, current: data.current_delay_histogram[i]?.count ?? 0 }))
    : [];
  const stages = data ? data.stages.map(s => ({ ...s, short: stageShort(s.stage) })) : [];

  return (
    <>
      <PageHeader eyebrow="ANALYTICS" title="Portfolio Analytics" subtitle="State, district, project and stage analysis computed from the imported dataset and the persisted model predictions." />

      <DataState loading={loading} error={error} onRetry={reload} empty={data?.projects.length === 0} emptyTitle="No analytics yet">
        {data && (
          <>
            <div className="grid-2">
              <Section title="Risk Distribution" subtitle={data.risk_info.definition}>
                <RiskLevelBars distribution={data.risk_distribution} height={260} />
              </Section>
              <Section title="Risk Score Histogram" subtitle="Number of cases per 10-point band of model risk">
                <SingleBars data={data.risk_histogram} x="bin" y="count" name="Cases" height={260} angle={-30} />
              </Section>
            </div>

            <div className="grid-2">
              <Section title="State-wise Risk" subtitle="Average model risk per state">
                <SingleBars data={data.states} x="state" y="avg_risk_pct" name="Avg. risk" unit="%" height={280} />
              </Section>
              <Section title="Delay Distribution" subtitle="Cases by delay from previous stages vs model-predicted additional delay">
                <ChartBox height={280}>
                  <BarChart data={delayDist} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="bin" {...axisProps} interval={0} />
                    <YAxis {...axisProps} allowDecimals={false} />
                    <Tooltip {...tooltipProps} />
                    <Legend iconType="square" iconSize={10} verticalAlign="top" />
                    <Bar name="Previous-stage delay" dataKey="current" fill={COLORS.series[0]} radius={barRadius} maxBarSize={22} />
                    <Bar name="Predicted additional delay" dataKey="predicted" fill={COLORS.series[1]} radius={barRadius} maxBarSize={22} />
                  </BarChart>
                </ChartBox>
              </Section>
            </div>

            <Section title="District-wise Risk" subtitle="Average model risk per district">
              <SingleBars data={data.districts} x="district" y="avg_risk_pct" name="Avg. risk" unit="%" height={320} angle={-40} />
            </Section>

            <div className="grid-2">
              <Section title="Project Comparison — Delay" subtitle="Average previous-stage vs predicted additional delay by project group">
                <ChartBox height={320}>
                  <BarChart data={data.projects} margin={{ top: 8, right: 8, left: -6, bottom: 24 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="project_code" {...axisProps} interval={0} angle={-45} textAnchor="end" />
                    <YAxis {...axisProps} tickFormatter={v => `${v}d`} />
                    <Tooltip {...tooltipProps} labelFormatter={(_, p) => p?.[0]?.payload?.project_name} formatter={(v, n) => [formatDays(v), n]} />
                    <Legend iconType="square" iconSize={10} verticalAlign="top" />
                    <Bar name="Previous-stage delay" dataKey="avg_delay_days" fill={COLORS.series[0]} radius={barRadius} maxBarSize={14} />
                    <Bar name="Predicted additional delay" dataKey="avg_predicted_delay_days" fill={COLORS.series[1]} radius={barRadius} maxBarSize={14} />
                  </BarChart>
                </ChartBox>
              </Section>
              <Section title="Stage-wise Delay" subtitle="Average days in the current stage for cases at each stage">
                <SingleBars data={stages} x="short" y="avg_days_in_stage" name="Avg. days in stage" unit="d" height={320} angle={-25} />
              </Section>
            </div>

            <div className="grid-2">
              <Section title="High-Risk Cases Across the Pipeline" subtitle="Share of cases rated High risk at each acquisition stage (the dataset has no dates, so this replaces a time trend)">
                <ChartBox height={290}>
                  <LineChart data={stages} margin={{ top: 8, right: 16, left: -6, bottom: 16 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="short" {...axisProps} interval={0} angle={-25} textAnchor="end" />
                    <YAxis {...axisProps} tickFormatter={v => `${v}%`} />
                    <Tooltip {...tooltipProps} labelFormatter={(_, p) => p?.[0]?.payload?.stage} formatter={(v, n, p) => [`${v}% (${p.payload.high_risk}/${p.payload.cases})`, "High-risk share"]} />
                    <Line name="High-risk share" dataKey="high_risk_share_pct" stroke={COLORS.series[1]} strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ChartBox>
              </Section>
              <Section title="Delay Drivers" subtitle="Average SHAP-attributed additional delay per driver category (days)">
                <DivergingBars data={data.delay_drivers.map(d => ({ label: d.category, value: d.avg_added_delay_days }))} unit=" d" labelWidth={170} />
              </Section>
            </div>

            <div className="grid-2">
              <Section title="Budget Utilisation by Project" subtitle="Amount utilised as a share of project budget (synthetic)">
                <SingleBars data={data.projects} x="project_code" y="budget_utilization_pct" name="Utilisation" unit="%" height={300} angle={-45} />
              </Section>
              <Section title="Cost Overrun by Project" subtitle="Revised/actual cost vs estimated cost (synthetic)">
                <SingleBars data={data.projects} x="project_code" y="cost_overrun_pct" name="Cost overrun" unit="%" height={300} angle={-45} color={COLORS.series[1]} />
              </Section>
            </div>

            <Section title="District Summary" subtitle="Table view of district-level analytics">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>District</th>
                      <th>State</th>
                      <th className="num">Cases</th>
                      <th className="num">High risk</th>
                      <th className="num">High-risk share</th>
                      <th className="num">Avg. risk</th>
                      <th className="num">Avg. prev.-stage delay</th>
                      <th className="num">Avg. predicted delay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.districts.map(d => (
                      <tr key={d.district}>
                        <td className="cell-main">{d.district}</td>
                        <td>{d.state}</td>
                        <td className="num">{d.cases}</td>
                        <td className="num">{d.high_risk}</td>
                        <td className="num">{formatPct(d.high_risk_share_pct)}</td>
                        <td className="num">{formatPct(d.avg_risk_pct)}</td>
                        <td className="num">{formatDays(d.avg_delay_days)}</td>
                        <td className="num">{formatDays(d.avg_predicted_delay_days)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <SyntheticNotice />
          </>
        )}
      </DataState>
    </>
  );
}

export default AnalyticsPage;
