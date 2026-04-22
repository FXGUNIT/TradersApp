/**
 * Calendar Routes — NSE India market calendar endpoints.
 *
 * Routes:
 *   GET /calendar/now          — current market status
 *   GET /calendar/expiry       — upcoming expiry dates
 *   GET /calendar/holidays      — market holidays for current year
 *   GET /calendar/session/:type — session details
 */
import {
  getCurrentMarketStatus,
  getUpcomingExpiryDates,
  getMarketHolidays,
  getSessionDetails,
} from "../services/calendarService.mjs";

export function createCalendarRouteHandler({ json, readJsonBody }) {
  return async function handleCalendarRoute(req, res, url, origin) {
    const pathname = url.pathname;

    // GET /calendar/now — current market status
    if (req.method === "GET" && pathname === "/calendar/now") {
      try {
        const result = getCurrentMarketStatus();
        json(res, 200, { ok: true, ...result }, origin);
        return true;
      } catch (err) {
        console.error("[calendarRoutes] /calendar/now error:", err?.message);
        json(res, 500, { ok: false, error: "Unable to determine market status." }, origin);
        return true;
      }
    }

    // GET /calendar/expiry — upcoming expiry dates
    if (req.method === "GET" && pathname === "/calendar/expiry") {
      try {
        const count = Math.max(1, Math.min(12, parseInt(url.searchParams.get("count") || "4", 10)));
        const result = getUpcomingExpiryDates(count);
        json(res, 200, { ok: true, count: result.length, expiries: result }, origin);
        return true;
      } catch (err) {
        console.error("[calendarRoutes] /calendar/expiry error:", err?.message);
        json(res, 500, { ok: false, error: "Unable to fetch expiry dates." }, origin);
        return true;
      }
    }

    // GET /calendar/holidays — market holidays
    if (req.method === "GET" && pathname === "/calendar/holidays") {
      try {
        const year = parseInt(url.searchParams.get("year") || "", 10);
        const result = getMarketHolidays(Number.isFinite(year) ? year : null);
        json(res, 200, { ok: true, year: result.length > 0 ? result[0].date.slice(0, 4) : null, holidays: result }, origin);
        return true;
      } catch (err) {
        console.error("[calendarRoutes] /calendar/holidays error:", err?.message);
        json(res, 500, { ok: false, error: "Unable to fetch market holidays." }, origin);
        return true;
      }
    }

    // GET /calendar/session/:type — session details
    const sessionMatch = pathname.match(/^\/calendar\/session\/([^/]+)$/);
    if (req.method === "GET" && sessionMatch) {
      try {
        const sessionType = sessionMatch[1];
        const result = getSessionDetails(sessionType);
        const statusCode = result.error ? 400 : 200;
        json(res, statusCode, { ok: !result.error, ...result }, origin);
        return true;
      } catch (err) {
        console.error("[calendarRoutes] /calendar/session error:", err?.message);
        json(res, 500, { ok: false, error: "Unable to fetch session details." }, origin);
        return true;
      }
    }

    return false;
  };
}

export default createCalendarRouteHandler;
