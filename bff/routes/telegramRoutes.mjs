/**
 * BFF Telegram Routes — Server-side Telegram Bot API proxy
 *
 * SECURITY RATIONALE:
 *   Telegram bot tokens must NEVER exist in browser bundles. All Telegram sends
 *   from the frontend MUST route through these handlers. The BFF holds the
 *   token in environment variables (BFF_TELEGRAM_BOT_TOKEN, BFF_TELEGRAM_CHAT_ID)
 *   which are injected at container startup, never shipped in client code.
 *
 * Flow:
 *   Frontend ──POST──> BFF /telegram/send-message ──POST──> api.telegram.org
 *
 * Required BFF environment variables (set via Infisical / k8s secrets):
 *   BFF_TELEGRAM_BOT_TOKEN  — Telegram bot API token (secret)
 *   BFF_TELEGRAM_CHAT_ID   — Default recipient chat ID (secret)
 *
 * J01 (Phase 11): Remove VITE_TELEGRAM_* tokens from all src/ files
 *
 * Architecture note: BFF uses raw req.url matching, not Express Router.
 * These exports are plain (req, res) → void handlers, called from _dispatch.mjs.
 */

import { authenticateRequest } from '../services/security.mjs';

// ── Token resolution ────────────────────────────────────────────────────────────
// Tokens live server-side only — never in client bundles.
// BFF_TELEGRAM_BOT_TOKEN / BFF_TELEGRAM_CHAT_ID are the canonical env names
// (BFF_ prefix avoids collision with any legacy VITE_-prefixed values).
const TELEGRAM_BOT_TOKEN =
  process.env.BFF_TELEGRAM_BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN ||     // legacy: backward compat during migration
  '';
const DEFAULT_CHAT_ID =
  process.env.BFF_TELEGRAM_CHAT_ID ||
  process.env.TELEGRAM_CHAT_ID ||       // legacy: backward compat during migration
  '';

// ── Core Telegram send (server-side only) ──────────────────────────────────────

/**
 * Send a message via the Telegram Bot API from the BFF server.
 * Token never leaves the server.
 *
 * @param {string} text       - Message body
 * @param {object} [opts]
 * @param {string} [opts.parse_mode]           - "HTML" | "Markdown" | undefined
 * @param {string} [opts.chat_id]              - Override recipient
 * @param {object} [opts.reply_markup]         - Telegram reply_markup
 * @param {boolean} [opts.disable_web_page_preview]
 * @returns {Promise<{ok: boolean, error?: string, message_id?: number}>}
 */
export async function sendTelegram(text, opts = {}) {
  const token = TELEGRAM_BOT_TOKEN;
  const chatId = opts.chat_id || DEFAULT_CHAT_ID;

  if (!token) return { ok: false, error: 'Telegram token not configured on BFF' };
  if (!chatId) return { ok: false, error: 'Telegram chat ID not configured on BFF' };

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: opts.parse_mode || 'HTML',
          disable_web_page_preview: opts.disable_web_page_preview ?? true,
          ...(opts.reply_markup ? { reply_markup: opts.reply_markup } : {}),
        }),
      },
    );
    const data = await response.json();
    if (data.ok) return { ok: true, message_id: data.result?.message_id };
    return { ok: false, error: data.description || 'Telegram API error' };
  } catch (err) {
    return { ok: false, error: "Telegram service temporarily unavailable." };
  }
}

// ── Route handlers (req, res) → void) ─────────────────────────────────────────

/**
 * POST /telegram/send-message
 *
 * Generic Telegram message send. Used by telegramService.js, telegramAlerts.js,
 * and supportChatService.js after J01 migration.
 *
 * Body: {
 *   text: string,
 *   parse_mode?: "HTML" | "Markdown",
 *   chat_id?: string,
 *   reply_markup?: object,
 *   disable_web_page_preview?: boolean,
 * }
 */
export async function handleTelegramSendMessage(req, res) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }

  try {
    const body = await readJson(req);
    const { text, parse_mode, chat_id, reply_markup, disable_web_page_preview } = body ?? {};

    if (!text || typeof text !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'text is required and must be a string' }));
      return;
    }
    if (text.length > 4000) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Message text exceeds 4000 character limit' }));
      return;
    }

    const result = await sendTelegram(text, {
      parse_mode,
      chat_id,
      reply_markup,
      disable_web_page_preview,
    });

    res.writeHead(result.ok ? 200 : 502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: "Telegram service temporarily unavailable." }));
  }
}

/**
 * POST /telegram/send-forensic-alert
 *
 * Sends a formatted security breach alert with embedded forensic context.
 * Frontend gathers browser/OS/screen data and POSTs here. Tokens never leave the browser.
 *
 * Body: {
 *   targetEmail: string,
 *   alertType?: string,   // Default: "BREACH"
 *   forensic: {
 *     ip: string, city: string, region: string, country: string,
 *     isp: string, browser: string, os: string,
 *     screenResolution: string, timestamp: string,
 *   }
 * }
 */
export async function handleTelegramSendForensicAlert(req, res) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }

  try {
    const body = await readJson(req);
    const { targetEmail, alertType = 'BREACH', forensic = {} } = body ?? {};

    if (!targetEmail || typeof targetEmail !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'targetEmail is required' }));
      return;
    }

    // Format the message server-side — no client-side HTML construction, prevents XSS
    const text = [
      `🚨 <b>INSTITUTIONAL ${escapeHtml(alertType)} ALERT</b>`,
      '',
      '👤 <b>TARGET IDENTITY</b>',
      `Email: <code>${escapeHtml(targetEmail)}</code>`,
      '',
      '🌐 <b>NETWORK PROFILE</b>',
      `IP: <code>${escapeHtml(forensic.ip || 'Unknown')}</code>`,
      `ISP: <code>${escapeHtml(forensic.isp || 'Unknown')}</code>`,
      '',
      '📍 <b>GEOGRAPHIC LOCATION</b>',
      `Location: <code>${escapeHtml(
        [forensic.city, forensic.region, forensic.country].filter(Boolean).join(', ') || 'Unknown',
      )}</code>`,
      '',
      '💻 <b>HARDWARE SIGNATURE</b>',
      `Device: <code>${escapeHtml(forensic.os || 'Unknown')}</code>`,
      `Browser: <code>${escapeHtml(forensic.browser || 'Unknown')}</code>`,
      `Display: <code>${escapeHtml(forensic.screenResolution || 'Unknown')}</code>`,
      '',
      '⏰ <b>TIMESTAMP</b>',
      `<code>${escapeHtml(forensic.timestamp || new Date().toISOString())}</code>`,
    ].join('\n');

    const result = await sendTelegram(text);
    res.writeHead(result.ok ? 200 : 502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: "Telegram service temporarily unavailable." }));
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────────

/** Minimal HTML escaper — prevents XSS in Telegram HTML parse_mode. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Read entire request body as JSON. */
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}
