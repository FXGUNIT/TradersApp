/**
 * ═══════════════════════════════════════════════════════════════════
 * TELEGRAM SERVICE - Security & Support Notifications
 * ═══════════════════════════════════════════════════════════════════
 *
 * This module handles Telegram bot notifications:
 * - Security alerts (locked, blocked accounts)
 * - Support chat notifications
 * - Admin broadcasts
 *
 * Tasks: 2.6, 4.5
 *
 * J01 (Phase 11): All sends now route through BFF at /telegram/send-message.
 * Token never leaves the browser bundle.
 */
import { bffFetch } from './gateways/base.js';

// Log presence without leaking token values.
console.warn("Telegram Service Initialized:", {
  configured: Boolean(typeof window !== 'undefined'),
});

// ═══════════════════════════════════════════════════════════════════
// TASK 2.6: SECURITY ALERTS
// ═══════════════════════════════════════════════════════════════════

const ALERT_MESSAGES = {
  ACCOUNT_LOCKED: (userData) => `🔒 <b>ACCOUNT LOCKED</b>
  
User: ${userData.email}
UID: ${userData.uid}
Failed Attempts: ${userData.failedAttempts || "N/A"}`,

  ACCOUNT_BLOCKED: (userData) => `🚫 <b>ACCOUNT BLOCKED</b>

User: ${userData.email}
UID: ${userData.uid}
Blocked by: ${userData.blockedBy || "System"}`,

  LOGIN_FAILED_EXCESSIVE: (userData) => `⚠️ <b>EXCESSIVE LOGIN FAILURES</b>

User: ${userData.email}
UID: ${userData.uid}
Attempts: ${userData.failedAttempts}`,

  SUSPICIOUS_ACTIVITY: (userData) => `🚨 <b>SUSPICIOUS ACTIVITY</b>

User: ${userData.email}
UID: ${userData.uid}
Details: ${userData.details || "See logs"}`,

  NEW_USER_SIGNUP: (userData) => `🆕 <b>NEW USER SIGNUP</b>

Email: ${userData.email}
UID: ${userData.uid}
Time: ${new Date().toISOString()}`,

  USER_APPROVED: (userData) => `✅ <b>USER APPROVED</b>

Email: ${userData.email}
UID: ${userData.uid}
Approved by: ${userData.approvedBy || "Admin"}`,
};

/**
 * Sends security alert to admin via Telegram
 *
 * @param {string} alertType - Type of alert (ACCOUNT_LOCKED, ACCOUNT_BLOCKED, etc.)
 * @param {object} userData - User information
 * @returns {object} { success: boolean, error?: object }
 *
 * @example
 * await sendSecurityAlert('ACCOUNT_LOCKED', {
 *   uid: 'user-123',
 *   email: 'user@gmail.com',
 *   failedAttempts: 5
 * });
 */
export async function sendSecurityAlert(alertType, userData) {
  const messageGenerator = ALERT_MESSAGES[alertType];

  if (!messageGenerator) {
    console.warn("⚠️ Unknown alert type:", alertType);
    return { success: false, error: "Unknown alert type" };
  }

  const message = messageGenerator(userData);

  return await sendTelegramMessage(message);
}

// ═══════════════════════════════════════════════════════════════════
// TASK 4.5: SUPPORT CHAT NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Notifies admin of new support message from user
 *
 * @param {string} userEmail - User's email
 * @param {string} message - User's message
 * @returns {object} { success: boolean, error?: object }
 *
 * @example
 * await notifyAdminOfSupportRequest('user@gmail.com', 'Can I get approved?');
 * // Telegram receives: "🚨 Support Request from user@gmail.com: Can I get approved?"
 */
export async function notifyAdminOfSupportRequest(userEmail, message) {
  const text = `🚨 Support Request from ${userEmail}:\n${message}`;
  return await sendTelegramMessage(text);
}

// ═══════════════════════════════════════════════════════════════════
// BROADCAST / ADMIN MESSAGE
// ═══════════════════════════════════════════════════════════════════

/**
 * Sends a broadcast message to admin (from app)
 *
 * @param {string} title - Message title
 * @param {string} content - Message content
 * @returns {object} { success: boolean, error?: object }
 */
export async function sendAdminBroadcast(title, content) {
  const message = `📢 <b>${title}</b>\n\n${content}`;
  return await sendTelegramMessage(message);
}

// ═══════════════════════════════════════════════════════════════════
// CORE TELEGRAM SEND FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Core function to send message via Telegram Bot API
 *
 * @param {string} text - Message text (HTML supported)
 * @returns {object} { success: boolean, error?: object }
 */
async function sendTelegramMessage(text) {
  console.warn("sendTelegramMessage called", { textLength: text.length });

  if (!text?.trim()) {
    return { success: false, error: "Empty message" };
  }

  try {
    // Route through BFF — token lives server-side only (J01)
    const result = await bffFetch('/telegram/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, parse_mode: 'HTML' }),
    });

    if (result === null) {
      console.warn('[TelegramService] BFF unavailable');
      return { success: false, error: 'BFF unavailable' };
    }
    if (!result.ok) {
      console.warn('[TelegramService] Telegram send failed:', result.error);
      return { success: false, error: result.error };
    }

    console.warn('[TelegramService] Message sent via BFF proxy');
    return { success: true };
  } catch (error) {
    console.warn('[TelegramService] Telegram request failed:', error);
    return { success: false, error };
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default {
  sendSecurityAlert,
  notifyAdminOfSupportRequest,
  sendAdminBroadcast,
  sendTelegramMessage,
};
