const BFF_BASE_URL = String(import.meta.env.VITE_BFF_URL || "").trim();

function buildAnalyticsUrl(path) {
  if (BFF_BASE_URL) {
    return path.startsWith("/") ? `${BFF_BASE_URL}${path}` : `${BFF_BASE_URL}/${path}`;
  }

  return path.startsWith("/api") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
}

export async function postTerminalAnalytics(route, payload = {}) {
  const response = await fetch(
    buildAnalyticsUrl(`/terminal/analytics/${route}`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }

  return data;
}

export default {
  postTerminalAnalytics,
};
