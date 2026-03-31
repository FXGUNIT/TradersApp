import { useEffect } from "react";

export function useTerminalWorkspaceHydration({
  auth,
  profile,
  adminUid,
  loadTerminalWorkspace,
  setProfile,
}) {
  useEffect(() => {
    if (!auth?.uid || !profile?.uid || auth.uid === adminUid) {
      return undefined;
    }

    let active = true;

    const hydrateTerminalWorkspace = async () => {
      const workspace = await loadTerminalWorkspace(auth.uid, auth.token);
      if (!active || !workspace) {
        return;
      }

      const nextJournal = workspace.journal || {};

      setProfile((prev) => {
        if (!prev || prev.uid !== auth.uid) {
          return prev;
        }

        const nextAccountState = {
          ...(prev.accountState || {}),
          ...(workspace.accountState || {}),
        };
        const nextFirmRules = {
          ...(prev.firmRules || {}),
          ...(workspace.firmRules || {}),
        };

        const currentJournal = JSON.stringify(prev.journal || {});
        const currentAccountState = JSON.stringify(prev.accountState || {});
        const currentFirmRules = JSON.stringify(prev.firmRules || {});
        const incomingJournal = JSON.stringify(nextJournal);
        const incomingAccountState = JSON.stringify(nextAccountState);
        const incomingFirmRules = JSON.stringify(nextFirmRules);

        if (
          currentJournal === incomingJournal &&
          currentAccountState === incomingAccountState &&
          currentFirmRules === incomingFirmRules
        ) {
          return prev;
        }

        return {
          ...prev,
          journal: nextJournal,
          accountState: nextAccountState,
          firmRules: nextFirmRules,
        };
      });
    };

    void hydrateTerminalWorkspace();

    return () => {
      active = false;
    };
  }, [adminUid, auth?.token, auth?.uid, loadTerminalWorkspace, profile?.uid, setProfile]);
}

export default useTerminalWorkspaceHydration;
