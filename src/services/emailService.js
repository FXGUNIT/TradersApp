/**
 * ═══════════════════════════════════════════════════════════════════
 * EMAIL SERVICE - Identity Pipeline (Phase 1)
 * ═══════════════════════════════════════════════════════════════════
 *
 * This module handles all EmailJS email operations:
 * - Welcome "Under Review" emails
 * - Approval confirmation emails
 * - Invite emails
 *
 * Tasks: 1.4, 3.5
 */

import emailjs from "@emailjs/browser";

// Get from .env
const EMAILJS_SERVICE_ID =
  import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_xxx";
const EMAILJS_TEMPLATE_ID =
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "template_xxx";
const EMAILJS_PUBLIC_KEY =
  import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "public_key";

// Fallback template IDs (can be set in .env if needed)
const EMAILJS_TEMPLATE_WELCOME =
  import.meta.env.VITE_EMAILJS_TEMPLATE_WELCOME || EMAILJS_TEMPLATE_ID;
const EMAILJS_TEMPLATE_APPROVED =
  import.meta.env.VITE_EMAILJS_TEMPLATE_APPROVED || EMAILJS_TEMPLATE_ID;
const EMAILJS_TEMPLATE_INVITE =
  import.meta.env.VITE_EMAILJS_TEMPLATE_INVITE || EMAILJS_TEMPLATE_ID;

// ═══════════════════════════════════════════════════════════════════
// TASK 1.4: WELCOME EMAIL - "UNDER REVIEW"
// ═══════════════════════════════════════════════════════════════════

/**
 * Sends "Welcome - Under Review" email
 * Fired when user first signs up (status: PENDING)
 *
 * @param {string} email - User's email
 * @param {string} fullName - User's full name
 * @returns {object} { success: boolean, response?: object, error?: object }
 *
 * @example
 * await sendWelcomeEmail('user@gmail.com', 'John Doe');
 * // User receives: "Welcome to the Regiment - Under Review"
 */
export async function sendWelcomeEmail(email, fullName) {
  const templateParams = {
    user_email: email,
    user_name: fullName || email.split("@")[0],
    subject: "Welcome to the Regiment - Under Review",
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_WELCOME,
      templateParams,
      EMAILJS_PUBLIC_KEY,
    );

    console.warn(
      "✅ Welcome (Under Review) email sent:",
      email,
      response.status,
    );
    return { success: true, response };
  } catch (error) {
    console.error("❌ Welcome email failed:", error);
    // Don't throw - email failure shouldn't block signup
    return { success: false, error };
  }
}

// ═══════════════════════════════════════════════════════════════════
// TASK 3.5: APPROVAL CONFIRMATION EMAIL
// ═══════════════════════════════════════════════════════════════════

/**
 * Sends approval confirmation email
 * Fired when admin approves user (status → ACTIVE)
 *
 * @param {string} email - User's email
 * @param {string} fullName - User's full name
 * @returns {object} { success: boolean, response?: object, error?: object }
 *
 * @example
 * await sendApprovalConfirmationEmail('user@gmail.com', 'John Doe');
 * // User receives: "Welcome to the Regiment. Your terminal is unlocked."
 */
export async function sendApprovalConfirmationEmail(email, fullName) {
  const templateParams = {
    user_email: email,
    user_name: fullName || email.split("@")[0],
    subject: "Welcome to the Regiment - Your Terminal is Unlocked!",
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_APPROVED,
      templateParams,
      EMAILJS_PUBLIC_KEY,
    );

    console.warn(
      "✅ Approval confirmation email sent:",
      email,
      response.status,
    );
    return { success: true, response };
  } catch (error) {
    console.error("❌ Approval email failed:", error);
    // Don't throw - email failure shouldn't block approval
    return { success: false, error };
  }
}

// ═══════════════════════════════════════════════════════════════════
// INVITE EMAIL (Admin Feature)
// ═══════════════════════════════════════════════════════════════════

/**
 * Sends invitation email to new user
 * Fired when admin invites someone to the platform
 *
 * @param {string} email - Invitee's email
 * @param {string} inviterName - Name of person sending invite
 * @param {string} customMessage - Optional custom message
 * @returns {object} { success: boolean, response?: object, error?: object }
 *
 * @example
 * await sendInviteEmail('newuser@gmail.com', 'Admin John', 'Join the Regiment!');
 */
export async function sendInviteEmail(
  email,
  inviterName = "Traders Regiment",
  customMessage = "",
) {
  const templateParams = {
    user_email: email,
    inviter_name: inviterName,
    custom_message:
      customMessage || "You have been invited to join the Traders Regiment.",
    subject: "You Have Been Invited - Traders Regiment",
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_INVITE,
      templateParams,
      EMAILJS_PUBLIC_KEY,
    );

    console.warn("✅ Invite email sent:", email, response.status);
    return { success: true, response };
  } catch (error) {
    console.error("❌ Invite email failed:", error);
    return { success: false, error };
  }
}

// ═══════════════════════════════════════════════════════════════════
// REJECTION/BLOCK EMAIL (Optional - Admin Feature)
// ═══════════════════════════════════════════════════════════════════

/**
 * Sends rejection notification email
 * Fired when admin rejects user's application
 *
 * @param {string} email - User's email
 * @param {string} fullName - User's full name
 * @param {string} reason - Reason for rejection
 * @returns {object} { success: boolean, response?: object, error?: object }
 */
export async function sendRejectionEmail(email, fullName, reason = "") {
  const templateParams = {
    user_email: email,
    user_name: fullName || email.split("@")[0],
    rejection_reason:
      reason || "Your application did not meet our requirements.",
    subject: "Traders Regiment - Application Update",
  };

  try {
    // Use welcome template with modified subject (or create dedicated template)
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_WELCOME,
      templateParams,
      EMAILJS_PUBLIC_KEY,
    );

    console.warn("✅ Rejection email sent:", email, response.status);
    return { success: true, response };
  } catch (error) {
    console.error("❌ Rejection email failed:", error);
    return { success: false, error };
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default {
  sendWelcomeEmail,
  sendApprovalConfirmationEmail,
  sendInviteEmail,
  sendRejectionEmail,
};
