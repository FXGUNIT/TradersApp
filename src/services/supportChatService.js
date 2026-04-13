/**
 * Support Chat Service
 * Manages admin-user support conversations via Firebase Realtime Database.
 * Notifies admin via Telegram when new user message arrives.
 * Saves admin responses to Firebase (user sees them in real-time).
 *
 * Flow:
 *   User sends message → Firebase → BFF → Telegram notification to admin
 *   Admin replies (web or Telegram) → Firebase → User sees in real-time
 *
 * J01 (Phase 11): All Telegram sends route through BFF at /telegram/send-message.
 * Token never leaves the browser bundle.
 */

import { ref, push, set, onValue, get } from 'firebase/database';
import { db } from '../firebase-config.js';
import { bffFetch } from './gateways/base.js';

const SUPPORT_CHATS_PATH = 'support_chats';

// ─── Types ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SupportMessage
 * @property {string} sender       - 'user' | 'admin'
 * @property {string} senderName   - Display name of sender
 * @property {string} senderEmail - Email of sender
 * @property {string} text        - Message content
 * @property {number} timestamp   - Unix ms timestamp
 * @property {boolean} read       - Has user seen this message?
 * @property {boolean} fromTelegram - Was this sent via Telegram?
 */

// ─── Core Firebase Operations ─────────────────────────────────────────────────

/**
 * Get the Firebase ref for a user's support chat.
 * @param {string} userId
 * @returns {import('firebase/database').DatabaseReference}
 */
function getChatRef(userId) {
  return ref(db, `${SUPPORT_CHATS_PATH}/${userId}/messages`);
}

/**
 * Get the typing indicator ref.
 * @param {string} userId
 * @returns {import('firebase/database').DatabaseReference}
 */
function getTypingRef(userId) {
  return ref(db, `${SUPPORT_CHATS_PATH}/${userId}/typing`);
}

// ─── Telegram Notification ───────────────────────────────────────────────────

/**
 * Send a Telegram notification to admin about a new user message.
 * Routes through BFF at /telegram/send-message — token lives server-side only.
 *
 * @param {string} userEmail - User's email
 * @param {string} userName  - User's display name
 * @param {string} userId    - User's UID
 * @param {string} message    - Message text
 * @param {string} [chatId]   - Admin's Telegram chat ID override (optional)
 * @returns {Promise<boolean>} success
 */
export async function notifyAdminOfNewMessage(userEmail, userName, userId, message, chatId = null) {
  const text = `💬 *New Support Message*

*From:* ${userName} (${userEmail})
*UID:* ${userId}
*Time:* ${new Date().toLocaleString()}

*Message:*
${message.slice(0, 500)}${message.length > 500 ? '...' : ''}

---
Reply to this chat to respond directly.`;

  try {
    // J01: Route through BFF — token never leaves browser
    const payload = {
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    };
    if (chatId) payload.chat_id = chatId;

    const result = await bffFetch('/telegram/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (result === null) {
      console.warn('[SupportChat] BFF unavailable — Telegram notification dropped');
      return false;
    }
    if (!result.ok) {
      console.warn('[SupportChat] Telegram notification failed:', result.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[SupportChat] Telegram notification failed:', error);
    return false;
  }
}

/**
 * Notify admin that their support reply was delivered.
 * @param {string} adminName
 * @param {string} userEmail
 * @param {string} message
 */
export async function notifyUserOfAdminReply(_adminName, _userEmail, _message) {
  // This would notify the user via email/push — for now Firebase handles real-time
  return true;
}

// ─── Send Admin Reply ────────────────────────────────────────────────────────

/**
 * Send admin reply to a user's support chat.
 * Saves to Firebase (user sees it in real-time) + notifies user.
 *
 * @param {string} userId   - The user's UID
 * @param {string} userEmail - User's email (for notification)
 * @param {string} userName  - User's name (for notification)
 * @param {string} adminName - Admin's display name
 * @param {string} text      - Reply text
 * @param {boolean} fromTelegram - Was this sent via Telegram?
 * @returns {Promise<boolean>}
 */
export async function sendAdminReply(userId, userEmail, userName, adminName, text, fromTelegram = false) {
  if (!text?.trim() || !userId) return false;

  try {
    const messagesRef = getChatRef(userId);
    const newMsgRef = push(messagesRef);

    await set(newMsgRef, {
      sender: 'admin',
      senderName: adminName || 'Support Team',
      senderEmail: 'admin@traders.app',
      text: text.trim(),
      timestamp: Date.now(),
      read: false,
      fromTelegram,
    });

    // If sent from the web modal, notify user (in-app notification would go here)
    // Firebase Realtime Database handles real-time delivery automatically
    return true;
  } catch (error) {
    console.error('[SupportChat] Failed to send admin reply:', error);
    return false;
  }
}

// ─── Subscribe to Messages ─────────────────────────────────────────────────

/**
 * Subscribe to a user's support chat messages in real-time.
 *
 * @param {string} userId   - User's UID
 * @param {function} onMessages - Callback(messages[]) when messages change
 * @param {function} onTyping  - Callback(isTyping, typingUser) when typing changes
 * @returns {function} unsubscribe - Call to stop listening
 */
export function subscribeToSupportChat(userId, onMessages, onTyping) {
  if (!userId || !db) return () => {};

  const messagesRef = getChatRef(userId);
  const typingRef = getTypingRef(userId);

  const unsubMessages = onValue(messagesRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      onMessages([]);
      return;
    }
    const messages = Object.entries(data)
      .map(([, msg]) => msg)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    onMessages(messages);
  });

  const unsubTyping = onValue(typingRef, (snapshot) => {
    const data = snapshot.val();
    if (data && typeof data === 'object') {
      const typingUser = Object.keys(data)[0];
      if (typingUser && onTyping) {
        onTyping(true, typingUser);
      }
    } else if (onTyping) {
      onTyping(false, null);
    }
  });

  return () => {
    unsubMessages();
    unsubTyping();
  };
}

// ─── User Sends Message ──────────────────────────────────────────────────────

/**
 * Send a message FROM a user to support.
 * Saves to Firebase + notifies admin via Telegram.
 *
 * @param {string} userId
 * @param {string} userName
 * @param {string} userEmail
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function sendUserMessage(userId, userName, userEmail, text) {
  if (!text?.trim() || !userId) return false;

  try {
    const messagesRef = getChatRef(userId);
    const newMsgRef = push(messagesRef);

    await set(newMsgRef, {
      sender: 'user',
      senderName: userName || 'User',
      senderEmail: userEmail || '',
      text: text.trim(),
      timestamp: Date.now(),
      read: false,
      fromTelegram: false,
    });

    // Notify admin via Telegram
    await notifyAdminOfNewMessage(userEmail, userName, userId, text.trim());

    return true;
  } catch (error) {
    console.error('[SupportChat] Failed to send user message:', error);
    return false;
  }
}

// ─── Mark Messages as Read ───────────────────────────────────────────────────

/**
 * Mark all messages in a user's support chat as read by admin.
 * @param {string} userId
 */
export async function markMessagesAsRead(userId) {
  if (!userId) return;

  try {
    const messagesRef = getChatRef(userId);
    const snapshot = await get(messagesRef);
    const data = snapshot.val();

    if (!data) return;

    const updates = {};
    Object.entries(data).forEach(([key, msg]) => {
      if (!msg.read && msg.sender === 'user') {
        updates[`${SUPPORT_CHATS_PATH}/${userId}/messages/${key}/read`] = true;
      }
    });

    if (Object.keys(updates).length > 0) {
      await import('firebase/database').then(({ update }) => {
        update(ref(db), updates);
      });
    }
  } catch (error) {
    console.error('[SupportChat] Failed to mark as read:', error);
  }
}

// ─── List All Support Chats (Admin) ─────────────────────────────────────────

/**
 * Get all support chats for admin dashboard.
 * Returns a list of conversations with latest message preview.
 *
 * @returns {Promise<Array>}
 */
export async function listSupportChats() {
  if (!db) return [];

  try {
    const chatsRef = ref(db, SUPPORT_CHATS_PATH);
    const snapshot = await get(chatsRef);
    const data = snapshot.val();

    if (!data) return [];

    return Object.entries(data)
      .map(([userId, chatData]) => {
        const messages = chatData.messages || {};
        const messageList = Object.entries(messages)
          .map(([, msg]) => msg)
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const lastMessage = messageList[0] || {};
        const unreadCount = messageList.filter(
          (m) => m.sender === 'user' && !m.read
        ).length;

        return {
          userId,
          lastMessage: {
            text: lastMessage.text || '',
            sender: lastMessage.sender || '',
            timestamp: lastMessage.timestamp || 0,
          },
          unreadCount,
          totalMessages: Object.keys(messages).length,
        };
      })
      .sort((a, b) => (b.lastMessage.timestamp || 0) - (a.lastMessage.timestamp || 0));
  } catch (error) {
    console.error('[SupportChat] Failed to list chats:', error);
    return [];
  }
}

// ─── Default Export ───────────────────────────────────────────────────────────

export default {
  sendAdminReply,
  sendUserMessage,
  subscribeToSupportChat,
  markMessagesAsRead,
  listSupportChats,
  notifyAdminOfNewMessage,
};
