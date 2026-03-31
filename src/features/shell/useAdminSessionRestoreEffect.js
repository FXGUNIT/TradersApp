import { useEffect } from "react";

import { sendTelegramAlert } from "../../utils/securityAlertUtils.js";

export function useAdminSessionRestoreEffect({
  firebaseAuth,
  setIsAdminAuthenticated,
  setScreen,
  setIsInitialLoading,
  authBootstrapCompleteRef,
}) {
  useEffect(() => {
    try {
      const savedAdminStatus = localStorage.getItem("isAdminAuthenticated");
      if (savedAdminStatus === "true") {
        setIsAdminAuthenticated(true);
        setScreen("admin");
        sendTelegramAlert(
          "<b>ADMIN TERMINAL RESUMED</b>\nGod Mode session active on this device.",
        );
        setIsInitialLoading(false);
        authBootstrapCompleteRef.current = true;
        return;
      }
    } catch (error) {
      console.warn("Failed to restore admin session:", error);
    }

    if (!firebaseAuth) {
      setScreen("login");
      setIsInitialLoading(false);
      authBootstrapCompleteRef.current = true;
    }
  }, [
    authBootstrapCompleteRef,
    firebaseAuth,
    setIsAdminAuthenticated,
    setIsInitialLoading,
    setScreen,
  ]);
}

export default useAdminSessionRestoreEffect;
