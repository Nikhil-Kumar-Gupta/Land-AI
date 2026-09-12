import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Search, X } from "lucide-react";

import { DataState, PageHeader, Pagination, RiskBadge, RiskMeter, Section } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { formatCr, formatDays, formatPct } from "../utils/format";

const FILTER_KEYS = ["search", "state", "district", "project_id", "stage", "status", "zone", "risk_level"];

const COLUMNS = [
  { key: "case_code", label: "Case", sort: "case_code" },
  { key: "project", label: "Project", sort: "project" },
  { key: "district", label: "District", sort: "district" },
  { key: "stage", label: "Stage", sort: "stage" },
  { key: "zone", label: "Zone" },
  { key: "status", label: "Status" },
  { key: "current_delay", label: "Prev.-stage delay", sort: "current_delay", num: true },
  { key: "predicted_delay", label: "Predicted delay", sort: "predicted_delay", num: true },
  { key: "risk", label: "Risk", sort: "risk" },
  { key: "cost", label: "Est. cost", num: true },
  { key: "cost_overrun", label: "Cost overrun", sort: "cost_overrun", num: true }
];

function CasesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get("search") || "");

  const sort = params.get("sort") || "risk";
  const order = params.get("order") || "desc";

  function setParam(updates) {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in updates)) next.delete("page");
    setParams(next, { replace: true });
  }

  useEffect(() => {
    if (searchInput === (params.get("search") || "")) return undefined;
    const t = setTimeout(() => setParam({ search: searchInput.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const query = new URLSearchParams(params);
  query.set("page_size", "20");
  const { data, loading, error, reload } = useApi(`/cases?${query.toString()}`);
  const filters = useApi("/cases/filters");
  const hasFilters = FILTER_KEYS.some(k => params.get(k));

  function toggleSort(col) {
    if (!col.sort) return;
    setParam({ sort: col.sort, order: sort === col.sort && order === "desc" ? "asc" : "desc" });
  }

  const f = filters.data;

  return (
    <>
      <PageHeader
        eyebrow="CASE REGISTER"
        title="Acquisition Cases"
        subtitle="All cases from the dataset with their current model prediction. Sorted by risk by default so high-risk cases come first."
      />

      <Section>
        <div className="toolbar">
          <div className="search-input">
            <Search size={16} />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search case ID, state, district or project" aria-label="Search cases" />
          </div>
          <select value={params.get("state") || ""} onChange={e => setParam({ state: e.target.value })} aria-label="State">
            <option value="">All states</option>
            {f?.states.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={params.get("district") || ""} onChange={e => setParam({ district: e.target.value })} aria-label="District">
            <option value="">All districts</option>
            {f?.districts.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={params.get("project_id") || ""} onChange={e => setParam({ project_id: e.target.value })} aria-label="Project">
            <option value="">All projects</option>
            {f?.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={params.get("stage") || ""} onChange={e => setParam({ stage: e.target.value })} aria-label="Stage">
            <option value="">All stages</option>
            {f?.stages.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={params.get("zone") || ""} onChange={e => setParam({ zone: e.target.value })} aria-label="Zone">
            <option value="">All zones</option>
            {f?.zones.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
          </select>
          <select value={params.get("status") || ""} onChange={e => setParam({ status: e.target.value })} aria-label="Status">
            <option value="">All statuses</option>
            {f?.statuses.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={params.get("risk_level") || ""} onChange={e => setParam({ risk_level: e.target.value })} aria-label="Risk level">
            <option value="">All risk levels</option>
            {f?.risk_levels.map(s => <option key={s}>{s}</option>)}
          </select>
          {hasFilters && (
            <button
              className="secondary-button small"
              onClick={() => {
                setSearchInput("");
                setParams(new URLSearchParams(sort !== "risk" || order !== "desc" ? { sort, order } : {}), { replace: true });
              }}
            >
              <X size={14} /> Clear filters
            </button>
          )}
        </div>

        <DataState loading={loading && !data} error={error} onRetry={reload} empty={data?.items.length === 0} emptyTitle="No matching cases" emptyMessage="Try changing the search or filters.">
          {data && (
            <>
              <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {COLUMNS.map(col => (
                        <th
                          key={col.key}
                          className={`${col.num ? "num" : ""} ${col.sort ? "sortable" : ""}`}
                          onClick={() => toggleSort(col)}
                          aria-sort={sort === col.sort ? (order === "asc" ? "ascending" : "descending") : undefined}
                        >
                          {col.label}
                          {sort === col.sort && (order === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map(c => (
                      <tr key={c.id} className="clickable" onClick={() => navigate(`/cases/${c.id}`)}>
                        <td>
                          <Link className="cell-main" to={`/cases/${c.id}`} onClick={e => e.stopPropagation()}>{c.case_code}</Link>
                          <div className="cell-sub">{c.priority} priority</div>
                        </td>
                        <td>
                          <div>{c.project_name}</div>
                          <div className="cell-sub">{c.project_category}</div>
                        </td>
                        <td>
                          <div>{c.district}</div>
                          <div className="cell-sub">{c.state}</div>
                        </td>
                        <td>{c.acquisition_stage}</td>
                        <td><span className={`zone-pill ${c.zone}`}>{c.zone_label}</span></td>
                        <td>{c.status}</td>
                        <td className="num">{formatDays(c.current_delay_days)}</td>
                        <td className="num">{formatDays(c.predicted_delay_days)}</td>
                        <td>
                          <div className="risk-cell">
                            <RiskMeter pct={c.risk_pct} level={c.risk_level} />
                            <RiskBadge level={c.risk_level} pct={c.risk_pct} />
                          </div>
                        </td>
                        <td className="num">{formatCr(c.estimated_cost)}</td>
                        <td className={`num ${c.cost_overrun_pct > 15 ? "text-danger" : ""}`}>{formatPct(c.cost_overrun_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={data.page} pages={data.pages} total={data.total} onChange={p => setParam({ page: String(p) })} />
            </>
          )}
        </DataState>
      </Section>
    </>
  );
}

export default CasesPage;
