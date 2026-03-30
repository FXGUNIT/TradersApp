import {
  calculateDrawdownThrottle,
  calculateLiquiditySweepProbability,
  calculateManipulationWickValidation,
  calculatePositionSize,
  calculateVolatilityRatio,
  detectAmdPhase,
  getDynamicParameters,
} from "../../utils/math-engine.js";

function toNumber(value, fallback = 0) {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPointValue(instrument = "") {
  if (instrument === "MNQ") return 2;
  if (instrument === "MES") return 5;
  if (instrument === "US100") return 1;
  return 10;
}

function deriveLiveAmdContext(parsed, extractedVals) {
  const days = Array.isArray(parsed?.days) ? parsed.days : [];
  const latestDay = days.length ? days[days.length - 1] : null;
  const latestSession = latestDay?.trading || latestDay?.full || null;
  const atr = toNumber(
    extractedVals?.atr ||
      latestDay?.tradingHoursAtr14 ||
      latestDay?.atr14 ||
      parsed?.tradingHoursAtr14 ||
      0,
  );
  const open = toNumber(latestSession?.o ?? latestDay?.full?.o ?? 0);
  const high = toNumber(latestSession?.h ?? latestDay?.full?.h ?? 0);
  const low = toNumber(latestSession?.l ?? latestDay?.full?.l ?? 0);
  const close = toNumber(latestSession?.c ?? latestDay?.full?.c ?? 0);
  const range = Math.max(0, high - low);
  const upperWick = Math.max(0, high - Math.max(open, close));
  const lowerWick = Math.max(0, Math.min(open, close) - low);
  const relevantWick = Math.max(upperWick, lowerWick);
  const wickValidation = calculateManipulationWickValidation({
    relevantWick,
    totalRange: range,
    atr,
  });
  const recentSessions = days
    .slice(-3)
    .map((day) => day?.trading || day?.full || null)
    .filter(Boolean);
  const recentHighs = recentSessions.map((session) => toNumber(session.h || 0));
  const recentLows = recentSessions.map((session) => toNumber(session.l || 0));
  const higherHighs =
    recentHighs.length === 3 &&
    recentHighs[0] < recentHighs[1] &&
    recentHighs[1] < recentHighs[2];
  const lowerLows =
    recentLows.length === 3 &&
    recentLows[0] > recentLows[1] &&
    recentLows[1] > recentLows[2];
  const volumeNearLows = range > 0 ? (close - low) / range <= 0.3 : false;
  const conflictingSignals =
    Boolean(wickValidation.manipulated) && !(higherHighs || lowerLows);
  const adxDeclining =
    extractedVals?.adx !== null && extractedVals?.adx !== undefined
      ? toNumber(extractedVals.adx, 0) < 20
      : false;

  return {
    phase: detectAmdPhase({
      range,
      twentyDayAdr: parsed?.tradingHoursAtr14 || latestDay?.atr14 || 0,
      volumeNearLows,
      wickRatio: wickValidation.wickRatio,
      wickToAtr: atr > 0 ? relevantWick / atr : 0,
      higherHighs,
      lowerLows,
      conflictingSignals,
      adxDeclining,
    }).phase,
    range,
    atr,
    open,
    high,
    low,
    close,
    relevantWick,
    wickValidation,
    volumeNearLows,
    higherHighs,
    lowerLows,
    conflictingSignals,
    adxDeclining,
  };
}

export function computeTerminalDerivedState({
  parsed = null,
  extractedVals = {},
  accountState = {},
  firmRules = {},
  tradeForm = {},
} = {}) {
  const latestParsedDay = parsed?.days?.length
    ? parsed.days[parsed.days.length - 1]
    : null;
  const fiveDayFallback = latestParsedDay?.fiveDayATR || latestParsedDay?.atr14 || 0;
  const twentyDayFallback =
    latestParsedDay?.twentyDayATR || parsed?.tradingHoursAtr14 || 0;
  const fiveDayATR = extractedVals.fiveDayATR || fiveDayFallback || 0;
  const twentyDayATR = extractedVals.twentyDayATR || twentyDayFallback || 0;

  const VR = calculateVolatilityRatio(fiveDayATR, twentyDayATR);
  const { vwapSD1, vwapSD2, trendSLMult, mrSLMult } = getDynamicParameters(VR);
  const { activeRiskPct, isThrottled } = calculateDrawdownThrottle({
    currentBalance: toNumber(accountState.currentBalance, 0),
    startingBalance: toNumber(accountState.startingBalance, 0),
    highWaterMark: toNumber(accountState.highWaterMark, 0),
    maxDrawdown: toNumber(firmRules.maxDrawdown, 0),
    drawdownType: firmRules.drawdownType || "trailing",
    baseRiskPercent: toNumber(tradeForm.riskPct, 0.3),
  });

  let volatilityRegime = "Normal";
  if (VR < 0.85) volatilityRegime = "Compression";
  else if (VR > 1.15) volatilityRegime = "Expansion";

  const atrVal =
    toNumber(extractedVals.atr, 0) ||
    toNumber(latestParsedDay?.tradingHoursAtr14, 0) ||
    toNumber(parsed?.tradingHoursAtr14, 0) ||
    0;
  const slMult = tradeForm.tradeType === "Trend" ? trendSLMult : mrSLMult;
  const slPts = atrVal * slMult;
  const ptVal = getPointValue(tradeForm.instrument);
  const maxRiskUSD =
    tradeForm.accountBalance && tradeForm.riskPct
      ? Math.round(
          toNumber(tradeForm.accountBalance, 0) *
            (toNumber(tradeForm.riskPct, 0) / 100) *
            100,
        ) / 100
      : null;

  const contracts =
    maxRiskUSD && slPts && ptVal
      ? Math.max(
          1,
          calculatePositionSize({
            accountBalance: tradeForm.accountBalance,
            riskPct: tradeForm.riskPct,
            stopLossPoints: slPts,
            dollarsPerPoint: ptVal,
            throttleMultiplier: isThrottled ? 0.5 : 1,
          }),
        )
      : 1;

  const proposedSLDollars = contracts * slPts * ptVal;
  const vwapPrice = extractedVals.vwap ? toNumber(extractedVals.vwap, null) : null;
  const sd1Target =
    vwapPrice && vwapSD1
      ? tradeForm.direction === "Long"
        ? vwapPrice + vwapSD1
        : vwapPrice - vwapSD1
      : null;
  const sd2Target =
    vwapPrice && vwapSD2
      ? tradeForm.direction === "Long"
        ? vwapPrice + vwapSD2
        : vwapPrice - vwapSD2
      : null;

  const tradeEntryPrice = toNumber(
    tradeForm.entryPrice || extractedVals.currentPrice || "",
    Number.NaN,
  );
  const keyLevels = parsed?.keyLevels || {};
  const candidates = [
    ["PDH", keyLevels.pdh],
    ["PDL", keyLevels.pdl],
    ["PWH", keyLevels.pwh],
    ["PWL", keyLevels.pwl],
  ]
    .map(([label, value]) => ({ label, value: toNumber(value, Number.NaN) }))
    .filter((item) => Number.isFinite(item.value));

  let sweepEstimate = null;
  if (Number.isFinite(tradeEntryPrice) && candidates.length) {
    const nearest = candidates.reduce((best, item) => {
      if (!best) return item;
      const bestDistance = Math.abs(tradeEntryPrice - best.value);
      const itemDistance = Math.abs(tradeEntryPrice - item.value);
      return itemDistance < bestDistance ? item : best;
    }, null);

    const estimatedMinutesSinceTest = Math.min(
      180,
      Math.max(
        30,
        Math.round(
          (toNumber(parsed?.totalBars, 180) / Math.max(1, toNumber(parsed?.totalDays, 1))) /
            2,
        ),
      ),
    );

    sweepEstimate = {
      ...calculateLiquiditySweepProbability({
        distanceToLevel: Math.abs(tradeEntryPrice - nearest.value),
        atr: atrVal || parsed?.tradingHoursAtr14 || 0,
        timeSinceLastTestMins: estimatedMinutesSinceTest,
        volumeProfileScore:
          nearest.label === "PDH" || nearest.label === "PWH" ? 0.35 : 0.65,
      }),
      levelName: nearest.label,
      levelValue: nearest.value,
      price: tradeEntryPrice,
      estimatedMinutesSinceTest,
    };
  }

  return {
    maxRiskUSD,
    activeRiskPct,
    isThrottled,
    VR,
    volatilityRegime,
    atrVal,
    slPts,
    ptVal,
    contracts,
    proposedSLDollars,
    sd1Target,
    sd2Target,
    sweepEstimate,
    liveAmdContext: deriveLiveAmdContext(parsed, extractedVals),
  };
}

export const EMPTY_TERMINAL_DERIVED_STATE = computeTerminalDerivedState();

export default {
  computeTerminalDerivedState,
  EMPTY_TERMINAL_DERIVED_STATE,
};
