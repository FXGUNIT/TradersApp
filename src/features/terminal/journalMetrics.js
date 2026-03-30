function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
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
  let runningPnl = 0;

  entries.forEach((entry, index) => {
    const phase = normalizeAmdPhase(entry?.amdPhase);
    const pnl = toNumber(entry?.pnl);
    const result = String(entry?.result || "").toLowerCase();

    const bucket = amdBreakdownMap[phase] || amdBreakdownMap.UNCLEAR;
    bucket.trades += 1;
    bucket.pnl += pnl;
    if (result === "win") bucket.wins += 1;
    if (result === "loss") bucket.losses += 1;

    runningPnl += pnl;
    equityCurve.push({
      index,
      tradeLabel: entry?.date ? String(entry.date) : `Trade ${index + 1}`,
      pnl,
      cumulativePnl: runningPnl,
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

  return {
    wins,
    losses,
    pnlTotal,
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
  };
}

export const EMPTY_JOURNAL_METRICS = computeJournalMetrics([]);

export function formatMetricNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(digits);
}
