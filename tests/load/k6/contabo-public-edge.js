/**
 * Contabo public-edge k6 suite.
 *
 * This suite intentionally targets the active public host layout:
 *   - 173.249.18.14.sslip.io         -> Caddy edge
 *   - bff.173.249.18.14.sslip.io     -> BFF direct host
 *   - api.173.249.18.14.sslip.io     -> ML Engine direct host
 *
 * It avoids stale /api/consensus assumptions and instead exercises
 * low-blast-radius public routes plus direct ML inference.
 *
 * Usage:
 *   k6 run tests/load/k6/contabo-public-edge.js
 *   TRADERSAPP_BASE_URL=https://173.249.18.14.sslip.io \
 *   BFF_BASE_URL=https://bff.173.249.18.14.sslip.io \
 *   ML_BASE_URL=https://api.173.249.18.14.sslip.io \
 *   k6 run tests/load/k6/contabo-public-edge.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const TRADERSAPP_BASE_URL = (__ENV.TRADERSAPP_BASE_URL || 'https://173.249.18.14.sslip.io').replace(/\/$/, '');
const BFF_BASE_URL = (__ENV.BFF_BASE_URL || 'https://bff.173.249.18.14.sslip.io').replace(/\/$/, '');
const ML_BASE_URL = (__ENV.ML_BASE_URL || 'https://api.173.249.18.14.sslip.io').replace(/\/$/, '');

const EDGE_TARGET_VUS = Number(__ENV.EDGE_TARGET_VUS || 10);
const BFF_TARGET_VUS = Number(__ENV.BFF_TARGET_VUS || 5);
const ML_TARGET_VUS = Number(__ENV.ML_TARGET_VUS || 8);

const RAMP_DURATION = __ENV.RAMP_DURATION || '30s';
const HOLD_DURATION = __ENV.HOLD_DURATION || '60s';
const COOL_DOWN_DURATION = __ENV.COOL_DOWN_DURATION || '20s';

const EDGE_P95_MS = Number(__ENV.EDGE_P95_MS || 250);
const BFF_HEALTH_P95_MS = Number(__ENV.BFF_HEALTH_P95_MS || 300);
const BFF_ML_HEALTH_P95_MS = Number(__ENV.BFF_ML_HEALTH_P95_MS || 1500);
const ML_PREDICT_P95_MS = Number(__ENV.ML_PREDICT_P95_MS || 1500);

const edgeHealthLatencyMs = new Trend('edge_health_latency_ms');
const bffHealthLatencyMs = new Trend('bff_health_latency_ms');
const bffMlHealthLatencyMs = new Trend('bff_ml_health_latency_ms');
const mlPredictLatencyMs = new Trend('ml_predict_latency_ms');

const edgeHealthFailRate = new Rate('edge_health_fail_rate');
const bffHealthFailRate = new Rate('bff_health_fail_rate');
const bffMlHealthFailRate = new Rate('bff_ml_health_fail_rate');
const bffMlHealthExpectedDegradedRate = new Rate('bff_ml_health_expected_degraded_rate');
const bffMlHealthExpectedRateLimitedRate = new Rate('bff_ml_health_expected_rate_limited_rate');
const mlPredictFailRate = new Rate('ml_predict_fail_rate');

function buildSampleCandles(count = 20) {
  const candles = [];
  const basePrice = 18500.0;
  const baseTime = Date.parse('2026-04-21T09:30:00Z');

  for (let index = 0; index < count; index += 1) {
    const openPrice = basePrice + index * 2.0;
    const closePrice = openPrice + 1.0;
    candles.push({
      symbol: 'MNQ',
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

const predictPayload = {
  symbol: 'MNQ',
  candles: buildSampleCandles(),
  trades: [],
  session_id: 1,
  math_engine_snapshot: {
    amdPhase: 'ACCUMULATION',
    vrRegime: 'NORMAL',
  },
};
const predictPayloadJson = JSON.stringify(predictPayload);
const ML_PREDICT_IDEMPOTENCY_KEY = __ENV.ML_PREDICT_IDEMPOTENCY_KEY || 'k6-contabo-public-edge-baseline';
const EXPECTED_ML_WARMUP_PATTERNS = [
  /no candles available/i,
  /upload data first/i,
  /historical data first/i,
  /no candle data/i,
];
const EXPECTED_RATE_LIMIT_PATTERNS = [
  /rate limit exceeded/i,
  /too many requests/i,
];

function parseJson(res) {
  try {
    return res.json();
  } catch (_) {
    return null;
  }
}

function isExpectedMlWarmupState(data) {
  if (data === null || typeof data !== 'object') {
    return false;
  }

  const candidates = [
    data.detail,
    data.error,
    data.reason,
    data.message,
    data.upstream_error,
  ]
    .filter((value) => typeof value === 'string')
    .join(' | ');

  return EXPECTED_ML_WARMUP_PATTERNS.some((pattern) => pattern.test(candidates));
}

function isExpectedRateLimitState(data) {
  if (data === null || typeof data !== 'object') {
    return false;
  }

  const candidates = [
    data.detail,
    data.error,
    data.reason,
    data.message,
  ]
    .filter((value) => typeof value === 'string')
    .join(' | ');

  return EXPECTED_RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(candidates));
}

export const options = {
  scenarios: {
    edge_health: {
      exec: 'edgeHealth',
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_DURATION, target: EDGE_TARGET_VUS },
        { duration: HOLD_DURATION, target: EDGE_TARGET_VUS },
        { duration: COOL_DOWN_DURATION, target: 0 },
      ],
      tags: { endpoint: 'edge-health' },
    },
    bff_health: {
      exec: 'bffHealth',
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_DURATION, target: BFF_TARGET_VUS },
        { duration: HOLD_DURATION, target: BFF_TARGET_VUS },
        { duration: COOL_DOWN_DURATION, target: 0 },
      ],
      tags: { endpoint: 'bff-health' },
    },
    bff_ml_health: {
      exec: 'bffMlHealth',
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_DURATION, target: BFF_TARGET_VUS },
        { duration: HOLD_DURATION, target: BFF_TARGET_VUS },
        { duration: COOL_DOWN_DURATION, target: 0 },
      ],
      tags: { endpoint: 'bff-ml-health' },
    },
    ml_predict: {
      exec: 'mlPredict',
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_DURATION, target: ML_TARGET_VUS },
        { duration: HOLD_DURATION, target: ML_TARGET_VUS },
        { duration: COOL_DOWN_DURATION, target: 0 },
      ],
      tags: { endpoint: 'ml-predict' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.25'],
    edge_health_fail_rate: ['rate<0.01'],
    bff_health_fail_rate: ['rate<0.01'],
    bff_ml_health_fail_rate: ['rate<0.25'],
    ml_predict_fail_rate: ['rate<0.05'],
    edge_health_latency_ms: [`p(95)<${EDGE_P95_MS}`],
    bff_health_latency_ms: [`p(95)<${BFF_HEALTH_P95_MS}`],
    bff_ml_health_latency_ms: [`p(95)<${BFF_ML_HEALTH_P95_MS}`],
    ml_predict_latency_ms: [`p(95)<${ML_PREDICT_P95_MS}`],
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export function edgeHealth() {
  const res = http.get(`${TRADERSAPP_BASE_URL}/edge-health`, {
    tags: { endpoint: 'edge-health' },
    timeout: '15s',
  });
  const ok = check(res, {
    'edge health status 200': (r) => r.status === 200,
    'edge health body ok': (r) => String(r.body || '').trim() === 'ok',
  });
  edgeHealthLatencyMs.add(res.timings.duration);
  edgeHealthFailRate.add(ok ? 0 : 1);
  sleep(1);
}

export function bffHealth() {
  const res = http.get(`${BFF_BASE_URL}/health`, {
    headers: { Accept: 'application/json' },
    tags: { endpoint: 'bff-health' },
    timeout: '15s',
  });
  const data = parseJson(res);
  const ok = check(res, {
    'bff health status 200': (r) => r.status === 200,
    'bff health payload ok': () => data !== null && data.ok === true,
  });
  bffHealthLatencyMs.add(res.timings.duration);
  bffHealthFailRate.add(ok ? 0 : 1);
  sleep(1);
}

export function bffMlHealth() {
  const res = http.get(`${BFF_BASE_URL}/ml/health`, {
    headers: { Accept: 'application/json' },
    tags: { endpoint: 'bff-ml-health' },
    timeout: '20s',
    responseCallback: http.expectedStatuses({ min: 200, max: 399 }, 429, 503),
  });
  const data = parseJson(res);
  const degradedWarmup = res.status === 503 && isExpectedMlWarmupState(data);
  const expectedRateLimited = res.status === 429 && isExpectedRateLimitState(data);
  const ok = check(res, {
    'bff ml health status healthy-warmup-or-rate-limited': (r) =>
      r.status === 200 || degradedWarmup || expectedRateLimited,
    'bff ml health payload ok-warmup-or-rate-limited': () =>
      (data !== null && data.ok === true) || degradedWarmup || expectedRateLimited,
  });
  bffMlHealthLatencyMs.add(res.timings.duration);
  bffMlHealthFailRate.add(ok ? 0 : 1);
  bffMlHealthExpectedDegradedRate.add(degradedWarmup ? 1 : 0);
  bffMlHealthExpectedRateLimitedRate.add(expectedRateLimited ? 1 : 0);
  sleep(1);
}

export function mlPredict() {
  const res = http.post(
    `${ML_BASE_URL}/predict`,
    predictPayloadJson,
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': ML_PREDICT_IDEMPOTENCY_KEY,
      },
      tags: { endpoint: 'ml-predict' },
      timeout: '30s',
    },
  );
  const data = parseJson(res);
  const ok = check(res, {
    'ml predict status 200': (r) => r.status === 200,
    'ml predict payload object': () => data !== null && typeof data === 'object',
  });
  mlPredictLatencyMs.add(res.timings.duration);
  mlPredictFailRate.add(ok ? 0 : 1);
  sleep(0.5);
}
