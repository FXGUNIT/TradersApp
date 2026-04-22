/**
 * NSE India Market Calendar Service
 *
 * Provides market session, expiry, and holiday information for NSE trading.
 * Uses Date() with manual UTC+5:30 (Asia/Kolkata) math — no external deps.
 *
 * Sessions (IST, no DST):
 *   pre_market    09:00 – 09:15 IST
 *   main_trading 09:15 – 15:30 IST
 *   post_market  15:30 – 16:00 IST
 *
 * Weekends: Friday 15:30 IST through Monday 09:00 IST = closed
 *
 * @module calendarService
 */

const IST_OFFSET_MS = 5 * 60 * 60 * 1000 + 30 * 60 * 1000; // UTC+5:30

// ── Time helpers ──────────────────────────────────────────────────────────────

/** Returns current IST time as a plain object. */
function nowIST() {
  const utc = Date.now() + new Date().getTimezoneOffset() * 60 * 1000;
  const istMs = utc + IST_OFFSET_MS;
  const d = new Date(istMs);
  return {
    ms: istMs,
    date: d,
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    dayOfWeek: d.getUTCDay(), // 0=Sun, 1=Mon, ..., 6=Sat
  };
}

/** Convert IST date parts to ms (midnight start of day in IST). */
function istMidnightMs(year, month, day) {
  const utc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  return utc - IST_OFFSET_MS;
}

/** Convert IST HH:MM to ms-since-midnight-IST. */
function istHhmmToMs(hours, minutes) {
  return (hours * 60 + minutes) * 60 * 1000;
}

// ── Session boundaries (IST HH:MM) ─────────────────────────────────────────

const SESSIONS = Object.freeze({
  PRE_MARKET: {
    id: "pre_market",
    name: "Pre-Market",
    startHhmm: [9, 0],
    endHhmm: [9, 15],
    description: "09:00 – 09:15 IST. Only limit orders. No market orders.",
  },
  MAIN_TRADING: {
    id: "main_trading",
    name: "Main Trading",
    startHhmm: [9, 15],
    endHhmm: [15, 30],
    description: "09:15 – 15:30 IST. Full order types including market orders.",
  },
  POST_MARKET: {
    id: "post_market",
    name: "Post-Market",
    startHhmm: [15, 30],
    endHhmm: [16, 0],
    description: "15:30 – 16:00 IST. Only limit orders at last traded price.",
  },
});

// ── Holiday list ─────────────────────────────────────────────────────

const HOLIDAYS_2026 = [
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
];

// ── Core logic ───────────────────────────────────────────────────────────────

/** Returns session type for a given IST date object, or null if market closed. */
function sessionForIST(ist) {
  const { dayOfWeek, hours, minutes } = ist;
  const mins = hours * 60 + minutes;

  // Weekend: Fri 15:30 through Mon 08:59 = closed
  if (dayOfWeek === 5 && mins >= 15 * 60 + 30) return null;
  if (dayOfWeek === 6) return null; // Saturday
  if (dayOfWeek === 0 && mins < 9 * 60) return null; // Sunday before 09:00

  if (mins >= 9 * 60 && mins < 9 * 60 + 15) return "pre_market";
  if (mins >= 9 * 60 + 15 && mins < 15 * 60 + 30) return "main_trading";
  if (mins >= 15 * 60 + 30 && mins < 16 * 60) return "post_market";

  return null; // outside all sessions
}

/** Returns true if the given IST date is a market holiday. */
function isHolidayIST(ist, holidays) {
  const iso = `${ist.year}-${String(ist.month).padStart(2, "0")}-${String(ist.day).padStart(2, "0")}`;
  return holidays.some((h) => h.date === iso);
}

/** Advance an IST date to the next trading day, skipping weekends and holidays. */
function nextTradingDayMs(fromMs) {
  let d = new Date(fromMs);
  d.setUTCHours(d.getUTCHours() + 24); // advance one day
  let attempts = 0;
  while (attempts < 14) {
    const ist = {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      dayOfWeek: d.getUTCDay(),
    };
    if (ist.dayOfWeek === 6 || ist.dayOfWeek === 0) {
      // skip weekend
    } else if (isHolidayIST(ist, HOLIDAYS_2026)) {
      // skip holiday
    } else {
      return d.getTime();
    }
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    attempts++;
  }
  return fromMs; // fallback
}

/** Format ms as an IST ISO string. */
function toISTIso(ms) {
  const utc = ms - new Date().getTimezoneOffset() * 60 * 1000 + IST_OFFSET_MS;
  return new Date(utc).toISOString().replace("Z", "+05:30");
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the current market status for NSE.
 * @returns {{ session: string|null, isTradingDay: boolean, nextEvent: string|null, timeToNextEventMs: number|null, istTime: string }}
 */
export function getCurrentMarketStatus() {
  const ist = nowIST();
  const iso = `${ist.year}-${String(ist.month).padStart(2, "0")}-${String(ist.day).padStart(2, "0")}`;
  const isHoliday = isHolidayIST(ist, HOLIDAYS_2026);
  const isWeekend = ist.dayOfWeek === 0 || ist.dayOfWeek === 6;
  const isTradingDay = !isHoliday && !isWeekend;

  const session = sessionForIST(ist);
  const mins = ist.hours * 60 + ist.minutes;

  let nextEvent = null;
  let timeToNextEventMs = null;
  let nextEventMs = null;

  if (session === null) {
    // Market closed right now — find the next session open
    if (isWeekend || ist.dayOfWeek === 5) {
      // Friday after 15:30 or Saturday → next trading day at 09:00 IST
      const currentDayMs = istMidnightMs(ist.year, ist.month, ist.day);
      const todayCloseMs = currentDayMs + istHhmmToMs(15, 30);
      let nextOpenMs;
      if (ist.dayOfWeek === 5 && mins >= 15 * 60 + 30) {
        // Friday after close → next Monday 09:00
        nextOpenMs = istMidnightMs(ist.year, ist.month, ist.day + 3) + istHhmmToMs(9, 0);
      } else if (ist.dayOfWeek === 6) {
        nextOpenMs = istMidnightMs(ist.year, ist.month, ist.day + 2) + istHhmmToMs(9, 0);
      } else if (ist.dayOfWeek === 0 && mins < 9 * 60) {
        nextOpenMs = istMidnightMs(ist.year, ist.month, ist.day) + istHhmmToMs(9, 0);
      } else {
        // normal day, before or after hours
        nextOpenMs = istMidnightMs(ist.year, ist.month, ist.day) + istHhmmToMs(9, 0);
      }
      // check for holiday on target day
      const nextIST = { year: new Date(nextOpenMs).getUTCFullYear(), month: new Date(nextOpenMs).getUTCMonth() + 1, day: new Date(nextOpenMs).getUTCDate(), dayOfWeek: new Date(nextOpenMs).getUTCDay() };
      nextOpenMs = nextTradingDayMs(nextOpenMs);
      nextEventMs = nextOpenMs;
      nextEvent = "PRE_MARKET";
    } else {
      // normal weekday, find next boundary
      if (mins < 9 * 60) {
        nextEventMs = istMidnightMs(ist.year, ist.month, ist.day) + istHhmmToMs(9, 0);
        nextEvent = "PRE_MARKET";
      } else if (mins < 9 * 60 + 15) {
        nextEventMs = istMidnightMs(ist.year, ist.month, ist.day) + istHhmmToMs(9, 15);
        nextEvent = "MAIN_TRADING";
      } else if (mins < 15 * 60 + 30) {
        nextEventMs = istMidnightMs(ist.year, ist.month, ist.day) + istHhmmToMs(15, 30);
        nextEvent = "POST_MARKET";
      } else {
        nextEventMs = nextTradingDayMs(istMidnightMs(ist.year, ist.month, ist.day + 1) + istHhmmToMs(9, 0));
        nextEvent = "PRE_MARKET";
      }
    }
  } else {
    // Market open — find next boundary
    const dayStartMs = istMidnightMs(ist.year, ist.month, ist.day);
    if (session === "pre_market") {
      nextEventMs = dayStartMs + istHhmmToMs(9, 15);
      nextEvent = "MAIN_TRADING";
    } else if (session === "main_trading") {
      nextEventMs = dayStartMs + istHhmmToMs(15, 30);
      nextEvent = "POST_MARKET";
    } else {
      nextEventMs = nextTradingDayMs(dayStartMs + istHhmmToMs(24, 0));
      nextEvent = "PRE_MARKET";
    }
  }

  if (nextEventMs !== null) {
    timeToNextEventMs = Math.max(0, nextEventMs - ist.ms);
  }

  return {
    session: session || "closed",
    isTradingDay,
    isHoliday,
    isWeekend,
    holidayName: isHoliday ? HOLIDAYS_2026.find(h => h.date === iso)?.name || null : null,
    nextEvent,
    timeToNextEventMs,
    timeToNextEventS: timeToNextEventMs !== null ? Math.round(timeToNextEventMs / 1000) : null,
    istTime: toISTIso(ist.ms),
    isoDate: iso,
  };
}

/**
 * Returns upcoming NSE expiry dates.
 * Approximates weekly expiry as every Friday; monthly as last Thursday of month.
 * @param {number} [count=4]
 * @returns {Array<{ date: string, type: string, daysUntil: number, sessionImpact: string }>}
 */
export function getUpcomingExpiryDates(count = 4) {
  const ist = nowIST();
  const currentMs = ist.ms;
  const results = [];

  // Weekly: every Friday
  let week = new Date(currentMs);
  week.setUTCDate(week.getUTCDate() + ((7 - week.getUTCDay() + 5) % 7 || 7)); // next Friday
  week.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < count * 2 && results.length < count; i++) {
    const expiryMs = week.getTime() - IST_OFFSET_MS; // convert to UTC for storage
    const daysUntil = Math.round((expiryMs - currentMs) / (24 * 60 * 60 * 1000));
    if (daysUntil < 0) {
      week.setUTCDate(week.getUTCDate() + 7);
      continue;
    }
    results.push({
      date: new Date(expiryMs).toISOString().split("T")[0],
      type: "WEEKLY",
      daysUntil,
      sessionImpact: "High volatility pre-expiry; avoid short-dated options",
    });
    week.setUTCDate(week.getUTCDate() + 7);
  }

  // Monthly: last Thursday of each month
  let month = new Date(Date.UTC(ist.year, ist.month - 1, 1));
  while (results.length < count) {
    // Move to last day of month
    const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
    let thursday = lastDay;
    while (thursday.getUTCDay() !== 4) {
      thursday.setUTCDate(thursday.getUTCDate() - 1);
    }
    const expiryMs = thursday.getTime() - IST_OFFSET_MS;
    const daysUntil = Math.round((expiryMs - currentMs) / (24 * 60 * 60 * 1000));
    if (daysUntil < 0) {
      month.setUTCMonth(month.getUTCMonth() + 1);
      continue;
    }
    results.push({
      date: new Date(expiryMs).toISOString().split("T")[0],
      type: "MONTHLY",
      daysUntil,
      sessionImpact: "Highest volatility; rolling preferred",
    });
    month.setUTCMonth(month.getUTCMonth() + 1);
  }

  // Sort by daysUntil and slice to count
  return results
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, count);
}

/**
 * Returns NSE market holidays for a given year.
 * @param {number} [year=current IST year]
 * @returns {Array<{ date: string, name: string, impact: string }>}
 */
export function getMarketHolidays(year = null) {
  const ist = nowIST();
  const targetYear = year ?? ist.year;
  const yearHolidays = HOLIDAYS_2026.filter((h) => h.date.startsWith(String(targetYear)));
  return yearHolidays.map((h) => ({
    date: h.date,
    name: h.name,
    impact: "Market closed — no trading, no order matching",
  }));
}

/**
 * Returns details for a given session type.
 * @param {string} sessionType
 * @returns {object}
 */
export function getSessionDetails(sessionType) {
  const session = SESSIONS[sessionType?.toUpperCase()];
  if (!session) {
    return {
      error: `Unknown session type "${sessionType}". Valid: pre_market, main_trading, post_market`,
      validTypes: Object.keys(SESSIONS),
    };
  }
  return {
    ...session,
    startIST: `${String(session.startHhmm[0]).padStart(2, "0")}:${String(session.startHhmm[1]).padStart(2, "0")} IST`,
    endIST: `${String(session.endHhmm[0]).padStart(2, "0")}:${String(session.endHhmm[1]).padStart(2, "0")} IST`,
  };
}
