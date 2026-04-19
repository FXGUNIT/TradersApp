import { useEffect, useRef } from "react";
import { auth } from "../../services/firebase.js";
import {
  clearAdminToken,
  getAdminToken as getStoredAdminToken,
} from "../../services/sessionStore.js";
import { sendTelegramAlert } from "../../utils/securityAlertUtils.js";

export function useAdminSessionRestoreEffect({
  setIsAdminAuthenticated,
  setScreen,
  setIsInitialLoading,
  authBootstrapCompleteRef,
}) {
  const restoreAttempted = useRef(false);

  useEffect(() => {
    // Prevent double-run in React StrictMode
    if (restoreAttempted.current) return;
    restoreAttempted.current = true;

    const attemptRestore = async () => {
      try {
        const savedAdminStatus = localStorage.getItem("isAdminAuthenticated");
        const storedToken = await getStoredAdminToken();

        if (savedAdminStatus === "true" && storedToken) {
          // Validate token against BFF before restoring
          try {
            const res = await fetch(
              `${import.meta.env.VITE_BFF_URL || "/api"}/admin/session`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${storedToken}`,
                  "Content-Type": "application/json",
                },
              },
            );
            const data = await res.json().catch(() => ({ ok: false }));
            if (data.ok) {
              setIsAdminAuthenticated(true);
              setScreen("admin");
              sendTelegramAlert(
                "<b>ADMIN TERMINAL RESUMED</b>\nGod Mode session active on this device.",
              );
              setIsInitialLoading(false);
              authBootstrapCompleteRef.current = true;
              return;
            }
          } catch {
            // Token invalid or BFF down — fall through to login
          }

          // Token invalid — clear and go to login
          localStorage.removeItem("isAdminAuthenticated");
          await clearAdminToken();
        }
      } catch (error) {
        console.warn("Failed to restore admin session:", error);
      }

      if (!auth) {
        setScreen("login");
        setIsInitialLoading(false);
        authBootstrapCompleteRef.current = true;
      }
    };

    void attemptRestore();
  }, [
    authBootstrapCompleteRef,
    setIsAdminAuthenticated,
    setIsInitialLoading,
    setScreen,
  ]);
}

export default useAdminSessionRestoreEffect;
