/**
 * analysisMiddleware.mjs
 * gRPC service handlers, circuit breaker, and ML Engine HTTP client
 * for the analysis gRPC service.
 */
import grpc from "@grpc/grpc-js";
import { createHttpServer } from "node:http";
import {
  toPredictPayload,
  toGrpcConsensusResponse,
  getPrometheusMetrics,
  numberMap,
} from "./analysisFormatters.mjs";

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

export const CB_CONFIG = {
  failureThreshold: Number(process.env.CIRCUIT_BREAKER_FAILURES || 5),
  recoveryTimeoutMs: Number(process.env.CIRCUIT_BREAKER_TIMEOUT_MS || 30_000),
  halfOpenMaxCalls: Number(process.env.CIRCUIT_BREAKER_HALF_OPEN_CALLS || 3),
};

const _cb = {
  state: "CLOSED",
  failures: 0,
  lastFailure: 0,
  halfOpenCalls: 0,
  halfOpenSuccesses: 0,
};

export function circuitBreakerRecord(success) {
  if (success) {
    if (_cb.state === "HALF_OPEN") {
      _cb.halfOpenSuccesses++;
      if (_cb.halfOpenSuccesses >= CB_CONFIG.halfOpenMaxCalls) {
        _cb.state = "CLOSED"; _cb.failures = 0; _cb.halfOpenSuccesses = 0;
        console.log("[CircuitBreaker] HALF_OPEN → CLOSED (recovered)");
      }
    } else if (_cb.state === "CLOSED") {
      _cb.failures = 0;
    }
  } else {
    _cb.failures++; _cb.lastFailure = Date.now();
    if (_cb.state === "HALF_OPEN") {
      _cb.state = "OPEN"; _cb.halfOpenSuccesses = 0;
      console.log("[CircuitBreaker] HALF_OPEN → OPEN (still failing)");
    } else if (_cb.failures >= CB_CONFIG.failureThreshold) {
      _cb.state = "OPEN";
      console.log(`[CircuitBreaker] CLOSED → OPEN (${_cb.failures} failures)`);
    }
  }
}

export function circuitBreakerCheck() {
  if (_cb.state === "OPEN") {
    if (Date.now() - _cb.lastFailure > CB_CONFIG.recoveryTimeoutMs) {
      _cb.state = "HALF_OPEN"; _cb.halfOpenCalls = 0; _cb.halfOpenSuccesses = 0;
      console.log("[CircuitBreaker] OPEN → HALF_OPEN (recovery timeout elapsed)");
    } else {
      throw Object.assign(
        new Error("Circuit breaker OPEN — ML Engine unavailable"),
        { code: "CIRCUIT_OPEN" },
      );
    }
  }
}

export function getCbState() { return _cb; }

// ─── Prometheus metrics ─────────────────────────────────────────────────────

const _metrics = {
  requestsTotal: { total: 0, byEndpoint: {} },
  errorsTotal: { total: 0, byEndpoint: {} },
  latencyMs: { sum: 0, count: 0 },
};

export function recordRequest(endpoint, latencyMs, success) {
  _metrics.requestsTotal.total++;
  _metrics.latencyMs.sum += latencyMs;
  _metrics.latencyMs.count++;

  if (!_metrics.requestsTotal.byEndpoint[endpoint]) {
    _metrics.requestsTotal.byEndpoint[endpoint] = 0;
  }
  _metrics.requestsTotal.byEndpoint[endpoint]++;

  if (!success) {
    _metrics.errorsTotal.total++;
    if (!_metrics.errorsTotal.byEndpoint[endpoint]) {
      _metrics.errorsTotal.byEndpoint[endpoint] = 0;
    }
    _metrics.errorsTotal.byEndpoint[endpoint]++;
  }
}

export function getMetricsState() { return _metrics; }

// ─── ML Engine HTTP client ──────────────────────────────────────────────────

const ML_ENGINE_URL = String(
  process.env.ML_ENGINE_URL || process.env.ML_ENGINE_INTERNAL_URL || "http://ml-engine:8001",
).trim();

let mlHealthy = false;

export function isMlHealthy() { return mlHealthy; }
export function setMlHealthy(v) { mlHealthy = v; }

async function mlEngineRequest(path, body, timeout = 30_000) {
  const start = Date.now();
  circuitBreakerCheck();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const opts = {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    };
    if (body) opts.body = JSON.stringify(body);

    const response = await fetch(`${ML_ENGINE_URL}${path}`, opts);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`ML Engine ${response.status}: ${text || response.statusText}`);
    }

    const latency = Date.now() - start;
    circuitBreakerRecord(true);
    recordRequest(path, latency, true);
    return await response.json();
  } catch (err) {
    const latency = Date.now() - start;
    if (err.code !== "CIRCUIT_OPEN") circuitBreakerRecord(false);
    recordRequest(path, latency, false);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function mlEnginePredict(request) {
  return await mlEngineRequest("/predict", toPredictPayload(request), 30_000);
}

export async function mlEngineHealth() {
  return await mlEngineRequest("/health", null, 5_000);
}

export async function mlEngineRegime(candles) {
  return await mlEngineRequest("/regime", { candles, symbol: "MNQ" }, 30_000);
}

export async function mlEngineModelStatus(includeImportance) {
  return await mlEngineRequest(
    "/model-status",
    { include_feature_importance: includeImportance },
    10_000,
  );
}

export async function mlEngineTrain(mode) {
  return await mlEngineRequest("/train", { mode }, 5_000);
}

// ─── Periodic health check ───────────────────────────────────────────────────

export function startMlHealthCheck(intervalMs = 10_000) {
  return setInterval(async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${ML_ENGINE_URL}/health`, { signal: controller.signal });
      clearTimeout(timer);
      mlHealthy = res.ok;
    } catch {
      mlHealthy = false;
    }
  }, intervalMs);
}

// ─── gRPC handlers ────────────────────────────────────────────────────────────

export function health(call, callback) {
  callback(null, {
    ok: true, service: "analysis-service",
    version: process.env.SERVICE_VERSION || "1.0.0",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
}

export async function getConsensus(call, callback) {
  try {
    const result = await mlEnginePredict(call.request || {});
    callback(null, toGrpcConsensusResponse(result));
  } catch (error) {
    callback({ code: grpc.status.UNAVAILABLE, message: error?.message || "consensus unavailable" });
  }
}

export async function getRegime(call, callback) {
  try {
    const request = call.request || {};
    const result = await mlEngineRegime(request.candles || []);
    const regime = result?.regime || {};
    callback(null, {
      ok: true,
      regime: {
        regime: String(regime.regime || "NEUTRAL"),
        regime_id: Number(regime.regime_id || 1),
        regime_confidence: Number(regime.confidence || 0.5),
        hmm_state: Number(regime.hmm_state || 0),
        hmm_probability: Number(regime.hmm_probability || 0.5),
        q_parameter: Number(regime.q_parameter || 0),
        q_regime: String(regime.q_regime || "NORMAL"),
        diffusion_exponent: Number(regime.diffusion_exponent || 1.0),
        wave_speed: Number(regime.wave_speed || 0),
        wave_acceleration: Number(regime.wave_acceleration || 0),
        criticality_index: Number(regime.criticality_index || 0),
        deleverage_signal: Number(regime.deleverage_signal || 0),
        deleverage_reason: String(regime.deleverage_reason || ""),
        hurst_h: Number(regime.hurst_h || 0.5),
        diffusion_type: String(regime.diffusion_type || "normal"),
        multifractality: Number(regime.multifractality || 0),
        stop_multiplier: Number(regime.stop_multiplier || 1.0),
        signal_adjustment: String(regime.signal_adjustment || "BALANCED"),
        explanation: String(regime.explanation || ""),
      },
      latency_ms: Number(result?.latency_ms || 0),
      timestamp: new Date().toISOString(),
      trace_id: String(request.trace_id || ""),
    });
  } catch (error) {
    callback({ code: grpc.status.UNAVAILABLE, message: error?.message || "regime analysis unavailable" });
  }
}

export async function getModelStatus(call, callback) {
  try {
    const request = call.request || {};
    const result = await mlEngineModelStatus(request.include_feature_importance || false);
    callback(null, {
      ok: true,
      total_models: Number(result.total_models || 0),
      models: (result.models || []).map((m) => ({
        model_name: String(m.model_name || ""),
        version: String(m.version || "1"),
        last_trained: String(m.last_trained || ""),
        cv_roc_auc: Number(m.cv_roc_auc || 0),
        cv_accuracy: Number(m.cv_accuracy || 0),
        feature_count: Number(m.feature_count || 0),
        framework: String(m.framework || "unknown"),
        serving_path: String(m.serving_path || "unknown"),
        feature_importance: (m.feature_importance || []).map((f) => ({
          feature_name: String(f.feature_name || ""),
          importance: Number(f.importance || 0),
        })),
      })),
      mlflow_run_id: String(result.mlflow_run_id || ""),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    callback({ code: grpc.status.UNAVAILABLE, message: error?.message || "model status unavailable" });
  }
}

export async function triggerTraining(call, callback) {
  try {
    const request = call.request || {};
    const result = await mlEngineTrain(request.mode || "incremental");
    callback(null, {
      ok: true,
      job: {
        job_id: String(result.job_id || `job-${Date.now().toString(16)}`),
        status: String(result.status || "queued"),
        started_at: String(result.started_at || new Date().toISOString()),
        completed_at: String(result.completed_at || ""),
        progress_pct: Number(result.progress_pct || 0),
        error: String(result.error || ""),
        promoted_model: null,
      },
    });
  } catch (error) {
    callback({ code: grpc.status.UNAVAILABLE, message: error?.message || "training trigger unavailable" });
  }
}

// ─── Health HTTP server factory ──────────────────────────────────────────────

export function createHealthServer(healthPort, grpcPort, mlEngineUrl) {
  const GRPC_PORT = grpcPort;
  const HEALTH_PORT = healthPort;
  const ML_ENGINE_URL = mlEngineUrl;

  const server = createHttpServer(async (req, res) => {
    const url = req.url || "";

    if (url === "/metrics") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(
        getPrometheusMetrics(
          getMetricsState(),
          getCbState(),
        ),
      );
      return;
    }

    if (url === "/ready") {
      if (mlHealthy && _cb.state !== "OPEN") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ready: true, ml_engine: "up", cb_state: _cb.state }));
      } else {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ready: false, ml_engine: mlHealthy ? "up" : "down", cb_state: _cb.state }));
      }
      return;
    }

    if (url === "/live") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ live: true, uptime_s: process.uptime() }));
      return;
    }

    if (url === "/health" || url === "/") {
      try {
        const upstream = await mlEngineHealth();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          ok: true, service: "analysis-service",
          version: process.env.SERVICE_VERSION || "1.0.0",
          grpc_port: GRPC_PORT, ml_engine_url: ML_ENGINE_URL,
          ml_engine_healthy: true,
          circuit_breaker: { state: _cb.state, failures: _cb.failures },
          uptime_s: process.uptime().toFixed(0),
          timestamp: new Date().toISOString(),
        }));
      } catch (error) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          ok: false, service: "analysis-service",
          version: process.env.SERVICE_VERSION || "1.0.0",
          grpc_port: GRPC_PORT, ml_engine_url: ML_ENGINE_URL,
          ml_engine_healthy: false,
          circuit_breaker: { state: _cb.state, failures: _cb.failures },
          error: error?.message || "health check failed",
          timestamp: new Date().toISOString(),
        }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });

  server.listen(HEALTH_PORT, "0.0.0.0", () => {
    console.log(`[analysis-service] health HTTP listening on 0.0.0.0:${HEALTH_PORT}`);
    console.log(`[analysis-service]   /health  — full health check`);
    console.log(`[analysis-service]   /ready   — readiness probe`);
    console.log(`[analysis-service]   /live    — liveness probe`);
    console.log(`[analysis-service]   /metrics — Prometheus metrics`);
  });

  return server;
}
