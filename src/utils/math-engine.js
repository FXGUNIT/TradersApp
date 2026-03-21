// src/math-engine.js

/**
 * 1. CONTINUOUS VOLATILITY ENGINE
 * Calculates the Volatility Ratio (VR) based on recent daily ranges for MNQ/MES.
 */
export function calculateVolatilityRatio(atr5D, atr20D) {
  // Fallback to 1.0 (normal volatility) if data is missing or zero
  if (!atr20D || atr20D === 0) return 1.0; 
  return atr5D / atr20D;
}

/**
 * 2. DYNAMIC AMD MULTIPLIERS
 * Scales VWAP standard deviations and Stop Loss parameters based on the VR.
 */
export function getDynamicParameters(vr) {
  return {
    vwapSd1: Math.max(0.5, Math.min(1.8, 1.0 * vr)),
    vwapSd2: Math.max(1.5, Math.min(3.5, 2.0 * vr)),
    trendSlMultiplier: Math.max(1.2, Math.min(2.8, 1.8 * vr)),
    reversalSlMultiplier: Math.max(0.7, Math.min(1.5, 1.0 * vr))
  };
}

/**
 * 3. DRAWDOWN THROTTLING (Risk Shield)
 * Automatically halves the selected risk percentage if the account drops 
 * into the bottom 25% of the allowed max drawdown threshold.
 */
export function calculateThrottledRisk(currentBalance, startingBalance, maxDrawdownAllowed, baseRiskPercent) {
  const currentDrawdown = startingBalance - currentBalance;
  const drawdownRemaining = maxDrawdownAllowed - currentDrawdown;

  // If remaining drawdown buffer is 25% or less, trigger the throttle
  if (drawdownRemaining <= (maxDrawdownAllowed * 0.25)) {
    return {
      isThrottled: true,
      activeRiskPercent: baseRiskPercent / 2
    };
  }

  return {
    isThrottled: false,
    activeRiskPercent: baseRiskPercent
  };
}