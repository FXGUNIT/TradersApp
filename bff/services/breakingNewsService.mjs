/**
 * Breaking News Intelligence Service
 * ====================================
 * Real-time breaking news for MNQ/ES/SPY trading — 100% free sources.
 *
 * Sources (in priority order):
 * 1. Finnhub (free tier: 60 req/min, no key needed for some endpoints)
 *    - Real-time market news, company-specific, forex, crypto
 * 2. NewsData.io (existing: 200 credits/month free)
 *    - Business/financial news, broader coverage
 * 3. Yahoo Finance RSS (no API key, instant headlines)
 *    - Fastest source for top financial headlines
 * 4. GDELT Project (no API key, 15-min delay)
 *    - Global news coverage as fallback
 *
 * Caching:
 * - Redis-backed shared snapshot cache across BFF pods
 * - Deduplication by title hash across all sources
 * - Rate limit awareness per source
 *
 * ML Self-Training:
 * - Each breaking news item is tagged with: source, timestamp, keywords, sentiment
 * - newsReactionLog records market reaction at 5/15/30/60 min after headline
 * - ML models use reaction data for news-impact learning
 */

import { getRedisClient } from "./redis-session-store.mjs";

// ─── Configuration ─────────────────────────────────────────────────────────────

const FINNHUB_API_KEY =
  String(process.env.FINNHUB_API_KEY || "").trim() || null;
const FINNHUB_URL = "https://finnhub.io/api/v1";
const NEWS_API_KEY = String(process.env.NEWS_API_KEY || "").trim() || null;
const NEWS_API_URL = "https://newsdata.io/api/1/news";
const YF_RSS_BASE = "https://feeds.finance.yahoo.com/rss/2.0/headline";
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

const ML_ENGINE_BASE = String(
  process.env.ML_ENGINE_URL || process.env.ML_ENGINE_INTERNAL_URL || "http://ml-engine:8001",
).trim();
const BREAKING_NEWS_CACHE_KEY = "bknews:latest";
const BREAKING_NEWS_CACHE_TTL_MS = Number.parseInt(
  process.env.BREAKING_NEWS_CACHE_TTL_MS || "600000",
  10,
);
const BREAKING_NEWS_CACHE_TTL_SECONDS = Math.max(
  1,
  Math.ceil(BREAKING_NEWS_CACHE_TTL_MS / 1000),
);

// Keywords that make a breaking news item relevant to MNQ/ES trading
const TRADING_KEYWORDS = [
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

// Keywords by impact tier
const HIGH_IMPACT_KEYWORDS = [
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

const MEDIUM_IMPACT_KEYWORDS = [
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

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

class NewsCache {
  constructor(maxAgeMs = 600_000, maxItems = 80) {
    // 10-minute TTL
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

// Global cache — shared across all requests
const globalCache = new NewsCache();

function hashNewsTitle(str = "") {
  return globalCache._hash(str);
}

function impactRank(impact = "LOW") {
  if (impact === "HIGH") return 3;
  if (impact === "MEDIUM") return 2;
  return 1;
}

function sortNewsItems(items = []) {
  return [...items].sort((a, b) => {
    const impactDiff = impactRank(b.impact) - impactRank(a.impact);
    if (impactDiff !== 0) return impactDiff;
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });
}

function selectNewsItems(items = [], { maxItems = 30, minImpact = "LOW" } = {}) {
  const filtered = sortNewsItems(items).filter((item) => {
    if (minImpact === "HIGH") return item.impact === "HIGH";
    if (minImpact === "MEDIUM") return impactRank(item.impact) >= 2;
    return true;
  });
  return filtered.slice(0, maxItems);
}

function buildBreakingNewsPayload(snapshot, options = {}) {
  const items = selectNewsItems(snapshot?.items || [], options);
  return {
    items,
    total: items.length,
    highImpactCount: items.filter((item) => item.impact === "HIGH").length,
    sources: snapshot?.sources || {},
    fetchedAt: snapshot?.fetchedAt || new Date().toISOString(),
  };
}

async function readBreakingNewsSnapshot() {
  const rc = await getRedisClient().catch(() => null);
  if (!rc?.isOpen) {
    return null;
  }
  try {
    const raw = await rc.get(BREAKING_NEWS_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const snapshot = JSON.parse(raw);
    if (!snapshot || !Array.isArray(snapshot.items)) {
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

async function writeBreakingNewsSnapshot(snapshot) {
  const rc = await getRedisClient().catch(() => null);
  if (!rc?.isOpen) {
    return false;
  }
  try {
    await rc.set(
      BREAKING_NEWS_CACHE_KEY,
      JSON.stringify(snapshot),
      { EX: BREAKING_NEWS_CACHE_TTL_SECONDS },
    );
    return true;
  } catch {
    return false;
  }
}

async function markBreakingNewsReacted(newsId) {
  if (!newsId) {
    return;
  }
  const snapshot = await readBreakingNewsSnapshot();
  if (!snapshot?.items?.length) {
    return;
  }
  let changed = false;
  const items = snapshot.items.map((item) => {
    if (item.id !== newsId) {
      return item;
    }
    changed = true;
    return {
      ...item,
      reactionLogged: true,
    };
  });
  if (changed) {
    await writeBreakingNewsSnapshot({
      ...snapshot,
      items,
    });
  }
}

// ─── News Reaction Logger ─────────────────────────────────────────────────────

/**
 * Records market reaction to a breaking news item.
 * Used by ML self-training to learn how markets respond to different news types.
 */
class NewsReactionLog {
  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
    this.reactions = []; // { newsId, reaction5m, reaction15m, reaction30m, reaction60m, direction, magnitude }
    this.pendingReactions = new Map(); // newsId → { news, reactionTimers }
    this.lastCandlePrices = null; // set via updateLastCandle
  }

  updateLastCandle(prices) {
    // Called every 5 min with latest candle prices from MathEngine
    this.lastCandlePrices = prices;
    // Resolve any pending reactions
    for (const [newsId, pending] of this.pendingReactions) {
      if (pending.resolved) continue;
      const elapsed = Date.now() - pending.news.publishedAt;
      if (elapsed >= 5 * 60_000) {
        this._recordReaction(newsId, 5);
        pending.resolved5m = true;
      }
      if (elapsed >= 15 * 60_000) {
        this._recordReaction(newsId, 15);
        pending.resolved15m = true;
      }
      if (elapsed >= 30 * 60_000) {
        this._recordReaction(newsId, 30);
        pending.resolved30m = true;
      }
      if (elapsed >= 60 * 60_000) {
        this._recordReaction(newsId, 60);
        pending.resolved60m = true;
        pending.resolved = true;
      }
    }
  }

  _recordReaction(newsId, interval) {
    const pending = this.pendingReactions.get(newsId);
    if (!pending || !this.lastCandlePrices) return;
    const price = this.lastCandlePrices.close || 0;
    const prevPrice = pending.pricesAtPublish.get(interval) || price;
    const reaction = {
      interval,
      priceAtReaction: price,
      moveTicks: price > 0 ? (price - prevPrice) / 0.25 : 0,
      direction: price > prevPrice ? "up" : price < prevPrice ? "down" : "flat",
    };
    if (!pending.reactions[interval]) pending.reactions[interval] = reaction;
  }

  enqueue(newsItem, pricesAtPublish) {
    // Start tracking this news item for reactions
    this.pendingReactions.set(newsItem.id, {
      news: newsItem,
      pricesAtPublish: pricesAtPublish || new Map(),
      reactions: {},
      resolved: false,
      resolved5m: false,
      resolved15m: false,
      resolved30m: false,
      resolved60m: false,
    });
  }

  logReaction(newsId, reactionData) {
    const existing = this.reactions.find((r) => r.newsId === newsId);
    if (existing) {
      Object.assign(existing, reactionData);
    } else {
      this.reactions.push({ newsId, ...reactionData, loggedAt: Date.now() });
    }
    if (this.reactions.length > this.maxEntries) {
      this.reactions = this.reactions.slice(-this.maxEntries);
    }
  }

  getReactionForNews(newsId) {
    return this.reactions.find((r) => r.newsId === newsId) || null;
  }

  getAllReactions() {
    return [...this.reactions];
  }

  getRecentReactions(minutes = 60) {
    const cutoff = Date.now() - minutes * 60_000;
    return this.reactions.filter((r) => r.loggedAt > cutoff);
  }
}

const reactionLog = new NewsReactionLog();

// ─── Sentiment & Impact Classifier ────────────────────────────────────────────

const BULLISH_WORDS = [
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

const BEARISH_WORDS = [
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

function classifySentiment(title, description = "") {
  const text = `${title} ${description}`.toLowerCase();
  const bullCount = BULLISH_WORDS.filter((w) => text.includes(w)).length;
  const bearCount = BEARISH_WORDS.filter((w) => text.includes(w)).length;
  if (bullCount > bearCount) return "bullish";
  if (bearCount > bullCount) return "bearish";
  return "neutral";
}

function classifyImpact(title, description = "") {
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

function isRelevantToTrading(title, description = "") {
  const text = `${title} ${description}`.toLowerCase();
  return TRADING_KEYWORDS.some((kw) => text.includes(kw));
}

function generateNewsId(source, title, publishedAt) {
  const str = `${source}:${title}:${publishedAt}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return `news_${h.toString(36)}_${Date.now().toString(36)}`;
}

// ─── Source: Finnhub ─────────────────────────────────────────────────────────

async function fetchFinnhub() {
  if (!FINNHUB_API_KEY) return [];

  const categories = ["general", "forex", "crypto"];
  const allItems = [];

  for (const category of categories) {
    try {
      const url = `${FINNHUB_URL}/news?category=${category}&token=${FINNHUB_API_KEY}`;
      const res = await fetchWithTimeout(url, 5000);
      if (!res.ok) continue;

      const data = await res.json();
      if (!Array.isArray(data)) continue;

      for (const item of data.slice(0, 30)) {
        if (
          !item.headline ||
          !isRelevantToTrading(item.headline, item.summary || "")
        )
          continue;

        const newsItem = {
          id: generateNewsId("finnhub", item.headline, item.datetime * 1000),
          source: "finnhub",
          sourceName: "Finnhub",
          title: item.headline.trim(),
          description: (item.summary || "").trim().slice(0, 500),
          url: item.url || "",
          publishedAt: new Date(item.datetime * 1000).toISOString(),
          sentiment: classifySentiment(item.headline, item.summary || ""),
          impact: classifyImpact(item.headline, item.summary || ""),
          category: item.category || category,
          imageUrl: item.image || null,
          keywords: extractKeywords(item.headline, item.summary || ""),
          reactionLogged: false,
        };

        allItems.push(newsItem);
      }
    } catch (err) {
      console.error("[breakingNews] Finnhub error:", err.message);
    }
  }

  return allItems;
}

// ─── Source: NewsData.io ─────────────────────────────────────────────────────

async function fetchNewsData() {
  if (!NEWS_API_KEY) return [];

  try {
    const today = new Date().toISOString().split("T")[0];
    const url = `${NEWS_API_URL}?apikey=${NEWS_API_KEY}&language=en&category=business,top&date=${today}`;

    const res = await fetchWithTimeout(url, 5000);
    if (!res.ok) return [];

    const data = await res.json();
    if (data.status !== "success" || !Array.isArray(data.results)) return [];

    const items = [];
    for (const article of data.results.slice(0, 20)) {
      if (!article.title) continue;
      if (!isRelevantToTrading(article.title, article.description || ""))
        continue;

      const newsItem = {
        id: generateNewsId(
          "newsdata",
          article.title,
          article.pubDate || new Date().toISOString(),
        ),
        source: "newsdata",
        sourceName: "NewsData.io",
        title: article.title.trim(),
        description: (article.description || "").trim().slice(0, 500),
        url: article.link || "",
        publishedAt: article.pubDate || new Date().toISOString(),
        sentiment: classifySentiment(article.title, article.description || ""),
        impact: classifyImpact(article.title, article.description || ""),
        category: article.category?.[0] || "general",
        imageUrl: article.image_url || null,
        keywords: extractKeywords(article.title, article.description || ""),
        reactionLogged: false,
      };

      items.push(newsItem);
    }

    return items;
  } catch (err) {
    console.error("[breakingNews] NewsData.io error:", err.message);
    return [];
  }
}

// ─── Source: Yahoo Finance RSS ───────────────────────────────────────────────

async function fetchYahooFinanceRSS() {
  // Yahoo Finance RSS for relevant tickers — free, no API key
  const symbols = ["SPY", "QQQ", "ES=F", "NQ=F", "MNQ=F", "^VIX"];
  const allItems = [];

  for (const symbol of symbols) {
    try {
      const url = `${YF_RSS_BASE}?s=${symbol}&region=US&lang=en-US`;
      const res = await fetchWithTimeout(url, 4000);
      if (!res.ok) continue;

      const text = await res.text();
      const items = parseRSSItems(text, "yahoo");

      for (const item of items.slice(0, 5)) {
        if (!isRelevantToTrading(item.title, item.description || "")) continue;

        const newsItem = {
          id: generateNewsId("yahoo", item.title, item.pubDate),
          source: "yahoo",
          sourceName: "Yahoo Finance",
          title: item.title.trim(),
          description: (item.description || "").trim().slice(0, 500),
          url: item.link || "",
          publishedAt: item.pubDate || new Date().toISOString(),
          sentiment: classifySentiment(item.title, item.description || ""),
          impact: classifyImpact(item.title, item.description || ""),
          category: "equities",
          imageUrl: null,
          keywords: extractKeywords(item.title, item.description || ""),
          reactionLogged: false,
        };

        allItems.push(newsItem);
      }
    } catch (err) {
      console.error("[breakingNews] Yahoo Finance RSS error:", err.message);
    }
  }

  return allItems;
}

// ─── Source: GDELT ───────────────────────────────────────────────────────────

async function fetchGDELT() {
  try {
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const query = encodeURIComponent(
      "(federal reserve OR stock market OR inflation OR earnings OR GDP OR trade war) lang:english",
    );
    const url = `${GDELT_URL}?format=json&mode=artlist&query=${query}&maxrecords=20&sort=DateDesc`;

    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.articles || !Array.isArray(data.articles)) return [];

    const items = [];
    for (const article of data.articles.slice(0, 15)) {
      if (!article.title) continue;

      const newsItem = {
        id: generateNewsId(
          "gdelt",
          article.title,
          article.seendate || new Date().toISOString(),
        ),
        source: "gdelt",
        sourceName: "GDELT",
        title: article.title.trim(),
        description: (article.socialimage || article.url || "").slice(0, 500),
        url: article.url || "",
        publishedAt: article.seendate || new Date().toISOString(),
        sentiment: classifySentiment(article.title, ""),
        impact: classifyImpact(article.title, ""),
        category: article.domain || "news",
        imageUrl: article.socialimage || null,
        keywords: extractKeywords(article.title, ""),
        reactionLogged: false,
      };

      items.push(newsItem);
    }

    return items;
  } catch (err) {
    console.error("[breakingNews] GDELT error:", err.message);
    return [];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url, timeoutMs = 5000) {
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

function parseRSSItems(xmlText, source) {
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

function extractRSSField(xml, field) {
  // Try CDATA first
  const cdataMatch = xml.match(
    new RegExp(`<${field}><!\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${field}>`, "i"),
  );
  if (cdataMatch) return cdataMatch[1].trim();

  // Try regular text
  const textMatch = xml.match(
    new RegExp(`<${field}>([\\s\\S]*?)<\\/${field}>`, "i"),
  );
  if (textMatch) return textMatch[1].replace(/<[^>]+>/g, "").trim();

  return "";
}

function extractKeywords(title, description) {
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

// ─── Main: Fetch All Sources ─────────────────────────────────────────────────

/**
 * Fetch breaking news from all sources, deduplicate, cache.
 * Returns max 30 most relevant items sorted by recency + impact.
 */
export async function fetchBreakingNews(options = {}) {
  const {
    maxItems = 30,
    minImpact = "LOW",
    includeAllSources = true,
    fresh = false,
  } = options;

  if (!fresh) {
    const cachedSnapshot = await readBreakingNewsSnapshot();
    if (cachedSnapshot) {
      const cachedPayload = buildBreakingNewsPayload(cachedSnapshot, {
        maxItems,
        minImpact,
      });
      return {
        ...cachedPayload,
        cached: true,
        cacheAgeMs: Math.max(
          0,
          Date.now() - new Date(cachedPayload.fetchedAt).getTime(),
        ),
      };
    }
  }

  // Fetch all sources concurrently
  const results = await Promise.allSettled([
    fetchFinnhub(),
    fetchNewsData(),
    fetchYahooFinanceRSS(),
    includeAllSources ? fetchGDELT() : Promise.resolve([]),
  ]);

  // Merge all items
  const allItems = [];
  for (const result of results) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      allItems.push(...result.value);
    }
  }

  // Deduplicate by title similarity (simple hash dedup)
  const seen = new Set();
  const unique = [];
  for (const item of allItems) {
    const key = item.title
      .slice(0, 80)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const sortedItems = sortNewsItems(unique);
  const fetchedAt = new Date().toISOString();
  const sources = {
    finnhub: FINNHUB_API_KEY ? "configured" : "no_key",
    newsdata: NEWS_API_KEY ? "configured" : "no_key",
    yahoo: "always_on",
    gdelt: "fallback",
  };
  await writeBreakingNewsSnapshot({
    items: sortedItems,
    sources,
    fetchedAt,
  });
  const finalPayload = buildBreakingNewsPayload(
    {
      items: sortedItems,
      sources,
      fetchedAt,
    },
    {
      maxItems,
      minImpact,
    },
  );

  // Enqueue HIGH impact items for reaction tracking.
  // Redis NX prevents duplicate enqueue across multiple BFF pods (cross-pod dedup).
  // Falls back to in-process dedup if Redis is unavailable.
  const rc = await getRedisClient().catch(() => null);
  for (const item of finalPayload.items) {
    if (item.impact === "HIGH" && !item.reactionLogged) {
      let claimed = true;
      if (rc?.isOpen) {
        const key = `bknews:enq:${hashNewsTitle(item.title)}`;
        claimed =
          (await rc
            .set(key, "1", { NX: true, PX: 600_000 })
            .catch(() => null)) !== null;
      }
      if (claimed) reactionLog.enqueue(item, new Map());
    }
  }

  return {
    ...finalPayload,
    cached: false,
    cacheAgeMs: 0,
  };
}

/**
 * Get all cached news (no new fetches).
 */
export async function getCachedNews(options = {}) {
  const snapshot = await readBreakingNewsSnapshot();
  const payload = buildBreakingNewsPayload(snapshot, options);
  return {
    ...payload,
    cacheAgeMs: snapshot?.fetchedAt
      ? Math.max(0, Date.now() - new Date(snapshot.fetchedAt).getTime())
      : null,
    reactionLog: reactionLog.getAllReactions().length,
  };
}

/**
 * Update candle prices for reaction tracking.
 * Called every 5 minutes from MathEngine data.
 */
export function updateNewsReactions(candlePrices) {
  reactionLog.updateLastCandle(candlePrices);
}

/**
 * Get reactions for specific news items (for ML training).
 */
export function getNewsReactions(newsId) {
  return reactionLog.getReactionForNews(newsId);
}

/**
 * Get all recent reactions (for ML retraining data).
 */
export function getRecentNewsReactions(minutes = 120) {
  return reactionLog.getRecentReactions(minutes);
}

/**
 * Trigger ML retrain on HIGH impact news.
 */
export async function triggerMLRetrainOnNews(newsItem) {
  if (!newsItem || newsItem.impact !== "HIGH") return { triggered: false };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${ML_ENGINE_BASE}/news-trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        news: {
          id: newsItem.id,
          title: newsItem.title,
          source: newsItem.source,
          sentiment: newsItem.sentiment,
          impact: newsItem.impact,
          keywords: newsItem.keywords,
          publishedAt: newsItem.publishedAt,
        },
        trigger_type: "breaking_news_high_impact",
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!res.ok) return { triggered: false, reason: `ML Engine ${res.status}` };

    const data = await res.json();
    await markBreakingNewsReacted(newsItem.id);
    return { triggered: true, newsId: newsItem.id, response: data };
  } catch (err) {
    return { triggered: false, reason: err.message };
  }
}

export function createBreakingNewsService() {
  return {
    fetchBreakingNews,
    getCachedNews,
    updateNewsReactions,
    getNewsReactions,
    getRecentNewsReactions,
    triggerMLRetrainOnNews,
    reactionLog,
    logNewsReaction: (newsId, data) => reactionLog.logReaction(newsId, data),
  };
}

export default createBreakingNewsService;
