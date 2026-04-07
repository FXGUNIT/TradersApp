/**
 * Keycloak OIDC Integration Service
 * Provides Keycloak authentication and authorization for the BFF.
 *
 * Features:
 * - OIDC token validation
 * - Client credentials flow for service-to-service auth
 * - Session management
 * - MFA enforcement
 *
 * Configuration via environment variables:
 * - KEYCLOAK_URL: Keycloak server URL (e.g., http://keycloak:8080)
 * - KEYCLOAK_REALM: Realm name (e.g., tradersapp)
 * - KEYCLOAK_CLIENT_ID: Client ID for BFF
 * - KEYCLOAK_CLIENT_SECRET: Client secret
 */

import {
  KEYCLOAK_SESSION_PREFIX,
  createSession,
  deleteSession,
  deleteUserSessions,
  getSession,
  listSessions,
} from "./redis-session-store.mjs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || "http://keycloak:8080";
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || "tradersapp";
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "tradersapp-bff";
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || "";
const KEYCLOAK_TOKEN_CACHE_TTL = parseInt(process.env.KEYCLOAK_TOKEN_CACHE_TTL || "300", 10) * 1000;

// ---------------------------------------------------------------------------
// Token Cache
// ---------------------------------------------------------------------------

/** Cache for client credentials token */
let clientTokenCache = {
  accessToken: null,
  expiresAt: 0,
  refreshAt: 0,
};

/** In-flight token refresh requests */
let tokenRefreshPromise = null;

// ---------------------------------------------------------------------------
// Token Validation
// ---------------------------------------------------------------------------

/**
 * Validate an access token with Keycloak userinfo endpoint.
 * @param {string} token - Bearer token
 * @returns {Promise<object|null>} User info or null if invalid
 */
export async function validateToken(token) {
  if (!token) return null;

  try {
    const response = await fetch(
      `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        return null; // Token expired or invalid
      }
      throw new Error(`Keycloak error: ${response.status}`);
    }

    const userInfo = await response.json();
    return userInfo;
  } catch (error) {
    console.error("[Keycloak] Token validation failed:", error.message);
    return null;
  }
}

/**
 * Introspect a token (alternative to userinfo for detailed token data).
 * @param {string} token - Bearer token
 * @returns {Promise<object|null>} Introspection result
 */
export async function introspectToken(token) {
  if (!token) return null;

  try {
    const params = new URLSearchParams({
      token,
      client_id: KEYCLOAK_CLIENT_ID,
      client_secret: KEYCLOAK_CLIENT_SECRET,
    });

    const response = await fetch(
      `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token/introspect`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (!response.ok) {
      throw new Error(`Introspection failed: ${response.status}`);
    }

    const result = await response.json();
    return result.active ? result : null;
  } catch (error) {
    console.error("[Keycloak] Token introspection failed:", error.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Client Credentials Flow (Service-to-Service)
// ---------------------------------------------------------------------------

/**
 * Get an access token using client credentials flow.
 * Implements caching and automatic refresh.
 * @returns {Promise<string>} Access token
 */
export async function getClientToken() {
  const now = Date.now();

  // Return cached token if still valid
  if (
    clientTokenCache.accessToken &&
    now < clientTokenCache.refreshAt
  ) {
    return clientTokenCache.accessToken;
  }

  // If a refresh is already in progress, wait for it
  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  // Refresh the token
  tokenRefreshPromise = _fetchClientToken();
  try {
    const token = await tokenRefreshPromise;
    return token;
  } finally {
    tokenRefreshPromise = null;
  }
}

async function _fetchClientToken() {
  try {
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: KEYCLOAK_CLIENT_ID,
      client_secret: KEYCLOAK_CLIENT_SECRET,
      scope: "openid profile email roles",
    });

    const response = await fetch(
      `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (!response.ok) {
      throw new Error(`Client credentials failed: ${response.status}`);
    }

    const tokenData = await response.json();
    const now = Date.now();
    const expiresIn = tokenData.expires_in * 1000; // Convert to ms
    const refreshAt = now + (expiresIn * 0.8); // Refresh at 80% of TTL

    clientTokenCache = {
      accessToken: tokenData.access_token,
      expiresAt: now + expiresIn,
      refreshAt,
    };

    console.log(
      `[Keycloak] Client token refreshed, expires in ${Math.round(
        expiresIn / 1000
      )}s`
    );

    return tokenData.access_token;
  } catch (error) {
    console.error("[Keycloak] Failed to fetch client token:", error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Role Mapping
// ---------------------------------------------------------------------------

/** Map Keycloak realm roles to BFF roles */
const ROLE_MAP = {
  realm_admin: "ADMIN",
  realm_mentor: "MENTOR",
  realm_trader: "TRADER",
  account_admin: "ADMIN",
  account_view_profile: "TRADER",
};

/**
 * Extract roles from Keycloak token/userinfo.
 * @param {object} userInfo - User info from Keycloak
 * @returns {string[]} Array of roles
 */
export function extractRoles(userInfo) {
  const roles = new Set();

  // Realm-level roles
  if (userInfo.realm_access?.roles) {
    for (const role of userInfo.realm_access.roles) {
      const mappedRole = ROLE_MAP[`realm_${role}`] || ROLE_MAP[role];
      if (mappedRole) {
        roles.add(mappedRole);
      }
    }
  }

  // Client-level roles
  if (userInfo.resource_access?.[KEYCLOAK_CLIENT_ID]?.roles) {
    for (const role of userInfo.resource_access[KEYCLOAK_CLIENT_ID].roles) {
      const mappedRole = ROLE_MAP[role];
      if (mappedRole) {
        roles.add(mappedRole);
      }
    }
  }

  // Default to TRADER if no roles found
  if (roles.size === 0) {
    roles.add("TRADER");
  }

  return Array.from(roles);
}

/**
 * Get the highest privilege role from a role array.
 * @param {string[]} roles - Array of roles
 * @returns {string} Highest privilege role
 */
export function getHighestRole(roles) {
  const rolePriority = { ADMIN: 3, MENTOR: 2, TRADER: 1 };
  return roles.reduce((highest, role) => {
    if ((rolePriority[role] || 0) > (rolePriority[highest] || 0)) {
      return role;
    }
    return highest;
  }, "TRADER");
}

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

/**
 * Create a session from Keycloak user info.
 * @param {object} userInfo - User info from Keycloak
 * @param {object} device - Device information
 * @returns {object} Session data
 */
export async function createKeycloakSession(userInfo, device = {}) {
  const now = Date.now();

  const session = {
    keycloakSubject: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name || userInfo.preferred_username,
    roles: extractRoles(userInfo),
    highestRole: getHighestRole(extractRoles(userInfo)),
    createdAt: now,
    lastActiveAt: now,
    device: {
      browser: device.browser || "Unknown Browser",
      os: device.os || "Unknown OS",
      ip: device.ip || "unknown",
    },
  };

  const sessionId = await createSession(session, {
    prefix: KEYCLOAK_SESSION_PREFIX,
    userIdField: "keycloakSubject",
  });
  if (!sessionId) {
    return null;
  }
  return {
    id: sessionId,
    ...session,
  };
}

/**
 * Get session by session ID.
 * @param {string} sessionId - Session ID
 * @returns {object|null} Session data or null
 */
export async function getKeycloakSession(sessionId) {
  return await getSession(sessionId, {
    prefix: KEYCLOAK_SESSION_PREFIX,
  });
}

/**
 * Revoke a session.
 * @param {string} sessionId - Session ID
 */
export async function revokeKeycloakSession(sessionId) {
  await deleteSession(sessionId, { prefix: KEYCLOAK_SESSION_PREFIX });
}

/**
 * Revoke all sessions for a user.
 * @param {string} keycloakSubject - Keycloak subject ID
 */
export async function revokeAllUserSessions(keycloakSubject) {
  await deleteUserSessions(keycloakSubject, {
    prefix: KEYCLOAK_SESSION_PREFIX,
    userIdField: "keycloakSubject",
  });
}

/**
 * List all active sessions (admin only).
 * @returns {object[]} Array of session summaries
 */
export async function listKeycloakSessions() {
  const sessions = await listSessions({ prefix: KEYCLOAK_SESSION_PREFIX });
  return sessions.map((session) => ({
    id: session.id,
    email: session.email,
    name: session.name,
    roles: session.roles,
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,
    browser: session.device?.browser,
    os: session.device?.os,
    ip: session.device?.ip,
  }));
}

// ---------------------------------------------------------------------------
// MFA Check
// ---------------------------------------------------------------------------

/**
 * Check if user has MFA enabled (based on their roles).
 * ADMIN users must have MFA.
 * @param {string[]} roles - User roles
 * @returns {boolean} True if MFA is required
 */
export function isMFARequired(roles) {
  return roles.includes("ADMIN");
}

/**
 * Check if a token has MFA claim.
 * @param {object} introspection - Token introspection result
 * @returns {boolean} True if MFA was used
 */
export function hasMFAClaim(introspection) {
  // Keycloak sets acr claim for MFA
  return (
    introspection.acr &&
    parseInt(introspection.acr) > 0
  );
}

// ---------------------------------------------------------------------------
// Service-to-Service Token for ML Engine
// ---------------------------------------------------------------------------

/**
 * Create an authorization header for ML Engine requests.
 * Uses client credentials to get a service token.
 * @returns {Promise<object>} Headers object with Authorization
 */
export async function getMLEngineAuthHeaders() {
  try {
    const token = await getClientToken();
    return {
      Authorization: `Bearer ${token}`,
      "X-Service-Name": "bff",
    };
  } catch (error) {
    console.error("[Keycloak] Failed to get ML Engine auth headers:", error.message);
    return {
      "X-Service-Name": "bff",
      "X-Auth-Fallback": "true",
    };
  }
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Check Keycloak health and connectivity.
 * @returns {Promise<object>} Health status
 */
export async function checkKeycloakHealth() {
  const start = Date.now();

  try {
    const response = await fetch(
      `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${await getClientToken()}`,
        },
      }
    );

    const latency = Date.now() - start;

    if (response.ok) {
      return {
        healthy: true,
        latency,
        url: KEYCLOAK_URL,
        realm: KEYCLOAK_REALM,
      };
    }

    return {
      healthy: false,
      latency,
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Export service interface
// ---------------------------------------------------------------------------

export const keycloakService = {
  validateToken,
  introspectToken,
  getClientToken,
  extractRoles,
  getHighestRole,
  createKeycloakSession,
  getKeycloakSession,
  revokeKeycloakSession,
  revokeAllUserSessions,
  listKeycloakSessions,
  isMFARequired,
  hasMFAClaim,
  getMLEngineAuthHeaders,
  checkKeycloakHealth,
};

export default keycloakService;
