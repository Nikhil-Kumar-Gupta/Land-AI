import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, FlaskConical, RotateCcw, Search } from "lucide-react";

import { api } from "../api/client";
import { ShapChart } from "../components/charts";
import { DataState, EmptyState, ErrorState, PageHeader, RiskBadge, Section } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { formatDays, formatSigned } from "../utils/format";

function CasePicker({ onPick }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return undefined;
    }
    const t = setTimeout(() => {
      api(`/cases?search=${encodeURIComponent(q.trim())}&page_size=8`)
        .then(d => setResults(d.items))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="case-picker toolbar" style={{ marginBottom: 0 }}>
      <div className="search-input" style={{ flex: 1 }}>
        <Search size={16} />
        <input
          value={q}
          onChange={e => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search another case by ID, state, district or project"
          aria-label="Search case"
        />
      </div>
      {open && results.length > 0 && (
        <div className="case-picker-results">
          {results.map(c => (
            <button
              key={c.id}
              onMouseDown={() => {
                onPick(c.id);
                setQ("");
                setOpen(false);
              }}
            >
              <span>
                <strong>{c.case_code}</strong> · {c.district}, {c.state}
              </span>
              <RiskBadge level={c.risk_level} pct={c.risk_pct} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FactorInput({ f, value, original, displayOriginal, stages, onChange }) {
  const changed = Number(value) !== Number(original);
  const label = (
    <label htmlFor={f.name}>
      {f.label} <em>{changed ? `was ${displayOriginal}` : "unchanged"}</em>
    </label>
  );
  if (f.kind === "category" || f.kind === "flag") {
    const options = f.kind === "flag" ? ["No", "Yes"] : stages;
    return (
      <div className={`sim-factor ${changed ? "changed" : ""}`}>
        {label}
        <select id={f.name} value={value ?? 0} onChange={e => onChange(Number(e.target.value))}>
          {options.map((s, i) => <option key={s} value={i}>{s}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className={`sim-factor ${changed ? "changed" : ""}`}>
      {label}
      <input type="range" min={f.min} max={f.max} step={f.step} value={value ?? f.min} onChange={e => onChange(Number(e.target.value))} aria-label={f.label} />
      <input
        id={f.name}
        type="number"
        min={f.min}
        max={f.max}
        step={f.step}
        value={value ?? ""}
        onChange={e => onChange(e.target.value === "" ? f.min : Math.min(f.max, Math.max(f.min, Number(e.target.value))))}
      />
    </div>
  );
}

function SimulatorPage() {
  const [params, setParams] = useSearchParams();
  const caseId = params.get("case");

  const meta = useApi("/simulator/features");
  const top = useApi(caseId ? null : "/priority?limit=1");
  const detail = useApi(caseId ? `/cases/${caseId}` : null);

  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  useEffect(() => {
    if (!caseId && top.data?.items?.[0]) setParams({ case: String(top.data.items[0].id) }, { replace: true });
  }, [caseId, top.data, setParams]);

  const original = detail.data ? Object.fromEntries(detail.data.factors.map(f => [f.feature, f.value])) : {};
  const originalDisplay = detail.data ? Object.fromEntries(detail.data.factors.map(f => [f.feature, f.display_value])) : {};

  useEffect(() => {
    if (detail.data) {
      setValues(Object.fromEntries(detail.data.factors.map(f => [f.feature, f.value])));
      setResult(null);
      setRunError("");
    }
  }, [detail.data]);

  const editable = meta.data?.features.filter(f => f.editable) || [];
  const groups = [...new Set(editable.map(f => f.category))];
  const changes = Object.fromEntries(editable.filter(f => Number(values[f.name]) !== Number(original[f.name])).map(f => [f.name, Number(values[f.name])]));

  async function run() {
    try {
      setRunning(true);
      setRunError("");
      setResult(await api(`/simulator/${caseId}`, { method: "POST", body: { changes } }));
    } catch (err) {
      setRunError(err.message);
    } finally {
      setRunning(false);
    }
  }

  const c = detail.data?.case;
  const nChanges = Object.keys(changes).length;

  return (
    <>
      <PageHeader
        eyebrow="WHAT-IF SIMULATOR"
        title="What-If Risk Simulator"
        subtitle="Adjust acquisition factors and re-run the trained model to see how risk, predicted delay and land zone would change. Stored predictions are not modified."
      />

      <Section>
        <div className="toolbar" style={{ alignItems: "center", marginBottom: 0 }}>
          {c ? (
            <div style={{ flex: "1 1 280px" }}>
              <div className="cell-main" style={{ fontSize: 15 }}>
                <Link to={`/cases/${c.id}`}>{c.case_code}</Link> · {c.project_name}
              </div>
              <div className="cell-sub">
                {c.district}, {c.state} · {c.acquisition_stage} · {c.zone_label} · current risk <RiskBadge level={c.risk_level} pct={c.risk_pct} />
              </div>
            </div>
          ) : (
            <div style={{ flex: "1 1 280px" }} className="text-muted">Select a case to simulate.</div>
          )}
          <CasePicker onPick={id => setParams({ case: String(id) })} />
        </div>
      </Section>

      <DataState loading={detail.loading || meta.loading || (!caseId && top.loading)} error={detail.error || meta.error || top.error} onRetry={() => { detail.reload(); meta.reload(); }}>
        {detail.data && meta.data && (
          <div className="sim-layout">
            <Section
              title="Acquisition factors"
              subtitle="Adjustable model inputs for this case (district history and project profile are fixed)"
              actions={
                <button className="secondary-button small" onClick={() => { setValues(original); setResult(null); }} disabled={!nChanges}>
                  <RotateCcw size={14} /> Reset
                </button>
              }
            >
              {groups.map(g => (
                <div key={g}>
                  <div className="section-title">{g}</div>
                  {editable.filter(f => f.category === g).map(f => (
                    <FactorInput
                      key={f.name}
                      f={f}
                      value={values[f.name]}
                      original={original[f.name]}
                      displayOriginal={originalDisplay[f.name]}
                      stages={meta.data.stages}
                      onChange={v => setValues(prev => ({ ...prev, [f.name]: v }))}
                    />
                  ))}
                </div>
              ))}
              <button className="primary-button" style={{ width: "100%", marginTop: 16 }} onClick={run} disabled={running}>
                <FlaskConical size={16} /> {running ? "Running model…" : `Run simulation (${nChanges} change${nChanges === 1 ? "" : "s"})`}
              </button>
            </Section>

            <Section title="Simulation result" subtitle="Computed by the same trained model and SHAP explainer used for stored predictions">
              {runError && <ErrorState message={runError} />}
              {!result && !runError && <EmptyState title="No simulation yet" message="Change one or more factors and run the simulation." />}
              {result && (
                <>
                  <div className="compare-grid">
                    <div className="compare-card">
                      <span>Original risk</span>
                      <strong>{result.original.risk_pct.toFixed(1)}%</strong>
                      <RiskBadge level={result.original.risk_level} />
                    </div>
                    <div className="compare-card">
                      <span>Simulated risk</span>
                      <strong>{result.simulated.risk_pct.toFixed(1)}%</strong>
                      <RiskBadge level={result.simulated.risk_level} />
                    </div>
                    <div className="compare-card">
                      <span>Risk change</span>
                      <strong className={result.risk_change_pp > 0 ? "text-danger" : result.risk_change_pp < 0 ? "text-success" : ""}>
                        {formatSigned(result.risk_change_pp, 1, " pp")}
                      </strong>
                      <small>{result.risk_change_pp < 0 ? "Lower risk" : result.risk_change_pp > 0 ? "Higher risk" : "No change"}</small>
                    </div>
                    <div className="compare-card">
                      <span>Original predicted delay</span>
                      <strong>{formatDays(result.original.predicted_delay_days)}</strong>
                    </div>
                    <div className="compare-card">
                      <span>Simulated predicted delay</span>
                      <strong>{formatDays(result.simulated.predicted_delay_days)}</strong>
                    </div>
                    <div className="compare-card">
                      <span>Delay change</span>
                      <strong className={result.delay_change_days > 0 ? "text-danger" : result.delay_change_days < 0 ? "text-success" : ""}>
                        {formatSigned(result.delay_change_days, 0, " d")}
                      </strong>
                    </div>
                  </div>

                  <div className="snapshot-list">
                    <div>
                      <span>Land zone</span>
                      <strong>{result.original.zone_label} <ArrowRight size={12} /> {result.simulated.zone_label}</strong>
                    </div>
                  </div>

                  <div className="section-title">Changed factors</div>
                  {result.changed_factors.length === 0 ? (
                    <p className="muted-text">No factors changed — the model reproduces the stored prediction.</p>
                  ) : (
                    <div className="snapshot-list">
                      {result.changed_factors.map(f => (
                        <div key={f.feature}>
                          <span>{f.label}</span>
                          <strong>{f.from} <ArrowRight size={12} /> {f.to}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="section-title">SHAP explanation of the simulated prediction</div>
                  <ShapChart items={result.simulated_shap_risk} unit="pp" limit={8} />

                  <div className="section-title">Recommended actions for the simulated scenario</div>
                  <div className="recommendation-list">
                    {result.simulated_recommendations.map(r => (
                      <div className="recommendation-item" key={r}>
                        <CheckCircle2 size={18} />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                  <p className="muted-text" style={{ marginTop: 12 }}>{result.note}</p>
                </>
              )}
            </Section>
          </div>
        )}
      </DataState>
    </>
  );
}

export default SimulatorPage;
