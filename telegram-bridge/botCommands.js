/**
 * Telegram Bot Command Handlers
 *
 * All handle* functions and bot event wiring live here.
 * Imports botState (bot, adminChats) and aiConversation (processConversation).
 */

import {
  bot,
  adminChats,
  isAllowedConversationChat,
  registerTelegramUser,
} from "./botState.js";
import { processConversation, sessionStore } from "./aiConversation.js";

// ─── Typing State ─────────────────────────────────────────────────────────────

const typingState = new Map();
let botHandlersRegistered = false;

/**
 * @param {number|string} chatId
 */
export function sendTypingAction(chatId) {
  if (!bot) return;
  try {
    bot.sendChatAction(chatId, "typing").catch(() => {});
    typingState.set(chatId, true);
  } catch (e) {
    console.error("sendChatAction error", e);
  }
}

/**
 * @param {number|string} chatId
 */
export function clearTypingState(chatId) {
  typingState.delete(chatId);
}

// ─── Message Handler ─────────────────────────────────────────────────────────

/**
 * @param {object} msg - Telegram message object
 */
export async function handleBotMessage(msg) {
  if (!msg || !msg.text || !msg.chat) return;
  registerTelegramUser(msg);
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text.startsWith("/id") || text.startsWith("/chatid")) {
    await bot.sendMessage(
      chatId,
      `This chat id is ${chatId}. Add it to TELEGRAM_ALLOWED_CHAT_IDS if this group should talk with me.`,
      { disable_web_page_preview: true },
    );
    return;
  }

  // Private chats are allowed. Groups must be explicitly configured so the bot
  // does not start talking in every group it is added to.
  if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
    if (!isAllowedConversationChat(chatId)) {
      console.log(
        `[telegram] Ignoring group chat ${chatId}; add it to TELEGRAM_ALLOWED_CHAT_IDS to enable replies.`,
      );
      return;
    }
  }

  sendTypingAction(chatId);

  try {
    const isAdmin = adminChats.includes(chatId);
    const response = await processConversation(text, {
      chatId,
      userId: msg.from?.id?.toString(),
      username: msg.from?.username,
      firstName: msg.from?.first_name,
      isAdmin,
    });

    // Split long messages to stay under Telegram's 4096 char limit
    const chunks = [];
    const reply = String(response || "").trim() || "I am here, but I did not get a response body.";
    if (reply.length > 4096) {
      for (let i = 0; i < reply.length; i += 4096 - 10) {
        chunks.push(reply.slice(i, i + 4096 - 10));
      }
    } else {
      chunks.push(reply);
    }

    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk, {
        disable_web_page_preview: true,
      });
      if (chunks.length > 1) await new Promise((r) => setTimeout(r, 200));
    }
  } catch (e) {
    console.error("Bot message handler error:", e);
    try {
      await bot.sendMessage(chatId, `Sorry, I encountered an error: ${e.message}`);
    } catch (sendErr) {
      console.error("Failed to send error message:", sendErr);
    }
  } finally {
    clearTypingState(chatId);
  }
}

// ─── Polling Setup ───────────────────────────────────────────────────────────

export function setupBotPolling() {
  if (!bot) {
    console.log("Telegram bot not initialized (no BOT_TOKEN)");
    return;
  }
  bot.on("message", handleBotMessage);
  bot.on("edited_message", handleBotMessage);
  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat?.id;
    const data = query.data;
    if (!chatId || !data) return;
    sendTypingAction(chatId);
    try {
      const response = await processConversation(data, {
        chatId,
        userId: query.from?.id?.toString(),
        username: query.from?.username,
      });
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, response, { disable_web_page_preview: true });
    } catch (e) {
      console.error("Callback query error:", e);
      await bot.answerCallbackQuery(query.id, {
        text: "Error processing request",
      });
    } finally {
      clearTypingState(chatId);
    }
  });
  bot.on("polling_error", (err) => {
    console.error("Polling error:", err.message);
  });
  console.log("Telegram bot initialized in polling mode");
}

// ─── Webhook Setup ───────────────────────────────────────────────────────────

export function setupBotWebhook() {
  if (!bot) {
    console.log("Telegram bot not initialized (no BOT_TOKEN)");
    return;
  }
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("TELEGRAM_WEBHOOK_URL not set — falling back to polling");
    setupBotPolling();
    return;
  }
  try {
    bot
      .setWebHook(webhookUrl)
      .then(() => {
        console.log(`Webhook set to: ${webhookUrl}`);
      })
      .catch((err) => {
        console.error("Failed to set webhook:", err);
        setupBotPolling();
      });
  } catch (e) {
    console.error("Webhook setup error:", e);
    setupBotPolling();
  }
}

// ─── Status Helper (used by index.js for /telegram/status) ────────────────────

export function getBotStatus() {
  return {
    ok: !!bot,
    mode: process.env.TELEGRAM_BOT_MODE || "polling",
    configured: !!process.env.TELEGRAM_BOT_TOKEN,
    activeSessions: sessionStore ? sessionStore.size : 0,
  };
}
