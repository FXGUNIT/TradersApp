import { useCallback } from "react";
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

export function useAuthSessionHandlers({
  auth,
  profile,
  firebaseAuth,
  FB_KEY,
  googleProvider,
  isValidGmailAddress,
  getLoginRateLimitRemainingMs,
  formatCooldown,
  findIdentityUserByEmail,
  clearLoginFailures,
  recordLoginFailure,
  loadLegacyUserProfile,
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
  setAdminPassInput,
  setAdminPassErr,
  setAdminOtpErr,
}) {
  const checkUserStatus = useCallback(
    async (authData) => {
      await executeCheckUserStatus({
        authData,
        loadLegacyUserProfile,
        firebaseAuth,
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
      firebaseAuth,
      loadLegacyUserProfile,
      persistPendingGoogleSignup,
      readPendingGoogleSignup,
      resolveConsciousnessReturnScreen,
      resolveRestorableScreen,
      setConsciousnessReturnScreen,
      setGoogleUser,
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
    async () => executeSendVerificationLink({ firebaseAuth }),
    [firebaseAuth],
  );

  const handleLoginPasswordReset = useCallback(
    async (email) =>
      executeLoginPasswordReset({
        email,
        firebaseAuth,
        isValidGmailAddress,
      }),
    [firebaseAuth, isValidGmailAddress],
  );

  const handleLogin = useCallback(
    async (email, password, stayLoggedIn = false) =>
      executeLogin({
        email,
        password,
        stayLoggedIn,
        firebaseAuth,
        FB_KEY,
        isValidGmailAddress,
        getLoginRateLimitRemainingMs,
        formatCooldown,
        findIdentityUserByEmail,
        clearLoginFailures,
        recordLoginFailure,
        loadLegacyUserProfile,
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
      FB_KEY,
      checkUserStatus,
      clearLoginFailures,
      firebaseAuth,
      findIdentityUserByEmail,
      formatCooldown,
      getLoginRateLimitRemainingMs,
      isPasswordExpired,
      isValidGmailAddress,
      loadLegacyUserProfile,
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
        firebaseAuth,
        FB_KEY,
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
      FB_KEY,
      buildPendingProfile,
      checkUserStatus,
      clearPendingGoogleSignup,
      firebaseAuth,
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
        firebaseAuth,
        FB_KEY,
        googleProvider,
        isValidGmailAddress,
        syncAuthSessionFromUser,
        loadLegacyUserProfile,
        handleStructuredSignup,
        persistPendingGoogleSignup,
        setGoogleUser,
        clearPendingGoogleSignup,
        setScreen,
        checkUserStatus,
      }),
    [
      FB_KEY,
      checkUserStatus,
      clearPendingGoogleSignup,
      firebaseAuth,
      googleProvider,
      handleStructuredSignup,
      isValidGmailAddress,
      loadLegacyUserProfile,
      persistPendingGoogleSignup,
      setGoogleUser,
      setScreen,
      syncAuthSessionFromUser,
    ],
  );

  const handleBackToLoginFromSignup = useCallback(async () => {
    clearPendingGoogleSignup();
    setGoogleUser(null);

    if (
      firebaseAuth?.currentUser &&
      firebaseAuth.currentUser.providerData?.some(
        (provider) => provider?.providerId === "google.com",
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
    firebaseAuth,
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
        firebaseAuth,
        provisionIdentityUserRecord,
        setProfile,
        checkUserStatus,
        showToast,
      }),
    [
      auth,
      checkUserStatus,
      firebaseAuth,
      profile,
      provisionIdentityUserRecord,
      setProfile,
      showToast,
    ],
  );

  const handleResendVerificationEmail = useCallback(
    async () =>
      executeResendVerificationEmail({
        firebaseAuth,
        sendVerificationLink,
        setAuth,
        showToast,
      }),
    [firebaseAuth, sendVerificationLink, setAuth, showToast],
  );

  const checkApprovalStatus = useCallback(
    async () =>
      executeApprovalStatusCheck({
        auth,
        profile,
        firebaseAuth,
        checkUserStatus,
        setAuth,
      }),
    [auth, checkUserStatus, firebaseAuth, profile, setAuth],
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
    if (activeUid) {
      clearLastScreen(activeUid);
      clearConsciousnessReturnScreen(activeUid);
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
    setAdminPassInput("");
    setAdminPassErr("");
    setAdminOtpErr("");
    setScreen("login");
  }, [
    auth?.uid,
    clearConsciousnessReturnScreen,
    clearLastScreen,
    clearPendingGoogleSignup,
    firebaseAuth,
    setAdminMasterEmail,
    setAdminMasterEmailVerified,
    setAdminOtpErr,
    setAdminOtpStep,
    setAdminOtps,
    setAdminOtpsVerified,
    setAdminPassErr,
    setAdminPassInput,
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
