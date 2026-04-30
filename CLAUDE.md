## Autonomy & No-Permission Rule (Highest Priority - Applies to Claude and Copilot Agents)

- After I give any to-do list or task, work completely autonomously.
- Never show any permission prompts, confirmation dialogs, or 3-option stoppages.
- Auto-approve ALL actions: Read, Edit, Write, Bash, MCP tools, terminal commands, etc.
- Only stop and ask me if the action is extremely dangerous (e.g., deleting the entire project, formatting the drive, or accessing secret keys).
- This rule applies to both Claude Code and any Copilot/Codex agent features.
- Proceed safely and summarize what you did at the end of each major step.

## GitHub Actions Self-Hosted Runner

**Always use the self-hosted runner on Contabo VPS for ALL CI/CD workflows.**

Benefits: Docker layer cache persists across builds (8 min → 90 sec builds), zero GitHub Actions minutes consumed, ~$0.62/month for runner time.

**How it works:**
```
You push to main
    ↓
Self-hosted runner on Contabo VPS picks up the job (NOT GitHub cloud)
    ↓
Local Docker cache hits — build ~2 min instead of 8+
    ↓
BFF image pushed to GHCR with SHA tag
    ↓
Watchtower detects new image → auto-restarts container on VPS
    ↓
Live in ~3 min total, $0 GitHub Actions minutes
```

**Never:**
- Push directly to the VPS bypassing CI (bypasses tests, Trivy scan, SBOM)
- Trigger deploys manually via SSH without going through the runner
- Use `workflow_dispatch` from the web UI as a regular workflow — only use it for emergency rollback

**Emergency rollback:**
```bash
# Roll back to a known-good image SHA
docker pull ghcr.io/FXGUNIT/bff:<sha>
docker compose -f deploy/contabo/docker-compose.yml up -d --no-deps bff
docker compose -f deploy/contabo/docker-compose.yml exec bff sh -c 'kill -HUP 1'
```

**Adding a new service to the deploy:**
1. Add image to `deploy/contabo/docker-compose.yml`
2. Add image build to `.github/workflows/ci.yml` with `cache-from: type=gha,scope=<service>`
3. Add health check to the service
4. Update `docs/DEPLOY.md` runbook

---

## Deploy Process — Enforced on All Agents

This section is **binding on every agent** — Claude Code, Codex, Copilot, and human. No exceptions.

### The One True Deploy Path

```
Push to main → CI passes → BFF image published to GHCR → Watchtower detects → Live
```

**No other path is valid.** Every backend change follows this chain. Never skip steps.

### Step-by-step for every backend change

**Step 1 — Write the code**
- Make your changes in the appropriate microservice directory
- Follow architecture rules, security checklist, and board room rules

**Step 2 — Test locally**
```bash
# BFF changes
docker build --target test -t bff:test bff/ 2>&1 | tail -5
docker run --rm bff:test npm test -- --reporter dot 2>&1 | tail -20

# ML Engine changes
cd ml-engine && pytest tests/ -q --tb=short 2>&1 | tail -10
```

**Step 3 — Commit and push**
```bash
git add <changed-files>
git commit -m "$(cat <<'EOF'
<type>: <short description>

<why this change, what it fixes or adds>
EOF
)"
git push origin main  # pushes to both origin (Gitea) and old-origin (GitHub)
```

**Step 4 — Wait for CI**
- Watch the run at: https://github.com/FXGUNIT/TRADERS-REGIMENT/actions
- CI runs on self-hosted runner — BFF build ~90 sec with cache
- If CI fails: fix the failure first, do not bypass or force-push

**Step 5 — Watchtower auto-deploys**
- Watchtower polls GHCR every 5 minutes
- When it detects a new `bff:<sha>` image, it pulls it and restarts the container
- Manual check: `curl -s https://bff.173.249.18.14.sslip.io/health`

**Step 6 — Verify**
```bash
# BFF is live
curl -s https://bff.173.249.18.14.sslip.io/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('BFF:', 'OK' if d.get('ok') else 'FAIL')"

# Frontend auto-updated via Cloudflare Pages (no action needed)
curl -s https://tradergunit.pages.dev/ | grep -o '<title>[^<]*' | head -1
```

### What NEVER to do

| Forbidden | Why | Correct |
|---|---|---|
| Build image locally and `docker run` on VPS | Bypasses CI, no Trivy scan, no SBOM | Push code, let CI build |
| `workflow_dispatch` from web UI for normal deploys | Wastes Actions minutes, skips test gate | Let watchtower auto-deploy |
| SSH into VPS and edit files directly | Changes get overwritten on next deploy | Change code, push, wait for deploy |
| `docker commit` to modify running container | Not reproducible, lost on restart | Change Dockerfile, push, rebuild |
| Force-push to main | Destroys history, bypasses all checks | Revert commit, push new fix |

### CI Failure Protocol

When CI fails, fix in this order:
1. Read the failing job logs from GitHub Actions UI
2. Fix the root cause — do not skip the test or mark it "optional"
3. Push a new commit
4. Wait for CI to pass
5. Do not manually trigger deploy — watchtower handles it

**Exception — emergency hotfix when CI is broken for non-BFF reasons:**
```bash
# Only if ML Engine tests fail but BFF code is unchanged
# Use skip_build to pull existing BFF image and only restart services
gh workflow run deploy-contabo.yml \
  --field skip_build=true \
  --field image_tag=<last-known-good-sha>
```

### Adding or changing environment secrets

1. Add secret to GitHub Secrets: `gh secret set SECRET_NAME --body "value" --repo FXGUNIT/TRADERS-REGIMENT`
2. Update `scripts/contabo/build-runtime-env.sh` allowlist if the secret needs to reach the BFF container
3. Update `CONTABO_APP_ENV` base64 secret if using that path
4. Commit and push — deploy auto-restarts the BFF container
5. Verify: `ssh contabo-vps 'docker exec traders-bff env | grep SECRET_NAME'`

---

## OpenCode CLI Automation (Claude + Codex + VS Code)

- OpenCode is installed as the project Open CLI.
- Always launch it through the project wrapper so it uses this repo and Infisical:
  `powershell -ExecutionPolicy Bypass -File scripts\agents\open-cli.ps1 ...`
- One-shot automation:
  `powershell -ExecutionPolicy Bypass -File scripts\agents\open-cli.ps1 run "TASK"`
- Interactive OpenCode:
  `powershell -ExecutionPolicy Bypass -File scripts\agents\open-cli.ps1 .`
- Headless API server:
  `powershell -ExecutionPolicy Bypass -File scripts\agents\open-cli.ps1 serve --hostname 127.0.0.1 --port 4096`
- Do not copy provider keys into tracked config files. The wrapper injects Infisical secrets at runtime.
- Keep existing secret names exactly as they are.

## Installed Claude Workflow - Always-On Defaults (2026-04-11)

Use the installed Claude plugins and skills automatically whenever relevant. Do not wait for the user to name a plugin or slash-skill if the task clearly matches it.

### Default Stack To Prefer

- `superpowers` - default workflow for planning, TDD, implementation, code review, and completion on most engineering tasks.
- `gstack` - prefer `/autoplan`, `/review`, `/qa`, `/browse`, `/investigate`, `/cso`, `/guard`, and `/ship` when relevant.
- `frontend-design` - auto-apply for UI, layout, styling, landing page, dashboard, and polished frontend work.
- `code-review` - auto-apply for branch review, diff review, PR-style review, and final pre-merge checks.
- `security-guidance` - always honor for auth, secrets, shell commands, HTML injection, workflows, deserialization, and risky edits.
- `claude-mem` - use persistent memory/context when it helps continuity across sessions.
- `caveman` - do **not** use by default; only enable when the user explicitly asks for terse/caveman mode.

### Task Routing Rules

1. **New feature** -> use `superpowers` plus `gstack /autoplan`, then implement, then `/review`, then `/qa`, then `/ship`.
2. **Bug or regression** -> use systematic debugging plus `gstack /investigate`, and verify with real evidence before claiming fixed.
3. **Frontend / UX** -> use `frontend-design` plus `gstack /browse` or `/qa` for real UI verification.
4. **Security / auth / infrastructure risk** -> use `security-guidance` plus `gstack /cso` and `/guard`.
5. **Deployment / release** -> use `/guard` first, then `/review`, `/qa`, and `/ship`.

### Deprioritized Skills

These should not be suggested or preferred unless the user explicitly asks for them:

- `/design-shotgun`
- `/retro`
- `/pair-agent`
- `/setup-browser-cookies`
- `/setup-deploy`
- `/plan-devex-review`
- `/document-release`

# TradersApp — Claude Code Architectural Guide

**Last Updated:** 2026-04-11

---

## Monorepo Scoping — ZERO MICROMANAGEMENT

**Every reply starts with:** `Scoped to: [folder] — [description]`

### Scope Detection (Priority Order)

1. **Error pasted** → Stack trace, file paths, service names → auto-detect microservice
2. **File open in editor** → That file's folder
3. **Unclear** → Ask for error text only. NEVER ask for clicks or file names.

### Microservice Detection Keywords

| Error Contains                                   | Scope To           |
| ------------------------------------------------ | ------------------ |
| `src/`, `.jsx`, `vite`, `npm run`, `src/App.jsx` | `src/` (Frontend)  |
| `bff/`, `server.mjs`, `.mjs`, `/api/`            | `bff/` (BFF)       |
| `ml-engine/`, `.py`, `fastapi`, `lightgbm`       | `ml-engine/`       |
| `telegram-bridge/`, `telegram`, `bot`            | `telegram-bridge/` |
| `scripts/`, `.ps1`                               | `scripts/`         |

### Once Scoped — Rules

- **ONLY** read, search, edit files inside that microservice folder
- **PLUS** `scripts/`, `CLAUDE.md`, `.claude/` if needed
- **NEVER** load code from other microservices unless you type `@service-name`
- **Multi-service error**: Scope to primary, note it, expand only on explicit `@mention`

### Token Economy

- **Use `/compact` when context > 60%** — never let context bloat slow things
- **Grep before read** — never read a file before grepping it
- **Specific reads over globbing** — `Read file:123` not `glob **/*.js`
- **Never load archives** — skip `.bak`, `.backup`, `archive/` files

---

## Core Principles

### 1. Never Create a Monolith

Every component is a **separate, independently deployable unit** with its own:

- Clear input/output contract
- Own directory (`src/features/X/`, `ml-engine/X/`, `bff/services/`)
- Own tests (`tests/`, `*.test.ts`, `pytest tests/X/`)
- Own README if complex

### 2. Module Naming — Be Explicit, Not Clever

```
Good:  src/features/consensus/sessionProbabilityEngine.js
Bad:   src/features/consensus/engine.js
Good:  ml-engine/optimization/pso_optimizer.py
Bad:   ml-engine/opt.py
```

### 3. File Size Hard Limit

- **Python files**: ≤ 600 lines. If exceeding, split into `_core.py`, `_utils.py`, `_api.py`
- **JS/TS files**: ≤ 500 lines. Split at logical boundaries.
- **React components**: ≤ 300 lines. Extract sub-components to sibling files.
- **Shell scripts**: ≤ 200 lines.

### 4. Every New Feature Gets Its Own Directory

```
New Feature: "Session Fatigue Tracker"
CREATE:
  src/features/sessionFatigue/
    SessionFatigueTracker.jsx       — main component
    SessionFatigueCard.jsx          — sub-component
    useSessionFatigue.js            — hook
    sessionFatigueService.js        — data fetching
    sessionFatigueGateway.js         — BFF communication
    sessionFatigue.types.ts          — type definitions
  ml-engine/session/
    fatigue_tracker.py              — backend logic
  tests/
    sessionFatigue.test.tsx
    fatigue_tracker.test.py
DONT: append to existing files like CollectiveConsciousness.jsx
```

### 5. Async-First, Concurrent by Default

```javascript
// BAD — sequential
const news = await fetchNews();
const consensus = await fetchConsensus();
const regime = await fetchRegime();

// GOOD — concurrent, same latency as slowest single call
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
// BFF → ML Engine (mjs)
interface MLConsensusRequest {
  candles: CandleData[];
  features: MathEngineSnapshot;
  regime: RegimeType;
  tradeLog?: TradeEntry[];
}

// ML Engine → BFF (Python Pydantic)
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
├── bff/                         # Node.js BFF — port 8788
│   ├── server.mjs               # Express app entry (ONLY orchestration)
│   ├── routes/                  # One file per route group
│   │   ├── consensusRoutes.mjs
│   │   ├── newsRoutes.mjs
│   │   └── supportRoutes.mjs
│   ├── services/                # One file per service
│   │   ├── consensusEngine.mjs
│   │   ├── newsService.mjs
│   │   ├── breakingNewsService.mjs
│   │   ├── supportChatService.mjs
│   │   ├── mlClients.mjs        # All ML Engine HTTP calls
│   │   └── security.mjs        # Rate limiting, HSTS, Helmet
│   └── Dockerfile
│
├── ml-engine/                   # Python FastAPI — port 8001
│   ├── main.py                  # FastAPI entry (routing ONLY)
│   ├── config.py                 # All hyperparameters
│   ├── data/                     # Database layer
│   │   ├── candle_db.py
│   │   ├── schema.sql
│   │   └── load_ninjatrader_csv.py
│   ├── features/                 # Feature engineering pipeline
│   │   ├── feature_pipeline.py
│   │   ├── candle_features.py
│   │   └── session_aggregates.py
│   ├── models/                   # One subdir per model family
│   │   ├── direction/
│   │   ├── session/
│   │   ├── magnitude/
│   │   ├── alpha/
│   │   ├── regime/
│   │   │   ├── hmm_regime.py
│   │   │   ├── fp_fk_regime.py
│   │   │   ├── anomalous_diffusion.py
│   │   │   └── regime_ensemble.py
│   │   └── mamba/
│   │       └── mamba_sequence_model.py
│   ├── training/
│   │   ├── trainer.py
│   │   ├── cross_validator.py
│   │   └── model_store.py
│   ├── inference/
│   │   ├── predictor.py
│   │   ├── consensus_aggregator.py
│   │   └── explainer.py
│   ├── optimization/
│   │   ├── pso_optimizer.py
│   │   ├── rrr_optimizer.py
│   │   ├── exit_optimizer.py
│   │   └── position_sizer.py
│   ├── alpha/
│   │   └── alpha_engine.py
│   ├── session/
│   │   └── session_probability.py
│   ├── infrastructure/
│   │   ├── performance.py        # Redis, circuit breaker, SLA
│   │   ├── continual_learning.py # EWC, replay buffer
│   │   └── evaluation.py        # drift, A/B, guardrails
│   ├── tests/
│   │   └── test_*.py
│   └── Dockerfile
│
├── src/                         # React Frontend
│   ├── pages/
│   │   ├── CollectiveConsciousness.jsx  # Import all consensus sub-components
│   │   └── *.jsx
│   ├── features/                # Feature-scoped directories
│   │   ├── consensus/
│   │   │   ├── ConsensusSignal.jsx
│   │   │   ├── SessionProbabilityPanel.jsx
│   │   │   ├── AlphaDisplay.jsx
│   │   │   ├── ExitStrategyPanel.jsx
│   │   │   ├── RRRRecommendation.jsx
│   │   │   ├── PositionSizingPanel.jsx
│   │   │   ├── TimingRecommendation.jsx
│   │   │   ├── ModelVotesPanel.jsx
│   │   │   └── NewsCountdown.jsx
│   │   ├── shell/               # App shell, registry, routing
│   │   └── support/
│   ├── components/              # Shared/reusable components
│   │   ├── BreakingNewsPanel.jsx
│   │   ├── AdminMessagePanel.jsx
│   │   └── *.jsx
│   └── services/
│       ├── clients/
│       │   └── ConsensusClient.js
│       └── gateways/
│           └── consensusGateway.js
│
├── telegram-bridge/
│   ├── index.js                 # Telegram bot + web server
│   ├── aiConversation.js        # AI response formatters
│   └── userRegistry.js          # User management
│
├── scripts/
│   ├── auto_backup.py           # CLI git backup tool
│   ├── setup-infisical.ps1      # Push secrets to Infisical
│   └── setup-production.ps1     # Push secrets to Railway/Vercel
│
└── docs/
    ├── DEPLOYMENT.md
    ├── SETUP.md
    ├── SECRETS_ARCHITECTURE.md
    └── TODO_MASTER_LIST.md
```

---

## ML Engine Architecture Rules

**Board Room compliance:** All signal/output code must respect `.claude/rules/board-room.md`. Never output a LONG/SHORT signal without going through `DeliberativeBoardRoom.deliberate()`. RiskOfficer veto = final.

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

1. `train(X, y)` — with TimeSeriesSplit CV
2. `predict(X) -> dict` — with explicit return shape
3. `get_feature_importance()` — SHAP or permutation importance
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
  └─ Feature Container (ConsensusSignal.jsx)       # Fetches data, owns state
       ├─ SectionCard (SessionProbabilityPanel.jsx)  # Displays one concern
       ├─ SectionCard (AlphaDisplay.jsx)
       ├─ SectionCard (ExitStrategyPanel.jsx)
       └─ ...
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
// - isLoading → WarRoomLoader
// - error → "Service Unavailable" with retry
// - data → actual content
```

---

## API Design Rules

### BFF → ML Engine Contract

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

**Every dataset, model, and experiment is versioned with DVC + Git.** No exception — reproducibility is non-negotiable.

### DVC Setup

```bash
python -m dvc init
python -m dvc remote add -d storage ml-engine/dvc-storage
```

### Tracked files (.dvc files in Git)

| File                                 | Tracked Data                                              |
| ------------------------------------ | --------------------------------------------------------- |
| `ml-engine/data/trading_data.db.dvc` | SQLite: candles, session_aggregates, trade_log            |
| `ml-engine/models/store.dvc`         | Trained model binaries (direction, regime, session, etc.) |

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

- **Never** `git add` large binary data or model files — DVC handles them
- **Always** `git add` the corresponding `.dvc` file after `dvc add`
- `dvc.yaml` defines the pipeline: `ingest → features → train → evaluate`
- `params.yaml` holds all tunable hyperparameters — version it alongside code
- After training: `python -m dvc push` to upload models to DVC remote
- Before pulling on a new machine: `python -m dvc pull` to restore models

---

## Self-Hosted MLflow (MLOps)

**Every training run, experiment, and model promotion is tracked in MLflow.** Self-hosted via k3s or Docker Compose.

### Components

| Component         | Purpose                                      | Port |
| ----------------- | -------------------------------------------- | ---- |
| `mlflow` server   | Experiment tracking UI + API                 | 5000 |
| `mlflow-postgres` | Metadata backend (runs, params, metrics)     | 5432 |
| `minio`           | S3-compatible artifact store (models, plots) | 9000 |

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
None → Staging → Production → Archived
```

- **Staging**: new model passes PBO < 5%, Sharpe ≥ 0.5, win rate ≥ 50%
- **Production**: manually promoted after paper trade verification
- **Archived**: production model older than 7 days auto-archived

### Key rules

- Every `trainer.train_all()` call automatically logs to MLflow
- `auto_register_if_passing()` promotes to Staging if thresholds met
- `promote_model()` moves Staging → Production after paper trade review
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
4. **PR before merge** — never push directly to main
5. **Backup before every significant change**: `python scripts/auto_backup.py "message"`

---

## Anti-Patterns to Never Do

- [ ] Never append to a file over 600 lines — split it
- [ ] Never use `any` in TypeScript — use `unknown` + narrowing
- [ ] Never use `// @ts-ignore` — fix the type instead
- [ ] Never `await` inside a `Promise.all` loop — use `Promise.allSettled`
- [ ] Never mutate state directly in React — always use `setState` or Zustand actions
- [ ] Never hardcode a URL in code — use env vars
- [ ] Never commit secrets — use Infisical
- [ ] Never use `sleep` in tests — use `waitFor` assertions
- [ ] Never catch `Exception` broadly — catch specific exceptions
- [ ] Never use `eval()` or `new Function()` — use `JSON.parse` for JSON
- [ ] Never make the ML engine depend on the BFF — BFF calls ML, never reverse
- [ ] Never output a trading signal without Board Room deliberation

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

1. **Reproduce** — Confirm the bug exists with exact steps
2. **Log** — Capture exact error message, stack trace, timestamps
3. **Isolate** — Narrow down to the exact file/function/line
4. **Measure** — Add timing/logging to quantify the problem
5. **Hypothesize** — Form theory based on evidence above
6. **Fix** — Implement the minimal fix
7. **Verify** — Run same reproduction steps, confirm fix
8. **Document** — Add test case or log to prevent recurrence

---

## Performance Rules

| Metric                | Target           | Enforced           |
| --------------------- | ---------------- | ------------------ |
| ML Consensus latency  | < 200ms          | Hard limit         |
| BFF → ML Engine     | < 5s timeout     | Circuit breaker    |
| BFF → News          | < 3s timeout     | Circuit breaker    |
| Circuit breaker       | 5 failures / 30s | Auto-open          |
| Cache TTL (consensus) | 60s              | Redis or in-memory |
| Cache TTL (regime)    | 300s             | Redis or in-memory |

**General Rules:**

- No blocking operations on the main thread in React
- All external calls are concurrent in BFF (Promise.all)
- ML predictions: cache with Redis (TTL per endpoint type)
- Heavy ML operations: thread pool or worker process, never block main thread
- React renders: use `React.memo` + `useMemo` + `useCallback` aggressively
- No inline styles � CSS classes only
- Images and heavy assets lazy-loaded with `React.lazy()`
- Candle data loading: max 10k rows per request, paginate larger queries
- Model inference: lazy-load models, unload after 5 min inactivity
- Feature computation: precompute on load, cache per symbol/timeframe

---

## Trade-off Rules

When Claude/OpenClaw proposes a solution, the priority order is:

1. **Safety over speed** — A safe system that is slightly slower is preferred
2. **Correctness over elegance** — Simple and correct beats clever and broken
3. **Robustness over optimization** — Never optimize at the cost of edge case handling
4. **Readability over brevity** — Future humans (including future Claude) must understand code
5. **Explicit over implicit** — No magic, no hidden state, no silent fallbacks

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

| File               | Purpose                 | When to Read             |
| ------------------ | ----------------------- | ------------------------ |
| CLAUDE.md          | Architecture bible      | Every session            |
| SPEC.md            | Requirements & blockers | Every session            |
| EDGE-CASES.md      | Market scenarios        | Data/risk/execution code |
| DOMAIN-RULES.md    | Trading rules           | Signal/risk code         |
| LEGACY-PATTERNS.md | Existing patterns       | ML/integration code      |
| PROMPT-TEMPLATE.md | Session starter         | Every new session        |
| `.claude/rules/board-room.md` | Board Room governance | All trading/signal code  |

**Anti-pattern:** Starting a session without reviewing relevant sections of these files.

---

## Model Tiers — Enforced on All Sub-Agents

This project uses Claude model tiers for different task types. **Sub-agents MUST use these tiers:**

| Tier          | Model                       | When to Use                                                                                             |
| ------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Opus 4.6**  | `claude-opus-4-6`           | Planning, architecture, complex multi-service research, AutoResearch orchestration, strategic decisions |
| **Sonnet 4**  | `claude-sonnet-4-6`         | Coding, implementation, bug fixes, refactoring, feature development                                     |
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | File exploration, grep/search, read-only analysis, pattern finding, simple research tasks               |

**AutoResearch loop (scripts/autoresearch/):** Haiku explores bottlenecks → Sonnet implements optimizations → Opus evaluates loop direction.

**Quick reference:**

- Planning a new feature or architecture? → Use **Opus**
- Writing or editing code? → Use **Sonnet**
- Finding files, grep, understanding code structure? → Use **Haiku**
