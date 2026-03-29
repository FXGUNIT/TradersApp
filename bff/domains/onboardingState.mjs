import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DATA_PATH = resolve(process.cwd(), "bff/data/onboarding-domain.json");
const DEFAULT_STATE = {
  applications: {},
};

function readState() {
  if (!existsSync(DATA_PATH)) {
    return { ...DEFAULT_STATE };
  }

  try {
    const raw = readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      applications: parsed?.applications || {},
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeState(state) {
  writeFileSync(DATA_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function nowIso() {
  return new Date().toISOString();
}

export function upsertApplication(uid, payload = {}) {
  const state = readState();
  const existing = state.applications?.[uid] || {};
  const next = {
    ...existing,
    ...payload,
    uid,
    status: payload.status || existing.status || "PENDING",
    submittedAt: existing.submittedAt || payload.submittedAt || nowIso(),
    updatedAt: nowIso(),
  };

  state.applications = {
    ...(state.applications || {}),
    [uid]: next,
  };
  writeState(state);
  return next;
}

export function getApplication(uid) {
  const state = readState();
  return state.applications?.[uid] || null;
}

export function getApplicationStatus(uid) {
  const record = getApplication(uid);
  if (!record) {
    return null;
  }

  return {
    uid: record.uid,
    status: record.status || "PENDING",
    updatedAt: record.updatedAt || record.submittedAt || null,
  };
}

export function mergeApplicationConsent(uid, consentState = {}) {
  const existing = getApplication(uid);
  if (!existing) {
    return null;
  }

  return upsertApplication(uid, {
    consentState: {
      ...(existing.consentState || {}),
      ...(consentState || {}),
    },
  });
}

export default {
  getApplication,
  getApplicationStatus,
  mergeApplicationConsent,
  upsertApplication,
};
