import { useEffect } from "react";

import { firebaseOptimizer } from "../../services/firebase.js";
import { setupConsoleInterceptor } from "../../services/telemetry.js";
import { setupNetworkMonitor } from "../../services/networkMonitor.js";
import { setupTTITracker } from "../../services/ttiTracker.js";
import { exposePerformanceTestToWindow } from "../../services/performanceTestRunner.js";
import { exposeSecurityAPIToWindow } from "../../services/securityMonitor.js";
import { initLeakagePrevention } from "../../services/leakagePreventionModule.js";
import { initSocialEngineeringDetection } from "../../services/socialEngineeringDetectionModule.js";
import { initTelegramMonitor } from "../../services/telegramMonitor.js";

export function useAdminDiagnosticsEffects({
  isAdminAuthenticated,
  setDebugLogs,
  setDebugLatencies,
  setDebugTTI,
  showToast,
  telegramToken,
  telegramChatId,
}) {
  useEffect(() => {
    if (!isAdminAuthenticated) return undefined;

    const restoreConsole = setupConsoleInterceptor(setDebugLogs);
    const restoreNetwork = setupNetworkMonitor(setDebugLatencies);
    return () => {
      restoreConsole();
      restoreNetwork();
    };
  }, [isAdminAuthenticated, setDebugLatencies, setDebugLogs]);

  useEffect(() => {
    if (!isAdminAuthenticated) return undefined;

    const restoreTTI = setupTTITracker(setDebugTTI);
    return restoreTTI;
  }, [isAdminAuthenticated, setDebugTTI]);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      return undefined;
    }

    try {
      /* eslint-disable no-console */
      exposePerformanceTestToWindow();
      console.log(
        "Performance tests initialized - accessible via window.__performanceTest",
      );

      exposeSecurityAPIToWindow();
      console.log(
        "Security monitor initialized - accessible via window.__SecurityMonitor",
      );

      initLeakagePrevention(showToast);
      console.log(
        "Leakage Prevention module initialized - accessible via window.__LeakagePrevention",
      );

      initSocialEngineeringDetection(showToast);
      console.log(
        "Social Engineering Detection initialized - accessible via window.__SocialEngineeringDetection",
      );

      initTelegramMonitor(telegramToken, telegramChatId);
      console.log(
        "Telegram Monitor initialized - use window.__TelegramMonitor for diagnostics",
      );

      window.__FirebaseOptimizerMetrics = () =>
        firebaseOptimizer.getMetrics();
      console.log(
        "Firebase Optimizer active - use window.__FirebaseOptimizerMetrics() for stats",
      );
      /* eslint-enable no-console */
    } catch (error) {
      console.error("Failed to initialize admin systems:", error);
      showToast(`Admin setup failed: ${error.message}`, "error");
    }
  }, [isAdminAuthenticated, showToast, telegramChatId, telegramToken]);
}

export default useAdminDiagnosticsEffects;
