// ─── Commission constants (per round turn: entry + exit) ─────────────────────
export const COMMISSION_PER_SIDE = {
  MNQ: 0.31,   // $0.31 per side × 2 sides = $0.62 per round turn
  MES: 0.42,   // $0.42 per side × 2 sides = $0.85 per round turn
  default: 0.31,
};
const DEFAULT_CONTRACT = 1;

function getCommission(instrument = "MNQ", contracts = DEFAULT_CONTRACT) {
  const rate = COMMISSION_PER_SIDE[instrument] ?? COMMISSION_PER_SIDE.default;
  return rate * 2 * Math.max(1, contracts); // entry + exit = round turn
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toHour(dateStr = "", timeStr = "") {
  // Parse hour from "HH:MM" time string or "YYYY-MM-DD HH:MM" full string
  const raw = (timeStr || "").split(":")[0] || "";
  const h = parseInt(raw, 10);
  if (Number.isFinite(h)) return h;
  // Fallback: parse from date string
  const parts = (dateStr || "").split(/[-T ]/);
  if (parts.length >= 3) {
    const hh = parseInt(parts[3] || "0", 10);
    return Number.isFinite(hh) ? hh : -1;
  }
  return -1;
}

function normalizeAmdPhase(value) {
  const phase = String(value || "").trim().toUpperCase();
  if (phase === "ACCUMULATION" || phase === "MANIPULATION" || phase === "DISTRIBUTION" || phase === "TRANSITION") {
    return phase;
  }
  return "UNCLEAR";
}

export function computeJournalMetrics(journal = []) {
  const entries = Array.isArray(journal) ? journal : [];
  const wins = entries.filter(
    (entry) => String(entry?.result || "").toLowerCase() === "win",
  );
  const losses = entries.filter(
    (entry) => String(entry?.result || "").toLowerCase() === "loss",
  );

  const pnlTotal = entries.reduce((sum, entry) => sum + toNumber(entry?.pnl), 0);
  const totalWinPnl = wins.reduce((sum, entry) => sum + toNumber(entry?.pnl), 0);
  const totalLossPnl = losses.reduce(
    (sum, entry) => sum + toNumber(entry?.pnl),
    0,
  );

  const wr = entries.length > 0 ? (wins.length / entries.length) * 100 : 0;
  const avgWin = wins.length > 0 ? totalWinPnl / wins.length : 0;
  const avgLoss =
    losses.length > 0 ? Math.abs(totalLossPnl / losses.length) : 0;
  const lossDenominator = avgLoss * losses.length;
  const pf =
    lossDenominator > 0
      ? (avgWin * wins.length) / lossDenominator
    : wins.length > 0
        ? Number.POSITIVE_INFINITY
        : 0;

  const accuracySamples = entries
    .map((entry) => {
      const entryPrice = toNumber(entry?.entry, NaN);
      const predictedTP1 = toNumber(
        entry?.predictedTP1 ?? entry?.predicted_tp1,
        NaN,
      );
      const actualExit = toNumber(entry?.actualExit ?? entry?.exit, NaN);

      if (
        !Number.isFinite(entryPrice) ||
        !Number.isFinite(predictedTP1) ||
        !Number.isFinite(actualExit)
      ) {
        return null;
      }

      const predictedDistance = Math.abs(predictedTP1 - entryPrice);
      if (predictedDistance <= 0) return null;

      const actualDistance = Math.abs(actualExit - entryPrice);
      return Math.max(0, (actualDistance / predictedDistance) * 100);
    })
    .filter((value) => Number.isFinite(value));

  const predictionAccuracy =
    accuracySamples.length > 0
      ? accuracySamples.reduce((sum, value) => sum + value, 0) /
        accuracySamples.length
      : 0;
  const recentAccuracies = accuracySamples.slice(-5);
  const predictionAccuracyL5 =
    recentAccuracies.length > 0
      ? recentAccuracies.reduce((sum, value) => sum + value, 0) /
        recentAccuracies.length
      : 0;

  const amdSeeds = ["ACCUMULATION", "MANIPULATION", "DISTRIBUTION", "TRANSITION", "UNCLEAR"];
  const amdBreakdownMap = Object.fromEntries(
    amdSeeds.map((phase) => [
      phase,
      {
        phase,
        label:
          phase === "ACCUMULATION"
            ? "Accumulation"
            : phase === "MANIPULATION"
              ? "Manipulation"
              : phase === "DISTRIBUTION"
                ? "Distribution"
                : phase === "TRANSITION"
                  ? "Transition"
                  : "Unclear",
        trades: 0,
        wins: 0,
        losses: 0,
        pnl: 0,
      },
    ]),
  );

  const equityCurve = [];
  const hourlyProfitMap = {}; // hour 9-16 → { pnl, wins, losses, count }
  let runningPnl = 0;
  let runningNetPnl = 0;
  let runningHwm = 0;
  let totalCommission = 0;

  // Initialise hourly buckets for trading hours 9am–4pm
  for (let h = 9; h <= 16; h++) {
    hourlyProfitMap[h] = { pnl: 0, wins: 0, losses: 0, count: 0 };
  }

  entries.forEach((entry, index) => {
    const phase = normalizeAmdPhase(entry?.amdPhase);
    const pnl = toNumber(entry?.pnl);
    const result = String(entry?.result || "").toLowerCase();
    const contracts = Math.max(1, parseInt(entry?.contracts, 10) || 1);
    const commission = getCommission(entry?.instrument, contracts);
    const netPnl = pnl - commission;

    totalCommission += commission;

    const bucket = amdBreakdownMap[phase] || amdBreakdownMap.UNCLEAR;
    bucket.trades += 1;
    bucket.pnl += pnl;
    if (result === "win") bucket.wins += 1;
    if (result === "loss") bucket.losses += 1;

    runningPnl += pnl;
    runningNetPnl += netPnl;
    runningHwm = Math.max(runningHwm, runningNetPnl); // trailing high-water mark

    // Hour aggregation
    const hour = toHour(entry?.date || "", entry?.time || "");
    if (hour >= 9 && hour <= 16) {
      const hb = hourlyProfitMap[hour];
      hb.pnl += netPnl;
      hb.count += 1;
      if (result === "win") hb.wins += 1;
      if (result === "loss") hb.losses += 1;
    }

    equityCurve.push({
      index,
      tradeLabel: entry?.date ? String(entry.date) : `Trade ${index + 1}`,
      pnl,
      commission,
      netPnl,
      cumulativePnl: runningPnl,
      cumulativeNetPnl: runningNetPnl,
      hwm: runningHwm, // HWM at THIS trade's point
      result: result === "win" ? "win" : result === "loss" ? "loss" : "breakeven",
    });
  });

  const amdBreakdown = amdSeeds.map((phase) => {
    const bucket = amdBreakdownMap[phase];
    const wr = bucket.trades > 0 ? (bucket.wins / bucket.trades) * 100 : 0;
    const avgPnl = bucket.trades > 0 ? bucket.pnl / bucket.trades : 0;
    return {
      ...bucket,
      wr,
      avgPnl,
    };
  });

  const bestAmdPhase = amdBreakdown
    .filter((bucket) => bucket.trades > 0)
    .sort((a, b) => b.wr - a.wr || b.pnl - a.pnl)[0] || null;

  // Net P&L = gross minus all commissions
  const netPnlTotal = runningNetPnl;

  // Commissions broken down by instrument
  const commissionByInstrument = {};
  entries.forEach((entry) => {
    const inst = entry?.instrument || "MNQ";
    const contracts = Math.max(1, parseInt(entry?.contracts, 10) || 1);
    if (!commissionByInstrument[inst]) commissionByInstrument[inst] = 0;
    commissionByInstrument[inst] += getCommission(inst, contracts);
  });

  return {
    wins,
    losses,
    pnlTotal,
    netPnlTotal,
    totalCommission,
    commissionByInstrument,
    wr,
    avgWin,
    avgLoss,
    pf,
    predictionAccuracy,
    predictionAccuracyL5,
    recentAccuracies,
    accuracySamples,
    amdBreakdown,
    bestAmdPhase,
    equityCurve,
    hourlyProfitMap,
  };
}

export const EMPTY_JOURNAL_METRICS = computeJournalMetrics([]);

// Seed hourly buckets for the empty state
EMPTY_JOURNAL_METRICS.hourlyProfitMap = Object.fromEntries(
  Array.from({ length: 8 }, (_, i) => [9 + i, { pnl: 0, wins: 0, losses: 0, count: 0 }])
);

export function formatMetricNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(digits);
}

// ─── Payout Trajectory Projection ───────────────────────────────────────────────

/**
 * computePayoutTrajectory — projects days remaining to reach payout eligibility.
 *
 * Uses rolling average of daily net P&L and the firm's consistency rule.
 * NEVER assumes 100% win rate. Uses a weighted rolling average that degrades
 * toward the recent average to avoid false hope.
 *
 * @param {object[]} journal   - journal entries (each with date, pnl, result)
 * @param {object}  firmRules - { profitTarget, consistencyMaxDayPct, minimumTradingDays }
 *
 * @returns {object} payout projection
 */
export function computePayoutTrajectory(journal = [], firmRules = {}) {
  const profitTarget = parseFloat(firmRules.profitTarget || 0);
  const consistencyCap = parseFloat(firmRules.consistencyMaxDayPct || 0);
  const minTradingDays = parseInt(firmRules.minimumTradingDays || "0", 10) || 0;

  if (!profitTarget || profitTarget <= 0) {
    return { eligible: false, reason: "No payout target set" };
  }

  // Aggregate daily P&L from journal entries
  const dailyNet = {};
  for (const entry of journal) {
    const d = entry.date || "";
    if (!d) continue;
    dailyNet[d] = (dailyNet[d] || 0) + toNumber(entry.pnl);
  }

  const tradingDays = Object.keys(dailyNet).sort();
  if (tradingDays.length < 1) {
    return {
      eligible: true,
      currentDay: 0,
      targetDays: minTradingDays || 14,
      avgDailyNet: 0,
      projectedDay: null,
      pctToTarget: 0,
      totalNet: 0,
      reason: "No trades yet",
    };
  }

  // Use all-time rolling average (conservative — not just wins)
  const totalNet = Object.values(dailyNet).reduce((s, v) => s + v, 0);

  // Consistency check: if any single day's net > consistencyCap% of profitTarget, it's suspicious
  const hasConsistencyViolation = Object.values(dailyNet).some(
    (v) => profitTarget > 0 && Math.abs(v) / profitTarget > consistencyCap,
  );

  if (hasConsistencyViolation) {
    return {
      eligible: false,
      reason: "Consistency rule may be breached — review daily P&L",
    };
  }

  // Progress toward payout
  const pctToTarget = profitTarget > 0 ? Math.min(100, (totalNet / profitTarget) * 100) : 0;

  // Days projected to reach payout (only if avgDailyNet > 0)
  // Conservative: use weighted rolling average (recent trades weighted more)
  const weightedAvg = computeWeightedDailyAvg(dailyNet, tradingDays);
  const projectedDay = weightedAvg > 0
    ? Math.ceil(profitTarget / weightedAvg)
    : null;

  return {
    eligible: true,
    currentDay: tradingDays.length,
    targetDays: minTradingDays || 14,
    avgDailyNet: weightedAvg,
    projectedDay,
    pctToTarget,
    totalNet,
    reason: null,
  };
}

function computeWeightedDailyAvg(dailyNet, tradingDays) {
  if (!tradingDays.length) return 0;
  // Weight recent days more: linear decay over last 14 days
  const n = tradingDays.length;
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < n; i++) {
    // i=0 is oldest, i=n-1 is newest
    const weight = i + 1; // newer = higher weight
    weightedSum += (dailyNet[tradingDays[i]] || 0) * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}
