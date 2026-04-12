/**
 * AI Conversation Service for Telegram Bridge
 * Handles AI-powered trading conversation via multiple providers.
 * Integrates with ML Engine for technical analysis.
 *
 * Architecture:
 *   Telegram User → Bot Webhook → index.js → botCommands.js
 *   index.js → aiConversation.js → [Gemini|Groq|OpenRouter|Cerebras|DeepSeek|SambaNova]
 *   aiConversation.js → ML Engine (for technical questions)
 *   Response → Telegram User
 *
 * Module breakdown:
 *   aiConversationTypes.js — AI_PROVIDERS config, SYSTEM_PROMPT, type defs
 *   aiConversation.js     — conversation memory, ML/BFF calls, main orchestrator
 *   aiFormatters.js       — formatConsensusForTelegram, formatMLResponse
 */

import https from "node:https";
import http from "node:http";

import { AI_PROVIDERS, SYSTEM_PROMPT } from "./aiConversationTypes.js";
import { formatConsensusForTelegram, formatMLResponse } from "./aiFormatters.js";

// ─── Conversation Memory ───────────────────────────────────────────────────────

/**
 * In-memory session store: chatId → [{role, content, timestamp}]
 * Max 20 messages per session to limit memory.
 * Exported so botCommands.js can seed initial state if needed.
 */
export const sessionStore = new Map();
export const MAX_SESSION_MESSAGES = 20;

/**
 * @param {string} chatId
 * @param {"user"|"assistant"|"system"} role
 * @param {string} content
 */
export function addToSession(chatId, role, content) {
  if (!sessionStore.has(chatId)) {
    sessionStore.set(chatId, []);
  }
  const session = sessionStore.get(chatId);
  session.push({ role, content, timestamp: Date.now() });
  while (session.length > MAX_SESSION_MESSAGES) {
    session.shift();
  }
}

export function getSessionMessages(chatId) {
  return sessionStore.get(chatId) || [];
}

export function clearSession(chatId) {
  sessionStore.delete(chatId);
}

// ─── Intent Detection ─────────────────────────────────────────────────────────

/**
 * Detect what type of request the user is making.
 * @param {string} text
 * @returns {{ intent: string, params: object }}
 */
export function detectIntent(text) {
  const lower = text.toLowerCase();

  if (lower.includes("/reset") || lower.includes("/clear")) {
    return { intent: "reset", params: {} };
  }
  if (lower.includes("/help") || lower.includes("/start")) {
    return { intent: "help", params: {} };
  }
  if (
    lower.includes("/signal") ||
    lower.includes("/predict") ||
    lower.includes("/analysis")
  ) {
    return { intent: "ml_analysis", params: {} };
  }
  if (lower.includes("/alpha") || lower.includes("/edge")) {
    return { intent: "alpha", params: {} };
  }
  if (
    lower.includes("/regime") ||
    lower.includes("market regime") ||
    lower.includes("regime detection")
  ) {
    return { intent: "regime", params: {} };
  }
  if (
    lower.includes("/rrr") ||
    lower.includes("/risk reward") ||
    lower.includes("optimal r:r")
  ) {
    return { intent: "rrr", params: {} };
  }
  if (
    lower.includes("/session") ||
    lower.includes("pre-market") ||
    lower.includes("main trading")
  ) {
    return { intent: "session", params: {} };
  }
  if (
    lower.includes("/exit") ||
    lower.includes("stop loss") ||
    lower.includes("take profit")
  ) {
    return { intent: "exit_strategy", params: {} };
  }
  if (
    lower.includes("/position") ||
    lower.includes("position size") ||
    lower.includes("kelly")
  ) {
    return { intent: "position_sizing", params: {} };
  }
  if (
    lower.includes("/pbo") ||
    lower.includes("backtest") ||
    lower.includes("backtesting")
  ) {
    return { intent: "pbo", params: {} };
  }
  if (
    lower.includes("/sessions") ||
    lower.includes("/session list") ||
    lower.includes("active sessions")
  ) {
    return { intent: "admin_sessions", params: {} };
  }
  if (
    lower.match(/\/revoke\s+([a-f0-9]{8,})/) ||
    lower.includes("/logout device")
  ) {
    const match = lower.match(/\/revoke\s+([a-f0-9]{8,})/);
    return {
      intent: "admin_revoke",
      params: { sessionId: match ? match[1] : null },
    };
  }
  if (lower.includes("/admin status") || lower.includes("/status admin")) {
    return { intent: "admin_status", params: {} };
  }
  if (
    lower.match(
      /^(what|how|why|when|should i|is it|can i|tell me|explain|define|describe)/i,
    )
  ) {
    return { intent: "education", params: {} };
  }

  return { intent: "general", params: {} };
}

// ─── ML Engine Integration ────────────────────────────────────────────────────

/**
 * Call the ML Engine for technical analysis.
 * @param {string} endpoint
 * @param {object} body
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function callMLEngine(endpoint, body) {
  const mlEngineUrl = process.env.ML_ENGINE_URL || "http://localhost:8001";
  const apiKey = process.env.ML_ENGINE_API_KEY || "dev-key";

  return new Promise((resolve) => {
    const url = new URL(`${mlEngineUrl}${endpoint}`);
    const data = JSON.stringify(body);

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(data),
      },
      timeout: 15000,
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({
            ok: res.statusCode === 200,
            data: JSON.parse(body),
            status: res.statusCode,
          });
        } catch {
          resolve({
            ok: false,
            data: null,
            status: res.statusCode,
            error: "Parse error",
          });
        }
      });
    });

    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "Timeout" });
    });
    req.write(data);
    req.end();
  });
}

/**
 * Call the BFF for ML consensus — the full aggregated signal.
 */
async function callBFFConsensus() {
  const bffUrl =
    process.env.BFF_URL || process.env.VITE_BFF_URL || "http://127.0.0.1:8788";
  const serviceKey =
    process.env.SUPPORT_SERVICE_KEY || process.env.TELEGRAM_ADMIN_API_KEY || "";

  return new Promise((resolve) => {
    const url = new URL(`${bffUrl}/ml/consensus`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(serviceKey ? { "X-Support-Key": serviceKey } : {}),
      },
      timeout: 20000,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            ok: res.statusCode === 200,
            data: JSON.parse(data),
            status: res.statusCode,
          });
        } catch {
          resolve({
            ok: false,
            data: null,
            status: res.statusCode,
            error: "Parse error",
          });
        }
      });
    });

    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "Timeout" });
    });
    req.end();
  });
}

/**
 * Call BFF admin sessions endpoint.
 */
async function callBFFAdminSessions() {
  const bffUrl = process.env.BFF_URL || "http://127.0.0.1:8788";
  const serviceKey =
    process.env.SUPPORT_SERVICE_KEY || process.env.TELEGRAM_ADMIN_API_KEY || "";

  return new Promise((resolve) => {
    const url = new URL(`${bffUrl}/admin/sessions`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Support-Key": serviceKey,
      },
      timeout: 10000,
    };
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({
            ok: res.statusCode < 400,
            status: res.statusCode,
            data: JSON.parse(body),
          });
        } catch {
          resolve({ ok: false, status: res.statusCode, error: "Parse error" });
        }
      });
    });
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "Timeout" });
    });
    req.end();
  });
}

/**
 * Revoke a specific admin session by token.
 */
async function callBFFRevokeSession(sessionId) {
  const bffUrl = process.env.BFF_URL || "http://127.0.0.1:8788";
  const serviceKey =
    process.env.SUPPORT_SERVICE_KEY || process.env.TELEGRAM_ADMIN_API_KEY || "";

  return new Promise((resolve) => {
    const url = new URL(`${bffUrl}/admin/sessions`);
    const body = JSON.stringify({ id: sessionId });
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-Support-Key": serviceKey,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 10000,
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            ok: res.statusCode < 400,
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch {
          resolve({ ok: false, status: res.statusCode, error: "Parse error" });
        }
      });
    });
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "Timeout" });
    });
    req.write(body);
    req.end();
  });
}

// ─── AI Provider Calls ────────────────────────────────────────────────────────

/**
 * Make an HTTP POST request (works for both http and https).
 */
function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            ok: res.statusCode < 400,
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch {
          resolve({
            ok: false,
            status: res.statusCode,
            data: null,
            error: "Parse error",
            raw: data,
          });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

/**
 * Call Gemini API (Google AI Studio).
 */
async function callGemini(model, messages, apiKey) {
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const systemInstruction = messages.find((m) => m.role === "system");
  const body = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
      topP: 0.9,
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
  }

  const url = `${AI_PROVIDERS.gemini.baseUrl}/${model}:generateContent?key=${apiKey}`;
  const result = await httpRequest(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    body,
  );

  if (!result.ok) {
    throw new Error(
      `Gemini API error ${result.status}: ${JSON.stringify(result.data)}`,
    );
  }

  const text = result.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

/**
 * Call OpenAI-compatible API (Groq, OpenRouter, Cerebras, DeepSeek, SambaNova).
 */
async function callOpenAICompatible(provider, model, messages, apiKey) {
  const config = AI_PROVIDERS[provider];

  const body = {
    model: model || config.defaultModel,
    messages: messages.filter((m) => m.role !== "system"),
    temperature: 0.7,
    max_tokens: 2048,
  };

  const systemMsg = messages.find((m) => m.role === "system");
  if (systemMsg) {
    body.messages.unshift({ role: "system", content: systemMsg.content });
  }

  const result = await httpRequest(
    `${config.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(provider === "openrouter" || provider === "openrouter2"
          ? { "HTTP-Referer": "https://traders.app", "X-Title": "TradersApp" }
          : {}),
      },
    },
    body,
  );

  if (!result.ok) {
    throw new Error(
      `${config.name} API error ${result.status}: ${JSON.stringify(result.data)}`,
    );
  }

  return result.data?.choices?.[0]?.message?.content;
}

/**
 * Try providers in order of preference until one succeeds.
 * @returns {Promise<{text: string, provider: string, model: string}>}
 */
async function callBestAvailableAI(
  messages,
  preferredOrder = ["gemini", "groq", "deepseek", "sambanova"],
) {
  const errors = [];

  for (const provider of preferredOrder) {
    const config = AI_PROVIDERS[provider];
    if (!config) continue;

    const apiKey = process.env[config.apiKeyEnv];
    if (!apiKey) {
      errors.push(`${config.name}: no API key (${config.apiKeyEnv})`);
      continue;
    }

    try {
      let text;
      if (provider === "gemini") {
        text = await callGemini(config.defaultModel, messages, apiKey);
      } else {
        text = await callOpenAICompatible(provider, null, messages, apiKey);
      }
      return { text, provider: config.name, model: config.defaultModel };
    } catch (e) {
      errors.push(`${config.name}: ${e.message}`);
      console.error(`AI provider ${provider} failed:`, e.message);
    }
  }

  throw new Error(`All AI providers failed:\n${errors.join("\n")}`);
}

// ─── Main Conversation Handler ────────────────────────────────────────────────

/**
 * Main entry point: process a Telegram message and return the response text.
 *
 * @param {string} text - User's message
 * @param {object} context - Additional context (userId, chatId, etc.)
 * @returns {Promise<string>} Response text
 */
export async function processConversation(text, context = {}) {
  const { chatId, userId } = context;

  const { intent } = detectIntent(text);

  // Handle special commands
  if (intent === "reset") {
    if (chatId) clearSession(chatId);
    return "Conversation history cleared. How can I help you?";
  }

  if (intent === "help") {
    return `*TradersApp AI Bot — Commands*

/start — Welcome message
/reset — Clear conversation history
/signal — Get ML signal analysis
/regime — Get physics regime analysis
/alpha — Get alpha score analysis
/rrr — Get optimal R:R analysis
/session — Get session probabilities
/exit — Get exit strategy
/position — Get position sizing advice
/pbo — Learn about backtest overfitting

*Admin Commands* (owner only):
/sessions — View active admin sessions
/revoke [id] — Logout a specific session
/admin status — System status overview

Or just ask any trading question in natural language!`;
  }

  // ── Admin-only commands ──────────────────────────────────────────────────
  if (
    intent === "admin_sessions" ||
    intent === "admin_revoke" ||
    intent === "admin_status"
  ) {
    if (!context.isAdmin) {
      return "Access denied. Admin commands are reserved for the owner.";
    }
    if (intent === "admin_sessions") {
      const result = await callBFFAdminSessions();
      if (!result.ok || !result.data?.sessions) {
        return "Could not fetch sessions. Is the admin server running?";
      }
      const sessions = result.data.sessions || [];
      if (sessions.length === 0) {
        return "No active admin sessions found.";
      }
      const lines = ["*Active Admin Sessions:*\n"];
      sessions.forEach((s, i) => {
        const created = new Date(s.createdAt).toLocaleString();
        const expires = new Date(s.expiresAt).toLocaleString();
        const rem = s.device?.rememberDevice ? " (remembered)" : "";
        const browser = s.device?.browser || "Unknown";
        const os = s.device?.os || "Unknown";
        lines.push(`${i + 1}. \`${s.id}...\` ${rem}`);
        lines.push(`   ${browser} on ${os}`);
        lines.push(`   Created: ${created}`);
        lines.push(`   Expires: ${expires}\n`);
      });
      lines.push("\n_Revoke with:_ /revoke [id]");
      return lines.join("\n");
    }
    if (intent === "admin_revoke") {
      const sessionId = context.params?.sessionId;
      if (!sessionId) {
        return "Usage: /revoke [session-id]\n\nFirst use /sessions to see active sessions.";
      }
      const listResult = await callBFFAdminSessions();
      if (!listResult.ok) {
        return "Could not fetch sessions to revoke.";
      }
      const sessions = listResult.data?.sessions || [];
      const target = sessions.find((s) => s.id === sessionId);
      if (!target) {
        return `Session \`${sessionId}...\` not found. Use /sessions to see active sessions.`;
      }
      const revokeResult = await callBFFRevokeSession(sessionId);
      if (revokeResult.ok) {
        return `Session \`${sessionId}...\` revoked. Device logged out.`;
      }
      return `Failed to revoke: ${revokeResult.data?.error || revokeResult.error || "Unknown error"}`;
    }
    if (intent === "admin_status") {
      const sessionsResult = await callBFFAdminSessions();
      const sessions = sessionsResult.data?.sessions || [];
      const bffHealth = await new Promise((resolve) => {
        const url = new URL("http://127.0.0.1:8788/health");
        http
          .get(url, (res) => {
            let d = "";
            res.on("data", (c) => (d += c));
            res.on("end", () => {
              try { resolve(JSON.parse(d)); }
              catch { resolve(null); }
            });
          })
          .on("error", () => resolve(null));
      });
      const mlHealth = await new Promise((resolve) => {
        const url = new URL("http://localhost:8001/health");
        http
          .get(url, (res) => {
            let d = "";
            res.on("data", (c) => (d += c));
            res.on("end", () => {
              try { resolve(JSON.parse(d)); }
              catch { resolve(null); }
            });
          })
          .on("error", () => resolve(null));
      });
      const status = [];
      status.push("*Admin Status*\n");
      status.push("*BFF:* " + (bffHealth?.ok !== false ? "✅ Online" : "❌ Offline"));
      status.push("*ML Engine:* " + (mlHealth?.ok !== false ? "✅ Online" : "❌ Offline"));
      status.push("*Active Sessions:* " + sessions.length);
      sessions.forEach((s) => {
        const rem = s.device?.rememberDevice ? " [remembered]" : "";
        status.push(
          "• " + s.id + "... " +
          (s.device?.browser || "?") + " on " +
          (s.device?.os || "?") + rem,
        );
      });
      status.push("\n*Sessions managed via:* /sessions | /revoke [id]");
      return status.join("\n");
    }
  }

  // Add user message to session
  if (chatId) {
    addToSession(chatId, "user", text);
  }

  const messages = (chatId ? getSessionMessages(chatId) : []).concat([
    { role: "user", content: text },
  ]);

  // ── ML-specific intents ────────────────────────────────────────────────
  if (
    [
      "ml_analysis",
      "alpha",
      "regime",
      "rrr",
      "session",
      "exit_strategy",
      "position_sizing",
      "pbo",
    ].includes(intent)
  ) {
    try {
      if (intent === "ml_analysis") {
        const consensusResult = await callBFFConsensus();
        if (consensusResult.ok && consensusResult.data) {
          const formatted = formatConsensusForTelegram(consensusResult.data);
          const aiMessages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...(chatId ? getSessionMessages(chatId) : []),
            {
              role: "user",
              content: `The ML system returned this analysis:\n${formatted}\n\nPlease give a brief trading insight or warning based on this data. Keep it under 3 sentences.`,
            },
          ];
          const aiResult = await callBestAvailableAI(aiMessages);
          if (chatId) addToSession(chatId, "assistant", aiResult.text);
          return `${formatted}\n\n*AI Insight:* ${aiResult.text}\n\n*Model used:* ${aiResult.model} via ${aiResult.provider}`;
        } else {
          const mlResult = await callMLEngine("/predict", {});
          if (mlResult.ok && mlResult.data) {
            const mlText = formatMLResponse(mlResult, "ml_analysis");
            if (chatId) addToSession(chatId, "assistant", mlText);
            return `${mlText}\n\n*Note: BFF unavailable, using direct ML Engine.*`;
          }
          throw new Error("Both BFF and ML Engine are unavailable");
        }
      }

      let endpoint = "/predict";
      if (intent === "regime") {
        endpoint = "/regime";
      } else if (intent === "pbo") {
        messages.unshift({ role: "system", content: SYSTEM_PROMPT });
        const result = await callBestAvailableAI(messages);
        if (chatId) addToSession(chatId, "assistant", result.text);
        return `${result.text}\n\n*Model used:* ${result.model} via ${result.provider}`;
      }

      const mlResult = await callMLEngine(endpoint, {});

      if (mlResult.ok && mlResult.data) {
        const mlText = formatMLResponse(mlResult, intent);

        const aiMessages = [
          { role: "system", content: SYSTEM_PROMPT },
          ...(chatId ? getSessionMessages(chatId) : []),
          {
            role: "user",
            content: `The ML system returned this analysis:\n${mlText}\n\nPlease explain what this means in simple terms for a trader.`,
          },
        ];

        const aiResult = await callBestAvailableAI(aiMessages);
        if (chatId) addToSession(chatId, "assistant", aiResult.text);
        return `${aiResult.text}\n\n*Model used:* ${aiResult.model} via ${aiResult.provider}`;
      }
    } catch (e) {
      console.error("ML integration error:", e.message);
      // Fall through to general AI response
    }
  }

  // ── General conversation ───────────────────────────────────────────────
  messages.unshift({ role: "system", content: SYSTEM_PROMPT });

  try {
    const result = await callBestAvailableAI(messages);
    if (chatId) addToSession(chatId, "assistant", result.text);
    return `${result.text}\n\n*Model used:* ${result.model} via ${result.provider}`;
  } catch (e) {
    console.error("All AI providers failed:", e.message);
    return `I'm having trouble connecting to my AI services right now. Please try again in a moment.\n\nIf this persists, try:\n• /reset to clear the conversation\n• /help for available commands\n\nError: ${e.message}`;
  }
}

// ─── Re-export formatters so callers can import from one place ────────────────
export { formatConsensusForTelegram, formatMLResponse };
