const DEFAULT_PROOF_FRONTEND = "https://173.249.18.14.sslip.io/";
const DEFAULT_PROOF_BFF = "https://bff.173.249.18.14.sslip.io/health";
const DEFAULT_PROOF_API = "https://api.173.249.18.14.sslip.io/health";

function firstNonEmpty(...values) {
  for (const value of values) {
    const candidate = String(value || "").trim();
    if (candidate) {
      return candidate;
    }
  }

  return "";
}

function normalizeAbsoluteUrl(value, fallback) {
  const candidate = firstNonEmpty(value, fallback);
  return candidate.endsWith("/") ? candidate : `${candidate}/`;
}

function normalizeHealthUrl(value, fallback) {
  return firstNonEmpty(value, fallback);
}

export const PRIMARY_PROJECT_HOST = normalizeAbsoluteUrl(
  firstNonEmpty(
    import.meta.env.VITE_PROOF_FRONTEND,
    import.meta.env.VITE_PUBLIC_PROJECT_PREVIEW_URL
  ),
  DEFAULT_PROOF_FRONTEND
);

export const BFF_HEALTH_HOST = normalizeHealthUrl(
  firstNonEmpty(
    import.meta.env.VITE_PROOF_BFF,
    import.meta.env.VITE_PUBLIC_BFF_HEALTH_URL
  ),
  DEFAULT_PROOF_BFF
);

export const API_HEALTH_HOST = normalizeHealthUrl(
  firstNonEmpty(
    import.meta.env.VITE_PROOF_API,
    import.meta.env.VITE_PUBLIC_API_HEALTH_URL
  ),
  DEFAULT_PROOF_API
);
