import React, { useState } from "react";
import { Link } from "react-router-dom";

import { DataState, PageHeader, RiskBadge, RiskMeter, Section } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { formatDays } from "../utils/format";

function PriorityPage() {
  const [includeMedium, setIncludeMedium] = useState(false);
  const [limit, setLimit] = useState(25);
  const { data, loading, error, reload } = useApi(`/priority?limit=${limit}&include_medium=${includeMedium}`);

  return (
    <>
      <PageHeader
        eyebrow="PRIORITY REVIEW"
        title="High-Risk Priority Review"
        subtitle="Cases ranked by the model's delay-risk probability, with the main risk driver and a recommended next action."
        actions={
          <>
            <div className="segmented" role="group" aria-label="Risk levels">
              <button className={!includeMedium ? "active" : ""} onClick={() => setIncludeMedium(false)}>High only</button>
              <button className={includeMedium ? "active" : ""} onClick={() => setIncludeMedium(true)}>High + Medium</button>
            </div>
            <select className="select" value={limit} onChange={e => setLimit(Number(e.target.value))} aria-label="Number of cases">
              {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>Top {n}</option>)}
            </select>
          </>
        }
      />

      <Section>
        <DataState loading={loading && !data} error={error} onRetry={reload} empty={data?.items.length === 0} emptyTitle="No high-risk cases" emptyMessage="The model currently rates no case in this band.">
          {data && (
            <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Project / case</th>
                    <th>District</th>
                    <th>Risk</th>
                    <th className="num">Predicted delay</th>
                    <th>Main risk driver</th>
                    <th>Land zone</th>
                    <th>Budget / cost issue</th>
                    <th>Recommended next action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(p => (
                    <tr key={p.id}>
                      <td><span className="rank">{p.priority_rank}</span></td>
                      <td>
                        <Link className="cell-main" to={`/cases/${p.id}`}>{p.case_code}</Link>
                        <div className="cell-sub">{p.project_name} · {p.acquisition_stage}</div>
                      </td>
                      <td>
                        <div>{p.district}</div>
                        <div className="cell-sub">{p.state}</div>
                      </td>
                      <td>
                        <div className="risk-cell">
                          <RiskMeter pct={p.risk_pct} level={p.risk_level} />
                          <RiskBadge level={p.risk_level} pct={p.risk_pct} />
                        </div>
                      </td>
                      <td className="num">{formatDays(p.predicted_delay_days)}</td>
                      <td>{p.main_risk_driver}</td>
                      <td><span className={`zone-pill ${p.zone}`}>{p.zone_label}</span></td>
                      <td className={p.budget_issue.startsWith("Cost overrun") ? "text-danger" : ""}>{p.budget_issue}</td>
                      <td className="cell-wrap">{p.next_action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </Section>
    </>
  );
}

export default PriorityPage;
