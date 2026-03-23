require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const TelegramBot = require('node-telegram-bot-api')
const fs = require('fs')
const path = require('path')
const invitesService = require('./invitesService')

const app = express()
const port = process.env.TELEGRAM_BRIDGE_PORT || 5001
const rateLimit = require('express-rate-limit')
const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: 'Too many admin requests, please try again later.' })

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
