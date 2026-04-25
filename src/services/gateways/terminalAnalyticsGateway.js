import { resolveBffBaseUrl } from "../runtimeConfig.js";

function buildAnalyticsUrl(path) {
  const baseUrl = resolveBffBaseUrl();
  if (baseUrl) {
    return path.startsWith("/") ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
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
