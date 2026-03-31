export const executeCheckUserStatus = async ({
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
}) => {
  try {
    const {
      profile: nextProfile,
      screen: nextScreen,
      userData,
    } = await loadLegacyUserProfile(authData);

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
