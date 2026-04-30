/**
 * Telegram Bridge â€” Entry Point
 *
 * Thin orchestrator: wires together botState, botCommands, botBroadcast,
 * support routes, and the AI conversation service.
 *
 * Module breakdown:
 *   botState.js       â€” bot instance, adminChats, userRegistry
 *   botCommands.js    â€” polling/webhook setup, handleBotMessage
 *   botBroadcast.js   â€” broadcast, invite, and user registry routes
 *   aiConversation.js â€” session memory, ML/BFF calls, main orchestrator
 *   aiFormatters.js   â€” formatConsensusForTelegram, formatMLResponse
 *   aiConversationTypes.js â€” AI_PROVIDERS, SYSTEM_PROMPT, types
 */

import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { initFirestore, getDb } from "./firebaseAdmin.js";

// Load env from project root so TELEGRAM_* vars are available to botState
dotenv.config({ path: path.resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

// â”€â”€â”€ Shared state (imported for side-effects: bot init, userRegistry load) â”€â”€
import {
  bot,
  adminChats,
  loadUserRegistry,
} from "./botState.js";

import {
  setupBotPolling,
  setupBotWebhook,
  handleBotMessage,
} from "./botCommands.js";

import {
  registerBroadcastRoutes,
  registerUserRoutes,
  registerInviteRoutes,
} from "./botBroadcast.js";

// â”€â”€â”€ Email Service (emailjs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function sendWelcomeEmail(toEmail, toName) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.log(
      "[sendWelcomeEmail] not configured â€” EMAILJS_* env vars missing; skipping",
    );
    return false;
  }

  try {
    const emailjs = await import("emailjs-com");
    await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      to_name: toName || toEmail,
      to_name_first: (toName || toEmail).split(" ")[0],
      reply_to: "support@traders.app",
      app_url: process.env.FRONTEND_URL || "https://traders.app",
    });
    console.log(`[sendWelcomeEmail] Sent to ${toEmail}`);
    return true;
  } catch (e) {
    console.error("[sendWelcomeEmail] Failed to send to", toEmail, ":", e?.message || e);
    return false;
  }
}

// Share sendWelcomeEmail and adminDb2 with botBroadcast via globals
globalThis.__sendWelcomeEmail = sendWelcomeEmail;

// â”€â”€â”€ Firebase Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let adminDb = null;
try {
  initFirestore();
  adminDb = getDb();
  console.log("Telegram Bridge: Firestore initialized for support chat");
} catch (err) {
  console.error("Telegram Bridge: Firestore not available:", err.message);
}

let adminDb2 = null;
try {
  adminDb2 = getDb();
  if (adminDb2) {
    console.log("Telegram Bridge: Firestore initialized via Firebase Admin");
    globalThis.__adminDb2 = adminDb2;
  } else {
    console.log("Telegram Bridge: Firestore not available; using local invites fallback");
  }
} catch (err) {
  console.error("Telegram Bridge: failed to initialize Firebase Admin", err);
}

// â”€â”€â”€ Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ADMIN_API_KEY = process.env.TELEGRAM_ADMIN_API_KEY;
const SUPPORT_SERVICE_KEY =
  process.env.SUPPORT_SERVICE_KEY || process.env.TELEGRAM_ADMIN_API_KEY || "";

function requireApiKey(req, res, next) {
  if (!ADMIN_API_KEY) return next();
  const key = req.headers["x-admin-api-key"] || req.headers["x-api-key"];
  if (key && key === ADMIN_API_KEY) return next();
  return res.status(403).json({ ok: false, error: "Forbidden" });
}

function requireSupportKey(req, res, next) {
  if (!SUPPORT_SERVICE_KEY) return next();
  if (req.headers["x-support-key"] === SUPPORT_SERVICE_KEY) return next();
  return res.status(403).json({ ok: false, error: "Invalid service key" });
}

// â”€â”€â”€ App Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const app = express();
const port = process.env.TELEGRAM_BRIDGE_PORT || 5001;

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: "Too many admin requests, please try again later.",
});
const botLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many messages. Slow down.",
});

app.use(cors());
app.use(bodyParser.json());

// â”€â”€â”€ Support Chat Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function notifyAdminSupport(userEmail, userName, userId, message) {
  const { forwardToAdmins } = await import("./botBroadcast.js");
  if (!bot || adminChats.length === 0) return false;
  const text =
    `ðŸ’¬ *New Support Message*\n\n*From:* ${userName} (${userEmail})\n*UID:* ${userId}\n*Time:* ${new Date().toLocaleString()}\n\n*Message:*\n${message.slice(0, 500)}${message.length > 500 ? "..." : ""}`;
  for (const chat of adminChats) {
    try {
      await bot.sendMessage(chat, text, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
    } catch (e) {
      console.error("Support notify error", e);
    }
  }
  return true;
}

function normalizeMessage(message) {
  const timestamp = Number(message.timestamp) || Date.now();
  return {
    ...message,
    text: String(message.text || "").trim(),
    timestamp,
    read: Boolean(message.read),
  };
}

async function saveSupportMessage(userId, message) {
  if (!adminDb) return false;
  try {
    const uid = String(userId);
    const normalized = normalizeMessage(message);
    const threadRef = adminDb.collection("support_chats").doc(uid);
    await threadRef.set(
      {
        uid,
        updatedAt: normalized.timestamp,
        lastMessage: normalized,
      },
      { merge: true },
    );
    await threadRef.collection("messages").add(normalized);
    return true;
  } catch (e) {
    console.error("Firestore save support message error", e);
    return false;
  }
}

async function listSupportThreads() {
  if (!adminDb) return [];
  const snapshot = await adminDb.collection("support_chats").get();
  const threads = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const messages = await getSupportMessages(doc.id, "desc");
      const unread = messages.filter((m) => m.sender === "user" && !m.read).length;
      return {
        uid: doc.id,
        messages,
        lastMessage: messages[0] || doc.data()?.lastMessage || {},
        unreadCount: unread,
        totalMessages: messages.length,
      };
    }),
  );
  return threads.sort(
    (a, b) => (b.lastMessage.timestamp || 0) - (a.lastMessage.timestamp || 0),
  );
}

async function getSupportMessages(userId, direction = "asc") {
  if (!adminDb) return [];
  const snapshot = await adminDb
    .collection("support_chats")
    .doc(String(userId))
    .collection("messages")
    .orderBy("timestamp", direction)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function saveAdminReplyToFirebase(userId, adminName, text) {
  return saveSupportMessage(userId, {
      sender: "admin",
      senderName: adminName || "Support Team",
      senderEmail: "admin@traders.app",
      text: text.trim(),
      timestamp: Date.now(),
      read: false,
      fromTelegram: true,
    });
}

app.post("/support/message", requireSupportKey, async (req, res) => {
  const { userId, userEmail, userName, text } = req.body || {};
  if (!userId || !text?.trim()) {
    return res.status(400).json({ ok: false, error: "userId and text required" });
  }
  try {
    if (adminDb) {
      await saveSupportMessage(userId, {
        sender: "user",
        senderName: userName || "User",
        senderEmail: userEmail || "",
        text: text.trim(),
        timestamp: Date.now(),
        read: false,
        fromTelegram: false,
      });
    }
    const notified = await notifyAdminSupport(userEmail, userName, userId, text.trim());
    res.json({ ok: true, notified, timestamp: Date.now() });
  } catch (e) {
    console.error("/support/message error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/support/telegram-reply", requireSupportKey, async (req, res) => {
  const { userId, adminName, text, adminChatId } = req.body || {};
  if (!userId || !text?.trim()) {
    return res.status(400).json({ ok: false, error: "userId and text required" });
  }
  try {
    const saved = await saveAdminReplyToFirebase(userId, adminName, text);
    if (saved && adminChatId) {
      await bot.sendMessage(adminChatId, "âœ… Reply sent to user.").catch(() => {});
    }
    res.json({ ok: saved, saved: !!saved });
  } catch (e) {
    console.error("/support/telegram-reply error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/support/chats", requireSupportKey, async (req, res) => {
  if (!adminDb) return res.json({ ok: false, chats: [], source: "fallback" });
  try {
    const chats = (await listSupportThreads()).map(
      ({ uid, lastMessage, unreadCount, totalMessages }) => ({
        uid,
        lastMessage,
        unreadCount,
        totalMessages,
      }),
    );
    res.json({ ok: true, chats, source: "firestore" });
  } catch (e) {
    console.error("/support/chats error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/support/chats/:userId", requireSupportKey, async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
  if (!adminDb) return res.json({ ok: false, messages: [], source: "fallback" });
  try {
    const messages = await getSupportMessages(userId, "asc");
    res.json({ ok: true, messages, source: "firestore" });
  } catch (e) {
    console.error("/support/chats/:userId error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/support/chats/:userId/reply", requireSupportKey, async (req, res) => {
  const { userId } = req.params;
  const { text, adminName } = req.body || {};
  if (!userId || !text?.trim()) {
    return res.status(400).json({ ok: false, error: "userId and text required" });
  }
  try {
    const saved = await saveAdminReplyToFirebase(userId, adminName, text);
    res.json({ ok: saved, saved });
  } catch (e) {
    console.error("/support/chats/:userId/reply error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// â”€â”€â”€ Frontend Alias Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get("/support/threads", requireSupportKey, async (req, res) => {
  if (!adminDb) return res.json({ ok: false, thread: null, threads: [], source: "fallback" });
  try {
    const threads = (await listSupportThreads()).map(
      ({ uid, messages, unreadCount, totalMessages, lastMessage }) => ({
        uid,
        thread: { messages },
        unreadCount,
        totalMessages,
        lastMessage,
      }),
    );
    res.json({ ok: true, threads, source: "firestore" });
  } catch (e) {
    console.error("/support/threads error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/support/threads/:uid", requireSupportKey, async (req, res) => {
  const { uid } = req.params;
  if (!uid) return res.status(400).json({ ok: false, error: "uid required" });
  if (!adminDb) return res.json({ ok: false, thread: null, source: "fallback" });
  try {
    const messages = await getSupportMessages(uid, "asc");
    res.json({ ok: true, thread: { messages }, source: "firestore" });
  } catch (e) {
    console.error("/support/threads/:uid error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/support/threads/:uid/messages", requireSupportKey, async (req, res) => {
  const { uid } = req.params;
  const { text, sender, email, type, timestamp } = req.body || {};
  if (!uid || !text?.trim()) {
    return res.status(400).json({ ok: false, error: "uid and text required" });
  }
  try {
    if (adminDb) {
      await saveSupportMessage(uid, {
        sender: sender || "user",
        senderName:
          sender === "admin"
            ? req.body?.adminName || "Support Team"
            : req.body?.userName || "User",
        senderEmail: email || "",
        text: text.trim(),
        timestamp: timestamp || Date.now(),
        read: false,
        fromTelegram: sender === "admin",
        ...(type ? { type } : {}),
      });
    }
    if (sender !== "admin") {
      await notifyAdminSupport(email || "", req.body?.userName || "User", uid, text.trim());
    }
    res.json({ ok: true, timestamp: Date.now() });
  } catch (e) {
    console.error("/support/threads/:uid/messages error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// â”€â”€â”€ Telegram Bot Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.post("/telegram/webhook", async (req, res) => {
  try {
    if (bot && req.body) {
      if (typeof bot.processUpdate === "function") {
        await bot.processUpdate(req.body);
      } else if (req.body.message) {
        handleBotMessage(req.body.message).catch(console.error);
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("Webhook receiver error:", e);
    res.json({ ok: false });
  }
});

app.post("/telegram/ai", botLimiter, async (req, res) => {
  const { processConversation } = await import("./aiConversation.js");
  const { text, chatId, userId, context } = req.body || {};
  if (!text) return res.status(400).json({ ok: false, error: "text required" });
  try {
    const response = await processConversation(text, { chatId, userId, ...context });
    res.json({ ok: true, response });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// â”€â”€â”€ Register modular routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

registerBroadcastRoutes(app);
registerUserRoutes(app);
registerInviteRoutes(app);

// â”€â”€â”€ Bot Initialization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BOT_MODE = process.env.TELEGRAM_BOT_MODE || "polling";

if (BOT_MODE === "webhook") {
  setupBotWebhook();
} else {
  setupBotPolling();
}

// â”€â”€â”€ Start Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

loadUserRegistry(); // restore user registry on startup
app.listen(port, () => {
  console.log(`Telegram bridge listening on port ${port}`);
});
