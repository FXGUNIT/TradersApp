/**
 * BFF Security Middleware — Native Node.js implementation.
 * No external npm packages required.
 *
 * Provides:
 * - Security headers (CSP, HSTS, X-Frame, etc.)
 * - Per-IP rate limiting (sliding window, in-memory)
 * - Role-Based Access Control (RBAC)
 * - Admin session token management
 */

// ---------------------------------------------------------------------------
// Security headers — injected on every response
// ---------------------------------------------------------------------------

/** Headers set on every response for defense-in-depth. */
export const SECURITY_HEADERS = {
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",
  // Prevent clickjacking
  "X-Frame-Options": "DENY",
  // XSS filter (legacy browsers)
  "X-XSS-Protection": "1; mode=block",
  // Referrer policy
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Disable caching of sensitive responses
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
  // Permissions policy (disable unnecessary browser features)
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

/** Strict CSP for API-only responses (no browser execution expected). */
export const CSP_HEADER = [
  "default-src 'none'",
  "script-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function addSecurityHeaders(headers) {
  headers["X-Content-Type-Options"] = SECURITY_HEADERS["X-Content-Type-Options"];
  headers["X-Frame-Options"] = SECURITY_HEADERS["X-Frame-Options"];
  headers["X-XSS-Protection"] = SECURITY_HEADERS["X-XSS-Protection"];
  headers["Referrer-Policy"] = SECURITY_HEADERS["Referrer-Policy"];
  headers["Permissions-Policy"] = SECURITY_HEADERS["Permissions-Policy"];
  headers["Content-Security-Policy"] = CSP_HEADER;
}

// ---------------------------------------------------------------------------
// Rate Limiter — sliding window, in-memory
// ---------------------------------------------------------------------------

export class RateLimiter {
  /**
   * @param {object} options
   * @param {number} options.windowMs    — time window in milliseconds
   * @param {number} options.maxRequests — max requests per window
   * @param {string} options.name       — identifier for logging
   */
  constructor({ windowMs, maxRequests, name = "default" }) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.name = name;
    // Map of clientKey → [{timestamp, count}]
    this._store = new Map();
    // Cleanup interval: evict stale entries every windowMs
    this._cleanupTimer = setInterval(() => this._cleanup(), windowMs);
    // Don't block event loop
    this._cleanupTimer.unref();
  }

  /** Check if a request from `clientKey` is allowed. Returns {allowed, remaining, resetMs}. */
  check(clientKey) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const entry = this._store.get(clientKey);

    if (!entry || entry.length === 0) {
      this._store.set(clientKey, [{ ts: now, count: 1 }]);
      return { allowed: true, remaining: this.maxRequests - 1, resetMs: this.windowMs };
    }

    // Filter to requests within current window
    const valid = entry.filter((r) => r.ts > windowStart);

    if (valid.length === 0) {
      // All expired — start fresh
      this._store.set(clientKey, [{ ts: now, count: 1 }]);
      return { allowed: true, remaining: this.maxRequests - 1, resetMs: this.windowMs };
    }

    const totalCount = valid.reduce((sum, r) => sum + r.count, 0);

    if (totalCount >= this.maxRequests) {
      const oldestTs = valid[0].ts;
      const resetMs = Math.max(0, oldestTs + this.windowMs - now);
      return { allowed: false, remaining: 0, resetMs };
    }

    // Add current request
    valid.push({ ts: now, count: 1 });
    this._store.set(clientKey, valid);

    return { allowed: true, remaining: this.maxRequests - totalCount - 1, resetMs: this.windowMs };
  }

  /** Remove expired entries from all clients. */
  _cleanup() {
    const windowStart = Date.now() - this.windowMs;
    for (const [key, entries] of this._store.entries()) {
      const valid = entries.filter((r) => r.ts > windowStart);
      if (valid.length === 0) {
        this._store.delete(key);
      } else {
        this._store.set(key, valid);
      }
    }
  }

  /** Stop cleanup timer (for graceful shutdown). */
  destroy() {
    clearInterval(this._cleanupTimer);
    this._store.clear();
  }
}

// ---------------------------------------------------------------------------
// RBAC — Role-Based Access Control
// ---------------------------------------------------------------------------

export const ROLES = {
  /** Standard trader: read/write own trades, journal, ML signals */
  TRADER: "TRADER",
  /** Mentor: view anonymized stats of other traders */
  MENTOR: "MENTOR",
  /** Admin: full access including user management */
  ADMIN: "ADMIN",
};

/** Role hierarchy — higher index = more permissions */
const ROLE_RANK = {
  [ROLES.TRADER]: 0,
  [ROLES.MENTOR]: 1,
  [ROLES.ADMIN]: 2,
};

/** Route → required role (null = any authenticated or public) */
export const ROUTE_PERMISSIONS = {
  // Public read-only endpoints (no auth needed)
  "/health": null,
  "/ai/status": null,
  "/content": null,       // GET /content/* — public read-only
  "/news/upcoming": null,
  "/news/countdown": null,
  "/ml/health": null,
  "/ml/status": null,

  // ML endpoints — open (ML engine handles its own auth)
  "/ml/consensus": null,
  "/ml/train": null,

  // Terminal read endpoints — any role
  "/terminal": null,

  // Identity (registration, session management)
  "/identity": null,

  // Onboarding
  "/onboarding": null,

  // Support threads
  "/support": null,

  // Admin-only routes (require ADMIN role)
  "/admin/verify-password": ROLES.ADMIN,
  "/admin/": ROLES.ADMIN,
  "/terminal/admin": ROLES.ADMIN,
  "/admin": ROLES.ADMIN,

  // Default: any authenticated user
  null: ROLES.TRADER,
};

/** Map of valid admin sessions: token → {role, createdAt, expiresAt} */
const _adminSessions = new Map();

/** Generate a cryptographically random session token. */
function _generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create an admin session and return the token.
 * Token expires after ADMIN_SESSION_TTL_MS.
 */
export function createAdminSession(role = ROLES.ADMIN, ttlMs = 8 * 60 * 60 * 1000) {
  const token = _generateToken();
  _adminSessions.set(token, {
    role,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  });
  return token;
}

/**
 * Validate an admin token. Returns {valid, role} or {valid: false}.
 */
export function validateAdminToken(token) {
  if (!token) return { valid: false };

  const session = _adminSessions.get(token);
  if (!session) return { valid: false };
  if (Date.now() > session.expiresAt) {
    _adminSessions.delete(token);
    return { valid: false };
  }
  return { valid: true, role: session.role };
}

/** Revoke an admin session. */
export function revokeAdminSession(token) {
  _adminSessions.delete(token);
}

/** Clean up expired sessions (call periodically). */
export function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of _adminSessions.entries()) {
    if (now > session.expiresAt) {
      _adminSessions.delete(token);
    }
  }
}

/** Check if `grantedRole` satisfies `requiredRole`. */
export function hasPermission(grantedRole, requiredRole) {
  if (requiredRole === null) return true;  // Public
  if (!grantedRole) return false;
  return ROLE_RANK[grantedRole] >= ROLE_RANK[requiredRole];
}

/**
 * Determine the required role for a request path.
 * Returns null (public) or a ROLES constant.
 */
export function getRequiredRole(pathname) {
  // Exact match first
  if (ROUTE_PERMISSIONS[pathname] !== undefined) {
    return ROUTE_PERMISSIONS[pathname];
  }
  // Prefix match for nested paths (e.g., /admin/xyz → /admin/)
  for (const route of Object.keys(ROUTE_PERMISSIONS)) {
    if (route && pathname.startsWith(route)) {
      return ROUTE_PERMISSIONS[route];
    }
  }
  return ROUTE_PERMISSIONS[null]; // Default: TRADER
}

/**
 * Authenticate a request using Bearer token or admin password session.
 * Returns {authenticated: bool, role: string|null}.
 */
export function authenticateRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || "";

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const result = validateAdminToken(token);
    if (result.valid) {
      return { authenticated: true, role: result.role };
    }
  }

  // No valid bearer token — treat as unauthenticated
  return { authenticated: false, role: null };
}

/**
 * Authorize a request: check that the request's role satisfies the route requirement.
 * Returns {authorized: bool, error: string|null}.
 */
export function authorizeRequest(req) {
  const pathname = new URL(req.url || "/", "http://x").pathname;
  const requiredRole = getRequiredRole(pathname);
  const { authenticated, role } = authenticateRequest(req);

  if (requiredRole === null) {
    return { authorized: true, role: role || ROLES.TRADER };
  }

  if (!authenticated) {
    return { authorized: false, error: "Authentication required." };
  }

  if (!hasPermission(role, requiredRole)) {
    return { authorized: false, error: `Insufficient permissions. Required: ${requiredRole}` };
  }

  return { authorized: true, role };
}

// ---------------------------------------------------------------------------
// Rate limit configurations per endpoint class
// ---------------------------------------------------------------------------

export const RATE_LIMIT_CONFIGS = {
  /** Global: 100 requests / 60 seconds per IP */
  global: { windowMs: 60_000, maxRequests: 100 },

  /** Expensive ML predictions: 10 / minute per IP */
  mlPredict: { windowMs: 60_000, maxRequests: 10 },

  /** News polling: 20 / minute per IP */
  news: { windowMs: 60_000, maxRequests: 20 },

  /** Admin auth: 20 / 5 minutes per IP (strict) */
  admin: { windowMs: 5 * 60_000, maxRequests: 20 },

  /** AI chat: 30 / minute per IP */
  aiChat: { windowMs: 60_000, maxRequests: 30 },

  /** Terminal writes: 60 / minute per IP */
  terminalWrite: { windowMs: 60_000, maxRequests: 60 },

  /** Health/status: 300 / minute per IP (cheap) */
  health: { windowMs: 60_000, maxRequests: 300 },
};

/** Determine rate limit config based on request path. */
export function getRateLimitConfig(pathname) {
  if (pathname.startsWith("/ml/consensus") || pathname.startsWith("/ml/train")) {
    return RATE_LIMIT_CONFIGS.mlPredict;
  }
  if (pathname.startsWith("/news/")) {
    return RATE_LIMIT_CONFIGS.news;
  }
  if (pathname.startsWith("/admin/")) {
    return RATE_LIMIT_CONFIGS.admin;
  }
  if (pathname.startsWith("/ai/")) {
    return RATE_LIMIT_CONFIGS.aiChat;
  }
  if (pathname === "/health" || pathname === "/ai/status") {
    return RATE_LIMIT_CONFIGS.health;
  }
  return RATE_LIMIT_CONFIGS.global;
}
