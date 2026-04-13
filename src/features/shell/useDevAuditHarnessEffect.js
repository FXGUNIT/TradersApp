import { useEffect } from "react";

const AUDIT_MODE_KEY = "TradersApp_AuditMode";

function shouldEnableAuditHarness() {
  if (import.meta.env.DEV) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  if (window.__TRADERS_UI_AUDIT__ === true) {
    return true;
  }

  try {
    return localStorage.getItem(AUDIT_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

export function useDevAuditHarnessEffect({
  adminUid,
  adminEmail,
  setScreen,
  setAuth,
  setProfile,
  setIsAdminAuthenticated,
  setCurrentSessionId,
  setAppTheme,
  setMaintenanceModeActive,
}) {
  useEffect(() => {
    if (!shouldEnableAuditHarness()) {
      return undefined;
    }

    let cancelled = false;
    let cleanup = () => {};

    import("../../testing/appAuditHarness.js")
      .then(({ registerAppAuditHarness }) => {
        if (cancelled) return;

        cleanup = registerAppAuditHarness({
          adminUid,
          adminEmail,
          setScreen,
          setAuth,
          setProfile,
          setIsAdminAuthenticated,
          setCurrentSessionId,
          setTheme: setAppTheme,
          setAccentColor: () => {},
          setShowThemePicker: () => {},
          setMaintenanceModeActive,
        });
      })
      .catch((error) => {
        console.warn("App audit harness unavailable:", error);
      });

    return () => {
      cancelled = true;
      cleanup();
    };
    // Keep mount-only registration stable in dev so the audit runner can
    // always find window.__TradersAppAudit during initial boot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default useDevAuditHarnessEffect;
