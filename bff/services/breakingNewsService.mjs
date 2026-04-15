/**
 * Breaking News Intelligence Service
 * Real-time news for MNQ/ES/SPY via Finnhub, NewsData.io, Yahoo Finance RSS, GDELT.
 * Redis-backed snapshot cache; NewsReactionLog tracks 5/15/30/60-min market reactions.
 */

import { getRedisClient } from "./redis-session-store.mjs";
import {
  classifySentiment,
  classifyImpact,
  isRelevantToTrading,
  generateNewsId,
  extractKeywords,
  hashNewsTitle,
  sortNewsItems,
  buildBreakingNewsPayload,
  parseRSSItems,
  extractRSSField,
  fetchWithTimeout,
  isOutboundUrlAllowed,
} from "./newsFormatter.mjs";

// ─── Configuration ─────────────────────────────────────────────────────────────

const FINNHUB_API_KEY =
  String(process.env.FINNHUB_API_KEY || "").trim() || null;
const FINNHUB_URL = "https://finnhub.io/api/v1";
const NEWS_API_KEY = String(process.env.NEWS_API_KEY || "").trim() || null;
const NEWS_API_URL = "https://newsdata.io/api/1/news";
const YF_RSS_BASE = "https://feeds.finance.yahoo.com/rss/2.0/headline";
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

const ML_ENGINE_BASE = String(
  process.env.ML_ENGINE_URL ||
    process.env.ML_ENGINE_INTERNAL_URL ||
    "http://ml-engine:8001",
).trim();
const BREAKING_NEWS_CACHE_KEY = "bknews:latest";
const BREAKING_NEWS_CACHE_TTL_MS = Number.parseInt(
  process.env.BREAKING_NEWS_CACHE_TTL_MS || "600000",
  10,
);
const BREAKING_NEWS_WARN_COOLDOWN_MS = Number.parseInt(
  process.env.BREAKING_NEWS_WARN_COOLDOWN_MS || "60000",
  10,
);
const BREAKING_NEWS_CACHE_TTL_SECONDS = Math.max(
  1,
  Math.ceil(BREAKING_NEWS_CACHE_TTL_MS / 1000),
);
const sourceWarnState = new Map();

function normalizeNewsSourceError(error) {
  if (!error) {
    return "unknown upstream error";
  }

  if (error.name === "AbortError" || /aborted/i.test(error.message || "")) {
    return "request timed out";
  }

  return error.message || "unknown upstream error";
}

function logNewsSourceWarning(sourceName, error) {
  const message = normalizeNewsSourceError(error);
  const now = Date.now();
  const previous = sourceWarnState.get(sourceName);
  if (
    previous &&
    previous.message === message &&
    now - previous.at < BREAKING_NEWS_WARN_COOLDOWN_MS
  ) {
    return;
  }

  sourceWarnState.set(sourceName, { message, at: now });
  console.warn(
    `[breakingNews] ${sourceName} unavailable; continuing without it: ${message}`,
  );
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
    await rc.set(BREAKING_NEWS_CACHE_KEY, JSON.stringify(snapshot), {
      EX: BREAKING_NEWS_CACHE_TTL_SECONDS,
    });
    return true;
  } catch {
    return false;
  }
}

async function markBreakingNewsReacted(newsId) {
  if (!newsId) return;
  const snapshot = await readBreakingNewsSnapshot();
  if (!snapshot?.items?.length) return;
  const items = snapshot.items.map(item =>
    item.id === newsId ? { ...item, reactionLogged: true } : item
  );
  if (items.some((item, i) => item !== snapshot.items[i])) {
    await writeBreakingNewsSnapshot({ ...snapshot, items });
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
      logNewsSourceWarning("Finnhub", err);
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
    logNewsSourceWarning("NewsData.io", err);
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
      logNewsSourceWarning("Yahoo Finance RSS", err);
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

    if (!isOutboundUrlAllowed(url)) {
      console.error("[breakingNewsService] SSRF guard: blocked GDELT URL", url);
      return [];
    }
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
    logNewsSourceWarning("GDELT", err);
    return [];
  }
}

// ─── Main: Fetch All Sources ────────────────────────────────

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
