import { getAuth, signOut } from "firebase/auth";
import { sendSecurityAlert } from "./telegramService.js";

const getAuthOrNull = () => {
  try {
    return getAuth();
  } catch {
    return null;
  }
};

export async function handleLockedAccount(userData) {
  const auth = getAuthOrNull();
  if (auth) {
    await signOut(auth);
  }

  if (typeof window !== "undefined" && window.showToast) {
    window.showToast(
      "Account locked. Contact Master Admin.",
      "error",
      10000,
    );
  }

  try {
    await sendSecurityAlert("ACCOUNT_LOCKED", {
      uid: userData.uid,
      email: userData.email,
      failedAttempts: userData.failedAttempts,
    });
  } catch (error) {
    console.error("Telegram alert failed:", error);
  }

  return {
    redirectTo: "login",
    showError: true,
    errorMessage: "Account locked. Contact Master Admin.",
  };
}

export async function handleBlockedAccount(userData) {
  const auth = getAuthOrNull();
  if (auth) {
    await signOut(auth);
  }

  if (typeof window !== "undefined" && window.showToast) {
    window.showToast("Access revoked. Contact support.", "error", 10000);
  }

  await sendSecurityAlert("ACCOUNT_BLOCKED", {
    uid: userData.uid,
    email: userData.email,
  });

  return {
    redirectTo: "login",
    showError: true,
    errorMessage: "Access revoked. Contact support.",
  };
}

export function handlePendingAccount() {
  return {
    redirectTo: "WaitingRoom",
    showError: false,
  };
}

export function handleActiveAccount() {
  return {
    redirectTo: "hub",
    showError: false,
  };
}

export async function handleRoutingDecision(
  statusResult,
  userData,
  navigate,
  showToast,
) {
  if (statusResult.action === "LOCKED") {
    await handleLockedAccount(userData);
    if (navigate) navigate("/login");
    return;
  }

  if (statusResult.action === "BLOCKED") {
    await handleBlockedAccount(userData);
    if (navigate) navigate("/login");
    return;
  }

  if (statusResult.action === "PENDING") {
    handlePendingAccount();
    if (navigate) navigate("/waiting");
    return;
  }

  if (statusResult.action === "ACTIVE") {
    const result = handleActiveAccount(userData);
    if (navigate) navigate(`/${result.redirectTo}`);
    return;
  }

  if (statusResult.shouldLogout) {
    const auth = getAuthOrNull();
    if (auth) {
      await signOut(auth);
    }
    if (showToast) {
      showToast(statusResult.message || "Authentication error", "error");
    }
    if (navigate) navigate("/login");
    return;
  }

  handlePendingAccount();
  if (navigate) navigate("/waiting");
}

export default {
  handleLockedAccount,
  handleBlockedAccount,
  handlePendingAccount,
  handleActiveAccount,
  handleRoutingDecision,
};
