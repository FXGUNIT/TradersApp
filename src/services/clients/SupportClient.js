import { createBffUnavailableResult, hasBff } from "../gateways/base.js";
import {
  createSupportMessage,
  fetchSupportThread,
} from "../gateways/supportGateway.js";
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
  if (Array.isArray(snapshotValue.messages)) {
    return snapshotValue.messages;
  }

  return Object.entries(snapshotValue.messages).map(([id, value]) => ({
    id,
    ...value,
  }));
}

export async function ensureWelcomeMessage(userId, userEmail) {
  if (!userId) return { success: false, skipped: true };

  if (!hasBff()) {
    return createBffUnavailableResult("ensureWelcomeMessage", {
      skipped: true,
    });
  }

  const threadResponse = await fetchSupportThread(userId);
  const messages = mapMessages(threadResponse?.thread || {});
  const hasWelcome = messages.some((message) => message.type === "welcome");

  if (hasWelcome) {
    return { success: true, skipped: true };
  }

  const response = await createSupportMessage(userId, {
    text: `Welcome to TradersApp Support. Your account: ${userEmail}\n\nHow can we help you today?`,
    sender: "admin",
    email: userEmail,
    type: "welcome",
    timestamp: Date.now(),
  });
  return response?.ok
    ? { success: true }
    : createBffUnavailableResult("ensureWelcomeMessage", {
        skipped: true,
      });
}

export function subscribeToSupportThread(userId, handlers) {
  if (!userId) return () => {};

  if (!hasBff()) {
    return () => {};
  }

  let active = true;

  const loadThread = async () => {
    try {
      const response = await fetchSupportThread(userId);
      if (!active) {
        return;
      }

      if (!response?.thread) {
        handlers?.onEmpty?.();
        return;
      }

      handlers?.onMessages?.(mapMessages(response.thread));
    } catch (error) {
      handlers?.onError?.(error);
    }
  };

  void loadThread();
  const intervalId = window.setInterval(loadThread, 3000);
  return () => {
    active = false;
    window.clearInterval(intervalId);
  };
}

export async function sendSupportMessage({ userId, userEmail, text }) {
  if (!userId || !text?.trim()) {
    return { success: false, error: "Missing support message payload" };
  }

  if (!hasBff()) {
    return createBffUnavailableResult("sendSupportMessage");
  }

  const response = await createSupportMessage(userId, {
    text: text.trim(),
    sender: "user",
    timestamp: Date.now(),
    email: userEmail,
  });

  await notifyAdminOfSupportRequest(userEmail, text.trim()).catch((error) => {
    console.warn("Telegram notification failed:", error);
  });

  return response?.ok
    ? { success: true }
    : createBffUnavailableResult("sendSupportMessage");
}

export default {
  ensureWelcomeMessage,
  notifyStartWebhook,
  sendSupportMessage,
  subscribeToSupportThread,
};
