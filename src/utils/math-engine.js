// src/utils/math-engine.js

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toNumber = (value, fallback = 0) => {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundTo = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/**
 * 1. CONTINUOUS VOLATILITY ENGINE
 * Calculates the Volatility Ratio (VR) from 5D ATR and 20D ATR.
 */
export function calculateVolatilityRatio(atr5D, atr20D) {
  const fiveDay = toNumber(atr5D, 0);
  const twentyDay = toNumber(atr20D, 0);

  if (twentyDay <= 0) return 1.0;
  const ratio = fiveDay / twentyDay;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1.0;
}

/**
 * 2. DYNAMIC AMD MULTIPLIERS
 * Provides the spec-facing values and legacy aliases used by the terminal.
 */
export function getDynamicParameters(vr, baseStopLossMult = 1.8) {
  const normalizedVr = clamp(toNumber(vr, 1.0), 0.1, 5.0);
  const vrAdjustment = (normalizedVr - 1.0) * 0.5;
  const dynamicSLMult = roundTo(baseStopLossMult * (1 + vrAdjustment), 2);
  const vwapSD1 = roundTo(clamp(normalizedVr, 0.5, 3.0), 2);
  const vwapSD2 = roundTo(clamp(normalizedVr * 2, 1.0, 6.0), 2);

  // Preserve current terminal field names and expose spec-friendly aliases.
  const trendSLMult = dynamicSLMult;
  const mrSLMult = roundTo(clamp(dynamicSLMult * 0.6, 0.7, 1.5), 2);

  return {
    dynamicSLMult,
    vwapSD1,
    vwapSD2,
    trendSLMult,
    mrSLMult,
    vwapSd1: vwapSD1,
    vwapSd2: vwapSD2,
    trendSlMultiplier: trendSLMult,
    reversalSlMultiplier: mrSLMult,
  };
}

/**
 * 3. POSITION SIZING
 * Floors to whole contracts while preserving the spec formula.
 */
export function calculatePositionSize({
  accountBalance = 0,
  riskPct = 0.3,
  stopLossPoints = 0,
  dollarsPerPoint = 1,
  throttleMultiplier = 1,
} = {}) {
  const balance = toNumber(accountBalance, 0);
  const riskPercent = toNumber(riskPct, 0);
  const slPoints = toNumber(stopLossPoints, 0);
  const dpp = toNumber(dollarsPerPoint, 1);
  const throttle = clamp(toNumber(throttleMultiplier, 1), 0.1, 1);

  if (balance <= 0 || riskPercent <= 0 || slPoints <= 0 || dpp <= 0) {
    return 0;
  }

  const maxRiskUSD = balance * (riskPercent / 100);
  return Math.floor((maxRiskUSD * throttle) / (slPoints * dpp));
}

/**
 * 4. DRAWDOWN THROTTLING (Risk Shield)
 * Halves risk when the account is within the bottom 25% of the drawdown buffer.
 */
export function calculateDrawdownThrottle({
  currentBalance = 0,
  startingBalance = 0,
  highWaterMark = 0,
  maxDrawdown = 0,
  drawdownType = "trailing",
  baseRiskPercent = 0.3,
} = {}) {
  const balance = toNumber(currentBalance, 0);
  const start = toNumber(startingBalance, balance);
  const hwm = toNumber(highWaterMark, balance);
  const maxDd = Math.max(0, toNumber(maxDrawdown, 0));

  if (balance <= 0 || maxDd <= 0) {
    return {
      isThrottled: false,
      activeRiskPct: roundTo(baseRiskPercent, 2),
      bufferPct: 100,
      liquidationLevel: null,
      distanceToLiq: null,
    };
  }

  const liquidationLevel =
    drawdownType === "trailing" ? hwm - maxDd : start - maxDd;
  const distanceToLiq = balance - liquidationLevel;
  const bufferPct = (distanceToLiq / maxDd) * 100;
  const isThrottled = bufferPct < 25;

  return {
    isThrottled,
    activeRiskPct: roundTo(isThrottled ? baseRiskPercent / 2 : baseRiskPercent, 2),
    bufferPct: roundTo(bufferPct, 2),
    liquidationLevel: roundTo(liquidationLevel, 2),
    distanceToLiq: roundTo(distanceToLiq, 2),
  };
}

/**
 * Backwards-compatible alias used by existing callers.
 */
export function calculateThrottledRisk(
  baseRiskPercent = 0.3,
  _vr = 1.0,
  currentBalance = 0,
  maxDrawdown = 0,
) {
  return calculateDrawdownThrottle({
    currentBalance,
    maxDrawdown,
    baseRiskPercent,
    highWaterMark: currentBalance,
    startingBalance: currentBalance,
    drawdownType: "trailing",
  });
}

/**
 * 5. MANIPULATION WICK VALIDATION
 */
export function calculateManipulationWickValidation({
  relevantWick = 0,
  totalRange = 0,
  atr = 0,
} = {}) {
  const wick = toNumber(relevantWick, 0);
  const range = toNumber(totalRange, 0);
  const atrValue = toNumber(atr, 0);
  const wickRatio = range > 0 ? wick / range : 0;
  const manipulated = wickRatio >= 0.4 && range > atrValue * 1.5;

  return {
    wickRatio: roundTo(wickRatio, 4),
    manipulated,
  };
}

/**
 * 5b. LIQUIDITY SWEEP PROBABILITY
 * Uses the spec's weighted score with a best-effort score for volume profile.
 */
export function calculateLiquiditySweepProbability({
  distanceToLevel = 0,
  atr = 0,
  timeSinceLastTestMins = 0,
  volumeProfileScore = 0.5,
} = {}) {
  const distance = Math.max(0, toNumber(distanceToLevel, 0));
  const atrValue = Math.max(0, toNumber(atr, 0));
  const minutes = Math.max(0, toNumber(timeSinceLastTestMins, 0));
  const volumeScore = clamp(toNumber(volumeProfileScore, 0.5), 0, 1);

  const distanceScore =
    atrValue > 0 ? clamp(1 - distance / (atrValue * 2), 0, 1) : 0;
  const timeScore = clamp(minutes / 180, 0, 1);
  const probability = clamp(
    distanceScore * 0.5 + timeScore * 0.3 + volumeScore * 0.2,
    0,
    1,
  );

  return {
    probability: roundTo(probability, 3),
    distanceScore: roundTo(distanceScore, 3),
    timeScore: roundTo(timeScore, 3),
    volumeScore: roundTo(volumeScore, 3),
    alert:
      probability > 0.7
        ? "HIGH probability of liquidity sweep"
        : probability > 0.45
          ? "Moderate liquidity sweep risk"
          : "Low liquidity sweep risk",
    recommendedAction:
      probability > 0.7
        ? "Wait for wick + reversal confirmation"
        : "Monitor key level reaction",
  };
}

/**
 * 6. AMD PHASE DETECTION
 */
export function detectAmdPhase({
  range = 0,
  twentyDayAdr = 0,
  volumeNearLows = false,
  wickRatio = 0,
  wickToAtr = 0,
  higherHighs = false,
  lowerLows = false,
  conflictingSignals = false,
  adxDeclining = false,
} = {}) {
  const currentRange = toNumber(range, 0);
  const adr20 = toNumber(twentyDayAdr, 0);
  const wick = toNumber(wickRatio, 0);
  const wickAtr = toNumber(wickToAtr, 0);

  const accumulation =
    adr20 > 0 && currentRange < adr20 * 0.8 && Boolean(volumeNearLows);
  const manipulation = wick >= 0.4 && wickAtr > 1.5;
  const distribution =
    adr20 > 0
    && currentRange > adr20 * 1.2
    && Boolean(higherHighs || lowerLows)
    && !conflictingSignals;
  const transition = Boolean(conflictingSignals) || Boolean(adxDeclining);

  let phase = "UNCLEAR";
  if (accumulation) phase = "ACCUMULATION";
  else if (manipulation) phase = "MANIPULATION";
  else if (distribution) phase = "DISTRIBUTION";
  else if (transition) phase = "TRANSITION";

  return {
    phase,
    signals: {
      accumulation,
      manipulation,
      distribution,
      transition,
    },
  };
}
