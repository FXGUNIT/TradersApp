import { useCallback, useEffect, useRef } from "react";
import { db as firebaseDb } from "../../services/firebase.js";
import { SecuritySentinel } from "../../services/securitySentinel.js";

export function useAdminSecuritySentinel({
  auth,
  isAdminAuthenticated,
  adminUid,
  showToast,
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!isAdminAuthenticated || !auth?.uid || !firebaseDb) {
      return undefined;
    }

    try {
      const sentinel = new SecuritySentinel(
        firebaseDb,
        auth.uid,
        adminUid,
        showToast,
        window.sendTelegramAlert,
      );
      sentinel.activate();
      sentinelRef.current = sentinel;
      window.securitySentinel = sentinel;
      showToast("Atomic Sentinel Online: 4-Layer Perimeter Secure", "success");
      console.warn("Security Sentinel activated for user:", auth.uid);
    } catch (error) {
      console.error("Security Sentinel initialization failed:", error);
      console.error("Details:", {
        auth_uid: auth?.uid,
        firebaseDb_exists: !!firebaseDb,
        admin_uid: adminUid,
        showToast_exists: !!showToast,
        sendTelegramAlert_exists: !!window.sendTelegramAlert,
      });
    }

    return () => {
      sentinelRef.current?.deactivate?.();
      sentinelRef.current = null;
      if (window.securitySentinel) {
        delete window.securitySentinel;
      }
    };
  }, [adminUid, auth?.uid, isAdminAuthenticated, showToast]);

  const recordAdminActivity = useCallback(
    (action, target = null) => {
      const sentinel = sentinelRef.current;
      if (!isAdminAuthenticated || !sentinel) {
        return true;
      }

      const result = sentinel.antiHacker.recordAdminActivity(action, target);
      if (result?.blocked) {
        showToast(
          "Admin panel is LOCKED. Detected bot activity. OTP required to unlock.",
          "error",
        );
        return false;
      }

      if (result?.isSuspicious) {
        console.warn(
          "Unusual click speed detected:",
          result.clicksPerSecond,
          "clicks/sec",
        );
      }

      return true;
    },
    [isAdminAuthenticated, showToast],
  );

  return { recordAdminActivity };
}

export default useAdminSecuritySentinel;
