/**
 * k6 Load Test Scenarios — TradersApp
 * Tests: POST /predict, POST /mamba/predict, GET /consensus
 *
 * SLA thresholds:
 *   p95 < 200 ms
 *   p99 < 500 ms
 *   fail ratio < 1 %
 *
 * Usage:
 *   k6 run tests/load/k6/scenarios.js
 *   BASE_URL=http://localhost:8788 k6 run tests/load/k6/scenarios.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metric: error rate across all endpoints
const errorRate = new Rate('error_rate');

// ─── Fixtures (from tests/load/k6/fixtures.py — embedded as constants) ────────

// Trending candles — consistent directional movement, 50 × 5-min bars
const TRENDING_BASE = 45000;
const trendingCandles = Array.from({ length: 50 }, (_, i) => {
  const offset = i * 15;
  return {
    symbol: 'MNQ',
    timeframe: '5min',
    open: +(TRENDING_BASE + offset).toFixed(2),
    high: +(TRENDING_BASE + offset + 30).toFixed(2),
    low: +(TRENDING_BASE + offset - 10).toFixed(2),
    close: +(TRENDING_BASE + offset + 25).toFixed(2),
    volume: 1200 + (i % 10) * 50,
    timestamp: `2026-04-12T${String(i % 24).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}:00Z`,
  };
});

// Ranging candles — oscillation within a ±20-point range
const RANGING_BASE = 45000;
const rangingCandles = Array.from({ length: 50 }, (_, i) => {
  const offset = 40 * (i % 2);
  return {
    symbol: 'MNQ',
    timeframe: '5min',
    open: +(RANGING_BASE + offset).toFixed(2),
    high: +(RANGING_BASE + offset + 15).toFixed(2),
    low: +(RANGING_BASE + offset - 15).toFixed(2),
    close: +(RANGING_BASE + offset + 5).toFixed(2),
    volume: 800 + (i % 5) * 100,
    timestamp: `2026-04-12T${String(i % 24).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}:00Z`,
  };
});

// Volatile candles — large range, high volume (earnings-like event)
const VOLATILE_BASE = 45000;
const volatileCandles = Array.from({ length: 50 }, (_, i) => ({
  symbol: 'MNQ',
  timeframe: '5min',
  open: +(VOLATILE_BASE + 50).toFixed(2),
  high: +(VOLATILE_BASE + 150).toFixed(2),
  low: +(VOLATILE_BASE - 100).toFixed(2),
  close: +(VOLATILE_BASE - 50).toFixed(2),
  volume: 5000 + (i % 10) * 200,
  timestamp: `2026-04-12T${String(i % 24).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}:00Z`,
}));

// Consensus symbols
const SYMBOLS = ['MNQ', 'ES', 'NQ', 'RTY'];

// Payloads wired to fixtures
const sampleCandle = trendingCandles[0];                       // single trending candle
const sampleMambaInput = {
  symbol: 'MNQ',
  // 100 candles: first 50 trending + next 50 ranging  (mirrors get_mamba_candles())
  candles: [...trendingCandles, ...rangingCandles].slice(0, 100),
};

// ─── k6 Options ─────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    predict_scenario: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '60s', target: 50 },
        { duration: '30s', target: 0 },
      ],
      tags: { endpoint: '/predict' },
    },
    mamba_scenario: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 25 },
        { duration: '60s', target: 25 },
        { duration: '30s', target: 0 },
      ],
      tags: { endpoint: '/mamba/predict' },
    },
    consensus_scenario: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '60s', target: 75 },
        { duration: '120s', target: 75 },
        { duration: '30s', target: 0 },
      ],
      tags: { endpoint: '/consensus' },
    },
  },
  thresholds: {
    'http_req_duration{pct:95}': ['p(95)<200'],
    'http_req_duration{pct:99}': ['p(99)<500'],
    'http_req_failed': ['rate<0.01'],
    'error_rate': ['rate<0.01'],
  },
};

// ─── Test Function ───────────────────────────────────────────────────────────

export default function () {
  const BASE_URL = __ENV.BASE_URL || 'http://localhost:8788';

  // ── POST /predict ──────────────────────────────────────────────────────────
  const predictRes = http.post(
    `${BASE_URL}/predict`,
    JSON.stringify({ candles: [sampleCandle] }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(predictRes, { 'predict status 200': (r) => r.status === 200 });
  if (predictRes.status !== 200) errorRate.add(1);
  sleep(0.5);

  // ── POST /mamba/predict ─────────────────────────────────────────────────────
  const mambaRes = http.post(
    `${BASE_URL}/mamba/predict`,
    JSON.stringify(sampleMambaInput),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(mambaRes, { 'mamba status 200': (r) => r.status === 200 });
  if (mambaRes.status !== 200) errorRate.add(1);
  sleep(0.5);

  // ── GET /consensus ──────────────────────────────────────────────────────────
  const consensusRes = http.get(`${BASE_URL}/consensus?symbol=MNQ`);
  check(consensusRes, { 'consensus status 200': (r) => r.status === 200 });
  if (consensusRes.status !== 200) errorRate.add(1);
  sleep(1);
}
