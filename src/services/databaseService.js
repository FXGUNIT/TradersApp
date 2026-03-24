/**
 * ═══════════════════════════════════════════════════════════════════
 * DATABASE SERVICE - Identity Pipeline (Phase 1)
 * ═══════════════════════════════════════════════════════════════════
 *
 * This module handles all Firebase Database operations:
 * - User record provisioning (status: 'PENDING')
 * - User existence checks
 * - User status updates
 * - Admin approval operations
 *
 * Tasks: 1.3, 1.7
 */

import { getDatabase, ref, get, set, update } from "firebase/database";

// ═══════════════════════════════════════════════════════════════════
// TASK 1.3: DATABASE PROVISIONING - CREATE USER RECORD
// ═══════════════════════════════════════════════════════════════════

/**
 * Creates master user record in Firebase Database
 * THIS IS CRITICAL - Sets status to PENDING (controls routing)
 *
 * @param {string} uid - Firebase Authentication UID
 * @param {object} userData - { email, fullName, phoneNumber }
 * @returns {object} The created user record
 * @throws {Error} If database write fails
 *
 * @example
 * const userRecord = await provisionUserRecord(uid, {
 *   email: 'user@gmail.com',
 *   fullName: 'John Doe'
 * });
 * console.log('User provisioned with status:', userRecord.status); // 'PENDING'
 */
export async function provisionUserRecord(uid, userData) {
  const db = getDatabase();
  const userRef = ref(db, `users/${uid}`);

  const userRecord = {
    // Identity
    email: userData.email,
    fullName: userData.fullName || userData.email.split("@")[0],

    // CRITICAL: This controls routing (PENDING → WaitingRoom)
    status: "PENDING", // Options: 'PENDING', 'ACTIVE', 'BLOCKED'

    // Security
    role: "user", // 'user', 'admin', 'superadmin'
    isLocked: false, // true = account locked
    failedAttempts: 0, // Count of failed logins

    // Timestamps
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastLoginAt: null,
    approvedAt: null,
    approvedBy: null,

    // Profile defaults
    profilePicture: null,
    phoneNumber: userData.phoneNumber || null,

    // Trading defaults (empty until user adds data)
    accountBalance: 0,
    journal: {},
    tradesCount: 0,
    winRate: 0,

    // Compliance
    tncAccepted: false,
    tncAcceptedAt: null,
    privacyAccepted: false,
    privacyAcceptedAt: null,

    // Support
    supportChatInitialized: false,

    // Auth provider info
    authProvider: userData.authProvider || "email",
  };

  try {
    await set(userRef, userRecord);
    console.warn("✅ User record provisioned:", uid, "status: PENDING");
    return userRecord;
  } catch (error) {
    console.error("❌ Database provisioning failed:", error);
    throw new Error("Failed to create user record");
  }
}

// ═══════════════════════════════════════════════════════════════════
// TASK 1.7: CHECK USER EXISTS (ALREADY IN authService.js)
// Note: This is duplicated here for completeness in database operations
// ═══════════════════════════════════════════════════════════════════

/**
 * Checks if user exists in database (alias for authService.checkUserExists)
 * @param {string} uid - Firebase UID
 * @returns {object|null}
 */
export async function getUserRecord(uid) {
  const db = getDatabase();
  try {
    const userRef = ref(db, `users/${uid}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (error) {
    console.error("❌ getUserRecord failed:", error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// TASK 3.3: ADMIN APPROVAL FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Approves a user application (Admin action)
 * Updates status from PENDING to ACTIVE
 *
 * @param {string} uid - UID of user to approve
 * @param {string} adminUid - UID of admin performing approval
 * @returns {object} { success: boolean }
 *
 * @example
 * await approveUser('user-uid-123', 'admin-uid-456');
 * // User now gets routed to MainTerminal instead of WaitingRoom
 */
export async function approveUser(uid, adminUid) {
  const db = getDatabase();
  const updates = {
    status: "ACTIVE",
    approvedAt: Date.now(),
    approvedBy: adminUid,
    updatedAt: Date.now(),
  };

  try {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, updates);

    console.warn("✅ User approved:", uid);
    return { success: true };
  } catch (error) {
    console.error("❌ Approval failed:", error);
    throw error;
  }
}

/**
 * Rejects/Blocks a user application (Admin action)
 *
 * @param {string} uid - UID of user to block
 * @param {string} adminUid - UID of admin performing block
 * @param {string} reason - Reason for blocking
 */
export async function blockUser(
  uid,
  adminUid,
  reason = "Manual block by admin",
) {
  const db = getDatabase();
  const updates = {
    status: "BLOCKED",
    blockedAt: Date.now(),
    blockedBy: adminUid,
    blockReason: reason,
    updatedAt: Date.now(),
  };

  try {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, updates);

    console.warn("🚫 User blocked:", uid);
    return { success: true };
  } catch (error) {
    console.error("❌ Block failed:", error);
    throw error;
  }
}

/**
 * Locks a user's account (due to failed attempts or suspicious activity)
 *
 * @param {string} uid - UID of user to lock
 * @param {number} failedAttempts - Number of failed login attempts
 */
export async function lockUserAccount(uid, failedAttempts = 5) {
  const db = getDatabase();
  const updates = {
    isLocked: true,
    lockedAt: Date.now(),
    failedAttempts: failedAttempts,
    updatedAt: Date.now(),
  };

  try {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, updates);

    console.warn("🔒 User account locked:", uid);
    return { success: true };
  } catch (error) {
    console.error("❌ Lock failed:", error);
    throw error;
  }
}

/**
 * Unlocks a user's account (Admin action)
 *
 * @param {string} uid - UID of user to unlock
 * @param {string} adminUid - UID of admin performing unlock
 */
export async function unlockUserAccount(uid, adminUid) {
  const db = getDatabase();
  const updates = {
    isLocked: false,
    unlockedAt: Date.now(),
    unlockedBy: adminUid,
    failedAttempts: 0,
    updatedAt: Date.now(),
  };

  try {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, updates);

    console.warn("🔓 User account unlocked:", uid);
    return { success: true };
  } catch (error) {
    console.error("❌ Unlock failed:", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════
// USER STATUS UPDATE UTILITIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Updates user profile data
 *
 * @param {string} uid - Firebase UID
 * @param {object} profileData - Fields to update
 */
export async function updateUserProfile(uid, profileData) {
  const db = getDatabase();
  const updates = {
    ...profileData,
    updatedAt: Date.now(),
  };

  try {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, updates);
    console.warn("✅ User profile updated:", uid);
    return { success: true };
  } catch (error) {
    console.error("❌ Profile update failed:", error);
    throw error;
  }
}

/**
 * Records user login timestamp
 *
 * @param {string} uid - Firebase UID
 */
export async function recordUserLogin(uid) {
  const db = getDatabase();
  const updates = {
    lastLoginAt: Date.now(),
    failedAttempts: 0, // Reset failed attempts on successful login
  };

  try {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, updates);
  } catch (error) {
    console.error("❌ Login record failed:", error);
  }
}

/**
 * Increments failed login attempts
 *
 * @param {string} uid - Firebase UID
 * @returns {number} New failed attempts count
 */
export async function incrementFailedAttempts(uid) {
  const db = getDatabase();
  try {
    const userRef = ref(db, `users/${uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return 0;
    }

    const user = snapshot.val();
    const newCount = (user.failedAttempts || 0) + 1;

    await update(userRef, {
      failedAttempts: newCount,
      updatedAt: Date.now(),
    });

    return newCount;
  } catch (error) {
    console.error("❌ Failed to increment attempts:", error);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default {
  provisionUserRecord,
  getUserRecord,
  approveUser,
  blockUser,
  lockUserAccount,
  unlockUserAccount,
  updateUserProfile,
  recordUserLogin,
  incrementFailedAttempts,
};
