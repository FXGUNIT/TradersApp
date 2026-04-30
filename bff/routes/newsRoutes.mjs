/**
 * News Routes — BFF routes for news intelligence.
 *
 * Routes:
 *   GET  /news/upcoming    — upcoming 3★+ high-impact events (Forex Factory)
 *   GET  /news/countdown   — countdown to next high-impact event
 *   GET  /news/breaking    — real-time breaking news (Finnhub + NewsData + YF RSS)
 *   GET  /news/reactions   — market reactions to breaking news (ML training data)
 *   POST /news/reactions   — log market reaction to a specific breaking news item
 */
import { getUpcomingEvents } from "../services/newsService.mjs";
import {
  fetchBreakingNews,
  getCachedNews,
  getRecentNewsReactions,
  updateNewsReactions,
  triggerMLRetrainOnNews,
  getNewsReactions,
} from "../services/breakingNewsService.mjs";

export function createNewsRouteHandler({
  json,
}) {
  return async function handleNewsRoute(req, res, url, origin) {
    const pathname = url.pathname;

    // GET /news/upcoming
    if (req.method === "GET" && pathname === "/news/upcoming") {
      try {
        const days = parseInt(url.searchParams.get("days") || "7", 10);
        const data = await getUpcomingEvents(Math.min(days, 30));

        // Always return 200 even if FF is blocked — we have a fallback
        json(res, 200, {
          ok: true,
          ...data,
        }, origin);
        return true;
      } catch (err) {
        json(res, 200, {
          ok: false,
          error: 'News service temporarily unavailable.',
          events: [],
          next_event: null,
          upcoming_count: 0,
          news_articles: [],
        }, origin);
        return true;
      }
    }

    // GET /news/countdown
    if (req.method === "GET" && pathname === "/news/countdown") {
      try {
        const data = await getUpcomingEvents(7);
        const next = data.next_event;

        json(res, 200, {
          ok: true,
          has_next: next !== null,
          countdown_minutes: next ? next.time_until_min : null,
          next_event: next,
          trade_allowed: next ? (next.time_until_min > 30) : true,
          warning: next && next.time_until_min <= 30
            ? `HIGH IMPACT EVENT in ${next.time_until_min} minutes — reduce position size`
            : null,
        }, origin);
        return true;
      } catch (err) {
        json(res, 200, {
          ok: false,
          error: 'News service temporarily unavailable.',
          has_next: false,
          countdown_minutes: null,
          next_event: null,
          trade_allowed: true,
        }, origin);
        return true;
      }
    }

    // GET /news/breaking — real-time breaking news backed by shared Redis cache
    if (req.method === "GET" && pathname === "/news/breaking") {
      try {
        const fresh = url.searchParams.get("fresh") === "true";
        const minImpact = url.searchParams.get("minImpact") || "LOW";
        const maxItems = parseInt(url.searchParams.get("max") || "30", 10);
        const data = await fetchBreakingNews({ fresh, maxItems, minImpact });

        // Fire-and-forget ML retrain on HIGH impact items
        const highImpact = data.items.filter(
          (item) => item.impact === 'HIGH' && !item.reactionLogged && item.source !== 'forexfactory',
        );
        for (const item of highImpact.slice(0, 2)) {
          triggerMLRetrainOnNews(item).catch(() => {});
        }

        json(res, 200, {
          ok: true,
          ...data,
        }, origin);
        return true;
      } catch (err) {
        console.error('[newsRoutes] /news/breaking error:', err.message);
        json(res, 200, {
          ok: false,
          error: 'News service temporarily unavailable.',
          items: [],
          total: 0,
          highImpactCount: 0,
        }, origin);
        return true;
      }
    }

    // GET /news/reactions — market reactions to breaking news (ML training data)
    if (req.method === "GET" && pathname === "/news/reactions") {
      try {
        const minutes = parseInt(url.searchParams.get("minutes") || "120", 10);
        const reactions = getRecentNewsReactions(minutes);
        const cached = await getCachedNews({ maxItems: 20 });

        json(res, 200, {
          ok: true,
          reactions,
          recentNews: cached.items,
          fetchedAt: cached.fetchedAt,
        }, origin);
        return true;
      } catch (err) {
        json(res, 200, { ok: false, error: 'News service temporarily unavailable.', reactions: [], recentNews: [] }, origin);
        return true;
      }
    }

    // POST /news/reactions — log market reaction to a breaking news item
    if (req.method === "POST" && pathname === "/news/reactions") {
      try {
        const body = typeof req.body === 'object' ? req.body : {};
        const { newsId, reaction5m, reaction15m, reaction30m, reaction60m, direction, magnitude } = body;

        if (!newsId) {
          json(res, 400, { ok: false, error: 'newsId required' }, origin);
          return true;
        }

        const existing = getNewsReactions(newsId);
        const reactionData = {
          newsId,
          reaction5m: reaction5m ?? existing?.reaction5m,
          reaction15m: reaction15m ?? existing?.reaction15m,
          reaction30m: reaction30m ?? existing?.reaction30m,
          reaction60m: reaction60m ?? existing?.reaction60m,
          direction: direction ?? existing?.direction,
          magnitude: magnitude ?? existing?.magnitude,
          loggedAt: Date.now(),
        };

        const { logNewsReaction } = await import('../services/breakingNewsService.mjs');
        logNewsReaction(newsId, reactionData);

        json(res, 200, { ok: true, reaction: reactionData }, origin);
        return true;
      } catch (err) {
        json(res, 500, { ok: false, error: "News service temporarily unavailable." }, origin);
        return true;
      }
    }

    // POST /news/candle-update — update candle prices for reaction tracking
    // Called by BFF MathEngine data every 5 minutes
    if (req.method === "POST" && pathname === "/news/candle-update") {
      try {
        const body = typeof req.body === 'object' ? req.body : {};
        const { close, high, low, open, volume } = body;
        updateNewsReactions({ close, high, low, open, volume });
        json(res, 200, { ok: true }, origin);
        return true;
      } catch (err) {
        json(res, 500, { ok: false, error: "News service temporarily unavailable." }, origin);
        return true;
      }
    }

    return false;
  };
}

export default createNewsRouteHandler;
