import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = __dirname; // /app in container

const ANALYSIS_TRANSPORT = String(
  process.env.ML_ANALYSIS_TRANSPORT || "http",
).toLowerCase();
const ANALYSIS_GRPC_ADDR = String(
  process.env.ML_ANALYSIS_GRPC_ADDR || "analysis-service:50051",
).trim();
const ANALYSIS_GRPC_STRICT =
  String(process.env.ML_ANALYSIS_GRPC_STRICT || "false").toLowerCase() ===
  "true";
const ML_ENGINE_BASE = String(
  process.env.ML_ENGINE_URL ||
    process.env.ML_ENGINE_INTERNAL_URL ||
    "http://ml-engine:8001",
).trim();
const ANALYSIS_PROTO_PATH = resolve(
  REPO_ROOT,
  "proto",
  "ddd",
  "v1",
  "analysis.proto",
);

let _grpcClientPromise = null;

function normalizeFeatureMap(features) {
  const normalized = {};
  for (const [key, value] of Object.entries(features || {})) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      normalized[key] = num;
    }
  }
  return normalized;
}

function normalizeCandles(candles) {
  return (candles || []).map((candle) => ({
    symbol: String(candle.symbol || "MNQ"),
    timestamp: String(candle.timestamp || ""),
    open: Number(candle.open || 0),
    high: Number(candle.high || 0),
    low: Number(candle.low || 0),
    close: Number(candle.close || 0),
    volume: Number(candle.volume || 0),
  }));
}

function normalizeTrades(trades) {
  return (trades || []).map((trade) => ({
    symbol: String(trade.symbol || "MNQ"),
    direction: String(trade.direction || ""),
    entry_time: String(trade.entry_time || trade.entryTime || ""),
    exit_time: String(trade.exit_time || trade.exitTime || ""),
    pnl_ticks: Number(trade.pnl_ticks || trade.pnlTicks || 0),
    pnl_dollars: Number(trade.pnl_dollars || trade.pnlDollars || 0),
    result: String(trade.result || ""),
  }));
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function buildPredictIdempotencyKey(payload) {
  const digest = createHash("sha256")
    .update(stableStringify(payload || {}))
    .digest("hex");
  return `predict:${digest}`;
}

function transformGrpcConsensusResponse(response) {
  const votes = {};
  for (const [modelName, confidence] of Object.entries(
    response?.vote_confidences || {},
  )) {
    votes[modelName] = {
      model_name: modelName,
      confidence: Number(confidence || 0),
    };
  }

  return {
    signal: response?.signal || "NEUTRAL",
    confidence: Number(response?.confidence || 0.5),
    models_used: Number(response?.models_used || 0),
    data_trades_analyzed: Number(response?.data_trades_analyzed || 0),
    model_freshness: response?.model_freshness || "unknown",
    timing: response?.timing || {},
    votes,
    physics_regime: response?.regime ? { regime: response.regime } : null,
    transport: "grpc",
  };
}

async function getGrpcAnalysisClient() {
  if (_grpcClientPromise) {
    return _grpcClientPromise;
  }

  _grpcClientPromise = (async () => {
    const grpcModule = await import("@grpc/grpc-js");
    const protoLoaderModule = await import("@grpc/proto-loader");
    const grpc = grpcModule.default || grpcModule;
    const protoLoader = protoLoaderModule.default || protoLoaderModule;

    const packageDefinition = protoLoader.loadSync(ANALYSIS_PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [REPO_ROOT],
    });

    const loaded = grpc.loadPackageDefinition(packageDefinition);
    const analysisCtor = loaded?.traders?.ddd?.v1?.analysis?.AnalysisService;

    if (!analysisCtor) {
      throw new Error(
        "AnalysisService definition not found in proto/ddd/v1/analysis.proto",
      );
    }

    return new analysisCtor(
      ANALYSIS_GRPC_ADDR,
      grpc.credentials.createInsecure(),
    );
  })().catch((error) => {
    _grpcClientPromise = null;
    throw error;
  });

  return _grpcClientPromise;
}

function callGrpcGetConsensus(client, request, timeoutMs) {
  return new Promise((resolveCall, rejectCall) => {
    const deadline = new Date(Date.now() + timeoutMs);
    client.GetConsensus(request, { deadline }, (error, response) => {
      if (error) {
        rejectCall(error);
        return;
      }
      resolveCall(response);
    });
  });
}

async function callHttpPredict(payload, timeoutMs, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    "Content-Type": "application/json",
  };
  if (options.requestId) {
    headers["X-Request-ID"] = String(options.requestId);
  }
  headers["Idempotency-Key"] = String(
    options.idempotencyKey || buildPredictIdempotencyKey(payload),
  );

  try {
    const response = await fetch(`${ML_ENGINE_BASE}/predict`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `ML Engine ${response.status}: ${text || response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`ML Engine request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function predictConsensusTransport(
  payload,
  timeoutMs = 30_000,
  options = {},
) {
  if (ANALYSIS_TRANSPORT !== "grpc") {
    return await callHttpPredict(payload, timeoutMs, options);
  }

  try {
    const client = await getGrpcAnalysisClient();
    const request = {
      symbol: String(payload?.symbol || "MNQ"),
      session_id: Number(payload?.session_id || 1),
      features: normalizeFeatureMap(payload?.features || {}),
      candles: normalizeCandles(payload?.candles || []),
      trades: normalizeTrades(payload?.trades || []),
    };
    const response = await callGrpcGetConsensus(client, request, timeoutMs);
    return transformGrpcConsensusResponse(response);
  } catch (error) {
    if (ANALYSIS_GRPC_STRICT) {
      throw error;
    }

    const fallback = await callHttpPredict(payload, timeoutMs, options);
    return {
      ...fallback,
      transport: "http_fallback",
      transport_error: String(error?.message || error),
    };
  }
}

export function getAnalysisTransportConfig() {
  return {
    transport: ANALYSIS_TRANSPORT,
    grpc_address: ANALYSIS_GRPC_ADDR,
    grpc_strict: ANALYSIS_GRPC_STRICT,
  };
}
