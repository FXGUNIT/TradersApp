import { ADMIN_UID } from "../firebase.js";
import { dbR } from "../../utils/firebaseDbUtils.js";
import { assembleLegacyProfile } from "../../features/shell/profileAssembler.js";
import { SCREEN_IDS } from "../../features/shell/screenIds.js";

export function resolveScreenForUser(userData, authData = {}) {
  if (!userData) return SCREEN_IDS.LOGIN;
  if (userData.status === "BLOCKED") return SCREEN_IDS.LOGIN;
  if (userData.status === "PENDING") return SCREEN_IDS.WAITING;
  if (authData.uid === ADMIN_UID) return SCREEN_IDS.ADMIN;
  return SCREEN_IDS.HUB;
}

export async function loadLegacyUserProfile(authData) {
  const userData = await dbR(`users/${authData.uid}`, authData.token);
  if (!userData) {
    return {
      profile: null,
      screen: SCREEN_IDS.LOGIN,
      userData: null,
    };
  }

  const fullData = await dbR(`users/${authData.uid}`, authData.token);
  return {
    userData,
    fullData,
    profile: assembleLegacyProfile(userData, authData, fullData),
    screen: resolveScreenForUser(userData, authData),
  };
}

export default {
  loadLegacyUserProfile,
  resolveScreenForUser,
};
