/**
 * Redis-backed session and rate-limit store.
 *
 * No in-process session fallback is used. When Redis is unavailable:
 * - session operations fail closed
 * - rate limiting fails open
 */

import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const SESSION_TTL_SECONDS = Number.parseInt(process.env.SESSION_TTL_SECONDS || "28800", 10);
const RATE_LIMIT_PREFIX = "ratelimit:";
const DEFAULT_SESSION_PREFIX = "session:";
export const ADMIN_SESSION_PREFIX = "admin-session:";
export const KEYCLOAK_SESSION_PREFIX = "keycloak-session:";

let redisClient = null;
let redisConnectPromise = null;
let isConnected = false;

function buildKey(prefix, id) {
  return `${prefix}${id}`;
}

function resolveOptions(options = {}) {
  return {
    prefix: options.prefix || DEFAULT_SESSION_PREFIX,
    ttlSeconds: Number.parseInt(String(options.ttlSeconds || SESSION_TTL_SECONDS), 10),
    touch: options.touch !== false,
    userIdField: options.userIdField || "userId",
  };
}

export async function getRedisClient() {
  if (redisClient?.isOpen && isConnected) {
    return redisClient;
  }

  if (!redisClient) {
    redisClient = createClient({ url: REDIS_URL });

    redisClient.on("error", (error) => {
      console.error("[Redis] Client error:", error.message);
      isConnected = false;
    });

    redisClient.on("connect", () => {
      isConnected = true;
      console.log("[Redis] Connected");
    });

    redisClient.on("end", () => {
      isConnected = false;
    });

    redisClient.on("reconnecting", () => {
      console.log("[Redis] Reconnecting...");
    });
  }

  if (!redisConnectPromise) {
    redisConnectPromise = redisClient.connect()
      .then(() => {
        isConnected = true;
        return redisClient;
      })
      .catch((error) => {
        console.error("[Redis] Connection failed:", error.message);
        isConnected = false;
        return null;
      })
      .finally(() => {
        redisConnectPromise = null;
      });
  }

  return redisConnectPromise;
}

export async function createSession(sessionData, options = {}) {
  const { prefix, ttlSeconds } = resolveOptions(options);
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const session = {
    id: sessionId,
    ...sessionData,
    createdAt: sessionData?.createdAt || now,
    lastActiveAt: sessionData?.lastActiveAt || now,
  };

  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  try {
    await client.setEx(buildKey(prefix, sessionId), ttlSeconds, JSON.stringify(session));
    return sessionId;
  } catch (error) {
    console.error("[Redis] Failed to create session:", error.message);
    return null;
  }
}

export async function getSession(sessionId, options = {}) {
  if (!sessionId) {
    return null;
  }

  const { prefix, ttlSeconds, touch } = resolveOptions(options);
  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  try {
    const key = buildKey(prefix, sessionId);
    const data = await client.get(key);
    if (!data) {
      return null;
    }

    const session = JSON.parse(data);
    if (touch) {
      const updatedSession = {
        ...session,
        lastActiveAt: Date.now(),
      };
      await client.setEx(key, ttlSeconds, JSON.stringify(updatedSession));
      return updatedSession;
    }

    return session;
  } catch (error) {
    console.error("[Redis] Failed to get session:", error.message);
    return null;
  }
}

export async function updateSession(sessionId, updates, options = {}) {
  const { prefix, ttlSeconds } = resolveOptions(options);
  const existing = await getSession(sessionId, { ...options, touch: false });
  if (!existing) {
    return false;
  }

  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  const updatedSession = {
    ...existing,
    ...updates,
    lastActiveAt: Date.now(),
  };

  try {
    await client.setEx(buildKey(prefix, sessionId), ttlSeconds, JSON.stringify(updatedSession));
    return true;
  } catch (error) {
    console.error("[Redis] Failed to update session:", error.message);
    return false;
  }
}

export async function deleteSession(sessionId, options = {}) {
  if (!sessionId) {
    return false;
  }

  const { prefix } = resolveOptions(options);
  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  try {
    return (await client.del(buildKey(prefix, sessionId))) > 0;
  } catch (error) {
    console.error("[Redis] Failed to delete session:", error.message);
    return false;
  }
}

export async function listSessions(options = {}) {
  const { prefix } = resolveOptions(options);
  const client = await getRedisClient();
  if (!client) {
    return [];
  }

  try {
    const keys = await client.keys(`${prefix}*`);
    if (keys.length === 0) {
      return [];
    }

    const values = await client.mGet(keys);
    return values
      .filter(Boolean)
      .map((value) => {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    console.error("[Redis] Failed to list sessions:", error.message);
    return [];
  }
}

export async function deleteUserSessions(userId, options = {}) {
  if (!userId) {
    return 0;
  }

  const { prefix, userIdField } = resolveOptions(options);
  const client = await getRedisClient();
  if (!client) {
    return 0;
  }

  try {
    const sessions = await listSessions({ prefix });
    const matchingIds = sessions
      .filter((session) => session?.[userIdField] === userId)
      .map((session) => buildKey(prefix, session.id))
      .filter(Boolean);

    if (matchingIds.length === 0) {
      return 0;
    }

    return await client.del(matchingIds);
  } catch (error) {
    console.error("[Redis] Failed to delete user sessions:", error.message);
    return 0;
  }
}

export async function checkRateLimit(clientKey, maxRequests, windowMs) {
  const client = await getRedisClient();
  if (!client) {
    return {
      allowed: true,
      remaining: maxRequests,
      resetMs: windowMs,
      total: maxRequests,
      current: 0,
      degraded: true,
    };
  }

  const redisKey = `${RATE_LIMIT_PREFIX}${clientKey}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    await client.zRemRangeByScore(redisKey, 0, windowStart);
    const currentCount = await client.zCard(redisKey);

    if (currentCount >= maxRequests) {
      const oldest = await client.zRangeWithScores(redisKey, 0, 0);
      const oldestTs = oldest.length > 0 ? Number(oldest[0].score) : now;
      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(0, oldestTs + windowMs - now),
        total: maxRequests,
        current: currentCount,
      };
    }

    await client.zAdd(redisKey, { score: now, value: `${now}:${Math.random()}` });
    await client.expire(redisKey, Math.ceil(windowMs / 1000) + 1);

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - currentCount - 1),
      resetMs: windowMs,
      total: maxRequests,
      current: currentCount + 1,
    };
  } catch (error) {
    console.error("[Redis] Rate limit check failed:", error.message);
    return {
      allowed: true,
      remaining: maxRequests,
      resetMs: windowMs,
      total: maxRequests,
      current: 0,
      degraded: true,
    };
  }
}

export async function getRateLimitStatus(clientKey, maxRequests, windowMs) {
  const client = await getRedisClient();
  if (!client) {
    return {
      remaining: maxRequests,
      total: maxRequests,
      current: 0,
      resetMs: windowMs,
      degraded: true,
    };
  }

  const redisKey = `${RATE_LIMIT_PREFIX}${clientKey}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    await client.zRemRangeByScore(redisKey, 0, windowStart);
    const count = await client.zCard(redisKey);
    return {
      remaining: Math.max(0, maxRequests - count),
      total: maxRequests,
      current: count,
      resetMs: windowMs,
    };
  } catch (error) {
    console.error("[Redis] Rate limit status failed:", error.message);
    return {
      remaining: maxRequests,
      total: maxRequests,
      current: 0,
      resetMs: windowMs,
      degraded: true,
    };
  }
}

export function cleanupExpiredSessions() {
  // Redis TTL handles expiry automatically. Kept for compatibility.
}

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
    return {
      healthy: true,
      latency: Date.now() - start,
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

export const sessionStore = {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  listSessions,
  deleteUserSessions,
  checkRateLimit,
  getRateLimitStatus,
  cleanupExpiredSessions,
  checkRedisHealth,
};

export default sessionStore;
