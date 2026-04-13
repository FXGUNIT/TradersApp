/**
 * ConsensusAggregator — feature vector construction + utility math.
 * Extracted from consensusEngine.mjs (Rule #3 hard limit: JS ≤500 lines)
 *
 * Pure functions: no side effects, no network calls.
 * Used by consensusEngine.mjs to build the ML feature vector.
 */

function std(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
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

  // Key level proximity
  const close = last.close || me?.close || 0;
  const priceToPdh =
    keyLevels.pdh && atr > 0 ? (close - keyLevels.pdh) / atr : 0;
  const priceToPdl =
    keyLevels.pdl && atr > 0 ? (keyLevels.pdl - close) / atr : 0;

  // VWAP slope encoding
  const vwapSlopeEntry = me?.vwapSlope ?? 0;

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
    realized_vol: rollingStd20 * Math.sqrt(78),

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
