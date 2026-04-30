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
  addSecurityHeaders,
  RateLimiter,
  ROLES,
  authorizeRequest,
  createAdminSession,
  validateAdminToken,
  revokeAdminSession,
  cleanupExpiredSessions,
  getRateLimitConfig,
} from "./services/security.mjs";
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
import { createAdminMfaRouteHandler } from "./routes/adminMfaRoutes.mjs";
import { createContentRouteHandler } from "./routes/contentRoutes.mjs";
import { createConsensusRouteHandler } from "./routes/consensusRoutes.mjs";
import { createWatchtowerRouteHandler } from "./routes/watchtowerRoutes.mjs";
import { createNewsRouteHandler } from "./routes/newsRoutes.mjs";
import { createTradeCalcRouteHandler } from "./routes/tradeCalcRoutes.mjs";
import { createIdentityRouteHandler } from "./routes/identityRoutes.mjs";
import { createTerminalAnalyticsRouteHandler } from "./routes/terminalAnalyticsRoutes.mjs";
import { createTerminalRouteHandler } from "./routes/terminalRoutes.mjs";
import { createOnboardingRouteHandler } from "./routes/onboardingRoutes.mjs";
import { createSupportRouteHandler } from "./routes/supportRoutes.mjs";
import { createBoardRoomRouteHandler } from "./routes/boardRoomRoutes.mjs";
import { createCalendarRouteHandler } from "./routes/calendarRoutes.mjs";
import { startBoardRoomCron } from "./board-room/cron/index.mjs";
import { startWatchtowerDaemon } from "./services/watchtowerService.mjs";
import { boardRoomService } from "./services/boardRoomService.mjs";
import boardRoomTelegram from "./services/boardRoomTelegram.mjs";
import {
  getAdminMfaStatus,
  getAdminTotpSetup,
  startAdminEmailOtp,
  verifyAdminEmailOtp,
  verifyAdminTotp,
} from "./services/adminMfaService.mjs";
// Telegram proxy — J01: token removed from browser bundles
import {
  handleTelegramSendMessage,
  handleTelegramSendForensicAlert,
} from "./routes/telegramRoutes.mjs";
import { createTerminalAnalyticsService } from "./services/terminalAnalyticsService.mjs";
import { resolveClientPolicy as resolveDesktopClientPolicy } from "./services/clientPolicy.mjs";
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
const MASTER_SALT = process.env.MASTER_SALT || "";
const ADMIN_PASS_HASH =
  process.env.BFF_ADMIN_PASS_HASH ||
  process.env.ADMIN_PASS_HASH ||
  "";
const ADMIN_PASSWORD_LOGIN_ENABLED =
  String(process.env.ADMIN_PASSWORD_LOGIN_ENABLED || "false")
    .trim()
    .toLowerCase() === "true";
const CONFIGURED_ALLOWED_ORIGINS = String(process.env.BFF_ALLOWED_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS =
  CONFIGURED_ALLOWED_ORIGINS.length === 0
    ? []
    : Array.from(
        new Set([
          ...CONFIGURED_ALLOWED_ORIGINS,
          "https://tradergunit.pages.dev",
        ]),
      );
const ADMIN_ATTEMPT_LIMIT = 3;
const ADMIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const DESKTOP_MINIMUM_VERSION =
  String(
    process.env.WINDOWS_DESKTOP_MINIMUM_VERSION ||
      process.env.DESKTOP_MINIMUM_VERSION ||
      "",
  ).trim() || null;

// ---------------------------------------------------------------------------
// Security: Rate limiters (one per endpoint class)
// ---------------------------------------------------------------------------
const _rateLimiters = new Map();

function getRateLimiter(pathname) {
  const config = getRateLimitConfig(pathname);
  if (!_rateLimiters.has(config)) {
    _rateLimiters.set(config, new RateLimiter({ ...config, name: pathname }));
  }
  return _rateLimiters.get(config);
}

/** Cleanup expired rate limit entries every 10 minutes. */
const _rlCleanup = setInterval(() => {
  for (const rl of _rateLimiters.values()) rl._cleanup();
  cleanupExpiredSessions();
}, 10 * 60 * 1000);
_rlCleanup.unref();

const AI_PROVIDER_DEFINITIONS = [
  {
    key: "groq",
    name: "Groq",
    envNames: ["AI_GROQ_TURBO_KEY", "GROQ_TURBO_KEY"],
    model: "llama-3.3-70b-versatile",
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
  },
  {
    key: "gemini",
    name: "Gemini",
    envNames: ["AI_GEMINI_PRO_KEY", "GEMINI_PRO_KEY"],
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
    ],
    model: "openai/gpt-4o-mini",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
  },
  {
    key: "cerebras",
    name: "Cerebras",
    envNames: ["AI_CEREBRAS_KEY", "CEREBRAS_KEY"],
    model: "llama-3.3-70b",
    apiUrl: "https://api.cerebras.ai/v1/chat/completions",
  },
  {
    key: "deepseek",
    name: "DeepSeek",
    envNames: ["AI_DEEPSEEK_KEY", "DEEPSEEK_KEY"],
    model: "deepseek-chat",
    apiUrl: "https://api.deepseek.com/v1/chat/completions",
  },
  {
    key: "sambanova",
    name: "SambaNova",
    envNames: ["AI_SAMBANOVA_KEY", "SAMBANOVA_KEY"],
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
<<<<<<< HEAD
  const h = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Idempotency-Key, X-Request-ID, x-tradersapp-install-id",
    "Access-Control-Expose-Headers":
      "Idempotency-Key, Retry-After, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-ID",
  };
  _addSecurityHeaders(h);
  res.writeHead(statusCode, h);
=======
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers": "Retry-After, X-RateLimit-Remaining, X-RateLimit-Reset",
  };
  addSecurityHeaders(headers);
  res.writeHead(statusCode, headers);
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
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

const resolveClientPolicy = ({
  userStatus,
  maintenanceActive,
  platform,
  currentVersion,
}) =>
  resolveDesktopClientPolicy({
    userStatus,
    maintenanceActive,
    minimumDesktopVersion: DESKTOP_MINIMUM_VERSION,
    platform,
    currentVersion,
  });

// ── Dispatcher ───────────────────────────────────────────────────────────────

setRolesAdmin(ROLES.ADMIN);
const dispatcher = createDispatcher({
  HOST,
  PORT,
  ADMIN_PASS_HASH,
  ADMIN_PASSWORD_LOGIN_ENABLED,
  ALLOWED_ORIGINS,
  ADMIN_ATTEMPT_LIMIT,
  ADMIN_LOCKOUT_WINDOW_MS,
  SAFE_ZONE_IPV4: process.env.SAFE_ZONE_IPV4 || "",
  SAFE_ZONE_CITY: process.env.SAFE_ZONE_CITY || "",
  SAFE_ZONE_PIN_CODES: process.env.SAFE_ZONE_PIN_CODES || "",
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
  getAdminMfaStatus,
  getAdminTotpSetup,
  startAdminEmailOtp,
  verifyAdminEmailOtp,
  verifyAdminTotp,
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
  resolveClientPolicy,
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
  createAdminMfaRouteHandler,
  createContentRouteHandler,
  createConsensusRouteHandler,
  createWatchtowerRouteHandler,
  createNewsRouteHandler,
  createIdentityRouteHandler,
  createTerminalAnalyticsRouteHandler,
  createTerminalRouteHandler,
  createOnboardingRouteHandler,
  createSupportRouteHandler,
  createTradeCalcRouteHandler,
  createBoardRoomRouteHandler,
  createCalendarRouteHandler,
  // J01: Telegram proxy — token removed from browser bundles
  handleTelegramSendMessage,
  handleTelegramSendForensicAlert,
});

// ── Server startup ────────────────────────────────────────────────────────────

<<<<<<< HEAD
const server = createServer(dispatcher);
=======
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: parseMode,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await safeErrorMessage(response, "Telegram request failed"));
  }

  const data = await response.json();
  if (!data?.ok) {
    throw new Error(data?.description || "Telegram API rejected the request.");
  }

  return data;
};

const server = createServer(async (req, res) => {
  const origin = resolveOrigin(req);
  const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const pathname = url.pathname;

  // --- Security: Rate Limiting ---
  if (req.method !== "OPTIONS") {
    const clientKey = getClientKey(req);
    const limiter = getRateLimiter(pathname);
    const result = limiter.check(clientKey);

    if (!result.allowed) {
      json(
        res,
        429,
        {
          ok: false,
          error: "Rate limit exceeded.",
          retryAfterMs: result.resetMs,
        },
        origin,
      );
      res.writeHead(429, {
        ...Object.fromEntries(
          Object.entries({
            "Retry-After": String(Math.ceil(result.resetMs / 1000)),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(result.resetMs / 1000)),
          })
        ),
      });
      return;
    }

    // Inform client of remaining budget (non-breaking)
    res.on("header", () => {
      res.removeHeader("X-RateLimit-Remaining");
      res.removeHeader("X-RateLimit-Reset");
      res.setHeader("X-RateLimit-Remaining", String(result.remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(result.resetMs / 1000)));
    });
  }

  if (req.method === "OPTIONS") {
    json(res, 204, {}, origin);
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    const aiStatuses = buildAiStatusPayload();
    json(
      res,
      200,
      {
        ok: true,
        service: "tradersapp-bff",
        version: "1.0.0",
        adminPasswordConfigured: Boolean(ADMIN_PASS_HASH),
        security: {
          rateLimiting: true,
          rbac: true,
          securityHeaders: true,
          corsOriginsCount: ALLOWED_ORIGINS.length || "all",
        },
        adminRateLimit: {
          attempts: ADMIN_ATTEMPT_LIMIT,
          windowMs: ADMIN_LOCKOUT_WINDOW_MS,
        },
        aiProvidersConfigured: aiStatuses.filter((entry) => entry.configured)
          .length,
        telegramConfigured: Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID),
      },
      origin,
    );
    return;
  }

  if (req.method === "GET" && req.url === "/ai/status") {
    json(
      res,
      200,
      {
        ok: true,
        engines: buildAiStatusPayload(),
      },
      origin,
    );
    return;
  }

  const contentRouteHandler = createContentRouteHandler({
    getHubContent,
    getDocumentMeta,
    listDocumentMeta,
    json,
  });
  const handledContentRoute = contentRouteHandler(req, res, url, origin);
  if (handledContentRoute) {
    return;
  }

  const terminalRouteHandler = createTerminalRouteHandler({
    getWorkspace,
    replaceWorkspaceAccountState,
    replaceWorkspaceFirmRules,
    replaceWorkspaceJournal,
    upsertWorkspace,
    readJsonBody,
    json,
  });
  const handledTerminalRoute = await terminalRouteHandler(req, res, url, origin);
  if (handledTerminalRoute) {
    return;
  }

  const terminalAnalyticsRouteHandler = createTerminalAnalyticsRouteHandler({
    invokeTerminalAnalyticsChat,
    json,
    readJsonBody,
  });
  const handledTerminalAnalyticsRoute = await terminalAnalyticsRouteHandler(
    req,
    res,
    url,
    origin,
  );
  if (handledTerminalAnalyticsRoute) {
    return;
  }

  const identityRouteHandler = createIdentityRouteHandler({
    deleteSession,
    findUserByEmail,
    getUserByUid,
    getUserStatus,
    listSessions,
    patchUserAccess,
    patchUserSecurity,
    readJsonBody,
    provisionUser,
    revokeOtherSessions,
    upsertSession,
    json,
  });
  const handledIdentityRoute = await identityRouteHandler(req, res, url, origin);
  if (handledIdentityRoute) {
    return;
  }

  const onboardingRouteHandler = createOnboardingRouteHandler({
    getApplication,
    getApplicationStatus,
    mergeApplicationConsent,
    readJsonBody,
    upsertApplication,
    json,
  });
  const handledOnboardingRoute = await onboardingRouteHandler(req, res, url, origin);
  if (handledOnboardingRoute) {
    return;
  }

  const supportRouteHandler = createSupportRouteHandler({
    appendSupportMessage,
    getSupportThread,
    listSupportThreads,
    json,
    readJsonBody,
  });
  const handledSupportRoute = await supportRouteHandler(req, res, url, origin);
  if (handledSupportRoute) {
    return;
  }

  const consensusRouteHandler = createConsensusRouteHandler({
    json,
    readJsonBody,
  });
  const handledConsensusRoute = await consensusRouteHandler(req, res, url, origin);
  if (handledConsensusRoute) {
    return;
  }

  const newsRouteHandler = createNewsRouteHandler({ json });
  const handledNewsRoute = await newsRouteHandler(req, res, url, origin);
  if (handledNewsRoute) {
    return;
  }

  // --- RBAC: Require ADMIN role for admin routes ---
  if (pathname.startsWith("/admin")) {
    const auth = authorizeRequest(req);
    if (!auth.authorized) {
      json(res, 403, { ok: false, error: auth.error }, origin);
      return;
    }
  }

  const adminRouteHandler = createAdminRouteHandler({
    approveAdminUser,
    blockAdminUser,
    getMaintenanceState,
    listAdminUsers,
    lockAdminUser,
    recordAdminAuditEvent,
    toggleMaintenanceState,
    json,
    readJsonBody,
  });
  const handledAdminRoute = await adminRouteHandler(req, res, url, origin);
  if (handledAdminRoute) {
    return;
  }

  // --- Admin Session Management ---
  // POST /admin/session — create a session token (requires valid admin password)
  if (req.method === "POST" && pathname === "/admin/session") {
    try {
      const body = await readJsonBody(req);
      const password = String(body.password || "");

      if (!ADMIN_PASS_HASH) {
        json(res, 503, { ok: false, error: "Admin password not configured." }, origin);
        return;
      }

      if (!password) {
        json(res, 400, { ok: false, error: "Password required." }, origin);
        return;
      }

      if (!constantTimeMatch(hashPassword(password), ADMIN_PASS_HASH)) {
        json(res, 401, { ok: false, error: "Invalid admin password." }, origin);
        return;
      }

      const ttlMs = Math.min(Number(body.ttlMs) || 8 * 3600 * 1000, 24 * 3600 * 1000);
      const token = createAdminSession(ROLES.ADMIN, ttlMs);
      json(res, 200, {
        ok: true,
        token,
        expiresInMs: ttlMs,
        role: ROLES.ADMIN,
      }, origin);
      return;
    } catch (error) {
      json(res, 400, { ok: false, error: error.message || "Session creation failed." }, origin);
      return;
    }
  }

  // DELETE /admin/session — revoke current session
  if (req.method === "DELETE" && pathname === "/admin/session") {
    const authHdr = req.headers.authorization || "";
    if (authHdr.startsWith("Bearer ")) {
      revokeAdminSession(authHdr.slice(7).trim());
    }
    json(res, 200, { ok: true, message: "Session revoked." }, origin);
    return;
  }

  // GET /admin/session — check session validity
  if (req.method === "GET" && pathname === "/admin/session") {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      const result = validateAdminToken(authHeader.slice(7).trim());
      if (result.valid) {
        json(res, 200, { ok: true, valid: true, role: result.role }, origin);
        return;
      }
    }
    json(res, 200, { ok: true, valid: false, role: null }, origin);
    return;
  }

  if (req.method === "POST" && req.url === "/ai/provider-chat") {
    try {
      const body = await readJsonBody(req, 200_000);
      const provider = String(body.provider || "").trim().toLowerCase();
      const systemPrompt = String(body.systemPrompt || "");
      const userPrompt = String(body.userPrompt || "");

      if (!provider || !userPrompt) {
        json(
          res,
          400,
          {
            ok: false,
            error: "Provider and userPrompt are required.",
          },
          origin,
        );
        return;
      }

      const response = await invokeProvider(provider, systemPrompt, userPrompt);
      json(
        res,
        200,
        {
          ok: true,
          provider,
          response,
          statuses: buildAiStatusPayload(),
        },
        origin,
      );
      return;
    } catch (error) {
      json(
        res,
        400,
        {
          ok: false,
          error: error.message || "AI provider request failed.",
        },
        origin,
      );
      return;
    }
  }

  if (req.method === "POST" && req.url === "/ai/deliberate") {
    try {
      const body = await readJsonBody(req, 200_000);
      const systemPrompt = String(body.systemPrompt || "");
      const userPrompt = String(body.userPrompt || "");

      if (!userPrompt) {
        json(
          res,
          400,
          {
            ok: false,
            error: "userPrompt is required.",
          },
          origin,
        );
        return;
      }

      const providerOrder = ["groq", "gemini", "openrouter", "cerebras", "deepseek", "sambanova"];
      const failures = [];

      for (const provider of providerOrder) {
        try {
          const response = await invokeProvider(provider, systemPrompt, userPrompt);
          json(
            res,
            200,
            {
              ok: true,
              provider,
              response,
              statuses: buildAiStatusPayload(),
            },
            origin,
          );
          return;
        } catch (error) {
          failures.push({
            provider,
            error: error.message || "Provider failed.",
          });
        }
      }

      json(
        res,
        503,
        {
          ok: false,
          error: "All AI models unavailable.",
          failures,
          statuses: buildAiStatusPayload(),
        },
        origin,
      );
      return;
    } catch (error) {
      json(
        res,
        400,
        {
          ok: false,
          error: error.message || "AI deliberation failed.",
        },
        origin,
      );
      return;
    }
  }

  if (req.method === "POST" && req.url === "/notify/telegram") {
    try {
      const body = await readJsonBody(req, 200_000);
      const message = String(body.message || body.text || "");
      const parseMode = String(body.parseMode || body.parse_mode || "HTML");

      if (!message) {
        json(
          res,
          400,
          {
            ok: false,
            error: "Telegram message is required.",
          },
          origin,
        );
        return;
      }

      const data = await sendTelegramMessage(message, parseMode);
      json(res, 200, { ok: true, data }, origin);
      return;
    } catch (error) {
      json(
        res,
        400,
        {
          ok: false,
          error: error.message || "Telegram request failed.",
        },
        origin,
      );
      return;
    }
  }

  if (req.method === "POST" && req.url === "/admin/verify-password") {
    const clientKey = getClientKey(req);
    const attemptState = getAdminPasswordAttemptState(clientKey);

    if (attemptState.lockoutUntil && attemptState.lockoutUntil > Date.now()) {
      json(
        res,
        429,
        {
          ok: false,
          verified: false,
          error: "Too many attempts. Try again later.",
          retryAfterMs: attemptState.lockoutUntil - Date.now(),
        },
        origin,
      );
      return;
    }

    if (!ADMIN_PASS_HASH) {
      json(
        res,
        503,
        {
          ok: false,
          verified: false,
          error: "Admin password secret is not configured on the BFF.",
        },
        origin,
      );
      return;
    }

    try {
      const body = await readJsonBody(req);
      const password = String(body.password || "");

      if (!password) {
        json(
          res,
          400,
          {
            ok: false,
            verified: false,
            error: "Admin password is required.",
          },
          origin,
        );
        return;
      }

      const isValid = constantTimeMatch(hashPassword(password), ADMIN_PASS_HASH);

      if (!isValid) {
        const nextAttemptState = registerAdminPasswordFailedAttempt(
          clientKey,
          ADMIN_ATTEMPT_LIMIT,
          ADMIN_LOCKOUT_WINDOW_MS,
        );
        json(
          res,
          401,
          {
            ok: false,
            verified: false,
            error: "Invalid admin password.",
            attemptsRemaining: Math.max(
              0,
              ADMIN_ATTEMPT_LIMIT - nextAttemptState.attempts,
            ),
            retryAfterMs:
              nextAttemptState.lockoutUntil > 0
                ? nextAttemptState.lockoutUntil - Date.now()
                : 0,
          },
          origin,
        );
        return;
      }

      clearAdminPasswordFailedAttempts(clientKey);
      json(res, 200, { ok: true, verified: true }, origin);
      return;
    } catch (error) {
      json(
        res,
        400,
        {
          ok: false,
          verified: false,
          error: error.message || "Invalid request.",
        },
        origin,
      );
      return;
    }
  }

  json(
    res,
    404,
    {
      ok: false,
      error: "Route not found.",
    },
    origin,
  );
});
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

server.listen(PORT, HOST, () => {
  const aiConfigured = buildAiStatusPayload().filter(
    (e) => e.configured,
  ).length;
  console.log(
    `[tradersapp-bff] listening on http://${HOST}:${PORT} (adminPasswordLoginEnabled=${ADMIN_PASSWORD_LOGIN_ENABLED}, aiProvidersConfigured=${aiConfigured})`,
  );

  // Start Board Room cron jobs after server is listening
  startBoardRoomCron(boardRoomService, boardRoomTelegram);
  startWatchtowerDaemon({ host: "127.0.0.1", port: PORT });

  // Start Telegram AI Agent (polling loop)
  if (String(process.env.TELEGRAM_AGENT_ENABLED || "false") === "true") {
    import("./services/telegramAgent.mjs").then(({ startTelegramAgent }) => {
      startTelegramAgent();
    });
  }
});

server.on("error", (err) => {
  console.error(
    `[tradersapp-bff] Server error: ${err.message} (code=${err.code})`,
  );
  process.exit(1);
});
