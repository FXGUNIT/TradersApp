/**
 * BFF — Route Handler Registrations
 * Extracted from _dispatch.mjs (Rule #3 hard limit: JS ≤500 lines)
 *
 * All `if (method === "..." && pathname === "...")` blocks that call json()
 * or delegate to pre-built route handlers.  No middleware, no wiring.
 */
export function registerDispatchRoutes({
  // Utilities
  json,
  readJsonBody,
  getClientKey,
  hashPassword,
  constantTimeMatch,
  invokeProvider,
  getOriginFallback,
  buildAiStatusPayload,
  randomUUID,
  // Security
  authorizeRequest,
  validateAdminToken,
  createAdminSession,
  getAdminMfaStatus = null,
  startAdminEmailOtp = null,
  verifyAdminEmailOtp = null,
  verifyAdminTotp = null,
  revokeAdminSession,
  listAdminSessions,
  revokeSessionById,
  getAdminPasswordAttemptState,
  registerAdminPasswordFailedAttempt,
  clearAdminPasswordFailedAttempts,
  // Domain state
  consumeCollectiveConsciousnessQuestion,
  // Route handlers
  contentHandler,
  terminalHandler,
  terminalAnalyticsHandler,
  identityHandler,
  onboardingHandler,
  supportHandler,
  consensusHandler,
  watchtowerHandler,
  newsHandler,
  tradeCalcHandler,
  adminHandler,
  boardRoomHandler,
  // Admin constants
  ADMIN_PASS_HASH,
  ADMIN_PASSWORD_LOGIN_ENABLED = false,
  ALLOWED_ORIGINS,
  ROLES_ADMIN,
  ADMIN_ATTEMPT_LIMIT,
  ADMIN_LOCKOUT_WINDOW_MS,
  // Telegram proxy (J01 — token removed from browser bundles)
  handleTelegramSendMessage,
  handleTelegramSendForensicAlert,
}) {
  // ── Helpers shared by inline route logic ────────────────────────────────────
  const resolveCollectiveConsciousnessRequest = (body = {}) => {
    const user = body?.user && typeof body.user === "object" ? body.user : {};
    const uid = String(body.uid || user.uid || "").trim();
    const email = String(body.email || user.email || "")
      .trim()
      .toLowerCase();
    const fullName = String(
      body.fullName || user.fullName || user.displayName || "",
    ).trim();
    const role = String(body.role || user.role || "")
      .trim()
      .toLowerCase();
    return { uid, email: email || null, fullName: fullName || null, role: role || null };
  };

  const buildCollectiveConsciousnessLimitPayload = (usage = {}) => ({
    ok: false,
    error: "Collective Consciousness question limit reached.",
    code: "COLLECTIVE_CONSCIOUSNESS_LIMIT_REACHED",
    currentTier: usage.currentTier || "standard",
    questionsUsed: Number(usage.questionCount || 0),
    questionsAllowed: usage.questionsAllowed,
    resetTimestamp: usage.resetTimestamp || null,
    remainingWaitMs: Number(usage.remainingWaitMs || 0),
    upsell: usage.upsell || null,
    usage,
  });

  const resolveAdminDevice = (body = {}, req = {}) => ({
    fingerprint: String(body.deviceFingerprint || "unknown"),
    browser: String(
      body.deviceBrowser || req.headers?.["user-agent"] || "Unknown",
    ).substring(0, 80),
    os: String(body.deviceOs || "unknown"),
    device: String(body.deviceType || "unknown"),
    ip: req.headers?.["x-forwarded-for"] || req.headers?.["x-real-ip"] || "unknown",
    rememberDevice: !!body.rememberDevice,
    authMethod: String(body.authMethod || "mfa"),
  });

  const createAdminMfaSessionPayload = async (
    req,
    body = {},
    authMethod = "mfa",
  ) => {
    const ttlMs = Math.min(
      Number(body.ttlMs) || 8 * 3600 * 1000,
      24 * 3600 * 1000,
    );
    const token = await createAdminSession(
      ROLES_ADMIN,
      ttlMs,
      resolveAdminDevice({ ...body, authMethod }, req),
    );
    return {
      ok: true,
      verified: true,
      token,
      expiresInMs: ttlMs,
      role: ROLES_ADMIN,
      authMethod,
    };
  };

  return async function dispatchRoutes(req, res, url, pathname, method, origin) {
    // ── Built-in endpoints ────────────────────────────────────────────────────
    if (method === "GET" && pathname === "/live") {
      json(res, 200, { ok: true, live: true, service: "tradersapp-bff" }, origin);
      return true;
    }
    if (method === "GET" && pathname === "/ready") {
      json(res, 200, { ok: true, ready: true, service: "tradersapp-bff" }, origin);
      return true;
    }
    if (method === "GET" && pathname === "/health") {
      json(res, 200, {
        ok: true,
        service: "tradersapp-bff",
        version: "1.0.0",
        adminPasswordConfigured: Boolean(ADMIN_PASS_HASH),
        adminPasswordLoginEnabled: ADMIN_PASSWORD_LOGIN_ENABLED,
        adminMfa: typeof getAdminMfaStatus === "function"
          ? getAdminMfaStatus()
          : null,
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
        aiProvidersConfigured: buildAiStatusPayload().filter((e) => e.configured).length,
        telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      }, origin);
      return true;
    }
    if (method === "GET" && pathname === "/metrics") {
      const { getMetrics, getContentType } = await import("./metrics.mjs");
      const body = Buffer.from(await getMetrics(), "utf8");
      res.writeHead(200, {
        "Content-Type": getContentType(),
        "Content-Length": body.byteLength,
      });
      res.end(body);
      return true;
    }
    if (method === "GET" && req.url === "/ai/status") {
      json(res, 200, { ok: true, engines: buildAiStatusPayload() }, origin);
      return true;
    }

    // ── Domain route handlers ───────────────────────────────────────────────
    if (contentHandler(req, res, url, origin)) return true;
    if (await terminalHandler(req, res, url, origin)) return true;
    if (await terminalAnalyticsHandler(req, res, url, origin)) return true;
    // ── Identity IDOR guard: verify request UID matches authenticated UID ─
    if (pathname.startsWith("/identity/users")) {
      const auth = await authorizeRequest(req);
      if (!auth.authorized) {
        json(res, 403, { ok: false, error: "Not authorized." }, origin);
        return true;
      }
      // Attach authenticated UID to request for handler to compare
      req._authUid = auth.uid;
    }
    if (await identityHandler(req, res, url, origin)) return true;
    if (await onboardingHandler(req, res, url, origin)) return true;
    if (await supportHandler(req, res, url, origin)) return true;
    if (await consensusHandler(req, res, url, origin)) return true;
    if (await watchtowerHandler(req, res, url, origin)) return true;
    if (await newsHandler(req, res, url, origin)) return true;
    if (await tradeCalcHandler(req, res, url, origin)) return true;

    if (method === "GET" && pathname === "/auth/admin/options") {
      json(res, 200, {
        ok: true,
        adminMfa: typeof getAdminMfaStatus === "function"
          ? getAdminMfaStatus()
          : {
              passwordLoginEnabled: ADMIN_PASSWORD_LOGIN_ENABLED,
              totpConfigured: false,
              emailOtpEnabled: true,
            },
      }, origin);
      return true;
    }

    if (method === "POST" && pathname === "/auth/admin/email-otp/start") {
      if (typeof startAdminEmailOtp !== "function") {
        json(res, 503, { ok: false, error: "Admin email OTP service unavailable." }, origin);
        return true;
      }
      try {
        const body = await readJsonBody(req);
        const result = await startAdminEmailOtp({
          masterEmail: body.masterEmail || body.email,
          clientKey: getClientKey(req),
        });
        json(res, result.ok ? 200 : result.status || 400, result, origin);
        return true;
      } catch (e) {
        json(res, 400, { ok: false, error: e.message || "Email OTP request failed." }, origin);
        return true;
      }
    }

    if (method === "POST" && pathname === "/auth/admin/email-otp/verify") {
      if (typeof verifyAdminEmailOtp !== "function") {
        json(res, 503, { ok: false, error: "Admin email OTP service unavailable." }, origin);
        return true;
      }
      try {
        const body = await readJsonBody(req);
        const result = verifyAdminEmailOtp({
          challengeId: body.challengeId,
          codes: body.codes || {
            otp1: body.otp1,
            otp2: body.otp2,
            otp3: body.otp3,
          },
          clientKey: getClientKey(req),
        });
        if (!result.ok) {
          json(res, result.status || 401, result, origin);
          return true;
        }
        json(
          res,
          200,
          await createAdminMfaSessionPayload(req, body, result.method),
          origin,
        );
        return true;
      } catch (e) {
        json(res, 400, { ok: false, error: e.message || "Email OTP verification failed." }, origin);
        return true;
      }
    }

    if (method === "POST" && pathname === "/auth/admin/totp/verify") {
      if (typeof verifyAdminTotp !== "function") {
        json(res, 503, { ok: false, error: "Admin authenticator service unavailable." }, origin);
        return true;
      }
      try {
        const body = await readJsonBody(req);
        const result = verifyAdminTotp({
          code: body.code || body.totp || body.authenticatorCode,
        });
        if (!result.ok) {
          json(res, result.status || 401, result, origin);
          return true;
        }
        json(
          res,
          200,
          await createAdminMfaSessionPayload(req, body, result.method),
          origin,
        );
        return true;
      } catch (e) {
        json(res, 400, { ok: false, error: e.message || "Authenticator verification failed." }, origin);
        return true;
      }
    }

    // ── Admin auth: password verify ──────────────────────────────────────────
    if (method === "POST" && pathname === "/auth/admin/verify") {
      if (!ADMIN_PASSWORD_LOGIN_ENABLED) {
        json(res, 410, {
          ok: false,
          verified: false,
          error: "Admin password login is disabled. Use authenticator or email OTP.",
        }, origin);
        return true;
      }
      const ck = getClientKey(req);
      const attemptState = getAdminPasswordAttemptState(ck);
      if (attemptState.lockoutUntil && attemptState.lockoutUntil > Date.now()) {
        json(res, 429, {
          ok: false, verified: false,
          error: "Too many attempts. Try again later.",
          retryAfterMs: attemptState.lockoutUntil - Date.now(),
        }, origin);
        return true;
      }
      if (!ADMIN_PASS_HASH) {
        json(res, 503, { ok: false, verified: false, error: "Admin password not configured." }, origin);
        return true;
      }
      try {
        const body = await readJsonBody(req);
        const password = String(body.password || "");
        if (!password) {
          json(res, 400, { ok: false, verified: false, error: "Password required." }, origin);
          return true;
        }
        const isValid = constantTimeMatch(
          hashPassword(password, process.env.MASTER_SALT || ""),
          ADMIN_PASS_HASH,
        );
        if (!isValid) {
          const next = registerAdminPasswordFailedAttempt(ck, ADMIN_ATTEMPT_LIMIT, ADMIN_LOCKOUT_WINDOW_MS);
          json(res, 401, {
            ok: false, verified: false, error: "Invalid admin password.",
            attemptsRemaining: Math.max(0, ADMIN_ATTEMPT_LIMIT - next.attempts),
            retryAfterMs: next.lockoutUntil > 0 ? next.lockoutUntil - Date.now() : 0,
          }, origin);
          return true;
        }
        clearAdminPasswordFailedAttempts(ck);
        json(res, 200, { ok: true, verified: true }, origin);
        return true;
      } catch (e) {
        json(res, 400, { ok: false, verified: false, error: e.message || "Invalid request." }, origin);
        return true;
      }
    }

    // ── Admin RBAC gate ──────────────────────────────────────────────────────
    if (pathname.startsWith("/admin") && !(pathname === "/admin/session" && method === "POST")) {
      const auth = await authorizeRequest(req);
      if (!auth.authorized) {
        json(res, 403, { ok: false, error: auth.error }, origin);
        return true;
      }
    }

    // ── Admin route handler ─────────────────────────────────────────────────
    if (await adminHandler(req, res, url, origin)) return true;

    const isBoardRoomAgentReport =
      method === "POST" &&
      (pathname === "/board-room/heartbeat" || pathname === "/board-room/error");

    // Board Room management stays admin-only. Agent heartbeat/error reporters
    // are the telemetry lane used by Watchtower and the AI services.
    if (pathname.startsWith("/board-room") && !isBoardRoomAgentReport) {
      const auth = await authorizeRequest(req);
      if (!auth.authorized) {
        json(res, 403, { ok: false, error: auth.error }, origin);
        return true;
      }
    }

    // ── Board Room route handler ────────────────────────────────────────────
    if (await boardRoomHandler.handle(req, res, pathname, origin)) return true;

    // ── Admin session management ────────────────────────────────────────────
    if (method === "POST" && pathname === "/admin/session") {
      try {
        const body = await readJsonBody(req);
        const password = String(body.password || "");
        if (!ADMIN_PASSWORD_LOGIN_ENABLED) {
          json(res, 410, {
            ok: false,
            error: "Admin password login is disabled. Use authenticator or email OTP.",
          }, origin);
          return true;
        }
        if (!ADMIN_PASS_HASH) {
          json(res, 503, { ok: false, error: "Admin password not configured." }, origin);
          return true;
        }
        if (!password) {
          json(res, 400, { ok: false, error: "Password required." }, origin);
          return true;
        }
        if (!constantTimeMatch(hashPassword(password, process.env.MASTER_SALT || ""), ADMIN_PASS_HASH)) {
          json(res, 401, { ok: false, error: "Invalid admin password." }, origin);
          return true;
        }
        const ttlMs = Math.min(Number(body.ttlMs) || 8 * 3600 * 1000, 24 * 3600 * 1000);
        const device = {
          fingerprint: String(body.deviceFingerprint || "unknown"),
          browser: String(body.deviceBrowser || req.headers["user-agent"] || "Unknown").substring(0, 80),
          os: String(body.deviceOs || "unknown"),
          device: String(body.deviceType || "unknown"),
          ip: req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown",
          rememberDevice: !!body.rememberDevice,
        };
        const token = await createAdminSession(ROLES_ADMIN, ttlMs, device);
        json(res, 200, { ok: true, token, expiresInMs: ttlMs, role: ROLES_ADMIN }, origin);
        return true;
      } catch (e) {
        json(res, 400, { ok: false, error: e.message || "Session creation failed." }, origin);
        return true;
      }
    }

    if (method === "DELETE" && pathname === "/admin/session") {
      const authHdr = req.headers.authorization || "";
      if (authHdr.startsWith("Bearer ")) await revokeAdminSession(authHdr.slice(7).trim());
      json(res, 200, { ok: true, message: "Session revoked." }, origin);
      return true;
    }

    if (method === "GET" && pathname === "/admin/session") {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const result = await validateAdminToken(authHeader.slice(7).trim());
        if (result.valid) {
          json(res, 200, { ok: true, valid: true, role: result.role }, origin);
          return true;
        }
      }
      json(res, 200, { ok: true, valid: false, role: null }, origin);
      return true;
    }

    if (method === "GET" && pathname === "/admin/sessions") {
      const all = await listAdminSessions();
      json(res, 200, { ok: true, sessions: all.map(({ token: _t, ...rest }) => rest) }, origin);
      return true;
    }

    if (method === "DELETE" && pathname === "/admin/sessions") {
      try {
        const body = await readJsonBody(req);
        const { id, token: revokeToken } = body || {};
        let fullToken = revokeToken;
        if (!fullToken && id) {
          const all = await listAdminSessions();
          const m = all.find((s) => s.id === id);
          if (m) fullToken = m.token;
        }
        if (!fullToken) {
          json(res, 400, { ok: false, error: "Session id or token required." }, origin);
          return true;
        }
        const allSess = await listAdminSessions();
        if (allSess.length <= 1 && allSess[0]?.token === fullToken) {
          json(res, 400, { ok: false, error: "Cannot revoke the only active session." }, origin);
          return true;
        }
        const revoked = await revokeSessionById(fullToken);
        json(res, revoked ? 200 : 404, { ok: revoked, error: revoked ? null : "Session not found." }, origin);
        return true;
      } catch {
        json(res, 400, { ok: false, error: "Invalid request." }, origin);
        return true;
      }
    }

    // ── AI Proxy: /ai/provider-chat ─────────────────────────────────────────
    if (method === "POST" && req.url === "/ai/provider-chat") {
      try {
        const body = await readJsonBody(req, 5_000_000);
        const provider = String(body.provider || "").trim().toLowerCase();
        const systemPrompt = String(body.systemPrompt || "");
        const userPrompt = String(body.userPrompt || "");
        const userContext = resolveCollectiveConsciousnessRequest(body);
        if (!provider || !userPrompt) {
          json(res, 400, { ok: false, error: "Provider and userPrompt are required." }, origin);
          return true;
        }
        if (!userContext.uid) {
          json(res, 400, {
            ok: false,
            error: "Collective Consciousness user context is required.",
            code: "COLLECTIVE_CONSCIOUSNESS_UID_REQUIRED",
          }, origin);
          return true;
        }
        const access = consumeCollectiveConsciousnessQuestion(userContext.uid, userContext);
        if (!access.ok) {
          json(res, 429, buildCollectiveConsciousnessLimitPayload(access.usage), origin);
          return true;
        }
        const response = await invokeProvider(provider, systemPrompt, userPrompt, getOriginFallback);
        json(res, 200, {
          ok: true, provider, response,
          statuses: buildAiStatusPayload(),
          usage: access.usage,
        }, origin);
        return true;
      } catch (e) {
        json(res, 400, { ok: false, error: e.message || "AI provider request failed." }, origin);
        return true;
      }
    }

    // ── AI Deliberate: /ai/deliberate ───────────────────────────────────────
    if (method === "POST" && req.url === "/ai/deliberate") {
      try {
        const body = await readJsonBody(req, 5_000_000);
        const systemPrompt = String(body.systemPrompt || "");
        const userPrompt = String(body.userPrompt || "");
        const userContext = resolveCollectiveConsciousnessRequest(body);
        if (!userPrompt) {
          json(res, 400, { ok: false, error: "userPrompt is required." }, origin);
          return true;
        }
        if (!userContext.uid) {
          json(res, 400, {
            ok: false,
            error: "Collective Consciousness user context is required.",
            code: "COLLECTIVE_CONSCIOUSNESS_UID_REQUIRED",
          }, origin);
          return true;
        }
        const access = consumeCollectiveConsciousnessQuestion(userContext.uid, userContext);
        if (!access.ok) {
          json(res, 429, buildCollectiveConsciousnessLimitPayload(access.usage), origin);
          return true;
        }
        const order = ["groq", "gemini", "openrouter", "cerebras", "deepseek", "sambanova"];
        const failures = [];
        for (const provider of order) {
          try {
            const response = await invokeProvider(provider, systemPrompt, userPrompt, getOriginFallback);
            json(res, 200, {
              ok: true, provider, response,
              statuses: buildAiStatusPayload(),
              usage: access.usage,
            }, origin);
            return true;
          } catch (e) {
            failures.push({ provider, error: e.message || "Provider failed." });
          }
        }
        json(res, 503, {
          ok: false, error: "All AI models unavailable.", failures,
          statuses: buildAiStatusPayload(),
        }, origin);
        return true;
      } catch (e) {
        json(res, 400, { ok: false, error: e.message || "AI deliberation failed." }, origin);
        return true;
      }
    }

    // ── Telegram proxy (J01 — token removed from browser bundles) ─────────────
    if (method === "POST" && pathname.startsWith("/telegram/")) {
      if (pathname === "/telegram/send-message") { await handleTelegramSendMessage(req, res); return true; }
      if (pathname === "/telegram/send-forensic-alert") { await handleTelegramSendForensicAlert(req, res); return true; }
    }
    if (method === "POST" && req.url === "/notify/telegram") {
      await handleTelegramSendMessage(req, res);
      return true;
    }

    // ── 404 ────────────────────────────────────────────────────────────────────
    json(res, 404, { ok: false, error: "Route not found." }, origin);
    return true;
  }
}
