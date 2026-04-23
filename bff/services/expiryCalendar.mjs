/**
 * Expiry Calendar Service
 *
 * Centralizes holiday-aware index expiry generation so the dashboard, options
 * fallback, and calendar routes all read from one ruleset.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;

export const NSE_HOLIDAYS_2026 = Object.freeze([
  { date: "2026-01-14", name: "Maha Shivaratri" },
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-02-26", name: "Mahashivratri" },
  { date: "2026-03-10", name: "Holi" },
  { date: "2026-03-30", name: "Id-E-Milad" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-06", name: "Easter Monday" },
  { date: "2026-04-14", name: "Vaisakhi / Dr. B. R. Ambedkar Jayanti" },
  { date: "2026-05-01", name: "May Day" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-08-27", name: "Ganesh Chaturthi" },
  { date: "2026-10-13", name: "Dussehra" },
  { date: "2026-10-20", name: "Diwali - Bhai Dooj" },
  { date: "2026-11-03", name: "Maharishi Valmiki Jayanti" },
  { date: "2026-12-25", name: "Christmas Day" },
]);

export const NSE_EXPIRY_RULES = Object.freeze({
  NIFTY: Object.freeze({
    symbol: "NIFTY",
    label: "Nifty 50",
    weeklyWeekday: 4,
    monthlyWeekday: 4,
  }),
  BANKNIFTY: Object.freeze({
    symbol: "BANKNIFTY",
    label: "Bank Nifty",
    weeklyWeekday: 3,
    monthlyWeekday: 3,
  }),
  FINNIFTY: Object.freeze({
    symbol: "FINNIFTY",
    label: "Fin Nifty",
    weeklyWeekday: 2,
    monthlyWeekday: 2,
  }),
  DEFAULT: Object.freeze({
    symbol: "NIFTY",
    label: "Nifty 50",
    weeklyWeekday: 4,
    monthlyWeekday: 4,
  }),
});

const HOLIDAY_SET = new Set(NSE_HOLIDAYS_2026.map((holiday) => holiday.date));

function getCurrentIstDate(now = new Date()) {
  const istDate = new Date(now.getTime() + IST_OFFSET_MS);
  return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth() + 1,
    day: istDate.getUTCDate(),
  };
}

function toDateOnlyUtc(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function isTradingDay(date) {
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) {
    return false;
  }
  return !HOLIDAY_SET.has(toIsoDate(date));
}

function moveToPreviousTradingDay(date) {
  const cursor = new Date(date.getTime());
  while (!isTradingDay(cursor)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return cursor;
}

function nextWeekdayOnOrAfter(date, weekday) {
  const cursor = new Date(date.getTime());
  const delta = (weekday - cursor.getUTCDay() + 7) % 7;
  cursor.setUTCDate(cursor.getUTCDate() + delta);
  return cursor;
}

function lastWeekdayOfMonth(year, month, weekday) {
  const cursor = new Date(Date.UTC(year, month, 0, 0, 0, 0, 0));
  while (cursor.getUTCDay() !== weekday) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return cursor;
}

function normalizeSymbol(symbol = "NIFTY") {
  const normalized = String(symbol || "NIFTY").trim().toUpperCase();
  return normalized || "NIFTY";
}

function resolveExpiryRule(symbol = "NIFTY") {
  const normalized = normalizeSymbol(symbol);
  return NSE_EXPIRY_RULES[normalized] || NSE_EXPIRY_RULES.DEFAULT;
}

function getSessionImpact(type) {
  if (type === "MONTHLY") {
    return "Monthly expiry concentrates roll flow and broader index positioning.";
  }
  return "Weekly expiry can tighten time decay and increase intraday volatility.";
}

function buildExpiryEntry(date, type, symbol, todayDate) {
  const daysUntil = Math.round((date.getTime() - todayDate.getTime()) / DAY_MS);
  return {
    date: toIsoDate(date),
    type,
    label: `${symbol} ${type.toLowerCase()} expiry`,
    symbol,
    daysUntil,
    tradable: daysUntil >= 0,
    sessionImpact: getSessionImpact(type),
  };
}

export function getUpcomingExpiryDates(options = 4) {
  const {
    count = 4,
    symbol = "NIFTY",
    includeMonthly = true,
    now = new Date(),
  } = typeof options === "number" ? { count: options } : (options || {});

  const safeCount = Math.max(1, Math.min(12, Number.parseInt(String(count), 10) || 4));
  const rule = resolveExpiryRule(symbol);
  const normalizedSymbol = rule.symbol;
  const todayIst = getCurrentIstDate(now);
  const todayDate = toDateOnlyUtc(todayIst.year, todayIst.month, todayIst.day);
  const results = new Map();

  let weeklyCursor = new Date(todayDate.getTime());
  for (let i = 0; i < safeCount + 6; i += 1) {
    const rawWeekly = nextWeekdayOnOrAfter(weeklyCursor, rule.weeklyWeekday);
    const weeklyExpiry = moveToPreviousTradingDay(rawWeekly);
    const entry = buildExpiryEntry(weeklyExpiry, "WEEKLY", normalizedSymbol, todayDate);
    if (entry.daysUntil >= 0 && !results.has(entry.date)) {
      results.set(entry.date, entry);
    }
    weeklyCursor = new Date(rawWeekly.getTime());
    weeklyCursor.setUTCDate(weeklyCursor.getUTCDate() + 7);
  }

  if (includeMonthly) {
    let monthCursor = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1));
    for (let i = 0; i < safeCount + 3; i += 1) {
      const rawMonthly = lastWeekdayOfMonth(
        monthCursor.getUTCFullYear(),
        monthCursor.getUTCMonth() + 1,
        rule.monthlyWeekday,
      );
      const monthlyExpiry = moveToPreviousTradingDay(rawMonthly);
      const entry = buildExpiryEntry(monthlyExpiry, "MONTHLY", normalizedSymbol, todayDate);
      if (entry.daysUntil >= 0) {
        results.set(entry.date, entry);
      }
      monthCursor.setUTCMonth(monthCursor.getUTCMonth() + 1);
    }
  }

  return [...results.values()]
    .sort((left, right) => left.daysUntil - right.daysUntil)
    .slice(0, safeCount);
}

export default {
  getUpcomingExpiryDates,
  NSE_EXPIRY_RULES,
  NSE_HOLIDAYS_2026,
};
