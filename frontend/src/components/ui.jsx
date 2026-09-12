import React from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, RefreshCw } from "lucide-react";

import { riskClass } from "../utils/format";

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Section({ title, subtitle, icon, actions, children, className = "" }) {
  return (
    <section className={`analysis-card ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="card-header-actions">
            {actions}
            {icon}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

export function Loader({ label = "Loading data…" }) {
  return (
    <div className="state-box" role="status">
      <div className="loading-spinner small" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-box error" role="alert">
      <AlertTriangle size={22} />
      <span>{message || "Something went wrong."}</span>
      {onRetry && (
        <button className="secondary-button small" onClick={onRetry}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = "No data", message }) {
  return (
    <div className="state-box empty">
      <Inbox size={22} />
      <strong>{title}</strong>
      {message && <span>{message}</span>}
    </div>
  );
}

/** Renders loading / error / empty states, otherwise children. */
export function DataState({ loading, error, onRetry, empty, emptyTitle, emptyMessage, children }) {
  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (empty) return <EmptyState title={emptyTitle} message={emptyMessage} />;
  return children;
}

export function RiskBadge({ level, pct }) {
  if (!level) return <span className="status-pill neutral">Not scored</span>;
  return (
    <span className={`status-pill ${riskClass(level)}`}>
      {level}
      {pct !== undefined && pct !== null ? ` · ${Number(pct).toFixed(1)}%` : ""}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  return <span className={`severity-pill ${severity}`}>{severity}</span>;
}

export function RiskMeter({ pct, level }) {
  return (
    <div className="risk-meter" title={`${Number(pct).toFixed(1)}%`}>
      <div className={`risk-meter-fill ${riskClass(level)}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function Pagination({ page, pages, total, onChange }) {
  return (
    <div className="pagination">
      <span>
        Page {page} of {pages} · {total} records
      </span>
      <div>
        <button className="secondary-button small" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <button className="secondary-button small" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function SyntheticNotice({ children }) {
  return (
    <div className="prototype-disclaimer">
      <strong>Synthetic data notice:</strong>{" "}
      {children ||
        "Case records come from a SYNTHETIC land-acquisition dataset; budget, utilisation and actual-cost figures are synthetic values derived from it. District locations are headquarters coordinates and zone circles are schematic. None of this is real government data."}
    </div>
  );
}
