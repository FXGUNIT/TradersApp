import { hasBff } from "./gateways/base.js";
import { resolveBffBaseUrl } from "./runtimeConfig.js";

const BFF_BASE = resolveBffBaseUrl();

async function fetchCalendarJson(path) {
  if (!hasBff()) {
    throw new Error("Calendar service unavailable");
  }

  const response = await fetch(`${BFF_BASE}${path}`, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Calendar request failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchMarketNow() {
  return fetchCalendarJson("/calendar/now");
}

export async function fetchExpiryCalendar({ count = 4, symbol, includeMonthly } = {}) {
  const params = new URLSearchParams({
    count: String(count),
  });

  if (symbol) {
    params.set("symbol", String(symbol));
  }

  if (includeMonthly === false) {
    params.set("includeMonthly", "false");
  }

  return fetchCalendarJson(`/calendar/expiry?${params.toString()}`);
}

export async function fetchMarketHolidays({ year } = {}) {
  const suffix = year ? `?year=${encodeURIComponent(year)}` : "";
  return fetchCalendarJson(`/calendar/holidays${suffix}`);
}

export async function fetchCalendarSnapshot({ count = 4, year } = {}) {
  const [now, expiry, holidays] = await Promise.all([
    fetchMarketNow(),
    fetchExpiryCalendar({ count }),
    fetchMarketHolidays({ year }),
  ]);

  return { now, expiry, holidays };
}

export default {
  fetchCalendarSnapshot,
  fetchExpiryCalendar,
  fetchMarketHolidays,
  fetchMarketNow,
};
