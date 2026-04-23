const PAGES_ROOT_HOSTS = new Set(["tradergunit.pages.dev"]);

function getHostname() {
  if (typeof window === "undefined") {
    return "";
  }

  return String(window.location.hostname || "").trim().toLowerCase();
}

function isPagesDeveloperRootHost(hostname) {
  return (
    PAGES_ROOT_HOSTS.has(hostname) ||
    hostname.endsWith(".tradergunit.pages.dev")
  );
}

export function resolveBffBaseUrl() {
  const configured = String(import.meta.env.VITE_BFF_URL || "").trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (isPagesDeveloperRootHost(getHostname())) {
    return "";
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
