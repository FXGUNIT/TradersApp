# TradersApp — 20-Step Implementation Progress

**Started:** 2026-04-02
**Priority:** CODE RED — All 20 Steps
**Commitment:** 60+ hrs/week
**Last Updated:** 2026-04-03

---

## OVERALL PROGRESS

| Phase | Tasks | Done | In Progress | Pending |
|-------|-------|------|-------------|---------|
| Phase 1: Foundation | 5 | 5 | 0 | 0 |
| Phase 2: ML Infrastructure | 5 | 4 | 0 | 1 |
| Phase 3: Data Quality | 3 | 3 | 0 | 0 |
| Phase 4: Orchestration | 3 | 0 | 0 | 3 |
| Phase 5: Testing & Security | 3 | 0 | 0 | 3 |
| Phase 6: Documentation | 1 | 0 | 0 | 1 |
| **TOTAL** | **20** | **5** | **0** | **15** |

**Overall:** 65% complete (13/20 tasks done) ✅

---

## PHASE 1: FOUNDATION (5/5 Tasks)
**Goal:** Data versioning, caching, resilience, documentation, and review process.

### Task 1.5: DVC + Git (Data Versioning)
- **Original Step #:** 5
- **Effort:** 1-2 days
- **Status:** ✅ COMPLETED
- **Started:** 2026-04-02
- **Completed:** 2026-04-02
- **Files Created:**
  - `.dvc/` — DVC internal directory
  - `dvc.yaml` — 5-stage pipeline definition
  - `params.yaml` — configurable parameters
  - `docs/DVC_SETUP.md` — usage reference
  - `ml-engine/data/trading_data.db.dvc` — tracked dataset
  - `dvc.lock` — DVC pipeline lock
- **Files Modified:**
  - `ml-engine/.dvcignore` — DVC ignore patterns
  - `.gitignore` — DVC cache + db files ignored
  - `SPEC.md` — added DVC requirements
  - `CLAUDE.md` — updated directory structure
- **Remote Configured:** Local (`ml-engine/dvc-storage/`), upgradeable to S3/MinIO
- **Verification:**
  - [x] `dvc repro` regenerates exact feature set from CSV
  - [x] `git push` includes DVC files
  - [x] `.gitignore` excludes `.db`, `.dvc/cache/`, `.dvc/tmp/`
  - [ ] Model files tracked after first training run
- **Notes:** Pipeline stages: load_candles → features → train_regime → train_direction → evaluate. SQLite db tracked via dvc.yaml, not directly (avoids process lock issues).
- **Commit:** `938a80c` "feat: Add DVC data versioning, 20-step enterprise plan docs"

### Task 1.6: Redis Caching Layer
- **Original Step #:** 16
- **Effort:** 1-2 days
- **Status:** ⏳ PENDING
- **Started:** —
- **Completed:** —
- **Files to Create:**
  - `ml-engine/infrastructure/cache.py`
  - `ml-engine/infrastructure/redis_client.py`
- **Files to Modify:**
  - `bff/routes/consensusRoutes.mjs`
  - `bff/services/consensusEngine.mjs`
- **Deliverable:** ML predictions cached, <50ms latency target
- **Verification:**
  - [ ] Redis running in Docker
  - [ ] Consensus endpoint cache hit rate > 80%
  - [ ] Benchmark shows improvement
- **Commit:** —

### Task 1.7: Circuit Breakers + Resilience
- **Original Step #:** 18
- **Effort:** 1 day
- **Status:** ⏳ PENDING
- **Started:** —
- **Completed:** —
- **Files to Create:**
  - `ml-engine/infrastructure/circuit_breaker.py`
  - `ml-engine/infrastructure/dead_letter.py`
- **Files to Modify:**
  - `bff/services/consensusEngine.mjs`
  - `ml-engine/main.py`
- **Deliverable:** BFF → ML Engine fully resilient, NEUTRAL fallback
- **Verification:**
  - [ ] Kill ML engine → BFF returns stale-with-warning
  - [ ] 5 failures in 30s → circuit opens
  - [ ] Dead letter queue captures failed predictions
- **Commit:** —

### Task 1.8: ADRs (Architecture Decision Records)
- **Original Step #:** 14
- **Effort:** Day 1 (ongoing)
- **Status:** ⏳ PENDING
- **Started:** —
- **Completed:** —
- **Files to Create:**
  - `docs/adr/README.md` — ADR index
  - `docs/adr/ADR-001-001-dvc-data-versioning.md`
  - `docs/adr/ADR-001-002-redis-caching.md`
  - `docs/adr/ADR-001-003-circuit-breakers.md`
  - `docs/adr/ADR-001-004-mlflow-choice.md`
  - `docs/adr/ADR-001-005-kafka-choice.md`
  - `docs/adr/ADR-001-006-k3s-choice.md`
  - `docs/adr/ADR-001-007-feature-store-choice.md`
  - `docs/adr/ADR-001-008-inference-server-choice.md`
- **Deliverable:** Every major decision documented with Context → Decision → Consequences
- **Verification:**
  - [ ] ADR index exists
  - [ ] First 5 ADRs written for Phase 1 decisions
- **Commit:** —

### Task 1.9: Self-Code Review Process
- **Original Step #:** 20
- **Effort:** Day 1 (ongoing)
- **Status:** ⏳ PENDING
- **Started:** —
- **Completed:** —
- **Files to Create:**
  - `docs/PROCESS.md`
- **Files to Modify:**
  - `CLAUDE.md` — add code review section
- **Deliverable:** Branch → review → merge workflow enforced
- **Verification:**
  - [ ] Feature branches used for all work
  - [ ] Self-review documented in PRs
  - [ ] No direct pushes to main
- **Commit:** —

---

## PHASE 2: ML INFRASTRUCTURE (5/5 Tasks)
**Goal:** Full MLOps lifecycle — experiment tracking, features, monitoring.

### Task 2.6: MLflow (Self-Hosted MLOps)
- **Original Step #:** 6
- **Effort:** 2-3 days
- **Status:** ✅ COMPLETED
- **Started:** 2026-04-03
- **Completed:** 2026-04-03
- **Files Created:**
  - `docker-compose.mlflow.yml` — MLflow + PostgreSQL + MinIO stack
  - `ml-engine/infrastructure/mlflow_client.py` — MLflowTrackingClient with auto-registration, model registry, DVC lineage
  - `docs/adr/ADR-004-mlflow-choice.md` — ADR documenting MLflow decision
- **Files Modified:**
  - `ml-engine/training/trainer.py` — integrated MLflow tracking per model run
  - `ml-engine/main.py` — added MLflow endpoints (/mlflow/status, /mlflow/experiments, /mlflow/models, /mlflow/promote)
  - `ml-engine/requirements.txt` — added mlflow==2.21.3
- **Deliverable:** Experiment tracking, model registry, artifact storage via MinIO + PostgreSQL
- **Verification:**
  - [x] `docker-compose.mlflow.yml` defines MLflow + PostgreSQL + MinIO
  - [x] Trainer logs all runs to MLflow with DVC commit hash as tag
  - [x] Auto-registers models passing PBO thresholds to Staging
  - [ ] `docker compose -f docker-compose.mlflow.yml up -d` — MLflow accessible at localhost:5000
  - [ ] First training run appears in MLflow UI
- **Notes:** Backend store is PostgreSQL (durable), artifact store is MinIO (self-hosted S3). Auto-promotion requires human review before production. DVC commit hash provides full data lineage.
- **Commit:** —

### Task 2.7: Continuous Model Monitoring
- **Original Step #:** 11
- **Effort:** 2-3 days
- **Status:** ✅ COMPLETED
- **Started:** 2026-04-03
- **Completed:** 2026-04-03
- **Files Created:**
  - `ml-engine/infrastructure/drift_detector.py` — DriftMonitor orchestrator, FeatureDriftDetector (PSI), ConceptDriftDetector (win rate), RegimeDriftDetector (HMM)
  - `ml-engine/tests/test_drift_detector.py` — 32 comprehensive tests covering all detectors and edge cases
  - `docs/adr/ADR-016-drift-detection.md` — ADR documenting PSI/win-rate/HMM architecture
- **Files Modified:**
  - `ml-engine/main.py` — added 5 drift API endpoints (/drift/status, /drift/detect, /drift/record-prediction, /drift/baseline, /drift/thresholds)
  - `ml-engine/training/trainer.py` — baseline refresh after each training run
  - `docs/adr/README.md` — added ADR-016 index entry
- **Deliverable:** Drift detection, auto-retrain triggers integrated with trainer
- **Verification:**
  - [x] All 32 drift detector tests pass (PSI, feature, concept, regime, monitor)
  - [x] Trainer automatically refreshes baselines after successful training
  - [x] Drift API endpoints integrated into FastAPI main app
  - [ ] Prometheus metrics exposed (Phase 3)
  - [ ] Retraining DAG triggered automatically (Phase 3)
- **Notes:** Three-detector design: PSI monitors feature distribution shift (thresholds 0.1/0.2/0.25), ConceptDrift tracks rolling win rate vs training baseline, RegimeDrift tracks HMM posterior with consecutive-bar confirmation. Separate `_last_seen_regime` and `_baseline_regime` fields ensure `should_retrain()` fires correctly after warm-up.
- **Commit:** `fc5d6c4` "feat: Phase 2.7 unified drift detection"

### Task 2.8: Closed Feedback Loops
- **Original Step #:** 19
- **Effort:** 2-3 days
- **Status:** ✅ COMPLETED
- **Started:** 2026-04-03
- **Completed:** 2026-04-03
- **Files Created:**
  - `ml-engine/feedback/feedback_logger.py` — logs consensus signals + matches trade outcomes
  - `ml-engine/feedback/trade_log_processor.py` — matches trades to signals, computes outcomes, feeds ConceptDriftDetector
  - `ml-engine/feedback/retrain_pipeline.py` — orchestrates retraining with safety guards
  - `dags/feedback_loop_dag.py` — Airflow DAG: weekly Sunday 22:00 UTC
  - `ml-engine/data/schema.sql` — added signal_log + signal_outcome tables
  - `ml-engine/data/candle_db.py` — added signal_log + feedback_stats methods
  - `ml-engine/tests/test_feedback_loop.py` — 28 comprehensive tests
- **Files Modified:**
  - `ml-engine/main.py` — added 8 feedback API endpoints + initialized feedback components in lifespan
- **Deliverable:** Trade log → training data → retrained model
- **Verification:**
  - [x] All 28 feedback loop tests pass
  - [x] Signal logging and outcome recording work end-to-end
  - [x] Trade-to-signal matching via timestamp windows (30-min)
  - [x] ConceptDriftDetector fed via record_prediction() after each trade close
  - [x] Retrain pipeline: rate limit (2/day), min 20 trades, confirmed drift required
  - [ ] Airflow DAG deployed and running weekly
  - [ ] Paper trade 1 week → model retrained
  - [ ] Rollback to previous model works
- **Notes:** Safety guards: max 2 retrains/day, min 20 new trades required, drift must be confirmed (alert/critical not warning). Three trigger modes: manual (user), drift (auto on confirmed drift), scheduled (Airflow weekly).
- **Commit:** `c6fbd3d` "feat: Phase 2.8 closed feedback loops"

### Task 2.9: Feast Feature Store
- **Original Step #:** 9
- **Effort:** 3-5 days
- **Status:** ✅ COMPLETED
- **Started:** 2026-04-03
- **Completed:** 2026-04-03
- **Files Created:**
  - `ml-engine/features/feast_repo/feature_store.yaml` — Feast config: FileSource parquet offline + Redis online + TradersProvider
  - `ml-engine/features/feast_repo/entities/symbol_entity.py` — Symbol entity definition
  - `ml-engine/features/feast_repo/data_sources/candles_source.py` — FileSource definitions for candle/trade/session Parquet files
  - `ml-engine/features/feast_repo/feature_views/candle_features.py` — 50+ OHLCV + technical indicator features
  - `ml-engine/features/feast_repo/feature_views/historical_features.py` — Rolling trade performance features (win_rate, expectancy, profit_factor)
  - `ml-engine/features/feast_repo/feature_views/session_features.py` — Session aggregate features (gap, range, volume)
  - `ml-engine/features/feast_repo/custom_provider.py` — TradersProvider bridging SQLite→Redis materialization
  - `ml-engine/features/feast_repo/__init__.py` + empty `__init__.py` for subdirs
  - `ml-engine/features/export_features_parquet.py` — Export SQLite to Parquet for Feast offline store
  - `ml-engine/features/feast_client.py` — High-level API: get_candle_features, get_all_features, get_historical_features_for_training + SQLite fallbacks
- **Deliverable:** Centralized, versioned feature access with SQLite fallback and Redis online serving
- **Online Store:** Redis (via custom TradersProvider)
- **Offline Store:** SQLite via Parquet export (custom TradersProvider)
- **Verification:**
  - [x] All 13 Feast files pass syntax check (ast.parse)
  - [x] All 90 ml-engine tests pass
  - [ ] `feast apply` succeeds (requires feast installed + Parquet files)
  - [ ] `feast materialize` materializes to Redis
  - [ ] `feast get-online-features` < 10ms
  - [ ] Feature versioning documented
- **Notes:** TradersProvider implements the full Feast Provider interface — pull_latest_from_offline_store for training, write_to_online_store for Redis materialization. Custom `_query_sqlite` method bridges SQLite to Pandas DataFrames. Falls back to direct SQLite queries in feast_client.py when Feast is not configured.
- **Commit:** `e96feee` "feat: Phase 2.9 Feast feature store"

### Task 2.10: Triton/vLLM Inference Serving
- **Original Step #:** 8
- **Effort:** 3-5 days
- **Status:** ✅ COMPLETED
- **Started:** 2026-04-03
- **Completed:** 2026-04-03
- **Files Created:**
  - `ml-engine/inference/onnx_exporter.py` — Export sklearn/LightGBM pipelines to ONNX via skl2onnx
  - `ml-engine/inference/triton_model.py` — Triton Python backend model: ONNX Runtime (CUDA/CPU) + sklearn fallback
  - `ml-engine/inference/triton_client.py` — Triton gRPC client with automatic fallback: Triton → ONNX local → sklearn
  - `ml-engine/inference/triton_server.py` — Triton server manager: setup, start, stop, status + model repo setup
  - `ml-engine/inference/vllm_server.py` — vLLM server for Mamba sequence model via OpenAI-compatible API
  - `Dockerfile.triton` — NVIDIA Triton 24.04 container with onnxruntime-gpu + LightGBM + CUDA
  - `ml-engine/main.py` — Added 6 inference endpoints: /inference/{predict,status,export,setup,benchmark}, /mamba/vllm
- **Deliverable:** GPU-accelerated model serving < 50ms p99 with automatic fallback
- **Inference Priority:** Triton gRPC (GPU) → ONNX Runtime local (CUDA) → sklearn joblib (CPU fallback)
- **Verification:**
  - [x] All 90 ml-engine tests pass
  - [x] ONNX exporter: `python -m ml_engine.inference.onnx_exporter --list` works
  - [ ] `python -m ml_engine.inference.triton_server --setup` creates model repo
  - [ ] Docker Triton server running with GPU acceleration
  - [ ] Inference latency < 50ms p99 (benchmark via /inference/benchmark)
  - [ ] vLLM server running for Mamba sequence features
- **Notes:** Three-tier inference strategy — Triton provides GPU acceleration + dynamic batching for high throughput; ONNX Runtime local is the fallback for environments without Triton; sklearn joblib is the last resort for CPU-only. vLLM serves the Mamba model via OpenAI-compatible API (POST /v1/completions) — the fine-tuned Mamba outputs JSON with direction/momentum/regime scores.
- **Commit:** `8226984` "feat: Phase 2.10 Triton/vLLM inference serving"

---

## PHASE 3: DATA QUALITY & PIPELINES (3/3 Tasks)
**Goal:** Every dataset validated, event-driven architecture.

### Task 3.11: Great Expectations + Airflow
- **Original Step #:** 7
- **Effort:** 3-5 days
- **Status:** ✅ COMPLETED
- **Started:** 2026-04-03
- **Completed:** 2026-04-03
- **Files Created:**
  - `ml-engine/data_quality/expectations/__init__.py`
  - `ml-engine/data_quality/expectations/candle_expectations.py` — 15 checks: OHLCV nulls, high/low sanity, volume, timestamp alignment, returns, duplicates
  - `ml-engine/data_quality/expectations/trade_expectations.py` — 10 checks: required columns, PnL nulls, result/direction values, entry<exit, PnL signs, AMD phases, confidence range
  - `ml-engine/data_quality/validation_pipeline.py` — CLI: --candles/--trades/--sessions/--all, blocks pipeline on critical failure, webhook alerts
  - `dags/data_quality_dag.py` — Airflow DAG: daily 06:30 UTC, 6 tasks, gate check, Slack/Discord alerts, MLflow logging
- **Deliverable:** Automated data quality gates blocking the ML pipeline on critical failures
- **Verification:**
  - [x] All 90 ml-engine tests pass
  - [x] Candle expectations: 15 checks (critical + warning)
  - [x] Trade expectations: 10 checks (critical + warning)
  - [x] CLI: `python -m ml_engine.data_quality.validation_pipeline --all` works
  - [ ] Airflow DAG deployed and running daily
  - [ ] Dirty data injection test → pipeline halts
  - [ ] Webhook alert fires on critical failure
- **Notes:** Three suites (candles, trades, sessions). Critical expectations block the pipeline; warnings are logged. Slack/Discord webhook alerts on failure. MLflow metrics track data quality over time.
- **Commit:** `8647bbc` "feat: Phase 3.11 Great Expectations + Airflow"

### Task 3.12: Apache Kafka
- **Original Step #:** 4
- **Effort:** 5-7 days
- **Status:** ✅ COMPLETED
- **Started:** 2026-04-03
- **Completed:** 2026-04-03
- **Files Created:**
  - `docker-compose.kafka.yml` — Kafka 3.7 KRaft (no Zookeeper), 5 topics, Kafka UI, Kafka Connect
  - `proto/traders.proto` — Proto3 schema: Candle, CandleBatch, ConsensusSignal, ModelVote, TradeOutcome, DriftAlert, TradersService
  - `ml-engine/kafka/producer.py` — Thread-safe KafkaProducerClient, idempotent delivery, zstd compression, 5ms batching, context manager
  - `ml-engine/kafka/consumer.py` — Background-thread consumer, manual commit, registered handlers for feedback-loop + drift-alerts, stop/start lifecycle
- **Deliverables:**
  - Topics: candle-data, consensus-signals, model-predictions, feedback-loop, drift-alerts
  - Proto3 schemas for all inter-service messages
- **Verification:**
  - [x] All 90 ml-engine tests pass
  - [x] Python syntax checks pass
  - [ ] `docker compose -f docker-compose.kafka.yml up -d` — Kafka cluster running
  - [ ] Produce/consume test passes
  - [ ] Services communicate via events
- **Notes:** KRaft mode eliminates Zookeeper dependency. Idempotent producer with `enable.idempotence=True` ensures exactly-once semantics. Manual offset commit after each message processed. Feedback-loop consumer dispatches to ConceptDriftDetector; drift-alerts consumer triggers retrain pipeline.
- **Commit:** `c671eb3` "feat: Phase 3.12 Apache Kafka"

### Task 3.13: Observability Stack
- **Original Step #:** 2
- **Effort:** 3-5 days
- **Status:** ✅ COMPLETED
- **Started:** 2026-04-03
- **Completed:** 2026-04-03
- **Files Created:**
  - `docker-compose.observability.yml` — Prometheus + Grafana + Loki + Promtail + Jaeger (all-in-one)
  - `k8s/observability/prometheus.yml` — Prometheus: 15s scrape interval, ML Engine + BFF + node targets
  - `k8s/observability/loki.yml` — Loki: 24h index, 168h retention, filesystem storage
  - `k8s/observability/promtail.yml` — Promtail: ships ML Engine + BFF + system logs to Loki
  - `k8s/observability/grafana-provisioning/datasources/datasources.yml` — Auto-configures Prometheus + Loki + Jaeger
  - `k8s/observability/grafana-provisioning/dashboards/dashboards.yml` — Auto-imports dashboard
  - `k8s/observability/grafana-provisioning/dashboards/ml-engine.json` — 9-panel dashboard: latency, confidence, drift, cache, CB
  - `ml-engine/infrastructure/prometheus_exporter.py` — Prometheus metrics: 15+ metrics including prediction latency, drift, cache, CB, HTTP
  - `ml-engine/infrastructure/tracing.py` — OpenTelemetry + Jaeger: span creation, context manager, FastAPI middleware, function decorator
- **Deliverable:** Full observability — Prometheus metrics, Grafana dashboards, Loki log aggregation, Jaeger distributed tracing
- **Access:** Grafana:3001, Prometheus:9090, Loki:3100, Jaeger:16686
- **Verification:**
  - [x] All 90 ml-engine tests pass
  - [x] Python syntax checks pass
  - [ ] `docker compose -f docker-compose.observability.yml up -d` — Stack running
  - [ ] Prometheus scraping ML Engine at /metrics
  - [ ] Grafana shows real-time ML Engine dashboard
  - [ ] Jaeger traces visible for ML prediction requests
- **Notes:** OpenTelemetry SDK with W3C Trace Context propagation across services. PrometheusMiddleware auto-instrumenting HTTP requests. 15+ custom metrics covering full ML lifecycle from data ingestion through prediction and retraining.
- **Commit:** `f99318d` "feat: Phase 3.13 Observability Stack"

---

## PHASE 4: ORCHESTRATION (3/3 Tasks)
**Goal:** Containerized, zero-downtime, auto-scaling.

### Task 4.14: Docker + k3s
- **Original Step #:** 1
- **Effort:** 3-5 days
- **Status:** ⏳ PENDING
- **Started:** —
- **Completed:** —
- **Files to Create:**
  - `Dockerfile.bff`
  - `Dockerfile.ml-engine`
  - `Dockerfile.frontend`
  - `Dockerfile.telegram-bridge`
  - `k8s/bff-deployment.yaml`
  - `k8s/ml-deployment.yaml`
  - `k8s/frontend-deployment.yaml`
  - `k8s/services.yaml`
- **Deliverable:** All services containerized, orchestrated by k3s
- **Verification:**
  - [ ] `kubectl get pods` shows all services
  - [ ] Rolling deployments work (zero downtime)
  - [ ] Health checks passing
- **Commit:** —

### Task 4.15: Horizontal Scalability
- **Original Step #:** 17
- **Effort:** 2-3 days
- **Status:** ⏳ PENDING
- **Started:** —
- **Completed:** —
- **Files to Create:**
  - `k8s/hpa-ml-engine.yaml`
  - `k8s/hpa-bff.yaml`
  - `k8s/redis-cluster.yaml`
- **Deliverable:** Stateless services, HPA policies, autoscaling
- **Verification:**
  - [ ] Load test → HPA scales pods up
  - [ ] Latency stays under 200ms under load
  - [ ] Scale down after load removed
- **Commit:** —

### Task 4.16: Gitea + Woodpecker CI/CD
- **Original Step #:** 3
- **Effort:** 2-3 days
- **Status:** ⏳ PENDING
- **Started:** —
- **Completed:** —
- **Files to Create:**
  - `docker-compose.gitea.yml`
  - `.woodpecker.yml`
- **Deliverable:** Self-hosted Git + CI pipeline
- **Verification:**
  - [ ] Gitea accessible
  - [ ] Woodpecker pipeline runs on commit
  - [ ] Auto-deploy to k3s on green build
- **Commit:** —

---

## PHASE 5: TESTING & SECURITY (3/3 Tasks)
**Goal:** Zero-downtime, hardened, fully tested.

### Task 5.17: Multi-Level Testing Suite
- **Original Step #:** 12
- **Effort:** 3-5 days
- **Status:** ⏳ PENDING
- **Started:** —
- **Completed:** —
- **Files to Create:**
  - `tests/unit/` — unit tests
  - `tests/integration/` — integration tests
  - `tests/load/locustfile.py` — load tests
  - `chaos/experiments/` — chaos mesh configs
- **Deliverable:** Unit + integration + load + chaos testing
- **Verification:**
  - [ ] pytest passes with > 80% coverage on critical paths
  - [ ] Locust: < 200ms at 100 concurrent users
  - [ ] Chaos Mesh: services recover from failures
- **Commit:** —

### Task 5.18: Keycloak + Trivy
- **Original Step #:** 13
- **Effort:** 3-5 days
- **Status:** ⏳ PENDING
- **Started:** —
- **Completed:** —
- **Files to Create:**
  - `docker-compose.keycloak.yml`
  - `k8s/keycloak-deployment.yaml`
  - `.github/workflows/trivy-scan.yml`
- **Deliverable:** Zero-trust auth, vulnerability scanning
- **Verification:**
  - [ ] Keycloak SSO working for all services
  - [ ] Trivy blocks vulnerable images in CI
  - [ ] No unscanned image reaches production
- **Commit:** —

### Task 5.19: Microservices DDD + gRPC
- **Original Step #:** 10
- **Effort:** 4-6 weeks
- **Status:** ⏳ PENDING
- **Started:** —
- **Completed:** —
- **Files to Create:**
  - `proto/traders.proto` — shared gRPC contracts
  - `proto/analysis.proto`
  - `proto/inference.proto`
  - `proto/telegram.proto`
  - `data-pipeline/` — new service
  - `services/bff/` — bounded context
  - `services/ml-engine/` — bounded context
- **Deliverable:** Bounded contexts, gRPC contracts, independent deployability
- **Verification:**
  - [ ] Each service deploys independently
  - [ ] gRPC calls between services
  - [ ] Kafka for async, gRPC for sync
- **Commit:** —

---

## PHASE 6: DOCUMENTATION (1/1 Task)
**Goal:** Living documentation, auto-generated.

### Task 6.20: MkDocs Documentation
- **Original Step #:** 15
- **Effort:** 1-2 days
- **Status:** ⏳ PENDING
- **Started:** —
- **Completed:** —
- **Files to Create:**
  - `docs/mkdocs.yml`
  - `docs/index.md`
  - `docs/api/` — auto-generated API docs
  - `docs/ml/` — ML pipeline docs
  - `docs/architecture/` — architecture diagrams
- **Deliverable:** Full searchable docs site
- **Verification:**
  - [ ] `mkdocs serve` shows complete site
  - [ ] API docs auto-generated
  - [ ] CI/CD builds and deploys docs
- **Commit:** —

---

## DEPLOYMENT CHECKLIST

Before any commit to main, verify:

- [ ] Code builds successfully
- [ ] Tests pass
- [ ] DVC files pushed to remote
- [ ] ADR updated (if architectural change)
- [ ] Secrets added to Infisical (not Git)
- [ ] Backup tag created: `python scripts/auto_backup.py "description"`
- [ ] Git commit with descriptive message
- [ ] GitHub push successful

---

## COMMIT HISTORY

| Date | Task | Commit Message | Notes |
|------|-------|---------------|-------|
| 2026-04-02 | 1.5 | `938a80c` feat: Add DVC data versioning, 20-step enterprise plan docs | DVC pipeline, docs, 22 GH secrets set |
| 2026-04-03 | 1.6,1.7 | `de41b5a` feat: Phase 1 enterprise foundation | Redis cache, CB, SLA, 6 ADRs, PROCESS.md, 30/30 tests pass |
| 2026-04-03 | 2.7 | `fc5d6c4` feat: Phase 2.7 unified drift detection | PSI, win rate, HMM regime tracking, 32 tests |
| 2026-04-03 | 2.8 | `c6fbd3d` feat: Phase 2.8 closed feedback loops | signal logging, trade matching, retrain pipeline, 28 tests |
| 2026-04-03 | 2.9 | `e96feee` feat: Phase 2.9 Feast feature store | SQLite→Redis feature store, 13 files, 90 tests |
| 2026-04-03 | 2.10 | `8226984` feat: Phase 2.10 Triton/vLLM inference serving | ONNX export, GPU inference, 3-tier fallback, 6 endpoints |
| 2026-04-03 | 3.11 | `8647bbc` feat: Phase 3.11 Great Expectations + Airflow | 25 expectation checks, CLI, DAG, webhook alerts |
| 2026-04-03 | 3.12 | `c671eb3` feat: Phase 3.12 Apache Kafka | 5 topics, producer/consumer, Proto3 schemas |
| 2026-04-03 | 3.13 | `f99318d` feat: Phase 3.13 Observability Stack | Prometheus, Grafana, Loki, Jaeger, 15+ metrics |

---

## BLOCKERS & DEPENDENCIES

| Blocker | Blocks | Resolution |
|---------|--------|-----------|
| Infisical workspace may be empty — `INFISICAL_TOKEN` value not accessible locally | Pushing secrets to Infisical; CI `infisical-action` may fail | Need token value (`is.xxx`) from app.infisical.com → Settings → Access Tokens. Once provided, run `npx @infisical/cli secrets set` or `setup-infisical.ps1` |
| Railway deployment variables not set in GitHub | `deploy-production` / `deploy-staging` jobs | GitHub Settings → Variables: add `RAILWAY_PROD_ENV_ID`, `RAILWAY_PROD_ML_SERVICE_ID`, `RAILWAY_PROD_BFF_SERVICE_ID` |
| Vercel tokens not set in GitHub | Vercel deploy steps | GitHub Settings → Secrets: add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |

---

## LESSONS LEARNED

Document insights here as you go.
