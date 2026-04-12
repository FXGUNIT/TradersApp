import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DATA_PATH = resolve(process.cwd(), "bff/data/identity-domain.json");

const DEFAULT_STATE = {
  users: {},
  sessions: {},
};

const TRAINING_ELIGIBILITY_DAY_THRESHOLD = 10;
const TRAINING_ELIGIBILITY_LOCKED_MESSAGE =
  "Unlock more AI accuracy after 10 days of usage";
const TRAINING_ELIGIBILITY_UNLOCKED_MESSAGE =
  "Future uploads are now eligible for training";
const COLLECTIVE_CONSCIOUSNESS_STANDARD_PLAN = "standard";
const COLLECTIVE_CONSCIOUSNESS_PREMIUM_PLAN = "premium";
const COLLECTIVE_CONSCIOUSNESS_STANDARD_LIMIT = 10;
const COLLECTIVE_CONSCIOUSNESS_PREMIUM_LIMIT = 50;
const COLLECTIVE_CONSCIOUSNESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const COLLECTIVE_CONSCIOUSNESS_PREMIUM_PRICE_INR_MONTHLY = 800;
const COLLECTIVE_CONSCIOUSNESS_ADMIN_BYPASS_EMAIL = "cricgunit@gmail.com";

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

function normalizeDayCounter(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function normalizeActiveDay(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return new Date().toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeIsoTimestamp(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeQuestionCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function normalizeCollectivePlan(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalized === COLLECTIVE_CONSCIOUSNESS_PREMIUM_PLAN ||
    normalized === "collective_consciousness_premium"
  ) {
    return COLLECTIVE_CONSCIOUSNESS_PREMIUM_PLAN;
  }

  return COLLECTIVE_CONSCIOUSNESS_STANDARD_PLAN;
}

function resolveTrainingEligibility(role, dayCounter) {
  return (
    String(role || "user")
      .trim()
      .toLowerCase() !== "user" ||
    dayCounter >= TRAINING_ELIGIBILITY_DAY_THRESHOLD
  );
}

function resolveTrainingEligibilityMessage(isTrainingEligible) {
  return isTrainingEligible
    ? TRAINING_ELIGIBILITY_UNLOCKED_MESSAGE
    : TRAINING_ELIGIBILITY_LOCKED_MESSAGE;
}

function getCollectiveConsciousnessLimit(plan) {
  return normalizeCollectivePlan(plan) === COLLECTIVE_CONSCIOUSNESS_PREMIUM_PLAN
    ? COLLECTIVE_CONSCIOUSNESS_PREMIUM_LIMIT
    : COLLECTIVE_CONSCIOUSNESS_STANDARD_LIMIT;
}

function buildCollectiveConsciousnessUpsellMetadata() {
  return {
    enabled: true,
    plan_name: "Collective Consciousness",
    monthly_price_inr: COLLECTIVE_CONSCIOUSNESS_PREMIUM_PRICE_INR_MONTHLY,
    price_label: `₹${COLLECTIVE_CONSCIOUSNESS_PREMIUM_PRICE_INR_MONTHLY}/month`,
    cta_label: "Upgrade to Premium",
    telegram_cta_label: "Contact Sales on Telegram",
    channel: "telegram",
  };
}

function resolveCollectiveConsciousnessState(user = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const nowMs = now.getTime();
  const role = String(user.role || "user")
    .trim()
    .toLowerCase();
  const email = String(user.email || "")
    .trim()
    .toLowerCase();
  const plan = normalizeCollectivePlan(
    user.plan ??
      user.collectiveConsciousness?.plan ??
      user.collectiveConsciousnessPlan ??
      user.subscriptionPlan,
  );
  const rawWindowStartTimestamp = normalizeIsoTimestamp(
    user.windowStartTimestamp ??
      user.window_start_timestamp ??
      user.collectiveConsciousness?.windowStartTimestamp ??
      user.collectiveConsciousness?.window_start_timestamp,
  );
  const rawQuestionCount = normalizeQuestionCount(
    user.questionCount ??
      user.question_count ??
      user.collectiveConsciousness?.questionCount ??
      user.collectiveConsciousness?.question_count,
  );
  const isAdminBypass =
    role === "admin" || email === COLLECTIVE_CONSCIOUSNESS_ADMIN_BYPASS_EMAIL;
  const questionsAllowed = isAdminBypass
    ? null
    : getCollectiveConsciousnessLimit(plan);
  const windowStartMs = rawWindowStartTimestamp
    ? new Date(rawWindowStartTimestamp).getTime()
    : null;
  const windowExpired =
    Number.isFinite(windowStartMs) &&
    nowMs - windowStartMs >= COLLECTIVE_CONSCIOUSNESS_WINDOW_MS;
  const windowStartTimestamp =
    rawWindowStartTimestamp && !windowExpired ? rawWindowStartTimestamp : null;
  const questionCount = windowStartTimestamp ? rawQuestionCount : 0;
  const resetTimestamp = windowStartTimestamp
    ? new Date(
        new Date(windowStartTimestamp).getTime() +
          COLLECTIVE_CONSCIOUSNESS_WINDOW_MS,
      ).toISOString()
    : null;
  const remainingWaitMs = resetTimestamp
    ? Math.max(new Date(resetTimestamp).getTime() - nowMs, 0)
    : 0;
  const isBlocked =
    !isAdminBypass &&
    questionsAllowed !== null &&
    questionCount >= questionsAllowed &&
    remainingWaitMs > 0;
  const questionsRemaining =
    questionsAllowed === null
      ? null
      : Math.max(questionsAllowed - questionCount, 0);

  return {
    plan,
    windowStartTimestamp,
    questionCount,
    currentTier: isAdminBypass ? "admin" : plan,
    questionsAllowed,
    questionsRemaining,
    resetTimestamp,
    remainingWaitMs,
    isAdminBypass,
    isBlocked,
    upsell:
      !isAdminBypass && plan === COLLECTIVE_CONSCIOUSNESS_STANDARD_PLAN
        ? buildCollectiveConsciousnessUpsellMetadata()
        : null,
  };
}

function normalizeUserRecord(uid, user = {}) {
  const role = user.role || "user";
  const daysUsed = normalizeDayCounter(
    user.daysUsed ?? user.days_used ?? user.dayCounter,
  );
  const isTrainingEligible = resolveTrainingEligibility(role, daysUsed);
  const collectiveConsciousness = resolveCollectiveConsciousnessState({
    ...user,
    role,
  });

  return {
    ...user,
    uid,
    email: user.email || null,
    fullName: user.fullName || user.displayName || user.email || uid,
    status: user.status || "PENDING",
    role,
    isLocked: Boolean(user.isLocked),
    failedAttempts: Number(user.failedAttempts || 0),
    approvedAt: user.approvedAt || null,
    approvedBy: user.approvedBy || null,
    blockedAt: user.blockedAt || null,
    blockedBy: user.blockedBy || null,
    lockedBy: user.lockedBy || null,
    lastLoginAt: user.lastLoginAt || null,
    lastLoginAttempt: user.lastLoginAttempt || null,
    daysUsed,
    days_used: daysUsed,
    dayCounter: daysUsed,
    lastActiveDay:
      typeof (user.lastActiveDay ?? user.last_active_day) === "string" &&
      String(user.lastActiveDay ?? user.last_active_day).trim()
        ? normalizeActiveDay(user.lastActiveDay ?? user.last_active_day)
        : null,
    last_active_day:
      typeof (user.lastActiveDay ?? user.last_active_day) === "string" &&
      String(user.lastActiveDay ?? user.last_active_day).trim()
        ? normalizeActiveDay(user.lastActiveDay ?? user.last_active_day)
        : null,
    isTrainingEligible,
    is_training_eligible: isTrainingEligible,
    trainingEligibilityMessage:
      resolveTrainingEligibilityMessage(isTrainingEligible),
    plan: collectiveConsciousness.plan,
    windowStartTimestamp: collectiveConsciousness.windowStartTimestamp,
    window_start_timestamp: collectiveConsciousness.windowStartTimestamp,
    questionCount: collectiveConsciousness.questionCount,
    question_count: collectiveConsciousness.questionCount,
    collectiveConsciousness,
    updatedAt: user.updatedAt || nowIso(),
  };
}

function normalizeState(rawState = {}) {
  const users =
    rawState.users && typeof rawState.users === "object" ? rawState.users : {};
  const sessions =
    rawState.sessions && typeof rawState.sessions === "object"
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
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  return (
    Object.entries(state.users || {}).find(([, user]) => {
      return (
        String(user?.email || "")
          .trim()
          .toLowerCase() === normalizedEmail
      );
    })?.[0] || null
  );
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
    daysUsed: normalized.daysUsed,
    days_used: normalized.days_used,
    dayCounter: normalized.dayCounter,
    lastActiveDay: normalized.lastActiveDay,
    last_active_day: normalized.last_active_day,
    isTrainingEligible: normalized.isTrainingEligible,
    is_training_eligible: normalized.is_training_eligible,
    trainingEligibilityMessage: normalized.trainingEligibilityMessage,
    plan: normalized.plan,
    questionCount: normalized.questionCount,
    question_count: normalized.question_count,
    windowStartTimestamp: normalized.windowStartTimestamp,
    window_start_timestamp: normalized.window_start_timestamp,
    collectiveConsciousness: normalized.collectiveConsciousness,
    updatedAt: normalized.updatedAt,
  };
}

export function listTrainingEligibilityUsers() {
  const state = readState();
  return clone(
    Object.entries(state.users || {}).map(([uid, user]) => {
      const normalized = normalizeUserRecord(uid, user || {});
      return {
        uid,
        role: normalized.role,
        daysUsed: normalized.daysUsed,
        days_used: normalized.days_used,
        isTrainingEligible: normalized.isTrainingEligible,
        is_training_eligible: normalized.is_training_eligible,
        lastActiveDay: normalized.lastActiveDay,
        last_active_day: normalized.last_active_day,
      };
    }),
  );
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
    plan: patch.plan,
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
  const nextBucket =
    currentSessionId && retained ? { [currentSessionId]: retained } : {};
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

export function getCollectiveConsciousnessStatus(uid) {
  if (!uid) {
    return null;
  }

  const state = readState();
  const user = state.users?.[uid];
  if (!user) {
    return null;
  }

  const normalized = normalizeUserRecord(uid, user);
  return clone(normalized.collectiveConsciousness);
}

export function consumeCollectiveConsciousnessQuestion(uid, patch = {}, options = {}) {
  if (!uid) {
    return {
      ok: false,
      blocked: true,
      error: "User UID is required.",
      code: "COLLECTIVE_CONSCIOUSNESS_UID_REQUIRED",
    };
  }

  const state = readState();
  const existingUser = state.users?.[uid] || null;
  const seededUser = upsertUser(state, uid, {
    uid,
    ...(existingUser || {}),
    email: patch.email ?? existingUser?.email ?? null,
    fullName:
      patch.fullName ??
      patch.displayName ??
      existingUser?.fullName ??
      existingUser?.displayName ??
      patch.email ??
      uid,
    role: patch.role ?? existingUser?.role ?? "user",
    plan: existingUser?.plan,
    updatedAt: nowIso(),
  });
  const currentState = resolveCollectiveConsciousnessState(seededUser, options);

  if (currentState.isBlocked) {
    writeState(state);
    return {
      ok: false,
      blocked: true,
      code: "COLLECTIVE_CONSCIOUSNESS_LIMIT_REACHED",
      error: "Collective Consciousness question limit reached.",
      usage: clone(currentState),
    };
  }

  const timestamp = (options.now instanceof Date ? options.now : new Date()).toISOString();
  const nextUser = upsertUser(state, uid, {
    ...seededUser,
    plan: currentState.plan,
    windowStartTimestamp: currentState.windowStartTimestamp || timestamp,
    questionCount: currentState.questionCount + 1,
    updatedAt: nowIso(),
  });
  writeState(state);

  return {
    ok: true,
    blocked: false,
    usage: clone(normalizeUserRecord(uid, nextUser).collectiveConsciousness),
    user: clone(nextUser),
  };
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

export function recordUserActiveDay(uid, options = {}) {
  if (!uid) {
    return null;
  }

  const state = readState();
  const existingUser = state.users?.[uid];
  if (!existingUser) {
    return null;
  }

  const normalizedUser = normalizeUserRecord(uid, existingUser);
  const activeDay = normalizeActiveDay(options.activeDay);
  const shouldIncrement =
    !normalizedUser.lastActiveDay || activeDay > normalizedUser.lastActiveDay;

  const nextUser = upsertUser(state, uid, {
    ...normalizedUser,
    daysUsed: shouldIncrement
      ? normalizedUser.daysUsed + 1
      : normalizedUser.daysUsed,
    lastActiveDay: shouldIncrement
      ? activeDay
      : normalizedUser.lastActiveDay || activeDay,
    updatedAt: nowIso(),
  });

  writeState(state);
  return {
    user: clone(nextUser),
    sessions: clone(normalizeSessionBucket(state.sessions?.[uid] || {})),
  };
}

export default {
  consumeCollectiveConsciousnessQuestion,
  deleteSession,
  ensureUserRecord,
  findUserByEmail,
  getCollectiveConsciousnessStatus,
  getUserByUid,
  getUserStatus,
  listTrainingEligibilityUsers,
  listSessions,
  patchUserAccess,
  patchUserSecurity,
  provisionUser,
  recordUserActiveDay,
  revokeOtherSessions,
  upsertSession,
};
