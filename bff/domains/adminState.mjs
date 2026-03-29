import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ADMIN_DATA_PATH = resolve(process.cwd(), "bff/data/admin-domain.json");
const IDENTITY_DATA_PATH = resolve(process.cwd(), "bff/data/identity-domain.json");

const DEFAULT_ADMIN_STATE = {
  maintenanceActive: false,
  auditEvents: [],
  adminOtpChallenge: null,
};

const DEFAULT_IDENTITY_STATE = {
  users: {},
  sessions: {},
};

function readJsonFile(path, fallback) {
  if (!existsSync(path)) {
    return { ...fallback };
  }

  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
    };
  } catch {
    return { ...fallback };
  }
}

function writeJsonFile(path, state) {
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function nowIso() {
  return new Date().toISOString();
}

function readAdminState() {
  const state = readJsonFile(ADMIN_DATA_PATH, DEFAULT_ADMIN_STATE);
  return {
    ...DEFAULT_ADMIN_STATE,
    ...state,
    auditEvents: Array.isArray(state.auditEvents) ? state.auditEvents : [],
  };
}

function writeAdminState(state) {
  writeJsonFile(ADMIN_DATA_PATH, state);
}

function readIdentityState() {
  const state = readJsonFile(IDENTITY_DATA_PATH, DEFAULT_IDENTITY_STATE);
  return {
    ...DEFAULT_IDENTITY_STATE,
    ...state,
    users: state.users && typeof state.users === "object" ? state.users : {},
    sessions:
      state.sessions && typeof state.sessions === "object" ? state.sessions : {},
  };
}

function writeIdentityState(state) {
  writeJsonFile(IDENTITY_DATA_PATH, state);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
    approvedAt: user.approvedAt || null,
    approvedBy: user.approvedBy || null,
    blockedAt: user.blockedAt || null,
    blockedBy: user.blockedBy || null,
    lockedBy: user.lockedBy || null,
    updatedAt: user.updatedAt || nowIso(),
  };
}

function syncIdentityUser(uid, patch = {}) {
  const state = readIdentityState();
  const existing = state.users?.[uid];
  if (!existing) {
    return null;
  }

  const nextUser = normalizeUserRecord(uid, {
    ...existing,
    ...patch,
  });

  state.users = {
    ...state.users,
    [uid]: nextUser,
  };

  writeIdentityState(state);
  return nextUser;
}

function appendAuditEvent(event = {}) {
  const state = readAdminState();
  const record = {
    id: event.id || randomUUID(),
    actorUid: event.actorUid || null,
    targetUid: event.targetUid || null,
    success: Boolean(event.success),
    detail: event.detail || {},
    type: event.type || "admin_event",
    createdAt: event.createdAt || nowIso(),
    updatedAt: event.updatedAt || nowIso(),
  };

  state.auditEvents = [...state.auditEvents, record];
  writeAdminState(state);
  return record;
}

function buildUserList() {
  const identityState = readIdentityState();
  return Object.fromEntries(
    Object.entries(identityState.users || {}).map(([uid, user]) => [
      uid,
      normalizeUserRecord(uid, user),
    ]),
  );
}

export function getMaintenanceState() {
  const state = readAdminState();
  return Boolean(state.maintenanceActive);
}

export function toggleMaintenanceState(nextState) {
  const state = readAdminState();
  const maintenanceActive =
    typeof nextState === "boolean" ? nextState : !state.maintenanceActive;

  const next = {
    ...state,
    maintenanceActive,
  };

  writeAdminState(next);
  return maintenanceActive;
}

export function listAdminUsers() {
  return buildUserList();
}

export function approveAdminUser(uid, adminUid) {
  if (!uid || !adminUid) {
    return { success: false, error: "User UID and Admin UID are required." };
  }

  const identityState = readIdentityState();
  const user = identityState.users?.[uid];
  if (!user) {
    return { success: false, error: "User not found." };
  }

  const updatedAt = nowIso();
  const nextUser = normalizeUserRecord(uid, {
    ...user,
    status: "ACTIVE",
    isLocked: false,
    approvedBy: adminUid,
    approvedAt: updatedAt,
    updatedAt,
  });

  identityState.users = {
    ...identityState.users,
    [uid]: nextUser,
  };
  writeIdentityState(identityState);

  appendAuditEvent({
    actorUid: adminUid,
    targetUid: uid,
    success: true,
    type: "admin_user_approve",
    detail: {
      action: "approve",
      status: "ACTIVE",
    },
    createdAt: updatedAt,
    updatedAt,
  });

  return { success: true, user: clone(nextUser) };
}

export function blockAdminUser(uid, adminUid) {
  if (!uid || !adminUid) {
    return { success: false, error: "User UID and Admin UID are required." };
  }

  const identityState = readIdentityState();
  const user = identityState.users?.[uid];
  if (!user) {
    return { success: false, error: "User not found." };
  }

  const updatedAt = nowIso();
  const nextUser = normalizeUserRecord(uid, {
    ...user,
    status: "BLOCKED",
    isLocked: Boolean(user.isLocked),
    blockedBy: adminUid,
    blockedAt: updatedAt,
    updatedAt,
  });

  identityState.users = {
    ...identityState.users,
    [uid]: nextUser,
  };
  writeIdentityState(identityState);

  appendAuditEvent({
    actorUid: adminUid,
    targetUid: uid,
    success: true,
    type: "admin_user_block",
    detail: {
      action: "block",
      status: "BLOCKED",
    },
    createdAt: updatedAt,
    updatedAt,
  });

  return { success: true, user: clone(nextUser) };
}

export function lockAdminUser(uid, adminUid) {
  if (!uid || !adminUid) {
    return { success: false, error: "User UID and Admin UID are required." };
  }

  const identityState = readIdentityState();
  const user = identityState.users?.[uid];
  if (!user) {
    return { success: false, error: "User not found." };
  }

  const updatedAt = nowIso();
  const nextUser = normalizeUserRecord(uid, {
    ...user,
    isLocked: true,
    lockedBy: adminUid,
    updatedAt,
  });

  identityState.users = {
    ...identityState.users,
    [uid]: nextUser,
  };
  writeIdentityState(identityState);

  appendAuditEvent({
    actorUid: adminUid,
    targetUid: uid,
    success: true,
    type: "admin_user_lock",
    detail: {
      action: "lock",
      isLocked: true,
    },
    createdAt: updatedAt,
    updatedAt,
  });

  return { success: true, user: clone(nextUser) };
}

export function getAdminAuditEvents() {
  const state = readAdminState();
  return Array.isArray(state.auditEvents) ? state.auditEvents : [];
}

export function recordAdminAuditEvent(event = {}) {
  return appendAuditEvent(event);
}

export function getMaintenanceAndUsersSnapshot() {
  return {
    maintenanceActive: getMaintenanceState(),
    users: listAdminUsers(),
  };
}

export default {
  approveAdminUser,
  blockAdminUser,
  getAdminAuditEvents,
  getMaintenanceAndUsersSnapshot,
  getMaintenanceState,
  listAdminUsers,
  lockAdminUser,
  recordAdminAuditEvent,
  toggleMaintenanceState,
};
