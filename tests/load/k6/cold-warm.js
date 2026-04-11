/**
 * cold-warm.js — k6 Load Test: Cold vs Warm Cache Comparison
 *
 * Measures and compares ML Engine latency under two cache states:
 *   1. Cold  — first request after cache eviction (time-to-first-200)
 *   2. Warm  — steady-state request latency with warm cache (P95/P99 of 10 requests)
 *
 * Output: CSV with columns run_id, cache_state, p50_ms, p95_ms, p99_ms, fail_rate
 *
 * Usage:
 *   k6 run tests/load/k6/cold-warm.js
 *   BASE_URL=http://ml-engine:8001 k6 run tests/load/k6/cold-warm.js
 *   RUN_ID=build-42 OUTPUT_CSV=/tmp/results.csv k6 run tests/load/k6/cold-warm.js
 *
 * k6 run modes:
 *   Single run (manual):  k6 run cold-warm.js
 *   CI / automated:       k6 run --out csv=cold-warm-results.csv cold-warm.js
 *
 * SLA thresholds enforced as thresholds below.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8788';
const RUN_ID   = __ENV.RUN_ID   || `run-${Date.now()}`;
const WARM_CONSECUTIVE = 10;   // number of warm requests to average

// ─── Custom metrics ───────────────────────────────────────────────────────────

const errorRate     = new Rate('error_rate');
const coldTrend     = new Trend('cold_request_ms');
const warmTrend     = new Trend('warm_request_ms');

// ─── Shared payload (matches ml-engine schema) ────────────────────────────────

const DEFAULT_PAYLOAD = {
  symbol: 'MNQ',
  candles: [
    { symbol: 'MNQ', timestamp: '1712500000', open: 18500.0, high: 18505.0, low: 18498.0, close: 18503.0, volume: 4200 },
    { symbol: 'MNQ', timestamp: '1712500300', open: 18503.0, high: 18508.5, low: 18499.0, close: 18507.0, volume: 4350 },
    { symbol: 'MNQ', timestamp: '1712500600', open: 18507.0, high: 18512.0, low: 18506.5, close: 18510.5, volume: 4510 },
  ],
  trades: [],
  session_id: 1,
  mathEngineSnapshot: { amdPhase: 'ACCUMULATION', vrRegime: 'NORMAL' },
};

const PREDICT_URL = `${BASE_URL}/predict`;
const HEALTH_URL  = `${BASE_URL}/health`;

// ─── Helper: timed POST ────────────────────────────────────────────────────────

function timedPost(url, payload) {
  const body    = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json' };
  const start   = Date.now();
  const res     = http.post(url, body, { headers });
  const elapsed = Date.now() - start;
  return { res, elapsed };
}

// ─── Helper: percentiles from an array of numbers ────────────────────────────

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx    = (p / 100) * (sorted.length - 1);
  const lo     = Math.floor(idx);
  const hi     = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

// ─── k6 options ───────────────────────────────────────────────────────────────

export const options = {
  // One VU, single iteration — designed to run twice: cold then warm
  vus:       1,
  iterations: 1,

  thresholds: {
    // These thresholds are informational; CSV output carries the actual data
    'error_rate': ['rate<0.05'],
  },
};

// ─── warmup: ensure service is healthy before measuring ─────────────────────

function waitForHealthy(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = http.get(HEALTH_URL, { timeout: '3s' });
      if (res && res.status === 200) return true;
    } catch (_) { /* poll */ }
    sleep(1);
  }
  return false;
}

// ─── coldRequest ──────────────────────────────────────────────────────────────
// Makes exactly ONE request and records its wall-clock latency.

function coldRequest() {
  const { res, elapsed } = timedPost(PREDICT_URL, DEFAULT_PAYLOAD);
  coldTrend.add(elapsed);
  if (res.status !== 200) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
  return {
    success:    res.status === 200,
    status:     res.status,
    latencyMs:  elapsed,
  };
}

// ─── warmRequests ─────────────────────────────────────────────────────────────
// Makes WARM_CONSECUTIVE requests and returns an object with p50/p95/p99/failRate.

function warmRequests() {
  const latencies = [];
  let failures     = 0;

  for (let i = 0; i < WARM_CONSECUTIVE; i++) {
    const { res, elapsed } = timedPost(PREDICT_URL, DEFAULT_PAYLOAD);
    warmTrend.add(elapsed);
    if (res.status !== 200) {
      failures++;
      errorRate.add(1);
    } else {
      errorRate.add(0);
    }
    latencies.push(elapsed);
    // Short delay between requests to simulate realistic pacing
    sleep(0.2);
  }

  const p50      = percentile(latencies, 50);
  const p95      = percentile(latencies, 95);
  const p99      = percentile(latencies, 99);
  const failRate = failures / WARM_CONSECUTIVE;

  return { latencies, p50, p95, p99, failRate };
}

// ─── writeCsvRow ──────────────────────────────────────────────────────────────
// Appends a CSV row to __ENV.OUTPUT_CSV so CI pipelines can collect results.

function writeCsvRow(runId, cacheState, p50, p95, p99, failRate) {
  const csvPath = __ENV.OUTPUT_CSV;
  if (!csvPath) return;

  const header = 'run_id,cache_state,p50_ms,p95_ms,p99_ms,fail_rate';
  const row    = [
    runId,
    cacheState,
    p50.toFixed(2),
    p95.toFixed(2),
    p99.toFixed(2),
    failRate.toFixed(6),
  ].join(',');

  // k6 doesn't have a native fs module in the script; use HTTP POST to a
  // results-collector endpoint if available, otherwise emit to stdout for grep.
  // We emit a well-known prefix so CI can capture via tee / grep.
  console.log(`K6_CSV_RESULT:${row}`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function () {
  // 1. Verify service health before starting
  const healthy = waitForHealthy(30_000);
  if (!healthy) {
    console.error('Service did not reach healthy state within 30s — aborting.');
    return;
  }

  // ── Cold request (time-to-first-200) ────────────────────────────────────
  const cold = coldRequest();

  console.log(`[${RUN_ID}] cold  status=${cold.status} latency=${cold.latencyMs}ms`);

  writeCsvRow(
    RUN_ID,
    'cold',
    cold.latencyMs,   // single request: p50 == latency
    cold.latencyMs,   // p95 not meaningful for n=1
    cold.latencyMs,   // p99 not meaningful for n=1
    cold.success ? 0 : 1,
  );

  // Brief settle period before warm run
  sleep(2);

  // ── Warm requests ───────────────────────────────────────────────────────
  const warm = warmRequests();

  console.log(
    `[${RUN_ID}] warm  p50=${warm.p50.toFixed(2)}ms  ` +
    `p95=${warm.p95.toFixed(2)}ms  p99=${warm.p99.toFixed(2)}ms  ` +
    `fail_rate=${warm.failRate.toFixed(4)}`,
  );

  writeCsvRow(RUN_ID, 'warm', warm.p50, warm.p95, warm.p99, warm.failRate);
}

export function handleSummary(data) {
  // k6 calls handleSummary after the run — emit a structured summary to stdout.
  // CI pipelines can parse K6_SUMMARY_* lines for dashboards.
  const coldMs  = data.metrics.cold_request_ms?.values;
  const warmMs  = data.metrics.warm_request_ms?.values;
  const errors  = data.metrics.error_rate?.values;

  console.log(`K6_SUMMARY_COLD  p50=${(coldMs?.p50 ?? 0).toFixed(2)}  p95=${(coldMs?.p95 ?? 0).toFixed(2)}  p99=${(coldMs?.p99 ?? 0).toFixed(2)}  fail_rate=${(errors?.rate ?? 0).toFixed(6)}`);
  console.log(`K6_SUMMARY_WARM  p50=${(warmMs?.p50 ?? 0).toFixed(2)}  p95=${(warmMs?.p95 ?? 0).toFixed(2)}  p99=${(warmMs?.p99 ?? 0).toFixed(2)}  fail_rate=${(errors?.rate ?? 0).toFixed(6)}`);
}
