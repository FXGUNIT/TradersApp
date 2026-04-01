/**
 * News Routes — BFF routes for news intelligence.
 *
 * Routes:
 *   GET  /news/upcoming    — upcoming 3★+ high-impact events
 *   GET  /news/countdown   — countdown to next high-impact event
 */
import { getUpcomingEvents } from "../services/newsService.mjs";

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
          error: err.message,
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
          error: err.message,
          has_next: false,
          countdown_minutes: null,
          next_event: null,
          trade_allowed: true,
        }, origin);
        return true;
      }
    }

    return false;
  };
}

export default createNewsRouteHandler;
