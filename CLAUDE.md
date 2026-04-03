# TradersApp — Claude Code Architectural Guide

**Last Updated:** 2026-04-03

---

## Monorepo Scoping — ZERO MICROMANAGEMENT

**Every reply starts with:** `Scoped to: [folder] — [description]`

### Scope Detection (Priority Order)
1. **Error pasted** → Stack trace, file paths, service names → auto-detect microservice
2. **File open in editor** → That file's folder
3. **Unclear** → Ask for error text only. NEVER ask for clicks or file names.

### Microservice Detection Keywords

| Error Contains | Scope To |
|---|---|
| `src/`, `.jsx`, `vite`, `npm run`, `src/App.jsx` | `src/` (Frontend) |
| `bff/`, `server.mjs`, `.mjs`, `/api/` | `bff/` (BFF) |
| `ml-engine/`, `.py`, `fastapi`, `lightgbm` | `ml-engine/` |
| `telegram-bridge/`, `telegram`, `bot` | `telegram-bridge/` |
| `scripts/`, `.ps1` | `scripts/` |

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

## Performance Rules

1. **No blocking operations on the main thread** in React
2. **All external calls are concurrent** in BFF (Promise.all)
3. **ML prediction is cached** with Redis (TTL per endpoint type)
4. **Heavy ML operations** run in thread pool or separate worker
5. **React renders** use `React.memo` + `useMemo` + `useCallback` aggressively
6. **No inline styles** — use CSS classes or CSS-in-JS with `styled()`
7. **Images and heavy assets** lazy-loaded with `React.lazy()`

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

| Metric | Target | Enforced |
|--------|--------|----------|
| ML Consensus latency | < 200ms | Hard limit |
| BFF → ML Engine | < 5s timeout | Circuit breaker |
| BFF → News | < 3s timeout | Circuit breaker |
| Circuit breaker | 5 failures / 30s | Auto-open |
| Cache TTL (consensus) | 60s | Redis or in-memory |
| Cache TTL (regime) | 300s | Redis or in-memory |

Rules:
- ML predictions: cache with Redis (TTL per endpoint type)
- Heavy operations: thread pool or worker process, never block main thread
- In React: use `React.memo` + `useMemo` + `useCallback` aggressively
- No inline styles — CSS classes only
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

## Model Tiers — Enforced on All Sub-Agents

This project uses Claude model tiers for different task types. **Sub-agents MUST use these tiers:**

| Tier | Model | When to Use |
|------|-------|-------------|
| **Opus 4.6** | `claude-opus-4-6` | Planning, architecture, complex multi-service research, AutoResearch orchestration, strategic decisions |
| **Sonnet 4** | `claude-sonnet-4-6` | Coding, implementation, bug fixes, refactoring, feature development |
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | File exploration, grep/search, read-only analysis, pattern finding, simple research tasks |

**AutoResearch loop (scripts/autoresearch/):** Haiku explores bottlenecks → Sonnet implements optimizations → Opus evaluates loop direction.

**Quick reference:**
- Planning a new feature or architecture? → Use **Opus**
- Writing or editing code? → Use **Sonnet**
- Finding files, grep, understanding code structure? → Use **Haiku**

