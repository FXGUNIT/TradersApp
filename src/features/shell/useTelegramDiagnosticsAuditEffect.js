import { useEffect } from "react";

import { testTelegramConnectivity } from "../../services/telegramDiagnostics.js";

export function useTelegramDiagnosticsAuditEffect({
  enableTelegramDiagnostics,
  telegramToken,
  telegramChatId,
}) {
  useEffect(() => {
    if (!enableTelegramDiagnostics || !telegramToken || !telegramChatId) {
      return undefined;
    }

    const runDiagnostics = async () => {
      try {
        /* eslint-disable no-console */
        console.log("Starting Telegram connectivity audit...");
        const diagnostics = await testTelegramConnectivity(
          telegramToken,
          telegramChatId,
        );

        console.log("Telegram audit complete:", diagnostics.summary);

        if (diagnostics.summary.status === "ALL_SYSTEMS_OPERATIONAL") {
          console.log("Telegram system is fully operational");
        } else {
          /* eslint-enable no-console */
          console.warn(
            "Telegram system issues detected:",
            diagnostics.summary,
          );

          try {
            await fetch(
              `https://api.telegram.org/bot${telegramToken}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: telegramChatId,
                  text: `<b>TELEGRAM CONNECTIVITY WARNING</b>\n<code>${diagnostics.summary.status}</code>\n\nDiagnostic tests: ${diagnostics.summary.passedTests}/${diagnostics.summary.totalTests} passed`,
                  parse_mode: "HTML",
                }),
              },
            );
          } catch (error) {
            console.error("Could not send diagnostic alert:", error);
          }
        }
      } catch (error) {
        console.error("Telegram connectivity audit failed:", error);
      }
    };

    const timer = setTimeout(runDiagnostics, 500);
    return () => clearTimeout(timer);
  }, [enableTelegramDiagnostics, telegramChatId, telegramToken]);
}

export default useTelegramDiagnosticsAuditEffect;
