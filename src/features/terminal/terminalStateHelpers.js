import {
  calculateManipulationWickValidation,
  detectAmdPhase,
} from "../../utils/math-engine.js";

export const defaultAccountState = {
  startingBalance: "",
  currentBalance: "",
  highWaterMark: "",
  dailyStartBalance: "",
};

export function parseRrrMultiple(rrr) {
  const parts = String(rrr || "").split(":");
  const parsed = Number.parseFloat(parts[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function parseWorkspaceSnapshot(snapshot) {
  try {
    return snapshot ? JSON.parse(snapshot) : null;
  } catch {
    return null;
  }
}

export function buildEquityCurvePath(series, width = 360, height = 100, padding = 14) {
  const points = Array.isArray(series) ? series : [];
  if (!points.length) return { path: "", dots: [], min: 0, max: 0, hwmPath: "", hwmDots: [] };

  const values = points.map((point) => Number(point?.cumulativePnl) || 0);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const coords = points.map((point, index) => {
    const x = padding + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const yValue = Number(point?.cumulativePnl) || 0;
    const y = padding + (1 - (yValue - min) / span) * innerHeight;
    return { x, y, ...point };
  });

  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  // ── Ghost HWM overlay ───────────────────────────────────────────────
  // Tracks trailing high-water mark of NET equity so the user can see
  // exactly how much unrealised drawdown they're carrying.
  const hwmCoords = points.map((point, index) => {
    const x = padding + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const hwmValue = Number(point?.hwm ?? 0);
    // HWM is always >= 0 (it's a running max), but clamp to our visible range
    const clampedHwm = Math.max(min, Math.min(max, hwmValue));
    const y = padding + (1 - (clampedHwm - min) / span) * innerHeight;
    return { x, y, hwmValue };
  });

  const hwmPath = hwmCoords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  return { path, dots: coords, min, max, hwmPath, hwmDots: hwmCoords };
}

export function getISTDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function deriveLiveAmdContext(parsed, extractedVals) {
  const days = Array.isArray(parsed?.days) ? parsed.days : [];
  const latestDay = days.length ? days[days.length - 1] : null;
  const latestSession = latestDay?.trading || latestDay?.full || null;
  const atr = Number.parseFloat(
    extractedVals?.atr || latestDay?.tradingHoursAtr14 || latestDay?.atr14 || parsed?.tradingHoursAtr14 || 0,
  );
  const open = Number.parseFloat(latestSession?.o ?? latestDay?.full?.o ?? 0);
  const high = Number.parseFloat(latestSession?.h ?? latestDay?.full?.h ?? 0);
  const low = Number.parseFloat(latestSession?.l ?? latestDay?.full?.l ?? 0);
  const close = Number.parseFloat(latestSession?.c ?? latestDay?.full?.c ?? 0);
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
  const recentHighs = recentSessions.map((session) => Number.parseFloat(session.h || 0));
  const recentLows = recentSessions.map((session) => Number.parseFloat(session.l || 0));
  const higherHighs =
    recentHighs.length === 3 &&
    recentHighs[0] < recentHighs[1] &&
    recentHighs[1] < recentHighs[2];
  const lowerLows =
    recentLows.length === 3 &&
    recentLows[0] > recentLows[1] &&
    recentLows[1] > recentLows[2];
  const volumeNearLows =
    range > 0 ? (close - low) / range <= 0.3 : false;
  const conflictingSignals =
    Boolean(wickValidation.manipulated) && !(higherHighs || lowerLows);
  const adxDeclining =
    extractedVals?.adx !== null && extractedVals?.adx !== undefined
      ? Number.parseFloat(extractedVals.adx) < 20
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

export function normalizeJournal(journal) {
  if (Array.isArray(journal)) return journal;
  if (journal && typeof journal === "object") return Object.values(journal);
  return [];
}

export function buildAccountState(accountState) {
  return {
    ...defaultAccountState,
    ...(accountState || {}),
  };
}
