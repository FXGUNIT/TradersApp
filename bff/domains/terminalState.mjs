import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DATA_PATH = resolve(process.cwd(), "bff/data/terminal-domain.json");

const DEFAULT_STATE = {
  workspaces: {},
  analyticsHistory: {},
};

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function normalizeJournalEntry(entryId, entry = {}) {
  return {
    ...entry,
    entryId,
  };
}

function normalizeJournal(journal = {}) {
  if (Array.isArray(journal)) {
    return journal.reduce((acc, entry, index) => {
      if (!entry || typeof entry !== "object") {
        return acc;
      }

      const entryId =
        String(entry.entryId || entry.id || `entry_${index}`).trim() ||
        `entry_${index}`;
      acc[entryId] = normalizeJournalEntry(entryId, entry);
      return acc;
    }, {});
  }

  if (!journal || typeof journal !== "object") {
    return {};
  }

  if (Array.isArray(journal.entries)) {
    return normalizeJournal(journal.entries);
  }

  return Object.fromEntries(
    Object.entries(journal).map(([entryId, entry]) => [
      entryId,
      normalizeJournalEntry(entryId, entry || {}),
    ]),
  );
}

function normalizeAccountState(accountState = {}) {
  return accountState && typeof accountState === "object" ? { ...accountState } : {};
}

function normalizeFirmRules(firmRules = {}) {
  return firmRules && typeof firmRules === "object" ? { ...firmRules } : {};
}

function normalizeWorkspace(uid, workspace = {}) {
  const {
    journal,
    accountState,
    firmRules,
    createdAt,
    updatedAt,
    ...rest
  } = workspace && typeof workspace === "object" ? workspace : {};

  return {
    ...rest,
    uid,
    journal: normalizeJournal(journal),
    accountState: normalizeAccountState(accountState),
    firmRules: normalizeFirmRules(firmRules),
    createdAt: createdAt || nowIso(),
    updatedAt: updatedAt || nowIso(),
  };
}

function normalizeState(rawState = {}) {
  const workspaces =
    rawState.workspaces && typeof rawState.workspaces === "object"
      ? rawState.workspaces
      : {};

  return {
    ...DEFAULT_STATE,
    ...rawState,
    workspaces: Object.fromEntries(
      Object.entries(workspaces).map(([uid, workspace]) => [
        uid,
        normalizeWorkspace(uid, workspace || {}),
      ]),
    ),
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

function mergeWorkspace(uid, existingWorkspace = {}, patch = {}) {
  const nextWorkspace = normalizeWorkspace(uid, {
    ...existingWorkspace,
    ...patch,
    uid,
    journal:
      patch.journal !== undefined
        ? patch.journal
        : existingWorkspace.journal || {},
    accountState:
      patch.accountState !== undefined
        ? patch.accountState
        : existingWorkspace.accountState || {},
    firmRules:
      patch.firmRules !== undefined
        ? patch.firmRules
        : existingWorkspace.firmRules || {},
    createdAt: existingWorkspace.createdAt || patch.createdAt,
    updatedAt: patch.updatedAt || nowIso(),
  });

  return nextWorkspace;
}

function upsertWorkspace(uid, patch = {}) {
  if (!uid) {
    return null;
  }

  const state = readState();
  const existing = state.workspaces?.[uid] || null;
  const nextWorkspace = mergeWorkspace(uid, existing || {}, patch);

  state.workspaces = {
    ...(state.workspaces || {}),
    [uid]: nextWorkspace,
  };

  writeState(state);
  return clone(nextWorkspace);
}

export function getWorkspace(uid) {
  if (!uid) {
    return null;
  }

  const state = readState();
  const workspace = state.workspaces?.[uid];
  return workspace ? clone(workspace) : null;
}

export function upsertWorkspaceRecord(uid, patch = {}) {
  return upsertWorkspace(uid, patch);
}

export function patchWorkspaceJournal(uid, journal = {}) {
  return upsertWorkspace(uid, { journal });
}

export function patchWorkspaceAccountState(uid, accountState = {}) {
  return upsertWorkspace(uid, { accountState });
}

export function patchWorkspaceFirmRules(uid, firmRules = {}) {
  return upsertWorkspace(uid, { firmRules });
}

export default {
  getWorkspace,
  patchWorkspaceAccountState,
  patchWorkspaceFirmRules,
  patchWorkspaceJournal,
  upsertWorkspaceRecord,
};
