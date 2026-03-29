import { dbM, dbR, dbW } from "../../utils/firebaseDbUtils.js";
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

async function mirrorLegacyWorkspace(uid, token, workspace) {
  const legacyPayload = {};

  if (workspace?.journal !== undefined) {
    legacyPayload.journal = normalizeJournalPayload(workspace.journal);
  }

  if (workspace?.accountState !== undefined) {
    legacyPayload.accountState = workspace.accountState || {};
  }

  if (workspace?.firmRules !== undefined) {
    legacyPayload.firmRules = workspace.firmRules || {};
  }

  if (Object.keys(legacyPayload).length > 0) {
    await dbM(`users/${uid}`, legacyPayload, token);
  }
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

  const legacy = await dbR(`users/${uid}`, token);
  if (!legacy) return null;

  return normalizeWorkspace({
    journal: legacy.journal || {},
    accountState: legacy.accountState || {},
    firmRules: legacy.firmRules || {},
  });
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
    } catch (error) {
      console.warn("BFF terminal workspace save failed, falling back to Firebase:", error);
    }
  }

  await dbW(`terminal/workspaces/${uid}`, payload, token);
  await mirrorLegacyWorkspace(uid, token, payload);
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
    } catch (error) {
      console.warn("BFF terminal journal save failed, falling back to Firebase:", error);
    }
  }

  await dbM(`terminal/workspaces/${uid}`, { journal: payload }, token);
  await dbW(`users/${uid}/journal`, payload, token);
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
    } catch (error) {
      console.warn(
        "BFF terminal account state save failed, falling back to Firebase:",
        error,
      );
    }
  }

  await dbM(`terminal/workspaces/${uid}`, { accountState: payload }, token);
  await dbW(`users/${uid}/accountState`, payload, token);
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
    } catch (error) {
      console.warn(
        "BFF terminal firm rules save failed, falling back to Firebase:",
        error,
      );
    }
  }

  await dbM(`terminal/workspaces/${uid}`, { firmRules: payload }, token);
  await dbW(`users/${uid}/firmRules`, payload, token);
  return payload;
}

export default {
  saveAccountState,
  saveFirmRules,
  saveJournal,
  loadWorkspace,
  saveWorkspace,
};
