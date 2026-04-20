# TradersApp Documentation Index

**Canonical reference:** All runbooks, specifications, and architectural documents live here.
For project health snapshot, see `docs/PROJECT_STATUS.md`.

---

## Getting Started

| Document | Purpose |
|----------|---------|
| `LOCAL_DEV.md` | Local development quickstart |
| `DEPLOYMENT.md` | Active production deployment overview |
| `P26_Contabo_Deployment_Plan.md` | Active Contabo production cutover runbook |
| `SETUP.md` | Archived OCI production setup reference |
| `SECRETS_MANAGEMENT.md` | Secrets management guide |
| `docs/TODO_MASTER_LIST.md` | Master task list and critical path |

---

## Current Runtime Truth

- Delivery is described as mixed rather than purely self-hosted: the active production path is `Contabo VPS + Docker Compose`, while some external AI and messaging dependencies remain third-party.
- The active ML inference seam still includes HTTP `/predict` for runtime compatibility, even where gRPC analysis paths also exist.
- The current SLA baseline for the local/runtime-facing prediction path is `<200ms P95`, not older placeholder targets shown in some historical assets.

---

## Deployment and Operations

### Runbooks

| Runbook | Scope | Status |
|---------|-------|--------|
| `DEPLOYMENT.md` | Full deployment procedures | Complete |
| `P26_Contabo_Deployment_Plan.md` | Active Contabo production deployment | Complete |
| `LOCAL_DEV.md` | Local dev setup | Complete |
| `SETUP.md` | Archived OCI production deployment reference | Archived |
| `CANARY_DEPLOYMENT_RUNBOOK.md` | Canary release procedure | Complete |
| `K8S_LIVE_CLUSTER_VALIDATION.md` | Post-deploy cluster validation | Complete |
| `K8S_COLD_WARM_CACHE_LOAD.md` | Redis cold/warm cache loading | Complete |
| `K8S_CACHE_COHERENCE_CHECKER.md` | Cross-namespace cache coherence | Complete |
| `HELM_VALIDATION.md` | Helm chart linting and dry-run | Stub |
| `K6_LOAD_TEST_RUNBOOK.md` | k6 load and stress testing | Stub |
| `HPA_SCALING_TEST_RUNBOOK.md` | HPA autoscaling validation | Stub |
| `POSTGRES_PROD_CUTOVER_RUNBOOK.md` | SQLite to PostgreSQL cutover | Stub |
| `MIGRATION-K3S-TO-DOCKER.md` | K3s to Docker Compose migration | Complete |

### Infrastructure

| Document | Purpose |
|----------|---------|
| `K8S_SECRET_CONTRACT.md` | Kubernetes secret definitions and contracts |
| `POSTGRES_CUTOVER_PLAN.md` | PostgreSQL migration plan |
| `SECRETS_ARCHITECTURE.md` | Secrets management architecture |
| `OBSERVABILITY_DEPLOY.md` | Prometheus, Grafana, Loki, Jaeger deployment |
| `CI_WORKFLOW_CLEANUP.md` | CI/CD workflow audit and cleanup |
| `FEATURE_CATALOG.md` | Feature flags and toggle catalog |

---

## Architecture and Design

| Document | Purpose |
|----------|---------|
| `ARCHITECTURE_REVIEW_CHECKLIST.md` | Architecture review checklist |
| `ADR-REGISTER.md` | ADR index (supernote -> see `adr/REGISTER.md`) |
| `adr/REGISTER.md` | Full Architecture Decision Record index |
| `DDD_MICROSERVICES.md` | Domain-driven design and microservice boundaries |
| `BOUNDED_CONTEXTS.md` | Bounded context definitions |
| `SCALABILITY.md` | Scalability design decisions |
| `PROCESS.md` | Organizational and team process |

### Architectural Assets (see `docs/assets/`)

- `architecture-3d-overview.*` - Current runtime overview
- `architecture-system-design-board.*` - Detailed topology with maturity labels
- `architecture-5w1h-map.*` - Operating intent map
- `architecture-birdview-roadmap.*` - Evolution roadmap

---

## ML Engine and Data

| Document | Purpose |
|----------|---------|
| `DVC_SETUP.md` | DVC data versioning setup |
| `MODEL_REGISTRY.md` | Model registry and lifecycle |
| `MODEL_MONITORING_RETRAINING.md` | Model drift monitoring and retraining |
| `MLOPS_MLFLOW.md` | MLflow self-hosted setup |
| `INFERENCE_SERVING.md` | Inference serving architecture |
| `ONNX_TRITON_WORKFLOW.md` | ONNX export and Triton serving |
| `FEATURE_CATALOG.md` | Feature definitions and engineering pipeline |
| `DATA_QUALITY_AIRFLOW.md` | Data quality checks via Airflow |

---

## Trading Logic

| Document | Purpose |
|----------|---------|
| `docs/DOMAIN-RULES.md` | Trading domain rules |
| `docs/EDGE-CASES.md` | Market scenario edge cases |
| `docs/LEGACY-PATTERNS.md` | Existing ML and integration patterns |
| `docs/TRADING_STRATEGY_COMPILED.md` | Compiled trading strategy |
| `docs/TRADING-MASTER-ANALYSIS.md` | Master trading analysis |
| `docs/QUANTITATIVE_TRADING_STRATEGY.md` | Quant strategy details |
| `docs/TRADING_STRATEGY_PROMPT.md` | Strategy prompt documentation |

---

## Security

| Document | Purpose |
|----------|---------|
| `SECURITY_ARCHITECTURE.md` | Security architecture |
| `SECURITY_RUNBOOK.md` | Security operations runbook |
| `SECURITY_TRAINING.md` | Security training materials |
| `KAFKA_BACKPRESSURE_STRATEGY.md` | Kafka backpressure and security |

---

## Testing

| Document | Purpose |
|----------|---------|
| `TESTING_PLAN.md` | Overall testing strategy |
| `AUTOMATED_TESTING.md` | Automated testing procedures |
| `PHASE2_STATELESS_AUDIT.md` | Stateless service audit results |

---

## Agents and Automation

| Document | Purpose |
|----------|---------|
| `CICD_GITEA_WOODPECKER.md` | Gitea and Woodpecker CI/CD guide |
| `TASK_ALIGNMENT_20_POINT_PLAN.md` | Agent task alignment guide |
| `PROMPT-TEMPLATE.md` | Session starter prompt template |

---

## Reference

| Document | Purpose |
|----------|---------|
| `AUTH.md` | Authentication documentation |
| `AURA_SMART_VECTORS_SPEC.TXT` | Smart vectors specification |
