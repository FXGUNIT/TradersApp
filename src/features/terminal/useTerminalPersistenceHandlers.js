import { useCallback } from "react";
import {
  executeSaveJournal,
  executeSaveAccount,
  executeSaveFirmRules,
} from "./terminalPersistenceHandlers.js";

export function useTerminalPersistenceHandlers({
  auth,
  saveTerminalJournal,
  saveTerminalAccountState,
  saveTerminalFirmRules,
}) {
  const saveJournal = useCallback(
    async (journalData) =>
      executeSaveJournal({
        auth,
        journalData,
        saveTerminalJournal,
      }),
    [auth, saveTerminalJournal],
  );

  const saveAccount = useCallback(
    async (accountData) =>
      executeSaveAccount({
        auth,
        accountData,
        saveTerminalAccountState,
      }),
    [auth, saveTerminalAccountState],
  );

  const saveFirmRules = useCallback(
    async (firmRulesData) =>
      executeSaveFirmRules({
        auth,
        firmRulesData,
        saveTerminalFirmRules,
      }),
    [auth, saveTerminalFirmRules],
  );

  return {
    saveJournal,
    saveAccount,
    saveFirmRules,
  };
}

export default useTerminalPersistenceHandlers;
