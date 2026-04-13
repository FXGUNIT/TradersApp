import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import grpc from "@grpc/grpc-js";
import {
  createHealthServer,
  health,
  getConsensus,
  getRegime,
  getModelStatus,
  triggerTraining,
  startMlHealthCheck,
} from "./analysisMiddleware.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

// ─── gRPC Service Definition ───────────────────────────────────────────────────
//
// Strategy: Use generated stubs when available (npm run generate-grpc),
// fall back to runtime proto loading for local development.
//
// Generated stubs path:  bff/generated/ddd/v1/analysis_pb2_grpc.js
// Proto source path:     proto/ddd/v1/analysis.proto
//
// To regenerate stubs:
//   cd bff && npm run generate-grpc
//
// Generated stubs export (CommonJS):
//   exports.AnalysisServiceClient  — for making outbound gRPC calls
//   exports.AnalysisServiceService — for server-side service definition
//     └── .service property gives the ServiceDefinition for addService()
// ───────────────────────────────────────────────────────────────────────────────

const PROTO_PATH = resolve(REPO_ROOT, "proto", "ddd", "v1", "analysis.proto");
const GENERATED_STUB_PATH = resolve(
  __dirname, "generated", "ddd", "v1", "analysis_pb2_grpc.js",
);

let analysisServiceDef = null;

async function loadGrpcDefinition() {
  const stubCandidates = [
    {
      stubPath: "./generated/ddd/v1/analysis_pb2_grpc.mjs",
      requiredFiles: [
        "generated/ddd/v1/analysis_pb2_grpc.mjs",
        "generated/ddd/v1/analysis_pb2_grpc.js",
        "generated/ddd/v1/analysis_pb2.js",
      ],
    },
    {
      stubPath: "./generated/ddd/v1/analysis_pb2_grpc.js",
      requiredFiles: ["generated/ddd/v1/analysis_pb2_grpc.js"],
    },
  ];
  for (const { stubPath, requiredFiles } of stubCandidates) {
    if (requiredFiles.every((filePath) => existsSync(resolve(__dirname, filePath)))) {
      try {
        const mod = await import(stubPath);
        analysisServiceDef = mod.AnalysisServiceService?.service;
        if (analysisServiceDef) {
          console.log("[analysis-server] Using pre-generated gRPC stubs");
          return;
        }
      } catch (err) {
        console.warn(`[analysis-server] Stub load failed (${stubPath}): ${err.message}`);
      }
    }
  }

  const protoLoader = (await import("@grpc/proto-loader")).default;
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String,
    defaults: true, oneofs: true, includeDirs: [REPO_ROOT],
  });
  const grpcDef = grpc.loadPackageDefinition(packageDefinition);
  analysisServiceDef = grpcDef?.traders?.ddd?.v1?.analysis?.AnalysisService?.service;
  if (!analysisServiceDef) {
    throw new Error(
      "Failed to load AnalysisService gRPC definition.\n" +
      "Run: npm run generate-grpc  (cd bff && npm run generate-grpc)",
    );
  }
  console.log("[analysis-server] Using runtime proto loading (stubs not generated)");
}

// ─── Environment loader ───────────────────────────────────────────────────────

function loadEnvFiles() {
  const cwd = process.cwd();
  const searchDirs = [cwd, resolve(cwd, "..")];
  const files = [".env", ".env.local"];
  const shellDefined = new Set(Object.keys(process.env));
  const fileDefined = new Set();

  for (const dir of searchDirs) {
    for (const fileName of files) {
      const filePath = resolve(dir, fileName);
      if (!existsSync(filePath)) continue;

      const content = readFileSync(filePath, "utf8");
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;

        const sepIdx = trimmed.indexOf("=");
        if (sepIdx <= 0) return;

        const key = trimmed.slice(0, sepIdx).trim();
        let value = trimmed.slice(sepIdx + 1).trim();
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

// ─── Config ──────────────────────────────────────────────────────────────────

const GRPC_PORT = Number(process.env.ANALYSIS_SERVICE_GRPC_PORT || 50051);
const HEALTH_PORT = Number(process.env.ANALYSIS_SERVICE_HEALTH_PORT || 8082);
const ML_ENGINE_URL = String(
  process.env.ML_ENGINE_URL || process.env.ML_ENGINE_INTERNAL_URL || "http://ml-engine:8001",
).trim();

// ─── Startup ──────────────────────────────────────────────────────────────────

let healthServer = null;
let grpcServer = null;

loadGrpcDefinition()
  .then(() => {
    // gRPC server
    grpcServer = new grpc.Server();
    grpcServer.addService(analysisServiceDef, {
      Health: health,
      GetConsensus: getConsensus,
      GetRegime: getRegime,
      GetModelStatus: getModelStatus,
      TriggerTraining: triggerTraining,
    });

    grpcServer.bindAsync(
      `0.0.0.0:${GRPC_PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (error) => {
        if (error) throw error;
        console.log(`[analysis-service] gRPC listening on 0.0.0.0:${GRPC_PORT}`);
      },
    );

    // Health HTTP server
    healthServer = createHealthServer(HEALTH_PORT, GRPC_PORT, ML_ENGINE_URL);

    // Periodic ML Engine health check
    startMlHealthCheck(10_000);
  })
  .catch((err) => {
    console.error("[analysis-server] Failed to initialize gRPC:", err.message);
    process.exit(1);
  });

// ─── Shutdown ─────────────────────────────────────────────────────────────────

function shutdown(signal) {
  console.log(`[analysis-service] shutting down on ${signal}`);
  if (healthServer) healthServer.close(() => {});
  if (grpcServer) {
    grpcServer.tryShutdown(() => { process.exit(0); });
  }
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
