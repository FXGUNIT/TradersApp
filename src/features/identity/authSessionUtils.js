import { sendEmailVerification } from "firebase/auth";
import { createSession } from "../../utils/sessionUtils.js";

export const buildPendingProfile = ({
  fullName,
  email,
  country,
  city,
  instagram,
  linkedin,
  proficiency,
  authProvider = "password",
  emailVerified = false,
}) => ({
  fullName: (fullName || email?.split("@")[0] || "").trim(),
  email: String(email || "")
    .trim()
    .toLowerCase(),
  country: String(country || "").trim(),
  city: String(city || "").trim(),
  instagram: String(instagram || "").trim(),
  linkedin: String(linkedin || "").trim(),
  proficiency: String(proficiency || "").trim(),
  authProvider,
  emailVerified: Boolean(emailVerified),
  status: "PENDING",
  role: "user",
  createdAt: new Date().toISOString(),
  passwordLastChanged: new Date().toISOString(),
  failedAttempts: 0,
  isLocked: false,
});

export const createSyncedAuthSession = async (user, stayLoggedIn = false) => {
  const token = await user.getIdToken(true);
  const authData = {
    uid: user.uid,
    token,
    refreshToken: user.refreshToken,
    email: user.email,
    emailVerified: user.emailVerified,
  };

  const sessionId = await createSession(user.uid, token, stayLoggedIn);
  return { authData, sessionId };
};

export const sendVerificationLinkForUser = async (user) => {
  if (!user) {
    throw new Error("Your session expired. Sign in again to resend verification.");
  }

  await sendEmailVerification(user);
};
