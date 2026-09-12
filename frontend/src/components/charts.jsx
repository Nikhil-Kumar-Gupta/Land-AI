import React from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Validated reference palette (dataviz skill): categorical slots in fixed order, reserved status colours.
export const COLORS = {
  series: ["#2a78d6", "#eb6834", "#1baf7a"],
  risk: { Low: "#0ca30c", Medium: "#fab219", High: "#d03b3b" },
  increase: "#d03b3b",
  decrease: "#2a78d6",
  grid: "#e1e0d9",
  axis: "#898781",
  baseline: "#c3c2b7"
};

const STAGE_ABBR = { "Ownership Verification": "Ownership" };
export const stageShort = stage => STAGE_ABBR[stage] || stage;

export const axisProps = {
  tick: { fill: COLORS.axis, fontSize: 11 },
  axisLine: { stroke: COLORS.baseline },
  tickLine: false
};

export const gridProps = { stroke: COLORS.grid, strokeDasharray: "0", vertical: false };

export const tooltipProps = {
  contentStyle: {
    borderRadius: 8,
    border: "1px solid #e5eaf1",
    boxShadow: "0 8px 24px rgba(16,42,67,0.08)",
    fontSize: 12,
    color: "#172033"
  },
  labelStyle: { fontWeight: 700, marginBottom: 4 },
  cursor: { fill: "rgba(16,42,67,0.04)" }
};

export const barRadius = [4, 4, 0, 0];

export function ChartBox({ height = 280, children }) {
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal diverging bars around zero: red increases, blue decreases. */
export function DivergingBars({ data, unit = "", labelWidth = 210, valueDigits = 1, height }) {
  const h = height || Math.max(160, data.length * 32 + 30);
  const fmt = v => `${v > 0 ? "+" : ""}${Number(v).toFixed(valueDigits)}${unit}`;
  return (
    <ChartBox height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={COLORS.grid} horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={v => `${v}${unit}`} />
        <YAxis type="category" dataKey="label" width={labelWidth} {...axisProps} tick={{ fill: "#52514e", fontSize: 11 }} />
        <Tooltip {...tooltipProps} formatter={v => [fmt(v), "Contribution"]} />
        <ReferenceLine x={0} stroke={COLORS.baseline} />
        <Bar dataKey="value" radius={3} maxBarSize={18} isAnimationActive={false}>
          {data.map(d => (
            <Cell key={d.label} fill={d.value >= 0 ? COLORS.increase : COLORS.decrease} />
          ))}
        </Bar>
      </BarChart>
    </ChartBox>
  );
}

/** SHAP contributions of one prediction. unit "pp" (risk probability points) or "days". */
export function ShapChart({ items, unit = "pp", limit = 10 }) {
  const data = (items || []).slice(0, limit).map(i => ({
    label: `${i.label} = ${i.display_value}`,
    value: unit === "pp" ? Number((i.shap * 100).toFixed(2)) : Number(i.shap.toFixed(1))
  }));
  return (
    <>
      <DivergingBars data={data} unit={unit === "pp" ? " pp" : " d"} labelWidth={250} />
      <div className="chart-legend">
        <span><i style={{ background: COLORS.increase }} /> Increases {unit === "pp" ? "risk" : "delay"}</span>
        <span><i style={{ background: COLORS.decrease }} /> Decreases {unit === "pp" ? "risk" : "delay"}</span>
      </div>
    </>
  );
}

export function RiskLevelBars({ distribution, height = 220 }) {
  return (
    <ChartBox height={height}>
      <BarChart data={distribution} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="level" {...axisProps} />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip {...tooltipProps} formatter={v => [v, "Cases"]} />
        <Bar dataKey="count" radius={barRadius} maxBarSize={56} label={{ position: "top", fill: "#52514e", fontSize: 12 }}>
          {distribution.map(d => (
            <Cell key={d.level} fill={COLORS.risk[d.level]} />
          ))}
        </Bar>
      </BarChart>
    </ChartBox>
  );
}
