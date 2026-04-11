import { useEffect } from "react";

import { testTelegramConnectivity } from "../../services/telegramDiagnostics.js";

export function useTelegramDiagnosticsAuditEffect({
  enableTelegramDiagnostics,
}) {
  useEffect(() => {
    if (!enableTelegramDiagnostics) {
      return undefined;
    }

    const runDiagnostics = async () => {
      try {
        /* eslint-disable no-console */
        console.log("Starting Telegram connectivity audit via BFF proxy...");
        const diagnostics = await testTelegramConnectivity();

        console.log("Telegram audit complete:", diagnostics.summary);

        if (diagnostics.summary.status === "ALL_SYSTEMS_OPERATIONAL") {
          console.log("Telegram system is fully operational");
        } else {
          /* eslint-enable no-console */
          console.warn(
            "Telegram system issues detected:",
            diagnostics.summary,
          );
        }
      } catch (error) {
        console.error("Telegram connectivity audit failed:", error);
      }
    };

    const timer = setTimeout(runDiagnostics, 500);
    return () => clearTimeout(timer);
  }, [enableTelegramDiagnostics]);
}

export default useTelegramDiagnosticsAuditEffect;
