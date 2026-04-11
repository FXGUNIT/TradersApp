/**
 * Trade Return Calculator — pure math utilities
 * All functions are synchronous and side-effect free.
 */

/**
 * Kelly criterion fraction = (WR × R:R - (1 - WR)) / R:R
 * @param {number} winRate  — decimal, e.g. 0.35 for 35%
 * @param {number} rr       — reward-to-risk ratio, e.g. 2.0 for 1:2
 * @returns {number} kelly fraction in [0, 1], clamped
 */
export function kelly(winRate, rr) {
  if (rr <= 0) return 0;
  return Math.max(0, Math.min(1, (winRate * rr - (1 - winRate)) / rr));
}

/**
 * Win and loss dollar amounts per trade.
 * @param {number} balance  — current account balance
 * @param {number} riskPct   — risk as decimal, e.g. 0.003 for 0.3%
 * @param {number} rr        — reward-to-risk ratio
 * @returns {{ win: number, loss: number }}
 */
export function tradePnL(balance, riskPct, rr) {
  const risk = balance * riskPct;
  return { win: risk * rr, loss: -risk };
}

/**
 * Monte Carlo equity curve simulation.
 * @param {object} params
 * @param {number} params.balance   — starting account balance
 * @param {number} params.nTrades   — number of trades to simulate
 * @param {number} params.riskPct   — risk per trade as decimal (0.003 = 0.3%)
 * @param {number} params.rr       — reward-to-risk ratio (2.0 = 1:2)
 * @param {number} params.winRate  — win rate as decimal (0.35 = 35%)
 * @returns {object} simulation results
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
  const roi = ((endBalance - startBal) / startBal) * 100;
  const avgGainPerTrade = (endBalance - startBal) / nTrades;

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
