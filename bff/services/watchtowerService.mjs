import boardRoomService from "./boardRoomService.mjs";
import {
  refreshAgentHeartbeat,
  reportGovernanceIncident,
} from "./boardRoomAgentReporter.mjs";
import watchtowerScheduler from "./watchtowerScheduler.mjs";
import { notifyFault as telegramNotifyFault, notifyResolved as telegramNotifyResolved } from "./watchtowerTelegramReporter.mjs";

export const WATCHTOWER_REFRESH_MS = Math.max(
  60_000,
  Number(process.env.WATCHTOWER_REFRESH_MS || 15 * 60 * 1000),
);

const WATCHTOWER_AGENT = "Watchtower";
const REPORT_COOLDOWN_MS = Math.max(
  60_000,
  Number(process.env.WATCHTOWER_REPORT_COOLDOWN_MS || 60 * 60 * 1000),
);

const WATCHTOWER_RULES = {
  BFF_HEALTH_FAILED: {
    ownerAgent: "BFFGateway",
    subsystem: "bff",
    ruleId: "board-room.always-connected",
    expected: "The app control plane must expose a healthy BFF bridge.",
    correctiveAction:
      "Restore the BFF process, verify /health, and add a guard for the failing startup or proxy path.",
  },
  BOARD_ROOM_STORAGE_DEGRADED: {
    ownerAgent: "BoardRoom",
    subsystem: "board-room",
    ruleId: "board-room.durable-memory-required",
    expected: "Board Room incidents, tasks, and agent memory must be durable.",
    correctiveAction:
      "Restore the configured durable store. Use Redis only when intentionally required; otherwise keep the VPS/file store mounted and verify incident IDs survive restart.",
  },
  AI_KEYS_MISSING: {
    ownerAgent: "FrontendAI.Router",
    subsystem: "ai",
    ruleId: "ai.provider-readiness",
    expected: "At least one AI provider must be configured before council work is marked available.",
    correctiveAction:
      "Keep the council unready, name the missing provider keys, and verify /ai/status after configuration.",
  },
  AI_ALL_OFFLINE: {
    ownerAgent: "FrontendAI.Router",
    subsystem: "ai",
    ruleId: "ai.provider-availability",
    expected: "At least one configured AI provider must be online.",
    correctiveAction:
      "Reprobe each configured provider, isolate shared auth/network failure, and keep failover status visible.",
  },
  AI_PARTIAL_OFFLINE: {
    ownerAgent: "FrontendAI.Router",
    subsystem: "ai",
    ruleId: "ai.provider-availability",
    expected: "All configured AI providers must truthfully report their availability.",
    correctiveAction:
      "Name the offline provider, keep council status degraded, and require a clean provider probe before full status returns.",
  },
  ML_HEALTH_FAILED: {
    ownerAgent: "MLEngine",
    subsystem: "ml",
    ruleId: "ml.health-before-use",
    expected: "ML-backed features must prove engine health before model-dependent decisions.",
    correctiveAction:
      "Repair/restart the ML engine, verify /ml/health, and add a regression guard for the failing model path.",
  },
  ML_CONSENSUS_DEGRADED: {
    ownerAgent: "ConsensusEngine",
    subsystem: "consensus",
    ruleId: "consensus.no-silent-fallback",
    expected: "Consensus must disclose degraded ML inputs and avoid silent fallback.",
    correctiveAction:
      "Keep the response flagged as fallback, restore required candles/models, and add a test for the failure mode.",
  },
  NEWS_LIVE_OFFLINE: {
    ownerAgent: "NewsIntelligence",
    subsystem: "news",
    ruleId: "news.live-feed-required",
    expected: "Breaking news must expose an explicit reachable status.",
    correctiveAction:
      "Restore the live source or keep the news bar in a clear offline state with the failing endpoint named.",
  },
  NEWS_CALENDAR_OFFLINE: {
    ownerAgent: "NewsIntelligence",
    subsystem: "news",
    ruleId: "news.calendar-required",
    expected: "Scheduled economic news must expose an explicit reachable status.",
    correctiveAction:
      "Restore the calendar source or keep scheduled news clearly offline with the failing endpoint named.",
  },
  WATCHTOWER_SCAN_FAILED: {
    ownerAgent: WATCHTOWER_AGENT,
    subsystem: "watchtower",
    ruleId: "watchtower.must-never-go-dark",
    expected: "Watchtower must keep scanning and reporting even when one dependency fails.",
    correctiveAction:
      "Fix the scan exception, preserve the last known status, and add a test for the failing scan branch.",
  },
};

let daemonTimer = null;
let schedulerHandle = null;
let currentScanTimer = null;
let inflightScan = null;
let serviceBaseUrl = null;
// Tracks cooldown by key → timestamp (original)
const reportedFaults = new Map();
// Tracks full fault data by key → { threadId, reportedAt, lastProbedAt, status }
const reportedFaultsFull = new Map();

const ESCALATION_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours before escalation

let lastStatus = {
  ok: false,
  status: "checking",
  label: "WATCHTOWER CHECKING",
  faults: [],
  corrections: [],
  systems: {},
  refreshedAt: null,
  elapsedMs: 0,
  refreshMs: WATCHTOWER_REFRESH_MS,
  daemon: {
    active: false,
    baseUrl: null,
  },
};

function createFault(code, title, detail, severity = "medium", extra = {}) {
  const rule = WATCHTOWER_RULES[code] || WATCHTOWER_RULES.WATCHTOWER_SCAN_FAILED;
  return {
    code,
    title,
    detail,
    severity,
    ownerAgent: extra.ownerAgent || rule.ownerAgent,
    subsystem: extra.subsystem || rule.subsystem,
    ruleId: extra.ruleId || rule.ruleId,
    expected: extra.expected || rule.expected,
    correctiveAction: extra.correctiveAction || rule.correctiveAction,
    observedAt: new Date().toISOString(),
    reportToBoardRoom: extra.reportToBoardRoom !== false,
  };
}

function buildStatus(faults) {
  if (faults.some((fault) => fault.severity === "critical")) return "fault";
  if (faults.length > 0) return "degraded";
  return "healthy";
}

function toBoardRoomSeverity(severity) {
  const normalized = String(severity || "medium").toLowerCase();
  if (normalized === "critical") return "CRITICAL";
  if (normalized === "high") return "HIGH";
  if (normalized === "low") return "LOW";
  return "MEDIUM";
}

function resolveBaseUrl({ host = "127.0.0.1", port = 8788, baseUrl = null } = {}) {
  if (baseUrl) return String(baseUrl).replace(/\/+$/, "");
  const localHost = !host || host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  return `http://${localHost}:${port}`;
}

async function fetchJson(path, { timeoutMs = 6000 } = {}) {
  const url = `${serviceBaseUrl}${path}`;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "TradersApp-Watchtower/1.0" },
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
  const engines = Array.isArray(aiResult?.data?.engines) ? aiResult.data.engines : [];
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

function faultReportKey(fault) {
  return [
    fault.ownerAgent,
    fault.ruleId,
    fault.code,
    String(fault.detail || "").slice(0, 240),
  ].join(":");
}

async function reportFaults(faults, systems) {
  await Promise.all(
    faults
      .filter((fault) => fault.reportToBoardRoom !== false)
      .map(async (fault) => {
        const key = faultReportKey(fault);
        const previous = reportedFaults.get(key) || 0;
        if (Date.now() - previous < REPORT_COOLDOWN_MS) return null;

        const result = await reportGovernanceIncident({
          agent: fault.ownerAgent,
          subsystem: fault.subsystem,
          ruleId: fault.ruleId,
          title: `[${fault.ownerAgent}] ${fault.title}`,
          expected: fault.expected,
          evidence: fault.detail,
          correctiveAction: fault.correctiveAction,
          severity: toBoardRoomSeverity(fault.severity),
          source: WATCHTOWER_AGENT,
          tags: [fault.code.toLowerCase()],
        }).catch(() => null);

        if (result) {
          reportedFaults.set(key, Date.now());
          reportedFaultsFull.set(key, {
            ...fault,
            threadId: result.threadId,
            reportedAt: Date.now(),
            lastProbedAt: Date.now(),
            status: "open",
          });
          // Send Telegram alert
          void telegramNotifyFault({
            fault,
            ownerAgent: fault.ownerAgent,
            correctiveAction: fault.correctiveAction,
            threadId: result.threadId,
          });
        }
        return result;
      }),
  );
  // Re-probe tracked faults for resolution
  if (systems) {
    for (const [key, tracked] of reportedFaultsFull) {
      if (tracked.status !== "resolved") {
        void probeAndResolve(key, tracked, systems);
      }
    }
  }
}

export function getWatchtowerStatus() {
  return lastStatus;
}

export async function runWatchtowerScan(options = {}) {
  if (inflightScan) return inflightScan;
  if (options.baseUrl) {
    serviceBaseUrl = resolveBaseUrl(options);
  } else if (!serviceBaseUrl) {
    serviceBaseUrl = resolveBaseUrl(options);
  }

  inflightScan = (async () => {
    const startedAt = Date.now();
    const faults = [];
    const corrections = [];

    try {
      refreshAgentHeartbeat({
        agent: WATCHTOWER_AGENT,
        status: "active",
        focus: "Scanning BFF, AI, ML, consensus, news, and Board Room governance.",
      });

      const [health, boardRoomStorage] = await Promise.all([
        fetchJson("/health", { timeoutMs: 4000 }),
        boardRoomService.getStorageHealth(),
      ]);

      if (!health.ok) {
        faults.push(
          createFault(
            "BFF_HEALTH_FAILED",
            "BFF health failed",
            health.error || "BFF /health did not return ok=true.",
            "critical",
          ),
        );
      }

      if (boardRoomStorage?.degraded) {
        faults.push(
          createFault(
            "BOARD_ROOM_STORAGE_DEGRADED",
            "Board Room storage degraded",
            `Board Room is using ${boardRoomStorage.mode}; Redis is not connected (${boardRoomStorage.lastRedisNotice || "no Redis connection"}).`,
            "high",
          ),
        );
      }

      let aiResult = null;
      let mlResult = null;
      let consensusResult = null;
      let breakingNewsResult = null;
      let calendarResult = null;

      if (health.ok) {
        [aiResult, mlResult, consensusResult, breakingNewsResult, calendarResult] =
          await Promise.all([
            fetchJson("/ai/status", { timeoutMs: 5000 }),
            fetchJson("/ml/health", { timeoutMs: 7000 }),
            fetchJson("/ml/consensus?session=1&symbol=MNQ", { timeoutMs: 15000 }),
            fetchJson("/news/breaking?max=3", { timeoutMs: 10000 }),
            fetchJson("/news/upcoming", { timeoutMs: 10000 }),
          ]);
      }

      const ai = summarizeAi(aiResult);
      if (health.ok && !aiResult?.ok) {
        faults.push(
          createFault(
            "AI_ALL_OFFLINE",
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

      if (health.ok && consensusResult && !consensusResult.ok) {
        faults.push(
          createFault(
            "ML_CONSENSUS_DEGRADED",
            "ML consensus degraded",
            consensusResult?.data?.error ||
              consensusResult?.error ||
              "BFF /ml/consensus returned a fallback response.",
            "medium",
          ),
        );
      }

      if (health.ok && !breakingNewsResult?.ok) {
        faults.push(
          createFault(
            "NEWS_LIVE_OFFLINE",
            "Live news offline",
            breakingNewsResult?.error || "BFF /news/breaking did not return ok=true.",
            "medium",
          ),
        );
      }

      if (health.ok && !calendarResult?.ok) {
        faults.push(
          createFault(
            "NEWS_CALENDAR_OFFLINE",
            "Scheduled news offline",
            calendarResult?.error || "BFF /news/upcoming did not return ok=true.",
            "medium",
          ),
        );
      }

      const status = buildStatus(faults);
      lastStatus = {
        ok: status === "healthy",
        status,
        label:
          status === "healthy"
            ? "WATCHTOWER OK"
            : `WATCHTOWER ${faults.length} FAULT${faults.length === 1 ? "" : "S"}`,
        faults,
        corrections,
        systems: {
          bff: health,
          boardRoom: boardRoomStorage,
          ai,
          ml: mlResult,
          consensus: consensusResult,
          liveNews: breakingNewsResult,
          scheduledNews: calendarResult,
        },
        refreshedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
        refreshMs: WATCHTOWER_REFRESH_MS,
        daemon: {
          active: Boolean(daemonTimer),
          baseUrl: serviceBaseUrl,
        },
      };

      refreshAgentHeartbeat({
        agent: WATCHTOWER_AGENT,
        status: status === "healthy" ? "active" : "investigating",
        focus:
          status === "healthy"
            ? "All watched systems are healthy."
            : `Investigating ${faults.length} active fault${faults.length === 1 ? "" : "s"}.`,
      });

      await reportFaults(faults);
      return lastStatus;
    } catch (error) {
      const fault = createFault(
        "WATCHTOWER_SCAN_FAILED",
        "Watchtower scan failed",
        error?.message || "Unexpected Watchtower exception.",
        "critical",
      );
      lastStatus = {
        ...lastStatus,
        ok: false,
        status: "fault",
        label: "WATCHTOWER SCAN FAILED",
        faults: [fault],
        refreshedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
      };
      await reportFaults([fault]);
      return lastStatus;
    } finally {
      inflightScan = null;
    }
  })();

  return inflightScan;
}

export function startWatchtowerDaemon(options = {}) {
  if (String(process.env.WATCHTOWER_DISABLED || "false").toLowerCase() === "true") {
    return false;
  }
  serviceBaseUrl = resolveBaseUrl(options);
  if (daemonTimer) return true;

  const run = () => {
    void runWatchtowerScan({ baseUrl: serviceBaseUrl });
  };

  setTimeout(run, Number(process.env.WATCHTOWER_START_DELAY_MS || 2_000));
  daemonTimer = setInterval(run, WATCHTOWER_REFRESH_MS);
  if (typeof daemonTimer.unref === "function") daemonTimer.unref();
  return true;
}

export function stopWatchtowerDaemon() {
  if (daemonTimer) {
    clearInterval(daemonTimer);
    daemonTimer = null;
  }
}

export default {
  getWatchtowerStatus,
  runWatchtowerScan,
  startWatchtowerDaemon,
  stopWatchtowerDaemon,
  WATCHTOWER_REFRESH_MS,
};
