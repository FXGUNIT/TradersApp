/**
 * News Intelligence Service — aggregates high-impact news events.
 *
 * Sources:
 * 1. Forex Factory (primary, free, no API key required)
 *    - Scrape https://www.forexfactory.com/calendar
 *    - Filter for 3★ impact events only (high volatility triggers)
 * 2. NewsData.io (backup, free tier: 200 credits/month)
 *    - API: https://newsdata.io/api/1/news
 *
 * On 3★ events:
 * - Return to frontend for countdown display
 * - POST to ML Engine /news-trigger to initiate model retrain
 */
import {
  ensureAgentHeartbeat,
  openAgentThread,
  postAgentMilestone,
  refreshAgentHeartbeat,
  reportAgentError,
} from "./boardRoomAgentReporter.mjs";

const FOREX_FACTORY_URL = "https://www.forexfactory.com/calendar";
const NEWS_API_KEY = String(process.env.NEWS_API_KEY || "").trim() || null;
const NEWS_API_URL = "https://newsdata.io/api/1/news";
const ML_ENGINE_BASE = String(
  process.env.ML_ENGINE_URL ||
    process.env.ML_ENGINE_INTERNAL_URL ||
    "http://ml-engine:8001",
).trim();

const STAR_THRESHOLD = 3; // Only track 3★ events
const NEWS_AGENT = "NewsService";

ensureAgentHeartbeat({
  agent: NEWS_AGENT,
  focus: "Monitoring high-impact news and retrain triggers.",
});

/**
 * Impact levels from Forex Factory
 */
const IMPACT_STARS = { 1: 1, 2: 2, 3: 3 };

/**
 * Currency pairs to track (relevant for MNQ/ES trading)
 */
const RELEVANT_CURRENCIES = [
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
];

/**
 * Scrape Forex Factory for high-impact news events.
 * Returns events within the next 7 days with impact >= 3★.
 */
export async function scrapeForexFactory() {
  refreshAgentHeartbeat({
    agent: NEWS_AGENT,
    status: "active",
    focus: "Scraping Forex Factory calendar.",
  });
  try {
    const response = await fetch(FOREX_FACTORY_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      throw new Error(`Forex Factory responded ${response.status}`);
    }

    const html = await response.text();
    return parseForexFactoryHTML(html);
  } catch (err) {
    console.error("[newsService] Forex Factory scrape failed:", err.message);
    void reportAgentError({
      agent: NEWS_AGENT,
      error: err,
      severity: "MEDIUM",
    });
    return [];
  }
}

/**
 * Parse Forex Factory calendar HTML to extract events.
 */
function parseForexFactoryHTML(html) {
  // Simple regex-based extraction (FF uses a table structure with star ratings)
  const events = [];

  // Match event rows: typically in a <tr class="calendar__row">...</tr>
  const rowRegex =
    /<tr[^>]*class="[^"]*calendar[^"]*row[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = [...html.matchAll(rowRegex)];

  const now = new Date();

  for (const rowMatch of rows) {
    const row = rowMatch[1];

    // Extract star rating (3 star icons = 3★ event)
    const starCount =
      (row.match(/🟫/g) || []).length +
      (row.match(/<span[^>]*class="[^"]*impact[^"]*[^"]*3[^"]*"[^>]*>/gi) || [])
        .length +
      ((row.match(/impact--high/gi) || []).length > 0 ? 3 : 0);

    // Better: parse by looking for impact class
    const impactMatch = row.match(/impact--(\d)/i);
    const impact = impactMatch ? parseInt(impactMatch[1], 10) : 0;

    if (impact < STAR_THRESHOLD) continue;

    // Extract date
    const dateMatch = row.match(
      /class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/td>/i,
    );
    const dateStr = dateMatch
      ? dateMatch[1]
          .trim()
          .replace(/<[^>]+>/g, "")
          .trim()
      : "";

    // Extract time
    const timeMatch = row.match(
      /class="[^"]*time[^"]*"[^>]*>([\s\S]*?)<\/td>/i,
    );
    const timeStr = timeMatch
      ? timeMatch[1]
          .trim()
          .replace(/<[^>]+>/g, "")
          .trim()
      : "";

    // Extract currency
    const currencyMatch = row.match(
      /class="[^"]*currency[^"]*"[^>]*>([\s\S]*?)<\/td>/i,
    );
    const currency = currencyMatch
      ? currencyMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    // Extract event name
    const eventMatch = row.match(
      /class="[^"]*event[^"]*"[^>]*>([\s\S]*?)<\/td>/i,
    );
    const eventName = eventMatch
      ? eventMatch[1]
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim()
      : "";

    if (!eventName || !isRelevantCurrency(currency)) continue;

    // Parse datetime
    const datetime = parseFFDateTime(dateStr, timeStr, now);
    if (!datetime) continue;

    events.push({
      source: "forexfactory",
      title: eventName,
      currency: currency.toUpperCase(),
      impact,
      datetime: datetime.toISOString(),
      time_until_min: Math.max(0, Math.round((datetime - now) / 60000)),
      volatility: impact >= 3 ? "HIGH" : "MEDIUM",
    });
  }

  return events;
}

/**
 * Parse Forex Factory date string into a Date object.
 * FF uses formats like "Feb 03", "Mar 14", etc.
 */
function parseFFDateTime(dateStr, timeStr, now) {
  try {
    // Parse date: "Feb 03" or "Feb 03 (Wed)" or "03 Feb"
    const cleaned = dateStr.replace(/\s*\([^)]+\)/g, "").trim();
    const parts = cleaned.split(/\s+/);
    if (parts.length < 2) return null;

    const monthStr = parts[0];
    const dayNum = parseInt(parts[1], 10);

    const months = {
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
    };
    const month = months[monthStr.toLowerCase().slice(0, 3)];
    if (month === undefined) return null;

    // Determine year: if month < current month, it's next year
    let year = now.getFullYear();
    if (month < now.getMonth()) year++;

    // Parse time: "8:30am" or "8:30 am" or "All Day"
    let hour = 12,
      minute = 0;
    if (timeStr && !/all\s*day/i.test(timeStr)) {
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
      if (timeMatch) {
        hour = parseInt(timeMatch[1], 10);
        minute = parseInt(timeMatch[2], 10);
        const ampm = (timeMatch[3] || "").toLowerCase();
        if (ampm === "pm" && hour < 12) hour += 12;
        if (ampm === "am" && hour === 12) hour = 0;
      }
    }

    const dt = new Date(Date.UTC(year, month, dayNum, hour - 5, minute)); // EST = UTC-5
    return dt;
  } catch {
    return null;
  }
}

/**
 * Check if currency is relevant for index trading (MNQ/ES).
 */
function isRelevantCurrency(currency) {
  if (!currency) return false;
  const c = currency.toUpperCase();
  return RELEVANT_CURRENCIES.some((rc) => c.includes(rc));
}

/**
 * Fetch news from NewsData.io (backup source).
 */
export async function fetchNewsData() {
  if (!NEWS_API_KEY) {
    return [];
  }

  refreshAgentHeartbeat({
    agent: NEWS_AGENT,
    status: "active",
    focus: "Fetching NewsData backup feed.",
  });
  try {
    const today = new Date().toISOString().split("T")[0];
    const url = `${NEWS_API_URL}?apikey=${NEWS_API_KEY}&language=en&category=business&date=${today}`;

    const response = await fetch(url, {
      headers: { "User-Agent": "TradersApp/1.0" },
    });

    if (!response.ok) {
      throw new Error(`NewsData.io ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "success" || !Array.isArray(data.results)) {
      return [];
    }

    return data.results
      .filter((article) => article.title)
      .slice(0, 5)
      .map((article) => ({
        source: "newsdata",
        title: article.title,
        url: article.link || "",
        published: article.pubDate || null,
        sentiment: classifySentiment(article),
      }));
  } catch (err) {
    console.error("[newsService] NewsData.io failed:", err.message);
    void reportAgentError({
      agent: NEWS_AGENT,
      error: err,
      severity: "MEDIUM",
    });
    return [];
  }
}

/**
 * Simple sentiment classification from news title.
 */
function classifySentiment(article) {
  const text = `${article.title} ${article.description || ""}`.toLowerCase();
  const bullish = [
    "rate cut",
    "rate hike",
    "fed",
    "stimulus",
    "bullish",
    "surge",
    "gain",
    "rally",
    "growth",
  ];
  const bearish = [
    "recession",
    "crash",
    "plunge",
    "sell",
    "loss",
    "crisis",
    "war",
    "tension",
    "slowdown",
  ];
  const bullCount = bullish.filter((w) => text.includes(w)).length;
  const bearCount = bearish.filter((w) => text.includes(w)).length;
  if (bullCount > bearCount) return "bullish";
  if (bearCount > bullCount) return "bearish";
  return "neutral";
}

/**
 * Main entry: get upcoming high-impact events.
 * Returns all 3★+ events from FF (primary) + FF fallback if NewsData available.
 */
export async function getUpcomingEvents(daysAhead = 7) {
  refreshAgentHeartbeat({
    agent: NEWS_AGENT,
    status: "active",
    focus: `Building ${daysAhead}-day news outlook.`,
  });
  const ffEvents = await scrapeForexFactory();

  // Filter to future events within window
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const upcoming = ffEvents
    .filter((e) => {
      const dt = new Date(e.datetime);
      return dt >= now && dt <= cutoff;
    })
    .sort((a, b) => a.time_until_min - b.time_until_min);

  // Next event
  const nextEvent = upcoming[0] || null;

  return {
    events: upcoming,
    next_event: nextEvent,
    upcoming_count: upcoming.length,
    high_impact_count: upcoming.filter((e) => e.impact >= 3).length,
    news_articles: await fetchNewsData(),
    scraped_at: new Date().toISOString(),
  };
}

/**
 * Trigger ML model retrain on high-impact event.
 */
export async function triggerRetrainOnEvent(event) {
  if (!event || event.impact < STAR_THRESHOLD)
    return { triggered: false, reason: "Not high-impact" };

  refreshAgentHeartbeat({
    agent: NEWS_AGENT,
    status: "active",
    focus: `Triggering retrain for ${event.title || "high-impact event"}.`,
  });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${ML_ENGINE_BASE}/news-trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return { triggered: false, reason: `ML Engine ${res.status}` };
    }

    const data = await res.json();
    const description = JSON.stringify({
      source: event.source || "unknown",
      title: event.title,
      currency: event.currency || null,
      impact: event.impact,
      datetime: event.datetime || null,
      trigger: "ml_retrain",
    });
    const thread = await openAgentThread({
      agent: NEWS_AGENT,
      title: `High-impact news retrain: ${event.title}`,
      description,
      priority: "HIGH",
      tags: ["news", "ml-engine", "high-impact", String(event.currency || "macro").toLowerCase()],
      tasks: [
        { description: "Classify event impact in ML engine", done: false },
        { description: "Review downstream market reaction", done: false },
      ],
    });
    if (thread?.threadId) {
      await postAgentMilestone({
        agent: NEWS_AGENT,
        threadId: thread.threadId,
        content: JSON.stringify({
          action: "retrain_triggered",
          event: event.title,
          mlResponse: data,
        }),
      });
    }
    return { triggered: true, event: event.title, response: data };
  } catch (err) {
    void reportAgentError({
      agent: NEWS_AGENT,
      error: err,
      severity: "HIGH",
    });
    return { triggered: false, reason: err.message };
  }
}

export function createNewsService() {
  return {
    getUpcomingEvents,
    triggerRetrainOnEvent,
    scrapeForexFactory,
    fetchNewsData,
  };
}

export default createNewsService;
