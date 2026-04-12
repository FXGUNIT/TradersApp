/**
 * News Formatter Utilities
 * ========================
 * Pure formatting, classification, and helper functions for breaking news.
 * No I/O, no external dependencies — only synchronous transformations.
 */

import { getRedisClient } from "./redis-session-store.mjs";

// ─── Keyword Lists ───────────────────────────────────────────────────────────

/** Keywords that make a breaking news item relevant to MNQ/ES trading */
export const TRADING_KEYWORDS = [
  // Indices & ETFs
  "spy",
  "qqq",
  "s&p",
  "sp500",
  "nasdaq",
  "dow jones",
  "dow ",
  "russell",
  "mnq",
  "es futures",
  "nq futures",
  "emini",
  "futures",
  // Market-moving keywords
  "fed",
  "federal reserve",
  "rate hike",
  "rate cut",
  "interest rate",
  "inflation",
  "cpi",
  "pce",
  "gdp",
  "jobs report",
  "nonfarm",
  "unemployment",
  "treasury",
  "yield curve",
  "bond",
  "10-year",
  // Earnings surprises
  "earnings",
  "revenue",
  "profit",
  "guidance",
  "beats",
  "misses",
  "quarterly",
  "q1",
  "q2",
  "q3",
  "q4",
  // Mega-cap tech (market movers)
  "apple",
  "google",
  "alphabet",
  "microsoft",
  "amazon",
  "meta",
  "facebook",
  "nvidia",
  "tesla",
  "tsla",
  "jpmorgan",
  "goldman",
  "bank of america",
  // Macro & geopolitical
  "recession",
  "crisis",
  "tariff",
  "trade war",
  "china",
  "europe",
  "opec",
  "oil price",
  "crude oil",
  "war",
  "sanction",
  "election",
  "fomc",
  // Volatility
  "vix",
  "volatility",
  "market turmoil",
  "selloff",
  "rally",
  "surge",
  "plunge",
  "crash",
  "correction",
  "bull market",
  "bear market",
];

/** HIGH-impact keywords — direct market movers */
export const HIGH_IMPACT_KEYWORDS = [
  "fed",
  "federal reserve",
  "rate hike",
  "rate cut",
  "interest rate",
  "cpi",
  "inflation",
  "fomc",
  "nonfarm",
  "jobs report",
  "recession",
  "crisis",
  "trade war",
  "tariff",
  "earnings surprise",
  "profit warning",
  "guidance cut",
  "market crash",
  "black swan",
  "flash crash",
  "bankruptcy",
  "default",
  "sovereign debt",
];

/** MEDIUM-impact keywords — indirect or secondary movers */
export const MEDIUM_IMPACT_KEYWORDS = [
  "gdp",
  "pce",
  "pmi",
  "ism",
  "retail sales",
  "housing starts",
  "earnings",
  "revenue beat",
  "guidance raise",
  "opec",
  "oil",
  "china",
  "europe",
  "geopolitics",
  "vix",
  "volatility spike",
];

/** Words indicating bullish sentiment */
export const BULLISH_WORDS = [
  "surge",
  "rally",
  "gain",
  "rise",
  "jump",
  "soar",
  "climb",
  "higher",
  "beat",
  "exceed",
  "growth",
  "expansion",
  "bullish",
  "optimistic",
  "record high",
  "all-time",
  "strong",
  "robust",
  "upbeat",
  "rate cut",
  "stimulus",
  "bailout",
  "trade deal",
  "deal reached",
  "upgrade",
  "outperform",
  "buy rating",
];

/** Words indicating bearish sentiment */
export const BEARISH_WORDS = [
  "plunge",
  "crash",
  "fall",
  "drop",
  "decline",
  "sink",
  "tumble",
  "miss",
  "below",
  "weak",
  "slump",
  "bearish",
  "pessimistic",
  "selloff",
  "worst",
  "loss",
  "losses",
  "cut",
  "reduce",
  "rate hike",
  "tightening",
  "recession",
  "downgrade",
  "underperform",
  "bankruptcy",
  "default",
  "sanction",
  "tariff war",
  "outbreak",
];

// ─── Sentiment & Impact Classification ────────────────────────────────────────

/**
 * Classify news sentiment (bullish / bearish / neutral)
 * based on word matching in title + description.
 */
export function classifySentiment(title, description = "") {
  const text = `${title} ${description}`.toLowerCase();
  const bullCount = BULLISH_WORDS.filter((w) => text.includes(w)).length;
  const bearCount = BEARISH_WORDS.filter((w) => text.includes(w)).length;
  if (bullCount > bearCount) return "bullish";
  if (bearCount > bullCount) return "bearish";
  return "neutral";
}

/**
 * Classify news impact tier (HIGH / MEDIUM / LOW)
 * based on keyword density in title + description.
 */
export function classifyImpact(title, description = "") {
  const text = `${title} ${description}`.toLowerCase();
  const highCount = HIGH_IMPACT_KEYWORDS.filter((k) => text.includes(k)).length;
  const medCount = MEDIUM_IMPACT_KEYWORDS.filter((k) =>
    text.includes(k),
  ).length;
  if (highCount >= 2 || (text.includes("fed") && text.includes("rate")))
    return "HIGH";
  if (highCount >= 1) return "HIGH";
  if (medCount >= 2) return "MEDIUM";
  if (medCount >= 1) return "LOW";
  return "LOW";
}

/**
 * Returns true if the article is relevant to MNQ/ES/SPY trading.
 */
export function isRelevantToTrading(title, description = "") {
  const text = `${title} ${description}`.toLowerCase();
  return TRADING_KEYWORDS.some((kw) => text.includes(kw));
}

// ─── Keyword Extraction ───────────────────────────────────────────────────────

/**
 * Extract domain keywords from title + description.
 * Returns an array of domain tags, or ['general'] if none matched.
 */
export function extractKeywords(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const keywords = [];
  if (/fed|federal reserve|rate/i.test(text)) keywords.push("fed");
  if (/inflation|cpi|pce/i.test(text)) keywords.push("inflation");
  if (/jobs|employment|nfp|unemployment/i.test(text)) keywords.push("jobs");
  if (/earnings|revenue|profit/i.test(text)) keywords.push("earnings");
  if (/gdp|growth|economy/i.test(text)) keywords.push("gdp");
  if (/trade|tariff|china/i.test(text)) keywords.push("trade");
  if (/oil|crude|opec/i.test(text)) keywords.push("oil");
  if (/recession|crisis/i.test(text)) keywords.push("recession");
  if (/vix|volatility/i.test(text)) keywords.push("volatility");
  if (/apple|nvidia|tesla|meta|microsoft|google|amazon/i.test(text))
    keywords.push("mega-cap");
  return keywords.length > 0 ? keywords : ["general"];
}

// ─── News ID Generation ──────────────────────────────────────────────────────

/**
 * Generate a deterministic, short news item ID from source + title + timestamp.
 * Uses a simple hash so duplicate headlines across sources get different IDs.
 */
export function generateNewsId(source, title, publishedAt) {
  const str = `${source}:${title}:${publishedAt}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return `news_${h.toString(36)}_${Date.now().toString(36)}`;
}

// ─── Sorting & Selection ─────────────────────────────────────────────────────

/**
 * Convert impact string to numeric rank for sorting.
 */
export function impactRank(impact = "LOW") {
  if (impact === "HIGH") return 3;
  if (impact === "MEDIUM") return 2;
  return 1;
}

/**
 * Sort news items: HIGH impact first, then by publish time descending.
 */
export function sortNewsItems(items = []) {
  return [...items].sort((a, b) => {
    const impactDiff = impactRank(b.impact) - impactRank(a.impact);
    if (impactDiff !== 0) return impactDiff;
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });
}

/**
 * Filter and slice news items by impact threshold and max count.
 */
export function selectNewsItems(
  items = [],
  { maxItems = 30, minImpact = "LOW" } = {},
) {
  const filtered = sortNewsItems(items).filter((item) => {
    if (minImpact === "HIGH") return item.impact === "HIGH";
    if (minImpact === "MEDIUM") return impactRank(item.impact) >= 2;
    return true;
  });
  return filtered.slice(0, maxItems);
}

// ─── Payload Builder ─────────────────────────────────────────────────────────

/**
 * Build the breaking news API payload from a cached snapshot.
 * Applies selection filters and computes summary stats.
 */
export function buildBreakingNewsPayload(snapshot, options = {}) {
  const items = selectNewsItems(snapshot?.items || [], options);
  return {
    items,
    total: items.length,
    highImpactCount: items.filter((item) => item.impact === "HIGH").length,
    sources: snapshot?.sources || {},
    fetchedAt: snapshot?.fetchedAt || new Date().toISOString(),
  };
}

// ─── In-Memory News Cache ─────────────────────────────────────────────────────

/**
 * In-memory LRU cache for news items with TTL.
 * Used as a local deduplication layer alongside Redis.
 */
export class NewsCache {
  constructor(maxAgeMs = 600_000, maxItems = 80) {
    this.maxAgeMs = maxAgeMs;
    this.maxItems = maxItems;
    this.items = new Map(); // titleHash → { item, fetchedAt }
    this.seenIds = new Set();
  }

  _hash(str) {
    let h = 0;
    for (let i = 0; i < Math.min(str.length, 200); i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return h.toString(36);
  }

  add(item) {
    const key = this._hash(item.title);
    if (this.seenIds.has(key)) return false; // deduplicated

    // Evict oldest if full
    if (this.items.size >= this.maxItems) {
      const oldest = [...this.items.entries()].sort(
        (a, b) => a[1].fetchedAt - b[1].fetchedAt,
      )[0];
      this.items.delete(oldest[0]);
    }

    this.items.set(key, { item, fetchedAt: Date.now() });
    this.seenIds.add(key);
    return true;
  }

  getAll() {
    const now = Date.now();
    const valid = [];
    for (const [key, { item, fetchedAt }] of this.items) {
      if (now - fetchedAt > this.maxAgeMs) {
        this.items.delete(key);
        this.seenIds.delete(key);
      } else {
        valid.push(item);
      }
    }
    return valid.sort(
      (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
    );
  }

  markReacted(id) {
    for (const [key, { item }] of this.items) {
      if (item.id === id) {
        item.reactionLogged = true;
        break;
      }
    }
  }

  clear() {
    this.items.clear();
    this.seenIds.clear();
  }
}

/** Global in-memory cache shared across all requests */
export const globalNewsCache = new NewsCache();

/**
 * Hash a news title using the globalNewsCache's internal hash.
 * Used for cross-pod dedup keys in Redis.
 */
export function hashNewsTitle(str = "") {
  return globalNewsCache._hash(str);
}

// ─── RSS Parsing ─────────────────────────────────────────────────────────────

/**
 * Parse RSS XML text into an array of { title, link, description, pubDate }.
 */
export function parseRSSItems(xmlText, source) {
  const items = [];
  const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  for (const match of itemMatches) {
    const itemXml = match[1];
    const title = extractRSSField(itemXml, "title");
    const link = extractRSSField(itemXml, "link");
    const description = extractRSSField(itemXml, "description");
    const pubDate =
      extractRSSField(itemXml, "pubDate") || new Date().toISOString();
    if (title) {
      items.push({ title, link, description, pubDate });
    }
  }
  return items;
}

/**
 * Extract a single field from RSS XML, handling CDATA and HTML stripping.
 */
export function extractRSSField(xml, field) {
  // Try CDATA first
  const cdataMatch = xml.match(
    new RegExp(`<${field}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${field}>`, "i"),
  );
  if (cdataMatch) return cdataMatch[1].trim();

  // Try regular text
  const textMatch = xml.match(
    new RegExp(`<${field}>([\\s\\S]*?)<\\/${field}>`, "i"),
  );
  if (textMatch) return textMatch[1].replace(/<[^>]+>/g, "").trim();

  return "";
}

// ─── HTTP Utility ────────────────────────────────────────────────────────────

/**
 * Fetch a URL with an explicit timeout (ms). Throws on timeout or network error.
 */
export async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TradersApp/1.0 (Breaking News Intelligence)" },
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
