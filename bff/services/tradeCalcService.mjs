/**
 * Trade Return Calculator — BFF service layer
 * Pure synchronous math. No I/O, no side-effects.
 * Ported from ml-engine/optimization/position_sizer.py kelly_criterion + Monte Carlo simulation.
 */

/**
 * Kelly criterion fraction = (winRate × rr - (1 - winRate)) / rr
 * Clamped to [0, 1].
 * @param {number} winRate — decimal, e.g. 0.35 for 35%
 * @param {number} rr — reward-to-risk ratio, e.g. 2.0 for 1:2
 * @returns {number} kelly fraction in [0, 1]
 */
export function kelly(winRate, rr) {
  if (!Number.isFinite(winRate) || !Number.isFinite(rr) || rr <= 0) return 0;
  return Math.max(0, Math.min(1, (winRate * rr - (1 - winRate)) / rr));
}

/**
 * Win and loss dollar amounts per trade.
 * @param {number} balance — current account balance
 * @param {number} riskPct — risk as decimal, e.g. 0.003 for 0.3%
 * @param {number} rr — reward-to-risk ratio
 * @returns {{ win: number, loss: number }}
 */
export function tradePnL(balance, riskPct, rr) {
  if (!Number.isFinite(balance) || !Number.isFinite(riskPct) || !Number.isFinite(rr)) {
    return { win: 0, loss: 0 };
  }
  const risk = balance * riskPct;
  return { win: risk * rr, loss: -risk };
}

/**
 * Validate simulation input parameters.
 * @param {object} params
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateParams({ balance, nTrades, riskPct, rr, winRate }) {
  if (balance == null || !Number.isFinite(balance) || balance <= 0) {
    return { ok: false, error: "balance must be a positive number" };
  }
  if (nTrades == null || !Number.isFinite(nTrades) || nTrades < 1 || nTrades > 100_000) {
    return { ok: false, error: "nTrades must be an integer between 1 and 100,000" };
  }
  if (riskPct == null || !Number.isFinite(riskPct) || riskPct <= 0 || riskPct > 1) {
    return { ok: false, error: "riskPct must be a number between 0 (exclusive) and 1 (inclusive)" };
  }
  if (rr == null || !Number.isFinite(rr) || rr <= 0) {
    return { ok: false, error: "rr must be a positive number" };
  }
  if (winRate == null || !Number.isFinite(winRate) || winRate < 0 || winRate > 1) {
    return { ok: false, error: "winRate must be a number between 0 and 1" };
  }
  return { ok: true };
}

/**
 * Monte Carlo equity curve simulation.
 * @param {object} params
 * @param {number} params.balance — starting account balance
 * @param {number} params.nTrades — number of trades to simulate
 * @param {number} params.riskPct — risk per trade as decimal (0.003 = 0.3%)
 * @param {number} params.rr — reward-to-risk ratio (2.0 = 1:2)
 * @param {number} params.winRate — win rate as decimal (0.35 = 35%)
 * @returns {object} simulation result matching service contract
 */
export function simulateEquityCurve({ balance, nTrades, riskPct, rr, winRate }) {
  const equityCurve = [balance];
  let b = balance;
  let peak = balance;
  let maxDD = 0;
  let maxDDPct = 0;
  let nWins = 0;
  let nLosses = 0;
  const risk = b * riskPct;

  for (let i = 0; i < nTrades; i++) {
    const isWin = Math.random() < winRate;
    const pnl = isWin ? risk * rr : -risk;
    b += pnl;
    if (b > peak) peak = b;
    const dd = peak > 0 ? (peak - b) / peak : 0;
    if (dd > maxDDPct) {
      maxDD = dd * peak;
      maxDDPct = dd;
    }
    if (isWin) nWins++; else nLosses++;
    equityCurve.push(b);
  }

  const startBal = equityCurve[0];
  const endBalance = equityCurve[equityCurve.length - 1];
  const roi = startBal > 0 ? ((endBalance - startBal) / startBal) * 100 : 0;
  const avgGainPerTrade = nTrades > 0 ? (endBalance - startBal) / nTrades : 0;

  return {
    equityCurve,
    endBalance,
    roi,
    maxDrawdown: maxDD,
    maxDrawdownPct: maxDDPct * 100,
    nWins,
    nLosses,
    avgGainPerTrade,
  };
}
