/**
 * Enhanced Security Middleware
 * Integrates Keycloak OIDC authentication with Redis-backed sessions and rate limiting.
 *
 * Features:
 * - Keycloak token validation
 * - Redis-backed distributed sessions
 * - Redis-backed distributed rate limiting
 * - RBAC with Keycloak roles
 * - MFA enforcement for admins
 */

import {
  validateToken,
  createKeycloakSession,
  getKeycloakSession,
  revokeKeycloakSession,
  getMLEngineAuthHeaders,
  isMFARequired,
  hasMFAClaim,
} from "./keycloak.mjs";

import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  checkRateLimit,
  checkRedisHealth,
} from "./redis-session-store.mjs";

import {
  ROLES,
  hasPermission,
  getRequiredRole,
  SECURITY_HEADERS,
} from "./security.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_COOKIE_NAME = "tradersapp_session";
const SESSION_HEADER_NAME = "X-Session-Id";

// ---------------------------------------------------------------------------
// Authentication Middleware
// ---------------------------------------------------------------------------

/**
 * Extract token from request.
 * Supports: Authorization header, session cookie, session header.
 * @param {object} req - Request object
 * @returns {string|null} Token or session ID
 */
function extractCredentials(req) {
  // Authorization header (Bearer token)
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return { type: "token", value: authHeader.slice(7).trim() };
  }

  // Session cookie
  const cookies = parseCookies(req.headers.cookie || "");
  if (cookies[SESSION_COOKIE_NAME]) {
    return { type: "session", value: cookies[SESSION_COOKIE_NAME] };
  }

  // Session header
  const sessionHeader = req.headers[SESSION_HEADER_NAME.toLowerCase()];
  if (sessionHeader) {
    return { type: "session", value: sessionHeader };
  }

  return null;
}

/**
 * Parse cookies from cookie header.
 * @param {string} cookieHeader - Cookie header value
 * @returns {object} Parsed cookies
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name) {
      cookies[name.trim()] = valueParts.join("=").trim();
    }
  }
  return cookies;
}

/**
 * Authentication middleware.
 * Validates tokens and sessions, attaches user info to request.
 */
export async function authenticate(req, res, next) {
  const credentials = extractCredentials(req);

  if (!credentials) {
    req.user = null;
    req.session = null;
    return next();
  }

  try {
    if (credentials.type === "token") {
      // Validate Keycloak token
      const userInfo = await validateToken(credentials.value);
      if (userInfo) {
        req.user = {
          sub: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name || userInfo.preferred_username,
          roles: userInfo.realm_access?.roles || [],
          mfaVerified: true, // Token implies MFA if required
        };
        req.session = null;
        req.authType = "keycloak";
      }
    } else if (credentials.type === "session") {
      // Validate session
      const session = await getSession(credentials.value);
      if (session) {
        req.user = {
          sub: session.keycloakSubject,
          email: session.email,
          name: session.name,
          roles: session.roles,
          mfaVerified: session.mfaVerified,
        };
        req.session = {
          id: credentials.value,
          createdAt: session.createdAt,
          lastActiveAt: session.lastActiveAt,
        };
        req.authType = "session";
      }
    }
  } catch (error) {
    console.error("[Auth] Authentication error:", error.message);
  }

  // Default to unauthenticated
  if (!req.user) {
    req.user = null;
    req.session = null;
    req.authType = null;
  }

  next();
}

/**
 * Authorization middleware.
 * Checks if user has required permissions for the route.
 */
export function authorize() {
  return (req, res, next) => {
    const pathname = new URL(req.url || "/", "http://x").pathname;
    const requiredRole = getRequiredRole(pathname);

    // Public route
    if (requiredRole === null) {
      return next();
    }

    // No user - reject
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
    }

    // Check role
    const userHighestRole = req.user.roles?.includes("ADMIN")
      ? "ADMIN"
      : req.user.roles?.includes("MENTOR")
        ? "MENTOR"
        : "TRADER";

    if (!hasPermission(userHighestRole, requiredRole)) {
      return res.status(403).json({
        error: `Insufficient permissions. Required: ${requiredRole}`,
        code: "FORBIDDEN",
      });
    }

    // MFA check for admins
    if (isMFARequired(req.user.roles) && !req.user.mfaVerified) {
      return res.status(403).json({
        error: "MFA verification required",
        code: "MFA_REQUIRED",
      });
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Rate Limiting Middleware
// ---------------------------------------------------------------------------

/**
 * Rate limiting middleware using Redis.
 * @param {object} config - Rate limit config {windowMs, maxRequests}
 * @returns {function} Middleware function
 */
export function rateLimit(config) {
  const { windowMs, maxRequests, keyPrefix = "global" } = config;

  return async (req, res, next) => {
    // Use IP as default key, user ID if authenticated
    const clientKey = req.user?.sub || req.ip || "unknown";
    const fullKey = `${keyPrefix}:${clientKey}`;

    try {
      const result = await checkRateLimit(fullKey, maxRequests, windowMs);

      // Add rate limit headers
      res.set("X-RateLimit-Limit", result.total);
      res.set("X-RateLimit-Remaining", result.remaining);
      res.set("X-RateLimit-Reset", Math.ceil(Date.now() / 1000 + result.resetMs / 1000));

      if (!result.allowed) {
        return res.status(429).json({
          error: "Rate limit exceeded",
          code: "RATE_LIMITED",
          retryAfter: Math.ceil(result.resetMs / 1000),
        });
      }

      next();
    } catch (error) {
      console.error("[RateLimit] Error:", error.message);
      // Fail open - allow request if rate limiting fails
      next();
    }
  };
}

/**
 * Get rate limit config for a route.
 * @param {string} pathname - Request path
 * @returns {object} Rate limit config
 */
export function getRouteRateLimitConfig(pathname) {
  if (pathname.startsWith("/ml/consensus") || pathname.startsWith("/ml/train")) {
    return { windowMs: 60_000, maxRequests: 10, keyPrefix: "ml" };
  }
  if (pathname.startsWith("/news/")) {
    return { windowMs: 60_000, maxRequests: 20, keyPrefix: "news" };
  }
  if (pathname.startsWith("/admin/")) {
    return { windowMs: 5 * 60_000, maxRequests: 20, keyPrefix: "admin" };
  }
  if (pathname.startsWith("/ai/")) {
    return { windowMs: 60_000, maxRequests: 30, keyPrefix: "ai" };
  }
  if (pathname === "/health" || pathname === "/ai/status") {
    return { windowMs: 60_000, maxRequests: 300, keyPrefix: "health" };
  }
  return { windowMs: 60_000, maxRequests: 100, keyPrefix: "global" };
}

// ---------------------------------------------------------------------------
// Security Headers Middleware
// ---------------------------------------------------------------------------

/**
 * Add security headers to response.
 */
export function securityHeaders() {
  return (req, res, next) => {
    // Set security headers
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      res.set(header, value);
    }

    // Additional security headers
    res.set("X-Request-Id", req.id || crypto.randomUUID());
    res.set("X-Content-Type-Options", "nosniff");

    // CORS headers for API
    res.set("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGINS || "https://tradersapp.com");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Session-Id");
    res.set("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

/**
 * Create a new session from authenticated request.
 * @param {object} req - Request with user info
 * @returns {Promise<string>} Session ID
 */
export async function createUserSession(req) {
  const sessionData = {
    keycloakSubject: req.user.sub,
    email: req.user.email,
    name: req.user.name,
    roles: req.user.roles,
    mfaVerified: req.user.mfaVerified,
    device: {
      browser: req.headers["user-agent"] || "Unknown",
      ip: req.ip,
    },
  };

  return createSession(sessionData);
}

/**
 * Set session cookie on response.
 * @param {object} res - Response object
 * @param {string} sessionId - Session ID
 */
export function setSessionCookie(res, sessionId) {
  res.set(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${sessionId}; ` +
      "HttpOnly; " +
      "Secure; " +
      "SameSite=Strict; " +
      `Max-Age=${8 * 60 * 60}; ` + // 8 hours
      "Path=/"
  );
}

/**
 * Clear session cookie.
 * @param {object} res - Response object
 */
export function clearSessionCookie(res) {
  res.set(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; ` +
      "HttpOnly; " +
      "Secure; " +
      "SameSite=Strict; " +
      "Max-Age=0; " +
      "Path=/"
  );
}

// ---------------------------------------------------------------------------
// Service Authentication
// ---------------------------------------------------------------------------

/**
 * Get headers for ML Engine requests (service-to-service auth).
 * @returns {Promise<object>} Headers object
 */
export async function getServiceAuthHeaders() {
  return getMLEngineAuthHeaders();
}

// ---------------------------------------------------------------------------
// Health & Monitoring
// ---------------------------------------------------------------------------

/**
 * Get security subsystem health.
 * @returns {Promise<object>} Health status of all security components
 */
export async function getSecurityHealth() {
  const [redisHealth] = await Promise.all([checkRedisHealth()]);

  return {
    redis: redisHealth,
    overall: redisHealth.healthy ? "healthy" : "degraded",
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const enhancedSecurity = {
  authenticate,
  authorize,
  rateLimit,
  getRouteRateLimitConfig,
  securityHeaders,
  createUserSession,
  setSessionCookie,
  clearSessionCookie,
  getServiceAuthHeaders,
  getSecurityHealth,
};

export default enhancedSecurity;
