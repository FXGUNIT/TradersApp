/**
 * BFF — HTTP Request Dispatcher
 * Extracted from server.mjs (Rule #3 hard limit: JS ≤500 lines)
 *
 * Accepts pre-built route handlers + all utility functions as injected dependencies.
 * Handles: rate limiting → route handlers → AI proxy → Telegram → 404
 */
export function createDispatcher({
  // Constants
  HOST, PORT, ADMIN_PASS_HASH, ALLOWED_ORIGINS,
  ADMIN_ATTEMPT_LIMIT, ADMIN_LOCKOUT_WINDOW_MS,
  // Utilities
  json, resolveOrigin, readJsonBody, getClientKey,
  hashPassword, constantTimeMatch,
  invokeProvider, sendTelegramMessage, buildAiStatusPayload,
  getOriginFallback, invokeTerminalAnalyticsChat,
  // Security
  getRateLimitConfig, checkRateLimit,
  authorizeRequest, validateAdminToken,
  createAdminSession, revokeAdminSession,
  listAdminSessions, revokeSessionById,
  getAdminPasswordAttemptState, registerAdminPasswordFailedAttempt, clearAdminPasswordFailedAttempts,
  // AI
  createTerminalAnalyticsService,
  // Domain state
  getHubContent, getDocumentMeta, listDocumentMeta,
  getWorkspace, replaceWorkspaceAccountState, replaceWorkspaceFirmRules,
  replaceWorkspaceJournal, upsertWorkspace,
  getApplication, getApplicationStatus, mergeApplicationConsent, upsertApplication,
  deleteSession, findUserByEmail, getUserByUid, getUserStatus, listSessions,
  patchUserAccess, patchUserSecurity, provisionUser, revokeOtherSessions, upsertSession,
  appendSupportMessage, getSupportThread, listSupportThreads,
  approveAdminUser, blockAdminUser, lockAdminUser, recordAdminAuditEvent,
  toggleMaintenanceState, getMaintenanceState, listAdminUsers,
  // Route factories
  createAdminRouteHandler, createContentRouteHandler, createConsensusRouteHandler,
  createNewsRouteHandler, createIdentityRouteHandler,
  createTerminalAnalyticsRouteHandler, createTerminalRouteHandler,
  createOnboardingRouteHandler, createSupportRouteHandler,
}) {
  // Pre-build route handlers
  const _invokeTerminalAnalyticsChat = createTerminalAnalyticsService
    ? createTerminalAnalyticsService({ getProviderConfig, safeErrorMessage: null }).invokeTerminalAnalyticsChat
    : null;

  const contentHandler = createContentRouteHandler({ getHubContent, getDocumentMeta, listDocumentMeta, json });
  const terminalHandler = createTerminalRouteHandler({ getWorkspace, replaceWorkspaceAccountState, replaceWorkspaceFirmRules, replaceWorkspaceJournal, upsertWorkspace, readJsonBody, json });
  const terminalAnalyticsHandler = createTerminalAnalyticsRouteHandler({ invokeTerminalAnalyticsChat: _invokeTerminalAnalyticsChat, json, readJsonBody });
  const identityHandler = createIdentityRouteHandler({ deleteSession, findUserByEmail, getUserByUid, getUserStatus, listSessions, patchUserAccess, patchUserSecurity, provisionUser, revokeOtherSessions, upsertSession, readJsonBody, json });
  const onboardingHandler = createOnboardingRouteHandler({ getApplication, getApplicationStatus, mergeApplicationConsent, upsertApplication, readJsonBody, json });
  const supportHandler = createSupportRouteHandler({ appendSupportMessage, getSupportThread, listSupportThreads, json, readJsonBody });
  const consensusHandler = createConsensusRouteHandler({ json, readJsonBody });
  const newsHandler = createNewsRouteHandler({ json });
  const adminHandler = createAdminRouteHandler({ approveAdminUser, blockAdminUser, getMaintenanceState, listAdminUsers, lockAdminUser, recordAdminAuditEvent, toggleMaintenanceState, json, readJsonBody });

  return async function dispatcher(req, res) {
    const requestStartedAt = Date.now();
    const requestId = String(req.headers["x-request-id"] || randomUUID());
    req.id = requestId;
    req.requestId = requestId;
    if (!req.headers["x-request-id"]) req.headers["x-request-id"] = requestId;
    res.setHeader("X-Request-ID", requestId);
    const origin = resolveOrigin(req, ALLOWED_ORIGINS);
    const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);
    const pathname = url.pathname;
    const method = req.method || "GET";

    if (pathname !== "/metrics") {
      res.once("finish", () => {
        recordHttpRequest(method, pathname, res.statusCode || 500, (Date.now() - requestStartedAt) / 1000);
      });
    }

    // ── Rate Limiting ──────────────────────────────────────────────────────
    if (method !== "OPTIONS" && pathname !== "/metrics") {
      const rateLimit = getRateLimitConfig(pathname);
      const clientKey = `${rateLimit.name}:${getClientKey(req)}`;
      const result = await checkRateLimit(clientKey, rateLimit.maxRequests, rateLimit.windowMs);
      res.setHeader("X-RateLimit-Remaining", String(result.remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(result.resetMs / 1000)));
      if (!result.allowed) {
        res.setHeader("Retry-After", String(Math.ceil(result.resetMs / 1000)));
        json(res, 429, { ok: false, error: "Rate limit exceeded.", retryAfterMs: result.resetMs }, origin);
        return;
      }
    }

    if (method === "OPTIONS") { json(res, 204, {}, origin); return; }

    // ── Built-in endpoints ────────────────────────────────────────────────
    if (method === "GET" && req.url === "/live") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ live: true })); return; }

    if (method === "GET" && req.url === "/health") {
      json(res, 200, {
        ok: true, service: "tradersapp-bff", version: "1.0.0",
        adminPasswordConfigured: Boolean(ADMIN_PASS_HASH),
        security: { rateLimiting: true, rbac: true, securityHeaders: true, corsOriginsCount: ALLOWED_ORIGINS.length || "all" },
        adminRateLimit: { attempts: ADMIN_ATTEMPT_LIMIT, windowMs: ADMIN_LOCKOUT_WINDOW_MS },
        aiProvidersConfigured: buildAiStatusPayload().filter(e => e.configured).length,
        telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      }, origin);
      return;
    }

    if (method === "GET" && pathname === "/metrics") {
      const { getMetrics, getContentType } = await import("./metrics.mjs");
      const body = Buffer.from(await getMetrics(), "utf8");
      res.writeHead(200, { "Content-Type": getContentType(), "Content-Length": body.byteLength });
      res.end(body);
      return;
    }

    if (method === "GET" && req.url === "/ai/status") { json(res, 200, { ok: true, engines: buildAiStatusPayload() }, origin); return; }

    // ── Domain route handlers ──────────────────────────────────────────────
    if (contentHandler(req, res, url, origin)) return;
    if (await terminalHandler(req, res, url, origin)) return;
    if (await terminalAnalyticsHandler(req, res, url, origin)) return;
    if (await identityHandler(req, res, url, origin)) return;
    if (await onboardingHandler(req, res, url, origin)) return;
    if (await supportHandler(req, res, url, origin)) return;
    if (await consensusHandler(req, res, url, origin)) return;
    if (await newsHandler(req, res, url, origin)) return;

    // ── Admin auth: password verify (unauthenticated) ──────────────────────
    if (method === "POST" && pathname === "/auth/admin/verify") {
      const ck = getClientKey(req);
      const attemptState = getAdminPasswordAttemptState(ck);
      if (attemptState.lockoutUntil && attemptState.lockoutUntil > Date.now()) {
        json(res, 429, { ok: false, verified: false, error: "Too many attempts. Try again later.", retryAfterMs: attemptState.lockoutUntil - Date.now() }, origin); return;
      }
      if (!ADMIN_PASS_HASH) { json(res, 503, { ok: false, verified: false, error: "Admin password not configured." }, origin); return; }
      try {
        const body = await readJsonBody(req);
        const password = String(body.password || "");
        if (!password) { json(res, 400, { ok: false, verified: false, error: "Password required." }, origin); return; }
        const isValid = constantTimeMatch(hashPassword(password, process.env.MASTER_SALT || "TR_SECURITY_SALT_2024_REGIMENT"), ADMIN_PASS_HASH);
        if (!isValid) {
          const next = registerAdminPasswordFailedAttempt(ck, ADMIN_ATTEMPT_LIMIT, ADMIN_LOCKOUT_WINDOW_MS);
          json(res, 401, { ok: false, verified: false, error: "Invalid admin password.", attemptsRemaining: Math.max(0, ADMIN_ATTEMPT_LIMIT - next.attempts), retryAfterMs: next.lockoutUntil > 0 ? next.lockoutUntil - Date.now() : 0 }, origin); return;
        }
        clearAdminPasswordFailedAttempts(ck);
        json(res, 200, { ok: true, verified: true }, origin); return;
      } catch (e) { json(res, 400, { ok: false, verified: false, error: e.message || "Invalid request." }, origin); return; }
    }

    // ── Admin RBAC gate ───────────────────────────────────────────────────
    if (pathname.startsWith("/admin") && !(pathname === "/admin/session" && method === "POST")) {
      const auth = await authorizeRequest(req);
      if (!auth.authorized) { json(res, 403, { ok: false, error: auth.error }, origin); return; }
    }

    // ── Admin route handler ───────────────────────────────────────────────
    if (await adminHandler(req, res, url, origin)) return;

    // ── Admin session management ───────────────────────────────────────────
    if (method === "POST" && pathname === "/admin/session") {
      try {
        const body = await readJsonBody(req);
        const password = String(body.password || "");
        if (!ADMIN_PASS_HASH) { json(res, 503, { ok: false, error: "Admin password not configured." }, origin); return; }
        if (!password) { json(res, 400, { ok: false, error: "Password required." }, origin); return; }
        if (!constantTimeMatch(hashPassword(password, process.env.MASTER_SALT || "TR_SECURITY_SALT_2024_REGIMENT"), ADMIN_PASS_HASH)) { json(res, 401, { ok: false, error: "Invalid admin password." }, origin); return; }
        const ttlMs = Math.min(Number(body.ttlMs) || 8 * 3600 * 1000, 24 * 3600 * 1000);
        const device = { fingerprint: String(body.deviceFingerprint || "unknown"), browser: String(body.deviceBrowser || req.headers["user-agent"] || "Unknown").substring(0, 80), os: String(body.deviceOs || "unknown"), device: String(body.deviceType || "unknown"), ip: req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown", rememberDevice: !!body.rememberDevice };
        const token = await createAdminSession(ROLES_ADMIN, ttlMs, device);
        json(res, 200, { ok: true, token, expiresInMs: ttlMs, role: ROLES_ADMIN }, origin); return;
      } catch (e) { json(res, 400, { ok: false, error: e.message || "Session creation failed." }, origin); return; }
    }

    if (method === "DELETE" && pathname === "/admin/session") {
      const authHdr = req.headers.authorization || "";
      if (authHdr.startsWith("Bearer ")) await revokeAdminSession(authHdr.slice(7).trim());
      json(res, 200, { ok: true, message: "Session revoked." }, origin); return;
    }

    if (method === "GET" && pathname === "/admin/session") {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const result = await validateAdminToken(authHeader.slice(7).trim());
        if (result.valid) { json(res, 200, { ok: true, valid: true, role: result.role }, origin); return; }
      }
      json(res, 200, { ok: true, valid: false, role: null }, origin); return;
    }

    if (method === "GET" && pathname === "/admin/sessions") {
      const auth = await authorizeRequest(req);
      if (!auth.authorized) { json(res, 403, { ok: false, error: auth.error }, origin); return; }
      const all = await listAdminSessions();
      json(res, 200, { ok: true, sessions: all.map(({ token: _t, ...rest }) => rest) }, origin); return;
    }

    if (method === "DELETE" && pathname === "/admin/sessions") {
      const auth = await authorizeRequest(req);
      if (!auth.authorized) { json(res, 403, { ok: false, error: auth.error }, origin); return; }
      try {
        const body = await readJsonBody(req);
        const { id, token: revokeToken } = body || {};
        let fullToken = revokeToken;
        if (!fullToken && id) { const all = await listAdminSessions(); const m = all.find(s => s.id === id); if (m) fullToken = m.token; }
        if (!fullToken) { json(res, 400, { ok: false, error: "Session id or token required." }, origin); return; }
        const allSess = await listAdminSessions();
        if (allSess.length <= 1 && allSess[0]?.token === fullToken) { json(res, 400, { ok: false, error: "Cannot revoke the only active session." }, origin); return; }
        const revoked = await revokeSessionById(fullToken);
        json(res, revoked ? 200 : 404, { ok: revoked, error: revoked ? null : "Session not found." }, origin); return;
      } catch { json(res, 400, { ok: false, error: "Invalid request." }, origin); return; }
    }

    // ── AI Proxy: /ai/provider-chat ───────────────────────────────────────
    if (method === "POST" && req.url === "/ai/provider-chat") {
      try {
        const body = await readJsonBody(req, 200_000);
        const provider = String(body.provider || "").trim().toLowerCase();
        const systemPrompt = String(body.systemPrompt || "");
        const userPrompt = String(body.userPrompt || "");
        if (!provider || !userPrompt) { json(res, 400, { ok: false, error: "Provider and userPrompt are required." }, origin); return; }
        const response = await invokeProvider(provider, systemPrompt, userPrompt, getOriginFallback);
        json(res, 200, { ok: true, provider, response, statuses: buildAiStatusPayload() }, origin); return;
      } catch (e) { json(res, 400, { ok: false, error: e.message || "AI provider request failed." }, origin); return; }
    }

    // ── AI Deliberate: /ai/deliberate ───────────────────────────────────
    if (method === "POST" && req.url === "/ai/deliberate") {
      try {
        const body = await readJsonBody(req, 200_000);
        const systemPrompt = String(body.systemPrompt || "");
        const userPrompt = String(body.userPrompt || "");
        if (!userPrompt) { json(res, 400, { ok: false, error: "userPrompt is required." }, origin); return; }
        const order = ["groq", "gemini", "openrouter", "cerebras", "deepseek", "sambanova"];
        const failures = [];
        for (const provider of order) {
          try {
            const response = await invokeProvider(provider, systemPrompt, userPrompt, getOriginFallback);
            json(res, 200, { ok: true, provider, response, statuses: buildAiStatusPayload() }, origin); return;
          } catch (e) { failures.push({ provider, error: e.message || "Provider failed." }); }
        }
        json(res, 503, { ok: false, error: "All AI models unavailable.", failures, statuses: buildAiStatusPayload() }, origin); return;
      } catch (e) { json(res, 400, { ok: false, error: e.message || "AI deliberation failed." }, origin); return; }
    }

    // ── Telegram: /notify/telegram ───────────────────────────────────────
    if (method === "POST" && req.url === "/notify/telegram") {
      try {
        const body = await readJsonBody(req, 200_000);
        const message = String(body.message || body.text || "");
        const parseMode = String(body.parseMode || body.parse_mode || "HTML");
        if (!message) { json(res, 400, { ok: false, error: "Telegram message is required." }, origin); return; }
        const data = await sendTelegramMessage(message, parseMode, process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID);
        json(res, 200, { ok: true, data }, origin); return;
      } catch (e) { json(res, 400, { ok: false, error: e.message || "Telegram request failed." }, origin); return; }
    }

    // ── 404 ───────────────────────────────────────────────────────────────
    json(res, 404, { ok: false, error: "Route not found." }, origin);
  };
}

let ROLES_ADMIN;
export function setRolesAdmin(val) { ROLES_ADMIN = val; }
