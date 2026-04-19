import { useEffect } from "react";
import { fetchIdentityUserStatus, upsertIdentitySession } from "../../services/gateways/identityGateway.js";
import {
  getDesktopRuntimeContext,
  isDesktopRuntime,
  notifyDesktopPolicy,
  requestDesktopUpdateCheck,
} from "../../services/desktopBridge.js";

const DESKTOP_POLICY_POLL_MS = 60 * 1000;

export function useDesktopClientPolicy({
  auth,
  currentSessionId,
  handleLogout,
  setMaintenanceModeActive,
  showToast,
}) {
  useEffect(() => {
    if (!auth?.uid || !isDesktopRuntime()) {
      return undefined;
    }

    let active = true;
    let enforcementInFlight = false;

    const pollPolicy = async () => {
      if (!active || enforcementInFlight) {
        return;
      }

      enforcementInFlight = true;

      try {
        const statusPayload = await fetchIdentityUserStatus(auth.uid);
        if (!active || !statusPayload) {
          return;
        }

        const clientPolicy = statusPayload.clientPolicy || statusPayload.data?.clientPolicy || null;
        if (!clientPolicy) {
          return;
        }

        if (typeof clientPolicy.maintenanceActive === "boolean") {
          setMaintenanceModeActive(clientPolicy.maintenanceActive);
        }

        if (currentSessionId) {
          const desktopContext = await getDesktopRuntimeContext();
          await upsertIdentitySession(auth.uid, currentSessionId, {
            platform: desktopContext.platform || "windows",
            appVersion: desktopContext.appVersion || null,
            installId: desktopContext.installId || null,
            deviceId: desktopContext.deviceId || null,
            lastPolicyCheckAt: new Date().toISOString(),
          });
        }

        if (clientPolicy.forceLogout || statusPayload.status === "BLOCKED") {
          const reason = clientPolicy.reason || "CLIENT_POLICY_EXIT";
          await notifyDesktopPolicy({
            reason,
            maintenanceActive: Boolean(clientPolicy.maintenanceActive),
            minimumDesktopVersion: clientPolicy.minimumDesktopVersion || null,
          }).catch(() => null);

          if (reason === "MINIMUM_DESKTOP_VERSION_REQUIRED") {
            showToast(
              `Desktop update required. Minimum supported version is ${clientPolicy.minimumDesktopVersion}.`,
              "warning",
            );
            await requestDesktopUpdateCheck({
              minimumDesktopVersion: clientPolicy.minimumDesktopVersion || null,
            }).catch(() => null);
          } else if (reason === "MAINTENANCE_MODE_ACTIVE") {
            showToast("Maintenance mode activated. Desktop session closing.", "warning");
          } else if (reason === "ACCOUNT_BLOCKED" || reason === "ACCOUNT_LOCKED") {
            showToast("Account access revoked. Desktop session closing.", "error");
          }

          await handleLogout();
        }
      } finally {
        enforcementInFlight = false;
      }
    };

    void pollPolicy();
    const intervalId = window.setInterval(() => {
      void pollPolicy();
    }, DESKTOP_POLICY_POLL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [
    auth?.uid,
    currentSessionId,
    handleLogout,
    setMaintenanceModeActive,
    showToast,
  ]);
}

export default useDesktopClientPolicy;
