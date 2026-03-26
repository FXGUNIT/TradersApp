import { onValue, push, ref, set } from "firebase/database";
import { db } from "../firebase.js";
import { notifyAdminOfSupportRequest } from "../telegramService.js";

async function notifyStartWebhook(payload) {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
  if (!webhookUrl) return { success: false, skipped: true };

  try {
    await fetch(`${webhookUrl}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to notify support webhook:", error);
    return { success: false, error };
  }
}

function mapMessages(snapshotValue) {
  if (!snapshotValue?.messages) return [];
  return Object.entries(snapshotValue.messages).map(([id, value]) => ({
    id,
    ...value,
  }));
}

export async function ensureWelcomeMessage(userId, userEmail) {
  if (!userId || !db) return { success: false, skipped: true };

  const welcomeRef = ref(db, `support_chats/${userId}/messages`);
  await push(welcomeRef, {
    text: `Welcome to TradersApp Support. Your account: ${userEmail}\n\nHow can we help you today?`,
    sender: "admin",
    timestamp: Date.now(),
    type: "welcome",
  });

  return { success: true };
}

export function subscribeToSupportThread(userId, handlers) {
  if (!userId || !db) return () => {};

  const chatRef = ref(db, `support_chats/${userId}`);
  return onValue(
    chatRef,
    async (snapshot) => {
      const data = snapshot.val();
      if (data === null) {
        handlers?.onEmpty?.();
        return;
      }
      handlers?.onMessages?.(mapMessages(data));
    },
    (error) => {
      handlers?.onError?.(error);
    },
  );
}

export async function sendSupportMessage({ userId, userEmail, text }) {
  if (!userId || !text?.trim() || !db) {
    return { success: false, error: "Missing support message payload" };
  }

  const messagesRef = ref(db, `support_chats/${userId}/messages`);
  const newMessageRef = push(messagesRef);

  await set(newMessageRef, {
    text: text.trim(),
    sender: "user",
    timestamp: Date.now(),
    email: userEmail,
  });

  await notifyAdminOfSupportRequest(userEmail, text.trim()).catch((error) => {
    console.warn("Telegram notification failed:", error);
  });

  return { success: true };
}

export default {
  ensureWelcomeMessage,
  notifyStartWebhook,
  sendSupportMessage,
  subscribeToSupportThread,
};
