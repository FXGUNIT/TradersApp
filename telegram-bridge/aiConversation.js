/**
 * AI Conversation Service for Telegram Bridge.
 *
 * This module owns the bot's conversational behavior: short-term memory,
 * intent routing, BFF/ML lookups, and the default AI chat fallback.
 */

import {
  callBFFAdminSessions,
  callBFFConsensus,
  callBFFRevokeSession,
  callBestAvailableAI,
} from "./aiProviders.js";
import { SYSTEM_PROMPT } from "./aiConversationTypes.js";
import { formatConsensusForTelegram, formatMLResponse } from "./aiFormatters.js";

export const sessionStore = new Map();
export const MAX_SESSION_MESSAGES = 24;

const HUMAN_ASSISTANT_PROMPT = `${SYSTEM_PROMPT}

Telegram behavior:
- Talk like a calm, practical human assistant, not like an alert template.
- Listen to the user's actual message and answer it directly.
- Keep replies concise unless the user asks for details.
- Remember recent context from this chat.
- Ask at most one clarifying question when you cannot act safely.
- Use simple language for beginner users.
- Do not repeat financial disclaimers on every casual message. Include risk warnings only when discussing trades, signals, position sizing, or market decisions.
- If the user asks you to fix or change this codebase, explain what you can do from Telegram and what needs the local coding agent.
- Never claim that a trade is guaranteed or risk-free.`;

const FALLBACK_HELP = [
  "I am listening now. You can talk normally, or use these shortcuts:",
  "",
  "/signal - current ML consensus",
  "/analysis - market analysis",
  "/regime - market regime",
  "/alpha - alpha and edge",
  "/rrr - risk/reward",
  "/position - position sizing",
  "/watchtower - Watchtower status",
  "/reset - clear this chat memory",
].join("\n");

export function addToSession(chatId, role, content) {
  if (!chatId || !content) return;
  const key = String(chatId);
  if (!sessionStore.has(key)) {
    sessionStore.set(key, []);
  }

  const session = sessionStore.get(key);
  session.push({ role, content: String(content), timestamp: Date.now() });

  while (session.length > MAX_SESSION_MESSAGES) {
    session.shift();
  }
}

export function getSessionMessages(chatId) {
  if (!chatId) return [];
  return sessionStore.get(String(chatId)) || [];
}

export function clearSession(chatId) {
  if (!chatId) return;
  sessionStore.delete(String(chatId));
}

export function detectIntent(text) {
  const lower = String(text || "").trim().toLowerCase();

  if (!lower) return { intent: "empty", params: {} };
  if (lower.startsWith("/reset") || lower.startsWith("/clear") || lower.includes("clear memory")) {
    return { intent: "reset", params: {} };
  }
  if (lower.startsWith("/start") || lower.startsWith("/help") || lower === "help") {
    return { intent: "help", params: {} };
  }
  if (
    lower.startsWith("/watchtower") ||
    lower.includes("watchtower status") ||
    lower.includes("is watchtower") ||
    lower.includes("watch tower")
  ) {
    return { intent: "watchtower_status", params: {} };
  }
  if (
    lower.includes("/sessions") ||
    lower.includes("/session list") ||
    lower.includes("active sessions")
  ) {
    return { intent: "admin_sessions", params: {} };
  }
  if (lower.match(/\/revoke\s+([a-f0-9-]{8,})/) || lower.includes("/logout device")) {
    const match = lower.match(/\/revoke\s+([a-f0-9-]{8,})/);
    return {
      intent: "admin_revoke",
      params: { sessionId: match ? match[1] : null },
    };
  }
  if (lower.includes("/admin status") || lower.includes("/status admin")) {
    return { intent: "admin_status", params: {} };
  }
  if (
    lower.includes("/signal") ||
    lower.includes("/predict") ||
    lower.includes("/analysis") ||
    lower.includes("current signal") ||
    lower.includes("market analysis")
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
    lower.includes("risk reward") ||
    lower.includes("risk/reward") ||
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
    lower.includes("position sizing") ||
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

  return { intent: "chat", params: {} };
}

export async function processConversation(text, context = {}) {
  const cleanText = String(text || "").trim();
  const chatId = context.chatId || context.userId || "unknown";
  const { intent, params } = detectIntent(cleanText);

  if (intent === "empty") {
    return "Send me a message and I will respond.";
  }

  if (intent === "reset") {
    clearSession(chatId);
    return "Done. I cleared this chat's memory.";
  }

  if (intent === "help") {
    return FALLBACK_HELP;
  }

  if (intent === "admin_sessions") {
    return handleAdminSessions(context);
  }

  if (intent === "admin_revoke") {
    return handleAdminRevoke(context, params.sessionId);
  }

  if (intent === "admin_status" || intent === "watchtower_status") {
    return handleWatchtowerStatus();
  }

  if (isTradingIntent(intent)) {
    return handleTradingIntent(intent, cleanText, context);
  }

  return handleGeneralChat(cleanText, context);
}

function isTradingIntent(intent) {
  return [
    "ml_analysis",
    "alpha",
    "regime",
    "rrr",
    "session",
    "exit_strategy",
    "position_sizing",
    "pbo",
  ].includes(intent);
}

async function handleGeneralChat(text, context) {
  const chatId = context.chatId || context.userId || "unknown";
  const history = getSessionMessages(chatId)
    .slice(-12)
    .map(({ role, content }) => ({ role, content }));

  const messages = [
    { role: "system", content: buildSystemPrompt(context) },
    ...history,
    { role: "user", content: text },
  ];

  addToSession(chatId, "user", text);

  try {
    const result = await callBestAvailableAI(messages);
    const reply = cleanAssistantReply(result.text);
    addToSession(chatId, "assistant", reply);
    return reply;
  } catch (error) {
    const reply = [
      "I can see your message, but the AI provider is not responding right now.",
      "",
      `Technical reason: ${shortError(error)}`,
      "",
      "Check the AI API key environment variables and restart the Telegram bridge.",
    ].join("\n");
    addToSession(chatId, "assistant", reply);
    return reply;
  }
}

async function handleTradingIntent(intent, text, context) {
  try {
    const consensus = await callBFFConsensus();
    if (!consensus.ok) {
      return handleGeneralChat(
        `${text}\n\nThe ML consensus endpoint was unavailable. Answer conversationally and explain what to check.`,
        context,
      );
    }

    if (intent === "ml_analysis" || intent === "pbo") {
      return formatConsensusForTelegram(consensus.data);
    }

    return formatMLResponse({ data: consensus.data }, intent);
  } catch (error) {
    return [
      "I could not reach the trading analysis service yet.",
      "",
      `Technical reason: ${shortError(error)}`,
      "",
      "The bot is still listening; the BFF/ML service needs to be running for market-specific answers.",
    ].join("\n");
  }
}

async function handleAdminSessions(context) {
  if (!context.isAdmin) {
    return "I can help with normal chat here, but session administration is only available in an admin chat.";
  }

  const result = await callBFFAdminSessions();
  if (!result.ok) {
    return `I could not fetch admin sessions: ${result.error || result.status || "unknown error"}`;
  }

  const sessions = result.data?.sessions || result.data || [];
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return "No active admin sessions were returned.";
  }

  return [
    `Active admin sessions: ${sessions.length}`,
    "",
    ...sessions.slice(0, 10).map((session, index) => {
      const id = session.id || session.sessionId || session.tokenId || "unknown";
      const label = session.email || session.user || session.ip || "unknown user";
      const lastSeen = session.lastSeen || session.updatedAt || session.createdAt || "unknown time";
      return `${index + 1}. ${label} - ${id} - last seen ${lastSeen}`;
    }),
  ].join("\n");
}

async function handleAdminRevoke(context, sessionId) {
  if (!context.isAdmin) {
    return "Session revocation is only available in an admin chat.";
  }
  if (!sessionId) {
    return "Send `/revoke <session-id>` with the session id you want to revoke.";
  }

  const result = await callBFFRevokeSession(sessionId);
  if (!result.ok) {
    return `I could not revoke that session: ${result.error || result.status || "unknown error"}`;
  }
  return `Done. I revoked session ${sessionId}.`;
}

async function handleWatchtowerStatus() {
  const bffUrl = process.env.BFF_URL || process.env.VITE_BFF_URL || "http://127.0.0.1:8788";

  try {
    const response = await fetch(`${bffUrl}/watchtower/status`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return `I reached the BFF, but Watchtower status returned HTTP ${response.status}.`;
    }

    const data = await response.json();
    const watchtower = data.watchtower || data;
    const daemon = watchtower.daemon || {};
    const faults = watchtower.faults || watchtower.activeFaults || [];
    const faultCount = Array.isArray(faults) ? faults.length : Number(watchtower.activeFaultCount || 0);

    return [
      "Watchtower status:",
      "",
      `Running: ${daemon.running ?? watchtower.running ?? "unknown"}`,
      `Active faults: ${faultCount}`,
      watchtower.lastScanAt ? `Last scan: ${watchtower.lastScanAt}` : "",
      watchtower.nextScanAt ? `Next scan: ${watchtower.nextScanAt}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch (error) {
    return [
      "I could not reach Watchtower status from the Telegram bridge.",
      "",
      `Technical reason: ${shortError(error)}`,
      "",
      "Make sure the BFF is running and BFF_URL points to it.",
    ].join("\n");
  }
}

function buildSystemPrompt(context) {
  const name = context.firstName || context.username || "the user";
  const now = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  return [
    HUMAN_ASSISTANT_PROMPT,
    "",
    "Current chat context:",
    `- User: ${name}`,
    `- Telegram user id: ${context.userId || "unknown"}`,
    `- Admin chat: ${context.isAdmin ? "yes" : "no"}`,
    `- Current time: ${now} IST`,
  ].join("\n");
}

function cleanAssistantReply(value) {
  const text = String(value || "").trim();
  if (!text) return "I am here, but the model returned an empty reply. Try sending that again.";
  return text;
}

function shortError(error) {
  return String(error?.message || error || "unknown error")
    .replace(/\s+/g, " ")
    .slice(0, 500);
}

export default {
  addToSession,
  clearSession,
  detectIntent,
  getSessionMessages,
  processConversation,
  sessionStore,
};
