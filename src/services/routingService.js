/**
 * ═══════════════════════════════════════════════════════════════════
 * ROUTING SERVICE - Security Interceptor (Phase 2)
 * ═══════════════════════════════════════════════════════════════════
 *
 * This module handles navigation based on user status:
 * - LOCKED accounts → Sign out + error message
 * - BLOCKED accounts → Sign out + error message
 * - PENDING accounts → WaitingRoom
 * - ACTIVE accounts → MainTerminal
 *
 * Tasks: 2.2, 2.3, 2.4, 2.5
 */

import { getAuth, signOut } from "firebase/auth";
import { sendSecurityAlert } from "./telegramService.js";

const auth = getAuth();

// ═══════════════════════════════════════════════════════════════════
// TASK 2.2: LOCKED ACCOUNT HANDLER
// ═══════════════════════════════════════════════════════════════════

/**
 * Handles locked account - IMMEDIATE LOGOUT
 * Fired when user.isLocked === true
 *
 * @param {object} userData - User data from database
 * @returns {object} { redirectTo: string, showError: boolean, errorMessage: string }
 *
 * @example
 * const result = await handleLockedAccount(userData);
 * if (result.showError) {
 *   showToast(result.errorMessage, 'error');
 * }
 * navigate('/login');
 */
export async function handleLockedAccount(userData) {
  // 1. Sign out immediately
  await signOut(auth);
  console.warn("🔒 User signed out - account locked");

  // 2. Show error toast
  if (typeof window !== "undefined" && window.showToast) {
    window.showToast(
      "Account locked. Contact Master Admin.",
      "error",
      10000, // 10 seconds
    );
  }

  // 3. Fire Telegram alert
  try {
    await sendSecurityAlert("ACCOUNT_LOCKED", {
      uid: userData.uid,
      email: userData.email,
      failedAttempts: userData.failedAttempts,
    });
  } catch (e) {
    console.error("Telegram alert failed:", e);
  }

  // 4. Return for routing
  return {
    redirectTo: "login",
    showError: true,
    errorMessage: "Account locked. Contact Master Admin.",
  };
}

// ═══════════════════════════════════════════════════════════════════
// TASK 2.3: BLOCKED ACCOUNT HANDLER
// ═══════════════════════════════════════════════════════════════════

/**
 * Handles BLOCKED status - SIGN OUT
 * Fired when user.status === 'BLOCKED'
 *
 * @param {object} userData - User data from database
 * @returns {object} { redirectTo: string, showError: boolean, errorMessage: string }
 */
export async function handleBlockedAccount(userData) {
  // Sign out
  await signOut(auth);
  console.warn("🚫 User signed out - account blocked");

  // Show error
  if (typeof window !== "undefined" && window.showToast) {
    window.showToast("Access revoked. Contact support.", "error", 10000);
  }

  // Telegram alert
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

// ═══════════════════════════════════════════════════════════════════
// TASK 2.4: PENDING ACCOUNT HANDLER
// ═══════════════════════════════════════════════════════════════════

/**
 * Handles PENDING status - ROUTE TO WAITING ROOM
 * Fired when user.status === 'PENDING'
 *
 * @returns {object} { redirectTo: string, showError: boolean }
 *
 * @example
 * const result = handlePendingAccount();
 * navigate('/waiting');
 */
export function handlePendingAccount() {
  console.warn("⏳ Routing to WaitingRoom...");

  return {
    redirectTo: "WaitingRoom",
    showError: false,
  };
}

// ═══════════════════════════════════════════════════════════════════
// TASK 2.5: ACTIVE ACCOUNT HANDLER
// ═══════════════════════════════════════════════════════════════════

/**
 * Handles ACTIVE status - GRANT ACCESS
 * Fired when user.status === 'ACTIVE'
 *
 * @param {object} userData - User data from database
 * @param {boolean} otpRequired - Is OTP verification needed (default: false)
 * @returns {object} { redirectTo: string, showError: boolean }
 *
 * @example
 * const result = handleActiveAccount(userData);
 * if (result.redirectTo === 'OTPScreen') {
 *   navigate('/otp');
 * } else {
 *   navigate('/hub');
 * }
 */
export function handleActiveAccount(userData, otpRequired = false) {
  console.warn("✅ User ACTIVE - granting access...");

  // Check if OTP is required (e.g., first login after password reset)
  if (otpRequired) {
    return {
      redirectTo: "OTPScreen",
      showError: false,
    };
  }

  // Direct to hub/terminal
  return {
    redirectTo: "hub", // RegimentHub
    showError: false,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MASTER ROUTING FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Master routing handler - routes based on security check result
 * This is the main entry point called from auth state changes
 *
 * @param {object} statusResult - Result from checkUserStatus()
 * @param {object} userData - Full user data from database
 * @param {function} navigate - React Router navigate function
 * @param {function} showToast - Toast notification function
 *
 * @example
 * const statusResult = await checkUserStatus(uid);
 * const userData = await getUserRecord(uid);
 * await handleRoutingDecision(statusResult, userData, navigate, showToast);
 */
export async function handleRoutingDecision(
  statusResult,
  userData,
  navigate,
  showToast,
) {
  // Handle LOCKED
  if (statusResult.action === "LOCKED") {
    await handleLockedAccount(userData);
    if (navigate) navigate("/login");
    return;
  }

  // Handle BLOCKED
  if (statusResult.action === "BLOCKED") {
    await handleBlockedAccount(userData);
    if (navigate) navigate("/login");
    return;
  }

  // Handle PENDING
  if (statusResult.action === "PENDING") {
    handlePendingAccount();
    if (navigate) navigate("/waiting");
    return;
  }

  // Handle ACTIVE
  if (statusResult.action === "ACTIVE") {
    const result = handleActiveAccount(userData, false);
    if (navigate) navigate(`/${result.redirectTo}`);
    return;
  }

  // Handle ERROR or unknown status
  if (statusResult.shouldLogout) {
    await signOut(auth);
    if (showToast) {
      showToast(statusResult.message || "Authentication error", "error");
    }
    if (navigate) navigate("/login");
    return;
  }

  // Default fallback: PENDING
  handlePendingAccount();
  if (navigate) navigate("/waiting");
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default {
  handleLockedAccount,
  handleBlockedAccount,
  handlePendingAccount,
  handleActiveAccount,
  handleRoutingDecision,
};
