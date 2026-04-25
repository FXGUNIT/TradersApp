import {
  getBffGatewayState,
  hasBff,
  probeBffHealth,
} from "./gateways/base.js";
import {
  fetchNewsSystemStatus,
  getInitialNewsSystemStatus,
} from "./clients/NewsStatusClient.js";
import { resolveBffBaseUrl } from "./runtimeConfig.js";

export const WATCHTOWER_REFRESH_MS = 30 * 1000;

let watchtowerInterval = null;
let watchtowerInflight = null;

function createFault(code, title, detail, severity = "medium") {
  return { code, title, detail, severity };
}

function buildUrl(path) {
  const base = resolveBffBaseUrl();
  if (!base) return path;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

async function fetchJson(path, { timeoutMs = 6000 } = {}) {
  try {
    const response = await fetch(buildUrl(path), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await response.json().catch(() => ({}));
    return {
      ok: response.ok && data?.ok !== false,
      httpOk: response.ok,
      status: response.status,
      data,
      error: response.ok
        ? data?.error || null
        : data?.error || data?.message || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      httpOk: false,
      status: 0,
      data: null,
      error: error?.message || "Request failed.",
    };
  }
}

function summarizeAi(aiResult) {
  const engines = Array.isArray(aiResult?.data?.engines)
    ? aiResult.data.engines
    : [];
  const configured = engines.filter((engine) => engine?.configured).length;
  const online = engines.filter((engine) => engine?.online).length;

  return {
    ok: Boolean(aiResult?.ok),
    engines,
    configured,
    online,
    total: engines.length,
  };
}

function summarizeNewsFaults(newsStatus) {
  const faults = [];
  if (newsStatus?.liveNews?.state === "offline") {
    faults.push(
      createFault(
        "NEWS_LIVE_OFFLINE",
        "Live news offline",
        newsStatus.liveNews.detail || "Breaking-news endpoint is not reachable.",
        "medium",
      ),
    );
  }
  if (newsStatus?.scheduledNews?.state === "offline") {
    faults.push(
      createFault(
        "NEWS_CALENDAR_OFFLINE",
        "Scheduled news offline",
        newsStatus.scheduledNews.detail ||
          "Economic-calendar endpoint is not reachable.",
        "medium",
      ),
    );
  }
  return faults;
}

function buildStatus(faults) {
  if (faults.some((fault) => fault.severity === "critical")) {
    return "fault";
  }
  if (faults.length > 0) {
    return "degraded";
  }
  return "healthy";
}

export function getInitialWatchtowerStatus() {
  return {
    status: "checking",
    label: "WATCHTOWER CHECKING",
    faults: [],
    corrections: [],
    systems: {},
    news: getInitialNewsSystemStatus(),
    refreshedAt: null,
  };
}

export async function runWatchtowerScan() {
  const startedAt = Date.now();
  const faults = [];
  const corrections = [];
  const gatewayBefore = getBffGatewayState();
  const health = await probeBffHealth({ timeoutMs: 4000 });
  const gatewayAfter = getBffGatewayState();

  if (gatewayBefore.inCooldown && health.ok && !gatewayAfter.inCooldown) {
    corrections.push({
      code: "BFF_COOLDOWN_CLEARED",
      title: "Cleared stale BFF cooldown",
      detail: `${gatewayAfter.baseUrl}/health is reachable again.`,
    });
  }

  if (!health.ok) {
    faults.push(
      createFault(
        "BFF_HEALTH_FAILED",
        "BFF health failed",
        health.error || "Frontend cannot reach the BFF health endpoint.",
        "critical",
      ),
    );
  }

  let aiResult = null;
  let mlResult = null;
  let newsStatus = getInitialNewsSystemStatus();

  if (health.ok && hasBff()) {
    [aiResult, mlResult, newsStatus] = await Promise.all([
      fetchJson("/ai/status", { timeoutMs: 5000 }),
      fetchJson("/ml/health", { timeoutMs: 6000 }),
      fetchNewsSystemStatus(),
    ]);
  } else if (!gatewayAfter.auditRuntime && gatewayAfter.baseUrl) {
    newsStatus = await fetchNewsSystemStatus();
  }

  const ai = summarizeAi(aiResult);
  if (health.ok && !aiResult?.ok) {
    faults.push(
      createFault(
        "AI_STATUS_FAILED",
        "AI status check failed",
        aiResult?.error || "BFF /ai/status did not return usable data.",
        "high",
      ),
    );
  } else if (ai.total > 0 && ai.configured === 0) {
    faults.push(
      createFault(
        "AI_KEYS_MISSING",
        "All AI engines need keys",
        "No provider key is configured, so the AI council cannot run.",
        "high",
      ),
    );
  } else if (ai.configured > 0 && ai.online === 0) {
    faults.push(
      createFault(
        "AI_ALL_OFFLINE",
        "Configured AI engines are offline",
        "Provider keys exist, but none of the configured engines are online.",
        "high",
      ),
    );
  } else if (ai.configured > 0 && ai.online < ai.configured) {
    faults.push(
      createFault(
        "AI_PARTIAL_OFFLINE",
        "Some AI engines are offline",
        `${ai.online}/${ai.configured} configured engines are online.`,
        "medium",
      ),
    );
  }

  if (health.ok && !mlResult?.ok) {
    faults.push(
      createFault(
        "ML_HEALTH_FAILED",
        "ML engine health failed",
        mlResult?.error || "BFF /ml/health did not return ok=true.",
        "high",
      ),
    );
  }

  faults.push(...summarizeNewsFaults(newsStatus));

  const status = buildStatus(faults);
  const label =
    status === "healthy"
      ? "WATCHTOWER OK"
      : `WATCHTOWER ${faults.length} FAULT${faults.length === 1 ? "" : "S"}`;

  return {
    status,
    label,
    faults,
    corrections,
    systems: {
      bff: {
        ok: Boolean(health.ok),
        status: health.status,
        baseUrl: gatewayAfter.baseUrl,
        inCooldown: gatewayAfter.inCooldown,
      },
      ai,
      ml: {
        ok: Boolean(mlResult?.ok),
        status: mlResult?.status || 0,
        data: mlResult?.data || null,
      },
    },
    news: newsStatus,
    refreshedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
  };
}

export function startWatchtower(onStatusChange, options = {}) {
  const intervalMs = Number(options.intervalMs || WATCHTOWER_REFRESH_MS);

  if (watchtowerInterval) {
    clearInterval(watchtowerInterval);
    watchtowerInterval = null;
  }

  const run = async () => {
    if (watchtowerInflight) {
      return watchtowerInflight;
    }

    watchtowerInflight = runWatchtowerScan();
    try {
      const status = await watchtowerInflight;
      onStatusChange?.(status);
      return status;
    } finally {
      watchtowerInflight = null;
    }
  };

  void run();
  watchtowerInterval = setInterval(() => {
    void run();
  }, intervalMs);
}

export function stopWatchtower() {
  if (watchtowerInterval) {
    clearInterval(watchtowerInterval);
    watchtowerInterval = null;
  }
}

export default {
  getInitialWatchtowerStatus,
  runWatchtowerScan,
  startWatchtower,
  stopWatchtower,
  WATCHTOWER_REFRESH_MS,
};
