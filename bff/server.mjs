/**
 * TradersApp BFF — HTTP Server Orchestration
 * Port 8788 — Express-style HTTP routing without Express
 * Split from monolithic server.mjs (Rule #3 hard limit: JS ≤500 lines)
 *
 * Architecture:
 *   server.mjs      — imports, constants, env loading, server startup
 *   _dispatch.mjs   — HTTP request dispatcher (rate limiting → routes → 404)
 *   routes/*.mjs    — domain route handlers (already split)
 *   services/*.mjs — security, redis, AI, metrics (already split)
 *   domains/*.mjs   — domain state (already split)
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { getMetrics, getContentType, recordHttpRequest } from "./metrics.mjs";
import {
  addSecurityHeaders,
  ROLES,
  authorizeRequest,
  createAdminSession,
  validateAdminToken,
  revokeAdminSession,
  listAdminSessions,
  revokeSessionById,
  getRateLimitConfig,
} from "./services/security.mjs";
import { checkRateLimit } from "./services/redis-session-store.mjs";
import {
  getDocumentMeta,
  getHubContent,
  listDocumentMeta,
} from "./domains/contentState.mjs";
import {
  getWorkspace,
  replaceWorkspaceAccountState,
  replaceWorkspaceFirmRules,
  replaceWorkspaceJournal,
  upsertWorkspace,
} from "./domains/terminalState.mjs";
import {
  getApplication,
  getApplicationStatus,
  mergeApplicationConsent,
  upsertApplication,
} from "./domains/onboardingState.mjs";
import {
  approveAdminUser,
  blockAdminUser,
  clearAdminPasswordFailedAttempts,
  getAdminPasswordAttemptState,
  getMaintenanceState,
  listAdminUsers,
  lockAdminUser,
  recordAdminAuditEvent,
  registerAdminPasswordFailedAttempt,
  toggleMaintenanceState,
} from "./domains/adminState.mjs";
import {
  consumeCollectiveConsciousnessQuestion,
  deleteSession,
  findUserByEmail,
  getUserByUid,
  getUserStatus,
  listTrainingEligibilityUsers,
  listSessions,
  patchUserAccess,
  patchUserSecurity,
  provisionUser,
  recordUserActiveDay,
  revokeOtherSessions,
  upsertSession,
} from "./domains/identityState.mjs";
import {
  appendSupportMessage,
  getSupportThread,
  listSupportThreads,
} from "./domains/supportState.mjs";
import { createAdminRouteHandler } from "./routes/adminRoutes.mjs";
import { createContentRouteHandler } from "./routes/contentRoutes.mjs";
import { createConsensusRouteHandler } from "./routes/consensusRoutes.mjs";
import { createNewsRouteHandler } from "./routes/newsRoutes.mjs";
import { createTradeCalcRouteHandler } from "./routes/tradeCalcRoutes.mjs";
import { createIdentityRouteHandler } from "./routes/identityRoutes.mjs";
import { createTerminalAnalyticsRouteHandler } from "./routes/terminalAnalyticsRoutes.mjs";
import { createTerminalRouteHandler } from "./routes/terminalRoutes.mjs";
import { createOnboardingRouteHandler } from "./routes/onboardingRoutes.mjs";
import { createSupportRouteHandler } from "./routes/supportRoutes.mjs";
// Telegram proxy — J01: token removed from browser bundles
import {
  handleTelegramSendMessage,
  handleTelegramSendForensicAlert,
} from "./routes/telegramRoutes.mjs";
import { createTerminalAnalyticsService } from "./services/terminalAnalyticsService.mjs";
import { createDispatcher, setRolesAdmin } from "./_dispatch.mjs";

// ── Env loading ──────────────────────────────────────────────────────────────

const _loadEnvFiles = () => {
  const cwd = process.cwd();
  const searchDirs = [cwd, resolve(cwd, "..")];
  const files = [".env", ".env.local"];
  const shellDefined = new Set(Object.keys(process.env));
  const fileDefined = new Set();

  for (const dir of searchDirs) {
    for (const fileName of files) {
      const filePath = resolve(dir, fileName);
      if (!existsSync(filePath)) continue;
      const content = readFileSync(filePath, "utf8");
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const sep = trimmed.indexOf("=");
        if (sep <= 0) return;
        let value = trimmed.slice(sep + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        )
          value = value.slice(1, -1);
        const key = trimmed.slice(0, sep).trim();
        if (!shellDefined.has(key) || fileDefined.has(key)) {
          process.env[key] = value;
          fileDefined.add(key);
        }
      });
    }
  }
};
_loadEnvFiles();

// ── Constants ───────────────────────────────────────────────────────────────

const PORT = Number(process.env.BFF_PORT || 8788);
const HOST = process.env.BFF_HOST || "0.0.0.0";
const MASTER_SALT =
  process.env.MASTER_SALT || process.env.VITE_MASTER_SALT || "";
const ADMIN_PASS_HASH =
  process.env.BFF_ADMIN_PASS_HASH ||
  process.env.ADMIN_PASS_HASH ||
  process.env.VITE_ADMIN_PASS_HASH ||
  "";
const ALLOWED_ORIGINS = String(process.env.BFF_ALLOWED_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.BFF_TELEGRAM_BOT_TOKEN ||
  process.env.VITE_TELEGRAM_BOT_TOKEN ||
  "";
const TELEGRAM_CHAT_ID =
  process.env.TELEGRAM_CHAT_ID ||
  process.env.BFF_TELEGRAM_CHAT_ID ||
  process.env.VITE_TELEGRAM_CHAT_ID ||
  "";
const ADMIN_ATTEMPT_LIMIT = 3;
const ADMIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

const AI_PROVIDER_DEFINITIONS = [
  {
    key: "groq",
    name: "Groq",
    envNames: ["AI_GROQ_TURBO_KEY", "GROQ_TURBO_KEY", "VITE_GROQ_TURBO_KEY"],
    model: "llama-3.3-70b-versatile",
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
  },
  {
    key: "gemini",
    name: "Gemini",
    envNames: ["AI_GEMINI_PRO_KEY", "GEMINI_PRO_KEY", "VITE_GEMINI_PRO_KEY"],
    model: "gemini-2.0-flash",
    apiUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
  },
  {
    key: "openrouter",
    name: "OpenRouter",
    envNames: [
      "AI_OPENROUTER_MIND_ALPHA",
      "AI_OPENROUTER_MIND_BETA",
      "OPENROUTER_MIND_ALPHA",
      "OPENROUTER_MIND_BETA",
      "VITE_OPENROUTER_MIND_ALPHA",
      "VITE_OPENROUTER_MIND_BETA",
    ],
    model: "openai/gpt-4o-mini",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
  },
  {
    key: "cerebras",
    name: "Cerebras",
    envNames: ["AI_CEREBRAS_KEY", "CEREBRAS_KEY", "VITE_CEREBRAS_KEY"],
    model: "llama-3.3-70b",
    apiUrl: "https://api.cerebras.ai/v1/chat/completions",
  },
  {
    key: "deepseek",
    name: "DeepSeek",
    envNames: ["AI_DEEPSEEK_KEY", "DEEPSEEK_KEY", "VITE_DEEPSEEK_KEY"],
    model: "deepseek-chat",
    apiUrl: "https://api.deepseek.com/v1/chat/completions",
  },
  {
    key: "sambanova",
    name: "SambaNova",
    envNames: ["AI_SAMBANOVA_KEY", "SAMBANOVA_KEY", "VITE_SAMBANOVA_KEY"],
    model: "Llama-3.2-90B-Vision",
    apiUrl: "https://api.sambanova.ai/v1/chat/completions",
  },
];

// ── Utility helpers ─────────────────────────────────────────────────────────

const getSecretValue = (...names) => {
  for (const name of names) {
    const v = String(process.env[name] || "").trim();
    if (v) return v;
  }
  return "";
};

const getProviderConfig = (providerKey) => {
  const def = AI_PROVIDER_DEFINITIONS.find((e) => e.key === providerKey);
  return def ? { ...def, secret: getSecretValue(...def.envNames) } : null;
};

const buildAiStatusPayload = () =>
  AI_PROVIDER_DEFINITIONS.map((def) => ({
    key: def.key,
    name: def.name,
    configured: Boolean(getSecretValue(...def.envNames)),
    online: Boolean(getSecretValue(...def.envNames)),
    status: getSecretValue(...def.envNames) ? "online" : "unconfigured",
    reason: getSecretValue(...def.envNames)
      ? "Provider key loaded on BFF."
      : "Fresh provider key required.",
    lastPing: Date.now(),
    errors: 0,
  }));

const getOriginFallback = () =>
  ALLOWED_ORIGINS[0] || "https://tradersapp.local";

const _addSecurityHeaders = (headers) => addSecurityHeaders(headers);

const json = (res, statusCode, payload, origin = "*") => {
  const h = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Idempotency-Key, X-Request-ID",
    "Access-Control-Expose-Headers":
      "Idempotency-Key, Retry-After, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-ID",
  };
  _addSecurityHeaders(h);
  res.writeHead(statusCode, h);
  res.end(JSON.stringify(payload));
};

const resolveOrigin = (req) => {
  const ro = req.headers.origin;
  if (!ro) return "*";
  if (ALLOWED_ORIGINS.length === 0) return ro;
  return ALLOWED_ORIGINS.includes(ro) ? ro : ALLOWED_ORIGINS[0];
};

const readJsonBody = (req, maxBytes = 10_000) =>
  new Promise((resolveBody, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) {
        reject(new Error("Payload too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON payload."));
      }
    });
    req.on("error", reject);
  });

const getClientKey = (req) =>
  String(
    req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown-client",
  )
    .split(",")[0]
    .trim();

const hashPassword = (password) =>
  createHash("sha256").update(`${password}${MASTER_SALT}`).digest("hex");

const constantTimeMatch = (left, right) => {
  try {
    return timingSafeEqual(
      Buffer.from(String(left || ""), "utf8"),
      Buffer.from(String(right || ""), "utf8"),
    );
  } catch {
    return false;
  }
};

// ── AI providers ─────────────────────────────────────────────────────────────

const safeErrorMessage = async (response, fallback) => {
  const text = await response.text().catch(() => "");
  return text ? `${fallback}: ${text.slice(0, 300)}` : fallback;
};

const invokeGemini = async ({ secret, systemPrompt, userPrompt, model }) => {
  const prompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${secret}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    },
  );
  if (!response.ok)
    throw new Error(await safeErrorMessage(response, "Gemini request failed"));
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
};

const invokeOpenAiCompatible = async ({
  secret,
  apiUrl,
  model,
  systemPrompt,
  userPrompt,
  extraHeaders = {},
}) => {
  const combined = systemPrompt
    ? `${systemPrompt}\n\n${userPrompt}`
    : userPrompt;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: combined }],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });
  if (!response.ok)
    throw new Error(
      await safeErrorMessage(response, "Provider request failed"),
    );
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Provider returned an empty response.");
  return text;
};

const invokeProvider = async (providerKey, systemPrompt, userPrompt) => {
  const config = getProviderConfig(providerKey);
  if (!config) throw new Error("Unknown AI provider.");
  if (!config.secret) throw new Error(`${config.name} key not configured`);
  if (config.key === "gemini") return invokeGemini(config);
  if (config.key === "openrouter")
    return invokeOpenAiCompatible({
      ...config,
      systemPrompt,
      userPrompt,
      extraHeaders: {
        "HTTP-Referer": getOriginFallback(),
        "X-Title": "Traders Regiment",
      },
    });
  return invokeOpenAiCompatible({ ...config, systemPrompt, userPrompt });
};

// ── Dispatcher ───────────────────────────────────────────────────────────────

setRolesAdmin(ROLES.ADMIN);
const dispatcher = createDispatcher({
  HOST,
  PORT,
  ADMIN_PASS_HASH,
  ALLOWED_ORIGINS,
  ADMIN_ATTEMPT_LIMIT,
  ADMIN_LOCKOUT_WINDOW_MS,
  json,
  resolveOrigin,
  readJsonBody,
  getClientKey,
  hashPassword,
  constantTimeMatch,
  invokeProvider,
  buildAiStatusPayload,
  getOriginFallback,
  getProviderConfig,
  recordHttpRequest,
  randomUUID,
  getRateLimitConfig,
  checkRateLimit,
  authorizeRequest,
  validateAdminToken,
  createAdminSession,
  revokeAdminSession,
  listAdminSessions,
  revokeSessionById,
  getAdminPasswordAttemptState,
  registerAdminPasswordFailedAttempt,
  clearAdminPasswordFailedAttempts,
  createTerminalAnalyticsService,
  getHubContent,
  getDocumentMeta,
  listDocumentMeta,
  getWorkspace,
  replaceWorkspaceAccountState,
  replaceWorkspaceFirmRules,
  replaceWorkspaceJournal,
  upsertWorkspace,
  getApplication,
  getApplicationStatus,
  mergeApplicationConsent,
  upsertApplication,
  deleteSession,
  findUserByEmail,
  getUserByUid,
  getUserStatus,
  listTrainingEligibilityUsers,
  listSessions,
  patchUserAccess,
  patchUserSecurity,
  provisionUser,
  recordUserActiveDay,
  consumeCollectiveConsciousnessQuestion,
  revokeOtherSessions,
  upsertSession,
  appendSupportMessage,
  getSupportThread,
  listSupportThreads,
  approveAdminUser,
  blockAdminUser,
  lockAdminUser,
  recordAdminAuditEvent,
  toggleMaintenanceState,
  getMaintenanceState,
  listAdminUsers,
  createAdminRouteHandler,
  createContentRouteHandler,
  createConsensusRouteHandler,
  createNewsRouteHandler,
  createIdentityRouteHandler,
  createTerminalAnalyticsRouteHandler,
  createTerminalRouteHandler,
  createOnboardingRouteHandler,
  createSupportRouteHandler,
  createTradeCalcRouteHandler,
  createBoardRoomRouteHandler,
  // J01: Telegram proxy — token removed from browser bundles
  handleTelegramSendMessage,
  handleTelegramSendForensicAlert,
});

// ── Server startup ────────────────────────────────────────────────────────────

const server = createServer(dispatcher);

server.listen(PORT, HOST, () => {
  const aiConfigured = buildAiStatusPayload().filter(
    (e) => e.configured,
  ).length;
  console.log(
    `[tradersapp-bff] listening on http://${HOST}:${PORT} (adminPasswordConfigured=${Boolean(ADMIN_PASS_HASH)}, aiProvidersConfigured=${aiConfigured})`,
  );
});

server.on("error", (err) => {
  console.error(
    `[tradersapp-bff] Server error: ${err.message} (code=${err.code})`,
  );
  process.exit(1);
});
