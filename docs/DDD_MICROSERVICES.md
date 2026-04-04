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

## BFF transport behavior

`bff/services/consensusEngine.mjs` now supports gRPC for prediction calls via `bff/services/analysisTransport.mjs`.

Environment variables:

- `ML_ANALYSIS_TRANSPORT=http|grpc` (default: `http`)
- `ML_ANALYSIS_GRPC_ADDR` (default: `127.0.0.1:50051`)
- `ML_ANALYSIS_GRPC_STRICT=true|false` (default: `false`)

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

1. Keep production on HTTP (`ML_ANALYSIS_TRANSPORT=http`).
2. Implement `analysis-service` gRPC server for `proto/ddd/v1/analysis.proto`.
3. Run staging with `ML_ANALYSIS_TRANSPORT=grpc`.
4. Turn on `ML_ANALYSIS_GRPC_STRICT=true` only after stability tests.
5. Repeat for ingestion and learning services.

