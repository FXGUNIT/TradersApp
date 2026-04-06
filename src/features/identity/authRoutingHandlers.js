import { isPasswordExpired } from "../../utils/securityUtils.js";
import { auth as firebaseAuth } from "../../services/firebase.js";

export const executeCheckUserStatus = async ({
  authData,
  currentProfile = null,
  loadUserProfile: suppliedLoadUserProfile,
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
}) => {
  const loadUserProfile = suppliedLoadUserProfile;

  try {
    const auditData =
      typeof window !== "undefined" ? window.__TRADERS_AUDIT_DATA : null;
    if (auditData?.active) {
      const auditProfile = auditData.userProfile || auditData.adminProfile || null;

      if (!auditProfile) {
        setGoogleUser(null);
        setProfile(null);
        setScreen(SCREEN_IDS.LOGIN);
        return;
      }

      clearPendingGoogleSignup();
      setGoogleUser(null);
      setProfile({
        ...auditProfile,
        uid: authData?.uid || auditProfile.uid,
        token: authData?.token || auditProfile.token,
        email: authData?.email || auditProfile.email,
        emailVerified: authData?.emailVerified ?? true,
      });

      const normalizedStatus = String(auditProfile.status || "ACTIVE").toUpperCase();
      if (authData?.uid === ADMIN_UID || auditProfile.role === "admin") {
        setScreen(SCREEN_IDS.ADMIN);
        return;
      }

      if (normalizedStatus === "BLOCKED") {
        setScreen(SCREEN_IDS.LOGIN);
        return;
      }

      if (normalizedStatus === "PENDING" || authData?.emailVerified === false) {
        setScreen(SCREEN_IDS.WAITING);
        return;
      }

      if (
        auditProfile?.passwordLastChanged &&
        isPasswordExpired(auditProfile.passwordLastChanged)
      ) {
        setScreen(SCREEN_IDS.FORCE_PASSWORD_RESET);
        return;
      }

      const restoreUid = authData?.uid || auditProfile.uid;
      const restoredScreen = resolveRestorableScreen(restoreUid, SCREEN_IDS.HUB);
      setConsciousnessReturnScreen(
        resolveConsciousnessReturnScreen(restoreUid, SCREEN_IDS.HUB),
      );
      setScreen(restoredScreen);
      return;
    }

    const {
      success,
      error: profileLoadError,
      profile: nextProfile,
      screen: nextScreen,
      userData,
    } = await loadUserProfile(authData);

    if (success === false && !userData && !nextProfile) {
      const fallbackScreen =
        authData?.uid === ADMIN_UID || currentProfile?.role === "admin"
          ? SCREEN_IDS.ADMIN
          : authData?.emailVerified === false ||
              currentProfile?.status === "PENDING"
            ? SCREEN_IDS.WAITING
            : currentProfile?.passwordLastChanged &&
                isPasswordExpired(currentProfile.passwordLastChanged)
              ? SCREEN_IDS.FORCE_PASSWORD_RESET
              : resolveRestorableScreen(authData.uid, SCREEN_IDS.HUB);

      setGoogleUser(null);
      setProfile((existingProfile) =>
        existingProfile || {
          uid: authData.uid,
          token: authData.token,
          email: authData.email,
          emailVerified: authData.emailVerified,
          status:
            fallbackScreen === SCREEN_IDS.WAITING ? "PENDING" : "ACTIVE",
          role:
            currentProfile?.role ||
            (authData?.uid === ADMIN_UID ? "admin" : "user"),
          passwordLastChanged: currentProfile?.passwordLastChanged,
        },
      );
      console.warn(
        "Profile load unavailable during status check:",
        profileLoadError || "Unknown error",
      );
      setScreen(fallbackScreen);
      return;
    }

    if (!userData || !nextProfile) {
      const currentUser = firebaseAuth?.currentUser;
      const googleDraft =
        readPendingGoogleSignup() ||
        (currentUser?.providerData?.some(
          (provider) => provider?.providerId === "google.com",
        )
          ? {
              uid: authData.uid,
              email: authData.email,
              fullName:
                currentUser.displayName || authData.email?.split("@")[0] || "",
              authProvider: "google",
            }
          : null);

      if (googleDraft?.uid === authData.uid) {
        persistPendingGoogleSignup(googleDraft);
        setGoogleUser(googleDraft);
        setProfile({
          ...googleDraft,
          uid: authData.uid,
          token: authData.token,
          email: authData.email,
          emailVerified: authData.emailVerified,
          status: "DRAFT",
        });
        setScreen(SCREEN_IDS.SIGNUP);
        return;
      }

      setGoogleUser(null);
      setProfile(null);
      setScreen(SCREEN_IDS.LOGIN);
      return;
    }

    clearPendingGoogleSignup();
    setGoogleUser(null);
    setProfile({
      ...nextProfile,
      emailVerified: authData.emailVerified,
    });

    if (userData.status === "BLOCKED") {
      setScreen(SCREEN_IDS.LOGIN);
      showToast(
        "Account entered stasis mode. Contact the digital guardians.",
        "error",
      );
      return;
    }

    if (userData.status === "PENDING" || authData.emailVerified === false) {
      setScreen(SCREEN_IDS.WAITING);
      return;
    }

    if (
      userData.passwordLastChanged &&
      isPasswordExpired(userData.passwordLastChanged)
    ) {
      setScreen(SCREEN_IDS.FORCE_PASSWORD_RESET);
      return;
    }

    if (authData.uid === ADMIN_UID) {
      setScreen(SCREEN_IDS.ADMIN);
      return;
    }

    const fallbackScreen = nextScreen || SCREEN_IDS.HUB;
    const restoredScreen = resolveRestorableScreen(authData.uid, fallbackScreen);
    setConsciousnessReturnScreen(
      resolveConsciousnessReturnScreen(authData.uid, SCREEN_IDS.HUB),
    );
    setScreen(restoredScreen);
  } catch (error) {
    console.error("Status check failed", error);
    if (
      error?.message?.includes("auth") ||
      error?.code?.includes("auth") ||
      error?.message?.includes("permission")
    ) {
      setScreen(SCREEN_IDS.LOGIN);
    }
  }
};

export default {
  executeCheckUserStatus,
};
