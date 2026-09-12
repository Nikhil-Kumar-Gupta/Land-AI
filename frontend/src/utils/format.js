const nf = (digits = 0) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits });

export function formatCr(value, digits) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const cr = value / 1e7;
  const d = digits ?? (Math.abs(cr) >= 100 ? 0 : 2);
  return `₹${nf(d).format(cr)} Cr`;
}

export function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return nf(digits).format(value);
}

export function formatPct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Number(value).toFixed(digits)}%`;
}

export function formatDays(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${nf(0).format(value)} days`;
}

export function formatSigned(value, digits = 1, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}${suffix}`;
}

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function riskClass(level) {
  return level === "High" ? "high" : level === "Medium" ? "moderate" : "low";
}
