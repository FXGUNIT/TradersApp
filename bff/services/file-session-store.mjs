import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SESSION_FALLBACK_STORE = String(
  process.env.SESSION_FALLBACK_STORE ||
    process.env.SESSION_FILE_STORE ||
    "runtime/session-store.json",
);
const FILE_SESSION_STORE_PATH = resolve(process.cwd(), SESSION_FALLBACK_STORE);

let fileStoreWriteChain = Promise.resolve();

function buildKey(prefix, id) {
  return `${prefix}${id}`;
}

function buildEmptyFileStore() {
  return {
    version: 1,
    sessions: {},
    updatedAt: new Date().toISOString(),
  };
}

function pruneExpiredFileSessions(store, now = Date.now()) {
  for (const [key, record] of Object.entries(store.sessions || {})) {
    if (!record || Number(record.expiresAt || 0) <= now) {
      delete store.sessions[key];
    }
  }
}

async function readFileSessionStore() {
  try {
    const raw = await readFile(FILE_SESSION_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return buildEmptyFileStore();
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
  await writeFile(
    tmpPath,
    `${JSON.stringify(
      { ...store, version: 1, updatedAt: new Date().toISOString() },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
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

export async function createFileSession(sessionData, { prefix, ttlSeconds }) {
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

export async function getFileSession(sessionId, { prefix, ttlSeconds, touch }) {
  if (!sessionId) return null;
  const key = buildKey(prefix, sessionId);

  if (touch) {
    return mutateFileSessionStore((store) => {
      const record = store.sessions[key];
      if (!record || Number(record.expiresAt || 0) <= Date.now()) {
        delete store.sessions[key];
        return null;
      }
      const updatedSession = { ...record.value, lastActiveAt: Date.now() };
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

export async function updateFileSession(sessionId, updates, options) {
  const { prefix, ttlSeconds } = options;
  if (!sessionId) return false;
  const key = buildKey(prefix, sessionId);
  return mutateFileSessionStore((store) => {
    const record = store.sessions[key];
    if (!record || Number(record.expiresAt || 0) <= Date.now()) {
      delete store.sessions[key];
      return false;
    }
    store.sessions[key] = {
      ...record,
      value: {
        ...record.value,
        ...updates,
        lastActiveAt: Date.now(),
      },
      expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
      updatedAt: Date.now(),
    };
    return true;
  });
}

export async function deleteFileSession(sessionId, { prefix }) {
  if (!sessionId) return false;
  const key = buildKey(prefix, sessionId);
  return mutateFileSessionStore((store) => {
    const existed = Boolean(store.sessions[key]);
    delete store.sessions[key];
    return existed;
  });
}

export async function listFileSessions({ prefix }) {
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

export async function deleteFileUserSessions(userId, { prefix, userIdField }) {
  if (!userId) return 0;
  return mutateFileSessionStore((store) => {
    let deleted = 0;
    for (const [key, record] of Object.entries(store.sessions || {})) {
      if (key.startsWith(prefix) && record?.value?.[userIdField] === userId) {
        delete store.sessions[key];
        deleted += 1;
      }
    }
    return deleted;
  });
}

export default {
  createFileSession,
  getFileSession,
  updateFileSession,
  deleteFileSession,
  listFileSessions,
  deleteFileUserSessions,
};
