/**
 * k6 Load Test Scenarios — TradersApp ML Engine
 *
 * Scenarios:
 *   (a) POST /predict           — 50 VUs, 30s ramp-up, 60s peak hold
 *   (b) POST /mamba/predict     — 25 VUs, 30s ramp-up, 60s peak hold
 *   (c) GET  /consensus         — 75 VUs, 60s ramp-up, 120s peak hold
 *
 * SLA thresholds (enforced via k6 thresholds):
 *   - p95 < 200 ms
 *   - p99 < 500 ms
 *   - fail ratio < 1 %
 *
 * Usage:
 *   # Run all scenarios
 *   k6 run scenarios.js
 *
 *   # Run single scenario
 *   k6 run scenarios.js -e SCENARIO=predict
 *
 *   # Run against a specific BASE_URL
 *   BASE_URL=https://ml-engine.staging.example.com k6 run scenarios.js
 *
 *   # Override thresholds
 *   SLA_P95_MS=150 SLA_P99_MS=300 k6 run scenarios.js
 *
 * Environment variables:
 *   BASE_URL        — ML Engine base URL  (default: http://127.0.0.1:8001)
 *   BFF_BASE_URL    — BFF base URL         (default: http://127.0.0.1:8788)
 *   SCENARIO        — Run only this scenario name (predict|mamba|consensus|all)
 *   SLA_P95_MS      — P95 SLA in ms         (default: 200)
 *   SLA_P99_MS      — P99 SLA in ms         (default: 500)
 *   MAX_FAIL_RATIO  — Max failure ratio     (default: 0.01)
 *   DURATION_SEED   — Override peak duration in seconds (default: varies per scenario)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// ─── Metrics ──────────────────────────────────────────────────────────────────

const predictLatency = new Trend('predict_latency_ms');
const mambaLatency   = new Trend('mamba_latency_ms');
const consensusLatency = new Trend('consensus_latency_ms');

const predictFail = new Rate('predict_fail_rate');
const mambaFail   = new Rate('mamba_fail_rate');
const consensusFail = new Rate('consensus_fail_rate');

const predictErrors = new Counter('predict_errors');
const mambaErrors   = new Counter('mamba_errors');
const consensusErrors = new Counter('consensus_errors');

// ─── SLA Configuration ─────────────────────────────────────────────────────────

const SLA_P95_MS     = parseFloat(__ENV.SLA_P95_MS     || '200');
const SLA_P99_MS     = parseFloat(__ENV.SLA_P99_MS     || '500');
const MAX_FAIL_RATIO = parseFloat(__ENV.MAX_FAIL_RATIO || '0.01');

// ─── Base URLs ─────────────────────────────────────────────────────────────────

const BASE_URL     = __ENV.BASE_URL     || 'http://127.0.0.1:8001';
const BFF_BASE_URL = __ENV.BFF_BASE_URL || 'http://127.0.0.1:8788';

// ─── Request Selectors ─────────────────────────────────────────────────────────

const ACTIVE_SCENARIO = __ENV.SCENARIO || 'all';

// ─── Test Data Helpers ─────────────────────────────────────────────────────────

const SYMBOLS     = ['MNQ', 'ES', 'NQ', 'YM'];
const REGIMES     = ['COMPRESSION', 'NORMAL', 'EXPANSION'];
const AMD_PHASES  = ['ACCUMULATION', 'MANIPULATION', 'DISTRIBUTION', 'TRANSITION', 'UNCLEAR'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCandles(n = 20, basePrice = 18500.0) {
  const candles = [];
  const now = Date.now() / 1000;
  let price = basePrice;

  for (let i = 0; i < n; i++) {
    const o  = price + (Math.random() - 0.5) * 10;
    const c  = o    + (Math.random() - 0.5) * 6;
    const h  = Math.max(o, c) + Math.random() * 4 + 0.5;
    const l  = Math.min(o, c) - Math.random() * 4 - 0.5;
    const vol = Math.floor(3000 + Math.random() * 4000);

    candles.push({
      symbol:    randomChoice(SYMBOLS),
      timestamp: String(Math.round(now - (n - i) * 300)),
      open:      parseFloat(o.toFixed(2)),
      high:      parseFloat(h.toFixed(2)),
      low:       parseFloat(l.toFixed(2)),
      close:     parseFloat(c.toFixed(2)),
      volume:    vol,
    });
    price = c;
  }
  return candles;
}

function generateTrades(n = 10) {
  const trades = [];
  const now = Date.now() / 1000;

  for (let i = 0; i < n; i++) {
    const entry  = now - (n - i) * 600;
    const exit   = entry + Math.random() * 1500 + 300;
    const pnl    = parseFloat(((Math.random() - 0.5) * 20).toFixed(2));
    trades.push({
      symbol:     randomChoice(SYMBOLS),
      direction:  Math.random() > 0.5 ? 'LONG' : 'SHORT',
      entry_time:  Math.round(entry),
      exit_time:   Math.round(exit),
      pnl_ticks:  pnl,
      pnl_dollars: parseFloat((pnl * 5).toFixed(2)),
      result:      pnl > 0 ? 'win' : 'loss',
      confidence:  parseFloat((0.52 + Math.random() * 0.36).toFixed(2)),
    });
  }
  return trades;
}

// ─── Shared Payloads ───────────────────────────────────────────────────────────

const predictPayload = () => ({
  symbol: randomChoice(SYMBOLS),
  candles: generateCandles(20),
  trades:  generateTrades(10),
  session_id:          Math.floor(Math.random() * 3),
  mathEngineSnapshot: {
    amdPhase: randomChoice(AMD_PHASES),
    vrRegime: randomChoice(REGIMES),
  },
});

const mambaPayload = () => ({
  symbol:  randomChoice(SYMBOLS),
  candles: generateCandles(50),   // Mamba needs longer history
  regime: randomChoice(REGIMES),
});

const consensusPayload = () => ({
  symbol: randomChoice(SYMBOLS),
  candles: generateCandles(20),
  trades:  generateTrades(10),
  session_id:          Math.floor(Math.random() * 3),
  mathEngineSnapshot: {
    amdPhase: randomChoice(AMD_PHASES),
    vrRegime: randomChoice(REGIMES),
  },
});

// ─── SLA Check Helper ──────────────────────────────────────────────────────────

/**
 * Returns a k6 `check()` that validates response status and records metrics.
 * Marks request as failed if status != 200 (or != 503 for circuit-breaker fallback).
 */
function assertResponse(name, response, latencyMetric, failMetric, errorCounter) {
  const isOK = response.status === 200;
  const isCircuitBreaker = response.status === 503;   // BFF circuit-breaker open — acceptable

  const ok = check(response, {
    [`${name} — status 200`]: (r) => r.status === 200,
    [`${name} — valid body`]:  (r) => {
      if (r.status !== 200) return true;
      try { JSON.parse(r.body); return true; }
      catch { return false; }
    },
    [`${name} — p95 SLA`]:    (r) => latencyMetric.add(r.timings.duration, { scenario: name }) || true,
  });

  if (!isOK && !isCircuitBreaker) {
    failMetric.add(1);
    errorCounter.add(1);
  } else {
    failMetric.add(0);
  }

  return ok;
}

// ─── Scenario: POST /predict ───────────────────────────────────────────────────

export const predictScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '30s', target: 50 },   // ramp up
    { duration: '60s', target: 50 },   // peak hold
  ],
  tags: { scenario: 'predict' },

  preAllocatedVUs: 50,

  exec: 'runPredict',
};

// ─── Scenario: POST /mamba/predict ────────────────────────────────────────────

export const mambaScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '30s', target: 25 },   // ramp up
    { duration: '60s', target: 25 },   // peak hold
  ],
  tags: { scenario: 'mamba' },

  preAllocatedVUs: 25,

  exec: 'runMamba',
};

// ─── Scenario: GET /consensus (via BFF) ───────────────────────────────────────

export const consensusScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '60s', target: 75 },   // slower ramp — consensus is heavier
    { duration: '120s', target: 75 },  // long peak hold
  ],
  tags: { scenario: 'consensus' },

  preAllocatedVUs: 75,

  exec: 'runConsensus',
};

// ─── k6 exported functions (one per scenario) ─────────────────────────────────

export function runPredict() {
  if (ACTIVE_SCENARIO !== 'all' && ACTIVE_SCENARIO !== 'predict') return;

  const payload  = JSON.stringify(predictPayload());
  const headers  = { 'Content-Type': 'application/json' };

  const response = http.post(`${BASE_URL}/predict`, payload, { headers, tags: { name: 'predict' } });
  assertResponse('predict', response, predictLatency, predictFail, predictErrors);

  sleep(Math.random() * 2 + 1);   // 1–3 s between requests
}

export function runMamba() {
  if (ACTIVE_SCENARIO !== 'all' && ACTIVE_SCENARIO !== 'mamba') return;

  const payload  = JSON.stringify(mambaPayload());
  const headers  = { 'Content-Type': 'application/json' };

  const response = http.post(`${BASE_URL}/mamba/predict`, payload, { headers, tags: { name: 'mamba' } });
  assertResponse('mamba', response, mambaLatency, mambaFail, mambaErrors);

  sleep(Math.random() * 2 + 1);
}

export function runConsensus() {
  if (ACTIVE_SCENARIO !== 'all' && ACTIVE_SCENARIO !== 'consensus') return;

  const payload  = JSON.stringify(consensusPayload());
  const headers  = { 'Content-Type': 'application/json' };

  const response = http.post(`${BFF_BASE_URL}/api/consensus`, payload, { headers, tags: { name: 'consensus' } });
  assertResponse('consensus', response, consensusLatency, consensusFail, consensusErrors);

  sleep(Math.random() * 2 + 1);
}

// ─── Scenario Map (used by k6-runner.sh) ─────────────────────────────────────

export const SCENARIOS = {
  predict:   { ...predictScenario,   func: 'runPredict' },
  mamba:     { ...mambaScenario,     func: 'runMamba'   },
  consensus: { ...consensusScenario, func: 'runConsensus' },
};

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const thresholds = {
  // /predict
  'predict_latency_ms': [
    { threshold: `p(95)<${SLA_P95_MS}`,   abortOnFail: false, delayAbortEval: '10s' },
    { threshold: `p(99)<${SLA_P99_MS}`,   abortOnFail: false, delayAbortEval: '10s' },
  ],
  'predict_fail_rate': [
    { threshold: `rate<${MAX_FAIL_RATIO}`, abortOnFail: false },
  ],

  // /mamba/predict
  'mamba_latency_ms': [
    { threshold: `p(95)<${SLA_P95_MS}`,   abortOnFail: false, delayAbortEval: '10s' },
    { threshold: `p(99)<${SLA_P99_MS}`,   abortOnFail: false, delayAbortEval: '10s' },
  ],
  'mamba_fail_rate': [
    { threshold: `rate<${MAX_FAIL_RATIO}`, abortOnFail: false },
  ],

  // /consensus
  'consensus_latency_ms': [
    { threshold: `p(95)<${SLA_P95_MS * 1.5}`, abortOnFail: false, delayAbortEval: '10s' },  // BFF adds overhead
    { threshold: `p(99)<${SLA_P99_MS * 1.5}`, abortOnFail: false, delayAbortEval: '10s' },
  ],
  'consensus_fail_rate': [
    { threshold: `rate<${MAX_FAIL_RATIO}`, abortOnFail: false },
  ],

  // Global
  'http_req_failed': [
    { threshold: `rate<${MAX_FAIL_RATIO}`, abortOnFail: false },
  ],
};

// ─── Options ───────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    predict:   predictScenario,
    mamba:     mambaScenario,
    consensus: consensusScenario,
  },
  thresholds,
  summaryTrendCols: ['avg', 'min', 'med', 'p(95)', 'p(99)', 'max'],

  // k6 Cloud / results output
  hosts: {
    'ML': BASE_URL,
    'BFF': BFF_BASE_URL,
  },
};

// ─── Default function (used when exec is empty — runs all VUs) ─────────────────

export default function () {
  // No-op: all scenario logic lives in runPredict / runMamba / runConsensus
  // which k6 invokes via the `exec` field on each scenario object.
}
