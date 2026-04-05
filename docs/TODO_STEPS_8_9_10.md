# TradersApp — Detailed To-Do List: Steps 8, 9, 10

**Priority:** HIGH — Production ML infrastructure and architecture
**Generated:** 2026-04-05
**Prerequisites:** Steps 1 (Docker+k3s), 6 (MLflow), 7 (Great Expectations+Airflow) must be complete

---

## PHASE A: Step 8 — Low-Latency Inference Serving (Triton/vLLM)

**Goal:** Serve all ML model predictions under 50ms p99, with hardware acceleration where available.

---

### A1. Architecture & Strategy Decisions
- [ ] **A1.1** Audit all existing ML models in `ml-engine/models/` — list every model family (direction, regime, magnitude, alpha, session, mamba), their framework (LightGBM, XGBoost, scikit-learn, PyTorch), file format (.pkl, .pt, .onnx), and typical inference latency
- [ ] **A1.2** Choose inference server: **Triton** for tree-based models (LightGBM/XGB) + ONNX, **vLLM** only if adding LLM components later. Document decision in ADR-021.
- [ ] **A1.3** Define latency budget per endpoint: consensus `/predict` < 200ms (BFF SLA), individual model < 50ms, regime detection < 30ms
- [ ] **A1.4** Choose ONNX runtime version (e.g., `onnxruntime-gpu==1.20` with CUDA 12.x) or CPU fallback for non-GPU hosts
- [ ] **A1.5** Design batching strategy: static batching (pre-group N requests) vs dynamic batching (auto-batch at server) — document tradeoffs in ADR-022
- [ ] **A1.6** Define gRPC vs REST interface: gRPC for internal BFF→inference, REST for debugging/manual testing
- [ ] **A1.7** Choose model repository storage: local filesystem (`/models/` in container) or S3/MinIO remote model store
- [ ] **A1.8** Document expected GPU requirements: CUDA version, VRAM per model, total VRAM budget (if no GPU, document CPU fallback path)

---

### A2. Docker & Kubernetes Setup
- [ ] **A2.1** Create `ml-engine/inference/Dockerfile.triton` — base image `nvcr.io/nvidia/tritonserver:25.02-py3` (or CPU-only `ubuntu:22.04` + manual Triton install)
- [ ] **A2.2** Create `docker-compose.triton.yml` for local development: Triton container + MinIO for model repository + Redis for dynamic batching queue
- [ ] **A2.3** Write `ml-engine/inference/triton_model_repository/config.pbtxt` — defines all model repositories, instance groups, batching, dynamic batching parameters
- [ ] **A2.4** Add Triton model config per model family:
  - `direction_model/1/config.pbtxt` — LightGBM→ONNX, instance_group=[1], dynamic_batching { preferred_batch_size: [4,8], max_queue_delay_us: 1000 }
  - `regime_model/1/config.pbtxt` — HMM + FP-FK ensemble, instance_group=[1], max_batch_size: 16
  - `magnitude_model/1/config.pbtxt` — regression model, instance_group=[1]
  - `alpha_model/1/config.pbtxt` — alpha scoring, instance_group=[1]
  - `session_model/1/config.pbtxt` — session probability, instance_group=[1]
  - `mamba_model/1/config.pbtxt` — PyTorch sequence model, GPU required if available
- [ ] **A2.5** Create k8s manifests: `k8s/triton-deployment.yaml` with HorizontalPodAutoscaler, resource limits (CPU/memory/GPUs), liveness/readiness probes
- [ ] **A2.6** Create k8s `k8s/triton-service.yaml` — ClusterIP service for internal gRPC (port 8001), NodePort for debugging
- [ ] **A2.7** Add GPU tolerations to Triton deployment (`nvidia.com/gpu: 1`) and document that Triton pods require GPU nodes
- [ ] **A2.8** Create CPU-only fallback deployment: `k8s/triton-deployment.cpu.yaml` for development without GPU

---

### A3. Model Export & ONNX Conversion
- [ ] **A3.1** Create `ml-engine/inference/export_onnx.py` — converts all LightGBM/XGBoost models to ONNX format at training time
  - Test: load LightGBM model → export to ONNX → verify predictions match within 1e-6 tolerance
- [ ] **A3.2** Create `ml-engine/inference/export_pytorch.py` — exports PyTorch models (Mamba) to TorchScript via `torch.jit.trace()`
  - Test: load PyTorch model → TorchScript export → verify outputs match
- [ ] **A3.3** Create `ml-engine/inference/validate_onnx.py` — regression test: ONNX output vs original model output, assert max_abs_diff < 1e-5
- [ ] **A3.4** Add ONNX export to existing `model_store.py` training pipeline — every model promotion auto-exports ONNX to model repository
- [ ] **A3.5** Create model versioning in ONNX: store version + metadata (framework, input shapes, quantization) alongside `.onnx` files
- [ ] **A3.6** Investigate INT8 quantization for tree models: use `onnxruntime.transformers.optimizer` for graph optimization + quantization
  - Test: quantized model accuracy drop < 1% vs FP32
- [ ] **A3.7** Create `ml-engine/inference/warmup.py` — runs inference on dummy data at container startup to warm up CUDA/ONNX runtime (reduces first-request latency from ~2s to ~50ms)

---

### A4. gRPC API & Client
- [ ] **A4.1** Create `proto/inference.proto` — define PredictRequest, PredictResponse, BatchPredictRequest, BatchPredictResponse, ModelMetadataRequest/Response
- [ ] **A4.2** Generate Python gRPC stubs: `python -m grpc_tools.protoc -Iproto --python_out=. --grpc_python_out=. proto/inference.proto`
- [ ] **A4.3** Generate JavaScript/TypeScript gRPC stubs for BFF: use `protoc` with `grpc_tools_node_protoc_ts` and `grpc-tools`
- [ ] **A4.4** Create `ml-engine/inference/triton_grpc_client.py` — Python client wrapping all Triton gRPC calls with proper error handling and retry logic
- [ ] **A4.5** Create `ml-engine/inference/triton_rest_client.py` — REST fallback client using `httpx` for debugging
- [ ] **A4.6** Implement gRPC connection pooling in Triton client: max 10 concurrent connections, circuit breaker (open after 5 consecutive failures, half-open after 30s)
- [ ] **A4.7** Add request timeout: 500ms for individual model inference, 2s for consensus ensemble
- [ ] **A4.8** Implement client-side load balancing: round-robin across multiple Triton pod IPs (for future multi-replica deployment)

---

### A5. Integration with ML Engine (FastAPI)
- [ ] **A5.1** Create `ml-engine/inference/triton_service.py` — FastAPI wrapper around Triton gRPC client, exposes `/inference/predict` endpoint
- [ ] **A5.2** Migrate existing `ml-engine/inference/predictor.py` to route calls through Triton instead of direct model inference
  - Add feature flag: `USE_TRITON_INFERENCE=true/false` to toggle between direct and Triton inference
- [ ] **A5.3** Add `/inference/health` endpoint — checks Triton server connectivity, returns "READY" or "DEGRADED" with latency metrics
- [ ] **A5.4** Add `/inference/models` endpoint — returns list of loaded models with version, input/output shapes, status
- [ ] **A5.5** Update `ml-engine/main.py` to mount Triton service routes
- [ ] **A5.6** Add inference latency histogram to Prometheus metrics: `triton_inference_latency_ms{model, success}`
- [ ] **A5.7** Implement graceful degradation: if Triton is unreachable, fall back to direct model inference (never return error to BFF)
- [ ] **A5.8** Add request queuing: if Triton batch queue is full, queue locally with timeout (return stale consensus if timeout exceeded)

---

### A6. Concurrency & Batching
- [ ] **A6.1** Configure Triton dynamic batching: `preferred_batch_size: [4, 8, 16]`, `max_queue_delay_us: 5000` (5ms max wait for batching)
- [ ] **A6.2** Implement client-side request coalescing: group N concurrent consensus requests into single batch call within a 5ms window
  - Create `ml-engine/inference/request_coalescer.py` — collects requests, sends batch when window expires or batch size reached
- [ ] **A6.3** Add rate limiting: max 50 concurrent inference requests to Triton (use `asyncio.Semaphore`)
- [ ] **A6.4** Benchmark baseline: measure p50/p95/p99 latency of direct model inference (no Triton) before optimization
- [ ] **A6.5** Benchmark Triton: measure same workload via Triton gRPC, compare p50/p95/p99
- [ ] **A6.6** Benchmark with dynamic batching enabled vs disabled — document improvement
- [ ] **A6.7** Benchmark with INT8 quantization vs FP32 — document accuracy/latency tradeoff

---

### A7. Observability
- [ ] **A7.1** Expose Triton Prometheus metrics: `triton_server_latency_us`, `tritonInference_request_duration_us`, `tritoninference_queue_duration_us`
- [ ] **A7.2** Add custom metrics: `inference_request_count{model, status}`, `inference_batch_size_histogram`
- [ ] **A7.3** Create Grafana dashboard: `grafana/dashboards/inference.json` — latency heatmap, throughput, error rate, GPU utilization (if GPU), batch queue depth
- [ ] **A7.4** Add alerting: page if p99 inference latency > 100ms for 5 minutes, or error rate > 1%
- [ ] **A7.5** Log every inference request: model name, input size, latency_ms, batch_size — sample 10% in production to avoid log flood
- [ ] **A7.6** Add structured logging: JSON format with `trace_id`, `model_name`, `latency_ms` fields for Jaeger trace correlation

---

### A8. Deployment & Rollout
- [ ] **A8.1** Add `k8s/triton-hpa.yaml` — HorizontalPodAutoscaler: min 1, max 5 replicas, target CPU 70%, targetGPU 80%
- [ ] **A8.2** Create blue-green deployment strategy: deploy new Triton version alongside old, run load test, switch traffic via Kubernetes Service selector
- [ ] **A8.3** Add model warmup to k8s init container: download latest models from MinIO, run warmup inference
- [ ] **A8.4** Document rollback procedure: revert Triton image tag, delete old pods, scale back up
- [ ] **A8.5** Add pre-deploy check: validate ONNX models against schema before pushing to model repository
- [ ] **A8.6** Create `scripts/reload_triton_models.sh` — triggers Triton model reload via `curl -X POST http://triton:8000/api/v1/models/reload` without restarting pods

---

## PHASE B: Step 9 — Open-Source Feature Store (Feast)

**Goal:** Centralized, versioned, low-latency feature access for training and inference.

---

### B1. Feast Architecture Decisions
- [ ] **B1.1** Audit all existing features: list every feature used in `ml-engine/features/`, `data_quality/`, `training/`. Categorize as: entity features (per symbol), aggregate features (per session), temporal features (drift indicators)
- [ ] **B1.2** Design entity definitions: `symbol` (entity_key), `timestamp` (event timestamp), `trade_id` (for trade features)
- [ ] **B1.3** Choose online store: **Redis** (already in Step 2 Redis cache layer) — document in ADR-023
- [ ] **B1.4** Choose offline store: **PostgreSQL** (already in MLflow compose) for Parquet exports — document in ADR-024
- [ ] **B1.5** Choose feature registry: ** Feast Registry** (YAML file, versioned in Git) vs Feast with Redis/PostgreSQL registry backend
- [ ] **B1.6** Define feature view granularity: should features be per-symbol-per-timestamp or per-session? Document in ADR-025
- [ ] **B1.7** Plan feature versioning strategy: increment version number on schema change, keep old versions for reproducibility
- [ ] **B1.8** Design TTL (time-to-live) per feature family: OHLCV features = 24h, regime = 1h, session aggregates = 1 week

---

### B2. Feast Project Setup
- [ ] **B2.1** Install Feast: `pip install feast==0.40.0` (latest stable) — add to `ml-engine/requirements.txt`
- [ ] **B2.2** Create `ml-engine/features/feast_repo/` directory with standard Feast layout:
  ```
  feast_repo/
    feature_repo/
      __init__.py
      entity.py          # Entity definitions
      feature_views.py    # Feature view definitions
      feature_services.py # Predefined feature sets
    data/                 # Local Parquet files for development
    feast.yaml            # Registry + online/offline store config
  ```
- [ ] **B2.3** Create `ml-engine/features/feast_repo/feature_repo/entities.py`:
  - `SymbolEntity`, `TimestampEntity`, `TradeEntity`
  - Define descriptions, join keys, value types
- [ ] **B2.4** Create `ml-engine/features/feast_repo/feature_repo/feature_views/` directory with one file per feature family:
  - `candle_features.py` — OHLCV features from `candles` table
  - `regime_features.py` — HMM/FP-FK regime indicators
  - `session_features.py` — session aggregates (avg win, range stats)
  - `trade_features.py` — trade log derived features (win rate, RRR)
  - `drift_features.py` — PSI values, distribution statistics
- [ ] **B2.5** Write Feast YAML for online store (Redis) in `feast.yaml`:
  ```yaml
  project: tradersapp
  registry: data/registry.db  # SQLite registry (gitignored)
  provider: aws  # or "gcp" / "local" — used for offline store
  online_store:
    type: redis
    connection_string: redis://redis:6379
  offline_store:
    type: postgres
    connection: postgresql://mlflow:mlflow@mlflow-postgres:5432/mlflow
  ```
- [ ] **B2.6** Create `ml-engine/features/feast_repo/scripts/materialize.py` — script to materialize features to online store with incremental updates

---

### B3. Feature View Definitions
- [ ] **B3.1** Define `CandleFeatureView`:
  - Entities: `SymbolEntity`, `EventTimestamp`
  - Sources: PostgreSQL table `candles` via `FeastFileSource` or `FeastKafkaSource`
  - Features: `open`, `high`, `low`, `close`, `volume`, `returns_1m`, `returns_5m`, `atr`, `vwap`, `returns_sma_ratio`, `volume_sma_ratio`
  - TTL: 24 hours
  - Batch materialization: every 5 minutes
- [ ] **B3.2** Define `RegimeFeatureView`:
  - Entities: `SymbolEntity`, `EventTimestamp`
  - Sources: output of `ml-engine/models/regime/regime_ensemble.py`
  - Features: `regime_type` (0-3), `regime_confidence`, `hmm_state`, `fp_fk_state`, `amd_state`, `ensemble_agreement`
  - TTL: 1 hour
  - Online materialization: on-demand after regime model runs
- [ ] **B3.3** Define `SessionFeatureView`:
  - Entities: `SymbolEntity`, `TradeDateEntity`
  - Sources: `session_aggregates` table
  - Features: `total_trades`, `win_rate`, `avg_win_ticks`, `avg_loss_ticks`, `rrr`, `range_vs_atr`, `gap_pct`, `avg_session_range`
  - TTL: 7 days
  - Batch materialization: daily after market close
- [ ] **B3.4** Define `TradeFeatureView`:
  - Entities: `TradeEntity`, `SymbolEntity`
  - Sources: `trade_log` table
  - Features: `pnl_ticks`, `pnl_dollars`, `direction`, `result`, `confidence`, `amd_phase`, `entry_session`
  - TTL: 30 days
  - Batch materialization: on each new completed trade
- [ ] **B3.5** Define `DriftFeatureView`:
  - Entities: `SymbolEntity`, `FeatureNameEntity`
  - Sources: output of `ml-engine/data_quality/statistical_expectations.py`
  - Features: `psi_value`, `ks_statistic`, `distribution_shift_detected`, `baseline_timestamp`, `current_timestamp`
  - TTL: 24 hours
  - Online materialization: after each DQ pipeline run

---

### B4. Feature Service Definitions
- [ ] **B4.1** Create `ConsensusFeatureService`:
  - Includes: CandleFeatureView (last 100 candles), RegimeFeatureView, SessionFeatureView (today's session)
  - Purpose: feed into consensus inference endpoint
- [ ] **B4.2** Create `TrainingFeatureService`:
  - Includes: all feature views with full historical range
  - Purpose: generate training dataset via `get_historical_features()`
- [ ] **B4.3** Create `DQFeatureService`:
  - Includes: DriftFeatureView, CandleFeatureView
  - Purpose: DQ pipeline drift detection
- [ ] **B4.4** Create `InferenceFeatureService`:
  - Minimal set of pre-computed features for real-time inference
  - Includes only online-store features (Redis lookup, <10ms)
- [ ] **B4.5** Version each feature service: `ConsensusFeatureService:v1`, `ConsensusFeatureService:v2`

---

### B5. Feast → Triton Integration
- [ ] **B5.1** Modify inference pipeline: before calling Triton for predictions, fetch features via `feast.get_online_features(entity_rows, feature_refs)`
  - Benchmark: Redis lookup latency should be < 5ms per entity
- [ ] **B5.2** Create `ml-engine/features/feature_fetcher.py` — thin wrapper around Feast SDK with caching, error handling, fallback to direct DB query
- [ ] **B5.3** Create `ml-engine/features/feature_store.py` — singleton pattern wrapping the Feast repo, with `get_consensus_features(symbol)`, `get_training_dataset(symbol, start_date, end_date)`
- [ ] **B5.4** Implement feature caching: Redis TTL = 30s for candle features, 5min for regime, 1h for session
- [ ] **B5.5** Add feature freshness metric: track `feature_age_seconds` per feature family, alert if > TTL
- [ ] **B5.6** Create `ml-engine/features/validate_features.py` — validates that Feast features match the schema used in training (prevents train-serve skew)

---

### B6. Offline Store & Training Pipeline
- [ ] **B6.1** Configure Feast offline store to point to existing PostgreSQL or Parquet files
- [ ] **B6.2** Create `ml-engine/features/generate_training_dataset.py`:
  - Uses `feast.get_historical_features(entity_df, feature_refs)` to pull features
  - Joins with trade labels from `trade_log`
  - Outputs Parquet file for trainer
  - DVC tracks the output Parquet file
- [ ] **B6.3** Integrate feature retrieval into `ml-engine/training/trainer.py`:
  - Before training: call `generate_training_dataset()` to fetch fresh features
  - Log feature version in MLflow: `feature_version`, `feature_service`, `entity_df_shape`
- [ ] **B6.4** Create backfill script: `ml-engine/features/backfill_features.py` — materializes all historical features to online store for fast retrieval
  - Process in chunks of 1000 rows, commit to Redis incrementally
  - Run as Airflow DAG with date range parameter
- [ ] **B6.5** Create `ml-engine/features/feature_lineage.py` — tracks which feature version was used for which model version (stored in MLflow tags)

---

### B7. Airflow DAG Integration
- [ ] **B7.1** Create `dags/feast_materialization_dag.py` (already exists, verify completeness):
  - Task `materialize_candles` — runs `feast materialize-incremental CandleFeatureView` for last 24h
  - Task `materialize_regime` — runs `feast materialize RegimeFeatureView` for last 1h
  - Task `materialize_sessions` — runs `feast materialize SessionFeatureView` for last 7 days
  - Task `backfill_if_needed` — runs backfill if online store is empty (cold start)
  - Add DQ gate BEFORE materialization (already done in existing DAG)
- [ ] **B7.2** Add materialization monitoring: log number of rows materialized, feature freshness, errors
- [ ] **B7.3** Create `dags/feast_training_dataset_dag.py`:
  - Runs weekly on Monday
  - Calls `generate_training_dataset()` for last 4 weeks
  - Stores Parquet in DVC-tracked path
  - Triggers `feedback_retrain_loop` DAG with new dataset
- [ ] **B7.4** Add alerting: alert if materialization fails, if feature freshness > 2x TTL, if Redis connection fails

---

### B8. Feast Deployment (k8s)
- [ ] **B8.1** Add Feast to `docker-compose.yml`: create `feast-server` service with `feast apply` startup
- [ ] **B8.2** Create `k8s/feast-deployment.yaml`: Feast Server (REST API on port 6566), reads from Redis online store and PostgreSQL offline store
- [ ] **B8.3** Configure Feast Server authentication: API key header (`X-Api-Key`) validation middleware
- [ ] **B8.4** Create `k8s/feast-service.yaml`: ClusterIP on port 6566, used by ML Engine pods
- [ ] **B8.5** Update ML Engine deployment: add `FEATURE_STORE_URL=http://feast:6566` env var, remove direct Redis feature lookups
- [ ] **B8.6** Create Feast UI: deploy ` feastui/feast-ui` as sidecar or separate deployment for feature discovery

---

### B9. Documentation & Governance
- [ ] **B9.1** Document all features in `docs/features/FEATURE_CATALOG.md`: name, type, source table, entity, TTL, owner, last updated
- [ ] **B9.2** Create ADR for every non-trivial Feast decision (at least 3 ADRs: online store choice, offline store choice, entity design)
- [ ] **B9.3** Write `docs/feast/USER_GUIDE.md`: how to add a new feature, how to query features, how to run backfills, common errors
- [ ] **B9.4** Create feature ownership: assign each feature view to a team member, document in `FEATURE_CATALOG.md`
- [ ] **B9.5** Add feature deprecation policy: features must be deprecated with 30-day notice before removal, documented in `FEATURE_CATALOG.md`

---

## PHASE C: Step 10 — Modular Microservices with DDD

**Goal:** Split into bounded contexts with clear ownership, gRPC contracts, and independent deployability.

---

### C1. Bounded Context Design
- [ ] **C1.1** Define **5 core bounded contexts** for TradersApp:
  - **Data Ingestion Context** — NinjaTrader CSV loader, candle ingestion API, data validation
  - **Analysis Context** — feature engineering, regime detection, session aggregation, DQ pipeline
  - **ML Inference Context** — all ML models (direction, magnitude, alpha, regime ensemble, session probability), Triton serving
  - **Execution Context** — trade signals, position sizing, exit strategy optimization, RRR calculations
  - **Telegram Bridge Context** — bot commands, user management, AI conversation, broadcast
- [ ] **C1.2** Write ADR-030: bounded context boundaries — why each context is separate, what it owns, what it does NOT own
- [ ] **C1.3** Define **context maps** — which contexts communicate with which, via what protocol (gRPC sync, Kafka async)
- [ ] **C1.4** Document **anti-corruption layers**: how the BFF translates between contexts that have slightly different entity naming
- [ ] **C1.5** Define **shared kernel**: candle data model (`Candle`, `TradeEntry`, `SessionAggregate`) is shared across contexts with strictly defined schema
- [ ] **C1.6** Create `proto/tradersapp.proto` — shared protobuf definitions for all cross-context communication

---

### C2. Repository Structure
- [ ] **C2.1** Evaluate monorepo vs polyrepo:
  - **Decision: Enhanced Monorepo** — keep all contexts in `TradersApp/` but enforce strict directory boundaries
  - Document in ADR-031: monorepo with CI-enforced boundaries (each context must be independently testable and deployable)
- [ ] **C2.2** Restructure `ml-engine/` into context subdirectories:
  ```
  ml-engine/
    context-data-ingestion/    # formerly: data/, scripts/
    context-analysis/           # formerly: features/, models/
    context-inference/         # formerly: inference/, training/
    context-execution/         # formerly: optimization/, alpha/, session/
    shared/                    # shared kernel: schemas, config, proto
  ```
- [ ] **C2.3** Create `contexts/` root directory:
  ```
  contexts/
    data-ingestion/            # NinjaTrader CSV loader + ingestion API
    analysis/                  # DQ + features + regime models
    inference/                 # ML models + Triton serving
    execution/                 # Signals + position sizing + exits
    telegram-bridge/           # Already exists at repo root
  ```
- [ ] **C2.4** Each context gets its own `pyproject.toml` / `setup.py` with explicit dependencies
- [ ] **C2.5** Create `contexts/shared/` package:
  - `shared/schemas/` — Pydantic models for shared entities (Candle, TradeEntry, ConsensusSignal)
  - `shared/proto/` — compiled protobuf stubs for all contexts
  - `shared/config/` — common config (trading hours, instrument specs)
  - `shared/exceptions/` — domain exceptions shared across contexts
- [ ] **C2.6** Enforce boundary: CI checks that `contexts/analysis/` does not import from `contexts/inference/` except via shared kernel
  - Create `scripts/enforce_boundaries.py` — static analysis tool that validates import graph

---

### C3. gRPC Contract Definitions
- [ ] **C3.1** Create `proto/tradersapp.proto` with all cross-context message types:
  ```protobuf
  package tradersapp;

  // Shared entities (shared kernel)
  message Candle { ... }
  message TradeEntry { ... }
  message SessionAggregate { ... }

  // Context: Data Ingestion → Analysis
  message IngestCandlesRequest { repeated Candle candles = 1; }
  message IngestCandlesResponse { int32 ingested = 1; string status = 2; }

  // Context: Analysis → Inference
  message GetFeaturesRequest { string symbol = 1; int64 timestamp = 2; }
  message FeatureSet { repeated Feature features = 1; }
  message Feature { string name = 1; float value = 2; }

  // Context: Inference → Execution
  message ConsensusRequest { string symbol = 1; FeatureSet features = 2; }
  message ConsensusSignal { string signal = 1; float confidence = 2; ... }

  // Context: Execution → Telegram
  message SignalBroadcast { ConsensusSignal signal = 1; string symbol = 2; ... }
  ```
- [ ] **C3.2** Generate Python stubs for each context's gRPC service
- [ ] **C3.3** Generate TypeScript/JS stubs for BFF consumption
- [ ] **C3.4** Create `proto/README.md` documenting the contract versioning policy:
  - Backward-compatible changes only (add fields, never remove/rename)
  - Version contracts with proto package version: `tradersapp.v1`, `tradersapp.v2`
  - Breaking changes require new major version + dual-serve period
- [ ] **C3.5** Set up a contract registry: JSON file tracking current proto version per context, validated by CI
- [ ] **C3.6** Add gRPC reflection (`grpc.reflection.v1alpha.grpc_reflection`) to all gRPC servers for debugging tooling

---

### C4. Context: Data Ingestion Service
- [ ] **C4.1** Create `contexts/data-ingestion/` directory with FastAPI app
- [ ] **C4.2** Move `ml-engine/data/load_ninjatrader_csv.py` → `contexts/data-ingestion/loaders/`
- [ ] **C4.3** Move candle ingestion API → `contexts/data-ingestion/api/candles.py`
- [ ] **C4.4** Create `contexts/data-ingestion/services/validation.py` — pre-write data validation (before it reaches analysis)
- [ ] **C4.5** Expose gRPC service: `DataIngestionService` with `IngestCandles()`, `IngestTradeLog()`, `GetIngestionStatus()`
- [ ] **C4.6** Create Kafka producer: on successful ingestion, publish `candle.ingested` event to Kafka topic
- [ ] **C4.7** Create Kafka consumer: listen for `NinjaTraderCSVLoaded` events, trigger downstream processing
- [ ] **C4.8** Write `Dockerfile` and `docker-compose.yml` for data-ingestion context
- [ ] **C4.9** Create `tests/data_ingestion/` — unit tests for CSV parser, validation, gRPC service

---

### C5. Context: Analysis Service
- [ ] **C5.1** Create `contexts/analysis/` directory — this is the heaviest refactor
- [ ] **C5.2** Move `ml-engine/features/` → `contexts/analysis/features/`
- [ ] **C5.3** Move `ml-engine/models/regime/` → `contexts/analysis/models/regime/`
- [ ] **C5.4** Move `ml-engine/data_quality/` → `contexts/analysis/data_quality/`
- [ ] **C5.5** Move Feast feature store → `contexts/analysis/feature_store/`
- [ ] **C5.6** Create gRPC service: `AnalysisService` with `GetFeatures()`, `GetRegime()`, `RunDataQuality()`, `MaterializeFeatures()`
- [ ] **C5.7** Kafka consumer: subscribe to `candle.ingested` topic, trigger feature computation pipeline
- [ ] **C5.8** Kafka producer: publish `features.computed`, `regime.detected`, `dq.passed/failed` events
- [ ] **C5.9** Create `Dockerfile` and `docker-compose.yml` for analysis context
- [ ] **C5.10** Write `tests/analysis/` — unit tests for feature computation, regime detection, DQ validation

---

### C6. Context: ML Inference Service
- [ ] **C6.1** Create `contexts/inference/` directory — this is the Triton context
- [ ] **C6.2** Move all model inference code → `contexts/inference/models/`
- [ ] **C6.3** Move Triton serving layer → `contexts/inference/triton/`
- [ ] **C6.4** Expose gRPC service: `InferenceService` with `PredictDirection()`, `PredictRegime()`, `PredictMagnitude()`, `PredictAlpha()`, `Consensus()`
- [ ] **C6.5** Kafka consumer: subscribe to `features.computed` topic, trigger consensus inference
- [ ] **C6.6** Kafka producer: publish `consensus.computed` event with full signal
- [ ] **C6.7** Create `Dockerfile` (with Triton) and `docker-compose.yml` for inference context
- [ ] **C6.8** Write `tests/inference/` — unit tests for each model, integration tests with Triton

---

### C7. Context: Execution Service
- [ ] **C7.1** Create `contexts/execution/` directory
- [ ] **C7.2** Move `ml-engine/optimization/`, `ml-engine/alpha/`, `ml-engine/session/` → `contexts/execution/`
- [ ] **C7.3** Create gRPC service: `ExecutionService` with `CalculatePositionSize()`, `CalculateExits()`, `CalculateRRR()`, `GetSessionProbability()`
- [ ] **C7.4** Kafka consumer: subscribe to `consensus.computed` topic, compute execution parameters
- [ ] **C7.5** Kafka producer: publish `execution.ready` event with full signal + exits + position size
- [ ] **C7.6** Create `Dockerfile` and `docker-compose.yml` for execution context
- [ ] **C7.7** Write `tests/execution/` — unit tests for optimization algorithms, exit calculations

---

### C8. BFF (Context Facade)
- [ ] **C8.1** Refactor `bff/` to be a pure API gateway — no business logic, only orchestration
- [ ] **C8.2** Create `bff/grpc/` directory with gRPC clients for each context:
  - `dataIngestionClient.js` — gRPC calls to ingestion context
  - `analysisClient.js` — gRPC calls to analysis context
  - `inferenceClient.js` — gRPC calls to inference context
  - `executionClient.js` — gRPC calls to execution context
- [ ] **C8.3** Refactor `bff/routes/consensusRoutes.mjs`:
  - Call `analysisClient.GetFeatures()` → get features from Feast
  - Call `inferenceClient.Consensus()` → get signal from ML
  - Call `executionClient.CalculateExits()` → get exits and position size
  - Aggregate responses into unified JSON for frontend
- [ ] **C8.4** Implement circuit breaker per gRPC client: open after 5 failures, half-open after 30s, close after 3 successes
- [ ] **C8.5** Implement request timeout: 5s per gRPC call, total BFF timeout 10s
- [ ] **C8.6** Add distributed tracing: inject `trace_id` into gRPC metadata, propagate across all context calls
- [ ] **C8.7** Update `bff/Dockerfile` to include gRPC-Web proxy (`improbable-eng/grpc-web`) if browsers need gRPC

---

### C9. Kafka Event Contracts
- [ ] **C9.1** Define all Kafka topics with Avro or Protobuf schemas:
  - `candle.ingested` — schema: symbol, timestamp, ohlcv
  - `features.computed` — schema: symbol, timestamp, feature_set_id
  - `regime.detected` — schema: symbol, regime_type, confidence, timestamp
  - `dq.passed` / `dq.failed` — schema: run_id, suites, critical_failures
  - `consensus.computed` — schema: symbol, signal, confidence, votes, exits
  - `execution.ready` — schema: symbol, signal, position_size, stops, targets
  - `feedback.trade_closed` — schema: trade_id, outcome, pnl_ticks
- [ ] **C9.2** Use Schema Registry (Confluent or Karapace) to manage Avro schemas
  - Register all 7+ topic schemas
  - Enable schema compatibility checking (BACKWARD_COMPATIBLE)
- [ ] **C9.3** Create `scripts/generate_schemas.py` — generates Avro schemas from proto definitions
- [ ] **C9.4** Implement dead-letter queue (DLQ): `consensus.computed.dlq` for failed messages, with replay capability
- [ ] **C9.5** Create `scripts/replay_dlq.py` — reads failed messages from DLQ, retries with exponential backoff
- [ ] **C9.6** Add consumer group lag monitoring: Prometheus metric per consumer group, alert if lag > 1000 messages for 10 minutes

---

### C10. Independent Deployment & CI/CD
- [ ] **C10.1** Create Docker build for each context:
  - `contexts/data-ingestion/Dockerfile`
  - `contexts/analysis/Dockerfile`
  - `contexts/inference/Dockerfile`
  - `contexts/execution/Dockerfile`
- [ ] **C10.2** Update Woodpecker CI (Step 16): add per-context pipelines:
  ```yaml
  steps:
    - context/data-ingestion: lint + test + docker build
    - context/analysis: lint + test + docker build
    - context/inference: lint + test + docker build + gpu test
    - context/execution: lint + test + docker build
    - contexts/bff: lint + test + docker build
  ```
- [ ] **C10.3** Implement per-context deployment: each context deploys independently to k8s
  - `kubectl apply -f contexts/data-ingestion/k8s/`
  - `kubectl apply -f contexts/analysis/k8s/`
  - etc.
- [ ] **C10.4** Create context dependency graph in CI: `data-ingestion` can deploy anytime, `analysis` requires `data-ingestion` healthy, `inference` requires `analysis` healthy, etc.
- [ ] **C10.5** Implement canary deployment: 5% traffic to new context version, monitor error rate, auto-promote or rollback
- [ ] **C10.6** Add smoke tests: per-context CI pipeline runs integration test against deployed context
- [ ] **C10.7** Create `scripts/ci_context_boundaries.sh` — enforces that changed files in context A cannot cause tests to fail in context B (except shared kernel)

---

## SUMMARY TABLE

| Phase | # Tasks | Primary Effort |
|-------|---------|---------------|
| A: Triton/vLLM | 48 tasks (A1.1–A8.6) | 3-5 days |
| B: Feast | 39 tasks (B1.1–B9.5) | 3-5 days |
| C: DDD Microservices | 52 tasks (C1.1–C10.7) | 4-6 weeks |
| **Total** | **~139 tasks** | **~8-12 weeks** |

---

## CRITICAL PATH

```
Step 8 (Triton):
  A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8
  Weeks 1-2

Step 9 (Feast):
  B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9
  Weeks 2-4 (parallel with Step 8 refinement)

Step 10 (DDD):
  C1 → C2 → C3 → C4 → C5 → C6 → C7 → C8 → C9 → C10
  Weeks 4-12 (parallel with Steps 8-9)
```

---

## DEPENDENCIES

| This Step | Requires |
|-----------|----------|
| A (Triton) | Step 1 (k3s), Step 6 (MLflow) |
| B (Feast) | Step 2 (Redis), Step 6 (MLflow), Step 7 (Airflow) |
| C (DDD) | Steps 1, 2, 6, 7, 8, 9 (cumulative) |
