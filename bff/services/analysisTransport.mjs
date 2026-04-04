import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");

const ANALYSIS_TRANSPORT = String(
  process.env.ML_ANALYSIS_TRANSPORT || "http",
).toLowerCase();
const ANALYSIS_GRPC_ADDR = process.env.ML_ANALYSIS_GRPC_ADDR || "127.0.0.1:50051";
const ANALYSIS_GRPC_STRICT =
  String(process.env.ML_ANALYSIS_GRPC_STRICT || "false").toLowerCase() === "true";
const ML_ENGINE_BASE = process.env.ML_ENGINE_URL || "http://127.0.0.1:8001";
const ANALYSIS_PROTO_PATH = resolve(REPO_ROOT, "proto", "ddd", "v1", "analysis.proto");

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
    physics_regime: response?.regime || null,
    transport: "grpc",
  };
}

async function getGrpcAnalysisClient() {
  if (_grpcClientPromise) {
    return _grpcClientPromise;
  }

  _grpcClientPromise = (async () => {
    const grpc = await import("@grpc/grpc-js");
    const protoLoader = await import("@grpc/proto-loader");

    const packageDefinition = protoLoader.loadSync(ANALYSIS_PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [REPO_ROOT],
    });

    const loaded = grpc.loadPackageDefinition(packageDefinition);
    const analysisCtor =
      loaded?.traders?.ddd?.v1?.analysis?.AnalysisService;

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

async function callHttpPredict(payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${ML_ENGINE_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`ML Engine ${response.status}: ${text || response.statusText}`);
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

export async function predictConsensusTransport(payload, timeoutMs = 30_000) {
  if (ANALYSIS_TRANSPORT !== "grpc") {
    return await callHttpPredict(payload, timeoutMs);
  }

  try {
    const client = await getGrpcAnalysisClient();
    const request = {
      symbol: String(payload?.symbol || "MNQ"),
      session_id: Number(payload?.session || 1),
      features: normalizeFeatureMap(payload?.features || {}),
      candles: normalizeCandles(payload?.candles || []),
      trades: [],
    };
    const response = await callGrpcGetConsensus(client, request, timeoutMs);
    return transformGrpcConsensusResponse(response);
  } catch (error) {
    if (ANALYSIS_GRPC_STRICT) {
      throw error;
    }

    const fallback = await callHttpPredict(payload, timeoutMs);
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

