import { SCREEN_IDS } from "../shell/screenIds.js";

const LOGIN_RATE_LIMIT_STORAGE_KEY = "traders-login-rate-limit-v1";
const PENDING_GOOGLE_SIGNUP_STORAGE_KEY = "traders-pending-google-signup-v1";
const PENDING_GOOGLE_FORM_DATA_KEY = "traders-pending-google-form-data-v1";
const GOOGLE_REDIRECT_IN_PROGRESS_KEY = "traders-google-redirect-in-progress-v1";
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 3;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const RESTORABLE_APP_SCREENS = new Set([
  SCREEN_IDS.HUB,
  SCREEN_IDS.APP,
  SCREEN_IDS.CONSCIOUSNESS,
  SCREEN_IDS.SESSIONS,
]);

export const isRestorableScreen = (screen) =>
  RESTORABLE_APP_SCREENS.has(screen);

const safeStorageGet = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const safeStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.warn(`Failed to persist ${key}`);
  }
};

const safeStorageRemove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    console.warn(`Failed to clear ${key}`);
  }
};

export const getLastScreenStorageKey = (uid) => `TradersApp_LastScreen:${uid}`;

export const getLastReturnScreenStorageKey = (uid) =>
  `TradersApp_LastConsciousnessReturn:${uid}`;

export const persistLastScreen = (uid, screen) => {
  safeStorageSet(getLastScreenStorageKey(uid), screen);
};

export const clearLastScreen = (uid) => {
  safeStorageRemove(getLastScreenStorageKey(uid));
};

export const persistConsciousnessReturnScreen = (uid, screen) => {
  safeStorageSet(getLastReturnScreenStorageKey(uid), screen);
};

export const clearConsciousnessReturnScreen = (uid) => {
  safeStorageRemove(getLastReturnScreenStorageKey(uid));
};

export const resolveRestorableScreen = (uid, fallback = SCREEN_IDS.HUB) => {
  const saved = safeStorageGet(getLastScreenStorageKey(uid), fallback);
  return RESTORABLE_APP_SCREENS.has(saved) ? saved : fallback;
};

export const resolveConsciousnessReturnScreen = (
  uid,
  fallback = SCREEN_IDS.HUB,
) => {
  const saved = safeStorageGet(getLastReturnScreenStorageKey(uid), fallback);
  return RESTORABLE_APP_SCREENS.has(saved) ? saved : fallback;
};

const getLoginRateLimitState = () =>
  safeStorageGet(LOGIN_RATE_LIMIT_STORAGE_KEY, {});

const getLoginRateLimitEntry = (email) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const state = getLoginRateLimitState();
  const entry = state[normalizedEmail];
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.firstAttemptAt > LOGIN_RATE_LIMIT_WINDOW_MS) {
    delete state[normalizedEmail];
    safeStorageSet(LOGIN_RATE_LIMIT_STORAGE_KEY, state);
    return null;
  }

  return entry;
};

export const getLoginRateLimitRemainingMs = (email) => {
  const entry = getLoginRateLimitEntry(email);
  if (!entry || entry.attempts < LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    return 0;
  }

  return Math.max(
    0,
    entry.firstAttemptAt + LOGIN_RATE_LIMIT_WINDOW_MS - Date.now(),
  );
};

export const recordLoginFailure = (email) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    return;
  }

  const state = getLoginRateLimitState();
  const existing = state[normalizedEmail];
  const withinWindow =
    existing &&
    Date.now() - existing.firstAttemptAt <= LOGIN_RATE_LIMIT_WINDOW_MS;

  state[normalizedEmail] = withinWindow
    ? {
        attempts: Number(existing.attempts || 0) + 1,
        firstAttemptAt: existing.firstAttemptAt,
      }
    : {
        attempts: 1,
        firstAttemptAt: Date.now(),
      };

  safeStorageSet(LOGIN_RATE_LIMIT_STORAGE_KEY, state);
};

export const clearLoginFailures = (email) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    return;
  }

  const state = getLoginRateLimitState();
  if (!(normalizedEmail in state)) {
    return;
  }

  delete state[normalizedEmail];
  safeStorageSet(LOGIN_RATE_LIMIT_STORAGE_KEY, state);
};

export const formatCooldown = (remainingMs) => {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
};

export const readPendingGoogleSignup = () =>
  safeStorageGet(PENDING_GOOGLE_SIGNUP_STORAGE_KEY, null);

export const persistPendingGoogleSignup = (draft) => {
  if (!draft?.uid || !draft?.email) {
    return;
  }

  safeStorageSet(PENDING_GOOGLE_SIGNUP_STORAGE_KEY, draft);
};

export const clearPendingGoogleSignup = () => {
  safeStorageRemove(PENDING_GOOGLE_SIGNUP_STORAGE_KEY);
};

export const readPendingGoogleFormData = () =>
  safeStorageGet(PENDING_GOOGLE_FORM_DATA_KEY, null);

export const persistPendingGoogleFormData = (formData) => {
  safeStorageSet(PENDING_GOOGLE_FORM_DATA_KEY, formData);
};

export const clearPendingGoogleFormData = () => {
  safeStorageRemove(PENDING_GOOGLE_FORM_DATA_KEY);
};

export const markRedirectInProgress = () => {
  safeStorageSet(GOOGLE_REDIRECT_IN_PROGRESS_KEY, true);
};

export const clearRedirectInProgress = () => {
  safeStorageRemove(GOOGLE_REDIRECT_IN_PROGRESS_KEY);
};

export const isRedirectInProgress = () => {
  try {
    return localStorage.getItem(GOOGLE_REDIRECT_IN_PROGRESS_KEY) === "true";
  } catch {
    return false;
  }
};
