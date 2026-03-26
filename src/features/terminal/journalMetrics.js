function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
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
  };
}

export function formatMetricNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(digits);
}
