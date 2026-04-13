/**
 * ConsensusEngine — BFF service that aggregates MathEngine.js snapshot
 * and calls the ML Engine (port 8001) for consensus predictions.
 *
 * ML Engine endpoints:
 *   GET  /health          — health check
 *   GET  /model-status   — model status + last trained
 *   GET  /sla            — SLA compliance report
 *   GET  /cache/stats    — Redis cache hit/miss stats
 *   POST /predict        — run consensus prediction (cached, 10s TTL)
 *   POST /regime          — regime analysis (cached, 60s TTL)
 *   POST /train          — trigger training (async)
 *   POST /train-sync     — trigger training (sync, use sparingly)
 *
 * The BFF acts as a BFF (Backend-for-Frontend): it transforms
 * MathEngine.js state into ML feature vectors, calls the Python ML Engine,
 * and returns a unified consensus signal to the React frontend.
 *
 * Resilience:
 * - Circuit breaker: opens after 5 failures in 30s, returns NEUTRAL fallback
 * - Request timeout: 30s max per call
 * - Graceful degradation: NEUTRAL signal when ML Engine unavailable
 */
import { recordMlEngineRequest, setCircuitBreakerState } from "../metrics.mjs";
import { predictConsensusTransport } from "./analysisTransport.mjs";
import { buildMlFeatureVector } from "./consensusAggregator.mjs";
import {
  ensureAgentHeartbeat,
  refreshAgentHeartbeat,
  reportAgentError,
} from "./boardRoomAgentReporter.mjs";

const CONSENSUS_AGENT = "ConsensusEngine";

ensureAgentHeartbeat({
  agent: CONSENSUS_AGENT,
  focus: "Aggregating ML consensus and regime calls.",
});

// ── Circuit Breaker ────────────────────────────────────────────────────────────

const CB_STATE = { CLOSED: "CLOSED", OPEN: "OPEN", HALF_OPEN: "HALF_OPEN" };

class CircuitBreaker {
  constructor(
    name,
    {
      failureThreshold = 5,
      recoveryTimeoutMs = 30_000,
      halfOpenMaxCalls = 3,
    } = {},
  ) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.recoveryTimeoutMs = recoveryTimeoutMs;
    this.halfOpenMaxCalls = halfOpenMaxCalls;
    this._state = CB_STATE.CLOSED;
    this._failureCount = 0;
    this._successCount = 0;
    this._lastFailureTime = null;
    this._halfOpenCalls = 0;
  }

  get state() {
    if (this._state === CB_STATE.OPEN && this._lastFailureTime) {
      if (Date.now() - this._lastFailureTime > this.recoveryTimeoutMs) {
        this._state = CB_STATE.HALF_OPEN;
        this._halfOpenCalls = 0;
        this._successCount = 0;
      }
    }
    return this._state;
  }

  recordSuccess() {
    if (this._state === CB_STATE.HALF_OPEN) {
      this._successCount++;
      if (this._successCount >= this.halfOpenMaxCalls) {
        this._state = CB_STATE.CLOSED;
        this._failureCount = 0;
        this._successCount = 0;
        console.log(
          `[CircuitBreaker:${this.name}] HALF_OPEN → CLOSED (recovered)`,
        );
      }
    } else if (this._state === CB_STATE.CLOSED) {
      this._failureCount = 0;
    }
  }

  recordFailure() {
    this._failureCount++;
    this._lastFailureTime = Date.now();
    if (this._state === CB_STATE.HALF_OPEN) {
      this._state = CB_STATE.OPEN;
      this._successCount = 0;
      console.log(
        `[CircuitBreaker:${this.name}] HALF_OPEN → OPEN (still failing)`,
      );
    } else if (this._failureCount >= this.failureThreshold) {
      this._state = CB_STATE.OPEN;
      console.log(
        `[CircuitBreaker:${this.name}] CLOSED → OPEN (${this._failureCount} failures)`,
      );
    }
  }

  isAvailable() {
    if (this.state === CB_STATE.OPEN) return false;
    if (this.state === CB_STATE.HALF_OPEN) {
      if (this._halfOpenCalls >= this.halfOpenMaxCalls) return false;
      this._halfOpenCalls++;
    }
    return true;
  }
}

// Global circuit breaker instance for ML Engine
const _mlCircuitBreaker = new CircuitBreaker("ml-engine", {
  failureThreshold: 5,
  recoveryTimeoutMs: 30_000,
});

const CIRCUIT_BREAKER_METRIC_STATE = {
  [CB_STATE.CLOSED]: 0,
  [CB_STATE.HALF_OPEN]: 1,
  [CB_STATE.OPEN]: 2,
};

function syncCircuitBreakerMetric() {
  setCircuitBreakerState(
    CIRCUIT_BREAKER_METRIC_STATE[_mlCircuitBreaker.state] ?? 0,
  );
}

syncCircuitBreakerMetric();

// ── ML Engine Client ──────────────────────────────────────────────────────────

const ML_ENGINE_BASE = String(
  process.env.ML_ENGINE_URL ||
    process.env.ML_ENGINE_INTERNAL_URL ||
    "http://ml-engine:8001",
).trim();
const ML_REQUEST_TIMEOUT_MS = 30_000;

async function mlRequest(
  path,
  body = null,
  timeout = ML_REQUEST_TIMEOUT_MS,
  options = {},
) {
  refreshAgentHeartbeat({
    agent: CONSENSUS_AGENT,
    status: "active",
    focus: `ML request ${path}`,
  });
  const isAvailable = _mlCircuitBreaker.isAvailable();
  syncCircuitBreakerMetric();
  if (!isAvailable) {
    const err = new Error(
      `Circuit breaker OPEN for ML Engine - state: ${_mlCircuitBreaker.state}`,
    );
    err.code = "CIRCUIT_OPEN";
    throw err;
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let statusCode = 0;

  try {
    // Predict path can use gRPC transport (with HTTP fallback)
    if (path === "/predict" && body) {
      const result = await predictConsensusTransport(body, timeout, options);
      statusCode = 200;
      _mlCircuitBreaker.recordSuccess();
      syncCircuitBreakerMetric();
      return result;
    }

    const opts = {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    };
    if (options.requestId) {
      opts.headers["X-Request-ID"] = String(options.requestId);
    }
    if (options.idempotencyKey) {
      opts.headers["Idempotency-Key"] = String(options.idempotencyKey);
    }
    if (body) {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(`${ML_ENGINE_BASE}${path}`, opts);
    statusCode = res.status;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ML Engine ${res.status}: ${text || res.statusText}`);
    }

    _mlCircuitBreaker.recordSuccess();
    syncCircuitBreakerMetric();
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      statusCode = 0;
      err = new Error(`ML Engine request timed out after ${timeout}ms`);
    }
    if (err.code !== "CIRCUIT_OPEN") {
      _mlCircuitBreaker.recordFailure();
    }
    syncCircuitBreakerMetric();
    throw err;
  } finally {
    clearTimeout(timer);
    recordMlEngineRequest(path, statusCode, (Date.now() - startedAt) / 1000);
  }
}

/**
 * Get full consensus signal from ML Engine.
 * Called by the frontend when user opens ML Consensus panel.
 */
export async function getMlConsensus({
  mathEngine = {},
  recentCandles = [],
  keyLevels = {},
  sessionId = 1,
  symbol = "MNQ",
  requestId = null,
  idempotencyKey = null,
} = {}) {
  const features = buildMlFeatureVector(mathEngine, recentCandles, keyLevels, sessionId);

  try {
    const mlResult = await mlRequest(
      "/predict",
      {
        features,
        candles: recentCandles.slice(-50),
        trades: [],
        session_id: sessionId,
        math_engine_snapshot: mathEngine,
        key_levels: keyLevels,
        symbol,
      },
      ML_REQUEST_TIMEOUT_MS,
      { requestId, idempotencyKey },
    );

    const sessionNames = ["Pre-Market", "Main Trading", "Post-Market"];

    return {
      ok: true,
      source: "ml_engine",
      timestamp: new Date().toISOString(),
      signal: mlResult.signal || "NEUTRAL",
      confidence: mlResult.confidence || 0.5,
      votes: mlResult.votes || {},
      session: {
        id: sessionId,
        name: sessionNames[sessionId] || "Main Trading",
        session_pct: features.session_pct,
        minutes_into_session: features.minutes_into_session,
      },
      alpha: mlResult.alpha || null,
      expected_move: mlResult.expected_move || null,
      rrr: mlResult.rrr || null,
      exit_plan: mlResult.exit_plan || null,
      position_sizing: mlResult.position_sizing || null,
      regime: mlResult.physics_regime || null,
      timing: mlResult.timing || null,
      models_used: mlResult.models_used || 0,
      data_trades_analyzed: mlResult.data_trades_analyzed || 0,
      model_freshness: mlResult.model_freshness || "unknown",
      feature_vector: features,
    };
  } catch (err) {
    const isCircuitOpen = err.code === "CIRCUIT_OPEN";
    console.error(
      isCircuitOpen
        ? "[consensusEngine] Circuit breaker OPEN — ML Engine failing"
        : `[consensusEngine] ML Engine unavailable: ${err.message}`,
    );
    void reportAgentError({
      agent: CONSENSUS_AGENT,
      error: err,
      severity: isCircuitOpen ? "HIGH" : "MEDIUM",
    });

    return {
      ok: false,
      source: isCircuitOpen ? "circuit_breaker_fallback" : "ml_engine_fallback",
      circuit_breaker: {
        state: _mlCircuitBreaker.state,
        failure_count: _mlCircuitBreaker._failureCount,
        recovery_timeout_s: Math.max(
          0,
          Math.ceil(
            (_mlCircuitBreaker._lastFailureTime +
              _mlCircuitBreaker.recoveryTimeoutMs -
              Date.now()) / 1000,
          ),
        ),
      },
      timestamp: new Date().toISOString(),
      signal: "NEUTRAL",
      confidence: 0.5,
      error: isCircuitOpen
        ? "ML Engine circuit breaker OPEN — using fallback"
        : err.message,
      votes: {},
      session: {
        id: sessionId,
        name: ["Pre-Market", "Main Trading", "Post-Market"][sessionId] || "Main Trading",
        session_pct: features.session_pct,
        minutes_into_session: features.minutes_into_session,
      },
      alpha: null,
      expected_move: null,
      rrr: null,
      exit_plan: null,
      position_sizing: null,
      regime: null,
      timing: {
        enter_now: false,
        reason: isCircuitOpen
          ? "ML Engine circuit breaker OPEN — NEUTRAL signal, enter with firm rules only"
          : "ML Engine offline — enter manually with firm rules only",
        P_profitable_entry_now: 0.5,
      },
      models_used: 0,
      data_trades_analyzed: 0,
      model_freshness: isCircuitOpen ? "circuit_breaker_open" : "offline",
      feature_vector: features,
    };
  }
}

/**
 * Get ML model status (last trained, accuracy, feature importance).
 */
export async function getMlModelStatus() {
  try {
    return await mlRequest("/model-status", null, 10_000);
  } catch (err) {
    console.error("[consensusEngine] Model status unavailable:", err.message);
    void reportAgentError({
      agent: CONSENSUS_AGENT,
      error: err,
      severity: "MEDIUM",
    });
    return { ok: false, error: err.message, trained: false };
  }
}

/**
 * Trigger ML model retraining.
 * Returns immediately (async) — use getMlModelStatus to check progress.
 */
export async function triggerMlTraining(mode = "incremental", options = {}) {
  try {
    return await mlRequest("/train", { mode }, 5_000, options);
  } catch (err) {
    console.error("[consensusEngine] Training trigger failed:", err.message);
    void reportAgentError({
      agent: CONSENSUS_AGENT,
      error: err,
      severity: "HIGH",
    });
    return { ok: false, error: err.message };
  }
}

/**
 * Check if ML Engine is healthy.
 */
export async function checkMlHealth() {
  try {
    const res = await mlRequest("/health", null, 5_000);
    return { ok: true, ...res };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Get circuit breaker status for ML Engine calls.
 */
export function getMlCircuitStatus() {
  return {
    name: _mlCircuitBreaker.name,
    state: _mlCircuitBreaker.state,
    failure_count: _mlCircuitBreaker._failureCount,
    last_failure_age_s: _mlCircuitBreaker._lastFailureTime
      ? Math.round((Date.now() - _mlCircuitBreaker._lastFailureTime) / 1000)
      : null,
    recovery_timeout_s: Math.ceil(_mlCircuitBreaker.recoveryTimeoutMs / 1000),
    is_available: _mlCircuitBreaker.isAvailable(),
  };
}

/**
 * Get SLA report from ML Engine.
 */
export async function getMlSlaReport(endpoint = null) {
  try {
    const url = endpoint ? `/sla?endpoint=${encodeURIComponent(endpoint)}` : "/sla";
    return await mlRequest(url, null, 5_000);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Get cache statistics from ML Engine.
 */
export async function getMlCacheStats() {
  try {
    return await mlRequest("/cache/stats", null, 5_000);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Send HIGH impact breaking news to ML Engine for classification + self-training.
 */
export async function triggerMLNewsTraining(newsItem, options = {}) {
  if (!newsItem || newsItem.impact !== "HIGH") return { triggered: false };
  try {
    const res = await mlRequest(
      "/news-trigger",
      { news: newsItem, trigger_type: "breaking_news_high_impact" },
      8000,
      options,
    );
    return { triggered: true, response: res };
  } catch (err) {
    console.error("[consensusEngine] news-trigger failed:", err.message);
    void reportAgentError({
      agent: CONSENSUS_AGENT,
      error: err,
      severity: "HIGH",
    });
    return { triggered: false, error: err.message };
  }
}

/**
 * Log market reaction to a breaking news item (called at 5/15/30/60 min intervals).
 */
export async function logNewsReaction(newsId, reactionData, options = {}) {
  try {
    const res = await mlRequest(
      "/news/reaction",
      {
        news_id: newsId,
        reaction_5m: reactionData.reaction5m,
        reaction_15m: reactionData.reaction15m,
        reaction_30m: reactionData.reaction30m,
        reaction_60m: reactionData.reaction60m,
        direction: reactionData.direction,
        magnitude: reactionData.magnitude,
      },
      5000,
      options,
    );
    return { ok: true, ...res };
  } catch (err) {
    console.error("[consensusEngine] news/reaction failed:", err.message);
    void reportAgentError({
      agent: CONSENSUS_AGENT,
      error: err,
      severity: "MEDIUM",
    });
    return { ok: false, error: err.message };
  }
}

/**
 * Fetch recent news reactions from ML Engine (ML training data).
 */
export async function getMLNewsReactions(limit = 50, options = {}) {
  try {
    const res = await mlRequest(`/news/reactions?limit=${limit}`, null, 5000, options);
    return res;
  } catch (err) {
    console.error("[consensusEngine] news/reactions failed:", err.message);
    void reportAgentError({
      agent: CONSENSUS_AGENT,
      error: err,
      severity: "MEDIUM",
    });
    return { ok: false, entries: [], error: err.message };
  }
}

/**
 * Get full physics-based regime analysis from ML Engine.
 * Combines HMM + FP-FK PDE + Fisher-KPP + Tsallis q-Gaussians + Anomalous Diffusion.
 */
export async function getPhysicsRegime(candles = [], options = {}) {
  try {
    const res = await mlRequest(
      "/regime",
      { candles: candles.slice(-100), symbol: "MNQ" },
      30_000,
      options,
    );
    return res;
  } catch (err) {
    console.error("[consensusEngine] Regime analysis unavailable:", err.message);
    void reportAgentError({
      agent: CONSENSUS_AGENT,
      error: err,
      severity: "MEDIUM",
    });
    return { ok: false, error: err.message };
  }
}

export function createConsensusEngineService() {
  return {
    getMlConsensus,
    getMlModelStatus,
    triggerMlTraining,
    checkMlHealth,
    getMlCircuitStatus,
    getMlSlaReport,
    getMlCacheStats,
    getPhysicsRegime,
    buildMlFeatureVector,
  };
}
