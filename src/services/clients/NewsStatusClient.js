import { bffFetch, hasBff } from "../gateways/base.js";

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
  const [breaking, upcoming] = await Promise.all([
    bffFetch("/news/breaking?fresh=true"),
    bffFetch("/news/upcoming"),
  ]);

  if (breaking || upcoming) {
    return {
      liveNews: buildLiveNewsSignal(null, breaking),
      scheduledNews: buildScheduledNewsSignal(upcoming ? { news: upcoming } : null),
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
