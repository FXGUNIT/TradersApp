import { ADMIN_UID } from "../firebase.js";
import { dbM, dbR } from "../../utils/firebaseDbUtils.js";
import { assembleLegacyProfile } from "../../features/shell/profileAssembler.js";
import { SCREEN_IDS } from "../../features/shell/screenIds.js";
import {
  fetchIdentityUser,
  fetchIdentityUserByEmail,
  fetchIdentityUserStatus,
  patchIdentityUserSecurity,
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

function mergeProfileData(userData, authData = {}, fullData = {}) {
  return {
    userData,
    fullData,
    profile: assembleLegacyProfile(userData, authData, fullData),
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
    try {
      const response = await fetchIdentityUserByEmail(normalizedEmail);
      const userData = normalizeUserPayload(response);
      if (userData?.uid) {
        return {
          uid: userData.uid,
          userData,
        };
      }
    } catch (error) {
      console.warn("BFF email lookup failed, falling back to Firebase:", error);
    }
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
    try {
      const response = await fetchIdentityUser(authData.uid);
      userData = normalizeUserPayload(response);
    } catch (error) {
      console.warn("BFF identity load failed, falling back to Firebase:", error);
    }
  }

  if (!userData) {
    userData = await dbR(`users/${authData.uid}`, authData.token);
  }

  if (!userData) {
    return {
      profile: null,
      screen: SCREEN_IDS.LOGIN,
      userData: null,
      fullData: null,
    };
  }

  const legacyFullData = await dbR(`users/${authData.uid}`, authData.token);
  const sessionsFromBff = await listSessionRecords(authData.uid, authData.token);

  fullData = {
    ...(legacyFullData || {}),
    ...(userData || {}),
    sessions: normalizeSessionMap(
      sessionsFromBff || legacyFullData?.sessions || userData?.sessions,
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

  const token =
    typeof authDataOrToken === "string"
      ? authDataOrToken
      : authDataOrToken?.token || "";

  const nextPatch = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (hasBff()) {
    try {
      await patchIdentityUserSecurity(uid, nextPatch);
    } catch (error) {
      console.warn("BFF security update failed, falling back to Firebase:", error);
    }
  }

  try {
    await dbM(`users/${uid}`, nextPatch, token);
  } catch (error) {
    console.warn("Legacy security counter update failed:", error);
  }

  return { success: true };
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

export async function getUserStatusByUid(uid) {
  if (!uid) {
    return null;
  }

  if (hasBff()) {
    try {
      const response = await fetchIdentityUserStatus(uid);
      return response?.status || response?.data?.status || response || null;
    } catch (error) {
      console.warn("BFF status lookup failed, falling back to Firebase:", error);
    }
  }

  const user = await dbR(`users/${uid}`, "");
  return user?.status || null;
}

export default {
  createUserSession,
  findUserByEmail,
  getUserStatusByUid,
  listUserSessions,
  loadLegacyUserProfile,
  loadUserProfileByUid,
  resolveScreenForUser,
  revokeOtherUserSessions,
  revokeUserSession,
  updateLoginSecurityCounters,
};
