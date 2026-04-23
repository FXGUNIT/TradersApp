import test from "node:test";
import assert from "node:assert/strict";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_FINNHUB = process.env.FINNHUB_API_KEY;
const ORIGINAL_NEWSDATA = process.env.NEWS_API_KEY;

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
