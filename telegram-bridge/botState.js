/**
 * Bot Shared State
 *
 * Central state shared between index.js, botCommands.js, and botBroadcast.js.
 * Exported so modules can import what they need without circular deps.
 */

import { EventEmitter } from "node:events";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.resolve(PROJECT_ROOT, ".env.local") });
dotenv.config({ path: path.resolve(PROJECT_ROOT, ".env") });

// ─── Bot Instance ─────────────────────────────────────────────────────────────

const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.BFF_TELEGRAM_BOT_TOKEN ||
  process.env.VITE_TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error(
    "TELEGRAM_BOT_TOKEN not configured. Please set TELEGRAM_BOT_TOKEN in env.",
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class TelegramApiError extends Error {
  constructor(method, payload) {
    super(payload?.description || `Telegram API ${method} failed`);
    this.name = "TelegramApiError";
    this.method = method;
    this.payload = payload;
  }
}

class TelegramBotClient extends EventEmitter {
  constructor(token) {
    super();
    this.token = token;
    this.apiBase = `https://api.telegram.org/bot${token}`;
    this.polling = false;
    this.nextUpdateId = 0;
  }

  async request(method, payload = {}) {
    const response = await fetch(`${this.apiBase}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new TelegramApiError(method, data);
    }
    return data.result;
  }

  sendMessage(chatId, text, options = {}) {
    return this.request("sendMessage", {
      chat_id: chatId,
      text,
      ...options,
    });
  }

  sendChatAction(chatId, action) {
    return this.request("sendChatAction", {
      chat_id: chatId,
      action,
    });
  }

  setWebHook(url) {
    return this.request("setWebhook", { url });
  }

  answerCallbackQuery(callbackQueryId, options = {}) {
    return this.request("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...options,
    });
  }

  async processUpdate(update) {
    if (update?.message) this.emit("message", update.message);
    if (update?.edited_message) this.emit("edited_message", update.edited_message);
    if (update?.callback_query) this.emit("callback_query", update.callback_query);
  }

  startPolling({ timeout = 30, intervalMs = 500 } = {}) {
    if (this.polling) return;
    this.polling = true;
    this.pollUpdates({ timeout, intervalMs }).catch((err) => {
      this.emit("polling_error", err);
    });
  }

  stopPolling() {
    this.polling = false;
  }

  async pollUpdates({ timeout, intervalMs }) {
    while (this.polling) {
      try {
        const updates = await this.request("getUpdates", {
          offset: this.nextUpdateId || undefined,
          timeout,
          allowed_updates: ["message", "edited_message", "callback_query"],
        });
        for (const update of updates || []) {
          if (Number.isFinite(update?.update_id)) {
            this.nextUpdateId = update.update_id + 1;
          }
          await this.processUpdate(update);
        }
      } catch (err) {
        this.emit("polling_error", err);
        await sleep(5000);
      }
      await sleep(intervalMs);
    }
  }
}

/** @type {TelegramBotClient | null} */
export const bot = BOT_TOKEN
  ? new TelegramBotClient(BOT_TOKEN)
  : null;

// ─── Admin Chat IDs ───────────────────────────────────────────────────────────

/** @type {number[]} */
export let adminChats = [];
if (process.env.TELEGRAM_ADMIN_CHAT_IDS) {
  adminChats = process.env.TELEGRAM_ADMIN_CHAT_IDS.split(",")
    .map((id) => Number(id.trim()))
    .filter((n) => !Number.isNaN(n));
}

export function parseChatIds(value) {
  return String(value || "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((n) => Number.isFinite(n));
}

export function getAllowedConversationChats() {
  return [
    ...adminChats,
    ...parseChatIds(process.env.TELEGRAM_ALLOWED_CHAT_IDS),
    ...parseChatIds(process.env.TELEGRAM_CHAT_ID),
    ...parseChatIds(process.env.BFF_TELEGRAM_CHAT_ID),
    ...parseChatIds(process.env.BOARD_ROOM_TELEGRAM_CHAT_ID),
  ];
}

export function isAllowedConversationChat(chatId) {
  if (process.env.TELEGRAM_ALLOW_ALL_CHATS === "true") return true;
  const numericChatId = Number(chatId);
  return getAllowedConversationChats().includes(numericChatId);
}

/**
 * Add chat IDs at runtime (called by index.js after loading env).
 * @param {number[]} ids
 */
export function setAdminChats(ids) {
  adminChats = ids;
}

// ─── User Registry ────────────────────────────────────────────────────────────

const USER_REGISTRY_PATH = path.resolve(__dirname, "user_registry.json");

/** @type {Record<string, {chatId: string, username: string|null, firstName: string|null, lastSeen: number, subscribed: boolean, firstSeen: number}>} */
export let userRegistry = {};

export function loadUserRegistry() {
  try {
    if (fs.existsSync(USER_REGISTRY_PATH)) {
      userRegistry = JSON.parse(fs.readFileSync(USER_REGISTRY_PATH, "utf8"));
    }
  } catch {
    userRegistry = {};
  }
}

export function saveUserRegistry() {
  try {
    fs.writeFileSync(USER_REGISTRY_PATH, JSON.stringify(userRegistry, null, 2));
  } catch (e) {
    console.error("[userRegistry] Save failed:", e.message);
  }
}

/**
 * Register or update a Telegram user in the registry.
 * @param {object} msg - Telegram message object
 */
export function registerTelegramUser(msg) {
  if (!msg?.chat?.id) return;
  const chatId = String(msg.chat.id);
  const existing = userRegistry[chatId] || {};
  userRegistry[chatId] = {
    chatId,
    username: msg.from?.username || existing.username || null,
    firstName: msg.from?.first_name || existing.firstName || null,
    lastSeen: Date.now(),
    subscribed: existing.subscribed !== false,
    firstSeen: existing.firstSeen || Date.now(),
  };
  saveUserRegistry();
}

/**
 * @returns {object[]}
 */
export function getSubscribedUsers() {
  return Object.values(userRegistry).filter((u) => u.subscribed);
}

// Load on module init
loadUserRegistry();
