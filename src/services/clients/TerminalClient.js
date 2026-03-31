import { dbR, dbW } from "../../utils/firebaseDbUtils.js";
import {
  fetchTerminalWorkspace,
  normalizeWorkspaceResponse,
  putTerminalAccountState,
  putTerminalFirmRules,
  putTerminalJournal,
  upsertTerminalWorkspace,
} from "../gateways/terminalGateway.js";
import { hasBff } from "../gateways/base.js";

function normalizeWorkspace(workspace) {
  if (!workspace || typeof workspace !== "object") {
    return null;
  }

  return {
    journal: {},
    accountState: {},
    firmRules: {},
    ...workspace,
  };
}

function normalizeJournalPayload(journal) {
  if (Array.isArray(journal)) {
    return journal.reduce((acc, entry, index) => {
      acc[`entry_${index}`] = entry;
      return acc;
    }, {});
  }

  if (journal && typeof journal === "object") {
    return journal;
  }

  return {};
}

export async function loadWorkspace(uid, token) {
  if (!uid) {
    return null;
  }

  if (hasBff()) {
    try {
      const remoteWorkspace = normalizeWorkspace(
        normalizeWorkspaceResponse(await fetchTerminalWorkspace(uid)),
      );
      if (remoteWorkspace) {
        return remoteWorkspace;
      }
    } catch (error) {
      console.warn("BFF terminal workspace load failed, falling back to Firebase:", error);
    }
  }

  const workspace = normalizeWorkspace(await dbR(`terminal/workspaces/${uid}`, token));
  if (workspace) {
    return workspace;
  }
  return null;
}

export async function saveWorkspace(uid, token, workspace) {
  if (!uid) {
    return null;
  }

  const payload = normalizeWorkspace(workspace) || {
    journal: {},
    accountState: {},
    firmRules: {},
  };

  if (hasBff()) {
    try {
      await upsertTerminalWorkspace(uid, payload);
      return payload;
    } catch (error) {
      console.warn("BFF terminal workspace save failed, falling back to Firebase:", error);
    }
  }

  await dbW(`terminal/workspaces/${uid}`, payload, token);
  return payload;
}

export async function saveJournal(uid, token, journal) {
  if (!uid) {
    return null;
  }

  const payload = normalizeJournalPayload(journal);

  if (hasBff()) {
    try {
      await putTerminalJournal(uid, payload);
      return payload;
    } catch (error) {
      console.warn("BFF terminal journal save failed, falling back to Firebase:", error);
    }
  }

  await dbW(`terminal/workspaces/${uid}/journal`, payload, token);
  return payload;
}

export async function saveAccountState(uid, token, accountState) {
  if (!uid) {
    return null;
  }

  const payload = accountState || {};

  if (hasBff()) {
    try {
      await putTerminalAccountState(uid, payload);
      return payload;
    } catch (error) {
      console.warn(
        "BFF terminal account state save failed, falling back to Firebase:",
        error,
      );
    }
  }

  await dbW(`terminal/workspaces/${uid}/accountState`, payload, token);
  return payload;
}

export async function saveFirmRules(uid, token, firmRules) {
  if (!uid) {
    return null;
  }

  const payload = firmRules || {};

  if (hasBff()) {
    try {
      await putTerminalFirmRules(uid, payload);
      return payload;
    } catch (error) {
      console.warn(
        "BFF terminal firm rules save failed, falling back to Firebase:",
        error,
      );
    }
  }

  await dbW(`terminal/workspaces/${uid}/firmRules`, payload, token);
  return payload;
}

export default {
  saveAccountState,
  saveFirmRules,
  saveJournal,
  loadWorkspace,
  saveWorkspace,
};
