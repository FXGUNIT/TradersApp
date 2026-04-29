import { useCallback } from "react";
import { auth as firebaseAuth } from "../../services/firebase.js";
import { clearLastScreen, clearConsciousnessReturnScreen } from "./authFlowStorage.js";
import { executeCheckUserStatus } from "./authRoutingHandlers.js";
import {
  executeSyncAuthSessionFromUser,
  executeSendVerificationLink,
} from "./authSessionHandlers.js";
import { createSyncedAuthSession } from "./authSessionUtils.js";
import {
  executePasswordReset,
  executeResendVerificationEmail,
  executeApprovalStatusCheck,
} from "./authActionHandlers.js";
import {
  executeLoginPasswordReset,
  executeLogin,
  executeStructuredSignup,
  executeStructuredGoogleAuth,
} from "./authCredentialHandlers.js";
import { clearUserListCache } from "../../utils/userUtils.js";
import {
  clearAdminToken,
  clearRememberedSession,
} from "../../services/sessionStore.js";

export function useAuthSessionHandlers({
  auth,
  profile,
  isValidGmailAddress,
  getLoginRateLimitRemainingMs,
  formatCooldown,
  findIdentityUserByEmail,
  clearLoginFailures,
  recordLoginFailure,
  loadUserProfile,
  updateLoginSecurityCounters,
  sendForensicAlert,
  isPasswordExpired,
  setAuth,
  setCurrentSessionId,
  setProfile,
  setScreen,
  showToast,
  googleUser,
  ADMIN_UID,
  ADMIN_EMAIL,
  readPendingGoogleSignup,
  persistPendingGoogleSignup,
  clearPendingGoogleSignup,
  resolveRestorableScreen,
  resolveConsciousnessReturnScreen,
  setConsciousnessReturnScreen,
  SCREEN_IDS,
  setGoogleUser,
  submitOnboardingApplication,
  provisionIdentityUserRecord,
  buildPendingProfile,
  sendWelcomeEmail,
  sendTelegramAlert,
  setIsAdminAuthenticated,
  setShowAdminPrompt,
  setAdminMasterEmail,
  setAdminMasterEmailVerified,
  setAdminOtpStep,
  setAdminOtpsVerified,
  setAdminOtps,
  setAdminMfaChallengeId,
  setAdminOtpChallengeId,
  setAdminOtpRecipients,
  setAdminOtpErr,
}) {

  const checkUserStatus = useCallback(
    async (authData) => {
      await executeCheckUserStatus({
        authData,
        currentProfile: profile,
        loadUserProfile,
        readPendingGoogleSignup,
        persistPendingGoogleSignup,
        setGoogleUser,
        setProfile,
        setScreen,
        showToast,
        ADMIN_UID,
        resolveRestorableScreen,
        resolveConsciousnessReturnScreen,
        setConsciousnessReturnScreen,
        clearPendingGoogleSignup,
        SCREEN_IDS,
      });
    },
    [
      ADMIN_UID,
      SCREEN_IDS,
      clearPendingGoogleSignup,
      loadUserProfile,
      persistPendingGoogleSignup,
      readPendingGoogleSignup,
      resolveConsciousnessReturnScreen,
      resolveRestorableScreen,
      setConsciousnessReturnScreen,
      setGoogleUser,
      profile,
      setProfile,
      setScreen,
      showToast,
    ],
  );

  const syncAuthSessionFromUser = useCallback(
    async (user, stayLoggedIn = false) =>
      executeSyncAuthSessionFromUser({
        user,
        stayLoggedIn,
        createSyncedAuthSession,
        setAuth,
        setCurrentSessionId,
      }),
    [setAuth, setCurrentSessionId],
  );

  const sendVerificationLink = useCallback(
    async () => executeSendVerificationLink(),
    [],
  );

  const handleLoginPasswordReset = useCallback(
    async (email) =>
      executeLoginPasswordReset({
        email,
        isValidGmailAddress,
      }),
    [isValidGmailAddress],
  );

  const handleLogin = useCallback(
    async (email, password, stayLoggedIn = false) =>
      executeLogin({
        email,
        password,
        stayLoggedIn,
        isValidGmailAddress,
        getLoginRateLimitRemainingMs,
        formatCooldown,
        findIdentityUserByEmail,
        clearLoginFailures,
        recordLoginFailure,
        loadUserProfile,
        updateLoginSecurityCounters,
        sendForensicAlert,
        isPasswordExpired,
        syncAuthSessionFromUser,
        setAuth,
        setCurrentSessionId,
        setProfile,
        setScreen,
        showToast,
        checkUserStatus,
        provisionIdentityUserRecord,
        ADMIN_UID,
        sendTelegramAlert,
      }),
    [
      ADMIN_UID,
      checkUserStatus,
      clearLoginFailures,
      findIdentityUserByEmail,
      formatCooldown,
      getLoginRateLimitRemainingMs,
      isPasswordExpired,
      isValidGmailAddress,
      loadUserProfile,
      provisionIdentityUserRecord,
      recordLoginFailure,
      sendForensicAlert,
      sendTelegramAlert,
      setAuth,
      setCurrentSessionId,
      setProfile,
      setScreen,
      showToast,
      syncAuthSessionFromUser,
      updateLoginSecurityCounters,
    ],
  );

  const handleStructuredSignup = useCallback(
    async (formData) =>
      executeStructuredSignup({
        formData,
        googleUser,
        isValidGmailAddress,
        findIdentityUserByEmail,
        sendVerificationLink,
        syncAuthSessionFromUser,
        buildPendingProfile,
        submitOnboardingApplication,
        provisionIdentityUserRecord,
        sendWelcomeEmail,
        sendTelegramAlert,
        setAuth,
        setProfile,
        setGoogleUser,
        clearPendingGoogleSignup,
        setScreen,
        showToast,
        checkUserStatus,
        ADMIN_EMAIL,
        sendForensicAlert,
      }),
    [
      ADMIN_EMAIL,
      buildPendingProfile,
      checkUserStatus,
      clearPendingGoogleSignup,
      findIdentityUserByEmail,
      isValidGmailAddress,
      provisionIdentityUserRecord,
      sendForensicAlert,
      sendTelegramAlert,
      sendVerificationLink,
      sendWelcomeEmail,
      googleUser,
      setAuth,
      setGoogleUser,
      setProfile,
      setScreen,
      showToast,
      submitOnboardingApplication,
      syncAuthSessionFromUser,
    ],
  );

  const handleStructuredGoogleAuth = useCallback(
    async (applicationData = null, authenticatedUser = null) =>
      executeStructuredGoogleAuth({
        applicationData,
        authenticatedUser,
        isValidGmailAddress,
        syncAuthSessionFromUser,
        loadUserProfile,
        handleStructuredSignup,
        persistPendingGoogleSignup,
        setGoogleUser,
        clearPendingGoogleSignup,
        setScreen,
        checkUserStatus,
      }),
    [
      checkUserStatus,
      clearPendingGoogleSignup,
      handleStructuredSignup,
      isValidGmailAddress,
      loadUserProfile,
      persistPendingGoogleSignup,
      setGoogleUser,
      setScreen,
      syncAuthSessionFromUser,
    ],
  );

  // Handles the result of signInWithRedirect after OAuth redirect returns to the page
  const handleGoogleRedirectResult = useCallback(
    async (authenticatedUser, pendingFormData = null) => {
      await handleStructuredGoogleAuth(pendingFormData, authenticatedUser);
    },
    [handleStructuredGoogleAuth],
  );

  const handleBackToLoginFromSignup = useCallback(async () => {
    clearPendingGoogleSignup();
    setGoogleUser(null);

    if (
      firebaseAuth?.currentUser &&
      firebaseAuth.currentUser.providerData?.some(
        (p) => p?.providerId === "google.com",
      )
    ) {
      try {
        await firebaseAuth.signOut();
      } catch (error) {
        console.warn("Failed to clear pending Google session:", error);
      }
    }

    setAuth(null);
    setProfile(null);
    setScreen("login");
  }, [
    clearPendingGoogleSignup,
    setAuth,
    setGoogleUser,
    setProfile,
    setScreen,
  ]);

  const handlePasswordReset = useCallback(
    async (newPassword) =>
      executePasswordReset({
        newPassword,
        auth,
        profile,
        provisionIdentityUserRecord,
        setProfile,
        checkUserStatus,
        showToast,
      }),
    [
      auth,
      checkUserStatus,
      profile,
      provisionIdentityUserRecord,
      setProfile,
      showToast,
    ],
  );

  const handleResendVerificationEmail = useCallback(
    async () =>
      executeResendVerificationEmail({
        sendVerificationLink,
        setAuth,
        showToast,
      }),
    [sendVerificationLink, setAuth, showToast],
  );

  const checkApprovalStatus = useCallback(
    async () =>
      executeApprovalStatusCheck({
        auth,
        profile,
        checkUserStatus,
        setAuth,
      }),
    [auth, checkUserStatus, profile, setAuth],
  );

  const handleLogout = useCallback(async () => {
    const activeUid = auth?.uid;
    try {
      if (firebaseAuth?.signOut) {
        await firebaseAuth.signOut();
      }
    } catch (error) {
      console.warn("Error signing out:", error);
    }

    clearUserListCache();
    localStorage.removeItem("isAdminAuthenticated");
    localStorage.removeItem("admin_session");
    await clearAdminToken();
    if (activeUid) {
      clearLastScreen(activeUid);
      clearConsciousnessReturnScreen(activeUid);
      await clearRememberedSession(activeUid);
    }
    clearPendingGoogleSignup();
    setGoogleUser(null);
    setAuth(null);
    setProfile(null);
    setIsAdminAuthenticated(false);
    setShowAdminPrompt(false);
    setAdminMasterEmail("");
    setAdminMasterEmailVerified(false);
    setAdminOtpStep(false);
    setAdminOtpsVerified(false);
    setAdminOtps({ otp1: "", otp2: "", otp3: "" });
    setAdminMfaChallengeId("");
    setAdminOtpChallengeId("");
    setAdminOtpRecipients([]);
    setAdminOtpErr("");
    setScreen("login");
  }, [
    auth?.uid,
    clearPendingGoogleSignup,
    setAdminMasterEmail,
    setAdminMasterEmailVerified,
    setAdminMfaChallengeId,
    setAdminOtpChallengeId,
    setAdminOtpRecipients,
    setAdminOtpErr,
    setAdminOtpStep,
    setAdminOtps,
    setAdminOtpsVerified,
    setAuth,
    setGoogleUser,
    setIsAdminAuthenticated,
    setProfile,
    setScreen,
    setShowAdminPrompt,
  ]);

  return {
    checkUserStatus,
    syncAuthSessionFromUser,
    sendVerificationLink,
    handleLoginPasswordReset,
    handleLogin,
    handleStructuredSignup,
    handleStructuredGoogleAuth,
    handleBackToLoginFromSignup,
    handlePasswordReset,
    handleResendVerificationEmail,
    checkApprovalStatus,
    handleLogout,
  };
}

export default useAuthSessionHandlers;
