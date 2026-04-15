import test from "node:test";
import assert from "node:assert/strict";

import {
  recordHttpRequest,
  recordMlEngineRequest,
  setCircuitBreakerState,
  getMetrics,
} from "../metrics.mjs";

test("exports Prometheus metrics for BFF and ML engine paths", async () => {
  recordHttpRequest("GET", "/health", 200, 0.012);
  recordMlEngineRequest("/predict", 200, 0.047);
  setCircuitBreakerState(1);

  const metrics = await getMetrics();

  assert.match(metrics, /bff_http_requests_total/);
  assert.match(metrics, /bff_http_request_duration_seconds/);
  assert.match(metrics, /bff_ml_engine_requests_total/);
  assert.match(metrics, /bff_ml_engine_latency_seconds/);
  assert.match(metrics, /bff_circuit_breaker_state/);
});
