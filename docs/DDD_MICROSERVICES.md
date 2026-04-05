# DDD Microservices Architecture (gRPC First)

This repo now supports a Domain-Driven Design boundary model with gRPC contracts for low-latency service-to-service communication.

## Bounded contexts

| Context | Service | Owns capability | Owns data/code |
|---|---|---|---|
| Ingestion | `ingestion-service` | Market data ingestion + persistence | `ml-engine/data`, `ml-engine/kafka` |
| Analysis | `analysis-service` | Real-time scoring + consensus | `ml-engine/inference`, `ml-engine/features`, `ml-engine/models`, `ml-engine/session` |
| Learning | `learning-service` | Retraining + drift + quality gates | `ml-engine/training`, `ml-engine/feedback`, `ml-engine/data_quality` |
| BFF Orchestration | `bff` | Frontend orchestration + anti-corruption layer | `bff/routes`, `bff/services`, `bff/domains` |

Source of truth manifest: `architecture/ddd/bounded-contexts.json`

## gRPC contracts

Contracts are versioned under `proto/ddd/v1/`:

- `common.proto`
- `ingestion.proto`
- `analysis.proto`
- `learning.proto`

These define inter-service APIs so each context can evolve independently without leaking internal models.

## Running service boundary

`analysis-service` now exists as a separate runtime process:

- gRPC port: `50051`
- health port: `8082`
- implementation entrypoint: `bff/analysis-server.mjs`

Today it acts as the extraction seam for the analysis context:

- BFF calls `analysis-service` over gRPC.
- `analysis-service` proxies the request into the existing ML Engine `/predict` endpoint.
- This keeps the public service contract stable while analysis logic is pulled out of the legacy HTTP monolith incrementally.

## BFF transport behavior

`bff/services/consensusEngine.mjs` now supports gRPC for prediction calls via `bff/services/analysisTransport.mjs`.

Environment variables:

- `ML_ANALYSIS_TRANSPORT=http|grpc` (code default: `http`)
- `ML_ANALYSIS_GRPC_ADDR` (default: `127.0.0.1:50051`)
- `ML_ANALYSIS_GRPC_STRICT=true|false` (default: `false`)

In the repo deployment manifests, the default is now `grpc` because `analysis-service` is wired into compose and Helm.

Behavior:

- `http`: BFF calls existing ML Engine HTTP `/predict`.
- `grpc`: BFF attempts gRPC `AnalysisService.GetConsensus`.
- If gRPC fails and strict mode is `false`, BFF falls back to HTTP automatically.

## Boundary enforcement

A CI-safe verifier is added:

```bash
node scripts/architecture/verify-ddd-boundaries.mjs
```

It enforces:

- Manifest-owned paths exist.
- `bff/domains` cannot import from `bff/services` or `bff/routes`.
- `bff/services` cannot import from `bff/routes`.

## Migration path (safe for beginners)

1. Run with `ML_ANALYSIS_TRANSPORT=grpc` and `ML_ANALYSIS_GRPC_STRICT=false` first.
2. If the gRPC service is unhealthy, BFF falls back to the legacy HTTP path automatically.
3. Turn on `ML_ANALYSIS_GRPC_STRICT=true` only after stability tests.
4. Replace the proxy internals of `analysis-service` with direct domain logic next.
5. Repeat the same extraction pattern for ingestion and learning services.
