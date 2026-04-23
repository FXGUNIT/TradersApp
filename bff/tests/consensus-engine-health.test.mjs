import test from "node:test";
import assert from "node:assert/strict";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_HEALTH_TIMEOUT = process.env.ML_HEALTH_TIMEOUT_MS;
const ORIGINAL_HEALTH_CACHE_TTL = process.env.ML_HEALTH_CACHE_TTL_MS;
const ORIGINAL_HEALTH_STALE_GRACE = process.env.ML_HEALTH_STALE_GRACE_MS;
const ORIGINAL_BOARD_ROOM_REPORTING = process.env.BOARD_ROOM_AGENT_REPORTING;

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function importConsensusEngine() {
  const moduleUrl = new URL("../services/consensusEngine.mjs", import.meta.url);
  return await import(`${moduleUrl.href}?ts=${Date.now()}-${Math.random()}`);
}

function buildSampleCandles(count = 20) {
  const candles = [];
  const basePrice = 18500.0;
  const baseTime = Date.parse("2026-04-21T09:30:00Z");

  for (let index = 0; index < count; index += 1) {
    const openPrice = basePrice + index * 2.0;
    const closePrice = openPrice + 1.0;
    candles.push({
      symbol: "NIFTY",
      timestamp: new Date(baseTime + index * 5 * 60 * 1000).toISOString(),
      open: Number(openPrice.toFixed(2)),
      high: Number((closePrice + 1.0).toFixed(2)),
      low: Number((openPrice - 1.0).toFixed(2)),
      close: Number(closePrice.toFixed(2)),
      volume: 4200 + index * 20,
    });
  }

  return candles;
}

test("checkMlHealth coalesces concurrent refreshes and reuses a fresh cache entry", async () => {
  process.env.BOARD_ROOM_AGENT_REPORTING = "false";
  process.env.ML_HEALTH_TIMEOUT_MS = "250";
  process.env.ML_HEALTH_CACHE_TTL_MS = "5000";
  process.env.ML_HEALTH_STALE_GRACE_MS = "30000";

  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: "healthy", request_id: "req-health-001" }),
      text: async () => "",
    };
  };

  try {
    const module = await importConsensusEngine();
    module.__resetMlHealthCacheForTests();

    const [first, second, third] = await Promise.all([
      module.checkMlHealth(),
      module.checkMlHealth(),
      module.checkMlHealth(),
    ]);

    assert.equal(fetchCalls, 1);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(third.ok, true);
    assert.equal(first.cache.state, "live");
    assert.equal(second.cache.state, "live");
    assert.equal(third.cache.state, "live");

    const cached = await module.checkMlHealth();
    assert.equal(fetchCalls, 1);
    assert.equal(cached.ok, true);
    assert.equal(cached.cache.state, "cached");
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    restoreEnv("ML_HEALTH_TIMEOUT_MS", ORIGINAL_HEALTH_TIMEOUT);
    restoreEnv("ML_HEALTH_CACHE_TTL_MS", ORIGINAL_HEALTH_CACHE_TTL);
    restoreEnv("ML_HEALTH_STALE_GRACE_MS", ORIGINAL_HEALTH_STALE_GRACE);
    restoreEnv("BOARD_ROOM_AGENT_REPORTING", ORIGINAL_BOARD_ROOM_REPORTING);
  }
});

test("checkMlHealth serves stale last-known-good data when refresh fails briefly", async () => {
  process.env.BOARD_ROOM_AGENT_REPORTING = "false";
  process.env.ML_HEALTH_TIMEOUT_MS = "250";
  process.env.ML_HEALTH_CACHE_TTL_MS = "1";
  process.env.ML_HEALTH_STALE_GRACE_MS = "30000";

  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    if (fetchCalls === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "healthy", request_id: "req-health-002" }),
        text: async () => "",
      };
    }

    throw new Error("synthetic upstream timeout");
  };

  try {
    const module = await importConsensusEngine();
    module.__resetMlHealthCacheForTests();

    const first = await module.checkMlHealth();
    assert.equal(first.ok, true);
    assert.equal(first.cache.state, "live");

    await new Promise((resolve) => setTimeout(resolve, 10));

    const stale = await module.checkMlHealth();
    assert.equal(fetchCalls, 2);
    assert.equal(stale.ok, true);
    assert.equal(stale.cache.state, "stale-fallback");
    assert.equal(stale.degraded, true);
    assert.match(stale.upstream_error, /synthetic upstream timeout/i);
    assert.equal(stale.request_id, "req-health-002");
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    restoreEnv("ML_HEALTH_TIMEOUT_MS", ORIGINAL_HEALTH_TIMEOUT);
    restoreEnv("ML_HEALTH_CACHE_TTL_MS", ORIGINAL_HEALTH_CACHE_TTL);
    restoreEnv("ML_HEALTH_STALE_GRACE_MS", ORIGINAL_HEALTH_STALE_GRACE);
    restoreEnv("BOARD_ROOM_AGENT_REPORTING", ORIGINAL_BOARD_ROOM_REPORTING);
  }
});

test("getMlConsensus resolves a normal consensus response without throwing", async () => {
  process.env.BOARD_ROOM_AGENT_REPORTING = "false";

  globalThis.fetch = async (url) => {
    if (String(url).includes("/predict")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          signal: "LONG",
          confidence: 0.73,
          votes: { direction: { model_name: "direction", confidence: 0.73 } },
          models_used: 2,
          data_trades_analyzed: 20,
          model_freshness: "fresh",
          timing: { enter_now: true },
        }),
        text: async () => "",
      };
    }

    throw new Error(`Unexpected fetch URL in test: ${url}`);
  };

  try {
    const module = await importConsensusEngine();

    const result = await module.getMlConsensus({
      mathEngine: { amdPhase: "ACCUMULATION", vwapSlope: 1 },
      recentCandles: buildSampleCandles(),
      keyLevels: { pdh: 18600, pdl: 18400 },
      sessionId: 1,
      symbol: "NIFTY",
      requestId: "test-consensus-ok",
    });

    assert.equal(result.ok, true);
    assert.equal(result.signal, "LONG");
    assert.equal(result.instrument.symbol, "NIFTY");
    assert.equal(result.circuitBreaker, "closed");
    assert.equal(result.models_used, 2);
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    restoreEnv("BOARD_ROOM_AGENT_REPORTING", ORIGINAL_BOARD_ROOM_REPORTING);
  }
});
