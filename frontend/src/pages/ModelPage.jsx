import React from "react";
import {
  Blocks,
  BrainCircuit,
  Database,
  Filter,
  LayoutDashboard,
  Server,
  ShieldAlert,
  Sparkles
} from "lucide-react";

import { DataState, PageHeader, Section, SyntheticNotice } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { formatDate, formatNumber, formatPct } from "../utils/format";

function MetricsTable({ candidates, selected, metrics }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Candidate</th>
            {metrics.map(m => <th key={m.key} className="num">{m.label}</th>)}
            <th />
          </tr>
        </thead>
        <tbody>
          {Object.entries(candidates).map(([name, m]) => (
            <tr key={name}>
              <td className="cell-main">{name}</td>
              {metrics.map(x => <td key={x.key} className="num">{x.fmt(m[x.key])}</td>)}
              <td>{name === selected && <span className="status-pill low">Selected</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Step({ n, icon: Icon, title, subtitle, children }) {
  return (
    <div className="model-step">
      <div className="model-step-num" aria-label={`Step ${n}`}>
        <Icon size={20} />
      </div>
      <Section title={`${n}. ${title}`} subtitle={subtitle}>
        {children}
      </Section>
    </div>
  );
}

function ModelPage() {
  const { data, loading, error, reload } = useApi("/model/info");
  const pre = data?.preprocessing;

  return (
    <>
      <PageHeader eyebrow="MODEL ARCHITECTURE" title="How predictions are produced" subtitle="The actual pipeline and models currently serving predictions, read from the trained model artifacts." />

      <DataState loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="model-steps">
            <Step n={1} icon={Database} title="Dataset" subtitle="Land acquisition cases with recorded outcomes">
              <div className="kv">
                <div><span>File</span><strong>{data.dataset.file}</strong></div>
                <div><span>Rows · columns</span><strong>{formatNumber(data.dataset.rows)} · {data.dataset.columns}</strong></div>
                <div><span>Train / test</span><strong>{data.dataset.train_rows} / {data.dataset.test_rows}</strong></div>
                <div><span>Significant-delay share</span><strong>{formatPct(data.dataset.positive_rate * 100)}</strong></div>
                <div><span>Data type</span><strong>{data.dataset.synthetic ? "SYNTHETIC" : "Recorded"}</strong></div>
              </div>
            </Step>

            <Step n={2} icon={Filter} title="Preprocessing" subtitle="Applied identically in training, import and inference">
              <div className="kv">
                <div><span>Missing values</span><strong>{pre.imputation}</strong></div>
                <div><span>Encoding</span><strong>{pre.encoding}</strong></div>
                <div><span>Split</span><strong>{pre.split}</strong></div>
              </div>
              <div className="section-title">Imputed values per column</div>
              <div className="chips">
                {Object.entries(pre.imputed_counts).map(([k, v]) => <span className="chip" key={k}><code>{k}</code> {v}</span>)}
              </div>
              <div className="section-title">Columns not used as model inputs</div>
              <div className="snapshot-list">
                {Object.entries(pre.dropped_columns).map(([k, v]) => (
                  <div key={k}><span><code>{k}</code></span><strong>{v}</strong></div>
                ))}
              </div>
            </Step>

            <Step n={3} icon={Blocks} title="Feature Engineering" subtitle={`${data.feature_metadata.length} model features grouped into driver categories`}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Feature</th><th>Driver category</th><th>Type</th><th className="num">Range</th></tr>
                  </thead>
                  <tbody>
                    {data.feature_metadata.map(f => (
                      <tr key={f.name}>
                        <td><div className="cell-main">{f.label}</div><div className="cell-sub"><code>{f.name}</code></div></td>
                        <td>{f.category}</td>
                        <td>{f.kind}{f.editable ? "" : " · fixed in What-If"}</td>
                        <td className="num">{f.min} – {f.max}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Step>

            <Step n={4} icon={BrainCircuit} title="ML Models" subtitle="Two candidates per task are trained; the better hold-out score is kept">
              <div className="section-title" style={{ marginTop: 0 }}>Risk classifier — {data.target.risk}</div>
              <MetricsTable
                candidates={data.risk_model.candidates}
                selected={data.risk_model.selected}
                metrics={[
                  { key: "roc_auc", label: "ROC-AUC", fmt: v => v.toFixed(3) },
                  { key: "accuracy", label: "Accuracy", fmt: v => formatPct(v * 100) },
                  { key: "precision", label: "Precision", fmt: v => formatPct(v * 100) },
                  { key: "recall", label: "Recall", fmt: v => formatPct(v * 100) },
                  { key: "f1", label: "F1", fmt: v => v.toFixed(3) }
                ]}
              />
              <div className="section-title">Delay regressor — {data.target.delay}</div>
              <MetricsTable
                candidates={data.delay_model.candidates}
                selected={data.delay_model.selected}
                metrics={[
                  { key: "mae_days", label: "MAE (days)", fmt: v => v.toFixed(1) },
                  { key: "r2", label: "R²", fmt: v => v.toFixed(3) }
                ]}
              />
            </Step>

            <Step n={5} icon={ShieldAlert} title="Risk Prediction" subtitle="Applied to every case in the database and persisted">
              <div className="kv">
                <div><span>Risk model</span><strong>{data.risk_model.selected}</strong></div>
                <div><span>Delay model</span><strong>{data.delay_model.selected}</strong></div>
                <div><span>High band</span><strong>≥ {formatPct(data.risk_bands.High * 100, 0)}</strong></div>
                <div><span>Medium band</span><strong>≥ {formatPct(data.risk_bands.Medium * 100, 0)}</strong></div>
                <div><span>Model version</span><strong>{data.model_version}</strong></div>
                <div><span>Trained</span><strong>{formatDate(data.trained_at)}</strong></div>
              </div>
              <p className="muted-text" style={{ marginTop: 10 }}>
                Note: stored predictions come from the final model, which saw 80% of these cases during training; the metrics above are measured on the 20% hold-out.
              </p>
            </Step>

            <Step n={6} icon={Sparkles} title="SHAP Explanation" subtitle="Per-case contributions that sum to the prediction">
              <p className="muted-text">
                {data.explainability}. Risk contributions are in probability points; delay contributions are in days.
                Delay-driver categories are sums of feature contributions within each category. Recommended actions are
                templated text selected from the largest positive contributions and never change a prediction.
              </p>
            </Step>

            <Step n={7} icon={Server} title="API" subtitle="FastAPI serving layer (JWT-protected)">
              <div className="kv">
                <div><span>Database</span><strong>{data.serving.database}</strong></div>
                <div><span>Scored cases</span><strong>{formatNumber(data.serving.scored_cases)}</strong></div>
                <div><span>Last scored</span><strong>{formatDate(data.serving.last_scored_at)}</strong></div>
                <div><span>Endpoints</span><strong>/dashboard · /cases · /gis/districts · /analytics · /budget · /priority · /alerts · /simulator</strong></div>
              </div>
            </Step>

            <Step n={8} icon={LayoutDashboard} title="Dashboard" subtitle="React front-end">
              <p className="muted-text">
                Every page reads the same persisted prediction for a case, so risk, delay and drivers are identical across the
                dashboard, case register, district map, analytics, alerts and priority review. The What-If simulator and New Assessment call the model live.
              </p>
            </Step>

            <SyntheticNotice />
          </div>
        )}
      </DataState>
    </>
  );
}

export default ModelPage;
