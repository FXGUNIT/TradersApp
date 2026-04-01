/**
 * ═══════════════════════════════════════════════════════════════════
 * ADMIN SERVICE - User Management (Phase 3)
 * ═══════════════════════════════════════════════════════════════════
 *
 * This module handles all admin-level actions:
 * - Approving new users
 * - Blocking/locking user accounts
 * - Fetching user lists for the admin panel
 *
 * Task: 3.3
 */

import { getDatabase, ref, update, get } from "firebase/database";
import { sendSecurityAlert } from "./telegramService.js";
import { sendApprovalConfirmationEmail } from "./emailService.js";

const getDbOrNull = () => {
  try {
    return getDatabase();
  } catch {
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════
// TASK 3.3: APPROVE USER
// ═══════════════════════════════════════════════════════════════════

/**
 * Approves a user, changing their status from PENDING to ACTIVE
 *
 * @param {string} uid - The UID of the user to approve
 * @param {string} adminUid - The UID of the admin performing the action
 * @returns {object} { success: boolean, error?: string }
 */
export async function approveUser(uid, adminUid) {
  if (!uid || !adminUid) {
    return { success: false, error: "User UID and Admin UID are required." };
  }

  const db = getDbOrNull();
  if (!db) {
    return { success: false, error: "Firebase unavailable" };
  }

  const userRef = ref(db, `users/${uid}`);

  try {
    // Fetch user data to get email for notifications
    const userSnapshot = await get(userRef);
    if (!userSnapshot.exists()) {
      return { success: false, error: "User not found." };
    }
    const userData = userSnapshot.val();

    // Update the user's status to ACTIVE
    await update(userRef, {
      status: "ACTIVE",
      approvedBy: adminUid,
      approvedAt: new Date().toISOString(),
    });

    // approval logged via Firebase

    // Send notifications
    await sendApprovalConfirmationEmail(userData.email, userData.fullName);
    await sendSecurityAlert("USER_APPROVED", {
      uid,
      email: userData.email,
      approvedBy: adminUid,
    });

    return { success: true };
  } catch (error) {
    // error returned via { success: false, error }
    return { success: false, error: error.message };
  }
}

/**
 * Blocks a user's account.
 *
 * @param {string} uid - The user's UID.
 * @param {string} adminUid - The admin's UID.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function blockUser(uid, adminUid) {
  // (Placeholder for future implementation)
  const db = getDbOrNull();
  if (!db) {
    return { success: false, error: "Firebase unavailable" };
  }
  const userRef = ref(db, `users/${uid}`);
  await update(userRef, { status: "BLOCKED", blockedBy: adminUid });
  return { success: true };
}

/**
 * Locks a user's account.
 *
 * @param {string} uid - The user's UID.
 * @param {string} adminUid - The admin's UID.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function lockUser(uid, adminUid) {
  // (Placeholder for future implementation)
  const db = getDbOrNull();
  if (!db) {
    return { success: false, error: "Firebase unavailable" };
  }
  const userRef = ref(db, `users/${uid}`);
  await update(userRef, { isLocked: true, lockedBy: adminUid });
  return { success: true };
}

/**
 * Fetches all users for the admin dashboard.
 *
 * @returns {Promise<{success: boolean, users?: object, error?: string}>}
 */
export async function listUsers() {
  // (Placeholder for future implementation)
  const db = getDbOrNull();
  if (!db) {
    return { success: false, error: "Firebase unavailable" };
  }
  const usersRef = ref(db, "users");
  const snapshot = await get(usersRef);
  if (snapshot.exists()) {
    return { success: true, users: snapshot.val() };
  }
  return { success: false, error: "No users found." };
}

export default {
  approveUser,
  blockUser,
  lockUser,
  listUsers,
};
