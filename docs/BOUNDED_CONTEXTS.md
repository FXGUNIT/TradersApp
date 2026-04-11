# TradersApp - Bounded Contexts And DDD Architecture

**Last Updated:** 2026-04-12
**Canonical manifest:** `architecture/ddd/bounded-contexts.json`

This document now follows one rule:

- If this page and `architecture/ddd/bounded-contexts.json` disagree, the JSON manifest wins.

## Canonical Context List

These are the only bounded contexts that should currently be treated as canonical in the repo.

| Context | Service | Status | Owns capability | Primary owned paths |
| --- | --- | --- | --- | --- |
| `bff-orchestration` | `bff` | Live | Frontend orchestration and anti-corruption translation | `bff/routes`, `bff/services`, `bff/domains` |
| `analysis` | `analysis-service` | Live extraction seam | Low-latency scoring and consensus generation | `proto/ddd/v1/analysis.proto`, `bff/analysis-server.mjs`, `ml-engine/inference`, `ml-engine/features`, `ml-engine/models`, `ml-engine/session` |
| `ingestion` | `ingestion-service` contract | Logical only | Market data ingestion and persistence | `proto/ddd/v1/ingestion.proto`, `ml-engine/data`, `ml-engine/kafka` |
| `learning` | `learning-service` contract | Logical only | Self-learning, drift control, retraining | `proto/ddd/v1/learning.proto`, `ml-engine/training`, `ml-engine/feedback`, `ml-engine/data_quality` |

## Current Runtime Shape

- Frontend and Telegram-facing flows terminate at the BFF over HTTP.
- The BFF talks to `analysis-service` over gRPC when `ML_ANALYSIS_TRANSPORT=grpc`.
- `analysis-service` currently proxies into ML Engine HTTP `/predict`.
- Ingestion and learning are not yet independent deployed services.
- Feast is a shared data-plane capability, not a standalone bounded-context service in the canonical manifest.

## Current Interaction Model

### 1. Frontend and edge flow

1. Frontend calls the BFF.
2. BFF performs auth/session/routing/orchestration concerns.
3. BFF calls `analysis-service` over gRPC when enabled.
4. BFF can still fall back to direct ML Engine HTTP when gRPC strict mode is off.

### 2. Analysis flow

1. `analysis-service` receives the stable consensus contract from the BFF.
2. It validates and normalizes that contract.
3. It calls the ML Engine over HTTP `/predict`.
4. It returns a stable response shape back over gRPC.

### 3. Ingestion flow

- Ingestion logic currently lives inside `ml-engine/data` and `ml-engine/kafka`.
- `proto/ddd/v1/ingestion.proto` defines the contract boundary for future extraction.
- This boundary is logical today, not a separately deployed runtime.

### 4. Learning flow

- Learning logic currently lives inside `ml-engine/training`, `ml-engine/feedback`, `ml-engine/data_quality`, and Airflow DAGs.
- `proto/ddd/v1/learning.proto` defines the contract boundary for future extraction.
- This boundary is logical today, not a separately deployed runtime.

## Service Contracts Present In Repo

| Proto | Purpose | Current runtime reality |
| --- | --- | --- |
| `proto/ddd/v1/analysis.proto` | Consensus/regime/model-status contract | Used by the `analysis-service` seam today |
| `proto/ddd/v1/ingestion.proto` | Ingestion boundary contract | Contract only today |
| `proto/ddd/v1/learning.proto` | Learning/retraining/drift boundary contract | Contract only today |

## What Is Not Canonical Today

The following names should not be described as current live bounded-context services:

- `SignalDeliveryService`
- `portfolio-service`
- `PortfolioSvc`
- `data-ingestion-service`

Those names either do not exist as current repo services or describe future candidates rather than live boundaries.

## Actual Anti-Corruption Layer

The current anti-corruption layer is primarily the BFF:

- It translates frontend-facing request/response shapes.
- It isolates the frontend from gRPC and ML internals.
- It owns fallback behavior between gRPC and HTTP analysis transport.
- It is the correct place to keep temporary protocol adaptation while extraction is still in progress.

## Shared Platform Capabilities Versus Contexts

These are important, but they are not themselves canonical bounded contexts in the manifest:

| Capability | Current role |
| --- | --- |
| Redis | Shared cache/session/online-store dependency |
| Feast | Shared feature platform/data plane |
| Kafka | Shared async event plane |
| MLflow | Shared experiment and registry control plane |
| Airflow + Great Expectations | Shared orchestration and data-quality control plane |
| Prometheus/Grafana/Loki/Jaeger | Shared observability plane |

## Known Boundary Debt

The repo still has some contract/documentation debt even after this cleanup:

- `proto/ddd/v1/analysis.proto` still contains a `TriggerTraining` RPC even though `learning.proto` also exists.
- Architecture truth still depends too much on manual review; it should be validated automatically in CI.

These are real cleanup items, not reasons to invent extra current services in the docs.

## Practical Extraction Order

1. Keep the BFF-to-analysis seam stable.
2. Continue moving analysis internals behind that seam without breaking the frontend contract.
3. Extract ingestion only after ownership around persistence and Kafka is clean enough to move safely.
4. Extract learning only after retraining, data quality, and operational controls are stable enough to survive service separation.

## Summary

- The canonical bounded-context source of truth is small on purpose.
- Only one extracted seam is live today: `analysis-service`.
- Ingestion and learning are real boundaries, but still logical rather than fully deployed.
- The docs must not promote future candidates into current-state architecture facts.
