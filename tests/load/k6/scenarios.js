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

// ─── Sample Payloads ─────────────────────────────────────────────────────────

const sampleCandle = {
  symbol: 'MNQ',
  timeframe: '5min',
  open: 45000.0,
  high: 45050.0,
  low: 44980.0,
  close: 45020.0,
  volume: 1200,
  timestamp: new Date().toISOString(),
};

const sampleMambaInput = {
  symbol: 'MNQ',
  candles: Array.from({ length: 100 }, (_, i) => ({
    timestamp: new Date(Date.now() - (100 - i) * 300000).toISOString(),
    open: parseFloat((45000 + Math.sin(i / 10) * 100).toFixed(2)),
    high: parseFloat((45050 + Math.sin(i / 10) * 100).toFixed(2)),
    low: parseFloat((44980 + Math.sin(i / 10) * 100).toFixed(2)),
    close: parseFloat((45020 + Math.sin(i / 10) * 100).toFixed(2)),
    volume: 1200 + Math.floor(Math.random() * 500),
  })),
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
