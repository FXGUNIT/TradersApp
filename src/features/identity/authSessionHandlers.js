import { sendVerificationLinkForUser } from "./authSessionUtils.js";

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

export const executeSendVerificationLink = async ({ firebaseAuth }) => {
  await sendVerificationLinkForUser(firebaseAuth?.currentUser);
};

export default {
  executeSyncAuthSessionFromUser,
  executeSendVerificationLink,
};
