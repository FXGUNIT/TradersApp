import { getDesktopRequestHeaders } from "../desktopBridge.js";
import { resolveBffBaseUrl } from "../runtimeConfig.js";
import { getAdminToken } from "../sessionStore.js";

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

function getBffBaseUrl() {
  return resolveBffBaseUrl();
}

export function hasBff() {
  const baseUrl = getBffBaseUrl();
  return (
    Boolean(baseUrl) &&
    !isAuditRuntime() &&
    Date.now() >= bffUnavailableUntil
  );
}

export function getBffGatewayState() {
  const now = Date.now();
  return {
    baseUrl: getBffBaseUrl(),
    auditRuntime: isAuditRuntime(),
    inCooldown: now < bffUnavailableUntil,
    unavailableUntil: bffUnavailableUntil || null,
    cooldownRemainingMs: Math.max(0, bffUnavailableUntil - now),
  };
}

export function resetBffCooldown() {
  clearBffUnavailable();
  return getBffGatewayState();
}

export function createBffUnavailableResult(operation, extra = {}) {
  return {
    success: false,
    error: `BFF unavailable for ${operation}.`,
    ...extra,
  };
}

function buildUrl(path) {
  const baseUrl = getBffBaseUrl();
  if (!baseUrl) {
    return path;
  }

  if (path.startsWith("/")) {
    return `${baseUrl}${path}`;
  }

  return `${baseUrl}/${path}`;
}

export async function probeBffHealth({ timeoutMs = 4000 } = {}) {
  const state = getBffGatewayState();
  if (!state.baseUrl || state.auditRuntime) {
    return {
      ok: false,
      status: 0,
      state,
      error: state.auditRuntime
        ? "BFF suppressed in audit runtime."
        : "BFF base URL is not configured.",
    };
  }

  try {
    const response = await fetch(buildUrl("/health"), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      clearBffUnavailable();
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
      state: getBffGatewayState(),
      error: response.ok
        ? null
        : data?.error || data?.message || `BFF health failed (${response.status})`,
    };
  } catch (error) {
    markBffUnavailable();
    return {
      ok: false,
      status: 0,
      state: getBffGatewayState(),
      error: error?.message || "BFF health probe failed.",
    };
  }
}

export async function bffFetch(path, options = {}) {
  if (!hasBff()) {
    return null;
  }

  const adminToken = await getAdminToken();
  const desktopHeaders = await getDesktopRequestHeaders();
  const headers = {
    ...desktopHeaders,
    ...(options.headers || {}),
  };
  if (adminToken) {
    headers["Authorization"] = `Bearer ${adminToken}`;
  }

  // Strip browser-extension-injected headers that cause CORS preflight failures.
  // Extensions like 'Meta Pixel' or ad blockers inject custom headers (e.g.
  // x-tradersapp-install-id) which are not in the BFF CORS allowlist, causing
  // the preflight OPTIONS to be rejected and the request to be blocked.
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase().startsWith("x-tradersapp-")) {
      delete headers[key];
    }
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
  getBffGatewayState,
  hasBff,
  probeBffHealth,
  resetBffCooldown,
};
