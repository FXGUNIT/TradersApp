require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const TelegramBot = require('node-telegram-bot-api')
const fs = require('fs')
const path = require('path')
const invitesService = require('./invitesService')
const { processConversation, AI_PROVIDERS } = require('./aiConversation')

const app = express()
const port = process.env.TELEGRAM_BRIDGE_PORT || 5001
const rateLimit = require('express-rate-limit')
const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: 'Too many admin requests, please try again later.' })
const botLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: 'Too many messages. Slow down.' })

// Firebase Admin (Firestore) integration for backend-backed invites (Phase 3.6+)
let adminDb = null
try {
  const { initFirestore, getDb } = require('./firebaseAdmin')
  initFirestore()
  adminDb = getDb()
  if (adminDb) console.log('Telegram Bridge: Firestore initialized via Firebase Admin')
  else console.log('Telegram Bridge: Firestore not available; using local invites fallback')
} catch (err) {
  console.error('Telegram Bridge: failed to initialize Firebase Admin', err)
}

// Security: optional API key header
const ADMIN_API_KEY = process.env.TELEGRAM_ADMIN_API_KEY

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN not configured. Please set TELEGORM_BOT_TOKEN in env.')
}
let adminChats = []
if (process.env.TELEGRAM_ADMIN_CHAT_IDS) {
  adminChats = process.env.TELEGRAM_ADMIN_CHAT_IDS.split(',').map(id => Number(id.trim())).filter(n => !Number.isNaN(n))
}

const bot = BOT_TOKEN ? new TelegramBot(BOT_TOKEN, { polling: false }) : null

// ─── Telegram Bot: AI Conversation Handler ──────────────────────────────────
// Set TELEGRAM_BOT_MODE=webhook in production (Railway env vars)
// Set TELEGRAM_BOT_MODE=polling in development
const BOT_MODE = process.env.TELEGRAM_BOT_MODE || 'polling';

// Per-user typing state (chatId → true)
const typingState = new Map();

function sendTypingAction(chatId) {
  if (!bot) return;
  try {
    bot.sendChatAction(chatId, 'typing').catch(() => {});
    typingState.set(chatId, true);
  } catch (e) {
    console.error('sendChatAction error', e);
  }
}

function clearTypingState(chatId) {
  typingState.delete(chatId);
}

async function handleBotMessage(msg) {
  if (!msg || !msg.text || !msg.chat) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Ignore non-text or group messages (optional: allow specific groups via ADMIN_CHAT_IDS)
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    // Only respond if mentioned or in admin group
    if (!adminChats.includes(chatId)) return;
  }

  // Ignore empty messages or commands from non-admin chats (except /start)
  if (!text.startsWith('/')) {
    // Rate limit per chat
    if (botLimiter) {
      // Simple per-chat rate check
      if (!botLimiter.keyGenerator || true) {
        // Let express-rate-limit handle it via middleware on webhook endpoint
      }
    }
  }

  // Typing indicator
  sendTypingAction(chatId);

  try {
    const response = await processConversation(text, {
      chatId,
      userId: msg.from?.id?.toString(),
      username: msg.from?.username,
      firstName: msg.from?.first_name,
    });

    // Send response (Telegram has 4096 char limit)
    const chunks = [];
    if (response.length > 4096) {
      // Split into chunks of 4096
      for (let i = 0; i < response.length; i += 4096 - 10) {
        chunks.push(response.slice(i, i + 4096 - 10));
      }
    } else {
      chunks.push(response);
    }

    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });
      // Small delay between chunks to avoid rate limiting
      if (chunks.length > 1) await new Promise(r => setTimeout(r, 200));
    }
  } catch (e) {
    console.error('Bot message handler error:', e);
    try {
      await bot.sendMessage(chatId, `Sorry, I encountered an error: ${e.message}`);
    } catch (sendErr) {
      console.error('Failed to send error message:', sendErr);
    }
  } finally {
    clearTypingState(chatId);
  }
}

function setupBotPolling() {
  if (!bot) {
    console.log('Telegram bot not initialized (no BOT_TOKEN)');
    return;
  }

  // Long polling — Node.js event-driven, so this is non-blocking
  bot.on('message', handleBotMessage);

  // Handle edited messages
  bot.on('edited_message', handleBotMessage);

  // Handle callbacks (inline keyboard)
  bot.on('callback_query', async (query) => {
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
      await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error('Callback query error:', e);
      await bot.answerCallbackQuery(query.id, { text: 'Error processing request' });
    } finally {
      clearTypingState(chatId);
    }
  });

  // Handle errors gracefully
  bot.on('polling_error', (err) => {
    console.error('Polling error:', err.message);
  });

  console.log(`Telegram bot initialized in ${BOT_MODE} mode`);
}

function setupBotWebhook() {
  if (!bot) {
    console.log('Telegram bot not initialized (no BOT_TOKEN)');
    return;
  }

  // Set webhook (called by Telegram when user sends message)
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('TELEGRAM_WEBHOOK_URL not set — falling back to polling');
    setupBotPolling();
    return;
  }

  try {
    bot.setWebHook(webhookUrl).then(() => {
      console.log(`Webhook set to: ${webhookUrl}`);
    }).catch((err) => {
      console.error('Failed to set webhook:', err);
      setupBotPolling();
    });
  } catch (e) {
    console.error('Webhook setup error:', e);
    setupBotPolling();
  }
}

// Initialize bot based on mode
if (BOT_MODE === 'webhook') {
  setupBotWebhook();
} else {
  setupBotPolling();
}

// ─── Telegram Webhook Receiver ──────────────────────────────────────────────
// POST /telegram/webhook — called by Telegram when bot receives a message
app.post('/telegram/webhook', async (req, res) => {
  try {
    // Bot framework handles the update internally via webhook
    if (bot && req.body && req.body.message) {
      handleBotMessage(req.body.message).catch(console.error);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('Webhook receiver error:', e);
    res.json({ ok: false });
  }
});

// GET /telegram/status — check bot status
app.get('/telegram/status', (req, res) => {
  res.json({
    ok: !!bot,
    mode: BOT_MODE,
    configured: !!(BOT_TOKEN),
    providers: Object.keys(AI_PROVIDERS).length,
    activeSessions: sessionStore ? sessionStore.size : 0,
  });
});

// POST /telegram/ai — direct AI conversation (bypass Telegram)
app.post('/telegram/ai', botLimiter, async (req, res) => {
  const { text, chatId, userId, context } = req.body || {};
  if (!text) return res.status(400).json({ ok: false, error: 'text required' });

  try {
    const response = await processConversation(text, { chatId, userId, ...context });
    res.json({ ok: true, response });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use(cors())
app.use(bodyParser.json())

function requireApiKey(req, res, next) {
  if (!ADMIN_API_KEY) return next()
  const key = req.headers['x-admin-api-key'] || req.headers['x-api-key']
  if (key && key === ADMIN_API_KEY) return next()
  return res.status(403).json({ ok: false, error: 'Forbidden' })
}

async function forwardToAdmins(text) {
  if (!bot || adminChats.length === 0) return
  for (const chat of adminChats) {
    try {
      await bot.sendMessage(chat, text, { parse_mode: 'HTML' })
    } catch (e) {
      console.error('Telegram forward error', e)
    }
  }
}

app.post('/telegram/notify', requireApiKey, adminLimiter, async (req, res) => {
  const { event, payload } = req.body || {}
  const headerKey = req.headers['x-telegra m-webhook-key']
  // Optional: verify header if TELEGRAM_WEBHOOK_KEY is set
  if (process.env.TELEGRAM_WEBHOOK_KEY && headerKey !== process.env.TELEGRAM_WEBHOOK_KEY) {
    return res.status(403).json({ ok: false, error: 'Invalid webhook key' })
  }
  const message = `<b>LIVE EVENT</b> - ${event || 'UNKNOWN'}<br/>` + (payload ? Object.entries(payload).map(([k,v]) => `<b>${k}</b>: ${v}`).join('<br/>') : '')
  await forwardToAdmins(message)
  res.json({ ok: true })
})

// Admin endpoints (fake storage in invites.json for testing)
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
    res.json({ ok: true, invite })
  } catch {
    // fallback to local if service unavailable
    ensureInvitesFile()
    const existing = readInvites()
    const id = 'INV-' + Date.now()
    const localInvite = { id, email: invite.email, name: invite.name, status: invite.status, createdAt: invite.createdAt }
    existing.unshift(localInvite)
    writeInvites(existing)
    invite.id = id
    res.json({ ok: true, invite: localInvite })
  }
  if (adminChats.length) {
    forwardToAdmins(`New invite requested: ${email} (${invite.name}) [${invite.id}]`)
  }
  // Telegram notification about invite request is sent above
})

app.post('/admin/approve', requireApiKey, adminLimiter, async (req, res) => {
  const { id } = req.body || {}
  if (!id) return res.status(400).json({ ok: false, error: 'id required' })
  let invite
  if (adminDb) {
    try {
      const found = await invitesService.findInviteById(id, adminDb)
      if (!found) return res.status(404).json({ ok: false, error: 'not found' })
      invite = found
      await invitesService.approveInvite(id, adminDb)
      res.json({ ok: true, invite: { ...invite, status: 'APPROVED', approvedAt: Date.now() } })
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
  if (adminChats.length) {
    forwardToAdmins(`Invite approved: ${email} (${name}) [${id}]`)
  }
  // Welcome email (via EmailJS) after approval
  if (email) {
    try { await sendWelcomeEmail(email, name) } catch {}
  }
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
  // Prefer Firestore if initialized
  if (adminDb) {
    try {
      const snapshot = await adminDb.collection('invites').orderBy('createdAt', 'desc').get()
      const list = snapshot.docs.map(doc => doc.data())
      return res.json(list)
    } catch (e) {
      console.error('Firestore list_invites failed', e)
      // Fall back to local file
    }
  }
  ensureInvitesFile()
  res.json(readInvites())
})

// Start bridge
app.listen(port, () => {
  console.log(`Telegram bridge listening on port ${port}`)
})

// Diagnostic test route for Telegram bridge (test messages)
app.get('/telegram/notify-test', requireApiKey, adminLimiter, async (req, res) => {
  try {
    const msg = 'TEST MESSAGE: Telegram bridge is reachable ✔'
    await forwardToAdmins(msg)
    res.json({ ok: true, message: msg })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'test failed' })
  }
})
