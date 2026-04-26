import {
  clearAdminToken as clearStoredAdminToken,
  getAdminToken as getStoredAdminToken,
  setAdminToken as setStoredAdminToken,
} from "./sessionStore.js";
import { resolveBffBaseUrl } from "./runtimeConfig.js";

const ADMIN_DEVICE_KEY = "TradersApp_AdminDeviceId";
const ADMIN_REMEMBER_KEY = "TradersApp_AdminRemember";

export function getDeviceFingerprint() {
  try {
    let fp = localStorage.getItem(ADMIN_DEVICE_KEY);
    if (!fp) {
      fp = `dev_${Math.random().toString(36).slice(2, 15)}${Math.random()
        .toString(36)
        .slice(2, 15)}`;
      localStorage.setItem(ADMIN_DEVICE_KEY, fp);
    }
    return fp;
  } catch {
    return "unknown";
  }
}

export function getRememberDevice() {
  try {
    return localStorage.getItem(ADMIN_REMEMBER_KEY) === "true";
  } catch {
    return false;
  }
}

export function setRememberDevice(value) {
  try {
    if (value) {
      localStorage.setItem(ADMIN_REMEMBER_KEY, "true");
    } else {
      localStorage.removeItem(ADMIN_REMEMBER_KEY);
    }
  } catch {
    // best-effort browser preference
  }
}

export function parseUserAgent(ua) {
  ua = ua || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let deviceType = "desktop";
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

export async function listAdminSessions() {
  try {
    const adminToken = await getAdminToken();
    const res = await fetch(`${resolveBffBaseUrl()}/admin/sessions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    return await res
      .json()
      .catch(() => ({ ok: false, error: "Failed to fetch sessions." }));
  } catch {
    return { ok: false, error: "Failed to fetch sessions." };
  }
}

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
    return await res
      .json()
      .catch(() => ({ ok: false, error: "Failed to revoke session." }));
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

function buildAdminDevicePayload() {
  const deviceFingerprint = getDeviceFingerprint();
  const { browser, os, device } = parseUserAgent();
  const rememberDevice = getRememberDevice();
  return {
    deviceFingerprint,
    deviceBrowser: browser,
    deviceOs: os,
    deviceType: device,
    rememberDevice,
  };
}

async function storeAdminSessionFromPayload(payload) {
  if (payload?.ok && payload?.token) {
    await setAdminToken(payload.token);
  }
  return payload;
}

async function parseJsonResponse(response, fallbackError) {
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok || payload.ok === false) {
    const retryAfterMs = Number(payload.retryAfterMs || 0);
    const retryMessage =
      retryAfterMs > 0
        ? ` Try again in ${Math.ceil(retryAfterMs / 60000)} minute(s).`
        : "";
    throw new Error(`${payload.error || fallbackError}${retryMessage}`);
  }
  return payload;
}

export async function requestAdminEmailOtp(masterEmail) {
  if (typeof window !== "undefined" && window.__TRADERS_AUDIT_DATA) {
    return {
      ok: true,
      challengeId: "audit-admin-email-otp",
      recipients: [
        "g***h@gmail.com",
        "a***s@gmail.com",
        "s***t@gmail.com",
      ],
      simulated: true,
    };
  }

  const cleanEmail = String(masterEmail || "").trim();
  if (!cleanEmail) {
    throw new Error("Master admin email is required.");
  }

  let response;
  try {
    response = await fetch(`${resolveBffBaseUrl()}/auth/admin/email-otp/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ masterEmail: cleanEmail }),
    });
  } catch {
    throw new Error("Admin email OTP service is unavailable.");
  }

  return parseJsonResponse(response, "Admin email OTP request failed.");
}

export async function verifyAdminEmailOtp({ challengeId, otps }) {
  if (typeof window !== "undefined" && window.__TRADERS_AUDIT_DATA) {
    await setAdminToken("audit-simulated-token");
    return { ok: true, verified: true, simulated: true };
  }

  if (!challengeId) {
    throw new Error("OTP session expired. Request new codes.");
  }

  let response;
  try {
    response = await fetch(`${resolveBffBaseUrl()}/auth/admin/email-otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        challengeId,
        codes: {
          otp1: otps?.otp1,
          otp2: otps?.otp2,
          otp3: otps?.otp3,
        },
        ...buildAdminDevicePayload(),
      }),
    });
  } catch {
    throw new Error("Admin email OTP verification service is unavailable.");
  }

  return storeAdminSessionFromPayload(
    await parseJsonResponse(response, "Admin email OTP verification failed."),
  );
}

export async function verifyAdminTotp(code) {
  if (typeof window !== "undefined" && window.__TRADERS_AUDIT_DATA) {
    await setAdminToken("audit-simulated-token");
    return { ok: true, verified: true, simulated: true };
  }

  const cleanCode = String(code || "").replace(/\D/g, "").slice(0, 6);
  if (cleanCode.length !== 6) {
    throw new Error("Authenticator code is required.");
  }

  let response;
  try {
    response = await fetch(`${resolveBffBaseUrl()}/auth/admin/totp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        code: cleanCode,
        ...buildAdminDevicePayload(),
      }),
    });
  } catch {
    throw new Error("Admin authenticator service is unavailable.");
  }

  return storeAdminSessionFromPayload(
    await parseJsonResponse(response, "Admin authenticator verification failed."),
  );
}

export async function fetchAdminTotpSetup() {
  let response;
  try {
    response = await fetch(`${resolveBffBaseUrl()}/auth/admin/totp/setup`, {
      cache: "no-store",
    });
  } catch {
    throw new Error("Authenticator setup service is unavailable.");
  }

  return parseJsonResponse(response, "Failed to load authenticator setup.");
}

export async function clearAdminToken() {
  await clearStoredAdminToken();
}

export default {
  requestAdminEmailOtp,
  verifyAdminEmailOtp,
  verifyAdminTotp,
  fetchAdminTotpSetup,
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
