/**
 * BFF — HTTP Request Dispatcher
 * Extracted from server.mjs (Rule #3 hard limit: JS ≤500 lines)
 *
 * Middleware: request ID, CORS, rate limiting, event wiring.
 * Route dispatch delegated to _dispatchRoutes.mjs.
 */
import { registerDispatchRoutes } from "./_dispatchRoutes.mjs";
import { createIpSafeZoneMiddleware } from "./middleware/ipSafeZone.mjs";

export function createDispatcher({
  // Constants
  HOST,
  PORT,
  ADMIN_PASS_HASH,
  ADMIN_PASSWORD_LOGIN_ENABLED = false,
  ALLOWED_ORIGINS,
  ADMIN_ATTEMPT_LIMIT,
  ADMIN_LOCKOUT_WINDOW_MS,
  SAFE_ZONE_IPV4 = "",
  SAFE_ZONE_CITY = "",
  SAFE_ZONE_PIN_CODES = "",
  // Utilities
  json,
  resolveOrigin,
  readJsonBody,
  getClientKey,
  hashPassword,
  constantTimeMatch,
  invokeProvider,
  sendTelegramMessage,
  buildAiStatusPayload,
  getOriginFallback,
  getProviderConfig,
  recordHttpRequest,
  randomUUID,
  // Security
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
  // AI
  createTerminalAnalyticsService,
  // Domain state
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
  // Route factories
  createAdminRouteHandler,
  createAdminMfaRouteHandler,
  createContentRouteHandler,
  createConsensusRouteHandler,
  createWatchtowerRouteHandler,
  createNewsRouteHandler,
  createTradeCalcRouteHandler,
  createIdentityRouteHandler,
  createTerminalAnalyticsRouteHandler,
  createTerminalRouteHandler,
  createOnboardingRouteHandler,
  createSupportRouteHandler,
  createBoardRoomRouteHandler,
  // Telegram proxy handlers (J01 — token removed from browser bundles)
  handleTelegramSendMessage,
  handleTelegramSendForensicAlert,
}) {
  // Pre-build route handlers (domain delegation)
  const _invokeTerminalAnalyticsChat = createTerminalAnalyticsService
    ? createTerminalAnalyticsService({
        getProviderConfig,
        safeErrorMessage: null,
      }).invokeTerminalAnalyticsChat
    : null;

  const contentHandler = createContentRouteHandler({
    getHubContent,
    getDocumentMeta,
    listDocumentMeta,
    json,
  });
  const terminalHandler = createTerminalRouteHandler({
    getWorkspace,
    replaceWorkspaceAccountState,
    replaceWorkspaceFirmRules,
    replaceWorkspaceJournal,
    upsertWorkspace,
    readJsonBody,
    json,
  });
  const terminalAnalyticsHandler = createTerminalAnalyticsRouteHandler({
    invokeTerminalAnalyticsChat: _invokeTerminalAnalyticsChat,
    json,
    readJsonBody,
  });
  const identityHandler = createIdentityRouteHandler({
    deleteSession,
    findUserByEmail,
    getUserByUid,
    getUserStatus,
    getMaintenanceState,
    listTrainingEligibilityUsers,
    listSessions,
    patchUserAccess,
    patchUserSecurity,
    provisionUser,
    recordUserActiveDay,
    resolveClientPolicy,
    revokeOtherSessions,
    upsertSession,
    readJsonBody,
    json,
  });
  const onboardingHandler = createOnboardingRouteHandler({
    getApplication,
    getApplicationStatus,
    mergeApplicationConsent,
    upsertApplication,
    readJsonBody,
    json,
  });
  const supportHandler = createSupportRouteHandler({
    appendSupportMessage,
    getSupportThread,
    listSupportThreads,
    json,
    readJsonBody,
  });
  const consensusHandler = createConsensusRouteHandler({ json, readJsonBody });
  const watchtowerHandler =
    typeof createWatchtowerRouteHandler === "function"
      ? createWatchtowerRouteHandler({ authorizeRequest, json })
      : async () => false;
  const newsHandler = createNewsRouteHandler({ json });
  const tradeCalcHandler = createTradeCalcRouteHandler({ json, readJsonBody });
  const adminHandler = createAdminRouteHandler({
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
  const adminMfaHandler =
    typeof createAdminMfaRouteHandler === "function"
      ? createAdminMfaRouteHandler({
          createAdminSession,
          getAdminMfaStatus,
          getAdminTotpSetup,
          getClientKey,
          json,
          readJsonBody,
          rolesAdmin: ROLES_ADMIN,
          startAdminEmailOtp,
          verifyAdminEmailOtp,
          verifyAdminTotp,
        })
      : async () => false;

  const boardRoomHandler =
    typeof createBoardRoomRouteHandler === "function"
      ? createBoardRoomRouteHandler()
      : { handle: async () => false };

  // Wire all route registrations into a single dispatch function
  const dispatchRoutes = registerDispatchRoutes({
    json,
    readJsonBody,
    getClientKey,
    hashPassword,
    constantTimeMatch,
    invokeProvider,
    getOriginFallback,
    buildAiStatusPayload,
    randomUUID,
    authorizeRequest,
    validateAdminToken,
    createAdminSession,
    getAdminMfaStatus,
    startAdminEmailOtp,
    verifyAdminEmailOtp,
    verifyAdminTotp,
    revokeAdminSession,
    listAdminSessions,
    revokeSessionById,
    getAdminPasswordAttemptState,
    registerAdminPasswordFailedAttempt,
    clearAdminPasswordFailedAttempts,
    consumeCollectiveConsciousnessQuestion,
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
    adminMfaHandler,
    adminHandler,
    boardRoomHandler,
    ipSafeZone: createIpSafeZoneMiddleware({
      allowedIps: SAFE_ZONE_IPV4 ? [SAFE_ZONE_IPV4] : [],
      allowedCity: SAFE_ZONE_CITY,
      allowedPinCodes: SAFE_ZONE_PIN_CODES
        ? SAFE_ZONE_PIN_CODES.split(",").map((p) => p.trim())
        : [],
    }),
    ADMIN_PASS_HASH,
    ADMIN_PASSWORD_LOGIN_ENABLED,
    ALLOWED_ORIGINS,
    get ROLES_ADMIN() { return ROLES_ADMIN; },
    ADMIN_ATTEMPT_LIMIT,
    ADMIN_LOCKOUT_WINDOW_MS,
    handleTelegramSendMessage,
    handleTelegramSendForensicAlert,
  });

  return async function dispatcher(req, res) {
    const requestStartedAt = Date.now();
    const requestId = String(req.headers["x-request-id"] || randomUUID());
    req.id = requestId;
    req.requestId = requestId;
    if (!req.headers["x-request-id"]) req.headers["x-request-id"] = requestId;
    res.setHeader("X-Request-ID", requestId);
    const origin = resolveOrigin(req, ALLOWED_ORIGINS);
    const baseHost = (req.headers.host && !req.headers.host.includes('*'))
      ? req.headers.host
      : `${HOST}:${PORT}`;
    const url = new URL(req.url || "/", `http://${baseHost}`);
    const pathname = url.pathname;
    const method = req.method || "GET";

    // Event wiring: record HTTP request on finish (skip /metrics — already metrics-format)
    if (pathname !== "/metrics") {
      res.once("finish", () => {
        recordHttpRequest(
          method,
          pathname,
          res.statusCode || 500,
          (Date.now() - requestStartedAt) / 1000,
        );
      });
    }

    // CORS preflight
    if (method === "OPTIONS") {
      json(res, 204, {}, origin);
      return;
    }

    // Probe paths — always return 200 with simple {ok:true}
    const isProbePath =
      pathname === "/health" || pathname === "/live" || pathname === "/ready";
    if (isProbePath) {
      json(res, 200, { ok: true }, origin);
      return;
    }

    // Rate limiting (skip probe paths and /metrics)
    if (pathname !== "/metrics") {
      const rateLimit = getRateLimitConfig(pathname);
      const clientKey = `${rateLimit.name}:${getClientKey(req)}`;
      const result = await checkRateLimit(
        clientKey,
        rateLimit.maxRequests,
        rateLimit.windowMs,
      );
      res.setHeader("X-RateLimit-Remaining", String(result.remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(result.resetMs / 1000)));
      if (!result.allowed) {
        res.setHeader("Retry-After", String(Math.ceil(result.resetMs / 1000)));
        json(res, 429, { ok: false, error: "Rate limit exceeded.", retryAfterMs: result.resetMs }, origin);
        return;
      }
    }

    // Delegate route dispatch to _dispatchRoutes.mjs
    await dispatchRoutes(req, res, url, pathname, method, origin);
  };
}

let ROLES_ADMIN;
export function setRolesAdmin(val) {
  ROLES_ADMIN = val;
}
