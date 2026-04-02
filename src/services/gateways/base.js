const BFF_BASE_URL = String(import.meta.env.VITE_BFF_URL || "").trim();

export function hasBff() {
  return Boolean(BFF_BASE_URL);
}

export function createBffUnavailableResult(operation, extra = {}) {
  return {
    success: false,
    error: `BFF unavailable for ${operation}.`,
    ...extra,
  };
}

function buildUrl(path) {
  if (!BFF_BASE_URL) {
    return path;
  }

  if (path.startsWith("/")) {
    return `${BFF_BASE_URL}${path}`;
  }

  return `${BFF_BASE_URL}/${path}`;
}

export async function bffFetch(path, options = {}) {
  if (!hasBff()) {
    return null;
  }

  try {
    const response = await fetch(buildUrl(path), options);
    // 401/403 = not authenticated yet, 404 = endpoint may not exist — treat as null, not error
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return null;
    }
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

export default {
  bffFetch,
  createBffUnavailableResult,
  hasBff,
};
