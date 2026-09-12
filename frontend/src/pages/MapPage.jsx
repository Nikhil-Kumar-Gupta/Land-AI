import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MapPin, X } from "lucide-react";

import DistrictMap, { ZONE_COLORS } from "../components/DistrictMap";
import { DataState, EmptyState, PageHeader, Section } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { formatCr, formatDays, formatNumber, formatPct } from "../utils/format";

function ZoneCard({ zoneKey, zone, district }) {
  return (
    <div className="zone-card" style={{ borderTopColor: ZONE_COLORS[zoneKey] }}>
      <div className="zone-card-title">
        <span className="legend-dot" style={{ background: ZONE_COLORS[zoneKey] }} />
        {zone.label}
      </div>
      <strong>{formatNumber(zone.acres)} acres</strong>
      <div className="zone-card-rows">
        <span>Cases</span><b>{zone.cases}</b>
        <span>Landowners</span><b>{formatNumber(zone.landowners)}</b>
        <span>Compensation / acre</span><b>{zone.compensation_per_acre_lakh !== null ? `₹${zone.compensation_per_acre_lakh} L` : "—"}</b>
        <span>Avg. model risk</span><b>{formatPct(zone.avg_risk_pct)}</b>
        <span>Pred. extra delay</span><b>{formatDays(zone.avg_predicted_delay_days)}</b>
      </div>
      {zone.blockers && Object.keys(zone.blockers).length > 0 && (
        <div className="chips" style={{ marginTop: 10 }}>
          {Object.entries(zone.blockers).map(([k, v]) => (
            <span className="chip" key={k}>{k}: {v}</span>
          ))}
        </div>
      )}
      <Link className="link-button" style={{ marginTop: 10 }} to={`/cases?district=${encodeURIComponent(district)}&zone=${zoneKey}`}>
        View {zone.cases} cases →
      </Link>
    </div>
  );
}

function DistrictPanel({ d }) {
  const maxStage = Math.max(1, ...d.stage_mix.map(s => s.cases));
  return (
    <>
      <div className="cell-main" style={{ fontSize: 17 }}>{d.district}</div>
      <div className="cell-sub" style={{ marginBottom: 14 }}>
        {d.state} · {d.cases} cases · {formatNumber(d.total_acres)} acres · {formatPct(d.ready_share_pct)} of land ready
      </div>

      <div className="zone-grid">
        <ZoneCard zoneKey="ready" zone={d.zones.ready} district={d.district} />
        <ZoneCard zoneKey="not_ready" zone={d.zones.not_ready} district={d.district} />
      </div>

      <div className="section-title">Land & cost</div>
      <div className="snapshot-list">
        <div><span>Compensation per acre (dataset)</span><strong>{d.compensation_per_acre_lakh !== null ? `₹${d.compensation_per_acre_lakh} lakh` : "—"}</strong></div>
        <div><span>Private / government land</span><strong>{formatPct(d.private_land_pct)} / {formatPct(d.government_land_pct)}</strong></div>
        <div><span>Landowners · households affected</span><strong>{formatNumber(d.landowners)} · {formatNumber(d.households)}</strong></div>
        <div><span>Estimated cost (synthetic)</span><strong>{formatCr(d.estimated_cost)}</strong></div>
        <div><span>Cost overrun (synthetic)</span><strong>{formatPct(d.cost_overrun_pct)}</strong></div>
      </div>

      <div className="section-title">Delay & risk outlook</div>
      <div className="snapshot-list">
        <div><span>Avg. model risk · high-risk cases</span><strong>{formatPct(d.avg_risk_pct)} · {d.high_risk}</strong></div>
        <div><span>Avg. predicted extra delay</span><strong>{formatDays(d.avg_predicted_delay_days)}</strong></div>
        <div><span>Avg. delay from previous stages</span><strong>{formatDays(d.avg_current_delay_days)}</strong></div>
        <div><span>Avg. days in current stage</span><strong>{formatDays(d.avg_days_in_stage)}</strong></div>
        <div><span>District historical delay rate</span><strong>{formatPct(d.historical_delay_rate * 100)}</strong></div>
        <div><span>Disputes · court cases · avg. objections</span><strong>{d.total_disputes} · {d.court_cases} · {d.avg_objections}</strong></div>
      </div>

      {d.top_delay_drivers.length > 0 && (
        <>
          <div className="section-title">Main delay drivers (SHAP)</div>
          <div className="chips">
            {d.top_delay_drivers.map(x => (
              <span className="chip" key={x.category}>{x.category}: +{x.avg_days} d</span>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Cases by stage</div>
      <div className="bar-list compact">
        {d.stage_mix.map(s => (
          <div className="bar-row" key={s.stage}>
            <span>{s.stage}</span>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${(s.cases / maxStage) * 100}%` }} /></div>
            <span className="num">{s.cases}</span>
          </div>
        ))}
      </div>

      <div className="section-title">Project types</div>
      <div className="chips">
        {d.project_types.map(p => <span className="chip" key={p.type}>{p.type}: {p.cases}</span>)}
      </div>
    </>
  );
}

function MapPage() {
  const [params, setParams] = useSearchParams();
  const selectedName = params.get("district") || "";
  const { data, loading, error, reload } = useApi("/gis/districts");

  const districts = data?.items || [];
  const selected = districts.find(d => d.district === selectedName);
  const select = d => setParams(d ? { district: d.district } : {}, { replace: true });
  const states = [...new Set(districts.map(d => d.state))];

  return (
    <>
      <PageHeader
        eyebrow="GIS"
        title="District Land Readiness Map"
        subtitle="Choose a district to fly to it. Each district shows two zones — land ready to occupy and land whose owners are not ready to sell — with builder-relevant figures."
        actions={
          <>
            <select className="select" aria-label="Select district" value={selectedName} onChange={e => select(districts.find(d => d.district === e.target.value))}>
              <option value="">All districts</option>
              {states.map(s => (
                <optgroup key={s} label={s}>
                  {districts.filter(d => d.state === s).map(d => <option key={d.district} value={d.district}>{d.district}</option>)}
                </optgroup>
              ))}
            </select>
            {selected && (
              <button className="secondary-button small" onClick={() => select(null)}>
                <X size={14} /> Show all
              </button>
            )}
          </>
        }
      />

      <DataState loading={loading} error={error} onRetry={reload} empty={data && districts.length === 0} emptyTitle="No districts">
        {data && (
          <>
            <div className="map-layout">
              <Section>
                <DistrictMap districts={districts} selected={selectedName} onSelect={select} height={640} />
                <p className="muted-text" style={{ marginTop: 10, fontSize: 11 }}>{data.notice} Zone rule: {data.zone_rule}</p>
              </Section>

              <Section title={selected ? "District profile" : "District profile"} subtitle={`Spatial source: ${data.spatial_backend}`} icon={<MapPin size={20} />}>
                {selected ? <DistrictPanel d={selected} /> : <EmptyState title="No district selected" message="Pick a district from the list above or click a district on the map." />}
              </Section>
            </div>

            <Section title="District comparison" subtitle="Click a row to open the district on the map">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>District</th>
                      <th className="num">Cases</th>
                      <th className="num">Total acres</th>
                      <th className="num">Ready acres</th>
                      <th className="num">Ready share</th>
                      <th className="num">Comp. / acre</th>
                      <th className="num">Avg. risk</th>
                      <th className="num">Pred. extra delay</th>
                      <th className="num">Court cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {districts.map(d => (
                      <tr
                        key={`${d.state}-${d.district}`}
                        className={`clickable ${d.district === selectedName ? "selected-row" : ""}`}
                        onClick={() => {
                          select(d);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <td><div className="cell-main">{d.district}</div><div className="cell-sub">{d.state}</div></td>
                        <td className="num">{d.cases}</td>
                        <td className="num">{formatNumber(d.total_acres)}</td>
                        <td className="num">{formatNumber(d.zones.ready.acres)}</td>
                        <td className="num">{formatPct(d.ready_share_pct)}</td>
                        <td className="num">{d.compensation_per_acre_lakh !== null ? `₹${d.compensation_per_acre_lakh} L` : "—"}</td>
                        <td className="num">{formatPct(d.avg_risk_pct)}</td>
                        <td className="num">{formatDays(d.avg_predicted_delay_days)}</td>
                        <td className="num">{d.court_cases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}
      </DataState>
    </>
  );
}

export default MapPage;
