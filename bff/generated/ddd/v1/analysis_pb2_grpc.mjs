/**
 * ESM wrapper for generated gRPC stubs.
 *
 * Generated stubs (CommonJS) are at:
 *   bff/generated/ddd/v1/analysis_pb2_grpc.js
 *   bff/generated/ddd/v1/analysis_pb2.js
 *
 * This wrapper re-exports them as ESM for use in analysis-server.mjs.
 *
 * Regenerate stubs:
 *   cd bff && npm run generate-grpc
 */

// Dynamic import of CommonJS stubs — Node.js ESM handles CJS interop automatically
const grpcJs = await import("@grpc/grpc-js");
const analysis_pb2 = await import("./analysis_pb2.js");
const analysis_pb2_grpc = await import("./analysis_pb2_grpc.js");

export const {
  // Analysis service (from proto/ddd/v1/analysis.proto)
  AnalysisServiceClient,
  AnalysisServiceService,
} = analysis_pb2_grpc;

export {
  // Common message types
  GetConsensusRequest,
  GetConsensusResponse,
  GetRegimeRequest,
  GetRegimeResponse,
  GetModelStatusRequest,
  GetModelStatusResponse,
  TriggerTrainingRequest,
  TriggerTrainingResponse,
  // etc.
} from "./analysis_pb2.js";

export { grpcJs };
