import {
  fetchTerminalWorkspace,
  normalizeWorkspaceResponse,
  putTerminalAccountState,
  putTerminalFirmRules,
  putTerminalJournal,
  upsertTerminalWorkspace,
} from "../gateways/terminalGateway.js";
import {
  createBffUnavailableResult,
  hasBff,
} from "../gateways/base.js";

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

  if (!hasBff()) {
    return null;
  }

  try {
    const remoteWorkspace = normalizeWorkspace(
      normalizeWorkspaceResponse(await fetchTerminalWorkspace(uid)),
    );
    if (remoteWorkspace) {
      return remoteWorkspace;
    }
  } catch (error) {
    console.warn("BFF terminal workspace load failed:", error);
  }

  return null;
}

function unavailableWriteResult(operation, extra = {}) {
  return createBffUnavailableResult(operation, {
    workspace: null,
    ...extra,
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

  if (!hasBff()) {
    return unavailableWriteResult("saveWorkspace", { workspace: payload });
  }

  try {
    await upsertTerminalWorkspace(uid, payload);
    return payload;
  } catch (error) {
    console.warn("BFF terminal workspace save failed:", error);
    return unavailableWriteResult("saveWorkspace", { workspace: payload });
  }
}

export async function saveJournal(uid, token, journal) {
  if (!uid) {
    return null;
  }

  const payload = normalizeJournalPayload(journal);

  if (!hasBff()) {
    return unavailableWriteResult("saveJournal", { journal: payload });
  }

  try {
    await putTerminalJournal(uid, payload);
    return payload;
  } catch (error) {
    console.warn("BFF terminal journal save failed:", error);
    return unavailableWriteResult("saveJournal", { journal: payload });
  }
}

export async function saveAccountState(uid, token, accountState) {
  if (!uid) {
    return null;
  }

  const payload = accountState || {};

  if (!hasBff()) {
    return unavailableWriteResult("saveAccountState", {
      accountState: payload,
    });
  }

  try {
    await putTerminalAccountState(uid, payload);
    return payload;
  } catch (error) {
    console.warn("BFF terminal account state save failed:", error);
    return unavailableWriteResult("saveAccountState", {
      accountState: payload,
    });
  }
}

export async function saveFirmRules(uid, token, firmRules) {
  if (!uid) {
    return null;
  }

  const payload = firmRules || {};

  if (!hasBff()) {
    return unavailableWriteResult("saveFirmRules", { firmRules: payload });
  }

  try {
    await putTerminalFirmRules(uid, payload);
    return payload;
  } catch (error) {
    console.warn("BFF terminal firm rules save failed:", error);
    return unavailableWriteResult("saveFirmRules", { firmRules: payload });
  }
}

export default {
  saveAccountState,
  saveFirmRules,
  saveJournal,
  loadWorkspace,
  saveWorkspace,
};
