import { sendVerificationLinkForUser } from "./authSessionUtils.js";
import { auth as firebaseAuth } from "../../services/firebase.js";

export const executeSyncAuthSessionFromUser = async ({
  user,
  stayLoggedIn = false,
  createSyncedAuthSession,
  setAuth,
  setCurrentSessionId,
}) => {
  const { authData, sessionId } = await createSyncedAuthSession(
    user,
    stayLoggedIn,
  );
  setAuth(authData);
  if (sessionId) {
    setCurrentSessionId(sessionId);
  }
  return authData;
};

export const executeSendVerificationLink = async () => {
  await sendVerificationLinkForUser(firebaseAuth?.currentUser);
};

export default {
  executeSyncAuthSessionFromUser,
  executeSendVerificationLink,
};
