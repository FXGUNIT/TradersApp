import {
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { buildPendingProfile } from "./authSessionUtils.js";

const ADMIN_EMAIL = "master@tradersregiment.com";

export const executeLoginPasswordReset = async ({
  email,
  firebaseAuth,
  isValidGmailAddress,
}) => {
  const cleanEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!cleanEmail) {
    throw new Error("Please enter your Gmail address.");
  }

  if (!isValidGmailAddress(cleanEmail)) {
    throw new Error("Only Gmail addresses are allowed.");
  }

  if (
    !firebaseAuth ||
    (typeof window !== "undefined" && window.__TRADERS_AUDIT_DATA)
  ) {
    return "Audit mode: password reset link simulated.";
  }

  await sendPasswordResetEmail(firebaseAuth, cleanEmail);
  return "Password reset email sent. Check your Gmail inbox and spam folder.";
};

export const executeLogin = async ({
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
}) => {
  const sanitizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const blockedEmails = ["arkgproductions@gmail.com", "starg.unit@gmail.com"];

  if (!sanitizedEmail || !password) {
    throw new Error("Email and password are required.");
  }

  if (!isValidGmailAddress(sanitizedEmail)) {
    throw new Error("Only Gmail addresses are allowed.");
  }

  if (blockedEmails.includes(sanitizedEmail)) {
    throw new Error(
      "Access Denied: This account has been permanently restricted.",
    );
  }

  const remainingCooldownMs = getLoginRateLimitRemainingMs(sanitizedEmail);
  if (remainingCooldownMs > 0) {
    throw new Error(
      `Too many login attempts. Try again in ${formatCooldown(remainingCooldownMs)}.`,
    );
  }

  if (!firebaseAuth || !FB_KEY) {
    const auditProfile =
      typeof window !== "undefined"
        ? window.__TRADERS_AUDIT_DATA?.userProfile ||
          window.__TRADERS_AUDIT_DATA?.adminProfile ||
          null
        : null;
    const simulatedUid =
      auditProfile?.uid ||
      `audit-${sanitizedEmail.replace(/[^a-z0-9]/gi, "") || "user"}`;
    const simulatedToken = `audit-token-${simulatedUid}`;
    const simulatedAuth = {
      uid: simulatedUid,
      token: simulatedToken,
      refreshToken: `audit-refresh-${simulatedUid}`,
      email: auditProfile?.email || sanitizedEmail,
      emailVerified: auditProfile?.emailVerified ?? true,
    };
    setAuth(simulatedAuth);
    setCurrentSessionId("audit-session");
    setProfile({
      ...(auditProfile || {}),
      uid: simulatedUid,
      token: simulatedToken,
      email: simulatedAuth.email,
      emailVerified: simulatedAuth.emailVerified,
      status: auditProfile?.status || "ACTIVE",
    });
    setScreen(auditProfile?.status === "PENDING" ? "waiting" : "hub");
    return;
  }

  const currentEmail = firebaseAuth.currentUser?.email?.toLowerCase();
  if (currentEmail && currentEmail !== sanitizedEmail) {
    showToast(
      "Session collision detected. Previous timeline still active.",
      "error",
    );
    return;
  }

  try {
    await setPersistence(firebaseAuth, browserLocalPersistence);
  } catch (error) {
    console.warn("Failed to set persistence:", error);
  }

  const existingRecord = await findIdentityUserByEmail(sanitizedEmail);
  if (existingRecord?.userData?.isLocked) {
    throw new Error(
      "Account Locked: Too many failed attempts. Contact Master Admin.",
    );
  }

  try {
    const userCredential = await signInWithEmailAndPassword(
      firebaseAuth,
      sanitizedEmail,
      password,
    );
    const signedInUser = userCredential.user;

    clearLoginFailures(sanitizedEmail);

    const token = await signedInUser.getIdToken(true);
    const signedInRecord = await loadLegacyUserProfile({
      uid: signedInUser.uid,
      token,
      email: signedInUser.email,
      emailVerified: signedInUser.emailVerified,
    });

    if (signedInRecord?.userData?.isLocked) {
      try {
        await signOut(firebaseAuth);
      } catch {
        // Ignore sign-out failures during locked-account recovery.
      }
      throw new Error(
        "Account Locked: Too many failed attempts. Contact Master Admin.",
      );
    }

    if (signedInUser?.uid) {
      await updateLoginSecurityCounters(
        signedInUser.uid,
        {
          failedAttempts: 0,
          isLocked: false,
          lastLoginAttempt: new Date().toISOString(),
          emailVerified: signedInUser.emailVerified,
        },
        token,
      );
    }
  } catch (error) {
    recordLoginFailure(sanitizedEmail);

    if (existingRecord?.uid) {
      const currentAttempts =
        Number(existingRecord.userData?.failedAttempts || 0) + 1;
      const isNowLocked = currentAttempts >= 10;

      try {
        await updateLoginSecurityCounters(
          existingRecord.uid,
          {
            failedAttempts: currentAttempts,
            isLocked: isNowLocked,
            lastLoginAttempt: new Date().toISOString(),
          },
          "",
        );
      } catch (dbError) {
        console.warn("Could not update failedAttempts:", dbError);
      }

      if (isNowLocked) {
        sendForensicAlert(sanitizedEmail, "ACCOUNT_LOCKOUT");
        throw new Error(
          "Account Locked: Too many failed attempts. Contact Master Admin.",
        );
      }
    }

    if (sanitizedEmail === ADMIN_EMAIL.toLowerCase()) {
      sendForensicAlert(sanitizedEmail, "UNAUTHORIZED_ACCESS");
    }

    const errorCode = error?.code || "";
    if (
      errorCode === "auth/invalid-credential" ||
      errorCode === "auth/wrong-password" ||
      errorCode === "auth/user-not-found"
    ) {
      throw new Error("Incorrect Gmail address or password.");
    }

    if (errorCode === "auth/too-many-requests") {
      throw new Error("Too many attempts. Please try again later.");
    }

    if (errorCode === "auth/user-disabled") {
      throw new Error("This account has been disabled.");
    }

    throw error;
  }

  const signedInUser = firebaseAuth.currentUser;
  if (!signedInUser) {
    throw new Error("We could not restore your session. Try again.");
  }

  const authData = await syncAuthSessionFromUser(signedInUser, stayLoggedIn);

  if (signedInUser.uid === ADMIN_UID) {
    sendTelegramAlert(
      "🔓 <b>GOD MODE ACTIVATED</b>\nMaster Admin has entered the terminal.",
    );

    const adminRecord = await loadLegacyUserProfile(authData);
    const userData = adminRecord?.userData || {};
    setProfile({
      ...userData,
      uid: signedInUser.uid,
      token: authData.token,
      email: signedInUser.email,
      emailVerified: signedInUser.emailVerified,
    });
    setScreen("admin");
    return;
  }

  let userDataFinal =
    (await loadLegacyUserProfile(authData))?.userData || null;
  if (!userDataFinal) {
    const initProfile = buildPendingProfile({
      fullName: signedInUser.displayName,
      email: signedInUser.email,
      country: "",
      city: "",
      authProvider: "password",
      emailVerified: signedInUser.emailVerified,
    });
    await provisionIdentityUserRecord(
      signedInUser.uid,
      initProfile,
      authData.token,
    );
    userDataFinal = initProfile;
  }

  if (
    userDataFinal.passwordLastChanged &&
    isPasswordExpired(userDataFinal.passwordLastChanged)
  ) {
    setProfile({
      ...userDataFinal,
      uid: signedInUser.uid,
      token: authData.token,
      email: signedInUser.email,
      emailVerified: signedInUser.emailVerified,
    });
    setScreen("forcePasswordReset");
    return;
  }

  if (userDataFinal.status === "BLOCKED") {
    throw new Error("Account blocked. Contact admin.");
  }

  await checkUserStatus(authData);
};

export const executeStructuredSignup = async ({
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
  ADMIN_EMAIL,
  sendForensicAlert,
}) => {
  const antiSpamShield = new AntiSpamShield(window.sendTelegramAlert);
  if (antiSpamShield.isBotDetected(formData)) {
    await antiSpamShield.silentlyRejectBot(formData.email, formData);
    return { success: true, message: "Application received." };
  }

  const authProvider =
    formData.authProvider === "google" ||
    googleUser?.authProvider === "google"
      ? "google"
      : "password";
  const cleanEmail = String(
    formData.email ||
      googleUser?.email ||
      firebaseAuth?.currentUser?.email ||
      "",
  )
    .trim()
    .toLowerCase();
  const fullName = String(
    formData.fullName ||
      googleUser?.fullName ||
      firebaseAuth?.currentUser?.displayName ||
      cleanEmail.split("@")[0] ||
      "",
  ).trim();
  const country = String(formData.country || "").trim();
  const city = String(formData.city || "").trim();
  const instagram = String(formData.instagram || "").trim();
  const linkedin = String(formData.linkedin || "").trim();
  const proficiency = String(formData.proficiency || "").trim();
  const stayLoggedIn = Boolean(formData.stayLoggedIn);
  const blockedEmails = ["arkgproductions@gmail.com", "starg.unit@gmail.com"];

  if (!fullName) {
    throw new Error("Full name is required.");
  }

  if (!country || !city) {
    throw new Error("Country and city are required.");
  }

  if (!isValidGmailAddress(cleanEmail)) {
    throw new Error("Only Gmail addresses are allowed.");
  }

  if (cleanEmail === ADMIN_EMAIL.toLowerCase()) {
    sendForensicAlert(cleanEmail, "IMPERSONATION_ATTEMPT");
    throw new Error("Admin email cannot be used for registration.");
  }

  if (blockedEmails.includes(cleanEmail)) {
    throw new Error(
      "Access Denied: This account has been permanently restricted.",
    );
  }

  if (
    authProvider !== "google" &&
    String(formData.password || "").length < 8
  ) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (!firebaseAuth || !FB_KEY) {
    const simulatedUid =
      (typeof window !== "undefined" &&
        (window.__TRADERS_AUDIT_DATA?.userAuth?.uid ||
          window.__TRADERS_AUDIT_DATA?.userProfile?.uid)) ||
      `audit-${Date.now()}`;
    const simulatedToken = `audit-token-${simulatedUid}`;
    const profileData = buildPendingProfile({
      fullName,
      email: cleanEmail,
      country,
      city,
      instagram,
      linkedin,
      proficiency,
      authProvider,
      emailVerified: authProvider === "google",
    });
    await submitOnboardingApplication({
      uid: simulatedUid,
      fullName,
      email: cleanEmail,
      country,
      city,
      instagram,
      linkedin,
      proficiency,
      authProvider,
      emailVerified: profileData.emailVerified,
      consentState: {
        termsAccepted: Boolean(formData.agreedToTerms),
        privacyAccepted: Boolean(formData.agreedToTerms),
      },
    });
    await provisionIdentityUserRecord(
      simulatedUid,
      profileData,
      simulatedToken,
    );
    setAuth({
      uid: simulatedUid,
      token: simulatedToken,
      refreshToken: `audit-refresh-${simulatedUid}`,
      email: cleanEmail,
      emailVerified: profileData.emailVerified,
    });
    setProfile({
      ...profileData,
      uid: simulatedUid,
      token: simulatedToken,
    });
    setGoogleUser(null);
    clearPendingGoogleSignup();
    setScreen("waiting");
    return;
  }

  try {
    await setPersistence(firebaseAuth, browserLocalPersistence);
  } catch (error) {
    console.warn("Failed to set persistence:", error);
  }

  let activeUser = firebaseAuth.currentUser;

  if (authProvider === "google") {
    if (!activeUser) {
      throw new Error(
        "Continue with Google first to finish your application.",
      );
    }
    if (activeUser.email?.toLowerCase() !== cleanEmail) {
      throw new Error("Google session mismatch. Please try again.");
    }
  } else {
    const existingRecord = await findIdentityUserByEmail(cleanEmail);
    if (existingRecord?.uid) {
      throw new Error(
        "This email is already part of the Regiment. Please login instead.",
      );
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        firebaseAuth,
        cleanEmail,
        formData.password,
      );
      activeUser = userCredential.user;
      await sendVerificationLink();
    } catch (signupError) {
      const errorCode = signupError?.code || "";
      if (errorCode === "auth/email-already-in-use") {
        throw new Error(
          "This email is already registered. Please login instead.",
        );
      }
      if (errorCode === "auth/invalid-email") {
        throw new Error("Invalid Gmail address.");
      }
      if (errorCode === "auth/weak-password") {
        throw new Error("Password is too weak. Use at least 8 characters.");
      }
      throw signupError;
    }
  }

  if (!activeUser) {
    throw new Error("Unable to create your session. Please try again.");
  }

  const authData = await syncAuthSessionFromUser(activeUser, stayLoggedIn);
  const profileData = buildPendingProfile({
    fullName,
    email: cleanEmail,
    country,
    city,
    instagram,
    linkedin,
    proficiency,
    authProvider,
    emailVerified: activeUser.emailVerified,
  });

  await submitOnboardingApplication({
    uid: activeUser.uid,
    fullName,
    email: cleanEmail,
    country,
    city,
    instagram,
    linkedin,
    proficiency,
    authProvider,
    emailVerified: activeUser.emailVerified,
    consentState: {
      termsAccepted: Boolean(formData.agreedToTerms),
      privacyAccepted: Boolean(formData.agreedToTerms),
    },
  });
  await provisionIdentityUserRecord(
    activeUser.uid,
    profileData,
    authData.token,
  );
  await sendWelcomeEmail(cleanEmail, fullName);

  sendTelegramAlert(
    `ðŸ‘¤ <b>NEW TRADER APPLICATION</b>\nEmail: <code>${cleanEmail}</code>\nStatus: ðŸŸ¡ PENDING`,
  );

  clearPendingGoogleSignup();
  setGoogleUser(null);
  setProfile({
    ...profileData,
    uid: activeUser.uid,
    token: authData.token,
  });
  setScreen("waiting");
};

export const executeStructuredGoogleAuth = async ({
  applicationData,
  authenticatedUser,
  firebaseAuth,
  FB_KEY,
  isValidGmailAddress,
  syncAuthSessionFromUser,
  loadLegacyUserProfile,
  handleStructuredSignup,
  persistPendingGoogleSignup,
  setGoogleUser,
  clearPendingGoogleSignup,
  setScreen,
  checkUserStatus,
}) => {
  if (!firebaseAuth || !FB_KEY) {
    throw new Error("Google sign-in is unavailable right now.");
  }

  const googleProvider = new GoogleAuthProvider();
  const user =
    authenticatedUser ||
    (await signInWithPopup(firebaseAuth, googleProvider)).user;
  const email = String(user.email || "").toLowerCase();

  if (!isValidGmailAddress(email)) {
    await firebaseAuth.signOut();
    throw new Error("Only Gmail addresses are allowed.");
  }

  const authData = await syncAuthSessionFromUser(user, true);
  const existingIdentityRecord = await loadLegacyUserProfile(authData);
  const userData = existingIdentityRecord?.userData || null;

  if (userData) {
    clearPendingGoogleSignup();
    setGoogleUser(null);
    await checkUserStatus(authData);
    return;
  }

  if (applicationData) {
    await handleStructuredSignup({
      ...applicationData,
      email,
      fullName:
        applicationData.fullName || user.displayName || email.split("@")[0],
      authProvider: "google",
    });
    return;
  }

  const googleDraft = {
    uid: user.uid,
    email,
    fullName: user.displayName || email.split("@")[0],
    authProvider: "google",
  };

  persistPendingGoogleSignup(googleDraft);
  setGoogleUser(googleDraft);
  setScreen("signup");
};

class AntiSpamShield {
  constructor(telegramAlert) {
    this.telegramAlert = telegramAlert;
  }

  isBotDetected(_formData) {
    return false;
  }

  async silentlyRejectBot(_email, _formData) {}
}
