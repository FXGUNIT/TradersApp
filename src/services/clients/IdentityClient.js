import { ADMIN_UID } from "../firebase.js";
import { dbM, dbR } from "../../utils/firebaseDbUtils.js";
import { SCREEN_IDS } from "../../features/shell/screenIds.js";
import {
  fetchIdentityUser,
  fetchIdentityUserByEmail,
  fetchIdentityUserStatus,
  patchIdentityUserSecurity,
  provisionIdentityUser,
} from "../gateways/identityGateway.js";
import { hasBff } from "../gateways/base.js";
import {
  createSession as createSessionRecord,
  listSessions as listSessionRecords,
  logoutOtherDevices as revokeOtherSessions,
  normalizeSessionMap,
  revokeSession as revokeSessionRecord,
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

function resolveToken(authDataOrToken = "") {
  if (typeof authDataOrToken === "string") {
    return authDataOrToken;
  }

  return authDataOrToken?.token || "";
}

async function readLegacyUser(uid, token = "") {
  if (!uid) {
    return null;
  }

  try {
    return await dbR(`users/${uid}`, token);
  } catch (error) {
    console.warn("Legacy identity read failed:", error);
    return null;
  }
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

export async function findUserByEmail(email, token = "") {
  const normalizedEmail = normalizeLegacyEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  if (hasBff()) {
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

  const allUsers = (await dbR("users", token)) || {};
  const match = Object.entries(allUsers).find(
    ([, user]) => normalizeLegacyEmail(user?.email) === normalizedEmail,
  );

  if (!match) {
    return null;
  }

  return {
    uid: match[0],
    userData: match[1],
  };
}

export async function loadUserProfileByUid(authData = {}) {
  if (!authData?.uid) {
    return {
      profile: null,
      screen: SCREEN_IDS.LOGIN,
      userData: null,
      fullData: null,
    };
  }

  let userData = null;
  let fullData = null;

  if (hasBff()) {
    const response = await fetchIdentityUser(authData.uid);
    userData = normalizeUserPayload(response);
    if (!userData) {
      return {
        profile: null,
        screen: SCREEN_IDS.LOGIN,
        userData: null,
        fullData: null,
      };
    }

    const sessionsFromBff = normalizeSessionMap(
      await listSessionRecords(authData.uid, authData.token),
    );

    fullData = {
      ...(userData || {}),
      sessions: sessionsFromBff || userData?.sessions || {},
    };

    return mergeProfileData(userData, authData, fullData);
  }

  userData = await readLegacyUser(authData.uid, authData.token);
  if (!userData) {
    return {
      profile: null,
      screen: SCREEN_IDS.LOGIN,
      userData: null,
      fullData: null,
    };
  }

  const legacyFullData = await readLegacyUser(authData.uid, authData.token);
  fullData = {
    ...(legacyFullData || {}),
    ...(userData || {}),
    sessions: normalizeSessionMap(
      legacyFullData?.sessions || userData?.sessions || {},
    ),
  };

  return mergeProfileData(userData, authData, fullData);
}

export async function loadLegacyUserProfile(authData) {
  return loadUserProfileByUid(authData);
}

export async function updateLoginSecurityCounters(
  uid,
  patch = {},
  authDataOrToken = "",
) {
  if (!uid) {
    return { success: false, error: "User UID is required." };
  }

  const token = resolveToken(authDataOrToken);
  const nextPatch = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (hasBff()) {
    const response = await patchIdentityUserSecurity(uid, nextPatch);
    if (response) {
      return { success: true };
    }
  }

  try {
    await dbM(`users/${uid}`, nextPatch, token);
  } catch (error) {
    console.warn("Legacy security counter update failed:", error);
  }

  return { success: true };
}

export async function provisionUserRecord(uid, payload = {}, authDataOrToken = "") {
  if (!uid) {
    return null;
  }

  const token = resolveToken(authDataOrToken);

  if (hasBff()) {
    const response = await provisionIdentityUser(uid, payload);
    const provisionedUser = normalizeUserPayload(response);
    if (provisionedUser) {
      return provisionedUser;
    }
  }

  try {
    await dbM(`users/${uid}`, payload, token);
  } catch (error) {
    console.warn("Legacy identity provision failed:", error);
  }

  return await readLegacyUser(uid, token);
}

export async function listUserSessions(uid, token = "") {
  return normalizeSessionMap(await listSessionRecords(uid, token));
}

export async function createUserSession(uid, token, rememberMe) {
  return createSessionRecord(uid, token, rememberMe);
}

export async function revokeUserSession(uid, sessionId, token = "") {
  return revokeSessionRecord(uid, sessionId, token);
}

export async function revokeOtherUserSessions(uid, currentSessionId, token = "") {
  return revokeOtherSessions(uid, currentSessionId, token);
}

export async function getUserStatusByUid(uid, authDataOrToken = "") {
  if (!uid) {
    return null;
  }

  if (hasBff()) {
    const response = await fetchIdentityUserStatus(uid);
    return response?.status || response?.data?.status || response || null;
  }

  const user = await readLegacyUser(uid, resolveToken(authDataOrToken));
  return user?.status || null;
}

export default {
  createUserSession,
  findUserByEmail,
  getUserStatusByUid,
  listUserSessions,
  loadLegacyUserProfile,
  loadUserProfileByUid,
  provisionUserRecord,
  resolveScreenForUser,
  revokeOtherUserSessions,
  revokeUserSession,
  updateLoginSecurityCounters,
};
