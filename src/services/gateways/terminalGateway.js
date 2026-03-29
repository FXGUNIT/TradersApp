import { bffFetch } from "./base.js";

function normalizeWorkspaceResponse(response) {
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

export async function upsertTerminalWorkspace(uid, workspace = {}) {
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

export async function putTerminalJournal(uid, journal = {}) {
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

export async function putTerminalAccountState(uid, accountState = {}) {
  if (!uid) {
    return null;
  }

  return bffFetch(
    `/terminal/workspaces/${encodeURIComponent(uid)}/account-state`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountState }),
    },
  );
}

export async function putTerminalFirmRules(uid, firmRules = {}) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/terminal/workspaces/${encodeURIComponent(uid)}/firm-rules`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ firmRules }),
  });
}

export { normalizeWorkspaceResponse };

export default {
  fetchTerminalWorkspace,
  putTerminalAccountState,
  putTerminalFirmRules,
  putTerminalJournal,
  upsertTerminalWorkspace,
};
