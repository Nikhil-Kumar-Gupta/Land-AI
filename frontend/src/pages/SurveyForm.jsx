import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AlertTriangle, ArrowRight, Building2, FileText } from "lucide-react";

import { api } from "../api/client";
import { DataState, PageHeader } from "../components/ui";
import { useApi } from "../hooks/useApi";

const INITIAL_CATEGORIES = {
  project_type: "Highway",
  acquisition_stage: "Survey",
  priority: "Normal",
  project_category: "Major Infrastructure"
};

/** New Assessment - evaluates a proposed acquisition with the trained model (not stored). */
function SurveyForm() {
  const navigate = useNavigate();
  const meta = useApi("/simulator/features");
  const [cats, setCats] = useState(INITIAL_CATEGORIES);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const numeric = (meta.data?.features || []).filter(f => f.kind !== "category");
  const groups = [...new Set(numeric.map(f => f.category))];

  function resetToMedians() {
    if (meta.data) setValues(Object.fromEntries(numeric.map(f => [f.name, String(meta.data.defaults[f.name] ?? f.min)])));
    setCats(INITIAL_CATEGORIES);
  }

  useEffect(() => {
    resetToMedians();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.data]);

  async function submitSurvey(e) {
    e.preventDefault();
    setError("");
    const features = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)]));
    if (Object.values(values).some(v => v === "" || Number.isNaN(Number(v)))) {
      setError("Please fill all fields with valid numbers.");
      return;
    }
    try {
      setLoading(true);
      const result = await api("/assessment", { method: "POST", body: { ...cats, features } });
      navigate("/assessment/result", { state: { result } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectField = (key, label, options) => (
    <div className="form-group">
      <label htmlFor={key}>{label}</label>
      <select id={key} value={cats[key]} onChange={e => setCats(prev => ({ ...prev, [key]: e.target.value }))}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="PROJECT INTAKE"
        title="New Acquisition Assessment"
        subtitle="Enter survey information for a proposed acquisition to get a risk assessment from the trained model. Fields start at dataset medians. Assessments are not stored."
      />

      <DataState loading={meta.loading} error={meta.error} onRetry={meta.reload}>
        {meta.data && (
          <form className="survey-layout" onSubmit={submitSurvey}>
            <div className="survey-main">
              <section className="form-section">
                <div className="section-heading">
                  <div className="section-icon"><Building2 size={20} /></div>
                  <div>
                    <h2>Project Profile</h2>
                    <p>Project type, category, priority and current acquisition stage.</p>
                  </div>
                </div>
                <div className="form-grid">
                  {selectField("project_type", "Project type", meta.data.project_types)}
                  {selectField("project_category", "Project category", meta.data.project_categories)}
                  {selectField("priority", "Priority", meta.data.priorities)}
                  {selectField("acquisition_stage", "Acquisition stage", meta.data.stages)}
                </div>
              </section>

              {groups.map(group => (
                <section className="form-section" key={group}>
                  <div className="section-heading">
                    <div className="section-icon"><FileText size={20} /></div>
                    <div>
                      <h2>{group}</h2>
                      <p>{numeric.filter(f => f.category === group).length} factor(s)</p>
                    </div>
                  </div>
                  <div className="form-grid">
                    {numeric.filter(f => f.category === group).map(f => (
                      <div className="form-group" key={f.name}>
                        <label htmlFor={f.name}>{f.label}</label>
                        {f.kind === "flag" ? (
                          <select id={f.name} value={values[f.name] ?? "0"} onChange={e => setValues(prev => ({ ...prev, [f.name]: e.target.value }))}>
                            <option value="0">No</option>
                            <option value="1">Yes</option>
                          </select>
                        ) : (
                          <>
                            <input
                              id={f.name}
                              type="number"
                              min={f.min}
                              max={f.max}
                              step="any"
                              value={values[f.name] ?? ""}
                              onChange={e => setValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                            />
                            <small>Allowed range {f.min} – {f.max}</small>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              {error && (
                <div className="error-message survey-error">
                  <AlertTriangle size={18} />
                  {error}
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={resetToMedians}>
                  Reset to dataset medians
                </button>
                <button type="submit" className="primary-button large" disabled={loading}>
                  {loading ? "Running model…" : "Generate AI Analysis"}
                  {!loading && <ArrowRight size={18} />}
                </button>
              </div>
            </div>

            <aside className="survey-side">
              <div className="info-panel" style={{ marginTop: 0, position: "sticky", top: 140 }}>
                <div className="info-panel-title">
                  <AlertTriangle size={18} />
                  Survey guidance
                </div>
                <ul>
                  <li>Enter the latest field survey information; fields start at the dataset median.</li>
                  <li>Disputes, court cases, objections and pending compensation typically raise delay risk.</li>
                  <li>Historical patterns describe the district and similar past cases.</li>
                  <li>{meta.data.risk_definition}.</li>
                  <li>The result comes from the same trained model used for all cases, with a SHAP explanation.</li>
                </ul>
              </div>
            </aside>
          </form>
        )}
      </DataState>
    </>
  );
}

export default SurveyForm;
