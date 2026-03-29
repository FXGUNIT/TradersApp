import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getApplication,
  listApplications,
  upsertApplication,
} from "./onboardingState.mjs";

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

function buildSeedUser(uid, identityUser = null) {
  if (identityUser) {
    return identityUser;
  }

  const application = getApplication(uid);
  if (!application) {
    return null;
  }

  return {
    uid,
    email: application.email || null,
    fullName: application.fullName || application.displayName || uid,
    status: application.status || "PENDING",
    role: "user",
    isLocked: Boolean(application.isLocked),
    country: application.country || "",
    city: application.city || "",
    instagram: application.instagram || "",
    linkedin: application.linkedin || "",
    proficiency: application.proficiency || "",
    authProvider: application.authProvider || "password",
    submittedAt: application.submittedAt || null,
    updatedAt: application.updatedAt || nowIso(),
  };
}

function syncIdentityUser(uid, patch = {}) {
  const state = readIdentityState();
  const existing = buildSeedUser(uid, state.users?.[uid]);
  if (!existing && Object.keys(patch || {}).length === 0) {
    return null;
  }

  const nextUser = normalizeUserRecord(uid, {
    ...(existing || {}),
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
  const applications = listApplications();
  const users = {};

  Object.entries(applications || {}).forEach(([uid, application]) => {
    users[uid] = normalizeUserRecord(uid, buildSeedUser(uid, application));
  });

  Object.entries(identityState.users || {}).forEach(([uid, user]) => {
    users[uid] = normalizeUserRecord(uid, {
      ...(users[uid] || {}),
      ...user,
    });
  });

  return users;
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

  const user = syncIdentityUser(uid);
  if (!user) {
    return { success: false, error: "User not found." };
  }

  const updatedAt = nowIso();
  const nextUser = syncIdentityUser(uid, {
    ...user,
    status: "ACTIVE",
    isLocked: false,
    approvedBy: adminUid,
    approvedAt: updatedAt,
    updatedAt,
  });
  if (getApplication(uid)) {
    upsertApplication(uid, {
      status: "ACTIVE",
      isLocked: false,
    });
  }

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

  const user = syncIdentityUser(uid);
  if (!user) {
    return { success: false, error: "User not found." };
  }

  const updatedAt = nowIso();
  const nextUser = syncIdentityUser(uid, {
    ...user,
    status: "BLOCKED",
    isLocked: Boolean(user.isLocked),
    blockedBy: adminUid,
    blockedAt: updatedAt,
    updatedAt,
  });
  if (getApplication(uid)) {
    upsertApplication(uid, {
      status: "BLOCKED",
      isLocked: Boolean(nextUser?.isLocked),
    });
  }

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

  const user = syncIdentityUser(uid);
  if (!user) {
    return { success: false, error: "User not found." };
  }

  const updatedAt = nowIso();
  const nextUser = syncIdentityUser(uid, {
    ...user,
    isLocked: true,
    lockedBy: adminUid,
    updatedAt,
  });
  if (getApplication(uid)) {
    upsertApplication(uid, {
      isLocked: true,
    });
  }

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
