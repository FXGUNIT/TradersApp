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
    // Predict path can use gRPC transport (with HTTP fallback) for low-latency inter-service calls.
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
 * Transform a MathEngine.js state snapshot into ML Engine feature format.
 * Maps MathEngine computed values → canonical ML feature columns.
 *
 * @param {object} me - MathEngine state (current bar + indicators)
 * @param {object[]} recentCandles - last N 5-min candles (OHLCV array)
 * @param {object} keyLevels - { pdh, pdl, pwh, pwl } price levels
 * @param {number} sessionId - 0=pre, 1=main, 2=post
 * @returns {object} feature vector for ML Engine
 */
export function buildMlFeatureVector(
  me,
  recentCandles = [],
  keyLevels = {},
  sessionId = 1,
) {
  const candles = recentCandles.slice(-20); // last 20 candles max
  const last = candles[candles.length - 1] || {};

  // Session definitions (Eastern Time)
  const sessionNames = ["pre_market", "main_trading", "post_market"];
  const sessionConfig = {
    0: { start_et: "04:00", end_et: "09:15" },
    1: { start_et: "09:30", end_et: "16:00" },
    2: { start_et: "16:01", end_et: "20:00" },
  };

  const now = me?.timestamp ? new Date(me.timestamp) : new Date();
  const etHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).format(now),
    10,
  );
  const etMinute = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      minute: "numeric",
      hour12: false,
    }).format(now),
    10,
  );
  const minutesIntoSession = (() => {
    const cfg = sessionConfig[sessionId] || sessionConfig[1];
    const [sh, sm] = cfg.start_et.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const currMin = etHour * 60 + etMinute;
    return Math.max(0, currMin - startMin);
  })();

  const cfg = sessionConfig[sessionId] || sessionConfig[1];
  const [eh, em] = cfg.end_et.split(":").map(Number);
  const sessionEndMin = eh * 60 + em;
  const [sh2, sm2] = cfg.start_et.split(":").map(Number);
  const sessionStartMin = sh2 * 60 + sm2;
  const sessionPct =
    sessionEndMin > sessionStartMin
      ? minutesIntoSession / (sessionEndMin - sessionStartMin)
      : 0;

  // Rolling volatility from recent candles
  const logReturns = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]?.close;
    const curr = candles[i]?.close;
    if (prev && curr && prev > 0) {
      logReturns.push(Math.log(curr / prev));
    }
  }
  const rollingStd10 =
    logReturns.slice(-10).length >= 2 ? std(logReturns.slice(-10)) : 0;
  const rollingStd20 =
    logReturns.slice(-20).length >= 2
      ? std(logReturns.slice(-20))
      : rollingStd10;

  // Volume ratio (5-bar)
  const avgVol5 =
    candles.slice(-5).reduce((s, c) => s + (c.volume || 0), 0) /
    Math.max(1, candles.slice(-5).length);
  const volRatio5 = last.volume && avgVol5 > 0 ? last.volume / avgVol5 : 1;

  // True range + ATR (14-bar)
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    if (c && p) {
      const tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - p.close),
        Math.abs(c.low - p.close),
      );
      trs.push(tr);
    }
  }
  const atr =
    trs.length >= 14
      ? trs.slice(-14).reduce((a, b) => a + b, 0) / 14
      : last.high - last.low || 1;

  const vr = me?.vr ?? 1.0;
  const vrRegime = vr < 0.85 ? 0 : vr < 1.15 ? 1 : 2;

  // AMD phase one-hot
  const amdPhase = me?.amdPhase || "UNCLEAR";
  const amdPhases = [
    "ACCUMULATION",
    "MANIPULATION",
    "DISTRIBUTION",
    "TRANSITION",
    "UNCLEAR",
  ];

  // Key level proximity
  const close = last.close || me?.close || 0;
  const priceToPdh =
    keyLevels.pdh && atr > 0 ? (close - keyLevels.pdh) / atr : 0;
  const priceToPdl =
    keyLevels.pdl && atr > 0 ? (keyLevels.pdl - close) / atr : 0;

  // VWAP slope encoding
  const vwapSlopeEntry = me?.vwapSlope ?? 0;

  // Build canonical feature vector matching FEATURE_COLS order
  return {
    // OHLCV
    open: last.open || close,
    high: last.high || close,
    low: last.low || close,
    close,
    volume: last.volume || 0,

    // Candle math
    tr: trs[trs.length - 1] || 0,
    atr,
    log_return: logReturns[logReturns.length - 1] || 0,
    intrabar_momentum: (last.close || 0) - (last.open || 0),
    range: (last.high || 0) - (last.low || 0),
    range_pct: last.low ? ((last.high || 0) - (last.low || 0)) / last.low : 0,
    upper_wick_pct: 0,
    lower_wick_pct: 0,
    atr_pct: close && atr ? atr / close : 0,
    volume_ratio_5: volRatio5,

    // Volatility
    rolling_std_10: rollingStd10,
    rolling_std_20: rollingStd20,
    realized_vol: rollingStd20 * Math.sqrt(78), // daily bars * sqrt(78) ≈ annual

    // Momentum
    momentum_3bar:
      logReturns.length >= 3
        ? logReturns.slice(-3).reduce((a, b) => a + b, 0)
        : 0,
    momentum_5bar:
      logReturns.length >= 5
        ? logReturns.slice(-5).reduce((a, b) => a + b, 0)
        : 0,

    // Time
    hour_of_day: etHour,
    day_of_week: now.getDay(),
    session_pct: Math.min(1, Math.max(0, sessionPct)),
    minutes_into_session: minutesIntoSession,
    session_id: sessionId,

    // Session time flags
    is_first_30min: minutesIntoSession <= 30 ? 1 : 0,
    is_last_30min: sessionEndMin - (etHour * 60 + etMinute) <= 30 ? 1 : 0,
    is_lunch_hour: etHour === 12 || (etHour === 11 && etMinute >= 30) ? 1 : 0,

    // Levels
    price_to_pdh: priceToPdh,
    price_to_pdl: priceToPdl,
    near_level:
      Math.abs(priceToPdh) < 0.5 || Math.abs(priceToPdl) < 0.5 ? 1 : 0,

    // Indicators
    adx: me?.adx ?? 25,
    ci: me?.ci ?? 50,
    vwap: me?.vwap ?? close,
    vwap_slope_entry: vwapSlopeEntry,

    // Volatility regime
    vr,
    sweep_prob: me?.sweepProb ?? 0.5,
    volatility_regime: me?.volatilityRegime ?? 1,

    // AMD one-hot
    amd_ACCUMULATION: amdPhase === "ACCUMULATION" ? 1 : 0,
    amd_MANIPULATION: amdPhase === "MANIPULATION" ? 1 : 0,
    amd_DISTRIBUTION: amdPhase === "DISTRIBUTION" ? 1 : 0,
    amd_TRANSITION: amdPhase === "TRANSITION" ? 1 : 0,
    amd_UNCLEAR: amdPhase === "UNCLEAR" ? 1 : 0,

    // VR regime
    vr_regime: vrRegime,

    // Historical (defaults — BFF can't compute these from scratch)
    win_rate_20: 0.5,
    win_rate_50: 0.5,
    expectancy_20: 0,
    profit_factor_20: 1,

    // Range quality
    gap_pct: 0,
    range_vs_atr: atr > 0 ? ((last.high || 0) - (last.low || 0)) / atr : 0,
    daily_range_used_pct: 0,
  };
}

function std(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Get full consensus signal from ML Engine.
 * Called by the frontend when user opens ML Consensus panel.
 *
 * @param {object} params
 * @param {object} params.mathEngine - MathEngine.js current state
 * @param {object[]} params.recentCandles - last N 5-min candles
 * @param {object} params.keyLevels - { pdh, pdl, pwh, pwl }
 * @param {number} params.sessionId - 0=pre, 1=main, 2=post
 * @param {string} params.symbol - instrument symbol (default MNQ)
 * @returns {Promise<object>} unified consensus signal
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
  const features = buildMlFeatureVector(
    mathEngine,
    recentCandles,
    keyLevels,
    sessionId,
  );

  try {
    // Call ML Engine prediction
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
      {
        requestId,
        idempotencyKey,
      },
    );

    // Enrich with session context
    const sessionNames = ["Pre-Market", "Main Trading", "Post-Market"];
    const sessionLabels = {
      0: "pre_market",
      1: "main_trading",
      2: "post_market",
    };

    return {
      ok: true,
      source: "ml_engine",
      timestamp: new Date().toISOString(),
      signal: mlResult.signal || "NEUTRAL",
      confidence: mlResult.confidence || 0.5,

      // Voting breakdown
      votes: mlResult.votes || {},

      // Session context
      session: {
        id: sessionId,
        name: sessionNames[sessionId] || "Main Trading",
        session_pct: features.session_pct,
        minutes_into_session: features.minutes_into_session,
      },

      // Alpha
      alpha: mlResult.alpha || null,

      // Expected move
      expected_move: mlResult.expected_move || null,

      // RRR
      rrr: mlResult.rrr || null,

      // Exit strategy
      exit_plan: mlResult.exit_plan || null,

      // Position sizing
      position_sizing: mlResult.position_sizing || null,

      // Physics-based regime (FP-FK PDE + Tsallis q-Gaussians + Anomalous Diffusion + Hurst)
      regime: mlResult.physics_regime || null,

      // Timing
      timing: mlResult.timing || null,

      // Model metadata
      models_used: mlResult.models_used || 0,
      data_trades_analyzed: mlResult.data_trades_analyzed || 0,
      model_freshness: mlResult.model_freshness || "unknown",
      feature_vector: features,
    };
  } catch (err) {
    // Graceful degradation: return fallback signal when ML Engine unavailable
    const isCircuitOpen = err.code === "CIRCUIT_OPEN";
    console.error(
      isCircuitOpen
        ? `[consensusEngine] Circuit breaker OPEN — ML Engine failing`
        : `[consensusEngine] ML Engine unavailable: ${err.message}`,
    );

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
              Date.now()) /
              1000,
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
        name:
          ["Pre-Market", "Main Trading", "Post-Market"][sessionId] ||
          "Main Trading",
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
    const url = endpoint
      ? `/sla?endpoint=${encodeURIComponent(endpoint)}`
      : "/sla";
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
 * Called automatically when breaking news is detected in consensus response.
 */
export async function triggerMLNewsTraining(newsItem, options = {}) {
  if (!newsItem || newsItem.impact !== "HIGH") return { triggered: false };
  try {
    const res = await mlRequest(
      "/news-trigger",
      {
        news: newsItem,
        trigger_type: "breaking_news_high_impact",
      },
      8000,
      options,
    );
    return { triggered: true, response: res };
  } catch (err) {
    console.error("[consensusEngine] news-trigger failed:", err.message);
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
    return { ok: false, error: err.message };
  }
}

/**
 * Fetch recent news reactions from ML Engine (ML training data).
 */
export async function getMLNewsReactions(limit = 50, options = {}) {
  try {
    const res = await mlRequest(
      `/news/reactions?limit=${limit}`,
      null,
      5000,
      options,
    );
    return res;
  } catch (err) {
    console.error("[consensusEngine] news/reactions failed:", err.message);
    return { ok: false, entries: [], error: err.message };
  }
}

/**
 * Get full physics-based regime analysis from ML Engine.
 * Combines HMM + FP-FK PDE + Fisher-KPP + Tsallis q-Gaussians + Anomalous Diffusion.
 *
 * @param {object[]} candles - 5-min candle array (min 50 required)
 * @returns {Promise<object>} full regime analysis
 */
export async function getPhysicsRegime(candles = [], options = {}) {
  try {
    const res = await mlRequest(
      "/regime",
      {
        candles: candles.slice(-100),
        symbol: "MNQ",
      },
      30_000,
      options,
    );
    return res;
  } catch (err) {
    console.error(
      "[consensusEngine] Regime analysis unavailable:",
      err.message,
    );
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

export default createConsensusEngineService;
