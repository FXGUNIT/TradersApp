/**
 * TradersRegiment — App Shell
 * Reduced from 749 → ~170 lines (I07 + I09: ≤300L compliance)
 *
 * Architecture:
 *   App.jsx                  — thin shell: imports + providers + JSX mount (~170L)
 *   TradersRegimentInner.jsx — full inner component (~270L)
 *   AuthStateContext         — auth/screen/bootstrap state
 *   AdminAccessContext       — admin gate state + handlers
 *   features/identity/useAuthSessionHandlers — auth action handlers
 *   features/admin-security/useAdminAccessHandlers — admin gate handlers
 */
import React, { Suspense } from "react";

import { AppProviders } from "./features/identity/AppProviders.jsx";
import { TradersRegimentInner } from "./TradersRegimentInner.jsx";
import SplashScreen from "./features/shell/SplashScreen.jsx";
import LoadingFallback from "./features/shell/LoadingFallback.jsx";

// ── Root export: mounts both providers ──────────────────────────────────────
export default function TradersRegiment() {
  return (
    <AppProviders>
      <TradersRegimentInner />
    </AppProviders>
  );
}
