import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { writeAtomic } from './atomicWrite.mjs';
import { resolve } from "node:path";

const DATA_PATH = resolve(process.cwd(), "bff/data/terminal-domain.json");
const DEFAULT_STATE = {
  workspaces: {},
};

function nowIso() {
  return new Date().toISOString();
}

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
      workspaces:
        parsed?.workspaces && typeof parsed.workspaces === "object"
          ? parsed.workspaces
          : {},
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeState(state) {
  writeAtomic(DATA_PATH, state);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeJournal(journal = {}) {
  if (Array.isArray(journal)) {
    return journal.reduce((acc, entry, index) => {
      acc[`entry_${index}`] = entry;
      return acc;
    }, {});
  }

  return journal && typeof journal === "object" ? journal : {};
}

function normalizeWorkspace(uid, workspace = {}, existing = null) {
  return {
    uid,
    journal: normalizeJournal(workspace.journal ?? existing?.journal ?? {}),
    accountState:
      workspace.accountState && typeof workspace.accountState === "object"
        ? workspace.accountState
        : existing?.accountState || {},
    firmRules:
      workspace.firmRules && typeof workspace.firmRules === "object"
        ? workspace.firmRules
        : existing?.firmRules || {},
    createdAt: workspace.createdAt || existing?.createdAt || nowIso(),
    updatedAt: workspace.updatedAt || nowIso(),
  };
}

export function getWorkspace(uid) {
  if (!uid) {
    return null;
  }

  const state = readState();
  const existing = state.workspaces?.[uid];
  if (!existing) {
    return null;
  }

  return clone(normalizeWorkspace(uid, existing));
}

export function upsertWorkspace(uid, patch = {}) {
  if (!uid) {
    return null;
  }

  const state = readState();
  const existing = state.workspaces?.[uid] || null;
  const nextWorkspace = normalizeWorkspace(uid, patch, existing);
  state.workspaces = {
    ...(state.workspaces || {}),
    [uid]: nextWorkspace,
  };
  writeState(state);
  return clone(nextWorkspace);
}

export function replaceWorkspaceJournal(uid, journal = {}) {
  return upsertWorkspace(uid, { journal });
}

export function replaceWorkspaceAccountState(uid, accountState = {}) {
  return upsertWorkspace(uid, { accountState });
}

export function replaceWorkspaceFirmRules(uid, firmRules = {}) {
  return upsertWorkspace(uid, { firmRules });
}

export default {
  getWorkspace,
  replaceWorkspaceAccountState,
  replaceWorkspaceFirmRules,
  replaceWorkspaceJournal,
  upsertWorkspace,
};
