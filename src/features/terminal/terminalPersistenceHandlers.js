export const executeSaveJournal = async ({
  auth,
  journalData,
  saveTerminalJournal,
}) => {
  if (!auth?.uid || !auth?.token) {
    return;
  }
  await saveTerminalJournal(auth.uid, auth.token, journalData);
};

export const executeSaveAccount = async ({
  auth,
  accountData,
  saveTerminalAccountState,
}) => {
  if (!auth?.uid || !auth?.token) {
    return;
  }
  await saveTerminalAccountState(auth.uid, auth.token, accountData);
};

export const executeSaveFirmRules = async ({
  auth,
  firmRulesData,
  saveTerminalFirmRules,
}) => {
  if (!auth?.uid || !auth?.token) {
    return;
  }
  await saveTerminalFirmRules(auth.uid, auth.token, firmRulesData);
};

export default {
  executeSaveJournal,
  executeSaveAccount,
  executeSaveFirmRules,
};
