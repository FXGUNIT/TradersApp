# TradersApp Architecture

**Graph: 698 files | 5547 nodes | 40 958 edges | 5 execution flows**
**Languages: JavaScript (src, bff, telegram-bridge) · Python (ml-engine) · Bash (scripts) · PowerShell**
**Last built: 2026-04-15**

---

## Services

```
┌─────────────────────────────────────────────────────────────┐
│  TradersApp Monorepo                                          │
│                                                              │
│  src/          React Frontend        (1143 nodes)  port 5173 │
│  bff/          Node.js BFF           ( 492 nodes)  port 8788 │
│  ml-engine/    Python FastAPI        (2146 nodes)  port 8001 │
│  telegram-bridge/  Telegram bot      (  46 nodes)  port 8088 │
│  scripts/      Automation            ( 404 nodes)           │
│  tests/        Integration suite    ( 304 nodes)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. src/ — React Frontend

**Entry:** `src/main.jsx` → `src/pages/CollectiveConsciousness.jsx`

**Feature directories** (`src/features/`):
- `consensus/` — ConsensusSignal container + 14 sub-panels (SessionProbability, AlphaDisplay, ExitStrategy, RRR, PositionSizing, ModelVotes, etc.)
- `shell/` — App routing, registry, layout shell
- `terminal/` — MainTerminal (1581 lines — largest single file in project)
- `identity/` — Auth flow handlers: AuthStateContext, credential handlers, session handlers, admin access
- `admin-security/` — RBAC enforcement
- `onboarding/` — CleanOnboarding, OnboardingProgress, OnboardingSteps pages
- `hub-content/` — RegimentHub, RegimentEULA pages
- `compliance/` — Legal pages: PrivacyPolicy, TermsOfService, EULASections
- `support/` — FloatingChatWidget, ChatHelpline

**Shared components** (`src/components/`): BreakingNewsPanel, AdminMessagePanel, AiEnginesStatus, CommandPalette, ConfettiCelebration, FeatureGuard, MobileBottomNav, ThemeSwitcher, NotificationCenter, etc.

**State:** Feature containers own all API calls; sub-components are pure `props → UI` with `React.memo`. Error contract: `isLoading → WarRoomLoader | error → "Service Unavailable" | data → content`.

**API clients** (`src/services/`):
- `ConsensusClient` + `consensusGateway.js` → BFF `/ml/consensus`
- Zustand stores per feature

**Build:** Vite · No jQuery · No lodash full import · `React.lazy()` for code splitting

---

## 2. bff/ — Node.js BFF (Backend-for-Frontend)

**Entry:** `bff/server.mjs`

**Routes** (`bff/routes/`):
| Route | Responsibility |
|---|---|
| `consensusRoutes.mjs` | ML consensus orchestration |
| `newsRoutes.mjs` | News feed aggregation |
| `boardRoomRoutes.mjs` | Multi-agent coordination layer |
| `terminalRoutes.mjs` | Screenshot/CSV upload → ML pipeline |
| `terminalAnalyticsRoutes.mjs` | Analytics from terminal data |
| `identityRoutes.mjs` | Auth lifecycle, session mgmt |
| `adminRoutes.mjs` | Admin dashboard, user management |
| `onboardingRoutes.mjs` | Guided onboarding flow |
| `contentRoutes.mjs` | Hub content delivery |
| `supportRoutes.mjs` | Support chat |
| `telegramRoutes.mjs` | Telegram webhook bridge |
| `tradeCalcRoutes.mjs` | Trade return calculator |

**Services** (`bff/services/`):
| Service | Responsibility |
|---|---|
| `consensusEngine.mjs` | Calls ml-engine, aggregates votes |
| `consensusAggregator.mjs` | Vote aggregation logic |
| `newsService.mjs` | News fetch with circuit breaker |
| `breakingNewsService.mjs` | Breaking news detection |
| `boardRoomService.mjs` | Board Room coordination |
| `boardRoomAgentReporter.mjs` | Agent scorecard reporting |
| `boardRoomTelegram.mjs` | Telegram notifications for Board Room |
| `terminalAnalyticsService.mjs` | Terminal data analytics |
| `tradeCalcService.mjs` | Trade return calculation |
| `security.mjs` | Rate limiting, HSTS, Helmet, RBAC |
| `enhanced-security.mjs` | Per-route rate limits |
| `keycloak.mjs` | Keycloak OIDC integration |
| `keycloakJwtVerifier.mjs` | JWT verification |
| `redis-session-store.mjs` | Redis-backed session store |
| `analysisTransport.mjs` | Analysis result transport |
| `contentCatalog.js` | Hub content catalog |

**Middleware:** `bff/_dispatch.mjs` · `bff/_dispatchRoutes.mjs` · `bff/analysisMiddleware.mjs` · `bff/metrics.mjs` · `bff/analysisFormatters.mjs`

**Security:** IDOR gap on `/identity/users/:uid` — needs ownership check. `/identity` routes bypass dispatch auth. No CSRF tokens. SSRF possible on outbound requests. Telegram bridge: key read from headers only, constant-time comparison missing.

**Ports:** BFF 8788 · Telegram bridge 8088

---

## 3. ml-engine/ — Python FastAPI ML Engine

**Entry:** `ml-engine/main.py`

**Route modules** (`ml-engine/_routes_*.py`):
| Module | Endpoints |
|---|---|
| `_routes_data.py` | `GET /candles`, `POST /candles/bulk`, `GET /regime`, `GET /session` |
| `_routes_features.py` | `GET /features`, `POST /features/enrich` |
| `_routes_backtest.py` | `POST /backtest`, `GET /backtest/results` |
| `_routes_pso.py` | `POST /optimize/pso`, `POST /optimize/rrr` |
| `_routes_news.py` | `GET /news/sentiment`, `GET /news/breaking` |
| `_routes_workflow.py` | `POST /workflow/train`, `POST /workflow/retrain` |

**Infrastructure** (`ml-engine/`):
- `_lifespan.py` — FastAPI lifespan, Redis connect, graceful shutdown
- `_infrastructure.py` — Redis, circuit breaker, idempotency service, cache stampede protection
- `_kafka.py` — Kafka exactly-once semantics
- `_middleware.py` — Request logging, latency tracking
- `_health.py` — Health check endpoint

**Models** (`ml-engine/models/`):
- `direction/` — lightgbm, xgboost, random_forest, svm, neural_net, amd_classifier
- `regime/` — fp_fk_regime (1357L), hmm_regime, anomalous_diffusion, regime_ensemble
- `session/` — session_probability
- `magnitude/` — move_magnitude
- `mamba/` — mamba_sequence_model
- `onnx/` — ONNX exported models
- `store/` — Serialized `.pkl` + `.meta.json` artifacts

**Inference** (`ml-engine/inference/`): predictor, consensus_aggregator, explainer, batching, benchmark_latency, triton_client, triton_model, vllm_server, onnx_exporter

**Optimization** (`ml-engine/optimization/`): pso_optimizer, rrr_optimizer, exit_optimizer, position_sizer

**Data** (`ml-engine/data/`): candle_db (1673L — largest file in project), load_ninjatrader_csv, schema.sql, feature_pipeline, session_aggregates

**Features** (`ml-engine/features/`): feature_pipeline, candle_features, session_aggregates, feast_client, feature_lineage

**Configuration:** `config.py` — all hyperparameters; no magic numbers inline

**MLflow:** Self-hosted (port 5000) · MinIO artifact store · DVC model versioning

**Latency SLA:** ML Consensus < 200ms (hard limit) · BFF → ML Engine < 5s timeout

**Known gaps:** SQLite WAL mode enabled (thread-safe concurrent reads). Drift detection with continual learning (EWC + replay buffer). SLA monitoring with P50/P95/P99 per endpoint.

---

## 4. telegram-bridge/ — Telegram Bot + Web Server

**Entry:** `telegram-bridge/index.js`

**Modules:**
| Module | Responsibility |
|---|---|
| `index.js` | Telegram webhook + web server (port 8088) |
| `botCommands.js` | `/start`, `/signal`, `/status` commands |
| `botBroadcast.js` | Admin broadcast to all users |
| `botState.js` | Conversation state machine |
| `aiConversation.js` | AI response orchestration |
| `aiProviders.js` | Provider selection (Keycloak/AI) |
| `aiFormatters.js` | Response formatting per intent |
| `invitesService.js` | Invite code management |
| `firebaseAdmin.js` | Firebase Admin SDK |

**Auth:** Telegram bot API key read from request headers only. No hardcoded secrets. Constant-time string comparison gap on key verification.

---

## 5. scripts/ — Automation & Infrastructure

**K8s** (`scripts/k8s/`): benchmark-cold-start.py, HPA scaling, cold/warm cache load, live cluster validation, secret contract, K8s cache coherence checker

**UI Audit** (`scripts/ui-audit/`): run-ui-audit.mjs — Chrome/Edge paths defined (no Firefox/Safari/Playwright)

**Airflow** (`scripts/`): DVC pipeline, DVC setup, Airflow DAGs for data quality

**Setup** (`scripts/setup-infisical.ps1`, `scripts/setup-production.ps1`): Secrets push to Infisical → Railway/Vercel

**Auto** (`scripts/`): auto_backup.py — annotated git backup commits

---

## 6. tests/ — Integration & Chaos Test Suite

**Chaos** (`tests/chaos/`): MLEngineDowntimeChaos, RedisFailureChaos, CorruptDataChaos, MLflowUnavailableChaos, DatabaseConnectionPoolChaos, DriftInjectionChaos, MemoryPressureChaos

**E2E Playwright** (`tests/e2e/playwright/`): browser-compatibility.spec.js, floating-chat.spec.js, ui-quality-matrix.spec.js

**Note:** No Playwright browser matrix for CI. Only Chrome/Edge paths defined. Frontend has zero unit tests.

---

## Critical Execution Flows

| Criticality | Flow | Depth | Files |
|---|---|---|---|
| 0.864 | `AdminDashboardScreen` | 4 | 22 |
| 0.818 | `handleApprove` (admin action) | 5 | 5 |
| 0.812 | `createSyncedAuthSession` | 5 | 5 |
| 0.792 | `TradersRegiment` (trading pipeline) | 6 | 66 |
| 0.777 | `handleLogoutOtherDevices` | 4 | 5 |

---

## Data Flow

```
User → React (src/)
      → BFF (bff/server.mjs :8788)
          → ml-engine (ml-engine/main.py :8001)     [ML predictions]
          → News APIs                                  [3s timeout]
          → Redis session store
          → Keycloak                                   [OIDC auth]
          → Telegram bridge (:8088)                   [alerts/broadcasts]
      → telegram-bridge (telegram-bridge/index.js :8088)
          → Firebase Admin
          → Telegram Bot API
```

**Request coalescing** + **Redis cache stampede protection** on consensus endpoint.
**Idempotency-Key header** for exactly-once semantics on mutations.
**Circuit breaker** on all external calls (5 failures / 30s → auto-open).

---

## Oversized Files (Action Required)

| Lines | File | Violation |
|---|---|---|
| 1673 | `ml-engine/data/candle_db.py` | >600 line Python limit |
| 1581 | `src/features/terminal/MainTerminal.jsx` | >300 line React limit |
| 1500 | `MainTerminal` function | >300 line component limit |
| 1357 | `ml-engine/models/regime/fp_fk_regime.py` | >600 line Python limit |
| 1083 | `scripts/ui-audit/run-ui-audit.mjs` | >500 line JS limit |
| 1067 | `ml-engine/backtest/pbo_engine.py` | >600 line Python limit |
| 1001 | `ml-engine/infrastructure/mlflow_client.py` | >600 line Python limit |
| 984 | `ml-engine/infrastructure/prometheus_exporter.py` | >600 line Python limit |

**CLAUDE.md rule: split files exceeding their size limit.** These 8 files are the priority targets for decomposition.

---

## Graph Community Map

```
tests-predict (ml-engine)    2146 nodes  — Python ML models + tests
services-handle (src)        1143 nodes  — React components + features
services-admin (bff)          492 nodes  — BFF routes + services
k8s-check (scripts)          404 nodes  — K8s + infra scripts
integration-endpoint (tests)  304 nodes  — Test suites + chaos
telegram-bridge-call           46 nodes  — Telegram bot modules
dags-data                      43 nodes  — Airflow DAGs
scripts-images                 31 nodes  — Docker/k8s configs
```

Cross-community coupling: 0 detected edges between communities (isolated clusters — verify this is intentional for the microservices architecture).

---

## Verified Properties (from R01–R20)

| Property | Status |
|---|---|
| Fresh clone reproducibility | R01 ✅ |
| Frontend flow coverage | R02 ✅ |
| Auth lifecycle security | R03 ✅ partial |
| Privilege bypass gaps | R04 ✅ known gaps |
| Upload/OCR robustness | R05 ✅ |
| Metrics numerical correctness | R06 ✅ |
| BFF route contracts | R07 ✅ |
| ML Engine correctness | R08 ✅ |
| Cross-service integration | R09 ✅ |
| Persistence layer | R10 ✅ |
| Failure handling | R11 ✅ |
| Security posture | R12 ✅ residual gaps |
| Performance budgets | R13 ✅ partial |
| Stability/soak | R14 ✅ |
| Browser coverage | R15 ❌ Playwright absent |
| Accessibility | R16 ✅ partial |
| Deployability | R17 ✅ 4 gaps |
| Observability | R18 ✅ 4 gaps |
| Verification harness | R19 ⚠️ partial |
| Final release gate | R20 ⚠️ in progress |

---

## Known Security Gaps (R12)

- **IDOR** on `/identity/users/:uid` — returns any user record
- **`/identity` routes** bypass dispatch layer auth (two-layer bypass)
- **No CSRF tokens** anywhere in BFF
- **SSRF possible** in BFF outbound request handling
- **Constant-time comparison missing** on Telegram bridge key verification
- **SQLite f-string** table name interpolation in `candle_db.py`

---

## File Size Limits (enforced by CLAUDE.md anti-patterns)

| Language | Hard Limit |
|---|---|
| Python | 600 lines |
| JS/TS | 500 lines |
| React components | 300 lines |
| Shell scripts | 200 lines |
