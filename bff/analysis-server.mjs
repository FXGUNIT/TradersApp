import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const PROTO_PATH = resolve(REPO_ROOT, "proto", "ddd", "v1", "analysis.proto");

function loadEnvFiles() {
  const cwd = process.cwd();
  const searchDirs = [cwd, resolve(cwd, "..")];
  const files = [".env", ".env.local"];
  const shellDefined = new Set(Object.keys(process.env));
  const fileDefined = new Set();

  for (const dir of searchDirs) {
    for (const fileName of files) {
      const filePath = resolve(dir, fileName);
      if (!existsSync(filePath)) {
        continue;
      }

      const content = readFileSync(filePath, "utf8");
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          return;
        }

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex <= 0) {
          return;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        if (!shellDefined.has(key) || fileDefined.has(key)) {
          process.env[key] = value;
          fileDefined.add(key);
        }
      });
    }
  }
}

loadEnvFiles();

const GRPC_PORT = Number(process.env.ANALYSIS_SERVICE_GRPC_PORT || 50051);
const HEALTH_PORT = Number(process.env.ANALYSIS_SERVICE_HEALTH_PORT || 8082);
const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://127.0.0.1:8001";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [REPO_ROOT],
});

const grpcDefinition = grpc.loadPackageDefinition(packageDefinition);
const analysisPackage = grpcDefinition?.traders?.ddd?.v1?.analysis;

if (!analysisPackage?.AnalysisService?.service) {
  throw new Error("Failed to load AnalysisService gRPC definition.");
}

function numberMap(values) {
  const mapped = {};
  for (const [key, value] of Object.entries(values || {})) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      mapped[key] = num;
    }
  }
  return mapped;
}

function stringMap(values) {
  const mapped = {};
  for (const [key, value] of Object.entries(values || {})) {
    if (value === null || value === undefined) {
      continue;
    }
    mapped[key] = String(value);
  }
  return mapped;
}

function toPredictPayload(request) {
  return {
    symbol: String(request?.symbol || "MNQ"),
    session_id: Number(request?.session_id || 1),
    candles: Array.isArray(request?.candles) ? request.candles : [],
    trades: Array.isArray(request?.trades) ? request.trades : [],
    math_engine_snapshot: numberMap(request?.features || {}),
    key_levels: {},
  };
}

function toGrpcConsensusResponse(payload) {
  const voteConfidences = {};
  for (const [modelName, vote] of Object.entries(payload?.votes || {})) {
    const confidence = Number(vote?.confidence);
    if (Number.isFinite(confidence)) {
      voteConfidences[modelName] = confidence;
    }
  }

  const regimeValue =
    typeof payload?.physics_regime === "string"
      ? payload.physics_regime
      : payload?.physics_regime?.regime || "";

  return {
    signal: String(payload?.signal || "NEUTRAL"),
    confidence: Number(payload?.confidence || 0.5),
    models_used: Number(payload?.models_used || Object.keys(payload?.votes || {}).length || 0),
    data_trades_analyzed: Number(payload?.data_trades_analyzed || 0),
    model_freshness: String(payload?.model_freshness || "unknown"),
    timing: stringMap(payload?.timing || {}),
    vote_confidences: voteConfidences,
    regime: String(regimeValue),
  };
}

async function mlEnginePredict(request) {
  const response = await fetch(`${ML_ENGINE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toPredictPayload(request)),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ML Engine ${response.status}: ${text || response.statusText}`);
  }

  return await response.json();
}

async function mlEngineHealth() {
  const response = await fetch(`${ML_ENGINE_URL}/health`);
  if (!response.ok) {
    throw new Error(`ML Engine ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

function health(call, callback) {
  callback(null, {
    ok: true,
    service: "analysis-service",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
}

async function getConsensus(call, callback) {
  try {
    const prediction = await mlEnginePredict(call.request);
    callback(null, toGrpcConsensusResponse(prediction));
  } catch (error) {
    callback({
      code: grpc.status.UNAVAILABLE,
      message: error?.message || "analysis-service unavailable",
    });
  }
}

function startGrpcServer() {
  const server = new grpc.Server();
  server.addService(analysisPackage.AnalysisService.service, {
    GetConsensus: getConsensus,
    Health: health,
  });

  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error) => {
      if (error) {
        throw error;
      }
      server.start();
      console.log(`[analysis-service] gRPC listening on 0.0.0.0:${GRPC_PORT}`);
    },
  );

  return server;
}

function startHealthServer() {
  const server = createHttpServer(async (req, res) => {
    if (!req.url || req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          service: "analysis-service",
          grpc_port: GRPC_PORT,
          ml_engine_url: ML_ENGINE_URL,
        }),
      );
      return;
    }

    if (req.url === "/health") {
      try {
        const upstream = await mlEngineHealth();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            service: "analysis-service",
            upstream,
          }),
        );
      } catch (error) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: false,
            service: "analysis-service",
            error: error?.message || "health check failed",
          }),
        );
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });

  server.listen(HEALTH_PORT, "0.0.0.0", () => {
    console.log(`[analysis-service] health HTTP listening on 0.0.0.0:${HEALTH_PORT}`);
  });

  return server;
}

const grpcServer = startGrpcServer();
const healthServer = startHealthServer();

function shutdown(signal) {
  console.log(`[analysis-service] shutting down on ${signal}`);
  healthServer.close(() => {});
  grpcServer.tryShutdown(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

