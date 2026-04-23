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
import { AppProviders } from "./features/identity/AppProviders.jsx";
import { TradersRegimentInner } from "./TradersRegimentInner.jsx";

const DEV_ROOT_HOSTS = new Set([
  "tradergunit.is-a.dev",
]);
const DEV_PREVIEW_PATHS = new Set([
  "/developer",
  "/developer/",
  "/portfolio",
  "/portfolio/",
]);

function shouldRenderDeveloperLanding() {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = String(window.location.hostname || "").trim().toLowerCase();
  const pathname = String(window.location.pathname || "").trim().toLowerCase();
  return (
    DEV_ROOT_HOSTS.has(hostname) ||
    hostname.endsWith(".tradergunit.pages.dev") ||
    DEV_PREVIEW_PATHS.has(pathname)
  );
}

export default function TradersRegiment() {
  if (shouldRenderDeveloperLanding()) {
    return <DeveloperRootLanding />;
  }

  return (
    <AppProviders>
      <TradersRegimentInner />
    </AppProviders>
  );
}
