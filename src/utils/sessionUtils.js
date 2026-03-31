import { dbW, dbR, dbDel } from "./firebaseDbUtils.js";
import { hasBff } from "../services/gateways/base.js";
import {
  deleteIdentitySession,
  fetchIdentitySessions,
  revokeOtherIdentitySessions,
  upsertIdentitySession,
} from "../services/gateways/identityGateway.js";

export const encryptSessionToken = (data) => {
  try {
    const jsonStr = JSON.stringify(data);
    return btoa(jsonStr);
  } catch (e) {
    console.error("Encryption failed:", e);
    return null;
  }
};

export const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  let device = "Unknown Device";

  if (/iPhone|iPad|iPod/.test(ua)) {
    device = "iOS Device";
  } else if (/Android/.test(ua)) {
    device = "Android Device";
  } else if (/Windows/.test(ua)) {
    device = "Windows PC";
  } else if (/Macintosh/.test(ua)) {
    device = "Mac";
  } else if (/Linux/.test(ua)) {
    device = "Linux";
  }

  return device;
};

export const getSessionGeoData = async () => {
  try {
    const geoRes = await fetch("https://ipapi.co/json/");
    const geoData = await geoRes.json();
    return {
      city: geoData.city || "Unknown",
      country: geoData.country_name || "Unknown",
    };
  } catch {
    return { city: "Unknown", country: "Unknown" };
  }
};

export const normalizeSessionMap = (sessions) => {
  if (!sessions) {
    return {};
  }

  if (Array.isArray(sessions)) {
    return sessions.reduce((acc, session) => {
      if (session?.sessionId) {
        acc[session.sessionId] = session;
      }
      return acc;
    }, {});
  }

  if (typeof sessions === "object") {
    return sessions;
  }

  return {};
};

export const listSessions = async (uid, token) => {
  if (!uid) {
    return {};
  }

  if (hasBff()) {
    const response = await fetchIdentitySessions(uid);
    return normalizeSessionMap(response?.sessions || response?.data || response);
  }

  const legacySessions = await dbR(`users/${uid}/sessions`, token);
  return normalizeSessionMap(legacySessions);
};

export const upsertSession = async (uid, sessionId, sessionData, token) => {
  if (!uid || !sessionId || !sessionData) {
    return false;
  }

  if (hasBff()) {
    const response = await upsertIdentitySession(uid, sessionId, sessionData);
    return Boolean(response);
  }

  await dbW(`users/${uid}/sessions/${sessionId}`, sessionData, token);
  return true;
};

export const revokeSession = async (uid, sessionId, token) => {
  if (!uid || !sessionId) {
    return false;
  }

  if (hasBff()) {
    const response = await deleteIdentitySession(uid, sessionId);
    return Boolean(response);
  }

  await dbDel(`users/${uid}/sessions/${sessionId}`, token);
  return true;
};

export const createSession = async (uid, token, rememberMe) => {
  try {
    const sessionId = generateSessionId();
    const device = getDeviceInfo();
    const geo = await getSessionGeoData();
    const expiresAt = new Date(
      Date.now() +
        (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000),
    );

    const sessionData = {
      sessionId,
      device,
      city: geo.city,
      country: geo.country,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastActive: new Date().toISOString(),
    };

    await upsertSession(uid, sessionId, sessionData, token);

    if (rememberMe) {
      const encryptedSession = encryptSessionToken({
        uid,
        sessionId,
        expiresAt: expiresAt.toISOString(),
        token: token,
      });
      localStorage.setItem(`sess_${uid}`, encryptedSession);
    }

    return sessionId;
  } catch (error) {
    console.error("Session creation failed:", error);
    return null;
  }
};

export const logoutOtherDevices = async (uid, currentSessionId, token) => {
  try {
    if (hasBff()) {
      const response = await revokeOtherIdentitySessions(uid, currentSessionId);
      return Boolean(response);
    }

    const allSessions = await dbR(`users/${uid}/sessions`, token);
    if (!allSessions) return true;

    const deletePromises = Object.keys(normalizeSessionMap(allSessions)).map(
      (sessionId) => {
        if (sessionId !== currentSessionId) {
          return revokeSession(uid, sessionId, token);
        }
        return Promise.resolve();
      },
    );

    await Promise.all(deletePromises);
    return true;
  } catch (error) {
    console.error("Logout other devices failed:", error);
    return false;
  }
};

export const getDevice = () => ({
  ua: navigator.userAgent,
  platform: navigator.platform,
  lang: navigator.language,
  ts: new Date().toISOString(),
});
