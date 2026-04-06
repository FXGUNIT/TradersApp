const BFF_BASE_URL = String(import.meta.env.VITE_BFF_URL || "").trim();
const ADMIN_TOKEN_KEY = "TradersApp_AdminToken";
const BFF_FAILURE_COOLDOWN_MS = 2 * 60 * 1000;

let bffUnavailableUntil = 0;

function isAuditRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    if (localStorage.getItem("TradersApp_AuditMode") === "true") {
      return true;
    }
  } catch {
    // Ignore storage access errors in restricted environments.
  }

  return Boolean(
    window.__TRADERS_AUDIT_DATA?.active || window.__TradersAppAudit,
  );
}

function markBffUnavailable() {
  bffUnavailableUntil = Date.now() + BFF_FAILURE_COOLDOWN_MS;
}

function clearBffUnavailable() {
  bffUnavailableUntil = 0;
}

export function hasBff() {
  return (
    Boolean(BFF_BASE_URL) &&
    !isAuditRuntime() &&
    Date.now() >= bffUnavailableUntil
  );
}

export function createBffUnavailableResult(operation, extra = {}) {
  return {
    success: false,
    error: `BFF unavailable for ${operation}.`,
    ...extra,
  };
}

function getAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

function buildUrl(path) {
  if (!BFF_BASE_URL) {
    return path;
  }

  if (path.startsWith("/")) {
    return `${BFF_BASE_URL}${path}`;
  }

  return `${BFF_BASE_URL}/${path}`;
}

export async function bffFetch(path, options = {}) {
  if (!hasBff()) {
    return null;
  }

  const adminToken = getAdminToken();
  const headers = {
    ...(options.headers || {}),
  };
  if (adminToken) {
    headers["Authorization"] = `Bearer ${adminToken}`;
  }

  try {
    const response = await fetch(buildUrl(path), { ...options, headers });
    clearBffUnavailable();
    // 404 = endpoint may not exist — treat as null
    if (response.status === 404) {
      return null;
    }
    // 401/403 = not authenticated yet — return a structured result so callers
    // can distinguish "unauthenticated" from "BFF is down"
    if (response.status === 401 || response.status === 403) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data?.error || "Unauthorized", _authError: true };
    }
    if (!response.ok) {
      if (response.status >= 500) {
        markBffUnavailable();
      }
      return null;
    }
    return await response.json();
  } catch {
    markBffUnavailable();
    return null;
  }
}

export default {
  bffFetch,
  createBffUnavailableResult,
  hasBff,
};
