/**
 * BFF Prometheus metrics.
 *
 * Exposes:
 * - bff_http_requests_total
 * - bff_http_request_duration_seconds
 * - bff_ml_engine_requests_total
 * - bff_ml_engine_errors_total
 * - bff_ml_engine_latency_seconds
 * - bff_circuit_breaker_state
 */

let promClient = null;
try {
  promClient = await import("prom-client");
} catch {
  promClient = null;
}

const METRIC_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5];

const registry = promClient ? new promClient.Registry() : null;

if (registry) {
  registry.setDefaultLabels({ app: "tradersapp-bff" });
  promClient.collectDefaultMetrics({ register: registry });
}

let httpRequestsCounter = null;
let httpDurationHistogram = null;
let mlEngineRequestsCounter = null;
let mlEngineErrorsCounter = null;
let mlEngineLatencyHistogram = null;
let circuitBreakerGauge = null;

function initMetrics() {
  if (!registry || httpRequestsCounter) {
    return;
  }

  httpRequestsCounter = new promClient.Counter({
    name: "bff_http_requests_total",
    help: "Total HTTP requests handled by the BFF.",
    labelNames: ["method", "route", "status"],
    registers: [registry],
  });

  httpDurationHistogram = new promClient.Histogram({
    name: "bff_http_request_duration_seconds",
    help: "HTTP request duration in seconds for the BFF.",
    labelNames: ["method", "route"],
    buckets: METRIC_BUCKETS,
    registers: [registry],
  });

  mlEngineRequestsCounter = new promClient.Counter({
    name: "bff_ml_engine_requests_total",
    help: "Total outbound requests from the BFF to the ML Engine.",
    labelNames: ["endpoint", "status"],
    registers: [registry],
  });

  mlEngineErrorsCounter = new promClient.Counter({
    name: "bff_ml_engine_errors_total",
    help: "Total ML Engine request failures observed by the BFF.",
    labelNames: ["endpoint"],
    registers: [registry],
  });

  mlEngineLatencyHistogram = new promClient.Histogram({
    name: "bff_ml_engine_latency_seconds",
    help: "ML Engine response latency as observed by the BFF.",
    labelNames: ["endpoint"],
    buckets: METRIC_BUCKETS,
    registers: [registry],
  });

  circuitBreakerGauge = new promClient.Gauge({
    name: "bff_circuit_breaker_state",
    help: "BFF circuit breaker state: 0=closed, 1=half-open, 2=open.",
    registers: [registry],
  });
}

function normalizeStatus(statusCode) {
  const numeric = Number(statusCode);
  return Number.isFinite(numeric) ? String(numeric) : "0";
}

export function recordHttpRequest(method, route, statusCode, durationSeconds) {
  if (!registry) {
    return;
  }

  initMetrics();
  httpRequestsCounter.inc({
    method: String(method || "UNKNOWN"),
    route: String(route || "unknown"),
    status: normalizeStatus(statusCode),
  });
  httpDurationHistogram.observe(
    {
      method: String(method || "UNKNOWN"),
      route: String(route || "unknown"),
    },
    durationSeconds,
  );
}

export function recordMlEngineRequest(endpoint, statusCode, latencySeconds) {
  if (!registry) {
    return;
  }

  initMetrics();
  const status = normalizeStatus(statusCode);
  const endpointLabel = String(endpoint || "unknown");

  mlEngineRequestsCounter.inc({ endpoint: endpointLabel, status });
  mlEngineLatencyHistogram.observe({ endpoint: endpointLabel }, latencySeconds);

  const numeric = Number(status);
  if (!Number.isFinite(numeric) || numeric === 0 || numeric >= 500) {
    mlEngineErrorsCounter.inc({ endpoint: endpointLabel });
  }
}

export function setCircuitBreakerState(state) {
  if (!registry) {
    return;
  }

  initMetrics();
  circuitBreakerGauge.set(Number(state) || 0);
}

export async function getMetrics() {
  if (!registry) {
    return "# prom-client not installed\n";
  }

  initMetrics();
  return registry.metrics();
}

export function getContentType() {
  if (!registry) {
    return "text/plain; charset=utf-8";
  }

  return registry.contentType;
}
