/**
 * TradersRegiment — App Shell
 * Reduced from 749 → ~170 lines (I07 + I09: ≤300L compliance)
 *
 * Architecture:
 *   App.jsx                  — thin shell: imports + providers + JSX mount
 *   TradersRegimentInner.jsx — full inner component
 */
import React from "react";

import DeveloperRootLanding from "./features/landing/DeveloperRootLanding.jsx";
import { DEVELOPER_PREVIEW_PATH } from "./config/proofHosts.js";
import { AppProviders } from "./features/identity/AppProviders.jsx";
import { TradersRegimentInner } from "./TradersRegimentInner.jsx";

const DEV_PREVIEW_PATHS = new Set([
  DEVELOPER_PREVIEW_PATH,
  `${DEVELOPER_PREVIEW_PATH}/`,
]);

function shouldRenderDeveloperLanding() {
  if (typeof window === "undefined") {
    return false;
  }

  const pathname = String(window.location.pathname || "").trim().toLowerCase();
  const searchParams = new URLSearchParams(window.location.search || "");
  const explicitDeveloperView =
    searchParams.get("view") === "developer" ||
    searchParams.get("developer") === "1";
  return DEV_PREVIEW_PATHS.has(pathname) || explicitDeveloperView;
}

export default function TradersRegiment() {
  if (shouldRenderDeveloperLanding()) {
    return <DeveloperRootLanding />;
  }

  return (
    <>
      {/* Skip to main content — first focusable element */}
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      {/* Screen reader live region — announces price updates, status changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="live-announcer"
      />

      <AppProviders>
        <TradersRegimentInner />
      </AppProviders>
    </>
  );
}
