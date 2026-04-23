import {
  CANONICAL_PUBLIC_FRONTEND_HOST,
  PUBLIC_BFF_BASE_URL,
} from "../config/proofHosts.js";

function getHostname() {
  if (typeof window === "undefined") {
    return "";
  }

  return String(window.location.hostname || "").trim().toLowerCase();
}

function isCanonicalFrontendHost(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return (
    normalized === CANONICAL_PUBLIC_FRONTEND_HOST ||
    normalized.endsWith(`.${CANONICAL_PUBLIC_FRONTEND_HOST}`)
  );
}

export function resolveBffBaseUrl() {
  const configured = String(import.meta.env.VITE_BFF_URL || "").trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (isCanonicalFrontendHost(getHostname())) {
    return PUBLIC_BFF_BASE_URL;
  }

  return "/api";
}

export function hasExplicitBffUrl() {
  return Boolean(String(import.meta.env.VITE_BFF_URL || "").trim());
}

export default {
  hasExplicitBffUrl,
  resolveBffBaseUrl,
};
