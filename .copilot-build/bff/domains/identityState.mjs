import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DATA_PATH = resolve(process.cwd(), "bff/data/identity-domain.json");

const DEFAULT_STATE = {
  users: {},
  sessions: {},
};

function nowIso() {
  return new Date().toISOString();
}

function readStateFile() {
  if (!existsSync(DATA_PATH)) {
    return { ...DEFAULT_STATE };
  }

  try {
    const raw = readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeStateFile(state) {
  writeFileSync(DATA_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function normalizeSessionRecord(sessionId, session = {}) {
  return {
    ...session,
    sessionId,
    device: session.device || "Unknown Device",
    city: session.city || "Unknown",
    country: session.country || "Unknown",
    createdAt: session.createdAt || nowIso(),
    expiresAt: session.expiresAt || null,
    lastActive: session.lastActive || session.updatedAt || nowIso(),
    updatedAt: session.updatedAt || nowIso(),
  };
}

function normalizeSessionBucket(bucket = {}) {
  if (Array.isArray(bucket)) {
    return bucket.reduce((acc, session, index) => {
      if (!session || typeof session !== "object") {
        return acc;
      }

      const sessionId =
        String(session.sessionId || session.id || `session_${index}`).trim() ||
        `session_${index}`;
      acc[sessionId] = normalizeSessionRecord(sessionId, session);
      return acc;
    }, {});
  }

  if (!bucket || typeof bucket !== "object") {
    return {};
  }

  if (Array.isArray(bucket.sessions)) {
    return normalizeSessionBucket(bucket.sessions);
  }

  return Object.fromEntries(
    Object.entries(bucket).map(([sessionId, session]) => [
      sessionId,
      normalizeSessionRecord(sessionId, session || {}),
    ]),
  );
}

function normalizeUserRecord(uid, user = {}) {
  return {
    ...user,
    uid,
    email: user.email || null,
    fullName: user.fullName || user.displayName || user.email || uid,
    status: user.status || "PENDING",
    role: user.role || "user",
    isLocked: Boolean(user.isLocked),
    failedAttempts: Number(user.failedAttempts || 0),
    approvedAt: user.approvedAt || null,
    approvedBy: user.approvedBy || null,
    blockedAt: user.blockedAt || null,
    blockedBy: user.blockedBy || null,
    lockedBy: user.lockedBy || null,
    lastLoginAt: user.lastLoginAt || null,
    lastLoginAttempt: user.lastLoginAttempt || null,
    updatedAt: user.updatedAt || nowIso(),
  };
}

function normalizeState(rawState = {}) {
  const users = rawState.users && typeof rawState.users === "object" ? rawState.users : {};
  const sessions = rawState.sessions && typeof rawState.sessions === "object"
    ? rawState.sessions
    : {};

  const normalizedSessions = Object.fromEntries(
    Object.entries(sessions).map(([uid, bucket]) => [
      uid,
      normalizeSessionBucket(bucket),
    ]),
  );

  return {
    ...DEFAULT_STATE,
    ...rawState,
    users: Object.fromEntries(
      Object.entries(users).map(([uid, user]) => [
        uid,
        normalizeUserRecord(uid, user || {}),
      ]),
    ),
    sessions: normalizedSessions,
  };
}

function readState() {
  return normalizeState(readStateFile());
}

function writeState(state) {
  const nextState = normalizeState(state);
  writeStateFile(nextState);
  return nextState;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findUserUidByEmail(state, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  return Object.entries(state.users || {}).find(([, user]) => {
    return String(user?.email || "").trim().toLowerCase() === normalizedEmail;
  })?.[0] || null;
}

function getUserAndSessions(state, uid) {
  const user = state.users?.[uid] || null;
  const sessions = state.sessions?.[uid] || {};
  if (!user) {
    return null;
  }

  return {
    user: normalizeUserRecord(uid, user),
    sessions: normalizeSessionBucket(sessions),
  };
}

function upsertUser(state, uid, patch = {}) {
  const existing = state.users?.[uid] || {};
  const nextUser = normalizeUserRecord(uid, {
    ...existing,
    ...patch,
    updatedAt: patch.updatedAt || nowIso(),
  });

  state.users = {
    ...(state.users || {}),
    [uid]: nextUser,
  };

  return nextUser;
}

function patchUserByUid(uid, patch = {}) {
  const state = readState();
  if (!state.users?.[uid]) {
    return null;
  }

  const nextUser = upsertUser(state, uid, patch);
  writeState(state);
  return nextUser;
}

export function getUserByUid(uid) {
  const state = readState();
  const record = getUserAndSessions(state, uid);
  return record ? clone(record) : null;
}

export function getUserStatus(uid) {
  const state = readState();
  const user = state.users?.[uid];
  if (!user) {
    return null;
  }

  const normalized = normalizeUserRecord(uid, user);
  return {
    uid,
    status: normalized.status,
    isLocked: normalized.isLocked,
    role: normalized.role,
    updatedAt: normalized.updatedAt,
  };
}

export function findUserByEmail(email) {
  const state = readState();
  const uid = findUserUidByEmail(state, email);
  if (!uid) {
    return null;
  }

  const record = getUserAndSessions(state, uid);
  return record ? clone(record) : null;
}

export function patchUserAccess(uid, patch = {}) {
  const allowed = {
    status: patch.status,
    role: patch.role,
    approvedAt: patch.approvedAt,
    approvedBy: patch.approvedBy,
    blockedAt: patch.blockedAt,
    blockedBy: patch.blockedBy,
    lockedBy: patch.lockedBy,
    updatedAt: patch.updatedAt || nowIso(),
  };

  const cleaned = Object.fromEntries(
    Object.entries(allowed).filter(([, value]) => value !== undefined),
  );

  return patchUserByUid(uid, cleaned);
}

export function patchUserSecurity(uid, patch = {}) {
  const allowed = {
    failedAttempts: patch.failedAttempts,
    isLocked: patch.isLocked,
    lastLoginAt: patch.lastLoginAt,
    lastLoginAttempt: patch.lastLoginAttempt,
    updatedAt: patch.updatedAt || nowIso(),
  };

  const cleaned = Object.fromEntries(
    Object.entries(allowed).filter(([, value]) => value !== undefined),
  );

  return patchUserByUid(uid, cleaned);
}

export function listSessions(uid) {
  const state = readState();
  return clone(normalizeSessionBucket(state.sessions?.[uid] || {}));
}

export function upsertSession(uid, sessionId, payload = {}) {
  if (!uid || !sessionId) {
    return null;
  }

  const state = readState();
  const user = state.users?.[uid];
  if (!user) {
    return null;
  }

  const existingBucket = normalizeSessionBucket(state.sessions?.[uid] || {});
  const nextSession = normalizeSessionRecord(sessionId, {
    ...(existingBucket[sessionId] || {}),
    ...payload,
    sessionId,
    updatedAt: nowIso(),
  });

  state.sessions = {
    ...(state.sessions || {}),
    [uid]: {
      ...existingBucket,
      [sessionId]: nextSession,
    },
  };

  state.users = {
    ...(state.users || {}),
    [uid]: normalizeUserRecord(uid, {
      ...user,
      updatedAt: nowIso(),
    }),
  };

  writeState(state);
  return clone(nextSession);
}

export function deleteSession(uid, sessionId) {
  if (!uid || !sessionId) {
    return null;
  }

  const state = readState();
  const bucket = normalizeSessionBucket(state.sessions?.[uid] || {});
  if (!bucket[sessionId]) {
    return null;
  }

  const nextBucket = { ...bucket };
  delete nextBucket[sessionId];

  state.sessions = {
    ...(state.sessions || {}),
    [uid]: nextBucket,
  };

  writeState(state);
  return true;
}

export function revokeOtherSessions(uid, currentSessionId) {
  if (!uid) {
    return { success: false, error: "UID is required." };
  }

  const state = readState();
  const bucket = normalizeSessionBucket(state.sessions?.[uid] || {});
  const retained = currentSessionId ? bucket[currentSessionId] || null : null;
  const nextBucket = currentSessionId && retained ? { [currentSessionId]: retained } : {};
  const revokedCount = Object.keys(bucket).filter(
    (sessionId) => sessionId !== currentSessionId,
  ).length;

  state.sessions = {
    ...(state.sessions || {}),
    [uid]: nextBucket,
  };

  writeState(state);
  return {
    success: true,
    revokedCount,
    sessions: clone(nextBucket),
  };
}

export function ensureUserRecord(uid, patch = {}) {
  if (!uid) {
    return null;
  }

  const state = readState();
  const nextUser = upsertUser(state, uid, {
    uid,
    ...patch,
  });
  writeState(state);
  return clone(nextUser);
}

export function provisionUser(uid, patch = {}) {
  if (!uid) {
    return null;
  }

  const state = readState();
  const nextUser = upsertUser(state, uid, {
    uid,
    ...patch,
    status: patch.status || state.users?.[uid]?.status || "PENDING",
    updatedAt: patch.updatedAt || nowIso(),
  });
  writeState(state);
  return {
    user: clone(nextUser),
    sessions: clone(normalizeSessionBucket(state.sessions?.[uid] || {})),
  };
}

export default {
  deleteSession,
  ensureUserRecord,
  findUserByEmail,
  getUserByUid,
  getUserStatus,
  listSessions,
  patchUserAccess,
  patchUserSecurity,
  provisionUser,
  revokeOtherSessions,
  upsertSession,
};
