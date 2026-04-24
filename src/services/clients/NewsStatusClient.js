import { bffFetch, hasBff } from "../gateways/base.js";

// Direct fetch for fallback chain — bypasses hasBff() cooldown gate so news never
// shows offline just because one consensus call triggered a cooldown window.
const bffDirectFetchMarker_v2 = async (path) => {
  try {
    const url = buildFallbackUrl(path);
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};

function buildFallbackUrl(path) {
  // Mirror bffFetch's URL building: use VITE_BFF_URL if set, else relative
  const base = String(import.meta.env.VITE_BFF_URL || "").trim();
  if (!base) return path;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

export const NEWS_STATUS_REFRESH_MS = 5 * 60 * 1000;
const SCHEDULED_NEWS_ACTIVE_WINDOW_MIN = 60;
const SCHEDULED_NEWS_RECENT_WINDOW_MIN = -15;

function createSignal(name, state, extra = {}) {
  return {
    name,
    state,
    ...extra,
  };
}

export function getInitialNewsSystemStatus() {
  return {
    liveNews: createSignal("Live News", "checking", {
      detail: "Refreshing live-news status...",
    }),
    scheduledNews: createSignal("Scheduled News", "checking", {
      detail: "Refreshing scheduled-news status...",
    }),
    refreshedAt: null,
  };
}

function buildLiveNewsSignal(consensus = null, breaking = null) {
  const items = Array.isArray(consensus?.breaking_news?.items)
    ? consensus.breaking_news.items
    : Array.isArray(breaking?.items)
      ? breaking.items
      : [];
  const highImpactCount = Number(
    consensus?.breaking_news?.highImpactCount || breaking?.highImpactCount || 0,
  );

  if (items.length > 0 || highImpactCount > 0) {
    return createSignal("Live News", "active", {
      detail:
        highImpactCount > 0
          ? `${items.length} live headline(s), ${highImpactCount} high impact.`
          : `${items.length} live headline(s) detected.`,
      count: items.length,
      highImpactCount,
    });
  }

  return createSignal("Live News", "inactive", {
    detail: "No live headline is active right now.",
    count: 0,
    highImpactCount: 0,
  });
}

function buildScheduledNewsSignal(consensus = null) {
  const news = consensus?.news || {};
  const nextEvent = news?.next_event || null;
  const rawTimeUntil = Number(nextEvent?.timeUntil_min);
  const hasNumericTimeUntil = Number.isFinite(rawTimeUntil);
  const isWithinEventWindow =
    hasNumericTimeUntil &&
    rawTimeUntil >= SCHEDULED_NEWS_RECENT_WINDOW_MIN &&
    rawTimeUntil <= SCHEDULED_NEWS_ACTIVE_WINDOW_MIN;
  const isRiskWindow =
    news?.trade_allowed === false || Boolean(news?.warning) || isWithinEventWindow;

  if (isRiskWindow) {
    const detail = nextEvent?.title
      ? hasNumericTimeUntil
        ? `${nextEvent.title} in ${rawTimeUntil} min.`
        : `${nextEvent.title} is the active scheduled event.`
      : news?.warning || "Scheduled-event window is active.";
    return createSignal("Scheduled News", "active", {
      detail,
      nextEvent,
      tradeAllowed: news?.trade_allowed !== false,
    });
  }

  if (nextEvent?.title) {
    const detail = hasNumericTimeUntil
      ? `${nextEvent.title} in ${rawTimeUntil} min.`
      : `${nextEvent.title} is queued, but not active right now.`;
    return createSignal("Scheduled News", "inactive", {
      detail,
      nextEvent,
      tradeAllowed: news?.trade_allowed !== false,
    });
  }

  return createSignal("Scheduled News", "inactive", {
    detail: "No scheduled event is active right now.",
    nextEvent: null,
    tradeAllowed: true,
  });
}

export async function fetchNewsSystemStatus() {
  const refreshedAt = new Date().toISOString();
  console.debug("[NewsStatus] hasBff:", hasBff(), "| VITE_BFF_URL:", import.meta.env.VITE_BFF_URL);

  if (!hasBff()) {
    return {
      liveNews: createSignal("Live News", "offline", {
        detail: "News source is offline.",
      }),
      scheduledNews: createSignal("Scheduled News", "offline", {
        detail: "Economic-calendar source is offline.",
      }),
      refreshedAt,
    };
  }

  // Try /ml/consensus first — has both live + scheduled in one call
  const consensus = await bffFetch("/ml/consensus?session=1");
  if (consensus) {
    const news = consensus?.news || {};
    const hasScheduled = Boolean(news?.next_event);
    const isRiskWindow = news?.trade_allowed === false || Boolean(news?.warning);

    return {
      liveNews: buildLiveNewsSignal(consensus, null),
      scheduledNews: hasScheduled
        ? buildScheduledNewsSignal(consensus)
        : createSignal("Scheduled News", "inactive", {
            detail: "No scheduled event is active right now.",
            nextEvent: null,
            tradeAllowed: true,
          }),
      refreshedAt,
    };
  }

  // Fallback: call news endpoints directly (ML consensus may fail if no candles loaded)
  // Use directFetch to bypass hasBff() cooldown gate — news should never show "offline"
  // just because one unrelated consensus call triggered the 2-minute cooldown window.
  const [breaking, upcoming] = await Promise.all([
    bffDirectFetchMarker_v2("/news/breaking?fresh=true"),
    bffDirectFetchMarker_v2("/news/upcoming"),
  ]);

  console.debug("[NewsStatus] fallback — breaking:", breaking ? "ok" : "null", "upcoming:", upcoming ? "ok" : "null");

  if (breaking !== null || upcoming !== null) {
    const liveItems = Array.isArray(breaking?.items) ? breaking.items : [];
    const highImpactCount = Number(breaking?.highImpactCount || 0);

    const liveNewsSignal =
      liveItems.length > 0 || highImpactCount > 0
        ? createSignal("Live News", "active", {
            detail:
              highImpactCount > 0
                ? `${liveItems.length} live headline(s), ${highImpactCount} high impact.`
                : `${liveItems.length} live headline(s) detected.`,
            count: liveItems.length,
            highImpactCount,
          })
        : createSignal("Live News", "inactive", {
            detail: "No live headline is active right now.",
            count: 0,
            highImpactCount: 0,
          });

    // /news/upcoming shape: { ok, events, next_event, upcoming_count, high_impact_count }
    const upcomingNextEvent = upcoming?.next_event || null;
    const upcomingTradeAllowed = upcoming?.trade_allowed !== false;
    const upcomingWarning = Boolean(upcoming?.warning);
    const hasUpcomingEvent = Boolean(upcomingNextEvent?.title);
    const isWithinWindow =
      hasUpcomingEvent &&
      upcomingNextEvent?.timeUntil_min !== null &&
      upcomingNextEvent?.timeUntil_min !== undefined &&
      Number.isFinite(Number(upcomingNextEvent.timeUntil_min)) &&
      Number(upcomingNextEvent.timeUntil_min) >= SCHEDULED_NEWS_RECENT_WINDOW_MIN &&
      Number(upcomingNextEvent.timeUntil_min) <= SCHEDULED_NEWS_ACTIVE_WINDOW_MIN;
    const isRiskWindow =
      upcomingTradeAllowed === false || upcomingWarning || isWithinWindow;

    let scheduledNewsSignal;
    if (isRiskWindow) {
      scheduledNewsSignal = createSignal("Scheduled News", "active", {
        detail: upcomingNextEvent?.title
          ? `${upcomingNextEvent.title} in ${upcomingNextEvent.timeUntil_min} min.`
          : upcomingWarning && upcoming?.warning
            ? upcoming.warning
            : "Scheduled-event window is active.",
        nextEvent: upcomingNextEvent,
        tradeAllowed: upcomingTradeAllowed,
      });
    } else if (hasUpcomingEvent) {
      scheduledNewsSignal = createSignal("Scheduled News", "inactive", {
        detail:
          Number.isFinite(Number(upcomingNextEvent.timeUntil_min))
            ? `${upcomingNextEvent.title} in ${upcomingNextEvent.timeUntil_min} min.`
            : `${upcomingNextEvent.title} is queued, but not active right now.`,
        nextEvent: upcomingNextEvent,
        tradeAllowed: upcomingTradeAllowed,
      });
    } else {
      scheduledNewsSignal = createSignal("Scheduled News", "inactive", {
        detail: "No upcoming news is scheduled right now.",
        nextEvent: null,
        tradeAllowed: true,
      });
    }

    return {
      liveNews: liveNewsSignal,
      scheduledNews: scheduledNewsSignal,
      refreshedAt,
    };
  }

  return {
    liveNews: createSignal("Live News", "offline", {
      detail: "News source is offline.",
    }),
    scheduledNews: createSignal("Scheduled News", "offline", {
      detail: "Economic-calendar source is offline.",
    }),
    refreshedAt,
  };
}

export default {
  fetchNewsSystemStatus,
  getInitialNewsSystemStatus,
  NEWS_STATUS_REFRESH_MS,
};
// DEPLOY_MARKER: 20260425T205500
