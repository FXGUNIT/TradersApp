/**
 * Trade Return Calculator Routes — BFF routes for Monte Carlo trade simulation.
 *
 * Routes:
 *   POST /trade-calc/simulate  — run Monte Carlo equity curve simulation
 *
 * Service contract:
 *   Body:    { balance, nTrades, riskPct, rr, winRate }
 *   Response: { equityCurve, endBalance, roi, maxDrawdown, maxDrawdownPct,
 *               nWins, nLosses, avgGainPerTrade, latency_ms }
 *   Error:   { ok: false, error: string, latency_ms: number }
 */
import {
  validateParams,
  simulateEquityCurve,
} from "../services/tradeCalcService.mjs";

export function createTradeCalcRouteHandler({
  json,
  readJsonBody,
}) {
  return async function handleTradeCalcRoute(req, res, url, origin) {
    const pathname = url.pathname;

    // POST /trade-calc/simulate
    if (req.method === "POST" && pathname === "/trade-calc/simulate") {
      const startedAt = Date.now();
      try {
        /** @type {{ balance?: number, nTrades?: number, riskPct?: number, rr?: number, winRate?: number }} */
        let body;
        try {
          body = await readJsonBody(req, 10_000);
        } catch {
          const latency_ms = Date.now() - startedAt;
          json(res, 400, { ok: false, error: "Invalid JSON body", latency_ms }, origin);
          return true;
        }

        const { balance, nTrades, riskPct, rr, winRate } = body ?? {};

        // Input validation
        const validation = validateParams({ balance, nTrades, riskPct, rr, winRate });
        if (!validation.ok) {
          const latency_ms = Date.now() - startedAt;
          json(res, 400, { ok: false, error: validation.error, latency_ms }, origin);
          return true;
        }

        // Run simulation (pure sync math — no I/O)
        const result = simulateEquityCurve({ balance, nTrades, riskPct, rr, winRate });

        const latency_ms = Date.now() - startedAt;
        json(res, 200, { ok: true, ...result, latency_ms }, origin);
        return true;
      } catch (err) {
        const latency_ms = Date.now() - startedAt;
        json(res, 500, { ok: false, error: "Trade calculation service unavailable.", latency_ms }, origin);
        return true;
      }
    }

    return false;
  };
}

export default createTradeCalcRouteHandler;
