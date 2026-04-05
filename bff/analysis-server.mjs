import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import grpc from "@grpc/grpc-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

// ─── gRPC Service Definition ───────────────────────────────────────────────────
//
// Strategy: Use generated stubs when available (npm run generate-grpc),
// fall back to runtime proto loading for local development.
//
// Generated stubs path:  bff/generated/ddd/v1/analysis_pb2_grpc.js
// Proto source path:     proto/ddd/v1/analysis.proto
//
// To regenerate stubs:
//   cd bff && npm run generate-grpc
//
// Generated stubs export (CommonJS):
//   exports.AnalysisServiceClient  — for making outbound gRPC calls
//   exports.AnalysisServiceService — for server-side service definition
//     └── .service property gives the ServiceDefinition for addService()
// ───────────────────────────────────────────────────────────────────────────────

const PROTO_PATH = resolve(REPO_ROOT, "proto", "ddd", "v1", "analysis.proto");
const GENERATED_STUB_PATH = resolve(__dirname, "generated", "ddd", "v1", "analysis_pb2_grpc.js");

let analysisServiceDef = null;  // The grpc.ServiceDefinition

async function loadGrpcDefinition() {
  // Path 1: Use pre-generated stubs (faster, validated at build time)
  // Try the ESM wrapper first, fall back to CJS stub
  const stubPaths = [
    "./generated/ddd/v1/analysis_pb2_grpc.mjs",
    "./generated/ddd/v1/analysis_pb2_grpc.js",
  ];
  for (const stubPath of stubPaths) {
    if (existsSync(resolve(__dirname, stubPath.replace("./", "")))) {
      try {
        const mod = await import(stubPath);
        // Generated stubs export AnalysisServiceService with .service property
        analysisServiceDef = mod.AnalysisServiceService?.service;
        if (analysisServiceDef) {
          console.log("[analysis-server] Using pre-generated gRPC stubs");
          return;
        }
      } catch (err) {
        console.warn(`[analysis-server] Stub load failed (${stubPath}): ${err.message}`);
      }
    }
  }

  // Path 2: Runtime proto loading (fallback for development)
  const protoLoader = (await import("@grpc/proto-loader")).default;
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [REPO_ROOT],
  });
  const grpcDef = grpc.loadPackageDefinition(packageDefinition);
  analysisServiceDef = grpcDef?.traders?.ddd?.v1?.analysis?.AnalysisService?.service;
  if (!analysisServiceDef) {
    throw new Error(
      "Failed to load AnalysisService gRPC definition.\n" +
      "Run: npm run generate-grpc  (cd bff && npm run generate-grpc)"
    );
  }
  console.log("[analysis-server] Using runtime proto loading (stubs not generated)");
}

function loadEnvFiles() {
  const cwd = process.cwd();
  const searchDirs = [cwd, resolve(cwd, "..")];
  const files = [".env", ".env.local"];
  const shellDefined = new Set(Object.keys(process.env));
  const fileDefined = new Set();

  for (const dir of searchDirs) {
    for (const fileName of files) {
      const filePath = resolve(dir, fileName);
      if (!existsSync(filePath)) {
        continue;
      }

      const content = readFileSync(filePath, "utf8");
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          return;
        }

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex <= 0) {
          return;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        if (!shellDefined.has(key) || fileDefined.has(key)) {
          process.env[key] = value;
          fileDefined.add(key);
        }
      });
    }
  }
}

loadEnvFiles();

const GRPC_PORT = Number(process.env.ANALYSIS_SERVICE_GRPC_PORT || 50051);
const HEALTH_PORT = Number(process.env.ANALYSIS_SERVICE_HEALTH_PORT || 8082);
const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://127.0.0.1:8001";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [REPO_ROOT],
});

const grpcDefinition = grpc.loadPackageDefinition(packageDefinition);
const analysisPackage = grpcDefinition?.traders?.ddd?.v1?.analysis;

if (!analysisPackage?.AnalysisService?.service) {
  throw new Error("Failed to load AnalysisService gRPC definition.");
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

const CB_CONFIG = {
  failureThreshold: Number(process.env.CIRCUIT_BREAKER_FAILURES || 5),
  recoveryTimeoutMs: Number(process.env.CIRCUIT_BREAKER_TIMEOUT_MS || 30_000),
  halfOpenMaxCalls: Number(process.env.CIRCUIT_BREAKER_HALF_OPEN_CALLS || 3),
};

const cb = {
  state: "CLOSED",  // CLOSED | HALF_OPEN | OPEN
  failures: 0,
  lastFailure: 0,
  halfOpenCalls: 0,
  halfOpenSuccesses: 0,
};

function circuitBreakerRecord(success) {
  if (success) {
    if (cb.state === "HALF_OPEN") {
      cb.halfOpenSuccesses++;
      if (cb.halfOpenSuccesses >= CB_CONFIG.halfOpenMaxCalls) {
        cb.state = "CLOSED";
        cb.failures = 0;
        cb.halfOpenSuccesses = 0;
        console.log("[CircuitBreaker] HALF_OPEN → CLOSED (recovered)");
      }
    } else if (cb.state === "CLOSED") {
      cb.failures = 0;
    }
  } else {
    cb.failures++;
    cb.lastFailure = Date.now();
    if (cb.state === "HALF_OPEN") {
      cb.state = "OPEN";
      cb.halfOpenSuccesses = 0;
      console.log("[CircuitBreaker] HALF_OPEN → OPEN (still failing)");
    } else if (cb.failures >= CB_CONFIG.failureThreshold) {
      cb.state = "OPEN";
      console.log(`[CircuitBreaker] CLOSED → OPEN (${cb.failures} failures)`);
    }
  }
}

function circuitBreakerCheck() {
  if (cb.state === "OPEN") {
    if (Date.now() - cb.lastFailure > CB_CONFIG.recoveryTimeoutMs) {
      cb.state = "HALF_OPEN";
      cb.halfOpenCalls = 0;
      cb.halfOpenSuccesses = 0;
      console.log("[CircuitBreaker] OPEN → HALF_OPEN (recovery timeout elapsed)");
    } else {
      throw Object.assign(new Error("Circuit breaker OPEN — ML Engine unavailable"), { code: "CIRCUIT_OPEN" });
    }
  }
}

// ─── Prometheus Metrics ───────────────────────────────────────────────────────

const metrics = {
  requestsTotal: { total: 0, byEndpoint: {} },
  errorsTotal: { total: 0, byEndpoint: {} },
  latencyMs: { sum: 0, count: 0 },
  cbState: 0,  // 0=CLOSED, 1=HALF_OPEN, 2=OPEN
};

function recordRequest(endpoint, latencyMs, success) {
  metrics.requestsTotal.total++;
  metrics.latencyMs.sum += latencyMs;
  metrics.latencyMs.count++;

  if (!metrics.requestsTotal.byEndpoint[endpoint]) {
    metrics.requestsTotal.byEndpoint[endpoint] = 0;
  }
  metrics.requestsTotal.byEndpoint[endpoint]++;

  if (!success) {
    metrics.errorsTotal.total++;
    if (!metrics.errorsTotal.byEndpoint[endpoint]) {
      metrics.errorsTotal.byEndpoint[endpoint] = 0;
    }
    metrics.errorsTotal.byEndpoint[endpoint]++;
  }

  // Update circuit breaker state metric
  metrics.cbState = cb.state === "CLOSED" ? 0 : cb.state === "HALF_OPEN" ? 1 : 2;
}

function getPrometheusMetrics() {
  const lines = [
    "# HELP analysis_service_requests_total Total gRPC requests by endpoint",
    "# TYPE analysis_service_requests_total counter",
  ];
  for (const [endpoint, count] of Object.entries(metrics.requestsTotal.byEndpoint)) {
    lines.push(`analysis_service_requests_total{endpoint="${endpoint}"} ${count}`);
  }
  lines.push(`analysis_service_requests_total{endpoint="unknown"} ${metrics.requestsTotal.total - Object.values(metrics.requestsTotal.byEndpoint).reduce((a, b) => a + b, 0)}`);

  lines.push("");
  lines.push("# HELP analysis_service_errors_total Total errors by endpoint");
  lines.push("# TYPE analysis_service_errors_total counter");
  for (const [endpoint, count] of Object.entries(metrics.errorsTotal.byEndpoint)) {
    lines.push(`analysis_service_errors_total{endpoint="${endpoint}"} ${count}`);
  }

  lines.push("");
  lines.push("# HELP analysis_service_latency_ms Request latency in milliseconds");
  lines.push("# TYPE analysis_service_latency_ms histogram");
  lines.push(`analysis_service_latency_ms_sum ${metrics.latencyMs.sum}`);
  lines.push(`analysis_service_latency_ms_count ${metrics.latencyMs.count}`);
  lines.push(`analysis_service_latency_ms_avg ${metrics.latencyMs.count > 0 ? (metrics.latencyMs.sum / metrics.latencyMs.count).toFixed(2) : 0}`);

  lines.push("");
  lines.push("# HELP analysis_service_circuit_breaker_state Circuit breaker state (0=closed, 1=half-open, 2=open)");
  lines.push("# TYPE analysis_service_circuit_breaker_state gauge");
  lines.push(`analysis_service_circuit_breaker_state ${metrics.cbState}`);
  lines.push(`analysis_service_circuit_breaker_failures ${cb.failures}`);

  lines.push("");
  lines.push("# HELP analysis_service_ml_engine_up Whether ML Engine is reachable");
  lines.push("# TYPE analysis_service_ml_engine_up gauge");
  lines.push(`analysis_service_ml_engine_up ${mlHealthy ? 1 : 0}`);

  return lines.join("\n");
}

// ─── Normalization Helpers ───────────────────────────────────────────────────

function numberMap(values) {
  const mapped = {};
  for (const [key, value] of Object.entries(values || {})) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      mapped[key] = num;
    }
  }
  return mapped;
}

function stringMap(values) {
  const mapped = {};
  for (const [key, value] of Object.entries(values || {})) {
    if (value === null || value === undefined) {
      continue;
    }
    mapped[key] = String(value);
  }
  return mapped;
}

function toPredictPayload(request) {
  return {
    symbol: String(request?.symbol || "MNQ"),
    session_id: Number(request?.session_id || 1),
    candles: Array.isArray(request?.candles) ? request.candles : [],
    trades: Array.isArray(request?.trades) ? request.trades : [],
    math_engine_snapshot: numberMap(request?.features || {}),
    key_levels: {},
  };
}

function toGrpcConsensusResponse(payload) {
  const voteConfidences = {};
  for (const [modelName, vote] of Object.entries(payload?.votes || {})) {
    const confidence = Number(vote?.confidence);
    if (Number.isFinite(confidence)) {
      voteConfidences[modelName] = confidence;
    }
  }

  const regimeValue =
    typeof payload?.physics_regime === "string"
      ? payload.physics_regime
      : payload?.physics_regime?.regime || "";

  return {
    signal: String(payload?.signal || "NEUTRAL"),
    confidence: Number(payload?.confidence || 0.5),
    models_used: Number(payload?.models_used || Object.keys(payload?.votes || {}).length || 0),
    data_trades_analyzed: Number(payload?.data_trades_analyzed || 0),
    model_freshness: String(payload?.model_freshness || "unknown"),
    timing: stringMap(payload?.timing || {}),
    vote_confidences: voteConfidences,
    regime: String(regimeValue),
  };
}

// ─── ML Engine HTTP Client ────────────────────────────────────────────────────

let mlHealthy = false;

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
    if (body) {
      opts.body = JSON.stringify(body);
    }

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
    if (err.code !== "CIRCUIT_OPEN") {
      circuitBreakerRecord(false);
    }
    recordRequest(path, latency, false);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function mlEnginePredict(request) {
  return await mlEngineRequest("/predict", toPredictPayload(request), 30_000);
}

async function mlEngineHealth() {
  return await mlEngineRequest("/health", null, 5_000);
}

async function mlEngineRegime(candles) {
  return await mlEngineRequest("/regime", { candles, symbol: "MNQ" }, 30_000);
}

async function mlEngineModelStatus(includeImportance) {
  return await mlEngineRequest("/model-status", { include_feature_importance: includeImportance }, 10_000);
}

async function mlEngineTrain(mode) {
  return await mlEngineRequest("/train", { mode }, 5_000);
}

async function getConsensus(call, callback) {
  try {
    const request = call.request || {};
    const result = await mlEnginePredict(request);
    callback(null, toGrpcConsensusResponse(result));
  } catch (error) {
    callback({
      code: grpc.status.UNAVAILABLE,
      message: error?.message || "consensus unavailable",
    });
  }
}

// Periodic ML Engine health check
setInterval(async () => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${ML_ENGINE_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    mlHealthy = res.ok;
  } catch {
    mlHealthy = false;
  }
}, 10_000);

function health(call, callback) {
  callback(null, {
    ok: true,
    service: "analysis-service",
    version: process.env.SERVICE_VERSION || "1.0.0",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
}

async function getRegime(call, callback) {
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
    callback({
      code: grpc.status.UNAVAILABLE,
      message: error?.message || "regime analysis unavailable",
    });
  }
}

async function getModelStatus(call, callback) {
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
    callback({
      code: grpc.status.UNAVAILABLE,
      message: error?.message || "model status unavailable",
    });
  }
}

async function triggerTraining(call, callback) {
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
    callback({
      code: grpc.status.UNAVAILABLE,
      message: error?.message || "training trigger unavailable",
    });
  }
}

function startGrpcServer() {
  const server = new grpc.Server();
  server.addService(analysisServiceDef, {
    Health: health,
    GetConsensus: getConsensus,
    GetRegime: getRegime,
    GetModelStatus: getModelStatus,
    TriggerTraining: triggerTraining,
  });

  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error) => {
      if (error) {
        throw error;
      }
      server.start();
      console.log(`[analysis-service] gRPC listening on 0.0.0.0:${GRPC_PORT}`);
    },
  );

  return server;
}

function startHealthServer() {
  const server = createHttpServer(async (req, res) => {
    const url = req.url || "";

    if (url === "/metrics") {
      // Prometheus metrics
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(getPrometheusMetrics());
      return;
    }

    if (url === "/ready") {
      // Readiness: ML Engine must be healthy
      if (mlHealthy && cb.state !== "OPEN") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ready: true, ml_engine: "up", cb_state: cb.state }));
      } else {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          ready: false,
          ml_engine: mlHealthy ? "up" : "down",
          cb_state: cb.state,
        }));
      }
      return;
    }

    if (url === "/live") {
      // Liveness: process is alive
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ live: true, uptime_s: process.uptime() }));
      return;
    }

    if (url === "/health" || url === "/") {
      try {
        const upstream = await mlEngineHealth();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            service: "analysis-service",
            version: process.env.SERVICE_VERSION || "1.0.0",
            grpc_port: GRPC_PORT,
            ml_engine_url: ML_ENGINE_URL,
            ml_engine_healthy: true,
            circuit_breaker: {
              state: cb.state,
              failures: cb.failures,
              last_failure_age_ms: cb.lastFailure > 0 ? Date.now() - cb.lastFailure : null,
            },
            uptime_s: process.uptime().toFixed(0),
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (error) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: false,
            service: "analysis-service",
            version: process.env.SERVICE_VERSION || "1.0.0",
            grpc_port: GRPC_PORT,
            ml_engine_url: ML_ENGINE_URL,
            ml_engine_healthy: false,
            circuit_breaker: {
              state: cb.state,
              failures: cb.failures,
            },
            error: error?.message || "health check failed",
            timestamp: new Date().toISOString(),
          }),
        );
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

// ─── Startup ──────────────────────────────────────────────────────────────────

loadGrpcDefinition().then(() => {
  startGrpcServer();
  startHealthServer();
}).catch((err) => {
  console.error("[analysis-server] Failed to initialize gRPC:", err.message);
  process.exit(1);
});

function shutdown(signal) {
  console.log(`[analysis-service] shutting down on ${signal}`);
  healthServer.close(() => {});
  grpcServer.tryShutdown(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

