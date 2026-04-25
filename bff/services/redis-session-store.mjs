/**
 * Session and rate-limit store.
 *
 * Sessions use durable local file storage by default so admin access remains
 * available when Redis is down. Redis can still be forced with
 * SESSION_STORAGE_MODE=redis, while rate limiting continues to use Redis and
 * fails open if Redis is unavailable.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const REDIS_CONNECT_TIMEOUT_MS = Number.parseInt(
  process.env.REDIS_CONNECT_TIMEOUT_MS || "1000",
  10,
);
const REDIS_RETRY_COOLDOWN_MS = Number.parseInt(
  process.env.REDIS_RETRY_COOLDOWN_MS || "30000",
  10,
);
const SESSION_TTL_SECONDS = Number.parseInt(
  process.env.SESSION_TTL_SECONDS || "28800",
  10,
);
const SESSION_STORAGE_MODE = String(process.env.SESSION_STORAGE_MODE || "file")
  .trim()
  .toLowerCase();
const SESSION_FALLBACK_STORE = String(
  process.env.SESSION_FALLBACK_STORE ||
    process.env.SESSION_FILE_STORE ||
    "runtime/session-store.json",
);
const FILE_SESSION_STORE_PATH = resolve(process.cwd(), SESSION_FALLBACK_STORE);
const RATE_LIMIT_PREFIX = "ratelimit:";
const DEFAULT_SESSION_PREFIX = "session:";
export const ADMIN_SESSION_PREFIX = "admin-session:";
export const KEYCLOAK_SESSION_PREFIX = "keycloak-session:";

let redisClient = null;
let redisConnectPromise = null;
let isConnected = false;
let nextConnectAttemptAt = 0;
let lastUnavailableLogAt = 0;
let lastUnavailableMessage = null;
let fileStoreWriteChain = Promise.resolve();

function buildKey(prefix, id) {
  return `${prefix}${id}`;
}

function resolveOptions(options = {}) {
  return {
    prefix: options.prefix || DEFAULT_SESSION_PREFIX,
    ttlSeconds: Number.parseInt(
      String(options.ttlSeconds || SESSION_TTL_SECONDS),
      10,
    ),
    touch: options.touch !== false,
    userIdField: options.userIdField || "userId",
  };
}

function logRedisUnavailable(message) {
  const now = Date.now();
  if (
    lastUnavailableMessage === message &&
    now - lastUnavailableLogAt < REDIS_RETRY_COOLDOWN_MS
  ) {
    return;
  }

  lastUnavailableLogAt = now;
  lastUnavailableMessage = message;
  console.warn(
    `[Redis] Unavailable; using degraded mode until retry window: ${message}`,
  );
}

function shouldUseRedisSessions() {
  return SESSION_STORAGE_MODE === "redis" || SESSION_STORAGE_MODE === "auto";
}

function shouldUseFileSessions() {
  return SESSION_STORAGE_MODE === "file" || SESSION_STORAGE_MODE === "auto";
}

function buildEmptyFileStore() {
  return {
    version: 1,
    sessions: {},
    updatedAt: new Date().toISOString(),
  };
}

function pruneExpiredFileSessions(store, now = Date.now()) {
  let removed = 0;
  for (const [key, record] of Object.entries(store.sessions || {})) {
    if (!record || Number(record.expiresAt || 0) <= now) {
      delete store.sessions[key];
      removed += 1;
    }
  }
  return removed;
}

async function readFileSessionStore() {
  try {
    const raw = await readFile(FILE_SESSION_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return buildEmptyFileStore();
    }
    return {
      version: parsed.version || 1,
      sessions:
        parsed.sessions && typeof parsed.sessions === "object"
          ? parsed.sessions
          : {},
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return buildEmptyFileStore();
  }
}

async function writeFileSessionStore(store) {
  await mkdir(dirname(FILE_SESSION_STORE_PATH), { recursive: true });
  const tmpPath = `${FILE_SESSION_STORE_PATH}.tmp-${process.pid}`;
  const nextStore = {
    ...store,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(tmpPath, `${JSON.stringify(nextStore, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(tmpPath, FILE_SESSION_STORE_PATH);
}

async function mutateFileSessionStore(mutator) {
  fileStoreWriteChain = fileStoreWriteChain
    .catch(() => {})
    .then(async () => {
      const store = await readFileSessionStore();
      pruneExpiredFileSessions(store);
      const result = await mutator(store);
      await writeFileSessionStore(store);
      return result;
    });
  return fileStoreWriteChain;
}

async function createFileSession(sessionData, { prefix, ttlSeconds }) {
  const sessionId = randomUUID();
  const now = Date.now();
  const expiresAt = now + Math.max(1, ttlSeconds) * 1000;
  const session = {
    id: sessionId,
    ...sessionData,
    createdAt: sessionData?.createdAt || now,
    lastActiveAt: sessionData?.lastActiveAt || now,
  };

  await mutateFileSessionStore((store) => {
    store.sessions[buildKey(prefix, sessionId)] = {
      value: session,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    };
  });
  return sessionId;
}

async function getFileSession(sessionId, { prefix, ttlSeconds, touch }) {
  if (!sessionId) return null;
  const key = buildKey(prefix, sessionId);

  if (touch) {
    return mutateFileSessionStore((store) => {
      const record = store.sessions[key];
      if (!record || Number(record.expiresAt || 0) <= Date.now()) {
        delete store.sessions[key];
        return null;
      }
      const updatedSession = {
        ...record.value,
        lastActiveAt: Date.now(),
      };
      store.sessions[key] = {
        ...record,
        value: updatedSession,
        expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
        updatedAt: Date.now(),
      };
      return updatedSession;
    });
  }

  const store = await readFileSessionStore();
  const record = store.sessions[key];
  if (!record || Number(record.expiresAt || 0) <= Date.now()) {
    if (record) {
      await mutateFileSessionStore((nextStore) => {
        delete nextStore.sessions[key];
      });
    }
    return null;
  }
  return record.value || null;
}

async function updateFileSession(sessionId, updates, options) {
  const { prefix, ttlSeconds } = options;
  if (!sessionId) return false;
  const key = buildKey(prefix, sessionId);
  return mutateFileSessionStore((store) => {
    const record = store.sessions[key];
    if (!record || Number(record.expiresAt || 0) <= Date.now()) {
      delete store.sessions[key];
      return false;
    }
    const updatedSession = {
      ...record.value,
      ...updates,
      lastActiveAt: Date.now(),
    };
    store.sessions[key] = {
      ...record,
      value: updatedSession,
      expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
      updatedAt: Date.now(),
    };
    return true;
  });
}

async function deleteFileSession(sessionId, { prefix }) {
  if (!sessionId) return false;
  const key = buildKey(prefix, sessionId);
  return mutateFileSessionStore((store) => {
    const existed = Boolean(store.sessions[key]);
    delete store.sessions[key];
    return existed;
  });
}

async function listFileSessions({ prefix }) {
  const store = await readFileSessionStore();
  const now = Date.now();
  const expiredKeys = [];
  const sessions = [];
  for (const [key, record] of Object.entries(store.sessions || {})) {
    if (!key.startsWith(prefix)) continue;
    if (!record || Number(record.expiresAt || 0) <= now) {
      expiredKeys.push(key);
      continue;
    }
    if (record.value) sessions.push(record.value);
  }
  if (expiredKeys.length) {
    await mutateFileSessionStore((nextStore) => {
      for (const key of expiredKeys) delete nextStore.sessions[key];
    });
  }
  return sessions;
}

async function deleteFileUserSessions(userId, { prefix, userIdField }) {
  if (!userId) return 0;
  return mutateFileSessionStore((store) => {
    let deleted = 0;
    for (const [key, record] of Object.entries(store.sessions || {})) {
      if (
        key.startsWith(prefix) &&
        record?.value?.[userIdField] === userId
      ) {
        delete store.sessions[key];
        deleted += 1;
      }
    }
    return deleted;
  });
}

export async function getRedisClient() {
  if (redisClient?.isOpen && isConnected) {
    return redisClient;
  }

  if (Date.now() < nextConnectAttemptAt) {
    return null;
  }

  if (!redisClient) {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
        keepAlive: 5_000,
        reconnectStrategy: (retries) =>
          retries < 2 ? Math.min((retries + 1) * 100, 250) : false,
      },
    });

    redisClient.on("error", (error) => {
      logRedisUnavailable(error.message);
      isConnected = false;
    });

    redisClient.on("connect", () => {
      isConnected = true;
      nextConnectAttemptAt = 0;
      console.log("[Redis] Connected");
    });

    redisClient.on("end", () => {
      isConnected = false;
    });

    redisClient.on("reconnecting", () => {
      logRedisUnavailable("retrying Redis connection");
    });
  }

  if (!redisConnectPromise) {
    redisConnectPromise = redisClient
      .connect()
      .then(() => {
        isConnected = true;
        nextConnectAttemptAt = 0;
        return redisClient;
      })
      .catch((error) => {
        isConnected = false;
        nextConnectAttemptAt = Date.now() + REDIS_RETRY_COOLDOWN_MS;
        logRedisUnavailable(error.message);
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
  if (!shouldUseRedisSessions()) {
    return createFileSession(sessionData, { prefix, ttlSeconds });
  }

  const sessionId = randomUUID();
  const now = Date.now();
  const session = {
    id: sessionId,
    ...sessionData,
    createdAt: sessionData?.createdAt || now,
    lastActiveAt: sessionData?.lastActiveAt || now,
  };

  const client = await getRedisClient();
  if (!client) {
    return shouldUseFileSessions()
      ? createFileSession(sessionData, { prefix, ttlSeconds })
      : null;
  }

  try {
    await client.setEx(
      buildKey(prefix, sessionId),
      ttlSeconds,
      JSON.stringify(session),
    );
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
  if (!shouldUseRedisSessions()) {
    return getFileSession(sessionId, { prefix, ttlSeconds, touch });
  }

  const client = await getRedisClient();
  if (!client) {
    return shouldUseFileSessions()
      ? getFileSession(sessionId, { prefix, ttlSeconds, touch })
      : null;
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
  if (!shouldUseRedisSessions()) {
    return updateFileSession(sessionId, updates, { prefix, ttlSeconds });
  }

  const existing = await getSession(sessionId, { ...options, touch: false });
  if (!existing) {
    return false;
  }

  const client = await getRedisClient();
  if (!client) {
    return shouldUseFileSessions()
      ? updateFileSession(sessionId, updates, { prefix, ttlSeconds })
      : false;
  }

  const updatedSession = {
    ...existing,
    ...updates,
    lastActiveAt: Date.now(),
  };

  try {
    await client.setEx(
      buildKey(prefix, sessionId),
      ttlSeconds,
      JSON.stringify(updatedSession),
    );
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
  if (!shouldUseRedisSessions()) {
    return deleteFileSession(sessionId, { prefix });
  }

  const client = await getRedisClient();
  if (!client) {
    return shouldUseFileSessions()
      ? deleteFileSession(sessionId, { prefix })
      : false;
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
  if (!shouldUseRedisSessions()) {
    return listFileSessions({ prefix });
  }

  const client = await getRedisClient();
  if (!client) {
    return shouldUseFileSessions() ? listFileSessions({ prefix }) : [];
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
  if (!shouldUseRedisSessions()) {
    return deleteFileUserSessions(userId, { prefix, userIdField });
  }

  const client = await getRedisClient();
  if (!client) {
    return shouldUseFileSessions()
      ? deleteFileUserSessions(userId, { prefix, userIdField })
      : 0;
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

    await client.zAdd(redisKey, {
      score: now,
      value: `${now}:${Math.random()}`,
    });
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
