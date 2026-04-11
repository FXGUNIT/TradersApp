# TradersApp Platform Architecture

This page is the canonical architecture summary for the repo.

Its main job is to separate three things that were previously mixed together:

- `Current`: what the code, compose files, Helm chart, and CI actually support now
- `Partial`: capabilities present in-repo but not yet fully validated as live operating reality
- `Target`: the intended future shape

## How To Read The Architecture Assets

| Asset | Read it as | Important warning |
| --- | --- | --- |
| `architecture-3d-overview.*` | Current runtime overview | Use this first for the live request path, support planes, and extraction status |
| `architecture-system-design-board.*` | Detailed topology board | Current-state inventory with explicit maturity labels for support systems and controls |
| `architecture-5w1h-map.*` | Current operating map | Current-state operating intent across request path, learning, observability, delivery, and boundaries |
| `architecture-birdview-roadmap.*` | Evolution roadmap | Planning view only; treat the `Today` column as current reality and the later columns as target work |

## Current Runtime Truth

- Browser traffic hits the React frontend, then the Node.js BFF over HTTP.
- The BFF uses `analysis-service` over gRPC when `ML_ANALYSIS_TRANSPORT=grpc`.
- `analysis-service` currently proxies to the Python ML Engine over HTTP `/predict`, not gRPC.
- If `ML_ANALYSIS_GRPC_STRICT=false`, the BFF can fall back to direct ML Engine HTTP calls when the gRPC seam is unavailable.
- `analysis-service` is a real runtime seam, but it still ships from the BFF codebase/image (`bff/analysis-server.mjs`, `Dockerfile.bff`).
- Ingestion and learning are defined as bounded contexts, but their runtime logic still lives inside `ml-engine/` modules and Airflow workflows.
- Redis, Kafka, Feast, MLflow, Airflow, Prometheus, Grafana, Loki, and Jaeger all exist in-repo.
- Keycloak, External Secrets, Trivy runtime/operator, OPA, and Falco should currently be described as mixed-maturity platform controls, not uniformly live operating truth.

## Deployment Reality

| Mode | Status | Source of truth |
| --- | --- | --- |
| Local lightweight dev | Current | `docker-compose.dev.yml` |
| Full local platform bring-up | Current | `docker-compose.yml`, `docker-compose.observability.yml`, `docker-compose.airflow.yml`, `docker-compose.mlflow.yml` |
| Public-cloud deploy path | Current / documented | GitHub Actions + Railway + Vercel in `.github/workflows/ci.yml`, `docs/SETUP.md`, `docs/DEPLOYMENT.md` |
| Self-hosted CI/CD path | Partial / target | `.woodpecker.yml`, `docker-compose.gitea.yml`, `docs/CICD_GITEA_WOODPECKER.md` |
| Self-hosted cluster rollout | Partial / target | `k8s/helm/tradersapp`, `docs/K8S_LIVE_CLUSTER_VALIDATION.md`, `docs/K8S_SECRET_CONTRACT.md` |

The repo currently contains both a public-cloud operating story and a self-hosted operating story.
Until one becomes the sole validated path, architecture docs must describe delivery as mixed.

## Runtime Layers

| Layer | Components | State | What it does now |
| --- | --- | --- | --- |
| Experience | Frontend (`React`, `Vite`) | Current | Trading UI, dashboards, operator workflows |
| Edge and orchestration | BFF (`Node.js`) | Current | Auth/session logic, anti-corruption layer, API composition |
| Extracted hot-path seam | `analysis-service` (`gRPC` server) | Current | Stable consensus contract on the BFF-to-ML boundary |
| Core ML runtime | ML Engine (`Python`) | Current | Inference, training, drift detection, feedback, monitoring endpoints |
| Low-latency data plane | Redis, Feast | Current / partial | Shared cache and online/offline feature access |
| Event plane | Kafka | Current / partial | Async topics for candles, signals, drift, and feedback |
| MLOps plane | MLflow, MinIO, PostgreSQL | Current / partial | Experiment tracking, registry, artifacts, lineage |
| Control plane | Airflow, Great Expectations | Current / partial | Scheduled validation, monitoring, retraining orchestration |
| Observability plane | Prometheus, Grafana, Loki, Jaeger | Current / partial | Metrics, dashboards, logs, traces, alerts |
| Delivery plane | GitHub Actions + Railway/Vercel; Gitea + Woodpecker + Helm + k3s | Mixed | Public-cloud path is currently documented/automated; self-hosted path exists and remains a target/partial operating mode |

## Bounded Contexts And Extraction Status

Canonical manifest: `architecture/ddd/bounded-contexts.json`

| Context | Service boundary | Status | Notes |
| --- | --- | --- | --- |
| BFF orchestration | `bff` | Live | Owns frontend-facing contracts and translation logic |
| Analysis | `analysis-service` | Live extraction seam | gRPC seam is implemented and deployed in compose/Helm; internals still proxy ML Engine HTTP `/predict` |
| Ingestion | `ingestion-service` contract | Logical only | Ownership exists in the manifest and proto; runtime remains inside `ml-engine/data` and `ml-engine/kafka` |
| Learning | `learning-service` contract | Logical only | Ownership exists in the manifest and proto; runtime remains inside `ml-engine/training`, `ml-engine/feedback`, and Airflow DAGs |

## Request Path

1. Browser loads the frontend.
2. Frontend sends requests to the BFF.
3. BFF calls `analysis-service` over gRPC when the gRPC transport is enabled.
4. `analysis-service` normalizes the contract and proxies into ML Engine HTTP `/predict`.
5. If gRPC is unavailable and strict mode is off, the BFF can call ML Engine HTTP directly.
6. Redis and Feast may enrich the decision path where available.

### SLA Note

The architecture docs should currently treat the consensus path as a `<200ms P95` contract until the broader SLA story is unified.

Older tighter-latency language still present in historical references should be read as either:

- a subcomponent goal
- a tighter aspirational target
- or stale wording that needs cleanup

## Delivery Truth

- GitHub Actions still drives the documented public-cloud deployment path in the repo.
- Railway and Vercel are still present in both docs and CI workflows.
- Gitea + Woodpecker + Helm + k3s is a real self-hosted path in-repo, but it should be described as partial until end-to-end validated as the primary operating model.
- Infisical is the intended upstream secret source, but cluster-side External Secrets is not yet safe to describe as fully live everywhere.

## Canonical Supporting Docs

- [DDD Microservices + gRPC](./DDD_MICROSERVICES.md)
- [Bounded Contexts](./BOUNDED_CONTEXTS.md)
- [MLflow MLOps lifecycle](./MLOPS_MLFLOW.md)
- [Continuous model monitoring + auto-retraining](./MODEL_MONITORING_RETRAINING.md)
- [Data Quality + Airflow](./DATA_QUALITY_AIRFLOW.md)
- [Automated testing + chaos](./AUTOMATED_TESTING.md)
- [CI/CD with Gitea + Woodpecker](./CICD_GITEA_WOODPECKER.md)
- [Setup guide](./SETUP.md)
- [Deployment guide](./DEPLOYMENT.md)
- [K8S secret contract](./K8S_SECRET_CONTRACT.md)

## Architectural Truth To Keep In Mind

- The repo is not a simple three-box app anymore.
- `analysis-service` is the first extracted seam on the hot path, but not yet a fully independent domain implementation.
- Ingestion and learning are logical bounded contexts before they are separate deployable runtimes.
- Delivery reality is currently mixed, not purely self-hosted.
- Architecture docs must describe current state and target state separately or they become actively misleading.
