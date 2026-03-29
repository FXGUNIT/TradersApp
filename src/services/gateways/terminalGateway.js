import { bffFetch } from "./base.js";

function normalizeWorkspace(response) {
  if (!response) {
    return null;
  }

  return response.workspace || response.data || response;
}

export async function fetchTerminalWorkspace(uid) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/terminal/workspaces/${encodeURIComponent(uid)}`);
}

export async function saveTerminalWorkspace(uid, workspace = {}) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/terminal/workspaces/${encodeURIComponent(uid)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(workspace),
  });
}

export async function saveTerminalJournal(uid, journal = {}) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/terminal/workspaces/${encodeURIComponent(uid)}/journal`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ journal }),
  });
}

export async function saveTerminalAccountState(uid, accountState = {}) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/terminal/workspaces/${encodeURIComponent(uid)}/accountState`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accountState }),
  });
}

export async function saveTerminalFirmRules(uid, firmRules = {}) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/terminal/workspaces/${encodeURIComponent(uid)}/firmRules`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ firmRules }),
  });
}

export { normalizeWorkspace };

export default {
  fetchTerminalWorkspace,
  normalizeWorkspace,
  saveTerminalAccountState,
  saveTerminalFirmRules,
  saveTerminalJournal,
  saveTerminalWorkspace,
};
