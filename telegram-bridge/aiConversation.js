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
import {
  callMLEngine,
  callBFFConsensus,
  callBFFAdminSessions,
  callBFFRevokeSession,
  callBestAvailableAI,
} from "./aiProviders.js";
import {
  callMLEngine,
  callBFFConsensus,
  callBFFAdminSessions,
  callBFFRevokeSession,
  callBestAvailableAI,
} from "./aiProviders.js";
import { AI_PROVIDERS, SYSTEM_PROMPT } from "./aiConversationTypes.js";
import { formatConsensusForTelegram, formatMLResponse } from "./aiFormatters.js";

import { AI_PROVIDERS, SYSTEM_PROMPT } from "./aiConversationTypes.js";
import { formatConsensusForTelegram, formatMLResponse } from "./aiFormatters.js";

 * Module breakdown:
 *   aiConversationTypes.js — AI_PROVIDERS config, SYSTEM_PROMPT, type defs
 *   aiConversation.js     — conversation memory, ML/BFF calls, main orchestrator
 *   aiFormatters.js       — formatConsensusForTelegram, formatMLResponse

 * Module breakdown:
 *   aiConversationTypes.js -- AI_PROVIDERS config, SYSTEM_PROMPT, type defs
 *   aiProviders.js        -- ML/BFF HTTP wrappers, AI provider calls
 *   aiConversation.js     -- conversation memory, intent detection, orchestrator
 *   aiFormatters.js       -- formatConsensusForTelegram, formatMLResponse
 */

import {
  callMLEngine,
  callBFFConsensus,
  callBFFAdminSessions,
  callBFFRevokeSession,
  callBestAvailableAI,
} from "./aiProviders.js";
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
