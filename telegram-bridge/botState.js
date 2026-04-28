/**
 * Bot Shared State
 *
 * Central state shared between index.js, botCommands.js, and botBroadcast.js.
 * Exported so modules can import what they need without circular deps.
 */

import TelegramBot from "node-telegram-bot-api";
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

/** @type {TelegramBot | null} */
export const bot = BOT_TOKEN
  ? new TelegramBot(BOT_TOKEN, { polling: false })
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
