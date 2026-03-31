import { auth as firebaseAuth } from "../../services/firebase.js";

export const executePasswordReset = async ({
  newPassword,
  auth,
  profile,
  provisionIdentityUserRecord,
  setProfile,
  checkUserStatus,
}) => {
  if (!auth || !profile) {
    throw new Error("Session expired. Please login again.");
  }

  try {
    const user = firebaseAuth?.currentUser;
    if (user?.updatePassword) {
      await user.updatePassword(newPassword);
    } else {
      console.warn("Password reset simulated without Firebase auth");
    }

    await provisionIdentityUserRecord(
      auth.uid,
      {
        passwordLastChanged: new Date().toISOString(),
      },
      auth.token,
    );

    setProfile((prev) => ({
      ...prev,
      passwordLastChanged: new Date().toISOString(),
    }));

    await checkUserStatus(auth);
  } catch (error) {
    console.error("Password reset error:", error);
    throw new Error(error.message || "Failed to update password. Try again.");
  }
};

export const executeResendVerificationEmail = async ({
  sendVerificationLink,
  setAuth,
  showToast,
}) => {
  await sendVerificationLink();

  const refreshedUser = firebaseAuth?.currentUser;
  if (!refreshedUser) {
    return;
  }

  const refreshedAuth = {
    uid: refreshedUser.uid,
    token: await refreshedUser.getIdToken(true),
    refreshToken: refreshedUser.refreshToken,
    email: refreshedUser.email,
    emailVerified: refreshedUser.emailVerified,
  };
  setAuth(refreshedAuth);
  showToast("Verification email sent to your Gmail inbox.", "success");
};

export const executeApprovalStatusCheck = async ({
  auth,
  profile,
  checkUserStatus,
  setAuth,
}) => {
  if (!auth) return;
  if (
    typeof window !== "undefined" &&
    window.__TRADERS_AUDIT_DATA &&
    profile?.status === "PENDING"
  ) {
    return;
  }

  try {
    if (firebaseAuth?.currentUser) {
      await firebaseAuth.currentUser.reload();
      const refreshedUser = firebaseAuth.currentUser;
      const refreshedAuth = {
        uid: refreshedUser.uid,
        token: await refreshedUser.getIdToken(true),
        refreshToken: refreshedUser.refreshToken,
        email: refreshedUser.email,
        emailVerified: refreshedUser.emailVerified,
      };
      setAuth(refreshedAuth);
      await checkUserStatus(refreshedAuth);
      return;
    }
  } catch (error) {
    console.warn("Approval status refresh failed:", error);
  }

  await checkUserStatus(auth);
};
