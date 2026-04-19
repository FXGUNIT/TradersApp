import {
  isDesktopRuntime,
  secureStoreGet,
  secureStoreRemove,
  secureStoreSet,
} from "./desktopBridge.js";

const ADMIN_TOKEN_KEY = "TradersApp_AdminToken";

function readLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    if (value === null || value === undefined || value === "") {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Best-effort cache only.
  }
}

export async function getAdminToken() {
  if (isDesktopRuntime()) {
    const secureToken = await secureStoreGet(ADMIN_TOKEN_KEY);
    if (secureToken) {
      return secureToken;
    }
  }

  return readLocalStorage(ADMIN_TOKEN_KEY);
}

export async function setAdminToken(token) {
  const normalized = String(token || "").trim();

  if (isDesktopRuntime()) {
    if (normalized) {
      await secureStoreSet(ADMIN_TOKEN_KEY, normalized);
    } else {
      await secureStoreRemove(ADMIN_TOKEN_KEY);
    }
  }

  writeLocalStorage(ADMIN_TOKEN_KEY, normalized || null);
}

export async function clearAdminToken() {
  await setAdminToken(null);
}

export async function setRememberedSession(uid, encryptedSession) {
  const key = `sess_${uid}`;
  const normalized = String(encryptedSession || "").trim();

  if (isDesktopRuntime()) {
    if (normalized) {
      await secureStoreSet(key, normalized);
    } else {
      await secureStoreRemove(key);
    }
  }

  writeLocalStorage(key, normalized || null);
}

export async function clearRememberedSession(uid) {
  if (!uid) {
    return;
  }

  await setRememberedSession(uid, null);
}

export default {
  clearAdminToken,
  clearRememberedSession,
  getAdminToken,
  setAdminToken,
  setRememberedSession,
};
