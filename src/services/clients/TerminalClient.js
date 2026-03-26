import { dbR, dbW } from "../../utils/firebaseDbUtils.js";

export async function loadWorkspace(uid, token) {
  const workspace = await dbR(`terminal/workspaces/${uid}`, token);
  if (workspace) return workspace;

  const legacy = await dbR(`users/${uid}`, token);
  if (!legacy) return null;

  return {
    journal: legacy.journal || {},
    accountState: legacy.accountState || {},
    firmRules: legacy.firmRules || {},
  };
}

export async function saveWorkspace(uid, token, workspace) {
  await dbW(`terminal/workspaces/${uid}`, workspace, token);
  return workspace;
}

export default {
  loadWorkspace,
  saveWorkspace,
};
