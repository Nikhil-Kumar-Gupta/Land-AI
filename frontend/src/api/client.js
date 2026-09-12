const BASE = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "landai_token";
const BUSINESS_KEY = "landai_business";

let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getToken() {
  return storage()?.getItem(TOKEN_KEY) || null;
}

export function getStoredBusiness() {
  try {
    return JSON.parse(storage()?.getItem(BUSINESS_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveSession(token, business) {
  storage()?.setItem(TOKEN_KEY, token);
  storage()?.setItem(BUSINESS_KEY, JSON.stringify(business));
}

export function clearSession() {
  storage()?.removeItem(TOKEN_KEY);
  storage()?.removeItem(BUSINESS_KEY);
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function errorMessage(data, status) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map(e => `${e.loc?.slice(-1)[0] ? `${String(e.loc.slice(-1)[0]).replace(/_/g, " ")}: ` : ""}${(e.msg || "").replace(/^Value error, /, "")}`)
      .join(" ");
  }
  if (detail && typeof detail === "object") return detail.message || "Request failed.";
  return status >= 500 ? "Server error. Please try again." : `Request failed (${status}).`;
}

export async function api(path, { method = "GET", body, auth = true, redirectOn401 = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError("Cannot reach the server. Please check that the backend is running.", 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && auth && token && redirectOn401) unauthorizedHandler?.();
    throw new ApiError(errorMessage(data, response.status), response.status, data);
  }
  return data;
}
