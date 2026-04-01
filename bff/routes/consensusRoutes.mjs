/**
 * Consensus Routes — BFF routes for ML Consensus endpoint.
 *
 * Routes:
 *   GET  /ml/consensus      — full consensus signal
 *   GET  /ml/status          — ML model status
 *   POST /ml/train           — trigger training
 *   GET  /ml/health          — ML Engine health check
 */
import {
  getMlConsensus,
  getMlModelStatus,
  triggerMlTraining,
  checkMlHealth,
  getPhysicsRegime,
} from "../services/consensusEngine.mjs";

export function createConsensusRouteHandler({
  json,
  readJsonBody,
}) {
  return async function handleConsensusRoute(req, res, url, origin) {
    const pathname = url.pathname;

    // GET /ml/consensus
    if (req.method === "GET" && pathname === "/ml/consensus") {
      try {
        const mathEngine = _parseQueryJson(url.searchParams.get("mathEngine"));
        const recentCandles = _parseQueryJson(url.searchParams.get("candles")) || [];
        const keyLevels = _parseQueryJson(url.searchParams.get("keyLevels")) || {};
        const sessionId = parseInt(url.searchParams.get("session") || "1", 10);
        const symbol = url.searchParams.get("symbol") || "MNQ";

        const result = await getMlConsensus({
          mathEngine,
          recentCandles,
          keyLevels,
          sessionId: isNaN(sessionId) ? 1 : sessionId,
          symbol,
        });

        json(res, result.ok ? 200 : 503, result, origin);
        return true;
      } catch (err) {
        json(res, 500, { ok: false, error: err.message }, origin);
        return true;
      }
    }

    // GET /ml/status
    if (req.method === "GET" && pathname === "/ml/status") {
      try {
        const result = await getMlModelStatus();
        json(res, 200, result, origin);
        return true;
      } catch (err) {
        json(res, 500, { ok: false, error: err.message }, origin);
        return true;
      }
    }

    // POST /ml/train
    if (req.method === "POST" && pathname === "/ml/train") {
      try {
        const body = await readJsonBody(req, 100_000);
        const mode = body?.mode || "incremental";
        const result = await triggerMlTraining(mode);
        json(res, 200, result, origin);
        return true;
      } catch (err) {
        json(res, 500, { ok: false, error: err.message }, origin);
        return true;
      }
    }

    // GET /ml/health
    if (req.method === "GET" && pathname === "/ml/health") {
      try {
        const result = await checkMlHealth();
        json(res, result.ok ? 200 : 503, result, origin);
        return true;
      } catch (err) {
        json(res, 500, { ok: false, error: err.message }, origin);
        return true;
      }
    }

    // GET /ml/regime — full physics-based regime (HMM + FP-FK + Tsallis q + Hurst)
    if (req.method === "GET" && pathname === "/ml/regime") {
      try {
        const candles = _parseQueryJson(url.searchParams.get("candles")) || [];
        const result = await getPhysicsRegime(candles);
        json(res, result.ok !== false ? 200 : 503, result, origin);
        return true;
      } catch (err) {
        json(res, 500, { ok: false, error: err.message }, origin);
        return true;
      }
    }

    return false;
  };
}

function _parseQueryJson(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export default createConsensusRouteHandler;
