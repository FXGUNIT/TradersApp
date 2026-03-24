/**
 * ═══════════════════════════════════════════════════════════════════
 * AUTH SERVICE - Identity Pipeline (Phase 1)
 * ═══════════════════════════════════════════════════════════════════
 *
 * This module handles all authentication-related functions:
 * - Frontend validation
 * - Firebase email/password signup
 * - Google OAuth handling
 * - Security interceptor checks
 * - Password reset flows
 *
 * Tasks: 1.1, 1.2, 1.6, 1.10, 2.1
 */

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";
import { provisionUserRecord } from "./databaseService";
import { sendWelcomeEmail } from "./emailService";

// ═══════════════════════════════════════════════════════════════════
// TASK 1.1: FRONTEND VALIDATION FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Validates signup input before Firebase authentication
 * Enforces business rules: 8+ char password, @gmail.com only
 *
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {object} { isValid: boolean, errors: string[] }
 *
 * @example
 * const { isValid, errors } = validateSignupInput('user@gmail.com', 'password123');
 * if (!isValid) {
 *   errors.forEach(err => showToast(err, 'error'));
 * }
 */
export function validateSignupInput(email, password) {
  const errors = [];

  // Validate password length - MUST be 8+ characters
  if (!password) {
    errors.push("Password is required");
  } else if (password.length < 8) {
    errors.push("Password must be 8+ characters");
  }

  // Validate email - MUST be @gmail.com (business rule)
  if (!email) {
    errors.push("Email is required");
  } else if (!email.toLowerCase().endsWith("@gmail.com")) {
    errors.push("Only @gmail.com accounts are allowed");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ═══════════════════════════════════════════════════════════════════
// TASK 1.2: FIREBASE EMAIL USER CREATION
// ═══════════════════════════════════════════════════════════════════

// Note: auth is lazily initialized in each function

/**
 * Creates a new user with email and password in Firebase Auth
 *
 * @param {string} email - User's email (must be @gmail.com)
 * @param {string} password - User's password (8+ characters)
 * @returns {object} { uid: string, email: string, success: boolean }
 * @throws {Error} If signup fails with descriptive message
 *
 * @example
 * try {
 *   const result = await createEmailUser('user@gmail.com', 'password123');
 *   console.log('User created:', result.uid);
 * } catch (error) {
 *   showToast(error.message, 'error');
 * }
 */
export async function createEmailUser(email, password) {
  const auth = getAuth();
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;

    console.warn("✅ Firebase user created:", user.uid);
    return {
      uid: user.uid,
      email: user.email,
      success: true,
    };
  } catch (error) {
    // Handle specific Firebase errors
    let errorMessage = "Signup failed. Please try again.";

    if (error.code === "auth/email-already-in-use") {
      errorMessage = "This email is already registered.";
    } else if (error.code === "auth/weak-password") {
      errorMessage = "Password is too weak.";
    } else if (error.code === "auth/invalid-email") {
      errorMessage = "Invalid email format.";
    } else if (error.code === "auth/operation-not-allowed") {
      errorMessage = "Email/password signup is not enabled.";
    }

    console.error("❌ Firebase signup error:", error.code, error.message);
    throw new Error(errorMessage);
  }
}

// ═══════════════════════════════════════════════════════════════════
// TASK 1.6: GOOGLE OAUTH HANDLER
// ═══════════════════════════════════════════════════════════════════

const googleProvider = new GoogleAuthProvider();

/**
 * Checks if user exists in Firebase Database
 *
 * @param {string} uid - Firebase Authentication UID
 * @returns {object|null} User data or null if doesn't exist
 */
export async function checkUserExists(uid) {
  const db = getDatabase();
  try {
    const userRef = ref(db, `users/${uid}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      console.warn("✅ User exists in DB:", uid);
      return snapshot.val();
    } else {
      console.warn("ℹ️ User NOT found in DB:", uid);
      return null;
    }
  } catch (error) {
    console.error("❌ Database check failed:", error);
    return null;
  }
}

/**
 * Handles Google OAuth Signup/Login
 * DIFFERENCE: Skips OTP (Google already verified email)
 *
 * @returns {object} { success: boolean, route: string, uid: string, isNewUser: boolean }
 * @throws {Error} If Google sign-in fails
 *
 * @example
 * const result = await handleGoogleSignup();
 * if (result.route === 'WaitingRoom') {
 *   navigate('/waiting');
 * } else {
 *   // Security interceptor will route based on status
 * }
 */
export async function handleGoogleSignup() {
  const auth = getAuth();
  try {
    // 1. Trigger Google OAuth popup
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const uid = user.uid;
    const email = user.email;
    const fullName = user.displayName;

    console.warn("✅ Google signin success:", email);

    // 2. Check if user exists in our database
    const existingUser = await checkUserExists(uid);

    if (!existingUser) {
      // === NEW USER ===
      console.warn("🆕 New Google user - provisioning...");

      await provisionUserRecord(uid, {
        email,
        fullName,
        authProvider: "google",
      });

      await sendWelcomeEmail(email, fullName);

      // Route to WaitingRoom (skip OTP - Google verified)
      return {
        success: true,
        route: "WaitingRoom",
        uid,
        email,
        fullName,
        isNewUser: true,
      };
    } else {
      // === RETURNING USER ===
      console.warn(
        "🔄 Returning Google user - invoking Security Interceptor...",
      );

      // Task 1.9: Wire returning Google user flow into Security Interceptor
      const securityStatus = await checkUserStatus(uid);

      // The route is now determined by the security check, and the full
      // status object is passed along for the router to handle.
      return {
        success: true,
        route: securityStatus.action, // e.g., 'ACTIVE', 'PENDING', 'LOCKED'
        uid,
        email,
        isNewUser: false,
        security: securityStatus,
      };
    }
  } catch (error) {
    console.error("❌ Google signup failed:", error);

    // Handle specific errors
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("Sign-in cancelled");
    } else if (error.code === "auth/account-exists-with-different-credential") {
      throw new Error(
        "Email already registered with password. Use password login.",
      );
    } else if (error.code === "auth/cancelled-popup-request") {
      throw new Error("Only one popup allowed");
    }

    throw new Error("Google sign-in failed. Please try again.");
  }
}

// ═══════════════════════════════════════════════════════════════════
// TASK 1.10: GOOGLE USER PASSWORD RESET
// ═══════════════════════════════════════════════════════════════════

/**
 * Sends password reset email for Google users who want password login
 * Uses Firebase's built-in flow - NO CUSTOM UI NEEDED
 *
 * @param {string} email - User's Gmail address
 * @returns {object} { success: boolean, message: string }
 * @throws {Error} If reset email fails
 *
 * @example
 * try {
 *   await handleGoogleUserPasswordReset('user@gmail.com');
 *   showToast('Check your email for reset instructions', 'success');
 * } catch (error) {
 *   showToast(error.message, 'error');
 * }
 */
export async function handleGoogleUserPasswordReset(email) {
  const auth = getAuth();
  try {
    await sendPasswordResetEmail(auth, email);

    console.warn("✅ Password reset email sent:", email);
    return {
      success: true,
      message: "Check your email for reset instructions",
    };
  } catch (error) {
    console.error("❌ Password reset failed:", error);

    let errorMessage = "Failed to send reset email";

    if (error.code === "auth/invalid-email") {
      errorMessage = "Invalid email address";
    } else if (error.code === "auth/user-not-found") {
      errorMessage = "No account with this email";
    } else if (error.code === "auth/too-many-requests") {
      errorMessage = "Too many attempts. Try again later";
    }

    throw new Error(errorMessage);
  }
}

// ═══════════════════════════════════════════════════════════════════
// TASK 2.1: SECURITY INTERCEPTOR - CHECK USER STATUS
// ═══════════════════════════════════════════════════════════════════

/**
 * SECURITY INTERCEPTOR - Acts as bouncer
 * Checks user status and returns routing decision
 * Called on every login and page refresh
 *
 * @param {string} uid - Firebase UID
 * @returns {object} { action: string, status: string, shouldLogout: boolean, message: string, telegramAlert?: boolean }
 *
 * @example
 * const { action, shouldLogout, message } = await checkUserStatus(uid);
 * if (shouldLogout) {
 *   await signOut(auth);
 *   showToast(message, 'error');
 *   navigate('/login');
 * } else if (action === 'PENDING') {
 *   navigate('/waiting');
 * } else if (action === 'ACTIVE') {
 *   navigate('/hub');
 * }
 */
export async function checkUserStatus(uid) {
  const db = getDatabase();
  try {
    // 1. Fetch user record
    const userRef = ref(db, `users/${uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      // No record = shouldn't happen, but handle it
      console.warn("⚠️ No user record found for UID:", uid);
      return {
        action: "error",
        status: "NO_RECORD",
        shouldLogout: true,
        message: "User record not found",
      };
    }

    const user = snapshot.val();

    // 2. Check isLocked first (highest priority)
    if (user.isLocked === true) {
      console.warn("🔒 Account LOCKED:", uid);
      return {
        action: "LOCKED",
        status: user.status,
        shouldLogout: true,
        message: "Account locked. Contact Master Admin.",
        telegramAlert: true,
        alertType: "ACCOUNT_LOCKED",
      };
    }

    // 3. Check status field
    switch (user.status) {
      case "BLOCKED":
        console.warn("🚫 Account BLOCKED:", uid);
        return {
          action: "BLOCKED",
          status: "BLOCKED",
          shouldLogout: true,
          message: "Access revoked. Contact support.",
          telegramAlert: true,
          alertType: "ACCOUNT_BLOCKED",
        };

      case "PENDING":
        console.warn("⏳ Account PENDING:", uid);
        return {
          action: "PENDING",
          status: "PENDING",
          shouldLogout: false,
          message: "Application under review",
        };

      case "ACTIVE":
        console.warn("✅ Account ACTIVE:", uid);
        return {
          action: "ACTIVE",
          status: "ACTIVE",
          shouldLogout: false,
          message: "Login successful",
        };

      default:
        // Unknown status - default to PENDING (safe)
        console.warn("⚠️ Unknown status:", user.status);
        return {
          action: "PENDING",
          status: "PENDING",
          shouldLogout: false,
          message: "Status pending review",
        };
    }
  } catch (error) {
    console.error("❌ checkUserStatus failed:", error);
    return {
      action: "error",
      status: "ERROR",
      shouldLogout: true,
      message: "Failed to verify account status",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default {
  validateSignupInput,
  createEmailUser,
  checkUserExists,
  handleGoogleSignup,
  handleGoogleUserPasswordReset,
  checkUserStatus,
};
