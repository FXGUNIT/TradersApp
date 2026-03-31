import { useEffect } from "react";

export function useConnectionStatusEffect({ showToast }) {
  useEffect(() => {
    let isOnline = navigator.onLine;

    if (!isOnline) {
      showToast(
        "Offline Protocol Engaged. Using cached memory. Sync pending.",
        "warning",
      );
    }

    const handleOnline = () => {
      if (!isOnline) {
        isOnline = true;
        showToast(
          "Network bridge restored. Data synchronization in progress...",
          "success",
        );

        const reconnectEvent = new CustomEvent("connectionRestored", {
          detail: { timestamp: Date.now() },
        });
        window.dispatchEvent(reconnectEvent);
      }
    };

    const handleOffline = () => {
      if (isOnline) {
        isOnline = false;
        showToast(
          "Network link severed. Verify connection strength and retry.",
          "warning",
        );

        const disconnectEvent = new CustomEvent("connectionLost", {
          detail: { timestamp: Date.now() },
        });
        window.dispatchEvent(disconnectEvent);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [showToast]);
}

export default useConnectionStatusEffect;
