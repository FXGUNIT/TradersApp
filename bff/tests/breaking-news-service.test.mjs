import test from "node:test";
import assert from "node:assert/strict";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_FINNHUB = process.env.FINNHUB_API_KEY;
const ORIGINAL_NEWSDATA = process.env.NEWS_API_KEY;
const ORIGINAL_FOREX_FACTORY_JSON_URLS = process.env.FOREX_FACTORY_JSON_URLS;

function restoreEnv() {
  if (ORIGINAL_FINNHUB === undefined) {
    delete process.env.FINNHUB_API_KEY;
  } else {
    process.env.FINNHUB_API_KEY = ORIGINAL_FINNHUB;
  }

  if (ORIGINAL_NEWSDATA === undefined) {
    delete process.env.NEWS_API_KEY;
  } else {
    process.env.NEWS_API_KEY = ORIGINAL_NEWSDATA;
  }

  if (ORIGINAL_FOREX_FACTORY_JSON_URLS === undefined) {
    delete process.env.FOREX_FACTORY_JSON_URLS;
  } else {
    process.env.FOREX_FACTORY_JSON_URLS = ORIGINAL_FOREX_FACTORY_JSON_URLS;
  }
}

test("fetchBreakingNews includes Yahoo and GDELT items when optional providers succeed", async () => {
  process.env.FINNHUB_API_KEY = "";
  process.env.NEWS_API_KEY = "";

  const requests = [];
  const yahooRss = `
<rss><channel>
  <item>
    <title>Fed rate cut drives Nasdaq rally</title>
    <link>https://example.com/yahoo-fed</link>
    <description>Fed and inflation update for futures traders</description>
    <pubDate>Wed, 15 Apr 2026 09:00:00 GMT</pubDate>
  </item>
</channel></rss>
`.trim();
  const forexFactoryHtml = `
<table>
  <tr class="calendar__row calendar_row">
    <td class="calendar__cell calendar__date">Tomorrow</td>
    <td class="calendar__cell calendar__time">8:30am</td>
    <td class="calendar__cell calendar__currency">USD</td>
    <td class="calendar__cell calendar__impact"><span class="impact impact--high"></span></td>
    <td class="calendar__cell calendar__event">Core CPI m/m</td>
  </tr>
</table>
`.trim();
  const gdeltPayload = {
    articles: [
      {
        title: "Trade war tensions ease after tariff pause",
        url: "https://example.com/gdelt-tariff",
        seendate: "2026-04-15T09:05:00Z",
        domain: "macro",
      },
    ],
  };

  globalThis.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes("forexfactory.com")) {
      return {
        ok: true,
        text: async () => forexFactoryHtml,
      };
    }
    if (String(url).includes("feeds.finance.yahoo.com")) {
      return {
        ok: true,
        text: async () => yahooRss,
      };
    }
    if (String(url).includes("gdeltproject.org")) {
      return {
        ok: true,
        json: async () => gdeltPayload,
      };
    }
    return {
      ok: false,
      status: 404,
      text: async () => "",
      json: async () => ({}),
    };
  };

  try {
    const moduleUrl = new URL("../services/breakingNewsService.mjs", import.meta.url);
    const breakingNewsService = await import(
      `${moduleUrl.href}?ts=${Date.now()}-${Math.random()}`
    );

    const result = await breakingNewsService.fetchBreakingNews({
      fresh: true,
      includeAllSources: true,
      maxItems: 20,
      minImpact: "LOW",
    });

    assert.ok(Array.isArray(result.items));
    assert.ok(result.items.length >= 2);
    assert.ok(result.items.some((item) => item.source === "yahoo"));
    assert.ok(result.items.some((item) => item.source === "gdelt"));
    assert.ok(result.items.some((item) => item.source === "forexfactory"));
    assert.ok(requests.some((url) => url.includes("forexfactory.com")));
    assert.ok(requests.some((url) => url.includes("feeds.finance.yahoo.com")));
    assert.ok(requests.some((url) => url.includes("gdeltproject.org")));
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    restoreEnv();
  }
});

test("scrapeForexFactory falls back to the weekly JSON export when HTML is blocked", async () => {
  process.env.FOREX_FACTORY_JSON_URLS = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes("forexfactory.com")) {
      return {
        ok: false,
        status: 403,
        text: async () => "",
      };
    }
    if (String(url).includes("nfs.faireconomy.media")) {
      return {
        ok: true,
        json: async () => [
          {
            title: "FOMC Statement",
            country: "USD",
            date: "2026-04-30T14:00:00-04:00",
            impact: "High",
            forecast: "",
            previous: "",
          },
        ],
      };
    }
    return {
      ok: false,
      status: 404,
      text: async () => "",
      json: async () => ({}),
    };
  };

  try {
    const moduleUrl = new URL("../services/forexFactoryScraper.mjs", import.meta.url);
    const scraper = await import(`${moduleUrl.href}?ts=${Date.now()}-${Math.random()}`);

    const events = await scraper.scrapeForexFactory({
      daysAhead: 1,
      minImpact: 3,
      now: new Date("2026-04-30T15:00:00Z"),
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].currency, "USD");
    assert.equal(events[0].title, "FOMC Statement");
    assert.equal(events[0].impactLabel, "HIGH");
    assert.ok(requests.some((url) => url.includes("forexfactory.com")));
    assert.ok(requests.some((url) => url.includes("nfs.faireconomy.media")));
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    restoreEnv();
  }
});
