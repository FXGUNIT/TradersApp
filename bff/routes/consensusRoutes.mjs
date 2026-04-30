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
  triggerMLNewsTraining,
  getMLNewsReactions,
} from "../services/consensusEngine.mjs";
import { fetchBreakingNews } from "../services/breakingNewsService.mjs";
import {
  recordSuccess as cbRecordSuccess,
  recordFailure as cbRecordFailure,
  isOpen as cbIsOpen,
  shouldAllowRequest as cbShouldAllowRequest,
} from "../services/circuitBreakerRegistry.mjs";
import {
  resolveInstrumentSymbol,
  getInstrumentConfig,
} from "../services/instrumentRegistry.mjs";

export function createConsensusRouteHandler({
  json,
  readJsonBody,
}) {
  return async function handleConsensusRoute(req, res, url, origin) {
    const pathname = url.pathname;
    const requestId = req.id || req.requestId || null;
    const idempotencyKey = req.headers["idempotency-key"] || null;

    // GET /ml/consensus
    if (req.method === "GET" && pathname === "/ml/consensus") {
      try {
        const rawSymbol = url.searchParams.get("symbol") || "MNQ";
        const symbol = resolveInstrumentSymbol(rawSymbol);

        // Per-instrument circuit breaker check
        if (!cbShouldAllowRequest(symbol)) {
          json(res, 503, {
            ok: false,
            error: "Circuit open for this instrument",
            instrument: symbol,
            circuitBreaker: cbIsOpen(symbol) ? "open" : "closed",
          }, origin);
          return true;
        }

        const mathEngine = _parseQueryJson(url.searchParams.get("mathEngine"));
        const recentCandles = _parseQueryJson(url.searchParams.get("candles")) || [];
        const keyLevels = _parseQueryJson(url.searchParams.get("keyLevels")) || {};
        const sessionId = parseInt(url.searchParams.get("session") || "1", 10);

        // Fetch ML consensus + breaking news in parallel (news non-blocking, 3s timeout)
        let result;
        let consensusError = null;
        try {
          result = await getMlConsensus({
            mathEngine,
            recentCandles,
            keyLevels,
            sessionId: isNaN(sessionId) ? 1 : sessionId,
            symbol,
            requestId,
            idempotencyKey,
          });
          cbRecordSuccess(symbol);
        } catch (err) {
          consensusError = err;
          cbRecordFailure(symbol);
          throw err;
        }

        const newsResult = await fetchBreakingNews({ maxItems: 15, minImpact: 'LOW' }).catch(() => ({ items: [], total: 0 }));

        // Merge breaking news into consensus response
        result.breaking_news = {
          items: newsResult.items || [],
          total: newsResult.total || 0,
          highImpactCount: newsResult.highImpactCount || 0,
          sources: newsResult.sources || {},
          fetchedAt: newsResult.fetchedAt || new Date().toISOString(),
        };

        // Compute news bias for this session
        if (newsResult.items?.length > 0) {
          const bullish = newsResult.items.filter(i => i.sentiment === 'bullish').length;
          const bearish = newsResult.items.filter(i => i.sentiment === 'bearish').length;
          result.news_sentiment = {
            bullish,
            bearish,
            neutral: newsResult.items.length - bullish - bearish,
            bias: bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral',
            highImpactCount: newsResult.highImpactCount,
          };
          // Sentiment-adjusted confidence: reduce if strong opposing sentiment
          if (result.confidence && result.news_sentiment.bias !== 'neutral') {
            const opposing = result.signal === 'LONG'
              ? (result.news_sentiment.bias === 'bearish')
              : (result.news_sentiment.bias === 'bullish');
            if (opposing && result.news_sentiment.highImpactCount > 0) {
              result.confidence = Math.max(0.3, result.confidence - 0.15);
              result.confidenceNote = 'Reduced due to opposing high-impact news sentiment';
            }
          }
        }

        // Fire-and-forget: trigger ML self-training on HIGH impact news
        // (non-blocking — doesn't delay the consensus response)
        const highImpactItems = newsResult.items?.filter(i => i.impact === 'HIGH') || [];
        for (const [index, item] of highImpactItems.slice(0, 2).entries()) {
          triggerMLNewsTraining(item, {
            requestId: requestId ? `${requestId}:news:${index}` : null,
          }).catch(() => {});
        }

        // Include recent news reactions for ML training context
        const newsReactions = await getMLNewsReactions(30, {
          requestId,
        }).catch(() => ({ ok: false, entries: [] }));
        result.news_reactions = {
          entries: newsReactions.entries || [],
          total: newsReactions.total || 0,
          avg_alpha_ticks: newsReactions.avg_alpha_ticks || 0,
          validated_pct: newsReactions.validated_pct || 0,
        };

        // Attach per-instrument metadata
        result.instrument = getInstrumentConfig(symbol);
        result.circuitBreakerState = cbIsOpen(symbol) ? "open" : "closed";

        json(res, result.ok ? 200 : 503, result, origin);
        return true;
      } catch (err) {
        console.error('[consensusRoutes] /ml/consensus error:', err?.message, err?.stack);
        json(res, 500, { ok: false, error: 'Consensus service unavailable.' }, origin);
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
        console.error('[consensusRoutes] ML route error:', err?.message, err?.stack);
        json(res, 500, { ok: false, error: 'ML service unavailable.' }, origin);
        return true;
      }
    }

    // POST /ml/train
    if (req.method === "POST" && pathname === "/ml/train") {
      try {
        const body = await readJsonBody(req, 100_000);
        const mode = body?.mode || "incremental";
        const result = await triggerMlTraining(mode, {
          requestId,
          idempotencyKey,
        });
        json(res, 200, result, origin);
        return true;
      } catch (err) {
        console.error('[consensusRoutes] ML route error:', err?.message, err?.stack);
        json(res, 500, { ok: false, error: 'ML service unavailable.' }, origin);
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
        console.error('[consensusRoutes] ML route error:', err?.message, err?.stack);
        json(res, 500, { ok: false, error: 'ML service unavailable.' }, origin);
        return true;
      }
    }

    // GET /ml/regime — full physics-based regime (HMM + FP-FK + Tsallis q + Hurst)
    if (req.method === "GET" && pathname === "/ml/regime") {
      try {
        const rawSymbol = url.searchParams.get("symbol") || "MNQ";
        const symbol = resolveInstrumentSymbol(rawSymbol);

        if (!cbShouldAllowRequest(symbol)) {
          json(res, 503, {
            ok: false,
            error: "Circuit open for this instrument",
            instrument: symbol,
            circuitBreaker: cbIsOpen(symbol) ? "open" : "closed",
          }, origin);
          return true;
        }

        const candles = _parseQueryJson(url.searchParams.get("candles")) || [];
        let result;
        try {
          result = await getPhysicsRegime(candles, { requestId });
          cbRecordSuccess(symbol);
        } catch (err) {
          cbRecordFailure(symbol);
          throw err;
        }
        result.circuitBreakerState = cbIsOpen(symbol) ? "open" : "closed";
        json(res, result.ok !== false ? 200 : 503, result, origin);
        return true;
      } catch (err) {
        console.error('[consensusRoutes] ML route error:', err?.message, err?.stack);
        json(res, 500, { ok: false, error: 'ML service unavailable.' }, origin);
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
