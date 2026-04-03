const BFF_BASE_URL = String(import.meta.env.VITE_BFF_URL || "").trim();
const ADMIN_TOKEN_KEY = "TradersApp_AdminToken";

export function hasBff() {
  return Boolean(BFF_BASE_URL);
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
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

export default {
  bffFetch,
  createBffUnavailableResult,
  hasBff,
};
