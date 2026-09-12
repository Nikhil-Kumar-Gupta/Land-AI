import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

import { api } from "../api/client";
import { DataState, PageHeader, Section, SeverityBadge } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { formatDate, formatPct } from "../utils/format";

const TYPES = { HIGH_RISK: "High model risk", COST_OVERRUN: "Cost overrun", DELAY: "Delay threshold" };

function AlertsPage() {
  const [status, setStatus] = useState("active");
  const [severity, setSeverity] = useState("");
  const [type, setType] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");

  const qs = new URLSearchParams({ status });
  if (severity) qs.set("severity", severity);
  if (type) qs.set("alert_type", type);
  const { data, loading, error, reload } = useApi(`/alerts?${qs.toString()}`);

  async function acknowledge(id) {
    try {
      setBusyId(id);
      setActionError("");
      await api(`/alerts/${id}/acknowledge`, { method: "POST" });
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="MONITORING"
        title="Alerts"
        subtitle="Generated automatically from model predictions (High risk), stored costs (overrun > 15%, synthetic budget) and previous-stage delays (> 30 days)."
      />

      <Section>
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Alert status">
            {["active", "acknowledged", "all"].map(s => (
              <button key={s} className={status === s ? "active" : ""} onClick={() => setStatus(s)}>
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <select value={severity} onChange={e => setSeverity(e.target.value)} aria-label="Severity">
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
          <select value={type} onChange={e => setType(e.target.value)} aria-label="Alert type">
            <option value="">All types</option>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {data && (
            <div className="chips" style={{ alignItems: "center" }}>
              <span className="chip">{data.count} alerts</span>
              <span className="chip">{data.by_severity.critical} critical</span>
              <span className="chip">{data.by_severity.high} high</span>
              <span className="chip">{data.by_severity.medium} medium</span>
            </div>
          )}
        </div>

        {actionError && <div className="error-message" style={{ marginBottom: 12 }}>{actionError}</div>}

        <DataState loading={loading && !data} error={error} onRetry={reload} empty={data?.items.length === 0} emptyTitle="No alerts" emptyMessage="Nothing matches the selected filters.">
          {data && (
            <div className="alert-list" style={{ opacity: loading ? 0.6 : 1 }}>
              {data.items.map(a => (
                <div className="alert-item" key={a.id}>
                  <SeverityBadge severity={a.severity} />
                  <div className="alert-item-body">
                    <strong>{a.title}</strong>
                    <p>{a.message}</p>
                    <div className="alert-meta">
                      <span>{TYPES[a.type] || a.type}</span>
                      <span>{a.project_name}</span>
                      <span>{a.district}</span>
                      {a.risk_pct !== null && <span>Model risk {formatPct(a.risk_pct)}</span>}
                      <span>Raised {formatDate(a.created_at)}</span>
                      <Link className="link-button" to={`/cases/${a.case_id}`}>Open case</Link>
                    </div>
                  </div>
                  {a.is_acknowledged ? (
                    <span className="chip">Acknowledged</span>
                  ) : (
                    <button className="secondary-button small" onClick={() => acknowledge(a.id)} disabled={busyId === a.id}>
                      <Check size={14} /> {busyId === a.id ? "Saving…" : "Acknowledge"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DataState>
      </Section>
    </>
  );
}

export default AlertsPage;
