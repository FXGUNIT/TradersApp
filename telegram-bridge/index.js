<<<<<<< HEAD
/**
 * Telegram Bridge — Entry Point
 *
 * Thin orchestrator: wires together botState, botCommands, botBroadcast,
 * support routes, and the AI conversation service.
 *
 * Module breakdown:
 *   botState.js       — bot instance, adminChats, userRegistry
 *   botCommands.js    — polling/webhook setup, handleBotMessage
 *   botBroadcast.js   — broadcast, invite, and user registry routes
 *   aiConversation.js — session memory, ML/BFF calls, main orchestrator
 *   aiFormatters.js   — formatConsensusForTelegram, formatMLResponse
 *   aiConversationTypes.js — AI_PROVIDERS, SYSTEM_PROMPT, types
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

// ─── Shared state (imported for side-effects: bot init, userRegistry load) ──
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

// ─── Email Service (emailjs) ─────────────────────────────────────────────────

async function sendWelcomeEmail(toEmail, toName) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.log(
      "[sendWelcomeEmail] not configured — EMAILJS_* env vars missing; skipping",
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

// ─── Firebase Admin ──────────────────────────────────────────────────────────

let adminDb = null;
try {
  initFirestore();
  adminDb = getDb();
  console.log("Telegram Bridge: Firestore initialized for support chat");
=======
require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const TelegramBot = require('node-telegram-bot-api')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const invitesService = require('./invitesService')
const { processConversation, AI_PROVIDERS } = require('./aiConversation')

// ─── Email Service (emailjs) ─────────────────────────────────────────────────
/**
 * Send welcome email to a newly approved user.
 * Uses emailjs-com (configured via environment variables).
 * Gracefully skips if env vars not set.
 */
async function sendWelcomeEmail(toEmail, toName) {
  const serviceId = process.env.EMAILJS_SERVICE_ID
  const templateId = process.env.EMAILJS_TEMPLATE_ID
  const publicKey = process.env.EMAILJS_PUBLIC_KEY

  if (!serviceId || !templateId || !publicKey) {
    console.log('[sendWelcomeEmail] not configured — EMAILJS_* env vars missing; skipping')
    return false
  }

  try {
    const emailjs = await import('emailjs-com')
    await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      to_name: toName || toEmail,
      to_name_first: (toName || toEmail).split(' ')[0],
      reply_to: 'support@traders.app',
      app_url: process.env.FRONTEND_URL || 'https://traders.app',
    })
    console.log(`[sendWelcomeEmail] Sent to ${toEmail}`)
    return true
  } catch (e) {
    console.error('[sendWelcomeEmail] Failed to send to', toEmail, ':', e?.message || e)
    return false
  }
}

// ─── App Declaration (MUST be first) ─────────────────────────────────────────
const app = express()
const port = process.env.TELEGRAM_BRIDGE_PORT || 5001
const rateLimit = require('express-rate-limit')
const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: 'Too many admin requests, please try again later.' })
const botLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: 'Too many messages. Slow down.' })

// ─── Firebase Admin for Support Chat ───────────────────────────────────────
let adminDb = null
try {
  const { initFirestore, getDb } = require('./firebaseAdmin')
  initFirestore()
  adminDb = getDb()
  console.log('Telegram Bridge: Firestore initialized for support chat')
} catch (err) {
  console.error('Telegram Bridge: Firestore not available:', err.message)
}

// ─── Firebase Admin (invites) ────────────────────────────────────────────────
let adminDb2 = null
try {
  const { initFirestore, getDb } = require('./firebaseAdmin')
  initFirestore()
  adminDb2 = getDb()
  if (adminDb2) console.log('Telegram Bridge: Firestore initialized via Firebase Admin')
  else console.log('Telegram Bridge: Firestore not available; using local invites fallback')
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
} catch (err) {
  console.error("Telegram Bridge: Firestore not available:", err.message);
}

<<<<<<< HEAD
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

// ─── Security ───────────────────────────────────────────────────────────────

const ADMIN_API_KEY = process.env.TELEGRAM_ADMIN_API_KEY;
const SUPPORT_SERVICE_KEY =
  process.env.SUPPORT_SERVICE_KEY || process.env.TELEGRAM_ADMIN_API_KEY || "";
=======
// ─── Security ────────────────────────────────────────────────────────────────
const ADMIN_API_KEY = process.env.TELEGRAM_ADMIN_API_KEY
const SUPPORT_SERVICE_KEY = process.env.SUPPORT_SERVICE_KEY || process.env.TELEGRAM_ADMIN_API_KEY || ''
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN not configured. Please set TELEGRAM_BOT_TOKEN in env.')
}

let adminChats = []
if (process.env.TELEGRAM_ADMIN_CHAT_IDS) {
  adminChats = process.env.TELEGRAM_ADMIN_CHAT_IDS.split(',').map(id => Number(id.trim())).filter(n => !Number.isNaN(n))
}

// ─── User registry — tracks all Telegram users who have interacted ─────────────
const USER_REGISTRY_PATH = path.resolve(__dirname, 'user_registry.json')
let userRegistry = {} // { chatId: { chatId, username, firstName, lastSeen, subscribed } }

function loadUserRegistry() {
  try {
    if (fs.existsSync(USER_REGISTRY_PATH)) {
      userRegistry = JSON.parse(fs.readFileSync(USER_REGISTRY_PATH, 'utf8'))
    }
  } catch { userRegistry = {} }
}
function saveUserRegistry() {
  try {
    fs.writeFileSync(USER_REGISTRY_PATH, JSON.stringify(userRegistry, null, 2))
  } catch (e) { console.error('[userRegistry] Save failed:', e.message) }
}

function registerTelegramUser(msg) {
  if (!msg?.chat?.id) return
  const chatId = String(msg.chat.id)
  const existing = userRegistry[chatId] || {}
  userRegistry[chatId] = {
    chatId,
    username: msg.from?.username || existing.username || null,
    firstName: msg.from?.first_name || existing.firstName || null,
    lastSeen: Date.now(),
    subscribed: existing.subscribed !== false, // default true
    firstSeen: existing.firstSeen || Date.now(),
  }
  saveUserRegistry()
}

function getSubscribedUsers() {
  return Object.values(userRegistry).filter(u => u.subscribed)
}

const bot = BOT_TOKEN ? new TelegramBot(BOT_TOKEN, { polling: false }) : null

// ─── Session store (shared with AI conversation) ───────────────────────────
let sessionStore = new Map()
try {
  const { AI_PROVIDERS: _AP } = require('./aiConversation')
} catch {}

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors())
app.use(bodyParser.json())
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

function requireApiKey(req, res, next) {
  if (!ADMIN_API_KEY) return next();
  const key = req.headers["x-admin-api-key"] || req.headers["x-api-key"];
  if (key && key === ADMIN_API_KEY) return next();
  return res.status(403).json({ ok: false, error: "Forbidden" });
}

function requireSupportKey(req, res, next) {
<<<<<<< HEAD
  if (!SUPPORT_SERVICE_KEY) return next();
  if (req.headers["x-support-key"] === SUPPORT_SERVICE_KEY) return next();
  return res.status(403).json({ ok: false, error: "Invalid service key" });
}

// ─── App Setup ──────────────────────────────────────────────────────────────

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

// ─── Support Chat Routes ───────────────────────────────────────────────────

async function notifyAdminSupport(userEmail, userName, userId, message) {
  const { forwardToAdmins } = await import("./botBroadcast.js");
  if (!bot || adminChats.length === 0) return false;
  const text =
    `💬 *New Support Message*\n\n*From:* ${userName} (${userEmail})\n*UID:* ${userId}\n*Time:* ${new Date().toLocaleString()}\n\n*Message:*\n${message.slice(0, 500)}${message.length > 500 ? "..." : ""}`;
=======
  if (!SUPPORT_SERVICE_KEY) return next() // Disable auth in dev
  if (req.headers['x-support-key'] === SUPPORT_SERVICE_KEY) return next()
  return res.status(403).json({ ok: false, error: 'Invalid service key' })
}

// ─── Support Chat Helpers ───────────────────────────────────────────────────

async function notifyAdminSupport(userEmail, userName, userId, message) {
  if (!bot || adminChats.length === 0) return false
  const text = `💬 *New Support Message*\n\n*From:* ${userName} (${userEmail})\n*UID:* ${userId}\n*Time:* ${new Date().toLocaleString()}\n\n*Message:*\n${message.slice(0, 500)}${message.length > 500 ? '...' : ''}`
  for (const chat of adminChats) {
    try { await bot.sendMessage(chat, text, { parse_mode: 'Markdown', disable_web_page_preview: true }) }
    catch (e) { console.error('Support notify error', e) }
  }
  return true
}

async function saveAdminReplyToFirebase(userId, adminName, text) {
  if (!adminDb) return false
  try {
    const { ref, push, set } = require('firebase-admin/firestore')
    const msgRef = push(ref(adminDb, `support_chats/${userId}/messages`))
    await set(msgRef, {
      sender: 'admin',
      senderName: adminName || 'Support Team',
      senderEmail: 'admin@traders.app',
      text: text.trim(),
      timestamp: Date.now(),
      read: false,
      fromTelegram: true,
    })
    return true
  } catch (e) {
    console.error('Firebase save reply error', e)
    return false
  }
}

// ─── Support Chat Routes ────────────────────────────────────────────────────

/**
 * POST /support/message
 * Called by BFF or frontend when a user sends a support message.
 * Saves to Firestore and notifies admin via Telegram.
 * Body: { userId, userEmail, userName, text }
 */
app.post('/support/message', requireSupportKey, async (req, res) => {
  const { userId, userEmail, userName, text } = req.body || {}
  if (!userId || !text?.trim()) {
    return res.status(400).json({ ok: false, error: 'userId and text required' })
  }

  try {
    if (adminDb) {
      try {
        const { ref, push, set } = require('firebase-admin/firestore')
        const msgRef = push(ref(adminDb, `support_chats/${userId}/messages`))
        await set(msgRef, {
          sender: 'user',
          senderName: userName || 'User',
          senderEmail: userEmail || '',
          text: text.trim(),
          timestamp: Date.now(),
          read: false,
          fromTelegram: false,
        })
      } catch (e) {
        console.error('Firestore save error (support/message)', e)
      }
    }

    const notified = await notifyAdminSupport(userEmail, userName, userId, text.trim())
    res.json({ ok: true, notified, timestamp: Date.now() })
  } catch (e) {
    console.error('/support/message error:', e)
    res.status(500).json({ ok: false, error: e.message })
  }
})

/**
 * POST /support/telegram-reply
 * Called when admin replies via Telegram inline keyboard or direct message.
 * Saves the reply to Firebase so the user sees it in real-time.
 * Body: { userId, adminName, text, adminChatId }
 * Header: X-Support-Key: <service_key>
 */
app.post('/support/telegram-reply', requireSupportKey, async (req, res) => {
  const { userId, adminName, text, adminChatId } = req.body || {}
  if (!userId || !text?.trim()) {
    return res.status(400).json({ ok: false, error: 'userId and text required' })
  }

  try {
    const saved = await saveAdminReplyToFirebase(userId, adminName, text)
    if (saved && adminChatId) {
      await bot.sendMessage(adminChatId, '✅ Reply sent to user.').catch(() => {})
    }
    res.json({ ok: saved, saved: !!saved })
  } catch (e) {
    console.error('/support/telegram-reply error:', e)
    res.status(500).json({ ok: false, error: e.message })
  }
})

/**
 * GET /support/chats
 * List all support chat conversations (admin dashboard).
 */
app.get('/support/chats', requireSupportKey, async (req, res) => {
  if (!adminDb) return res.json({ ok: false, chats: [], source: 'fallback' })
  try {
    const { ref, get } = require('firebase-admin/firestore')
    const snapshot = await get(ref(adminDb, 'support_chats'))
    const data = snapshot.data() || {}
    const chats = Object.entries(data).map(([uid, chatData]) => {
      const messages = chatData.messages || {}
      const msgList = Object.values(messages).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      const unread = msgList.filter(m => m.sender === 'user' && !m.read).length
      return {
        uid,
        lastMessage: msgList[0] || {},
        unreadCount: unread,
        totalMessages: msgList.length,
      }
    }).sort((a, b) => (b.lastMessage.timestamp || 0) - (a.lastMessage.timestamp || 0))
    res.json({ ok: true, chats, source: 'firestore' })
  } catch (e) {
    console.error('/support/chats error:', e)
    res.status(500).json({ ok: false, error: e.message })
  }
})

/**
 * GET /support/chats/:userId
 * Get messages for a specific support chat.
 */
app.get('/support/chats/:userId', requireSupportKey, async (req, res) => {
  const { userId } = req.params
  if (!userId) return res.status(400).json({ ok: false, error: 'userId required' })
  if (!adminDb) return res.json({ ok: false, messages: [], source: 'fallback' })
  try {
    const { ref, get } = require('firebase-admin/firestore')
    const snapshot = await get(ref(adminDb, `support_chats/${userId}/messages`))
    const data = snapshot.data() || {}
    const messages = Object.values(data).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    res.json({ ok: true, messages, source: 'firestore' })
  } catch (e) {
    console.error('/support/chats/:userId error:', e)
    res.status(500).json({ ok: false, error: e.message })
  }
})

/**
 * POST /support/chats/:userId/reply
 * Send admin reply to a user from the admin dashboard (web).
 */
app.post('/support/chats/:userId/reply', requireSupportKey, async (req, res) => {
  const { userId } = req.params
  const { text, adminName } = req.body || {}
  if (!userId || !text?.trim()) return res.status(400).json({ ok: false, error: 'userId and text required' })
  try {
    const saved = await saveAdminReplyToFirebase(userId, adminName, text)
    res.json({ ok: saved, saved })
  } catch (e) {
    console.error('/support/chats/:userId/reply error:', e)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ─── Frontend Alias Routes (same handlers, different paths) ─────────────────

/**
 * GET /support/threads — list all support threads (admin dashboard).
 * Alias for GET /support/chats.
 */
app.get('/support/threads', requireSupportKey, async (req, res) => {
  if (!adminDb) return res.json({ ok: false, thread: null, threads: [], source: 'fallback' })
  try {
    const { ref, get } = require('firebase-admin/firestore')
    const snapshot = await get(ref(adminDb, 'support_chats'))
    const data = snapshot.data() || {}
    const threads = Object.entries(data).map(([uid, chatData]) => {
      const messages = chatData.messages || {}
      const msgList = Object.values(messages).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      const unread = msgList.filter(m => m.sender === 'user' && !m.read).length
      return {
        uid,
        thread: {
          messages: msgList,
        },
        unreadCount: unread,
        totalMessages: msgList.length,
        lastMessage: msgList[0] || {},
      }
    }).sort((a, b) => (b.lastMessage.timestamp || 0) - (a.lastMessage.timestamp || 0))
    res.json({ ok: true, threads, source: 'firestore' })
  } catch (e) {
    console.error('/support/threads error:', e)
    res.status(500).json({ ok: false, error: e.message })
  }
})

/**
 * GET /support/threads/:uid — get messages for a specific support thread.
 * Alias for GET /support/chats/:userId.
 */
app.get('/support/threads/:uid', requireSupportKey, async (req, res) => {
  const { uid } = req.params
  if (!uid) return res.status(400).json({ ok: false, error: 'uid required' })
  if (!adminDb) return res.json({ ok: false, thread: null, source: 'fallback' })
  try {
    const { ref, get } = require('firebase-admin/firestore')
    const snapshot = await get(ref(adminDb, `support_chats/${uid}/messages`))
    const data = snapshot.data() || {}
    const messages = Object.values(data).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    res.json({ ok: true, thread: { messages }, source: 'firestore' })
  } catch (e) {
    console.error('/support/threads/:uid error:', e)
    res.status(500).json({ ok: false, error: e.message })
  }
})

/**
 * POST /support/threads/:uid/messages — add a message to a support thread.
 * Body: { text, sender, email, type?, timestamp? }
 */
app.post('/support/threads/:uid/messages', requireSupportKey, async (req, res) => {
  const { uid } = req.params
  const { text, sender, email, type, timestamp } = req.body || {}
  if (!uid || !text?.trim()) return res.status(400).json({ ok: false, error: 'uid and text required' })
  try {
    if (adminDb) {
      const { ref, push, set } = require('firebase-admin/firestore')
      const msgRef = push(ref(adminDb, `support_chats/${uid}/messages`))
      await set(msgRef, {
        sender: sender || 'user',
        senderName: sender === 'admin' ? (req.body?.adminName || 'Support Team') : (req.body?.userName || 'User'),
        senderEmail: email || '',
        text: text.trim(),
        timestamp: timestamp || Date.now(),
        read: false,
        fromTelegram: sender === 'admin',
        ...(type ? { type } : {}),
      })
    }
    // Notify admin via Telegram if it's a user message
    if (sender !== 'admin') {
      const userEmail = email || ''
      const userName = req.body?.userName || 'User'
      await notifyAdminSupport(userEmail, userName, uid, text.trim())
    }
    res.json({ ok: true, timestamp: Date.now() })
  } catch (e) {
    console.error('/support/threads/:uid/messages error:', e)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ─── Telegram Bot: AI Conversation Handler ──────────────────────────────────
const BOT_MODE = process.env.TELEGRAM_BOT_MODE || 'polling'

const typingState = new Map()

function sendTypingAction(chatId) {
  if (!bot) return
  try {
    bot.sendChatAction(chatId, 'typing').catch(() => {})
    typingState.set(chatId, true)
  } catch (e) {
    console.error('sendChatAction error', e)
  }
}

function clearTypingState(chatId) {
  typingState.delete(chatId)
}

async function handleBotMessage(msg) {
  if (!msg || !msg.text || !msg.chat) return
  registerTelegramUser(msg) // track all users
  const chatId = msg.chat.id
  const text = msg.text.trim()

  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    if (!adminChats.includes(chatId)) return
  }

  sendTypingAction(chatId)

  try {
    const response = await processConversation(text, {
      chatId,
      userId: msg.from?.id?.toString(),
      username: msg.from?.username,
      firstName: msg.from?.first_name,
    })

    const chunks = []
    if (response.length > 4096) {
      for (let i = 0; i < response.length; i += 4096 - 10) {
        chunks.push(response.slice(i, i + 4096 - 10))
      }
    } else {
      chunks.push(response)
    }

    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      })
      if (chunks.length > 1) await new Promise(r => setTimeout(r, 200))
    }
  } catch (e) {
    console.error('Bot message handler error:', e)
    try {
      await bot.sendMessage(chatId, `Sorry, I encountered an error: ${e.message}`)
    } catch (sendErr) {
      console.error('Failed to send error message:', sendErr)
    }
  } finally {
    clearTypingState(chatId)
  }
}

function setupBotPolling() {
  if (!bot) {
    console.log('Telegram bot not initialized (no BOT_TOKEN)')
    return
  }
  bot.on('message', handleBotMessage)
  bot.on('edited_message', handleBotMessage)
  bot.on('callback_query', async (query) => {
    const chatId = query.message?.chat?.id
    const data = query.data
    if (!chatId || !data) return
    sendTypingAction(chatId)
    try {
      const response = await processConversation(data, {
        chatId,
        userId: query.from?.id?.toString(),
        username: query.from?.username,
      })
      await bot.answerCallbackQuery(query.id)
      await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' })
    } catch (e) {
      console.error('Callback query error:', e)
      await bot.answerCallbackQuery(query.id, { text: 'Error processing request' })
    } finally {
      clearTypingState(chatId)
    }
  })
  bot.on('polling_error', (err) => {
    console.error('Polling error:', err.message)
  })
  console.log(`Telegram bot initialized in ${BOT_MODE} mode`)
}

function setupBotWebhook() {
  if (!bot) {
    console.log('Telegram bot not initialized (no BOT_TOKEN)')
    return
  }
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('TELEGRAM_WEBHOOK_URL not set — falling back to polling')
    setupBotPolling()
    return
  }
  try {
    bot.setWebHook(webhookUrl).then(() => {
      console.log(`Webhook set to: ${webhookUrl}`)
    }).catch((err) => {
      console.error('Failed to set webhook:', err)
      setupBotPolling()
    })
  } catch (e) {
    console.error('Webhook setup error:', e)
    setupBotPolling()
  }
}

if (BOT_MODE === 'webhook') {
  setupBotWebhook()
} else {
  setupBotPolling()
}

// ─── Telegram Routes ────────────────────────────────────────────────────────

app.post('/telegram/webhook', async (req, res) => {
  try {
    if (bot && req.body && req.body.message) {
      handleBotMessage(req.body.message).catch(console.error)
    }
    res.json({ ok: true })
  } catch (e) {
    console.error('Webhook receiver error:', e)
    res.json({ ok: false })
  }
})

app.get('/telegram/status', (req, res) => {
  res.json({
    ok: !!bot,
    mode: BOT_MODE,
    configured: !!(BOT_TOKEN),
    providers: Object.keys(AI_PROVIDERS).length,
    activeSessions: sessionStore ? sessionStore.size : 0,
  })
})

app.post('/telegram/ai', botLimiter, async (req, res) => {
  const { text, chatId, userId, context } = req.body || {}
  if (!text) return res.status(400).json({ ok: false, error: 'text required' })
  try {
    const response = await processConversation(text, { chatId, userId, ...context })
    res.json({ ok: true, response })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

async function forwardToAdmins(text) {
  if (!bot || adminChats.length === 0) return
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
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

<<<<<<< HEAD
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
=======
app.post('/telegram/notify', requireApiKey, adminLimiter, async (req, res) => {
  const { event, payload } = req.body || {}
  const headerKey = req.headers['x-telegram-webhook-key']
  if (process.env.TELEGRAM_WEBHOOK_KEY && headerKey !== process.env.TELEGRAM_WEBHOOK_KEY) {
    return res.status(403).json({ ok: false, error: 'Invalid webhook key' })
  }
  const message = `<b>LIVE EVENT</b> - ${event || 'UNKNOWN'}<br/>` +
    (payload ? Object.entries(payload).map(([k, v]) => `<b>${k}</b>: ${v}`).join('<br/>') : '')
  await forwardToAdmins(message)
  res.json({ ok: true })
})

// ─── Admin Broadcast — send message to all subscribed users ───────────────────
app.post('/telegram/broadcast', requireApiKey, async (req, res) => {
  const { message, parse_mode = 'HTML', dry_run = false } = req.body || {}
  if (!message) return res.status(400).json({ ok: false, error: 'message required' })

  const users = getSubscribedUsers()
  if (users.length === 0) {
    return res.json({ ok: true, sent: 0, skipped: 0, message: 'No subscribed users found.' })
  }

  const header = `<b>📢 TradersApp Announcement</b>\n\n`
  const fullMessage = header + message

  if (dry_run) {
    return res.json({
      ok: true,
      dry_run: true,
      recipients: users.length,
      preview: fullMessage.slice(0, 200),
    })
  }

  let sent = 0, skipped = 0
  for (const user of users) {
    try {
      await bot.sendMessage(user.chatId, fullMessage, { parse_mode, disable_web_page_preview: true })
      sent++
      // Rate limit: max 30 msgs/sec (Telegram limit), sleep 35ms between messages
      await new Promise(r => setTimeout(r, 35))
    } catch (e) {
      skipped++
      console.error(`[broadcast] Failed to send to ${user.chatId} (${user.username}):`, e.message)
    }
  }

  console.log(`[broadcast] Sent ${sent}/${users.length} messages, ${skipped} skipped`)
  res.json({ ok: true, sent, skipped, total: users.length })
})

// ─── Subscription management ───────────────────────────────────────────────────
app.get('/telegram/users', requireApiKey, (req, res) => {
  const users = Object.values(userRegistry)
  res.json({
    ok: true,
    total: users.length,
    subscribed: users.filter(u => u.subscribed).length,
    users: users.map(u => ({
      chatId: u.chatId,
      username: u.username,
      firstName: u.firstName,
      lastSeen: new Date(u.lastSeen).toISOString(),
      subscribed: u.subscribed,
    })),
  })
})

app.patch('/telegram/users/:chatId', requireApiKey, (req, res) => {
  const { chatId } = req.params
  const { subscribed } = req.body || {}
  if (userRegistry[chatId]) {
    userRegistry[chatId].subscribed = subscribed
    saveUserRegistry()
    return res.json({ ok: true, user: userRegistry[chatId] })
  }
  res.status(404).json({ ok: false, error: 'User not found' })
})

// ─── Admin Invite Routes ────────────────────────────────────────────────────

const invitesPath = path.resolve(__dirname, 'invites.json')
function readInvites() {
  try { return JSON.parse(fs.readFileSync(invitesPath, 'utf8')) } catch { return [] }
}
function writeInvites(data) {
  fs.writeFileSync(invitesPath, JSON.stringify(data, null, 2))
}
function ensureInvitesFile() {
  if (!fs.existsSync(invitesPath)) writeInvites([])
}

app.post('/admin/invite', requireApiKey, adminLimiter, async (req, res) => {
  const { email, name } = req.body || {}
  if (!email) return res.status(400).json({ ok: false, error: 'email required' })
  const invite = { email, name: name || email, status: 'PENDING', createdAt: Date.now() }
  try {
    const created = await invitesService.createInvite({ email: invite.email, name: invite.name })
    invite.id = created.id
    invite.docRef = created.docRef
    if (adminChats.length) forwardToAdmins(`New invite requested: ${email} (${invite.name}) [${invite.id}]`)
    res.json({ ok: true, invite })
  } catch {
    ensureInvitesFile()
    const existing = readInvites()
    const id = 'INV-' + Date.now()
    const localInvite = { id, email: invite.email, name: invite.name, status: invite.status, createdAt: invite.createdAt }
    existing.unshift(localInvite)
    writeInvites(existing)
    invite.id = id
    if (adminChats.length) forwardToAdmins(`New invite requested: ${email} (${invite.name}) [${id}]`)
    res.json({ ok: true, invite: localInvite })
  }
})

app.post('/admin/approve', requireApiKey, adminLimiter, async (req, res) => {
  const { id } = req.body || {}
  if (!id) return res.status(400).json({ ok: false, error: 'id required' })
  let invite
  if (adminDb2) {
    try {
      const found = await invitesService.findInviteById(id, adminDb2)
      if (!found) return res.status(404).json({ ok: false, error: 'not found' })
      invite = found
      await invitesService.approveInvite(id, adminDb2)
      if (adminChats.length) forwardToAdmins(`Invite approved: ${invite?.email} (${invite?.name}) [${id}]`)
      if (invite?.email) {
        try { await sendWelcomeEmail(invite.email, invite.name) } catch {}
      }
      return res.json({ ok: true, invite: { ...invite, status: 'APPROVED', approvedAt: Date.now() } })
    } catch (e) {
      console.error('Firestore approve failed', e)
      return res.status(500).json({ ok: false, error: 'db error' })
    }
  } else {
    ensureInvitesFile()
    const invites = readInvites()
    const idx = invites.findIndex(i => i.id === id)
    if (idx < 0) return res.status(404).json({ ok: false, error: 'not found' })
    invites[idx].status = 'APPROVED'
    invites[idx].approvedAt = Date.now()
    writeInvites(invites)
    invite = invites[idx]
  }
  const email = invite?.email
  const name = invite?.name
  if (adminChats.length) forwardToAdmins(`Invite approved: ${email} (${name}) [${id}]`)
  if (email) {
    try { await sendWelcomeEmail(email, name) } catch {}
  }
  res.json({ ok: true, invite: { ...invite, status: 'APPROVED', approvedAt: Date.now() } })
})

app.post('/admin/passwordreset', requireApiKey, adminLimiter, (req, res) => {
  const { email } = req.body || {}
  if (!email) return res.status(400).json({ ok: false, error: 'email required' })
  forwardToAdmins(`Password reset requested for ${email}`)
  res.json({ ok: true })
})

app.post('/admin/welcome', requireApiKey, adminLimiter, (req, res) => {
  const { email } = req.body || {}
  if (!email) return res.status(400).json({ ok: false, error: 'email required' })
  forwardToAdmins(`Welcome email triggered for ${email}`)
  res.json({ ok: true })
})

app.get('/admin/list_invites', requireApiKey, adminLimiter, async (req, res) => {
  if (adminDb2) {
    try {
      const snapshot = await adminDb2.collection('invites').orderBy('createdAt', 'desc').get()
      const list = snapshot.docs.map(doc => doc.data())
      return res.json(list)
    } catch (e) {
      console.error('Firestore list_invites failed', e)
    }
  }
  ensureInvitesFile()
  res.json(readInvites())
})

// ─── Diagnostic Routes ───────────────────────────────────────────────────────

app.get('/telegram/notify-test', requireApiKey, adminLimiter, async (req, res) => {
  try {
    const msg = 'TEST MESSAGE: Telegram bridge is reachable'
    await forwardToAdmins(msg)
    res.json({ ok: true, message: msg })
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
  } catch (e) {
    console.error("Firestore save support message error", e);
    return false;
  }
<<<<<<< HEAD
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
      await bot.sendMessage(adminChatId, "✅ Reply sent to user.").catch(() => {});
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

// ─── Frontend Alias Routes ─────────────────────────────────────────────────

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

// ─── Telegram Bot Routes ───────────────────────────────────────────────────

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

// ─── Register modular routes ────────────────────────────────────────────────

registerBroadcastRoutes(app);
registerUserRoutes(app);
registerInviteRoutes(app);

// ─── Bot Initialization ───────────────────────────────────────────────────

const BOT_MODE = process.env.TELEGRAM_BOT_MODE || "polling";

if (BOT_MODE === "webhook") {
  setupBotWebhook();
} else {
  setupBotPolling();
}

// ─── Start Server ─────────────────────────────────────────────────────────

loadUserRegistry(); // restore user registry on startup
app.listen(port, () => {
  console.log(`Telegram bridge listening on port ${port}`);
});
=======
})

// ─── Start Server ────────────────────────────────────────────────────────────
loadUserRegistry() // restore user registry on startup
app.listen(port, () => {
  console.log(`Telegram bridge listening on port ${port}`)
})
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
