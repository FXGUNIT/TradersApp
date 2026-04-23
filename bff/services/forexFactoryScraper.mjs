/**
 * Forex Factory scraper
 *
 * Keeps the HTML parsing for scheduled macro events in one place so the
 * upcoming-news route and breaking-news feed stay aligned.
 */

import { isOutboundUrlAllowed } from "./security.mjs";

const NEW_YORK_TIME_ZONE = "America/New_York";
const DEFAULT_TIMEOUT_MS = 8000;

export const FOREX_FACTORY_URL = "https://www.forexfactory.com/calendar";
export const RELEVANT_FOREX_CURRENCIES = Object.freeze([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "NZD",
  "CNH",
  "CHF",
  "MXN",
  "ZAR",
]);

const WEEKDAY_TOKENS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const MONTH_LOOKUP = Object.freeze({
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
});

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCellText(rowHtml, cellName) {
  const match = rowHtml.match(
    new RegExp(`<td[^>]*class="[^"]*${cellName}[^"]*"[^>]*>([\\s\\S]*?)<\\/td>`, "i"),
  );
  return stripHtml(match?.[1] || "");
}

function extractImpact(rowHtml) {
  if (/impact--high|impact[^"]*high|title="High"/i.test(rowHtml)) {
    return 3;
  }
  if (/impact--medium|impact[^"]*medium|title="Medium"/i.test(rowHtml)) {
    return 2;
  }
  if (/impact--low|impact[^"]*low|title="Low"/i.test(rowHtml)) {
    return 1;
  }

  const impactMatch = rowHtml.match(/impact--([123])/i);
  if (impactMatch) {
    return Number.parseInt(impactMatch[1], 10);
  }

  return 0;
}

function getZonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number.parseInt(byType.year, 10),
    month: Number.parseInt(byType.month, 10),
    day: Number.parseInt(byType.day, 10),
  };
}

function getTimeZoneOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const zoneName = parts.find((part) => part.type === "timeZoneName")?.value || "GMT+0";
  const match = zoneName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number.parseInt(match[2], 10);
  const minutes = Number.parseInt(match[3] || "0", 10);
  return sign * ((hours * 60) + minutes);
}

function buildZonedDate(year, monthIndex, day, hour, minute, timeZone) {
  const utcGuess = new Date(Date.UTC(year, monthIndex, day, hour, minute, 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  return new Date(Date.UTC(year, monthIndex, day, hour, minute, 0, 0) - (offsetMinutes * 60 * 1000));
}

function parseDateToken(dateToken, referenceDate) {
  const cleaned = stripHtml(dateToken)
    .replace(/\s*\([^)]+\)/g, "")
    .replace(/,/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  if (/^today$/i.test(cleaned)) {
    return new Date(referenceDate.getTime());
  }

  if (/^tomorrow$/i.test(cleaned)) {
    const tomorrow = new Date(referenceDate.getTime());
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow;
  }

  const tokens = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !WEEKDAY_TOKENS.has(token.toLowerCase().slice(0, 3)));

  if (tokens.length < 2) {
    return null;
  }

  let dayToken = null;
  let monthToken = null;
  let yearToken = null;

  if (/^\d+$/.test(tokens[0])) {
    dayToken = tokens[0];
    monthToken = tokens[1];
    yearToken = tokens[2] || null;
  } else {
    monthToken = tokens[0];
    dayToken = tokens[1];
    yearToken = tokens[2] || null;
  }

  const monthIndex = MONTH_LOOKUP[String(monthToken).toLowerCase().slice(0, 3)];
  const day = Number.parseInt(String(dayToken), 10);
  if (!Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    return null;
  }

  let year = yearToken ? Number.parseInt(String(yearToken), 10) : referenceDate.getUTCFullYear();
  if (!yearToken && monthIndex < referenceDate.getUTCMonth() - 1) {
    year += 1;
  }

  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
}

function parseTimeToken(timeToken) {
  const cleaned = stripHtml(timeToken);

  if (!cleaned || /all\s*day/i.test(cleaned)) {
    return { hour: 12, minute: 0 };
  }

  if (/tentative/i.test(cleaned)) {
    return { hour: 14, minute: 0 };
  }

  const match = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) {
    return { hour: 12, minute: 0 };
  }

  let hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2] || "0", 10);
  const meridiem = String(match[3] || "").toLowerCase();

  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }

  return { hour, minute };
}

export function isRelevantForexCurrency(currency) {
  const normalized = String(currency || "").trim().toUpperCase();
  if (!normalized) {
    return false;
  }
  return RELEVANT_FOREX_CURRENCIES.some((candidate) => normalized.includes(candidate));
}

export function parseForexFactoryDateTime(dateToken, timeToken, options = {}) {
  const {
    now = new Date(),
    fallbackDateToken = null,
  } = options;

  const referenceParts = getZonedDateParts(now, NEW_YORK_TIME_ZONE);
  const referenceDate = new Date(Date.UTC(referenceParts.year, referenceParts.month - 1, referenceParts.day, 0, 0, 0, 0));
  const resolvedDate = parseDateToken(dateToken || fallbackDateToken, referenceDate);
  if (!resolvedDate) {
    return null;
  }

  const { hour, minute } = parseTimeToken(timeToken);
  return buildZonedDate(
    resolvedDate.getUTCFullYear(),
    resolvedDate.getUTCMonth(),
    resolvedDate.getUTCDate(),
    hour,
    minute,
    NEW_YORK_TIME_ZONE,
  );
}

export function parseForexFactoryHTML(html, options = {}) {
  const {
    now = new Date(),
    minImpact = 3,
  } = options;

  const rows = [...String(html || "").matchAll(
    /<tr[^>]*class="[^"]*calendar[^"]*row[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi,
  )];

  const events = [];
  let activeDateToken = null;

  for (const rowMatch of rows) {
    const rowHtml = rowMatch[1];
    const impact = extractImpact(rowHtml);
    if (impact < minImpact) {
      continue;
    }

    const dateToken = extractCellText(rowHtml, "date");
    if (dateToken) {
      activeDateToken = dateToken;
    }

    const timeToken = extractCellText(rowHtml, "time");
    const currency = extractCellText(rowHtml, "currency");
    const title = extractCellText(rowHtml, "event");
    if (!title || !isRelevantForexCurrency(currency)) {
      continue;
    }

    const scheduledAt = parseForexFactoryDateTime(dateToken, timeToken, {
      now,
      fallbackDateToken: activeDateToken,
    });
    if (!scheduledAt) {
      continue;
    }

    const timeUntilMin = Math.round((scheduledAt.getTime() - now.getTime()) / 60000);
    const impactLabel = impact >= 3 ? "HIGH" : impact === 2 ? "MEDIUM" : "LOW";

    events.push({
      source: "forexfactory",
      title,
      currency: String(currency || "").trim().toUpperCase(),
      impact,
      impactLabel,
      datetime: scheduledAt.toISOString(),
      time_until_min: timeUntilMin,
      timeUntil_min: timeUntilMin,
      volatility: impactLabel,
      category: "economic_calendar",
      scheduled: true,
    });
  }

  return events;
}

async function fetchForexFactoryHtml(timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!isOutboundUrlAllowed(FOREX_FACTORY_URL)) {
    throw new Error("Forex Factory URL blocked by SSRF guard.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(FOREX_FACTORY_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      throw new Error(`Forex Factory responded ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function scrapeForexFactory(options = {}) {
  const {
    daysAhead = 7,
    minImpact = 3,
    now = new Date(),
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const html = await fetchForexFactoryHtml(timeoutMs);
  const maxMinutes = Math.max(1, daysAhead) * 24 * 60;

  return parseForexFactoryHTML(html, { now, minImpact })
    .filter((event) => event.time_until_min >= 0 && event.time_until_min <= maxMinutes)
    .sort((left, right) => left.time_until_min - right.time_until_min);
}

export default {
  FOREX_FACTORY_URL,
  RELEVANT_FOREX_CURRENCIES,
  isRelevantForexCurrency,
  parseForexFactoryDateTime,
  parseForexFactoryHTML,
  scrapeForexFactory,
};
