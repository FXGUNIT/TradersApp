/**
 * useOfflineStatus.js — tracks online/offline state via Service Worker messages.
 *
 * Listens for OFFLINE_STATUS messages from sw.js and also mirrors
 * navigator.onLine for fast initial state.
 *
 * Returns { isOnline, isSyncing } where isSyncing is true while queued
 * requests are being replayed after coming back online.
 */
import { useEffect, useState } from "react";

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          // Listen for OFFLINE_STATUS messages from sw.js
          const handler = (event) => {
            if (event.data?.type === "OFFLINE_STATUS") {
              setIsOnline(event.data.online);
              if (event.data.online) {
                // Trigger queue flush
                navigator.serviceWorker.ready.then((reg) => {
                  reg.active?.postMessage({ type: "FLUSH_QUEUE" });
                });
                setIsSyncing(true);
                // After 3s, assume queue is flushed
                setTimeout(() => setIsSyncing(false), 3000);
              }
            }
          };
          navigator.serviceWorker.addEventListener("message", handler);
          return () => navigator.serviceWorker.removeEventListener("message", handler);
        })
        .catch(() => {
          // SW registration is best-effort
        });
    }

    // Fallback to browser events (fired when connection state changes)
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return { isOnline, isSyncing };
}
