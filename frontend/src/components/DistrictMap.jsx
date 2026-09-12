import React, { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";

import { formatNumber } from "../utils/format";

export const ZONE_COLORS = { ready: "#0ca30c", not_ready: "#d03b3b" };
const ACRE_M2 = 4046.86;
const GAP_M = 400;

// Schematic zone circles: area equals the zone's total acreage (no surveyed boundaries exist in the data).
function radiusM(acres) {
  return Math.sqrt((acres * ACRE_M2) / Math.PI);
}

function zoneGeometry(d) {
  const rr = radiusM(d.zones.ready.acres);
  const rn = radiusM(d.zones.not_ready.acres);
  const mPerDegLng = 111320 * Math.cos((d.latitude * Math.PI) / 180);
  return {
    ready: { center: [d.latitude, d.longitude - (rr + GAP_M / 2) / mPerDegLng], radius: rr },
    not_ready: { center: [d.latitude, d.longitude + (rn + GAP_M / 2) / mPerDegLng], radius: rn }
  };
}

function Viewport({ districts, selected }) {
  const map = useMap();
  useEffect(() => {
    const d = districts.find(x => x.district === selected);
    if (d) map.flyTo([d.latitude, d.longitude], 11, { duration: 1.2 });
    else if (districts.length) map.fitBounds(districts.map(x => [x.latitude, x.longitude]), { padding: [30, 30] });
  }, [selected, districts, map]);
  return null;
}

/** District HQ markers with two owner-readiness zones each; selecting a district flies the map to it. */
function DistrictMap({ districts, selected, onSelect, height = 520 }) {
  const located = districts.filter(d => d.latitude !== null && d.longitude !== null);

  return (
    <div className="risk-map">
      <MapContainer center={[18.5, 79.5]} zoom={6} style={{ height, width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Viewport districts={located} selected={selected} />
        {located.map(d => {
          const geo = zoneGeometry(d);
          const isSelected = d.district === selected;
          return (
            <React.Fragment key={`${d.state}-${d.district}`}>
              {["ready", "not_ready"].map(
                k =>
                  d.zones[k].acres > 0 && (
                    <Circle
                      key={k}
                      center={geo[k].center}
                      radius={geo[k].radius}
                      pathOptions={{ color: ZONE_COLORS[k], weight: 1.5, fillColor: ZONE_COLORS[k], fillOpacity: 0.28 }}
                      eventHandlers={{ click: () => onSelect?.(d) }}
                    >
                      <Tooltip>
                        <strong>{d.district}</strong> · {d.zones[k].label}
                        <br />
                        {formatNumber(d.zones[k].acres)} acres · {d.zones[k].cases} cases
                      </Tooltip>
                    </Circle>
                  )
              )}
              <CircleMarker
                key={`${d.district}-${isSelected}`}
                center={[d.latitude, d.longitude]}
                radius={isSelected ? 9 : 6}
                pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#102a43", fillOpacity: 1 }}
                eventHandlers={{ click: () => onSelect?.(d) }}
              >
                <Tooltip direction="top" offset={[0, -6]} permanent={isSelected}>
                  {d.district}, {d.state}
                </Tooltip>
              </CircleMarker>
            </React.Fragment>
          );
        })}
      </MapContainer>
      <div className="map-legend">
        <div>
          <span className="legend-dot" style={{ background: ZONE_COLORS.ready }} /> Ready to occupy
        </div>
        <div>
          <span className="legend-dot" style={{ background: ZONE_COLORS.not_ready }} /> Owners not ready to sell
        </div>
        <div>
          <span className="legend-dot" style={{ background: "#102a43" }} /> District HQ
        </div>
        <div className="map-legend-note">Schematic zones · circle area = total acreage · © OpenStreetMap</div>
      </div>
    </div>
  );
}

export default DistrictMap;
