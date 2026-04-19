import {
  clearAdminToken as clearStoredAdminToken,
  getAdminToken as getStoredAdminToken,
  setAdminToken as setStoredAdminToken,
} from "./sessionStore.js";

const ADMIN_DEVICE_KEY = "TradersApp_AdminDeviceId";
const ADMIN_REMEMBER_KEY = "TradersApp_AdminRemember";

const resolveBffBaseUrl = () => {
  const configured = String(import.meta.env.VITE_BFF_URL || "").trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return "/api";
};

/** Generate or retrieve a persistent device fingerprint for this browser. */
export function getDeviceFingerprint() {
  try {
    let fp = localStorage.getItem(ADMIN_DEVICE_KEY);
    if (!fp) {
      fp = "dev_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem(ADMIN_DEVICE_KEY, fp);
    }
    return fp;
  } catch {
    return "unknown";
  }
}

/** Get stored "remember this device" preference. */
export function getRememberDevice() {
  try {
    return localStorage.getItem(ADMIN_REMEMBER_KEY) === "true";
  } catch {
    return false;
  }
}

/** Set "remember this device" preference. */
export function setRememberDevice(value) {
  try {
    if (value) {
      localStorage.setItem(ADMIN_REMEMBER_KEY, "true");
    } else {
      localStorage.removeItem(ADMIN_REMEMBER_KEY);
    }
  } catch { /* best-effort */ }
}

/** Parse user agent for browser/OS info. */
export function parseUserAgent(ua) {
  ua = ua || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  let browser = "Unknown Browser", os = "Unknown OS", deviceType = "desktop";
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) {
    deviceType = "mobile";
    if (/iPad/i.test(ua)) deviceType = "tablet";
  }
  if (/Chrome\/[\d.]+/.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Firefox\/[\d.]+/.test(ua)) browser = "Firefox";
  else if (/Safari\/[\d.]+/.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Edg\/[\d.]+/.test(ua)) browser = "Edge";
  if (/Windows NT 10/.test(ua)) os = "Windows 10";
  else if (/Windows NT 11/.test(ua)) os = "Windows 11";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";
  return { browser, os, device: deviceType };
}

/** List all active admin sessions from the BFF. */
export async function listAdminSessions() {
  try {
    const adminToken = await getAdminToken();
    const res = await fetch(`${resolveBffBaseUrl()}/admin/sessions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json().catch(() => ({}));
    return data;
  } catch {
    return { ok: false, error: "Failed to fetch sessions." };
  }
}

/** Revoke a specific admin session by short session id (from list response). */
export async function revokeAdminSessionRemote(sessionId) {
  try {
    const adminToken = await getAdminToken();
    const res = await fetch(`${resolveBffBaseUrl()}/admin/sessions`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ id: sessionId }),
    });
    return await res.json().catch(() => ({ ok: false, error: "Failed to revoke session." }));
  } catch {
    return { ok: false, error: "Failed to revoke session." };
  }
}

export function getAdminToken() {
  return getStoredAdminToken();
}

export async function setAdminToken(token) {
  await setStoredAdminToken(token);
}

export async function verifyAdminPassword(password) {
  if (
    typeof window !== "undefined" &&
    window.__TRADERS_AUDIT_DATA
  ) {
    await setAdminToken("audit-simulated-token");
    return { verified: true, simulated: true };
  }

  const cleanPassword = String(password || "");
  if (!cleanPassword) {
    throw new Error("Admin password is required.");
  }

  let response;
  try {
    response = await fetch(`${resolveBffBaseUrl()}/auth/admin/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        password: cleanPassword,
      }),
    });
  } catch {
    throw new Error("Admin verification service is unavailable.");
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok || payload.verified !== true) {
    const retryAfterMs = Number(payload.retryAfterMs || 0);
    const retryMessage =
      retryAfterMs > 0
        ? ` Try again in ${Math.ceil(retryAfterMs / 60000)} minute(s).`
        : "";
    throw new Error(
      `${payload.error || "Admin password verification failed."}${retryMessage}`,
    );
  }

  // Now fetch the session token for authenticated admin API calls
  const deviceFingerprint = getDeviceFingerprint();
  const { browser, os, device } = parseUserAgent();
  const rememberDevice = getRememberDevice();

  let tokenResponse;
  try {
    tokenResponse = await fetch(`${resolveBffBaseUrl()}/admin/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        password: cleanPassword,
        deviceFingerprint,
        deviceBrowser: browser,
        deviceOs: os,
        deviceType: device,
        rememberDevice,
      }),
    });
  } catch {
    // Session token is optional — admin APIs may be available without it
    return payload;
  }

  let tokenPayload = {};
  try {
    tokenPayload = await tokenResponse.json();
  } catch {
    tokenPayload = {};
  }

  if (tokenPayload.ok && tokenPayload.token) {
    await setAdminToken(tokenPayload.token);
  }

  return payload;
}

export async function clearAdminToken() {
  await clearStoredAdminToken();
}

export default {
  verifyAdminPassword,
  getAdminToken,
  setAdminToken,
  clearAdminToken,
  getDeviceFingerprint,
  getRememberDevice,
  setRememberDevice,
  parseUserAgent,
  listAdminSessions,
  revokeAdminSessionRemote,
};
