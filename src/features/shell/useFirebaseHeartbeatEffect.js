import { useEffect } from "react";
import { onValue, ref } from "firebase/database";

import { firebaseOptimizer } from "../../services/firebase.js";

export function useFirebaseHeartbeatEffect({ firebaseDb }) {
  useEffect(() => {
    if (!firebaseDb) {
      return undefined;
    }

    let unsubscribe = null;
    let heartbeatCheckTimer = null;
    let lastHeartbeatTime = Date.now();

    const initializeHeartbeat = async () => {
      try {
        unsubscribe = firebaseOptimizer.createOptimizedListener(
          ".info/connected",
          (result) => {
            const isConnected = result.isBatched
              ? result.updates[result.updates.length - 1] === true
              : result === true;
            lastHeartbeatTime = Date.now();

            if (isConnected) {
              window.dispatchEvent(
                new CustomEvent("firebaseConnected", {
                  detail: { timestamp: lastHeartbeatTime, status: "healthy" },
                }),
              );
            } else {
              window.dispatchEvent(
                new CustomEvent("firebaseDisconnected", {
                  detail: {
                    timestamp: lastHeartbeatTime,
                    status: "reconnecting",
                  },
                }),
              );
            }
          },
          firebaseDb,
          ref,
          onValue,
        );

        heartbeatCheckTimer = setInterval(() => {
          const timeSinceLastHeartbeat = Date.now() - lastHeartbeatTime;

          if (timeSinceLastHeartbeat > 10000) {
            window.dispatchEvent(
              new CustomEvent("firebaseHeartbeatTimeout", {
                detail: {
                  timestamp: Date.now(),
                  status: "stale",
                  lastHeartbeat: timeSinceLastHeartbeat,
                },
              }),
            );
          }
        }, 5000);
      } catch (error) {
        console.error("Firebase heartbeat initialization error:", error);
      }
    };

    void initializeHeartbeat();

    return () => {
      if (unsubscribe) unsubscribe();
      if (heartbeatCheckTimer) clearInterval(heartbeatCheckTimer);
    };
  }, [firebaseDb]);
}

export default useFirebaseHeartbeatEffect;
