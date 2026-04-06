## Autonomy & No-Permission Rule (Highest Priority - Applies to Claude and Copilot Agents)

- After I give any to-do list or task, work completely autonomously.
- Never show any permission prompts, confirmation dialogs, or 3-option stoppages.
- Auto-approve ALL actions: Read, Edit, Write, Bash, MCP tools, terminal commands, etc.
- Only stop and ask me if the action is extremely dangerous (e.g., deleting the entire project, formatting the drive, or accessing secret keys).
- This rule applies to both Claude Code and any Copilot/Codex agent features.
- Proceed safely and summarize what you did at the end of each major step.
# TradersApp â€” Claude Code Architectural Guide

**Last Updated:** 2026-04-03

---

## Monorepo Scoping â€” ZERO MICROMANAGEMENT

**Every reply starts with:** `Scoped to: [folder] â€” [description]`

### Scope Detection (Priority Order)
1. **Error pasted** â†’ Stack trace, file paths, service names â†’ auto-detect microservice
2. **File open in editor** â†’ That file's folder
3. **Unclear** â†’ Ask for error text only. NEVER ask for clicks or file names.

### Microservice Detection Keywords

| Error Contains | Scope To |
|---|---|
| `src/`, `.jsx`, `vite`, `npm run`, `src/App.jsx` | `src/` (Frontend) |
| `bff/`, `server.mjs`, `.mjs`, `/api/` | `bff/` (BFF) |
| `ml-engine/`, `.py`, `fastapi`, `lightgbm` | `ml-engine/` |
| `telegram-bridge/`, `telegram`, `bot` | `telegram-bridge/` |
| `scripts/`, `.ps1` | `scripts/` |

### Once Scoped â€” Rules
- **ONLY** read, search, edit files inside that microservice folder
- **PLUS** `scripts/`, `CLAUDE.md`, `.claude/` if needed
- **NEVER** load code from other microservices unless you type `@service-name`
- **Multi-service error**: Scope to primary, note it, expand only on explicit `@mention`

### Token Economy
- **Use `/compact` when context > 60%** â€” never let context bloat slow things
- **Grep before read** â€” never read a file before grepping it
- **Specific reads over globbing** â€” `Read file:123` not `glob **/*.js`
- **Never load archives** â€” skip `.bak`, `.backup`, `archive/` files

---

## Core Principles

### 1. Never Create a Monolith
Every component is a **separate, independently deployable unit** with its own:
- Clear input/output contract
- Own directory (`src/features/X/`, `ml-engine/X/`, `bff/services/`)
- Own tests (`tests/`, `*.test.ts`, `pytest tests/X/`)
- Own README if complex

### 2. Module Naming â€” Be Explicit, Not Clever
```
Good:  src/features/consensus/sessionProbabilityEngine.js
Bad:   src/features/consensus/engine.js
Good:  ml-engine/optimization/pso_optimizer.py
Bad:   ml-engine/opt.py
```

### 3. File Size Hard Limit
- **Python files**: â‰¤ 600 lines. If exceeding, split into `_core.py`, `_utils.py`, `_api.py`
- **JS/TS files**: â‰¤ 500 lines. Split at logical boundaries.
- **React components**: â‰¤ 300 lines. Extract sub-components to sibling files.
- **Shell scripts**: â‰¤ 200 lines.

### 4. Every New Feature Gets Its Own Directory
```
New Feature: "Session Fatigue Tracker"
CREATE:
  src/features/sessionFatigue/
    SessionFatigueTracker.jsx       â€” main component
    SessionFatigueCard.jsx          â€” sub-component
    useSessionFatigue.js            â€” hook
    sessionFatigueService.js        â€” data fetching
    sessionFatigueGateway.js         â€” BFF communication
    sessionFatigue.types.ts          â€” type definitions
  ml-engine/session/
    fatigue_tracker.py              â€” backend logic
  tests/
    sessionFatigue.test.tsx
    fatigue_tracker.test.py
DONT: append to existing files like CollectiveConsciousness.jsx
```

### 5. Async-First, Concurrent by Default
```javascript
// BAD â€” sequential
const news = await fetchNews();
const consensus = await fetchConsensus();
const regime = await fetchRegime();

// GOOD â€” concurrent, same latency as slowest single call
const [news, consensus, regime] = await Promise.all([
  fetchNews(),
  fetchConsensus(),
  fetchRegime(),
]);
```

### 6. Fail-Secure at Every Layer
```
Layer: Frontend Component
  - Show loading state immediately
  - Show "unavailable" fallback if service fails
  - Never crash the whole app

Layer: BFF Service
  - Circuit breaker on every external call
  - Timeout: 5s max for ML Engine, 3s for news
  - Return stale data with age warning if service down

Layer: ML Engine
  - Always return a valid response (even NEUTRAL fallback)
  - Guardrails on every output
  - Never throw uncaught exceptions to the caller
```

### 7. Typed Boundaries Between Services
Every cross-service call has explicit types:
```typescript
// BFF â†’ ML Engine (mjs)
interface MLConsensusRequest {
  candles: CandleData[];
  features: MathEngineSnapshot;
  regime: RegimeType;
  tradeLog?: TradeEntry[];
}

// ML Engine â†’ BFF (Python Pydantic)
class ConsensusResponse(BaseModel):
    signal: Literal["LONG", "SHORT", "NEUTRAL"]
    confidence: float = Field(ge=0, le=0.9999)
    votes: dict
    alpha: AlphaOutput
    # ... explicit schema, no magic fields
```

### 8. Test at Boundaries, Not Internals
```
Priority 1: Test BFF routes (does /ml/consensus return correct shape?)
Priority 2: Test ML Engine endpoints (does /predict return valid signal?)
Priority 3: Test React components with mocked services
Priority 4: Unit tests for pure utility functions
```
Never test private methods. Test public contracts only.

### 9. Configuration Over Hardcoding
```
BAD:  const SL_TICKS = 20;
GOOD: const SL_TICKS = parseInt(import.meta.env.VITE_DEFAULT_SL_TICKS ?? '20', 10);
      // In ML Engine: from config import SL_TICKS_DEFAULT
```
All magic numbers live in `config.py`, `.env.local`, or environment variables. Never hardcode a threshold, multiplier, or limit inline.

### 10. Backup Before Every Significant Change
After completing any feature, run:
```bash
python scripts/auto_backup.py "Add Session Fatigue Tracker"
```
The pre-commit hook (`git/hooks/pre-commit`) auto-creates a backup tag. The auto_backup script creates an annotated commit with the message. Both run independently.

---

## Directory Structure Contract

```
TradersApp/
â”œâ”€â”€ bff/                         # Node.js BFF â€” port 8788
â”‚   â”œâ”€â”€ server.mjs               # Express app entry (ONLY orchestration)
â”‚   â”œâ”€â”€ routes/                  # One file per route group
â”‚   â”‚   â”œâ”€â”€ consensusRoutes.mjs
â”‚   â”‚   â”œâ”€â”€ newsRoutes.mjs
â”‚   â”‚   â””â”€â”€ supportRoutes.mjs
â”‚   â”œâ”€â”€ services/                # One file per service
â”‚   â”‚   â”œâ”€â”€ consensusEngine.mjs
â”‚   â”‚   â”œâ”€â”€ newsService.mjs
â”‚   â”‚   â”œâ”€â”€ breakingNewsService.mjs
â”‚   â”‚   â”œâ”€â”€ supportChatService.mjs
â”‚   â”‚   â”œâ”€â”€ mlClients.mjs        # All ML Engine HTTP calls
â”‚   â”‚   â””â”€â”€ security.mjs        # Rate limiting, HSTS, Helmet
â”‚   â””â”€â”€ Dockerfile
â”‚
â”œâ”€â”€ ml-engine/                   # Python FastAPI â€” port 8001
â”‚   â”œâ”€â”€ main.py                  # FastAPI entry (routing ONLY)
â”‚   â”œâ”€â”€ config.py                 # All hyperparameters
â”‚   â”œâ”€â”€ data/                     # Database layer
â”‚   â”‚   â”œâ”€â”€ candle_db.py
â”‚   â”‚   â”œâ”€â”€ schema.sql
â”‚   â”‚   â””â”€â”€ load_ninjatrader_csv.py
â”‚   â”œâ”€â”€ features/                 # Feature engineering pipeline
â”‚   â”‚   â”œâ”€â”€ feature_pipeline.py
â”‚   â”‚   â”œâ”€â”€ candle_features.py
â”‚   â”‚   â””â”€â”€ session_aggregates.py
â”‚   â”œâ”€â”€ models/                   # One subdir per model family
â”‚   â”‚   â”œâ”€â”€ direction/
â”‚   â”‚   â”œâ”€â”€ session/
â”‚   â”‚   â”œâ”€â”€ magnitude/
â”‚   â”‚   â”œâ”€â”€ alpha/
â”‚   â”‚   â”œâ”€â”€ regime/
â”‚   â”‚   â”‚   â”œâ”€â”€ hmm_regime.py
â”‚   â”‚   â”‚   â”œâ”€â”€ fp_fk_regime.py
â”‚   â”‚   â”‚   â”œâ”€â”€ anomalous_diffusion.py
â”‚   â”‚   â”‚   â””â”€â”€ regime_ensemble.py
â”‚   â”‚   â””â”€â”€ mamba/
â”‚   â”‚       â””â”€â”€ mamba_sequence_model.py
â”‚   â”œâ”€â”€ training/
â”‚   â”‚   â”œâ”€â”€ trainer.py
â”‚   â”‚   â”œâ”€â”€ cross_validator.py
â”‚   â”‚   â””â”€â”€ model_store.py
â”‚   â”œâ”€â”€ inference/
â”‚   â”‚   â”œâ”€â”€ predictor.py
â”‚   â”‚   â”œâ”€â”€ consensus_aggregator.py
â”‚   â”‚   â””â”€â”€ explainer.py
â”‚   â”œâ”€â”€ optimization/
â”‚   â”‚   â”œâ”€â”€ pso_optimizer.py
â”‚   â”‚   â”œâ”€â”€ rrr_optimizer.py
â”‚   â”‚   â”œâ”€â”€ exit_optimizer.py
â”‚   â”‚   â””â”€â”€ position_sizer.py
â”‚   â”œâ”€â”€ alpha/
â”‚   â”‚   â””â”€â”€ alpha_engine.py
â”‚   â”œâ”€â”€ session/
â”‚   â”‚   â””â”€â”€ session_probability.py
â”‚   â”œâ”€â”€ infrastructure/
â”‚   â”‚   â”œâ”€â”€ performance.py        # Redis, circuit breaker, SLA
â”‚   â”‚   â”œâ”€â”€ continual_learning.py # EWC, replay buffer
â”‚   â”‚   â””â”€â”€ evaluation.py        # drift, A/B, guardrails
â”‚   â”œâ”€â”€ tests/
â”‚   â”‚   â””â”€â”€ test_*.py
â”‚   â””â”€â”€ Dockerfile
â”‚
â”œâ”€â”€ src/                         # React Frontend
â”‚   â”œâ”€â”€ pages/
â”‚   â”‚   â”œâ”€â”€ CollectiveConsciousness.jsx  # Import all consensus sub-components
â”‚   â”‚   â””â”€â”€ *.jsx
â”‚   â”œâ”€â”€ features/                # Feature-scoped directories
â”‚   â”‚   â”œâ”€â”€ consensus/
â”‚   â”‚   â”‚   â”œâ”€â”€ ConsensusSignal.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ SessionProbabilityPanel.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ AlphaDisplay.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ ExitStrategyPanel.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ RRRRecommendation.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ PositionSizingPanel.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ TimingRecommendation.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ ModelVotesPanel.jsx
â”‚   â”‚   â”‚   â””â”€â”€ NewsCountdown.jsx
â”‚   â”‚   â”œâ”€â”€ shell/               # App shell, registry, routing
â”‚   â”‚   â””â”€â”€ support/
â”‚   â”œâ”€â”€ components/              # Shared/reusable components
â”‚   â”‚   â”œâ”€â”€ BreakingNewsPanel.jsx
â”‚   â”‚   â”œâ”€â”€ AdminMessagePanel.jsx
â”‚   â”‚   â””â”€â”€ *.jsx
â”‚   â””â”€â”€ services/
â”‚       â”œâ”€â”€ clients/
â”‚       â”‚   â””â”€â”€ ConsensusClient.js
â”‚       â””â”€â”€ gateways/
â”‚           â””â”€â”€ consensusGateway.js
â”‚
â”œâ”€â”€ telegram-bridge/
â”‚   â”œâ”€â”€ index.js                 # Telegram bot + web server
â”‚   â”œâ”€â”€ aiConversation.js        # AI response formatters
â”‚   â””â”€â”€ userRegistry.js          # User management
â”‚
â”œâ”€â”€ scripts/
â”‚   â”œâ”€â”€ auto_backup.py           # CLI git backup tool
â”‚   â”œâ”€â”€ setup-infisical.ps1      # Push secrets to Infisical
â”‚   â””â”€â”€ setup-production.ps1     # Push secrets to Railway/Vercel
â”‚
â””â”€â”€ docs/
    â”œâ”€â”€ DEPLOYMENT.md
    â”œâ”€â”€ SETUP.md
    â”œâ”€â”€ SECRETS_ARCHITECTURE.md
    â””â”€â”€ TODO_MASTER_LIST.md
```

---

## ML Engine Architecture Rules

### Models Follow Strict Patterns
Every ML model follows one of these patterns:
```python
# Pattern 1: Classifier
class DirectionModel:
    def __init__(self): ...
    def train(self, X, y): ...
    def predict(self, X) -> dict: ...  # {signal, confidence, probability}

# Pattern 2: Regressor
class AlphaModel:
    def train(self, X, y): ...
    def predict(self, X) -> dict: ...  # {alpha_score, confidence, components}

# Pattern 3: Ensemble
class RegimeEnsemble:
    def predict(self, X) -> dict: ...  # merges HMM + FP-FK + Anomalous Diffusion
```

### Every Model Has:
1. `train(X, y)` â€” with TimeSeriesSplit CV
2. `predict(X) -> dict` â€” with explicit return shape
3. `get_feature_importance()` â€” SHAP or permutation importance
4. Guardrails on all outputs
5. Graceful fallback when data insufficient

### No Global State in ML Engine
```
BAD:  global_model = None
      def get_model(): ...
GOOD: class DirectionModel:
          _instance = None
          @classmethod
          def get_instance(cls): ...
```
Use singletons or dependency injection. No global mutable state.

---

## React Architecture Rules

### Component Hierarchy
```
Page (CollectiveConsciousness.jsx)
  â””â”€ Feature Container (ConsensusSignal.jsx)       # Fetches data, owns state
       â”œâ”€ SectionCard (SessionProbabilityPanel.jsx)  # Displays one concern
       â”œâ”€ SectionCard (AlphaDisplay.jsx)
       â”œâ”€ SectionCard (ExitStrategyPanel.jsx)
       â””â”€ ...
```

### State Ownership
- **Feature Container** owns all API calls and state
- **Sub-components** are pure: `props -> UI`
- **Never** fetch data in a sub-component (except with `useQuery`/`useSuspenseQuery`)
- **Always** wrap sub-components in `React.memo()` when they receive stable props

### Error Handling Contract
```javascript
// Feature Container: always has these states
const { data, isLoading, error } = useQuery(...);
// Renders:
// - isLoading â†’ WarRoomLoader
// - error â†’ "Service Unavailable" with retry
// - data â†’ actual content
```

---

## API Design Rules

### BFF â†’ ML Engine Contract
All ML Engine endpoints return:
```python
class BaseResponse(BaseModel):
    ok: bool
    error: str | None = None
    latency_ms: float
    timestamp: str  # ISO8601
```

### Every Endpoint Has:
- Input validation (Pydantic/Zod)
- Timeout (5s default)
- Circuit breaker
- Error response shape (never crash)
- Health check at `GET /health`

---

## Dependency Rules

### Python Dependencies
- Core: `numpy`, `pandas`, `scikit-learn`, `lightgbm`, `xgboost`, `fastapi`, `uvicorn`
- Optional: `torch` (Mamba), `redis` (cache), `hmmlearn`, `shap`, `kernc-backtesting`
- Import guard: `try: import torch` / `except ImportError: ...`

### JS Dependencies
- Core: `react`, `vite`, `axios`, `zustand`
- Optional: `@tanstack/react-query`, `firebase`
- No jQuery, no lodash full import (use `lodash-es` or direct imports)

---

## Data Versioning (DVC)

**Every dataset, model, and experiment is versioned with DVC + Git.** No exception â€” reproducibility is non-negotiable.

### DVC Setup
```bash
python -m dvc init
python -m dvc remote add -d storage ml-engine/dvc-storage
```

### Tracked files (.dvc files in Git)

| File | Tracked Data |
|------|-------------|
| `ml-engine/data/trading_data.db.dvc` | SQLite: candles, session_aggregates, trade_log |
| `ml-engine/models/store.dvc` | Trained model binaries (direction, regime, session, etc.) |

### Pipeline stages
```bash
python -m dvc repro              # Run full pipeline (only changed stages)
python -m dvc repro <stage>     # Run specific stage
python -m dvc status            # What needs recomputing
python -m dvc metrics diff      # Compare metrics between runs
python -m dvc params diff       # Show params that changed
```

### Adding new data files
```bash
python -m dvc add ml-engine/data/new_file.csv
git add ml-engine/data/new_file.csv.dvc  # Commit .dvc file, not the data
```

### Reproducing from scratch
```bash
python -m dvc pull              # Restore data + models from remote
python -m dvc repro             # Recompute pipeline
```

### Key rules
- **Never** `git add` large binary data or model files â€” DVC handles them
- **Always** `git add` the corresponding `.dvc` file after `dvc add`
- `dvc.yaml` defines the pipeline: `ingest â†’ features â†’ train â†’ evaluate`
- `params.yaml` holds all tunable hyperparameters â€” version it alongside code
- After training: `python -m dvc push` to upload models to DVC remote
- Before pulling on a new machine: `python -m dvc pull` to restore models

---

## Self-Hosted MLflow (MLOps)

**Every training run, experiment, and model promotion is tracked in MLflow.** Self-hosted via k3s or Docker Compose.

### Components

| Component | Purpose | Port |
|-----------|---------|------|
| `mlflow` server | Experiment tracking UI + API | 5000 |
| `mlflow-postgres` | Metadata backend (runs, params, metrics) | 5432 |
| `minio` | S3-compatible artifact store (models, plots) | 9000 |

### Start (Docker Compose)
```bash
docker compose -f docker-compose.mlflow.yml up -d
# Access: http://localhost:5000
```

### Kubernetes
```bash
helm install tradersapp ./k8s/helm/tradersapp -f values.prod.yaml
# MLflow available at: http://mlflow.tradersapp.svc.cluster.local:5000
```

### Environment variables (ML Engine)
```bash
MLFLOW_TRACKING_URI=http://mlflow:5000        # MLflow server
MLFLOW_S3_ENDPOINT_URL=http://minio:9000     # MinIO artifact root
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
```

### Model lifecycle (3 stages)
```
None â†’ Staging â†’ Production â†’ Archived
```
- **Staging**: new model passes PBO < 5%, Sharpe â‰¥ 0.5, win rate â‰¥ 50%
- **Production**: manually promoted after paper trade verification
- **Archived**: production model older than 7 days auto-archived

### Key rules
- Every `trainer.train_all()` call automatically logs to MLflow
- `auto_register_if_passing()` promotes to Staging if thresholds met
- `promote_model()` moves Staging â†’ Production after paper trade review
- `archive_stale_models()` auto-archives production models older than 7 days
- DVC commit hash is logged as `dvc_commit` tag on every run (data lineage)

---

## Git Workflow

1. **Every feature** gets its own branch: `feature/session-fatigue`
2. **Commits are atomic**: one logical change per commit
3. **Commit message format**:
   ```
   feat: Add Session Fatigue Tracker
   fix: Correct Telegram broadcast rate limit
   docs: Update deployment guide
   refactor: Split CollectiveConsciousness into sub-components
   perf: Add Redis caching to ML consensus endpoint
   ```
4. **PR before merge** â€” never push directly to main
5. **Backup before every significant change**: `python scripts/auto_backup.py "message"`

---

## Anti-Patterns to Never Do

- [ ] Never append to a file over 600 lines â€” split it
- [ ] Never use `any` in TypeScript â€” use `unknown` + narrowing
- [ ] Never use `// @ts-ignore` â€” fix the type instead
- [ ] Never `await` inside a `Promise.all` loop â€” use `Promise.allSettled`
- [ ] Never mutate state directly in React â€” always use `setState` or Zustand actions
- [ ] Never hardcode a URL in code â€” use env vars
- [ ] Never commit secrets â€” use Infisical
- [ ] Never use `sleep` in tests â€” use `waitFor` assertions
- [ ] Never catch `Exception` broadly â€” catch specific exceptions
- [ ] Never use `eval()` or `new Function()` â€” use `JSON.parse` for JSON
- [ ] Never make the ML engine depend on the BFF â€” BFF calls ML, never reverse

---

## Evidence First Rule

**Before writing ANY code**, Claude/OpenClaw MUST list:
```
Evidence examined: [exact file:line references]
```

Never accept code on the first try. Always require a second "fix" pass with real runtime evidence (test output, error logs). This cuts hallucinated bugs by forcing grounded reasoning.

---

## Tests First Rule

For any ML code change:
1. Write the test first (describe expected input/output shape)
2. Run the test
3. Paste exact failure output back
4. Only then implement to fix real failures

Never write implementation code before the test is defined.

---

## Debug Protocol (8 Steps)

When a bug appears, follow this order. Human does steps 1-3 first:

1. **Reproduce** â€” Confirm the bug exists with exact steps
2. **Log** â€” Capture exact error message, stack trace, timestamps
3. **Isolate** â€” Narrow down to the exact file/function/line
4. **Measure** â€” Add timing/logging to quantify the problem
5. **Hypothesize** â€” Form theory based on evidence above
6. **Fix** â€” Implement the minimal fix
7. **Verify** â€” Run same reproduction steps, confirm fix
8. **Document** â€” Add test case or log to prevent recurrence

---

## Performance Rules

| Metric | Target | Enforced |
|--------|--------|----------|
| ML Consensus latency | < 200ms | Hard limit |
| BFF â†’ ML Engine | < 5s timeout | Circuit breaker |
| BFF â†’ News | < 3s timeout | Circuit breaker |
| Circuit breaker | 5 failures / 30s | Auto-open |
| Cache TTL (consensus) | 60s | Redis or in-memory |
| Cache TTL (regime) | 300s | Redis or in-memory |

**General Rules:**
- No blocking operations on the main thread in React
- All external calls are concurrent in BFF (Promise.all)
- ML predictions: cache with Redis (TTL per endpoint type)
- Heavy ML operations: thread pool or worker process, never block main thread
- React renders: use `React.memo` + `useMemo` + `useCallback` aggressively
- No inline styles — CSS classes only
- Images and heavy assets lazy-loaded with `React.lazy()`
- Candle data loading: max 10k rows per request, paginate larger queries
- Model inference: lazy-load models, unload after 5 min inactivity
- Feature computation: precompute on load, cache per symbol/timeframe

---

## Trade-off Rules

When Claude/OpenClaw proposes a solution, the priority order is:

1. **Safety over speed** â€” A safe system that is slightly slower is preferred
2. **Correctness over elegance** â€” Simple and correct beats clever and broken
3. **Robustness over optimization** â€” Never optimize at the cost of edge case handling
4. **Readability over brevity** â€” Future humans (including future Claude) must understand code
5. **Explicit over implicit** â€” No magic, no hidden state, no silent fallbacks

In order routing: safety > correctness > robustness > readability > performance

---

## Security Checklist (Review Before Every Commit)

After any code change touching orders, data, or auth, human manually reviews:

- [ ] No secrets hardcoded (API keys, tokens, passwords)
- [ ] No `eval()` or `new Function()` usage
- [ ] Input validation on all external data (params, body, headers)
- [ ] SQL injection prevention (parameterized queries only)
- [ ] No user-controlled file paths (path traversal prevention)
- [ ] Rate limiting on all public endpoints
- [ ] Circuit breaker on all external calls
- [ ] Timeout on all external calls (5s ML, 3s news)
- [ ] CORS properly configured (no wildcard in production)
- [ ] Error messages don't expose internal paths or system details

Review takes 60 seconds. Catches almost everything.

---

## Paper Trading Rule (Non-Negotiable)

**ALL signals must be paper traded for 1 full trading week before any live use.**

Definition of "paper trade": Log every consensus signal with entry, stop, target, and outcome. Compare against actual price movement. Track win rate, RRR, and session performance.

Rules:
- Paper trade log must exist before any live consideration
- All 6 model families must be tested in paper before weighting changes
- Any new regime detection change requires 1 week paper trade
- Human trader reviews paper trade log weekly

---

## 90% Accuracy Rule (Non-Negotiable - Always Follow)

This project demands the highest possible correctness because it involves low-latency systems, self-learning ML components, quantitative analysis, and production-critical code. Errors here can cause cascading failures, incorrect data insights, model drift, or performance degradation.

**Rule:** 
- I must achieve at least **90% functional accuracy** on every task, fix, or code change before considering it complete.
- "90% accuracy" means: the solution must be correct, robust, handle documented edge cases, respect low-latency constraints, maintain consistency with existing architecture, and pass relevant tests/validation where possible.
- Prioritize **correctness and safety** over speed of response or code brevity.
- Never sacrifice accuracy for "good enough" or to reduce thinking steps.
- If I am unsure about any part (logic, edge case, performance impact, integration with other services), I must:
  1. Explicitly state my uncertainty.
  2. Suggest the minimal safe implementation or ask for clarification.
  3. Avoid guessing or hallucinating details.
- For error fixes: Verify the fix actually resolves the root cause (not just silences the error) and does not introduce new issues in the scoped microservice.
- For new code or changes: Think step-by-step about correctness first, then efficiency, then style.
- When in doubt, default to more conservative, testable, and explicit code.

This rule overrides any tendency to produce fast but approximate solutions. Accuracy is the top priority in this project.

---

## Required Project Files

Every session starts with access to these (do not work without them):

| File | Purpose | When to Read |
|------|---------|-------------|
| CLAUDE.md | Architecture bible | Every session |
| SPEC.md | Requirements & blockers | Every session |
| EDGE-CASES.md | Market scenarios | Data/risk/execution code |
| DOMAIN-RULES.md | Trading rules | Signal/risk code |
| LEGACY-PATTERNS.md | Existing patterns | ML/integration code |
| PROMPT-TEMPLATE.md | Session starter | Every new session |

**Anti-pattern:** Starting a session without reviewing relevant sections of these files.

---

## Model Tiers â€” Enforced on All Sub-Agents

This project uses Claude model tiers for different task types. **Sub-agents MUST use these tiers:**

| Tier | Model | When to Use |
|------|-------|-------------|
| **Opus 4.6** | `claude-opus-4-6` | Planning, architecture, complex multi-service research, AutoResearch orchestration, strategic decisions |
| **Sonnet 4** | `claude-sonnet-4-6` | Coding, implementation, bug fixes, refactoring, feature development |
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | File exploration, grep/search, read-only analysis, pattern finding, simple research tasks |

**AutoResearch loop (scripts/autoresearch/):** Haiku explores bottlenecks â†’ Sonnet implements optimizations â†’ Opus evaluates loop direction.

**Quick reference:**
- Planning a new feature or architecture? â†’ Use **Opus**
- Writing or editing code? â†’ Use **Sonnet**
- Finding files, grep, understanding code structure? â†’ Use **Haiku**


