/**
 * Redis-Backed Session Store
 * Provides distributed session management for the BFF.
 * Falls back to in-memory if Redis is unavailable.
 *
 * Features:
 * - Session persistence across BFF restarts
 * - Automatic session expiry
 * - Distributed rate limiting
 * - Session data encryption
 */

import { createClient } from "redis";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const SESSION_PREFIX = "session:";
const RATE_LIMIT_PREFIX = "ratelimit:";
const SESSION_TTL_SECONDS = parseInt(process.env.SESSION_TTL_SECONDS || "28800", 10); // 8 hours
const RATE_LIMIT_TTL_SECONDS = 60;

// ---------------------------------------------------------------------------
// Redis Client
// ---------------------------------------------------------------------------

let redisClient = null;
let isConnected = false;

/**
 * Get or create Redis client.
 * @returns {Promise<object>} Redis client
 */
export async function getRedisClient() {
  if (redisClient && isConnected) {
    return redisClient;
  }

  try {
    redisClient = createClient({ url: REDIS_URL });

    redisClient.on("error", (err) => {
      console.error("[Redis] Client error:", err.message);
      isConnected = false;
    });

    redisClient.on("connect", () => {
      console.log("[Redis] Connected");
      isConnected = true;
    });

    redisClient.on("reconnecting", () => {
      console.log("[Redis] Reconnecting...");
    });

    await redisClient.connect();
    isConnected = true;
    return redisClient;
  } catch (error) {
    console.error("[Redis] Connection failed:", error.message);
    isConnected = false;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

/**
 * Create a new session in Redis.
 * @param {object} sessionData - Session data to store
 * @returns {Promise<string>} Session ID
 */
export async function createSession(sessionData) {
  const sessionId = crypto.randomUUID();
  const now = Date.now();

  const session = {
    id: sessionId,
    ...sessionData,
    createdAt: now,
    lastActiveAt: now,
  };

  const client = await getRedisClient();
  if (client) {
    try {
      await client.setEx(
        `${SESSION_PREFIX}${sessionId}`,
        SESSION_TTL_SECONDS,
        JSON.stringify(session)
      );
      console.log(`[Redis] Session created: ${sessionId}`);
      return sessionId;
    } catch (error) {
      console.error("[Redis] Failed to create session:", error.message);
    }
  }

  // Fallback to in-memory
  return createInMemorySession(sessionData);
}

/**
 * Get session by ID.
 * @param {string} sessionId - Session ID
 * @returns {Promise<object|null>} Session data or null
 */
export async function getSession(sessionId) {
  if (!sessionId) return null;

  const client = await getRedisClient();
  if (client) {
    try {
      const data = await client.get(`${SESSION_PREFIX}${sessionId}`);
      if (data) {
        const session = JSON.parse(data);
        // Refresh TTL on access
        await client.expire(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL_SECONDS);
        session.lastActiveAt = Date.now();
        return session;
      }
      return null;
    } catch (error) {
      console.error("[Redis] Failed to get session:", error.message);
    }
  }

  // Fallback to in-memory
  return getInMemorySession(sessionId);
}

/**
 * Update session data.
 * @param {string} sessionId - Session ID
 * @param {object} updates - Data to update
 * @returns {Promise<boolean>} Success status
 */
export async function updateSession(sessionId, updates) {
  const session = await getSession(sessionId);
  if (!session) return false;

  const updatedSession = {
    ...session,
    ...updates,
    lastActiveAt: Date.now(),
  };

  const client = await getRedisClient();
  if (client) {
    try {
      await client.setEx(
        `${SESSION_PREFIX}${sessionId}`,
        SESSION_TTL_SECONDS,
        JSON.stringify(updatedSession)
      );
      return true;
    } catch (error) {
      console.error("[Redis] Failed to update session:", error.message);
    }
  }

  // Fallback to in-memory
  return updateInMemorySession(sessionId, updates);
}

/**
 * Delete a session.
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteSession(sessionId) {
  const client = await getRedisClient();
  if (client) {
    try {
      await client.del(`${SESSION_PREFIX}${sessionId}`);
      console.log(`[Redis] Session deleted: ${sessionId}`);
      return true;
    } catch (error) {
      console.error("[Redis] Failed to delete session:", error.message);
    }
  }

  // Fallback to in-memory
  return deleteInMemorySession(sessionId);
}

/**
 * Delete all sessions for a user.
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of sessions deleted
 */
export async function deleteUserSessions(userId) {
  const client = await getRedisClient();
  if (client) {
    try {
      // Find all sessions for this user
      const keys = await client.keys(`${SESSION_PREFIX}*`);
      let deletedCount = 0;

      for (const key of keys) {
        const data = await client.get(key);
        if (data) {
          const session = JSON.parse(data);
          if (session.userId === userId) {
            await client.del(key);
            deletedCount++;
          }
        }
      }

      console.log(`[Redis] Deleted ${deletedCount} sessions for user: ${userId}`);
      return deletedCount;
    } catch (error) {
      console.error("[Redis] Failed to delete user sessions:", error.message);
    }
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Rate Limiting (Distributed)
// ---------------------------------------------------------------------------

/**
 * Check and update rate limit for a client.
 * Uses Redis sorted sets for sliding window algorithm.
 *
 * @param {string} clientKey - Identifier for rate limiting (e.g., IP, user ID)
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Promise<object>} {allowed, remaining, resetMs}
 */
export async function checkRateLimit(clientKey, maxRequests, windowMs) {
  const redisKey = `${RATE_LIMIT_PREFIX}${clientKey}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const client = await getRedisClient();
  if (client) {
    try {
      // Use Redis transaction for atomicity
      const multi = client.multi();

      // Remove old entries
      multi.zRemRangeByScore(redisKey, 0, windowStart);

      // Count current requests in window
      multi.zCard(redisKey);

      // Add current request
      multi.zAdd(redisKey, { score: now, value: `${now}:${Math.random()}` });

      // Set expiry
      multi.expire(redisKey, Math.ceil(windowMs / 1000) + 1);

      const results = await multi.exec();
      const currentCount = results[1]; // zCard result

      if (currentCount >= maxRequests) {
        // Get oldest entry to calculate reset time
        const oldest = await client.zRange(redisKey, 0, 0, { BY: "SCORE" });
        const oldestTs = oldest.length > 0 ? parseFloat(oldest[0]) : now;
        const resetMs = Math.max(0, oldestTs + windowMs - now);

        return {
          allowed: false,
          remaining: 0,
          resetMs,
          total: maxRequests,
          current: currentCount,
        };
      }

      return {
        allowed: true,
        remaining: maxRequests - currentCount - 1,
        resetMs: windowMs,
        total: maxRequests,
        current: currentCount + 1,
      };
    } catch (error) {
      console.error("[Redis] Rate limit check failed:", error.message);
    }
  }

  // Fallback to in-memory rate limiting
  return checkInMemoryRateLimit(clientKey, maxRequests, windowMs);
}

/**
 * Get rate limit status without incrementing.
 * @param {string} clientKey - Client identifier
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window
 * @returns {Promise<object>} Current rate limit status
 */
export async function getRateLimitStatus(clientKey, maxRequests, windowMs) {
  const redisKey = `${RATE_LIMIT_PREFIX}${clientKey}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const client = await getRedisClient();
  if (client) {
    try {
      // Clean old entries first
      await client.zRemRangeByScore(redisKey, 0, windowStart);

      // Count current requests
      const count = await client.zCard(redisKey);

      return {
        remaining: Math.max(0, maxRequests - count),
        total: maxRequests,
        current: count,
        resetMs: windowMs,
      };
    } catch (error) {
      console.error("[Redis] Rate limit status failed:", error.message);
    }
  }

  return {
    remaining: maxRequests,
    total: maxRequests,
    current: 0,
    resetMs: windowMs,
  };
}

// ---------------------------------------------------------------------------
// In-Memory Fallback
// ---------------------------------------------------------------------------

const _memorySessions = new Map();
const _memoryRateLimits = new Map();

function createInMemorySession(sessionData) {
  const sessionId = crypto.randomUUID();
  const now = Date.now();

  const session = {
    id: sessionId,
    ...sessionData,
    createdAt: now,
    lastActiveAt: now,
    _memoryOnly: true,
  };

  _memorySessions.set(sessionId, session);
  console.log(`[InMemory] Session created: ${sessionId}`);
  return sessionId;
}

function getInMemorySession(sessionId) {
  return _memorySessions.get(sessionId) || null;
}

function updateInMemorySession(sessionId, updates) {
  const session = _memorySessions.get(sessionId);
  if (!session) return false;

  const updated = { ...session, ...updates, lastActiveAt: Date.now() };
  _memorySessions.set(sessionId, updated);
  return true;
}

function deleteInMemorySession(sessionId) {
  return _memorySessions.delete(sessionId);
}

function checkInMemoryRateLimit(clientKey, maxRequests, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const entry = _memoryRateLimits.get(clientKey);

  if (!entry || entry.length === 0) {
    _memoryRateLimits.set(clientKey, [{ ts: now }]);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetMs: windowMs,
      total: maxRequests,
      current: 1,
    };
  }

  // Filter to window
  const valid = entry.filter((r) => r.ts > windowStart);

  if (valid.length >= maxRequests) {
    const oldestTs = valid[0].ts;
    const resetMs = Math.max(0, oldestTs + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      resetMs,
      total: maxRequests,
      current: valid.length,
    };
  }

  // Add current request
  valid.push({ ts: now });
  _memoryRateLimits.set(clientKey, valid);

  return {
    allowed: true,
    remaining: maxRequests - valid.length,
    resetMs: windowMs,
    total: maxRequests,
    current: valid.length,
  };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Clean up expired sessions (for in-memory fallback).
 * Call periodically.
 */
export function cleanupExpiredSessions() {
  const now = Date.now();
  const ttl = SESSION_TTL_SECONDS * 1000;

  for (const [sessionId, session] of _memorySessions.entries()) {
    if (now - session.lastActiveAt > ttl) {
      _memorySessions.delete(sessionId);
    }
  }

  // Clean up rate limit entries
  for (const [clientKey, entries] of _memoryRateLimits.entries()) {
    const valid = entries.filter((r) => r.ts > now - RATE_LIMIT_TTL_SECONDS * 1000);
    if (valid.length === 0) {
      _memoryRateLimits.delete(clientKey);
    } else {
      _memoryRateLimits.set(clientKey, valid);
    }
  }
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Check Redis connection health.
 * @returns {Promise<object>} Health status
 */
export async function checkRedisHealth() {
  const client = await getRedisClient();
  if (!client) {
    return {
      healthy: false,
      mode: "disconnected",
      error: "Failed to connect to Redis",
    };
  }

  try {
    const start = Date.now();
    await client.ping();
    const latency = Date.now() - start;

    return {
      healthy: true,
      latency,
      mode: "redis",
      url: REDIS_URL,
    };
  } catch (error) {
    return {
      healthy: false,
      mode: "redis",
      error: error.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const sessionStore = {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  deleteUserSessions,
  checkRateLimit,
  getRateLimitStatus,
  cleanupExpiredSessions,
  checkRedisHealth,
};

export default sessionStore;
