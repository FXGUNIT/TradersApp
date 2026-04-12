import { ADMIN_UID } from "../firebase.js";
import { SCREEN_IDS } from "../../features/shell/screenIds.js";
import {
  fetchIdentityUser,
  fetchIdentityUserByEmail,
  fetchIdentityUserStatus,
  fetchIdentitySessions,
  patchIdentityUserSecurity,
  provisionIdentityUser,
  recordIdentityUserActivity,
  deleteIdentitySession,
  revokeOtherIdentitySessions,
  upsertIdentitySession,
} from "../gateways/identityGateway.js";
import {
  createBffUnavailableResult,
  hasBff,
} from "../gateways/base.js";
import {
  generateSessionId,
  getDeviceInfo,
  getSessionGeoData,
  normalizeSessionMap,
} from "../../utils/sessionUtils.js";

function normalizeUserPayload(response) {
  if (!response) {
    return null;
  }

  return response.user || response.data || response;
}

function normalizeLegacyEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function _resolveToken(authDataOrToken = "") {
  if (typeof authDataOrToken === "string") {
    return authDataOrToken;
  }

  return authDataOrToken?.token || "";
}

function createUnavailableProfileResponse(operation, authData = {}) {
  return {
    success: false,
    error: `BFF unavailable for ${operation}.`,
    profile: null,
    screen: SCREEN_IDS.LOGIN,
    userData: null,
    fullData: null,
    authData,
  };
}

function mergeProfileData(userData, authData = {}, fullData = {}) {
  const sessions = normalizeSessionMap(
    fullData?.sessions || userData?.sessions || {},
  );

  const profile = {
    uid: authData.uid ?? userData?.uid ?? null,
    token: authData.token ?? null,
    email: authData.email ?? userData?.email ?? null,
    fullName:
      userData?.fullName || userData?.displayName || userData?.email || null,
    status: userData?.status || "PENDING",
    role: userData?.role || "user",
    isLocked: Boolean(userData?.isLocked),
    country: userData?.country || "",
    city: userData?.city || "",
    instagram: userData?.instagram || "",
    linkedin: userData?.linkedin || "",
    proficiency: userData?.proficiency || "",
    authProvider: userData?.authProvider || "password",
    consentState: userData?.consentState || {},
    accountState: fullData?.accountState || {},
    firmRules: fullData?.firmRules || {},
    journal: fullData?.journal || {},
    daysUsed: Number(userData?.daysUsed ?? userData?.days_used ?? userData?.dayCounter || 0),
    days_used: Number(userData?.days_used ?? userData?.daysUsed ?? userData?.dayCounter || 0),
    dayCounter: Number(userData?.daysUsed ?? userData?.days_used ?? userData?.dayCounter || 0),
    lastActiveDay: userData?.lastActiveDay || null,
    isTrainingEligible: Boolean(userData?.isTrainingEligible),
    trainingEligibilityMessage: userData?.trainingEligibilityMessage || "",
    sessions,
  };

  return {
    userData,
    fullData,
    profile,
    screen: resolveScreenForUser(userData, authData),
  };
}

export function resolveScreenForUser(userData, authData = {}) {
  if (!userData) return SCREEN_IDS.LOGIN;
  if (userData.status === "BLOCKED") return SCREEN_IDS.LOGIN;
  if (userData.status === "PENDING") return SCREEN_IDS.WAITING;
  if (authData.uid === ADMIN_UID) return SCREEN_IDS.ADMIN;
  return SCREEN_IDS.HUB;
}

export async function findUserByEmail(email, _token = "") {
  const normalizedEmail = normalizeLegacyEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  if (!hasBff()) {
    return null;
  }

  const response = await fetchIdentityUserByEmail(normalizedEmail);
  const userData = normalizeUserPayload(response);
  if (!userData?.uid) {
    return null;
  }

  return {
    uid: userData.uid,
    userData,
  };
}

export async function loadUserProfile(authData = {}) {
  if (!authData?.uid) {
    return createUnavailableProfileResponse("loadUserProfile", authData);
  }

  if (!hasBff()) {
    return createUnavailableProfileResponse("loadUserProfile", authData);
  }

  const response = await fetchIdentityUser(authData.uid);
  const fetchedUserData = normalizeUserPayload(response);
  if (!fetchedUserData) {
    return createUnavailableProfileResponse("loadUserProfile", authData);
  }

  const activityResponse = await recordIdentityUserActivity(authData.uid, {
    activeDay: new Date().toISOString().slice(0, 10),
  }).catch(() => null);
  const userData = normalizeUserPayload(activityResponse) || fetchedUserData;

  const sessionsResponse = await fetchIdentitySessions(authData.uid);
  const sessions = normalizeSessionMap(
    sessionsResponse?.sessions ||
      sessionsResponse?.data?.sessions ||
      sessionsResponse?.data ||
      sessionsResponse ||
      {},
  );
  const fullData = {
    ...(userData || {}),
    sessions,
  };

  return mergeProfileData(userData, authData, fullData);
}

export async function loadUserProfileByUid(authData = {}) {
  return loadUserProfile(authData);
}

/**
 * @deprecated Use loadUserProfile instead.
 */
export async function loadLegacyUserProfile(authData) {
  return loadUserProfile(authData);
}

export async function updateLoginSecurityCounters(
  uid,
  patch = {},
  _authDataOrToken = "",
) {
  if (!uid) {
    return { success: false, error: "User UID is required." };
  }

  const nextPatch = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (!hasBff()) {
    return createBffUnavailableResult("updateLoginSecurityCounters");
  }

  const response = await patchIdentityUserSecurity(uid, nextPatch);
  if (!response) {
    return createBffUnavailableResult("updateLoginSecurityCounters");
  }

  return { success: true };
}

export async function provisionUserRecord(uid, payload = {}, _authDataOrToken = "") {
  if (!uid) {
    return null;
  }

  if (!hasBff()) {
    return createBffUnavailableResult("provisionUserRecord", { user: null });
  }

  const response = await provisionIdentityUser(uid, payload);
  const provisionedUser = normalizeUserPayload(response);
  if (provisionedUser) {
    return provisionedUser;
  }

  return createBffUnavailableResult("provisionUserRecord", { user: null });
}

export async function listUserSessions(uid, _token = "") {
  if (!uid) {
    return createBffUnavailableResult("listUserSessions", { sessions: {} });
  }

  if (!hasBff()) {
    return createBffUnavailableResult("listUserSessions", { sessions: {} });
  }

  const response = await fetchIdentitySessions(uid);
  return normalizeSessionMap(
    response?.sessions || response?.data?.sessions || response?.data || response,
  );
}

export async function createUserSession(uid, token, rememberMe) {
  if (!uid || !hasBff()) {
    return null;
  }

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

    const response = await upsertIdentitySession(uid, sessionId, sessionData);
    if (!response) {
      return null;
    }

    if (rememberMe) {
      const encryptedSession = btoa(
        JSON.stringify({
          uid,
          sessionId,
          expiresAt: expiresAt.toISOString(),
          token: token || "",
        }),
      );
      localStorage.setItem(`sess_${uid}`, encryptedSession);
    }

    return sessionId;
  } catch (error) {
    console.error("Session creation failed:", error);
    return null;
  }
}

export async function revokeUserSession(uid, sessionId, _token = "") {
  if (!uid || !sessionId || !hasBff()) {
    return false;
  }

  const response = await deleteIdentitySession(uid, sessionId);
  return Boolean(response);
}

export async function revokeOtherUserSessions(uid, currentSessionId, _token = "") {
  if (!uid || !hasBff()) {
    return false;
  }

  const response = await revokeOtherIdentitySessions(uid, currentSessionId);
  return Boolean(response);
}

export async function getUserStatusByUid(uid, _authDataOrToken = "") {
  if (!uid) {
    return null;
  }

  if (!hasBff()) {
    return null;
  }

  const response = await fetchIdentityUserStatus(uid);
  const status =
    typeof response?.status === "string"
      ? response.status
      : typeof response?.data?.status === "string"
        ? response.data.status
        : null;
  return status;
}

export default {
  createUserSession,
  findUserByEmail,
  getUserStatusByUid,
  listUserSessions,
  loadUserProfile,
  loadLegacyUserProfile,
  loadUserProfileByUid,
  provisionUserRecord,
  resolveScreenForUser,
  revokeOtherUserSessions,
  revokeUserSession,
  updateLoginSecurityCounters,
};
