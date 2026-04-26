# Vibing Finance Backtesting Engine - Single Canonical Spec

**Status:** Best-in-class planning baseline v0.2; implementation evidence still required  
**Last updated:** 2026-04-25  
**Owner:** TradersApp  
**Visibility:** Secret/internal only until the launch gates in this document are met  
**Single-doc rule:** All product, architecture, security, data, ML, blockchain, UX, launch, and open-question details for this feature must live in this document. Do not create separate planning docs for this feature unless this document explicitly retires that rule.

---

## 0. Implementation Control Panel

This section is the build-control summary. If any later section conflicts with this panel, this panel wins until it is explicitly updated.

### 0.1 Build Now / Build Later / Do Not Build Yet

| Bucket | Items | Rule |
|---|---|---|
| Build Now | M1 hidden admin shell, M2 CSV intake, M3 session/features, M4 setup detection, M5 execution simulator, M6 report builder, M7 local proof chain only if report exists | This is the only MVP implementation path. |
| Build Later | M8 agent export, M9 built-in CLI, M10 local runner service, M11 Python parity, M12 browser automation, optional local LLM, BYOK provider support | Blocked until deterministic browser report and proof pass golden tests. |
| Do Not Build Yet | Multi-agent role team, autonomous watch mode, cross-user learning, shared model training, public blockchain anchoring, public launch, live trading, broker execution | Blocked until private alpha readiness and governance. |

### 0.2 MVP Scope Lock

MVP means:

- Hidden admin-only browser page.
- Uploaded CSV only.
- MNQ and NIFTY only.
- 5-minute OHLCV only.
- One strategy family: post-initial-balance session VWAP plus caught buyer/seller inventory, structure change, pullback, and strict risk.
- Browser Web Worker computes the first backtest.
- Report is generated from deterministic facts.
- Local proof block is generated from hashed artifacts.
- No paid API, no remote LLM, no hosted compute, no public chain, no live trading.

MVP does not include:

- BYOK provider calls.
- CLI automation.
- Local runner service.
- Python parity engine.
- Browser automation.
- Multi-agent team.
- Autonomous watch/background lab.
- Cross-user memory or model training.
- Public launch.

### 0.3 Stable Milestone IDs

Use these IDs in tasks, tests, commits, and future agent prompts to avoid heading-number drift.

| ID | Name | Status |
|---|---|---|
| `MVP-M1-HIDDEN-SHELL` | Hidden admin shell | Build now |
| `MVP-M2-CSV-INTAKE` | CSV intake and quality report | Build now |
| `MVP-M3-FEATURES` | Session, IB, VWAP, swings | Build now |
| `MVP-M4-SETUP-DETECTOR` | Caught inventory, structure change, pullback | Build now |
| `MVP-M5-SIMULATOR` | Execution simulator and trade ledger | Build now |
| `MVP-M6-REPORT` | Strict risk report and verdict | Build now |
| `MVP-M7-PROOF` | Local proof chain | Build now only after report artifacts exist |
| `POST-M8-AGENT-EXPORT` | Compact agent export | Build later |
| `POST-M9-CLI` | Built-in `vibing` CLI | Build later |
| `POST-M10-RUNNER` | Local runner service | Build later |
| `POST-M11-PYTHON-PARITY` | Python parity engine | Build later |
| `POST-M12-BROWSER-AUTOMATION` | Playwright-backed browser automation | Build later |

### 0.4 P0 Action Checklist

| ID | Action | Status |
|---|---|---|
| `P0-SCOPE` | Scope locked to M1-M7 only | Resolved in this section |
| `P0-STRATEGY-FIXTURES` | Golden setup and fill fixtures exist | Resolved in section 15.9 |
| `P0-INSTRUMENTS` | Instrument metadata and importer profiles exist | Resolved in sections 15.8.1-15.8.2 |
| `P0-METRICS` | Metric formulas and rounding rules exist | Resolved in section 23.5 |
| `P0-PROOF-HASH` | Canonical hash/proof rules exist | Resolved in section 25.7 |
| `P0-REPORT-GUARDRAILS` | Verdict rules and forbidden claims exist | Resolved in section 24.1 |
| `P0-PACKAGE` | `run-package.v1` manifest exists | Resolved in section 25.8 |
| `P0-TEST-MAP` | P0 test traceability exists | Resolved in section 36.5 |
| `P0-REPO-SEQUENCE` | First PR sequence exists | Resolved in section 31.16 |
| `ARCH-SERVICE-PLAN` | Whole-engine and microservice boundary plan exists | Resolved in sections 20.19-20.28 |
| `BIC-STANDARD` | Best-in-class planning standard, governance, and scorecard exist | Resolved in sections 0.9-0.11 and 41 |

### 0.5 Naming Glossary

| Term | Meaning |
|---|---|
| Vibing Finance | Product/workbench name inside TradersApp |
| Vibing Finance Workbench | Hidden admin browser screen |
| `vibing` | Future built-in CLI command |
| Strategy DSL | Versioned deterministic JSON strategy spec |
| Vibing Proof Chain | Local hash-chain proof ledger |
| Run package | Export/import bundle described by `run-package.v1` |
| Memory capsule | Typed adaptive memory object; not numerical truth |
| Per-user adaptive memory | Safe early "learning" layer; not shared model training |
| Model candidate | Offline trained helper model pending registry approval |
| Vibe-dev builder | A human using AI agents, CLI tools, terminal loops, browser checks, and this spec to build iteratively |

### 0.6 User Promise

Allowed promise:

- "Vibing Finance helps you test and critique a trading idea against uploaded historical data using deterministic backtesting, conservative assumptions, and strict caveats."

Forbidden promises:

- Guaranteed profit.
- Guaranteed alpha.
- Financial advice.
- Trade recommendations as certainty.
- Live-trading readiness from a backtest alone.
- Model-discovered edge without deterministic evidence.

First report leads with:

1. Verdict.
2. Why the result is or is not trustworthy.
3. Core metrics.
4. Caveats.
5. Next experiment.

### 0.7 First User, Benchmark, And Success Definition

First user:

- Founder/admin operator using private MNQ or NIFTY CSV files.
- Skill assumption: trader understands the strategy idea, but may not understand backtest traps.

First user pain ranking:

1. Avoid false confidence from bad or naive backtests.
2. Quickly see whether a specific strategy idea has preliminary evidence.
3. Get clear next experiments without manually debugging every metric.

First benchmark task:

```text
Upload a 5-minute MNQ CSV with at least 30 New York RTH sessions.
Run the post-IB VWAP caught-sellers/caught-buyers strategy with default risk.
Produce a report that either rejects, revises, or marks the idea research-worthy with exact caveats, trade ledger, metrics, and local proof block.
```

First success metric:

- The engine produces the correct expected results on all golden fixtures.
- The first real MNQ/NIFTY CSV run completes without upload, paid API, browser freeze, or overconfident language.
- The report explains at least one failure mode or caveat that a naive retail backtest would hide.

First "wow" moment:

- The user sees the engine reject or qualify a strategy with clear evidence, conservative fills, and "do not trust this if..." caveats instead of only showing attractive profit numbers.

Unacceptable private-MVP failures:

- Wrong timezone/session silently used.
- CSV uploaded to server without explicit user action.
- Report says or implies guaranteed/live-trading readiness.
- Ambiguous OHLC fills resolved optimistically.
- Metrics generated by LLM text instead of deterministic engine.
- Proof hash cannot verify the report artifacts.

### 0.8 Vibe-Dev Architecture North Star

This engine must be easy for a vibe-dev builder to extend with AI help without losing correctness.

North-star rules:

- Build one executable vertical slice at a time.
- Keep deterministic trading math in pure modules with fixtures.
- Keep every tool action visible as an event.
- Keep every artifact hashable, exportable, and replayable.
- Keep every future microservice behind a typed contract before it is split out.
- Prefer local-first defaults so the user can run without paid APIs, hosted compute, or secret sharing.
- Add autonomy only through scoped budgets, stop rules, and proof, not hidden background magic.
- Do not create a distributed system until the modular in-process version proves the boundary is real.

Architecture style:

```text
MVP: browser modular monolith
Post-MVP: browser + shared core + CLI
Private alpha: browser + CLI + localhost runner
Research lab: optional queue + Python workers
Hosted later: BFF/provider/settings services only where they add clear value
```

The best architecture for this product is not "microservices everywhere." It is a modular core with microservice-ready boundaries, because that gives a vibe-dev builder fast iteration, fewer deployment failures, and clean future scaling.

### 0.9 Best-In-Class Standard

This document is considered best-in-class as a planning artifact only when it satisfies all of these standards:

| Standard | Meaning | Current status |
|---|---|---|
| Clear target | A builder knows exactly what the product is, who it serves first, and what it refuses to promise | Satisfied |
| Scope discipline | MVP, post-MVP, and prohibited features are separated | Satisfied |
| Deterministic truth | Trading math, fills, metrics, reports, and proof are not delegated to LLM text | Satisfied |
| Testability | Every core claim maps to fixtures, formulas, contracts, or acceptance checks | Satisfied for plan; code pending |
| Reproducibility | Same run package can be replayed and verified across surfaces | Satisfied for plan; code pending |
| Privacy by default | Private CSV and secrets stay local unless the user explicitly opts in | Satisfied |
| Vibe-dev usability | AI-assisted builders have stable IDs, PR sequence, module boundaries, and agent instructions | Satisfied |
| Security and safety | Shell, runner, provider, memory, and watch-mode powers are scoped and budgeted | Satisfied for plan; implementation pending |
| Honest reporting | Reports reject weak evidence and disclose assumptions, ambiguity, and limits | Satisfied for plan; report tests pending |
| Governance | Major decisions, drift controls, and change rules are explicit | Satisfied in section 41 |

Best-in-class does not mean finished product. It means the plan is now strict enough that implementation can be judged objectively.

### 0.10 Best-In-Class Scorecard

| Dimension | Score now | Why not 5 yet | Required evidence for 5 |
|---|---:|---|---|
| Product clarity | 5/5 | N/A | Keep scope panel updated |
| Architecture clarity | 5/5 | N/A | Keep service contracts versioned |
| Backtesting integrity | 4/5 | Fixtures and code not implemented yet | Golden fixture suite passes |
| Data integrity | 4/5 | Importer tests not implemented yet | CSV profile tests pass |
| Metric/proof reproducibility | 4/5 | Hash and metric vectors not implemented yet | Browser/Node/Python vectors match |
| Security/privacy plan | 4/5 | Runner/BYOK not implemented or reviewed yet | Threat tests and redaction tests pass |
| Vibe-dev execution readiness | 5/5 | N/A | PR sequence remains followed |
| Operations/recovery | 4/5 | Recovery flows not implemented yet | Failure injection tests pass |
| Legal/report guardrails | 4/5 | Templates/tests not implemented yet | Forbidden-claim tests pass |
| Launch readiness | 2/5 | Public launch is intentionally blocked | Private alpha evidence, security review, legal review |

Current conclusion:

- Planning quality target: best-in-class baseline reached.
- Product quality target: not reached until M1-M7 are implemented and verified.

### 0.11 Non-Regression Rule For This Spec

Future edits must not weaken any of these without adding a dated decision note:

- Browser-first local MVP.
- No required paid API.
- No required hosted compute.
- No raw CSV upload by default.
- No live trading.
- No public launch before launch gates pass.
- No LLM-generated numerical truth.
- No optimistic OHLC ambiguity resolution.
- No cross-user learning without consent and governance.
- No shell/local-runner powers without capability, budget, event log, and workspace scope.

If a future change violates any item above, the implementation must stop until section 41 records the decision, rationale, risks, and rollback path.

---

## 1. Product Vision

Build a hidden page inside TradersApp where a trader can describe a strategy in plain language and receive an institutional-grade backtest and risk report.

The experience should feel like talking to a strong coding agent:

1. The trader describes the idea in natural language.
2. The system detects missing details and asks only the important clarifying questions.
3. The system converts the idea into a structured strategy specification.
4. The engine runs realistic backtests across chosen assets, timeframes, costs, sessions, and regimes.
5. The output explains whether the strategy has evidence of edge, where it fails, what assumptions matter, and what a professional risk team would refuse to trust.
6. Nothing is launched publicly until it is secure, tested, data-correct, leakage-resistant, and useful enough to protect users from false confidence.

Working product name: **Vibing Finance**.

---

## 2. Hard Reality Guardrails

This product must be ambitious, but not magical.

- A backtest is evidence, not proof.
- A strategy is not valid until data timing, fees, slippage, survivorship, fills, constraints, and out-of-sample behavior are tested.
- The app must not claim to find guaranteed alpha.
- The app must not produce financial advice as certainty.
- The ML system must not "self learn" directly into production without approval gates, model registry, rollback, and audit logs.
- Continuous learning is allowed only as auditable per-user memory, candidate lessons, preference adaptation, and offline model candidates until explicit promotion gates approve broader defaults.
- The system can use LLMs to translate, explain, critique, generate hypotheses, and orchestrate research, but deterministic validation must be done by backtest, statistics, risk, and data-quality engines.
- Blockchain should not be placed in the latency-critical backtest or inference path. Even fast chains are slower than local compute, memory, Redis, Kafka, and database writes. Blockchain can be used later for tamper-evident audit proofs, research provenance, model hash anchoring, or licensed strategy ownership records.

---

## 3. Existing Repo Foundation

This feature should build from the current TradersApp architecture instead of becoming a separate product.

Relevant existing pieces:

- Frontend: React app under `src/`.
- Main authenticated runtime screen: `src/features/shell/AppScreenRegistry.jsx`.
- Trading terminal: `src/features/terminal/`.
- BFF: Node services under `bff/`.
- ML engine: FastAPI app under `ml-engine/`.
- Existing ML routes: training, prediction, regime, drift, feature store, Mamba, PSO, feedback, and backtest routes in `ml-engine/main.py`.
- Existing backtest endpoints:
  - `POST /backtest/pbo`
  - `POST /backtest/mc`
  - `POST /backtest/full`
  - `POST /backtest/autotune`
  - `POST /backtest/returns`
- Existing session-aware backtesting scaffold: `ml-engine/backtesting/rig.py`.
- Existing tests: `ml-engine/tests/test_backtesting_rig.py`.
- Existing ML8 note: `docs/ML8_BACKTESTING_RIG.md`.
- Existing feature catalog: `docs/FEATURE_CATALOG.md`.
- Existing quant strategy research note: `docs/QUANTITATIVE_TRADING_STRATEGY.md`.

Current backtesting gap:

- The current rig is intentionally lightweight.
- It is useful as a scaffold, not yet an institutional-grade execution simulator.
- It needs stronger modeling of fills, costs, slippage, order types, liquidity, gaps, borrow, funding, contract specs, session calendars, data versioning, and validation protocols.

---

## 4. Secret Launch Rule

This feature must stay hidden until it is genuinely useful.

Required secrecy controls:

- Feature flag: default OFF in production.
- Admin-only or founder-only access until readiness gates pass.
- No public nav item in the main hub until launch approval.
- No marketing copy, landing page, public docs, screenshots, or public route.
- All API endpoints behind auth, role checks, rate limits, and audit logs.
- Disable model training from untrusted public user data until training governance is complete.
- Do not expose raw prompts, proprietary strategy specs, uploaded data, or report internals outside the user account boundary.

Possible feature flag name:

```text
VITE_ENABLE_VIBING_FINANCE=false
```

Possible internal route name:

```text
screen = "vibingFinance"
```

Possible API namespace:

```text
/research/*
/backtest/*
/strategy/*
```

---

## 5. First Screen UX

The first version should be simple and direct.

Core page layout:

- Left or main area: chat-style strategy conversation.
- Right or secondary area: strategy spec, assumptions, and current run status.
- Bottom or report area: results once the run completes.

The trader should be able to type things like:

```text
Backtest a 5-minute NQ opening range breakout. Long above the first 15-minute high, short below the first 15-minute low. Stop at 1 ATR. Take profit at 2 ATR. Skip FOMC, CPI, and NFP. Use 2021 to 2025 data.
```

The system should respond with:

- Parsed strategy.
- Missing details.
- Data availability.
- Assumptions it will use if the user does not answer.
- Backtest job status.
- Summary results.
- Risk report.
- Failure cases.
- Whether this is research-worthy, weak, or rejected.

The page should not overwhelm beginners. The advanced logic can exist behind a clean conversation and expandable report sections.

---

## 6. Institutional Report Standard

Every completed strategy report should include:

1. Plain-English verdict.
2. Strategy definition.
3. Asset universe and data coverage.
4. Timestamp and point-in-time assumptions.
5. Execution model.
6. Fees, spread, slippage, and latency assumptions.
7. Position sizing assumptions.
8. Gross and net returns.
9. Equity curve and drawdowns.
10. Win rate, expectancy, profit factor, Sharpe, Sortino, Calmar, skew, kurtosis.
11. Trade distribution and holding-time distribution.
12. Monthly and yearly return table.
13. Regime breakdown.
14. Session breakdown.
15. News-event sensitivity.
16. Parameter sensitivity.
17. Walk-forward validation.
18. Purged cross-validation or equivalent where applicable.
19. Monte Carlo resampling.
20. Probability of backtest overfitting.
21. Capacity and liquidity notes.
22. What would break live.
23. Whether the strategy should be rejected, revised, paper-traded, or promoted.
24. "Do not trust this result if..." caveats.
25. Reproducibility metadata: data version, code version, config hash, model hash.

The report should be stricter than a retail backtest platform. If the evidence is weak, the report must say so.

---

## 7. Backtesting Integrity Requirements

The engine must defend against:

- Lookahead bias.
- Survivorship bias.
- Selection bias.
- Rebalance timing errors.
- Data snooping.
- Overfitting.
- Future corporate-action leakage.
- Using revised economic data as if it was known in real time.
- Ignoring trading halts and market closures.
- Ignoring spread, fees, and slippage.
- Unrealistic fills at candle highs/lows.
- Ignoring partial fills and liquidity.
- Ignoring contract roll behavior for futures.
- Ignoring borrow, locate, funding, and short-sale rules where relevant.
- Ignoring exchange-specific sessions and holidays.
- Ignoring latency if strategy depends on fast reaction.
- Ignoring prop-firm or broker constraints.

Minimum execution model levels:

| Level | Name | Purpose |
|---|---|---|
| 0 | Toy close-to-close | Only for sanity checks; never final evidence |
| 1 | Bar-close execution | Simple swing/intraday strategies |
| 2 | OHLC intrabar conservative | Uses high/low path assumptions and pessimistic fill ordering |
| 3 | Tick-level simulator | Needed for scalping, stops, fast breakout systems |
| 4 | Order-book simulator | Needed for serious latency/liquidity research |
| 5 | Broker/live shadow comparison | Required before any production trading claims |

Default standard for launch:

- Level 2 for normal users.
- Level 3 for intraday futures and scalping workflows.
- Level 4 only if reliable order-book data exists.

---

## 8. Architecture Concept

The system should be decomposed into clear modules.

### 8.1 Natural Language Strategy Intake

Responsibilities:

- Convert user text into structured strategy intent.
- Detect ambiguity.
- Ask clarifying questions.
- Refuse unsafe or impossible requests.
- Preserve the original user wording for audit.

Output object:

```json
{
  "strategy_name": "Opening Range Breakout",
  "asset_universe": ["NQ"],
  "timeframe": "5m",
  "date_range": {
    "start": "2021-01-01",
    "end": "2025-12-31"
  },
  "entry_rules": [],
  "exit_rules": [],
  "risk_rules": [],
  "filters": [],
  "assumptions": [],
  "questions": []
}
```

### 8.2 Strategy DSL

Natural language must become a deterministic strategy representation before running money-like simulations.

Requirements:

- Versioned schema.
- Validatable JSON.
- Human-readable display.
- No arbitrary code execution from user prompts.
- Sandboxed advanced code mode only later.

Initial strategy families:

- Moving average crossover.
- Breakout.
- Opening range breakout.
- Mean reversion.
- VWAP reclaim/reject.
- ATR trend continuation.
- RSI/MACD/indicator filter strategies.
- Session/time-window strategies.
- News-avoidance strategies.
- Portfolio allocation strategies later.

### 8.3 Data Layer

Responsibilities:

- Ingest market data.
- Track source, license, coverage, and quality.
- Version datasets.
- Validate missing bars, duplicates, timestamps, holidays, sessions, and outliers.
- Provide point-in-time feature joins.

Possible data classes:

- OHLCV bars.
- Tick data.
- Order book data.
- Futures contract metadata and rolls.
- Options chains and Greeks.
- Corporate actions.
- Economic calendar.
- News events.
- Funding rates for crypto/perpetuals.
- Borrow and short constraints for equities.

### 8.4 Backtest Orchestrator

Responsibilities:

- Build a reproducible job from the strategy spec.
- Select the correct simulation engine.
- Apply costs, slippage, sessions, and constraints.
- Run base case, sensitivity, walk-forward, and Monte Carlo.
- Store results and artifacts.
- Return progress updates to frontend.

### 8.5 Risk Analyst Layer

Responsibilities:

- Compute risk metrics.
- Explain drawdown and tail events.
- Compare against benchmark and cash.
- Stress test market regimes.
- Detect concentration and fragility.
- Recommend reject/revise/paper-trade/promote.

### 8.6 Quant Research Layer

Responsibilities:

- Test factor quality.
- Test signal decay.
- Test parameter stability.
- Compare to naive baselines.
- Estimate overfit risk.
- Suggest simpler alternatives if complex versions fail.

### 8.7 ML and Self-Improvement Layer

Allowed:

- Learn from approved datasets.
- Train models through existing MLflow/DVC/model-registry workflow.
- Use drift detection.
- Use offline experiments.
- Use human approval before production promotion.
- Learn how to ask better clarifying questions.

Not allowed:

- Self-modifying production code.
- Silent model promotion.
- Training on private user strategies without consent.
- Using leakage-contaminated results as training labels.
- Claiming alpha without out-of-sample evidence.

### 8.8 Blockchain/Audit Layer

Blockchain is optional and should not be in the hot path.

Best use cases:

- Hash strategy specs.
- Hash data versions.
- Hash result reports.
- Hash model versions.
- Produce tamper-evident proof that a report existed at a given time.
- Prove ownership/licensing of private strategy templates later.

Not good use cases:

- Running backtest compute.
- Serving low-latency predictions.
- Storing raw market data.
- Storing private strategy text.
- Replacing the database.

Decision pending:

- Whether any blockchain is needed at all.
- Whether a public chain, private chain, or append-only signed log is enough.
- Whether the user's goal is provenance, monetization, decentralization, or branding.

---

## 9. Technology Direction

Use existing stack first:

- React frontend.
- Node BFF.
- FastAPI ML engine.
- Python research stack.
- pandas, NumPy, vectorbt/backtesting.py/backtrader-style adapters where useful.
- Existing event-driven rig as the first local base.
- MLflow for experiment tracking.
- DVC for data versioning.
- Redis for hot cache.
- Kafka where streaming matters.
- Feast for point-in-time feature store.
- Triton/ONNX where model serving matters.
- Playwright for frontend verification.
- pytest for ML engine verification.

Do not add a new platform until the current stack cannot handle the requirement.

---

## 10. Phased Build Plan

### Phase 0 - Brainstorm and Scope Lock

Goal:

- Use this document as the single source of truth.
- Answer the question bank.
- Decide the first asset, first strategy family, first data source, and first report standard.

Exit criteria:

- One-sentence MVP defined.
- Data source selected.
- First strategy family selected.
- Hidden access model selected.

### Phase 1 - Hidden Page Skeleton

Goal:

- Add a hidden `VibingFinance` page inside the authenticated app.
- Keep it unavailable unless the feature flag and role allow it.
- No real alpha claims yet.

Exit criteria:

- Page renders locally.
- Admin-only or founder-only access works.
- Feature flag default OFF in production.

### Phase 2 - Strategy Spec Builder

Goal:

- Let the user type a strategy idea.
- Convert it into structured JSON.
- Ask clarifying questions when required.
- Display assumptions clearly.

Exit criteria:

- No arbitrary code execution.
- Schema validation.
- Test cases for common prompts.

### Phase 3 - Deterministic Backtest MVP

Goal:

- Run one or two strategy families through a realistic enough simulator.
- Use existing ML engine where possible.

First likely candidates:

- Opening range breakout.
- ATR trend continuation.
- VWAP mean reversion.

Exit criteria:

- Real OHLCV data.
- Costs and slippage included.
- Session calendar enforced.
- Results reproducible.

### Phase 4 - Institutional Risk Report

Goal:

- Produce a strict report that explains results and caveats.

Exit criteria:

- Net metrics.
- Drawdown analysis.
- Parameter sensitivity.
- Walk-forward or equivalent validation.
- Monte Carlo.
- Reject/revise/paper-trade/promote verdict.

### Phase 5 - Data Quality and Point-in-Time Safety

Goal:

- Ensure bad data cannot produce confident reports.

Exit criteria:

- Data quality score shown.
- Missing bars and timestamp issues detected.
- Point-in-time assumptions documented.
- Data version shown in report.

### Phase 6 - Advanced Research Engine

Goal:

- Add strategy library, factor research, optimizer, and better validation.

Exit criteria:

- Baseline comparisons.
- Multiple regimes.
- Multiple assets if data permits.
- Overfit warnings.

### Phase 7 - ML Governance

Goal:

- Train and improve models safely.

Exit criteria:

- MLflow experiment tracking.
- DVC data versions.
- Model registry.
- Approval gate.
- Rollback.
- Drift monitoring.

### Phase 8 - Audit / Blockchain Decision

Goal:

- Decide whether blockchain is useful.

Exit criteria:

- Business purpose is clear.
- Latency impact is zero for backtest runs.
- Private data is never written on-chain.
- Only hashes or proofs are anchored if used.

### Phase 9 - Private Beta Gate

Goal:

- Allow trusted testers only.

Exit criteria:

- Security review complete.
- Test coverage complete.
- Known false-confidence risks mitigated.
- Disclaimers and user education in place.
- Admin kill switch exists.

### Phase 10 - Public Launch Gate

Goal:

- Launch only if the product is robust enough.

Exit criteria:

- Legal/compliance review complete.
- Data licensing confirmed.
- Billing and abuse protections ready if monetized.
- Incident response ready.
- No critical security or data-quality gaps.

---

## 11. Launch Readiness Gates

The feature is not launchable until all are true:

- Hidden feature flag exists and defaults OFF.
- Auth and authorization are enforced.
- User strategy data is isolated.
- Data licensing is documented.
- Backtest reproducibility is proven.
- Cost/slippage models exist.
- Lookahead checks exist.
- Walk-forward or equivalent validation exists.
- Monte Carlo or resampling exists.
- Reports contain caveats and reject weak strategies.
- No raw secret keys or private prompts leak to logs.
- Long-running jobs cannot crash the app.
- Rate limits exist.
- Audit logs exist.
- Test suite passes.
- Manual QA passes.
- Founder approves.

---

## 12. Question Bank For The User

Answer these over time. We will keep updating this same document.

### 12.1 Product Identity

1. Is the official product name **Vibing Finance**, or is that a temporary codename?
2. Should the page feel like a trading research lab, a ChatGPT-like analyst, or a Bloomberg-style terminal?
3. Is this meant only for you first, or for invited traders later?
4. Should it be part of Traders Regiment branding or a separate hidden module?
5. What should users call the AI: analyst, quant, strategist, research desk, or something else?

### 12.2 First User

1. Who is the first intended user: you, beginners, prop traders, discretionary traders, quants, fund managers, or educators?
2. What is the user's skill level?
3. Should the app explain basics, or assume the user knows trading terms?
4. Should it reject vague strategies, or patiently guide beginners into a structured spec?
5. What is the first user's main pain: finding edge, avoiding bad strategies, position sizing, prop-firm rules, automation, or learning?

### 12.3 First Asset

1. Which asset should be supported first?
2. Choices to consider: MNQ, NQ, ES, NIFTY, BANKNIFTY, BTC, ETH, forex majors, Indian equities, US equities, options.
3. Which exchange matters first?
4. Which timezone should be canonical?
5. Is the first use case intraday, swing, positional, or portfolio?
6. Should futures contract roll handling be required in the MVP?
7. Should options Greeks and options chain data be in the first version, or later?

### 12.4 Data

1. What data source do we actually have right now?
2. Is the data paid, free, broker-exported, exchange-provided, or manually uploaded?
3. What timeframes exist: tick, 1m, 5m, 15m, daily?
4. How many years of data are available?
5. Is the data adjusted?
6. Does the data include bid/ask spread?
7. Does the data include volume?
8. Does the data include order book depth?
9. Does the data include news and economic calendar timestamps?
10. Are we legally allowed to use the data in a product?
11. Are we legally allowed to store it on our servers?
12. Can users upload their own CSV files?
13. Should uploaded data stay private to that user?
14. Should we support NinjaTrader CSV first because the repo already has related data tooling?

### 12.5 First Strategy Families

1. What strategy should be first?
2. Opening range breakout?
3. VWAP reclaim/reject?
4. ATR trend continuation?
5. Mean reversion?
6. AMD/ICT-style session logic?
7. News avoidance?
8. Options premium selling?
9. Multi-asset factor ranking?
10. Should the first version support only long/short rules, or portfolio allocation too?
11. Should users be able to write code, or only natural language?
12. Should advanced users get a Python strategy editor later?

### 12.6 Execution Realism

1. What execution standard is required first: bar-close, conservative OHLC, tick-level, or order-book?
2. What commission model should be default?
3. What spread/slippage model should be default?
4. Should the app model partial fills?
5. Should the app model latency?
6. Should the app model rejected orders?
7. Should the app model broker margin?
8. Should the app model prop-firm daily drawdown and max drawdown?
9. Should the app auto-flatten positions at session end?
10. Should overnight holds be allowed?

### 12.7 Risk and Report

1. What is the minimum acceptable report?
2. Should reports be beginner-friendly, professional, or both?
3. Which metrics are mandatory?
4. Should every report produce a single verdict?
5. What verdict labels should be used: rejected, weak, research-worthy, paper-trade, deploy candidate?
6. Should the app compare strategies against buy-and-hold or cash?
7. Should the app include prop-firm rule simulation?
8. Should the app include position sizing suggestions?
9. Should the app warn when expected returns are unrealistic?
10. Should the app produce a PDF later, or keep reports inside the app?

### 12.8 ML and LLM

1. Which LLM provider should be used first?
2. Should the app use external APIs, local models, or both?
3. Is cost more important or quality?
4. Should private strategy prompts be sent to third-party APIs?
5. Should users be able to opt out of training?
6. What data can the system learn from?
7. Who approves model promotion?
8. Should the AI be allowed to generate strategy variants automatically?
9. Should it search research papers later?
10. Should it cite papers and explain what evidence supports each idea?

### 12.9 Security and Privacy

1. Who can access the hidden page today?
2. Should only your admin account access it?
3. Should any beta users access it?
4. Should strategy prompts be encrypted at rest?
5. Should reports be encrypted at rest?
6. Should users be able to delete all strategy data?
7. How long should logs be retained?
8. What must never be logged?
9. Should screenshots or exports be blocked during private mode?
10. Do we need watermarking for leaked reports?

### 12.10 Blockchain

1. Why do we want blockchain here?
2. Is the goal speed, branding, auditability, ownership, monetization, decentralization, or trust?
3. Are on-chain proofs enough, or do we need smart contracts?
4. Should raw data ever go on-chain? Default answer should be no.
5. Should strategy text ever go on-chain? Default answer should be no.
6. Should only hashes of reports and model versions go on-chain?
7. Should this be public chain, private chain, or signed append-only log?
8. Is blockchain required for MVP, or can it wait until the engine is useful?

### 12.11 Business and Launch

1. Is this only for personal use, paid SaaS, private fund tooling, prop-trader community, or enterprise product?
2. Is there a subscription plan later?
3. Should users pay per backtest, per month, or by compute usage?
4. Should strategy templates be marketplace assets later?
5. What legal jurisdiction matters?
6. Do we need financial-disclaimer language before private beta?
7. Do we need terms of service before public launch?
8. What is the minimum quality level before showing this to anyone?

### 12.12 Success Criteria

1. What would make you say the MVP is successful?
2. What is the first "wow" moment?
3. Is the core win fast backtests, smarter reports, strategy discovery, or preventing bad trades?
4. What result would make the feature not worth building?
5. What must it do better than TradingView, QuantConnect, vectorbt notebooks, or ChatGPT?
6. What is the first benchmark task we can use to judge it?

---

## 13. Locked MVP Decisions

Answered by founder on 2026-04-25:

- First assets: MNQ and NIFTY.
- First strategy family: post-initial-balance strategy using VWAP plus inventory context.
- MNQ session context: New York session; initial balance is the first 1 hour from New York session open.
- NIFTY session context: Indian market session; initial balance is the first 1 hour from Indian market open.
- First data source: uploaded CSV.
- First access rule: only the admin account.
- VWAP reset: session VWAP.
- Risk per trade: 0.2% of account size.
- Stop loss: 12 pips/price units.
- Take profit 1: 15 pips/price units.
- Take profit 2: 45 pips/price units.
- Stop management: shift stop to breakeven after TP1 is achieved.
- Entry direction: either long or short after pullback and confirmed structure change.
- Inventory context: caught buyers and caught sellers.
- NIFTY market-open default: 09:15 IST; IB window 09:15-10:15 IST.
- MNQ New York session-open default: 09:30 ET; IB window 09:30-10:30 ET. This means the US cash/RTH-style New York session, not the Globex evening open.
- TP1 exit default: close 50% of position at TP1.
- TP2 exit default: close all remaining position at TP2.
- Unit default: treat 12/15/45 as index points for MNQ and NIFTY unless the uploaded CSV or strategy settings explicitly define ticks/pips.

Initial interpretation:

- "IB" means initial balance. The engine should wait until the relevant session's initial balance has formed, then evaluate trade logic after that window is complete.
- For NIFTY, initial balance is measured in Indian market time from market open to 1 hour after open.
- For MNQ, initial balance is measured in New York session time from session open to 1 hour after open.
- VWAP should be part of the trade filter and/or trigger logic.
- Inventory should act as a market-context filter. In this MVP, "inventory" means trapped/caught buyers above a failed bullish move or trapped/caught sellers below a failed bearish move.
- The phrase "pips/price units" must be normalized per instrument before implementation, because MNQ and NIFTY usually trade in points/ticks rather than forex pips.
- Implementation should start strict and deterministic. If a setup cannot be detected from uploaded OHLCV without guessing, the engine should mark the trade as "not eligible" instead of inventing confidence.

---

## 14. Remaining Default Assumptions

These are temporary assumptions until the remaining details are answered.

- First timeframe: 5-minute OHLCV.
- First report standard: net backtest plus drawdown, costs, walk-forward, Monte Carlo, and caveats.
- First blockchain use: none in MVP; revisit as audit-proof layer only after the engine works.
- First UX: one hidden chat page with structured strategy spec and report output.
- First launch state: hidden behind feature flag and admin role.

---

## 15. Strategy Implementation Defaults

These defaults are chosen for the first implementation so the engine can backtest without repeatedly asking for strategy details.

### 15.1 Session and IB Defaults

| Asset | Session Open | IB Window | Timezone | Notes |
|---|---:|---:|---|---|
| NIFTY | 09:15 | 09:15-10:15 | Asia/Kolkata | Indian regular market open |
| MNQ | 09:30 | 09:30-10:30 | America/New_York | New York/RTH-style session, not Globex 18:00 ET open |

IB high = highest high inside the first-hour IB window.

IB low = lowest low inside the first-hour IB window.

No entry is allowed before the IB window closes.

### 15.2 VWAP Default

- Use session VWAP.
- Reset VWAP at the configured session open.
- VWAP formula: cumulative `(typical_price * volume) / cumulative volume`, where `typical_price = (high + low + close) / 3`.
- If uploaded CSV has no volume, use a fallback equal-weighted session average and mark the report as lower confidence.

### 15.3 Caught Inventory Defaults

Caught sellers:

- After IB completes, price trades below `IB_low` by at least 1 point.
- Price then closes back above `IB_low` within the same candle or the next 2 candles.
- That failed downside continuation marks sellers as caught.

Caught buyers:

- After IB completes, price trades above `IB_high` by at least 1 point.
- Price then closes back below `IB_high` within the same candle or the next 2 candles.
- That failed upside continuation marks buyers as caught.

### 15.4 Structure Change Defaults

Bullish structure change after caught sellers:

- Find the highest high of the 3 candles immediately before the sweep below IB low.
- A bullish structure change is confirmed when a later candle closes above that level and closes at or above session VWAP.

Bearish structure change after caught buyers:

- Find the lowest low of the 3 candles immediately before the sweep above IB high.
- A bearish structure change is confirmed when a later candle closes below that level and closes at or below session VWAP.

### 15.5 Pullback Defaults

Long pullback:

- After bullish structure change, wait for price to retrace toward session VWAP or into 33%-66% of the impulse from sweep low to structure-change close.
- Pullback must not close below the original sweep low.
- Entry trigger: first bullish candle after pullback that closes above the prior candle high.

Short pullback:

- After bearish structure change, wait for price to retrace toward session VWAP or into 33%-66% of the impulse from sweep high to structure-change close.
- Pullback must not close above the original sweep high.
- Entry trigger: first bearish candle after pullback that closes below the prior candle low.

### 15.6 Risk, Exits, and Sizing Defaults

- Account risk per trade: 0.2% of current account equity.
- Stop loss: 12 points.
- TP1: 15 points.
- TP2: 45 points.
- TP1 closes 50% of position.
- After TP1 fills, move stop on remaining size to breakeven.
- TP2 closes all remaining size.
- Position size = `floor((account_equity * 0.002) / (stop_points * point_value))`.
- If the calculated integer position size is less than 1 contract/lot, skip the trade rather than exceeding 0.2% risk.
- For MVP reporting, show both theoretical fractional sizing and strict integer sizing if instrument metadata is available.

### 15.7 No-Trade Filters

- No trade before IB completes.
- No trade if CSV has missing OHLC columns.
- No trade if timestamp ordering is invalid.
- No trade if more than 2 consecutive expected bars are missing inside the active session.
- No trade if entry is more than 2R away from session VWAP after pullback.
- No trade if the setup appears in the final 30 minutes of the configured session.
- Maximum 1 long and 1 short attempt per asset per session for MVP.
- Do not take a second trade after a full stop-loss on the same side in the same session.
- If high-impact news timestamps are not supplied, news filtering is marked "not applied" instead of assumed.

### 15.8 Uploaded CSV Defaults

Required CSV columns:

```text
timestamp,open,high,low,close,volume
```

Optional CSV columns:

```text
symbol,timezone,session,contract,point_value,tick_size
```

Timestamp rules:

- ISO timestamps with timezone are preferred.
- If timezone is missing, use `Asia/Kolkata` for NIFTY and `America/New_York` for MNQ.
- Rows must be sorted or sortable by timestamp.
- Duplicate timestamps are rejected unless the user explicitly chooses aggregation later.

### 15.8.1 Instrument Metadata v1

These defaults make the first implementation deterministic. User CSV metadata can override them only when validated and shown in the report.

| Instrument | Default symbol match | Session | Currency | Tick size | Point value | Lot/contract rule | Default fee/slippage caveat |
|---|---|---|---|---:|---:|---|---|
| MNQ | `MNQ`, `MNQ*`, `Micro NQ` | New York RTH-style `09:30-16:00 America/New_York` | USD | 0.25 index point | 2 USD per index point | Integer contracts only | Use configurable per-side commission and 1 tick slippage until broker fee is supplied |
| NIFTY index CSV | `NIFTY`, `NIFTY50`, `NSE:NIFTY` | NSE cash `09:15-15:30 Asia/Kolkata` | INR | 0.05 index point for display only | 1 INR per index point for synthetic/index backtest | Theoretical sizing only unless lot size supplied | Report must say index CSV is not directly tradable |
| NIFTY futures CSV | `NIFTY_F`, `NIFTY FUT`, user-selected futures | NSE derivatives `09:15-15:30 Asia/Kolkata` | INR | 0.05 index point unless supplied | `lot_size * 1 INR` per index point | Integer lots only | User must confirm lot size, fees, and expiry/roll treatment |

Default account currency:

- MNQ reports default to USD.
- NIFTY reports default to INR.
- Cross-currency aggregation is not in MVP.

If instrument metadata is missing:

- Show theoretical fractional sizing.
- Skip strict integer sizing.
- Mark report as lower confidence.
- Do not label the result paper-trade candidate.

### 15.8.2 CSV Import Profiles v1

| Profile | Required headers accepted | Timestamp handling | Default timezone | Decision |
|---|---|---|---|---|
| `canonical_ohlcv_v1` | `timestamp,open,high,low,close,volume` | ISO preferred | Asset default if missing | MVP baseline |
| `tradingview_export_v1` | `time,open,high,low,close,volume` or `Time,Open,High,Low,Close,Volume` | Parse exchange/local string; require user confirmation if timezone missing | Asset default | Allowed with confirmation |
| `ninjatrader_export_v1` | `Date,Time,Open,High,Low,Close,Volume` or combined timestamp | Combine Date+Time before parse | User must confirm if asset cannot infer | Allowed with confirmation |
| `broker_generic_v1` | Any case-insensitive OHLCV synonyms | Infer by normalized names | User must confirm | Research-only until profile saved |
| `malformed_csv_v1` | Missing OHLC, duplicate timestamp, nonnumeric OHLC, impossible high/low | Reject with row-level errors | N/A | Block normal report |

Column synonyms:

| Canonical | Accepted synonyms |
|---|---|
| `timestamp` | `time`, `datetime`, `date_time`, `date time`, `Date+Time` |
| `open` | `Open`, `open_price`, `o` |
| `high` | `High`, `high_price`, `h` |
| `low` | `Low`, `low_price`, `l` |
| `close` | `Close`, `last`, `close_price`, `c` |
| `volume` | `Volume`, `vol`, `contracts`, `qty` |

Import confidence:

| Condition | Confidence impact |
|---|---|
| Exact canonical headers and ISO timezone timestamps | High |
| Header synonyms only | Medium-high |
| Missing timezone but known asset/session | Medium |
| Separate date/time fields | Medium |
| Missing volume | Low confidence but allowed with VWAP caveat |
| Duplicate timestamps | Block unless future explicit aggregation mode exists |
| Invalid OHLC relation | Block |

### 15.9 Setup Detector State Machine And Golden Fixtures

Setup detector state machine:

```text
WAIT_FOR_IB
  -> SCAN_FOR_SWEEP
  -> CAUGHT_SELLERS_ACTIVE or CAUGHT_BUYERS_ACTIVE
  -> WAIT_FOR_CHOCH
  -> WAIT_FOR_PULLBACK
  -> WAIT_FOR_ENTRY_TRIGGER
  -> TRADE_ACTIVE
  -> SESSION_DONE
  -> NO_TRADE
```

State rules:

- `WAIT_FOR_IB`: no trade logic runs until the IB window is complete.
- `SCAN_FOR_SWEEP`: long path requires sweep below `IB_low`; short path requires sweep above `IB_high`.
- `CAUGHT_SELLERS_ACTIVE`: price must close back above `IB_low` within the sweep candle or next 2 candles.
- `CAUGHT_BUYERS_ACTIVE`: price must close back below `IB_high` within the sweep candle or next 2 candles.
- `WAIT_FOR_CHOCH`: bullish CHoCH closes above the 3-candle pre-sweep high and at/above VWAP; bearish CHoCH closes below the 3-candle pre-sweep low and at/below VWAP.
- `WAIT_FOR_PULLBACK`: pullback must touch VWAP zone or 33%-66% retracement of sweep extreme to CHoCH close within 6 candles.
- `WAIT_FOR_ENTRY_TRIGGER`: long entry is first bullish candle after pullback closing above prior candle high; short entry is first bearish candle after pullback closing below prior candle low.
- If a second opposite sweep occurs before entry, invalidate the current setup and return to `SCAN_FOR_SWEEP`.
- Long and short setups cannot both be active at the same time in MVP.

Execution fill state machine:

```text
NO_POSITION
  -> ENTRY_PENDING
  -> POSITION_OPEN
  -> TP1_FILLED
  -> BREAKEVEN_ARMED
  -> EXITED_TP2 or EXITED_STOP or EXITED_BREAKEVEN or EXITED_SESSION_CLOSE
```

Golden fixtures:

| Fixture ID | Scenario | Minimal candle sequence after IB | Expected result |
|---|---|---|---|
| `GF-LONG-001` | Valid caught-sellers long | sweep below IB low, close back above IB low within 2 candles, bullish CHoCH above pre-sweep 3-candle high and VWAP, pullback to VWAP/33%-66%, bullish entry trigger | One long trade candidate |
| `GF-SHORT-001` | Valid caught-buyers short | sweep above IB high, close back below IB high within 2 candles, bearish CHoCH below pre-sweep 3-candle low and VWAP, pullback to VWAP/33%-66%, bearish entry trigger | One short trade candidate |
| `GF-NO-001` | Sweep without reclaim | price trades below IB low but does not close back above within 2 candles | No caught sellers, no trade |
| `GF-NO-002` | Caught sellers but no CHoCH | reclaim occurs but no later close above pre-sweep high and VWAP | No trade, reason `NO_CHOCH` |
| `GF-NO-003` | CHoCH but no pullback | CHoCH occurs, then price runs away for 6 candles without VWAP/retrace pullback | No trade, reason `NO_PULLBACK` |
| `GF-NO-004` | Pullback invalidates sweep | long pullback closes below original sweep low | No trade, reason `PULLBACK_INVALIDATED` |
| `GF-FILL-001` | Entry and stop same candle | long entry trigger candle also touches stop | Stop fill wins, result `stopped` |
| `GF-FILL-002` | TP1 and stop same candle before TP1 confirmation | candle touches both TP1 and stop | Worst case, stop fill wins unless prior candle already confirmed TP1 |
| `GF-FILL-003` | TP1 then TP2 same directional candle | long candle opens near entry, low stays above entry, high touches TP2 | Allow TP1 then TP2 |
| `GF-FILL-004` | TP1 then breakeven ambiguity | after TP1, same/next ambiguous candle touches breakeven and TP2 | If sequence unclear, breakeven fill wins |
| `GF-DATA-001` | Low-quality missing bars | valid setup shape but more than 2 consecutive active-session bars missing | Block normal report or mark research-only |

Golden fixture acceptance:

- Each fixture must become a unit test before M5 is considered complete.
- Fixture expected outputs include setup state path, trade/no-trade reason, entry/exit prices, and caveats.

---

## 16. Remaining Open Decisions

These can be implemented with defaults now, then improved after first backtest evidence:

1. Exact point value and lot/contract metadata for NIFTY futures/options data.
2. Whether NIFTY means spot index, futures, or options in each uploaded CSV.
3. Whether MNQ data is RTH-only or includes full Globex data.
4. Whether to allow more than one setup per side per session after MVP.
5. Whether to add explicit high-impact news calendars to uploaded CSV or fetch them later.
6. Whether to optimize the 1-point trap threshold after enough data exists.

Current MVP decision summary:

```text
First assets: MNQ and NIFTY
First strategy: post-IB strategy using session VWAP + caught buyer/seller inventory context
First data: uploaded CSV
First access: admin account only
IB windows: first 1 hour from relevant market/session open
NIFTY IB: 09:15-10:15 IST
MNQ IB: 09:30-10:30 ET
Risk: 0.2% account risk per trade
SL/TP: 12 stop, TP1 15, TP2 45, breakeven after TP1
TP1/TP2 sizing: 50% off at TP1, remainder off at TP2
Units: points by default
```

---

## 17. Working MVP Definition

Proposed MVP:

> A hidden admin-only page where the trader describes a post-initial-balance MNQ or NIFTY strategy in plain English, the app converts it into a validated strategy spec using session VWAP, caught buyer/seller inventory context, pullback confirmation, and structure-change confirmation, runs a realistic net backtest on uploaded CSV data with 0.2% account risk per trade, 12-unit stop, TP1 at 15 units, TP2 at 45 units, and breakeven after TP1, then returns a strict risk report with a reject/revise/paper-trade verdict.

This MVP is intentionally narrow. Once it is trustworthy, expand asset coverage, data sources, strategy families, ML optimization, research-paper retrieval, and audit proofs.

---

## 18. Free-For-Lifetime Architecture Principle

The only reliable way to make this feature "free for lifetime" is to avoid mandatory rented compute, paid APIs, paid data, paid databases, paid LLM calls, paid blockchain gas, paid storage, and paid background workers.

Therefore the default architecture is:

- Static frontend hosted on the existing web app path.
- Browser-first computation for MVP backtests.
- Uploaded CSV data processed locally in the admin browser.
- IndexedDB/local file export for private state.
- Optional local Python/FastAPI runner for heavier jobs on the user's own machine.
- Optional Cloudflare Pages static hosting because it currently has a $0/free plan, but the app must still work from a local build if a vendor changes terms.
- No paid public blockchain in the critical path.
- No embedded paid LLM API in the mandatory app runtime.
- Codex/Claude/GPT/Opus Code can be used as an always-available operator/research layer when the founder is actively working, but the app must not require storing a paid API key or running server-side LLM calls to complete an MVP backtest.
- No server-side storage required for MVP.

Free does not mean unlimited. The system must degrade safely:

- Small/medium CSV: run in browser.
- Large CSV: chunk in browser worker.
- Very large/tick data: run local Python CLI/ML engine.
- Hosted free-tier quota hit: use local build.
- No LLM available: use deterministic parser and guided forms.
- No public chain available: use local hash-chain proof ledger.

---

## 19. Free Infrastructure Decision

### 19.1 Mandatory Runtime

| Layer | Choice | Cost Target | Reason |
|---|---|---:|---|
| UI hosting | Cloudflare Pages or local static build | $0 | Static frontend is the only hosted part needed for MVP |
| Compute | Browser Web Workers | $0 | User machine pays compute cost, not a server |
| Data storage | Uploaded CSV + IndexedDB + export files | $0 | No mandatory hosted database |
| Strategy parsing | Deterministic parser + templates | $0 | Avoid paid LLM dependency |
| Report generation | Local deterministic report engine | $0 | No server or API call |
| Audit proof | Local Merkle/hash-chain ledger | $0 | No gas, no paid chain |
| Heavy research | Optional local Python runner | $0 hosting | Uses existing repo/ML engine locally |
| Agent assistance | Codex/Claude/GPT/Opus Code as operator | Existing user access | Used to build, inspect, critique, and improve; not required by app runtime |

### 19.2 Optional Runtime

| Layer | Choice | Use Only If |
|---|---|---|
| Cloudflare Workers | Thin auth/config proxy only | Needed later and below free limits |
| Existing BFF | Existing product APIs | The feature needs account/admin verification from backend |
| Existing ML engine | Local or current deployment | Heavy backtest/ML job exceeds browser limits |
| Local Ollama/WebLLM | Local natural-language enhancement | User wants LLM-like interaction without paid APIs |
| Codex/Claude/GPT/Opus Code | Human-supervised agent workflow | Founder wants agent to implement, audit, or interpret results |
| GitHub repo proof | Optional exported proof commit | Public timestamping is wanted without blockchain fees |
| Public blockchain proof | Optional later | A real business need exists and free/feeless constraints still hold |

### 19.3 Explicit Non-Goals For Free MVP

- No server-side batch compute for user CSVs.
- No paid OpenAI/Anthropic/Gemini calls as a requirement.
- No paid market-data vendor.
- No hosted database requirement.
- No R2/S3 storage requirement.
- No on-chain raw data.
- No on-chain strategy text.
- No on-chain reports.
- No public chain write required for a backtest to complete.

---

## 20. Detailed Component Architecture

Architecture rule:

- Browser-first for MVP so private CSVs, reports, proof blocks, and strategy specs can stay local.
- Local runner second for large files, overnight jobs, and shell-level autonomy.
- Hosted services only for auth, feature flags, optional settings sync, and optional remote/provider integrations.
- The deterministic engine, not the agent or LLM, owns all numerical truth.

### 20.0 Runtime Topology

MVP topology:

```text
React hidden page
  -> IndexedDB artifact store
  -> Web Worker backtest engine
  -> local proof chain
  -> report renderer
  -> agent export
```

Autonomous local topology:

```text
React hidden page
  -> Agent control plane
  -> Local runner bridge
  -> PowerShell/Bash/Python/Node tools
  -> filesystem artifact workspace
  -> IndexedDB summary store
  -> proof chain + report versions
```

Optional hosted topology later:

```text
React hidden page
  -> BFF auth/settings/feature flags
  -> provider gateway for opt-in BYOK calls
  -> ML engine for heavy research if user/admin enables it
  -> no mandatory upload of private CSVs
```

The product should be able to run a useful backtest without any hosted compute, paid model call, paid storage, or public blockchain write.

### 20.0.1 Architecture Planes

| Plane | Owns | MVP location | Later expansion |
|---|---|---|---|
| UI plane | Workspace layout, transcript, artifact inspector, controls | React | Same |
| Agent control plane | Plan, task state, tool routing, context budget, autonomous loop | Browser state first | Local runner service for long jobs |
| Data plane | CSV parsing, validation, feature-ready bars | Browser worker + IndexedDB | Python runner, ML engine, DVC |
| Execution plane | Setup detection, simulation, metrics | Browser worker | Python/vectorized engines |
| Evidence plane | Reports, ledgers, proof blocks, hashes | IndexedDB + export files | Git proof, optional public anchor |
| Memory plane | Per-user lessons, preferences, tool skills | IndexedDB | Encrypted sync if user opts in |
| Provider plane | Local LLM, BYOK remote LLM, platform-funded LLM off by default | Local config only | Provider gateway with encrypted key refs |
| Safety plane | Scope limits, kill switch, audit log, risk stops | Browser + local runner | BFF policy service |

### 20.0.2 Core Domain Objects

The architecture should revolve around stable domain objects rather than UI component state.

| Object | Purpose | Immutable after finalization? |
|---|---|---|
| `workspace` | User/account scoped research area | No |
| `dataset` | Uploaded or referenced market data with hash and quality score | Yes after hash |
| `strategy_spec` | Deterministic versioned strategy DSL | Yes per version |
| `run_plan` | Ordered steps the agent intends to execute | No until run starts |
| `tool_event` | Append-only record of every important action | Yes |
| `backtest_run` | Execution attempt with status, inputs, outputs, metrics | Yes after completion |
| `artifact` | Content-addressed output such as ledger, report JSON, equity curve | Yes after hash |
| `report_version` | Human-readable report tied to exact run artifacts | Yes |
| `proof_block` | Hash-chain block proving artifact lineage | Yes |
| `memory_capsule` | User-specific summary or validated lesson | Mutable only through new versions |
| `provider_profile` | User-selected LLM/local provider config without raw secrets in logs | No |

Minimal object graph:

```text
workspace
  -> datasets
  -> strategy_specs
  -> run_plans
  -> backtest_runs
      -> tool_events
      -> artifacts
      -> report_versions
      -> proof_blocks
  -> memory_capsules
  -> provider_profiles
```

### 20.0.3 Boundary Rules

- UI components render state; they do not compute trading metrics.
- Strategy parsing can suggest DSL, but the DSL validator decides whether a strategy is executable.
- The worker or Python runner computes features, trades, metrics, and equity curves.
- Report Builder converts structured facts into prose; it does not invent missing facts.
- Proof Chain hashes artifacts; it does not decide strategy quality.
- Memory Manager can personalize suggestions; it cannot alter historical evidence.
- LLMs can propose, explain, and summarize; they cannot replace deterministic validation.
- Terminal commands are allowed only through scoped tool events tied to the active agenda.

### 20.1 Frontend Components

Proposed files:

```text
src/features/vibing-finance/VibingFinanceScreen.jsx
src/features/vibing-finance/vibingFinance.css
src/features/vibing-finance/vibingFinanceFlags.js
src/features/vibing-finance/agentControlPlane.js
src/features/vibing-finance/researchCoordinator.js
src/features/vibing-finance/agentTeam.js
src/features/vibing-finance/agentRunner.js
src/features/vibing-finance/messageBus.js
src/features/vibing-finance/sharedMemory.js
src/features/vibing-finance/taskQueue.js
src/features/vibing-finance/toolRouter.js
src/features/vibing-finance/toolRegistry.js
src/features/vibing-finance/artifactStore.js
src/features/vibing-finance/strategyParser.js
src/features/vibing-finance/strategySchema.js
src/features/vibing-finance/csvIngestion.js
src/features/vibing-finance/sessionCalendar.js
src/features/vibing-finance/vwap.js
src/features/vibing-finance/inventoryDetector.js
src/features/vibing-finance/structureDetector.js
src/features/vibing-finance/backtestEngine.js
src/features/vibing-finance/riskMetrics.js
src/features/vibing-finance/reportBuilder.js
src/features/vibing-finance/proofChain.js
src/features/vibing-finance/memoryManager.js
src/features/vibing-finance/providerAdapters.js
src/features/vibing-finance/runnerBridge.js
src/features/vibing-finance/storage.js
src/features/vibing-finance/workers/backtest.worker.js
src/features/vibing-finance/__tests__/*
```

Screen responsibilities:

- Verify feature flag.
- Verify admin access.
- Accept CSV upload.
- Parse and validate data.
- Show strategy conversation.
- Show normalized strategy spec.
- Show run plan, tool events, and current agenda scope.
- Run backtest in worker.
- Route optional local runner or BYOK provider calls through adapters.
- Show progress.
- Render institutional report.
- Store local artifacts.
- Manage per-user memory capsules and provider profiles.
- Export report JSON/CSV if needed.
- Append audit event to local proof chain.

### 20.2 Local Storage Components

Use browser IndexedDB, not localStorage, for structured artifacts.

Object stores:

```text
datasets
strategy_specs
run_plans
backtest_runs
tool_events
artifacts
reports
proof_blocks
memory_capsules
provider_profiles
settings
```

Dataset record:

```json
{
  "dataset_id": "sha256:...",
  "symbol": "MNQ",
  "source": "uploaded_csv",
  "filename": "mnq_5m_2024.csv",
  "row_count": 123456,
  "start_time": "2024-01-02T09:30:00-05:00",
  "end_time": "2024-12-31T16:00:00-05:00",
  "timeframe_inferred": "5m",
  "timezone": "America/New_York",
  "columns": ["timestamp", "open", "high", "low", "close", "volume"],
  "quality_score": 0.97,
  "created_at": "..."
}
```

Backtest run record:

```json
{
  "run_id": "uuid",
  "dataset_id": "sha256:...",
  "strategy_hash": "sha256:...",
  "engine_version": "vibing-backtest-js-0.1",
  "started_at": "...",
  "completed_at": "...",
  "status": "completed",
  "metrics": {},
  "report_hash": "sha256:..."
}
```

Storage schema versioning:

| IndexedDB version | Stores | Migration rule |
|---:|---|---|
| 1 | `datasets`, `strategy_specs`, `backtest_runs`, `reports`, `proof_blocks`, `settings` | Initial browser MVP |
| 2 | `run_plans`, `tool_events`, `artifacts`, `memory_capsules`, `provider_profiles` | Add only after MVP artifacts are stable |

Storage rules:

- Never mutate a completed report, trade ledger, metrics object, or proof block in place.
- New engine/schema versions create new artifact versions.
- If a migration fails, keep old stores intact and show recovery/export prompt.
- If quota is exceeded, stop the run, preserve completed artifacts, and prompt export/delete.
- Raw CSV bytes are optional; hashes and metadata are required.
- Local delete must offer proof/export first.

Failure/recovery matrix:

| Failure | Detection | Recovery |
|---|---|---|
| Worker crash | Worker error/exit before completion event | Mark run failed, keep events, allow rerun from validated dataset |
| Tab closes mid-run | Missing completion after heartbeat | On reload, mark interrupted and resume only if checkpoint/input hashes match |
| IndexedDB quota exceeded | Write failure with quota code | Stop run, export existing artifacts, suggest deleting raw CSV bytes |
| Corrupted IndexedDB record | Hash mismatch or JSON parse failure | Mark artifact untrusted; require re-import or rerun |
| Partial export | Manifest hash missing/mismatch | Reject import; show missing artifact refs |
| Proof hash mismatch | Verify hash mismatch | Block positive verdict/promotion; require rerun or restore correct artifact |
| Runner disconnect | SSE closed or heartbeat timeout | Mark runner job interrupted; allow reconnect/status check |
| Provider failure | Adapter timeout/error | Fall back to deterministic mode; no metrics affected |

### 20.3 Worker Architecture

The backtest must not block the UI thread.

Main thread sends:

```json
{
  "type": "RUN_BACKTEST",
  "payload": {
    "dataset": [],
    "strategySpec": {},
    "account": {
      "starting_equity": 25000,
      "risk_fraction": 0.002
    }
  }
}
```

Worker streams progress:

```json
{ "type": "PROGRESS", "stage": "validating", "pct": 10 }
{ "type": "PROGRESS", "stage": "computing_vwap", "pct": 25 }
{ "type": "PROGRESS", "stage": "detecting_setups", "pct": 45 }
{ "type": "PROGRESS", "stage": "simulating", "pct": 70 }
{ "type": "PROGRESS", "stage": "building_report", "pct": 90 }
{ "type": "COMPLETE", "result": {} }
```

Failure handling:

- Parse error: return row number and column.
- Data quality failure: return failed checks.
- No trades: return "no eligible setups" report, not an app error.
- Memory pressure: recommend local Python runner.

### 20.4 Agent Control Plane Architecture

The Agent Control Plane is the coordinator. It should be deterministic enough to debug, even when an LLM is involved.

Control-plane modules:

| Module | Responsibility | Writes |
|---|---|---|
| Plan Store | Current checklist, dependencies, status, run budget | `run_plan` |
| Context Manager | Selects compact context for LLM/agent/tool calls | `context_snapshot` artifact |
| Tool Router | Validates and dispatches typed tools | `tool_event` |
| Job Scheduler | Runs queued steps, retries safe failures, respects budgets | `tool_event`, `backtest_run` |
| Artifact Indexer | Registers content hashes and relationships | `artifact` |
| Memory Manager | Writes per-user lessons and preferences | `memory_capsule` |
| Policy Guard | Blocks out-of-scope, secret-risk, or destructive actions | `tool_event` with rejection reason |

Control loop:

```text
read user agenda
  -> create run_plan
  -> select next runnable step
  -> build tool input
  -> policy check
  -> execute tool
  -> persist tool_event
  -> inspect output
  -> update run_plan
  -> create/attach artifacts
  -> continue until done, blocked, cancelled, or budget exhausted
```

The control plane must keep plan state and evidence state separate. A plan item can be edited while the run is still being planned; a completed tool event and hashed artifact cannot be edited.

### 20.5 Command/Event Contract

Use a command/event split:

- Command: requested action before execution.
- Event: immutable fact after execution.

Command example:

```json
{
  "command_id": "cmd_001",
  "type": "RUN_BACKTEST",
  "workspace_id": "local",
  "run_plan_id": "plan_001",
  "input_artifact_refs": ["dataset:sha256:...", "strategy:sha256:..."],
  "requested_by": "user",
  "allowed_tools": ["browser_worker"],
  "budget": {
    "max_runtime_seconds": 300,
    "max_memory_mb": 1024
  }
}
```

Event example:

```json
{
  "event_id": "evt_001",
  "command_id": "cmd_001",
  "type": "BACKTEST_COMPLETED",
  "status": "pass",
  "started_at": "...",
  "completed_at": "...",
  "input_hash": "sha256:...",
  "output_hash": "sha256:...",
  "summary": {
    "trades": 42,
    "profit_factor": 1.41,
    "max_drawdown_pct": 3.8
  }
}
```

Rules:

- Every command gets either a completion event, failure event, cancellation event, or policy-rejected event.
- Event payloads must be serializable JSON.
- Large outputs are artifact references, not inline blobs.
- Events include enough metadata to replay the UI transcript.
- Events are append-only; corrections are new events.
- Idempotent commands must include an input hash so retries do not duplicate completed work.

### 20.6 Artifact Store Architecture

Artifacts should be content-addressed.

Artifact reference format:

```text
artifact:<kind>:sha256:<hash>
```

Artifact kinds:

| Kind | Examples | Storage |
|---|---|---|
| `dataset_raw` | Original uploaded CSV bytes | Optional IndexedDB/file |
| `dataset_normalized` | Parsed bars with canonical timestamps | IndexedDB/file |
| `strategy_spec` | Validated DSL JSON | IndexedDB |
| `feature_table` | IB, VWAP, swings, labels | IndexedDB/file |
| `trade_ledger` | Entries, exits, fees, slippage, reasons | IndexedDB/file |
| `equity_curve` | Timestamped equity and drawdown | IndexedDB/file |
| `metrics` | Risk and performance metrics JSON | IndexedDB |
| `report_json` | Structured report facts | IndexedDB |
| `report_markdown` | Human-readable report | IndexedDB/file |
| `agent_export` | Compact context for Codex/Claude/GPT/Opus review | File/export |
| `proof_block` | Hash-chain block | IndexedDB/file |

Rules:

- Hash raw bytes where possible.
- Hash canonical JSON with stable key order for structured artifacts.
- Never hash secrets into public proof exports.
- Store artifact lineage: parent refs, engine version, schema version, and creation tool event.
- If an artifact is regenerated, create a new artifact ref even when the human-readable name is the same.

### 20.7 Local Runner Bridge Architecture

The local runner bridge is the escape hatch for heavy jobs and unattended operation.

Initial transport options:

| Option | Description | When to use |
|---|---|---|
| Manual CLI export/import | User exports a run package and runs Python CLI | Lowest complexity |
| Local HTTP bridge | Desktop/local service exposes localhost API | Best UX for unattended jobs |
| VS Code/Codex terminal | Agent runs repo commands directly while developing | Founder/operator workflow |
| VPS runner | User-controlled remote machine runs long research jobs | Overnight or large datasets |

Bridge responsibilities:

- Advertise a capability manifest.
- Receive a run package with dataset/spec hashes.
- Execute only allowed tools for the active agenda.
- Stream heartbeats and progress.
- Write artifacts to a declared workspace path.
- Return output refs, logs, exit codes, and proof inputs.
- Resume interrupted jobs when checkpoint data exists.

Capability manifest example:

```json
{
  "runner_id": "local-windows-001",
  "os": "windows",
  "shells": ["powershell"],
  "languages": ["python", "node"],
  "tools": ["pytest", "npm", "git"],
  "max_parallel_jobs": 1,
  "workspace_root": "E:/TradersApp",
  "can_run_unattended": true,
  "can_access_network": false
}
```

Safety constraints:

- The bridge executes from an allowlisted workspace root.
- The bridge records every shell command as a typed event.
- Destructive operations require a policy reason and stronger gate.
- Secret files are excluded from agent exports and command summaries.
- Network access defaults off for backtests unless a provider/data-source task explicitly needs it.
- PowerShell, terminal, filesystem, browser automation, and tool powers are available only through this local runner/CLI surface, not directly inside the browser workbench.
- The runner may operate unattended when the user is away or asleep, but only within an agenda-bounded run plan and explicit policy scope.
- Terminal powers must be tied directly or indirectly to the approved agenda for this product: strategy parsing, data handling, backtests, reporting, proofing, testing, implementation, or user-requested research tasks.
- Out-of-scope terminal usage must be policy-rejected and logged as a rejected tool event.
- "Same powers as a coding agent" means capability parity through the runner surface, not unrestricted hidden autonomy.

### 20.8 BYOK Provider Gateway Architecture

Provider config should be separate from strategy execution.

Provider call flow:

```text
user selects provider mode
  -> provider profile saved
  -> context manager redacts payload
  -> policy guard checks opt-in, token cap, cost cap
  -> provider adapter sends request
  -> response saved as explanation/suggestion artifact
  -> deterministic validator accepts or rejects executable changes
```

Provider adapters:

- `local_ollama`
- `browser_webllm`
- `openai_compatible_byok`
- `anthropic_byok`
- `gemini_byok`
- `openrouter_byok`
- `platform_funded_later`

Rules:

- Provider output is advisory until converted into validated DSL or report commentary tied to metrics.
- Provider errors must degrade to deterministic mode.
- BYOK secrets are referenced by credential ID, not copied into events.
- Cost and token estimates are visible before autonomous remote calls.
- Autonomous mode cannot spend user/provider quota beyond the configured budget.
- Every user may supply their own LLM/agent key and choose not to use any platform-owned key.
- BYOK must be first-class, not an afterthought.
- The platform default for paid remote providers should be `user_key_preferred`.
- If the user has not configured a key, the system must degrade to deterministic mode or local-provider mode rather than silently switching to a platform-paid provider.
- Supported BYOK intent includes OpenAI-compatible, Anthropic, Gemini, OpenRouter, and any local compatible endpoint.
- The provider profile must let the user choose:
  - `disabled`
  - `local_only`
  - `byok_only`
  - `allow_platform_key_later`
- The provider profile must also let the user choose whether autonomous background runs may use their key, and must support hard limits for spend, tokens, and runtime.

Provider profile example:

```json
{
  "profile_id": "anthropic_byok_primary",
  "mode": "byok_only",
  "provider": "anthropic",
  "model": "opus-code",
  "credential_ref": "cred_001",
  "allow_autonomous_use": true,
  "max_daily_spend_usd": 5,
  "max_run_tokens": 200000,
  "allow_network_tools": false
}
```

### 20.9 Resume, Checkpoint, And Heartbeat Architecture

Long jobs need resumability.

Checkpoint boundaries:

- CSV parsed.
- Dataset validated.
- Feature table computed.
- Setup detection complete.
- Simulation complete.
- Metrics computed.
- Report generated.
- Proof block appended.

Heartbeat event:

```json
{
  "type": "AUTONOMOUS_RUN_HEARTBEAT",
  "run_id": "run_001",
  "stage": "simulating",
  "pct": 72,
  "last_artifact_ref": "artifact:feature_table:sha256:...",
  "updated_at": "..."
}
```

Resume rules:

- If the browser tab closes, reload plan/run state from IndexedDB.
- If the local runner stops, mark the run interrupted unless a checkpoint can continue.
- If input hashes changed, do not resume; start a new run.
- If engine version changed, resume only from raw/validated data and mark the report as a new version.
- Never overwrite a completed report during resume.

### 20.10 Observability And Debug Package

Every failed run should be debuggable without exposing private raw data by default.

Debug package contents:

- Run plan.
- Tool event timeline.
- Dataset metadata and quality report.
- Strategy spec hash and sanitized DSL.
- Engine version and feature flags.
- Error stack or failure reason.
- Artifact hash list.
- Proof block refs.

Excluded by default:

- Raw CSV rows.
- API keys.
- Private account identifiers.
- Full user transcript.
- Provider prompts unless the user explicitly exports them.

### 20.11 Extension Points

Design stable adapter interfaces early:

| Adapter | Purpose |
|---|---|
| `DataSourceAdapter` | CSV now, vendor APIs later |
| `StrategyParserAdapter` | Deterministic parser now, LLM-assisted parser later |
| `SimulationEngineAdapter` | Browser worker now, Python/vectorized engines later |
| `CostModelAdapter` | Fixed costs now, broker/asset-specific costs later |
| `ReportRendererAdapter` | Markdown/JSON now, PDF/slides later |
| `ProofAnchorAdapter` | Local hash chain now, Git/public anchor later |
| `ProviderAdapter` | Local/BYOK LLM modes |
| `MemoryStoreAdapter` | IndexedDB now, encrypted sync later |
| `RunnerAdapter` | Browser worker, local CLI, local HTTP bridge, VPS runner |

Adapter rule:

- Adapters can add capability, but they cannot weaken deterministic validation, proof lineage, or privacy defaults.

### 20.12 Runtime Surfaces - Final Decision

The product has four runtime surfaces. They are not interchangeable; each has a clear job.

| Surface | Name | Purpose | MVP status |
|---|---|---|---|
| Browser workbench | Vibing Finance Workbench | Primary user experience, local CSV upload, visible agent loop, reports, proof, memory | Required |
| Built-in CLI | `vibing` | Repeatable runs, batch jobs, artifact verification, local automation, CI/CD, unattended execution | Required after browser MVP |
| Local runner service | `vibing serve` | Long-running bridge between browser workbench and local machine tools | Phase 2 |
| Browser automation tool | `vibing browser ...` | Playwright-backed smoke tests, screenshots, local UI verification, optional web inspection | Phase 2 |

Decisions:

- The browser workbench is the first product surface.
- The CLI is the canonical automation surface.
- The local runner service is a thin bridge over the same CLI/tool registry.
- Browser automation is a tool exposed through the CLI/runner, not a separate agent brain.
- There is no mandatory hosted compute path.
- There is no shell access directly inside a normal web browser tab.
- Shell, filesystem, MCP, and Playwright powers require the CLI/local runner/desktop environment.
- All surfaces write the same artifact schema, tool event schema, report schema, and proof block schema.
- The unattended/autonomous surface is the CLI/local runner, not the browser tab itself.

### 20.13 Browser Workbench Decision

The browser workbench is the private, hidden, admin-gated page inside TradersApp.

Route/screen decision:

```text
screen === "vibingFinance"
feature flag === VITE_ENABLE_VIBING_FINANCE
default production visibility === hidden
```

Browser responsibilities:

- Upload CSV through user file picker.
- Hash raw file bytes locally.
- Parse, validate, and backtest small/medium datasets in Web Workers.
- Store structured artifacts in IndexedDB.
- Render transcript, run plan, tool events, report, proof, and memory.
- Configure BYOK/local provider profiles.
- Export/import run packages.
- Start local runner jobs when `vibing serve` is connected.
- Show every action in the visible work loop.

Browser non-responsibilities:

- No direct PowerShell/Bash execution.
- No unrestricted filesystem access.
- No hidden server upload of CSV.
- No required paid LLM call.
- No production training or shared model promotion.
- No final numerical claims from model text.

Browser storage decision:

- IndexedDB is the local source of browser state.

### 20.13.1 Project Workspace Document Kit

Every user project must start with an editable document kit. The engine should not operate as a floating chat without project memory, rules, and source references.

Final decision:

- Every new project gets a default document kit.
- Every document remains editable by the user.
- The user can add attachments and external references.
- The agent/workbench must read from this kit before acting on the project.
- The kit is per project, not global.

Required project documents:

1. `TODO_MASTER_LIST.md`
2. `PLANNING.md`
3. `RULES.md`
4. `SPECIAL_REQUESTS.md`
5. `ARCHITECTURE.md`
6. `UI_UX_DETAILS.md`
7. `SECURITY_PROTOCOLS.md`
8. `API_AND_INTEGRATIONS.md`
9. `GUIDELINES_AND_ATTACHMENTS.md`
10. `LEARNING_AND_TRAINING_SOURCES.md`

Project workspace structure:

```text
project-root/
  .vibing/
    project.json
    docs/
      TODO_MASTER_LIST.md
      PLANNING.md
      RULES.md
      SPECIAL_REQUESTS.md
      ARCHITECTURE.md
      UI_UX_DETAILS.md
      SECURITY_PROTOCOLS.md
      API_AND_INTEGRATIONS.md
      GUIDELINES_AND_ATTACHMENTS.md
      LEARNING_AND_TRAINING_SOURCES.md
    memory/
    artifacts/
    attachments/
```

Document roles:

| Document | Purpose |
|---|---|
| `TODO_MASTER_LIST.md` | Canonical backlog, stages, status, blockers, priorities |
| `PLANNING.md` | Current implementation plan, milestones, next actions |
| `RULES.md` | Project-wide operating rules, constraints, forbidden actions |
| `SPECIAL_REQUESTS.md` | User-specific preferences and exceptions |
| `ARCHITECTURE.md` | System design, boundaries, data flow, modules |
| `UI_UX_DETAILS.md` | Screen behavior, layout contracts, interaction rules |
| `SECURITY_PROTOCOLS.md` | Secrets, auth, data handling, threat rules, redaction |
| `API_AND_INTEGRATIONS.md` | External/internal APIs, schemas, keys, adapters, MCP/app details |
| `GUIDELINES_AND_ATTACHMENTS.md` | Attached files, references, style guides, workflows, imported docs |
| `LEARNING_AND_TRAINING_SOURCES.md` | Datasets, papers, prompts, lessons, training sources, evaluation refs |

Rules:

- The user can edit any of these docs at any time.
- The agent can propose edits, but user-authored constraints in these docs take precedence over defaults unless unsafe or contradictory.
- Every unattended run should reference the current project doc kit snapshot hash.
- Agent notes export should include the document hashes, not full document content by default.
- Attachments can be local files, URLs, notes, PDFs, images, or structured references, but must be indexed in `GUIDELINES_AND_ATTACHMENTS.md`.

Minimum project manifest:

```json
{
  "project_id": "uuid",
  "name": "MNQ Post-IB Research",
  "created_at": "...",
  "doc_kit_version": 1,
  "docs_root": ".vibing/docs",
  "attachments_root": ".vibing/attachments",
  "artifacts_root": ".vibing/artifacts",
  "memory_root": ".vibing/memory"
}
```

Agent behavior rule:

- Before acting on a project, the agent should load the document kit manifest and the high-priority docs:
  - `TODO_MASTER_LIST.md`
  - `PLANNING.md`
  - `RULES.md`
  - `SPECIAL_REQUESTS.md`
- For implementation/design/security/API tasks, it should also load the relevant specialist doc before acting.

### 20.14 CLI And Runner Powers Decision

The CLI/local runner is where agent-grade powers live.

Required powers for the runner surface:

- PowerShell/Bash command execution.
- Workspace file reads and writes.
- Structured tool calls.
- Browser automation/testing tools.
- Long-running unattended job execution.
- Resume/checkpoint support.
- Artifact hashing and proof generation.
- Optional provider calls using the user's own key.

Power scope rule:

- These powers are allowed only when they serve the active agenda directly or indirectly.
- "Indirectly" includes testing, validation, refactoring, data preparation, report export, bug fixing, and infrastructure steps necessary to complete the research/job.
- General-purpose unrelated shell access is not part of the product promise.

Policy levels:

```text
strict      = only deterministic backtest/report tools
research    = deterministic tools + provider calls + local analysis scripts
builder     = research + repo editing + tests + browser automation
operator    = builder + unattended local runner jobs + controlled terminal access
```

Default:

- Browser workbench runs in `strict`.
- Founder/admin local runner may use `operator`.
- Normal user local runner should default to `research` unless explicitly elevated on their own machine.

Project binding rule:

- Powers, provider profiles, run budgets, and memory capsules must be scoped to the active project workspace.
- A terminal/tool action must always carry `project_id` and `run_plan_id`.
- The runner must refuse commands that are not attached to a project and agenda.

### 20.15 Unattended Execution Decision

The system should be able to continue working when the user is away, but the run must be bounded.

Allowed unattended work:

- Finish a started backtest.
- Run a queued batch of strategy variants.
- Rebuild reports from existing artifacts.
- Compare prior runs.
- Generate agent notes.
- Execute scheduled local retraining/evaluation jobs.
- Run local verification/tests for implementation work.

Required guardrails:

- Explicit run budget.
- Visible queue.
- Max runtime per job.
- Max concurrent jobs.
- Checkpoints and resume.
- Kill switch.
- Full event log.
- Provider budget cap when BYOK is enabled.
- No hidden escalation from browser to terminal powers.

Run budget example:

```json
{
  "mode": "autonomous",
  "max_runtime_minutes": 180,
  "max_steps": 50,
  "max_tool_failures": 5,
  "max_provider_spend_usd": 3,
  "allow_terminal": true,
  "allow_file_writes": true,
  "allow_network": false
}
```

### 20.16 Self-Learning And Training Decision

The system should improve per user over time, but not by mutating the whole engine continuously in an uncontrolled way.

Final decision:

- Per-user learning is allowed.
- Shared/global learning is gated and delayed.
- Deterministic backtest rules do not rewrite themselves automatically.
- Model/provider prompts, memory capsules, scoring heuristics, and suggested defaults may improve over time.
- Any global/default promotion requires explicit evidence and admin approval.

Learning layers:

| Layer | Scope | Auto-update | Gate |
|---|---|---|---|
| Session memory | Per run/user | Yes | None |
| Preference memory | Per user | Yes | None |
| Strategy lesson memory | Per user | Yes, from completed runs | Evidence required |
| Suggestion heuristics | Per user | Yes | Can be reset |
| Shared default heuristics | Global | No | Admin approval |
| Deterministic strategy engine | Global | No | Code change + tests + proofable version |
| ML models later | Per user or global | Scheduled only | Training/eval/promote pipeline |

Rules:

- "Better each minute" means faster retrieval of user-specific lessons, preferences, and validated patterns.
- It does not mean silently retraining production logic every minute.
- Online adaptation may update rankings, suggestions, memory summaries, and agenda planning.
- Any statistical or ML retraining must run as a separate job with its own artifacts, metrics, and promotion decision.
- A failed or low-confidence run must never poison shared defaults.

Per-user training loop:

```text
completed run
  -> extract lessons
  -> score lesson quality
  -> store per-user memory capsule
  -> use capsule in future agent context
  -> optionally queue retraining/evaluation job
```

Retraining cadence:

- Memory updates: immediate after completed run.
- Heuristic re-ranking: immediate or batched hourly.
- Feature/parameter evaluation: scheduled.
- ML retraining: scheduled, not continuous.
- Shared default promotion: manual.

Three-speed continuous-improvement model:

| Speed | Latency | What improves | Scope | Safe because |
|---|---|---|---|---|
| Speed 1 | Seconds/minutes | Memory retrieval, user preferences, suggestion ranking, provider routing, agenda planning | Per user/project | Does not change deterministic truth |
| Speed 2 | Hourly/daily | Heuristics, prompt/context templates, candidate lessons, shadow scorecards | Per user first, optional shared candidates later | Changes are versioned and reversible |
| Speed 3 | Scheduled offline | Candidate models, global defaults, shared optimization policies | Opt-in shared/global | Requires eval, canary, approval, rollback |

If the goal is to make the whole engine better "each minute," the correct architecture is:

```text
live usage
  -> immediate per-user memory update
  -> periodic heuristic/candidate refresh
  -> offline candidate training from consented data
  -> shadow evaluation against fixed benchmarks
  -> canary release
  -> promoted default only after pass
```

Not allowed:

- Directly training the live production default from every user interaction.
- Updating deterministic metrics or trade logic from raw user feedback.
- Promoting a shared model/default without benchmark pass and rollback path.

Opt-in shared learning path:

- Users may explicitly opt in to contribute anonymized/approved learning signals.
- Shared training data must exclude secrets, raw private rows by default, and any non-consented project content.
- Shared candidate improvements run in shadow mode before they affect anyone else.
- Users can still choose `local_only` or `byok_only` and opt out entirely.

Reset/ownership:

- Every user must be able to clear their own memory capsules, provider profiles, and learned preferences.
- One user's data must not train another user's live experience by default.
- Cross-user learning requires explicit product policy and opt-in later.
- Learning sources should be editable through the project doc kit, especially `LEARNING_AND_TRAINING_SOURCES.md`.
- Attachments and user-curated references should influence that project's agent context before any shared/global heuristic.

### 20.17 Project Creation And Editing Flow

Project start flow:

1. User creates or opens a project.
2. System creates `.vibing/project.json` if missing.
3. System creates the 10 default docs if missing.
4. User can edit docs before any run.
5. Agent reads relevant docs and builds the first run plan.
6. All artifacts, memory, provider settings, and proof blocks stay attached to that project.

Editing rules:

- Users must always be able to edit any project doc from the workbench.
- Agent-proposed changes should be shown as edits to project docs, not hidden memory mutations.
- Important runtime decisions should be written back into the relevant doc when the user approves.
- Attachments and training sources should have add/remove/index actions inside the workbench.

Doc precedence:

```text
SPECIAL_REQUESTS.md
  -> RULES.md
  -> TODO_MASTER_LIST.md / PLANNING.md
  -> specialist docs
  -> product defaults
```

If docs conflict:

- `SPECIAL_REQUESTS.md` wins for user preference.
- `RULES.md` wins for project safety/constraints.
- Product safety policies override both when required.
- Raw CSV storage is optional; metadata/hash storage is required.
- Reports, proof blocks, run plans, tool events, and memory capsules are stored by default.
- Export packages are ZIP/JSON bundles later; MVP can use JSON files.

Browser worker decision:

- Use one dedicated worker for CSV parse/validation/backtest in MVP.
- Move to worker pool only after the single-worker path is stable.
- Worker messages use typed command/event envelopes.
- Worker outputs are artifact refs plus compact summaries.

### 20.14 Built-In CLI Decision

The built-in CLI is named `vibing`.

Initial implementation path:

```text
scripts/vibing-finance/cli.mjs
```

Package scripts during MVP:

```json
{
  "scripts": {
    "vibing": "node scripts/vibing-finance/cli.mjs",
    "vibing:doctor": "node scripts/vibing-finance/cli.mjs doctor",
    "vibing:serve": "node scripts/vibing-finance/cli.mjs serve"
  }
}
```

Later package entry:

```json
{
  "bin": {
    "vibing": "scripts/vibing-finance/cli.mjs"
  }
}
```

CLI principles:

- JSON-first.
- Scriptable.
- Deterministic by default.
- Works without a browser.
- Works without an LLM.
- Writes the same artifacts as the browser.
- Can run in local terminal, VS Code terminal, CI, Docker, or VPS.
- Does not require global install during MVP; use `node scripts/vibing-finance/cli.mjs ...` first.

Initial commands:

```text
vibing doctor
vibing init --workspace .vibing
vibing validate-data --csv data.csv --asset MNQ --out artifacts/vibing-finance/dataset.json
vibing plan --goal "..." --dataset dataset.json --strategy strategy.json --out plan.json
vibing run --csv data.csv --strategy strategy.json --asset MNQ --out artifacts/vibing-finance/run.json
vibing report --run run.json --out report.md
vibing proof append --run run.json --report report.md --out proof.json
vibing proof verify --proof proof.json
vibing export --run run.json --out run-package.json
vibing import --package run-package.json
vibing memory consolidate --run run.json --out memory-capsule.json
vibing provider test --profile local-ollama
vibing watch --plan plan.json --budget budget.json
vibing serve --host 127.0.0.1 --port 8787
```

Output modes:

```text
--json              machine-readable command result
--events events.ndjson
--out path
--workspace path
--no-llm
--provider profile_id
--max-runtime-seconds N
--max-cost-usd N
--allow-tool tool_name
--deny-tool tool_name
```

CLI exit codes:

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Validation or usage error |
| 2 | Data-quality block |
| 3 | Strategy-spec block |
| 4 | Tool/runtime failure |
| 5 | Policy or budget stop |
| 6 | User cancellation |
| 7 | Proof verification failure |

CLI artifact workspace:

```text
.vibing/
  settings.json
  providers.json
  memory/
  proof/
artifacts/vibing-finance/
  datasets/
  runs/
  reports/
  exports/
  logs/
```

CLI security:

- Never print secrets.
- Never include raw CSV rows in debug exports unless explicitly requested.
- Default network access is off for deterministic backtest commands.
- Shell execution requires an explicit command/tool invocation from `vibing watch`, `vibing serve`, or developer/operator mode.
- Destructive filesystem actions are not part of the MVP CLI.

### 20.15 Shared Core Layout Decision

The deterministic engine must not be trapped inside React components.

Final module split:

```text
src/features/vibing-finance/ui/*
src/features/vibing-finance/core/*
src/features/vibing-finance/agent/*
src/features/vibing-finance/storage/*
src/features/vibing-finance/workers/*
scripts/vibing-finance/*
```

Pure core modules:

```text
core/strategySchema.js
core/csvIngestion.js
core/sessionCalendar.js
core/vwap.js
core/inventoryDetector.js
core/structureDetector.js
core/backtestEngine.js
core/riskMetrics.js
core/reportBuilder.js
core/proofChain.js
core/artifactSchemas.js
core/eventSchemas.js
```

Rules:

- Browser worker imports `core/*`.
- CLI imports `core/*`.
- Local runner imports `core/*`.
- UI imports UI adapters, not engine internals directly where avoidable.
- Core modules are pure or explicitly declare side effects.
- Core modules never read environment variables or provider keys.

### 20.16 Local Runner Service Decision

`vibing serve` is a localhost-only service that lets the browser workbench use local power safely.

Default binding:

```text
host: 127.0.0.1
port: 8787
protocol: HTTP + Server-Sent Events for progress
```

Endpoints:

```text
GET  /health
GET  /capabilities
POST /runs
GET  /runs/:id/events
POST /runs/:id/cancel
GET  /artifacts/:ref
POST /providers/test
POST /memory/consolidate
```

Connection rules:

- Browser must show when local runner is connected.
- Runner must advertise capabilities before use.
- Browser sends run packages, not hidden arbitrary commands.
- Runner returns typed events and artifact refs.
- Runner rejects requests outside workspace scope.
- MVP can skip this service and use CLI export/import first.

### 20.17 Built-In Browser Automation Decision

The built-in browser automation layer uses Playwright because this repo already has Playwright test infrastructure.

Purpose:

- Verify the Vibing Finance workbench renders.
- Capture screenshots for debug packages.
- Run local smoke tests.
- Inspect local report pages.
- Later, optionally inspect public documentation pages when the user explicitly requests it.

Commands:

```text
vibing browser smoke --url http://localhost:5173 --out artifacts/vibing-finance/browser-smoke.json
vibing browser screenshot --url http://localhost:5173 --out artifacts/vibing-finance/screenshots/workbench.png
vibing browser inspect --url http://localhost:5173 --selector "[data-testid=vibing-workbench]"
```

Rules:

- Browser automation is disabled in hosted production.
- Default allowed origins are `localhost`, `127.0.0.1`, and explicitly allowed docs/reference URLs.
- It must not be used for scraping private sites or bypassing auth.
- Screenshots are artifacts and may contain sensitive data; redact or exclude from exports by default.
- Browser automation emits typed tool events.

### 20.18 Desktop App Decision

No custom desktop app in MVP.

Rationale:

- Browser workbench plus CLI covers the first useful product.
- Desktop packaging adds update, signing, sandboxing, and support burden.
- If needed later, wrap the browser workbench and local runner in Tauri or Electron only after the browser/CLI protocol is stable.

Desktop later must:

- Reuse the same `core/*` engine.
- Reuse `vibing serve` protocol.
- Store artifacts in the same workspace layout.
- Provide native file access only through the same tool registry and policy guard.

### 20.19 Whole-Engine Microservices Architecture Plan

Final architecture decision:

- Start as a modular local-first engine, not a distributed platform.
- Design microservice boundaries now, but split them only when a contract, test fixture, and operational reason exists.
- Keep numerical truth in shared deterministic core modules.
- Let services orchestrate, store, explain, and verify; do not let them reinterpret fills, trades, metrics, or proof hashes.

Why this is most suitable for a vibe-dev builder:

- A single developer with AI agents can run one local app, one worker, and one CLI without debugging many deployed services.
- Each future service has a clear contract, so an agent can implement or test it without reading the whole system.
- The architecture can grow into local runner, Python workers, and hosted provider gateways without rewriting the browser MVP.
- Failures stay visible as typed events and artifacts instead of disappearing into background jobs.

Service boundary rule:

```text
If a component cannot be tested with fixtures, replayed from artifacts, and explained through events,
it is not ready to become a microservice.
```

### 20.20 Service Map

The word "service" below includes in-process modules, Web Workers, CLI commands, localhost services, and hosted services. Early services can live in one repo and one process; the boundary is the contract, not the deployment unit.

| Service / module | First form | Later form | Owns | Must not own |
|---|---|---|---|---|
| Workbench UI | React hidden page | Same | User workflow, transcript, visual state, artifact inspection | Trading math, secret storage, hidden shell execution |
| Core Engine | `core/*` JS modules | Shared package | Strategy schema, indicators, setup detection, fills, metrics, report facts, proof hashing | React state, provider calls, network, filesystem |
| Backtest Worker | Browser Web Worker | Worker pool | CPU-heavy parsing/backtest execution in browser | UI rendering, secrets, arbitrary terminal commands |
| Local Artifact Store | IndexedDB + export JSON | File workspace + optional encrypted sync | Datasets metadata, run artifacts, reports, proof blocks, memory capsules | Unversioned mutable report truth |
| Agent Control Plane | Browser state + event log | In-process agent kernel | Plans, task DAG, visible tool loop, context packets | Final numerical claims |
| Tool Router | In-process registry | CLI/runner tool registry | Tool permissions, schemas, event emission, budgets | Undeclared side effects |
| Built-in CLI | `scripts/vibing-finance/cli.mjs` | Package binary | Scriptable validation, runs, reports, proof, export/import | Separate metric rules |
| Local Runner Service | Not MVP | `vibing serve` on `127.0.0.1` | Long jobs, filesystem workspace, terminal tools, SSE progress | Hosted public access, unrestricted commands |
| Python Research Worker | Not MVP | Optional CLI engine | Large datasets, vectorized backtests, walk-forward, Monte Carlo | Product state, final report wording without core facts |
| Provider Gateway | Not MVP | Optional BFF service | BYOK routing, redaction, budget checks, provider error normalization | Raw CSV storage, mandatory model calls, deterministic truth |
| Memory Manager | IndexedDB module | Optional local/sync service | Per-user adaptive memory, lessons, preferences, evidence refs | Cross-user training without consent, proof mutation |
| Proof Manager | Core module | Optional local/Git/public anchor service | Canonical hashes, proof blocks, verification | Strategy quality decisions |
| Browser Automation Worker | Not MVP | Playwright through CLI | Smoke tests, screenshots, UI inspection | Trading decisions, private-site automation |
| BFF Config/Auth | Existing app service later | Hosted service | Admin check, feature flags, settings sync | User CSV compute by default |
| Job Orchestrator | Not MVP | Local queue first, hosted queue later | Dependency graph, retry policy, budgets, long-running research jobs | Silent background experiments |
| Observability/Audit | Event log + debug export | Local/hosted log collector | Tool events, run traces, debug packages | Secrets, raw private rows by default |

### 20.21 Canonical Service Contracts

Every service boundary must use versioned JSON contracts.

Request envelope:

```json
{
  "schemaVersion": "vibing.request.v1",
  "requestId": "req_...",
  "idempotencyKey": "idem_...",
  "workspaceId": "workspace_...",
  "actor": {
    "type": "user|agent|system",
    "id": "actor_..."
  },
  "capability": "backtest.run",
  "budget": {
    "maxRuntimeSeconds": 300,
    "maxCostUsd": 0,
    "maxRows": 250000,
    "networkAllowed": false
  },
  "inputRefs": [],
  "options": {}
}
```

Event envelope:

```json
{
  "schemaVersion": "vibing.event.v1",
  "eventId": "evt_...",
  "requestId": "req_...",
  "runId": "run_...",
  "parentEventId": null,
  "type": "tool_started",
  "phase": "parse|validate|plan|execute|report|proof|memory",
  "status": "started|progress|completed|failed|blocked|cancelled",
  "timestamp": "2026-04-25T00:00:00.000Z",
  "message": "short user-visible status",
  "artifactRefs": [],
  "redactionLevel": "none|metadata_only|private"
}
```

Artifact ref:

```json
{
  "schemaVersion": "vibing.artifact_ref.v1",
  "artifactId": "artifact_...",
  "kind": "dataset_profile|strategy_spec|trade_ledger|metrics|report|proof_block|memory_capsule",
  "uri": "indexeddb://... or file://workspace-relative-path",
  "sha256": "sha256:...",
  "createdAt": "2026-04-25T00:00:00.000Z",
  "redactionLevel": "metadata_only"
}
```

Contract rules:

- Every request has `requestId`, `idempotencyKey`, `workspaceId`, `actor`, `budget`, and `capability`.
- Every service emits `started`, `progress`, `completed` or `failed` events.
- Every durable output is an artifact ref with a hash.
- Every service validates schema version before running.
- Every service supports a dry-run or validation path before destructive or expensive work.
- Every service failure returns a typed failure code, user-visible message, and recovery suggestion.
- No service logs raw provider keys.
- No service assumes network access unless the budget explicitly allows it.

### 20.22 Engine Data Flows

Browser MVP flow:

```text
CSV upload
  -> CSV parser
  -> data-quality profile
  -> strategy DSL validator
  -> Web Worker backtest
  -> trade ledger + metrics artifacts
  -> report builder
  -> local proof block
  -> workbench artifact inspector
```

CLI flow:

```text
run-package or CSV + strategy
  -> vibing validate-data
  -> vibing run
  -> vibing report
  -> vibing proof append
  -> export package
```

Local runner flow:

```text
Workbench
  -> localhost pairing check
  -> capabilities manifest
  -> run package request
  -> runner task
  -> SSE event stream
  -> artifact refs
  -> browser import/verify
```

Python research flow:

```text
CLI request
  -> core contract validation
  -> Python engine adapter
  -> parity/mismatch report
  -> artifacts in same package format
  -> proof verification
```

Provider/BYOK flow:

```text
User enables provider profile
  -> redaction policy
  -> provider request packet
  -> provider response
  -> deterministic validator
  -> accepted suggestion or rejected suggestion event
```

No flow is allowed to bypass artifact hashing, typed events, or deterministic validation.

### 20.23 Vibe-Dev-Friendly Repository Shape

Target shape when implementation starts:

```text
src/features/vibing-finance/
  ui/
  core/
  agent/
  storage/
  workers/
  adapters/
  schemas/
  __tests__/
scripts/vibing-finance/
  cli.mjs
  doctor.mjs
  serve.mjs
  fixtures/
artifacts/vibing-finance/
  datasets/
  runs/
  reports/
  proof/
  debug/
```

Folder rules:

- `core/` is pure and test-heavy.
- `ui/` renders state and never owns calculations.
- `workers/` runs CPU-heavy deterministic jobs.
- `adapters/` converts between browser, CLI, runner, Python, and provider surfaces.
- `schemas/` owns shared Zod/JSON-schema contracts.
- `scripts/vibing-finance/` owns local automation only after browser MVP passes.
- `fixtures/` is the builder's safety net; every risky change must run against it.

Every service-like component should have:

- A fixture test.
- A contract schema.
- A `doctor` or health check path.
- A debug export.
- Clear input and output artifact refs.
- A failure code table.
- A local-only development command before any hosted deployment.

### 20.24 Deployment Topologies

| Topology | Components | User value | When allowed |
|---|---|---|---|
| `LOCAL_BROWSER_MVP` | React workbench, Web Worker, IndexedDB, local proof | First useful private backtest | Now |
| `LOCAL_CLI_AUTOMATION` | Shared core, `vibing` CLI, file artifacts | Repeatable runs and CI checks | After M7 |
| `LOCAL_RUNNER_PRO` | Workbench, CLI, `vibing serve`, local filesystem, optional terminal tools | Overnight jobs and unattended scoped work | After CLI contract tests |
| `LOCAL_RESEARCH_LAB` | CLI, Python worker, fixture parity, local queue | Large datasets and advanced validation | After JS engine is trusted |
| `HOSTED_PRIVATE_ALPHA` | Workbench, BFF auth/config, optional provider gateway | Safer private alpha distribution | After privacy/security review |
| `SELF_HOSTED_ENTERPRISE` | App, BFF, runner, artifact storage, policy service | Organization-controlled deployment | Not MVP |

Deployment rules:

- Hosted mode cannot be required for a backtest to complete.
- Hosted mode must not receive raw CSV unless the user explicitly imports/uploads to that hosted mode.
- Local runner is bound to localhost by default.
- Provider gateway is optional and must support BYOK without storing raw keys in logs.
- Enterprise/self-hosted comes after the local contracts are stable.

### 20.25 Microservice Split Criteria

A component may be split into a true service only after all criteria pass:

| Criterion | Required evidence |
|---|---|
| Stable contract | JSON schema exists and has contract tests |
| Fixture replay | Inputs can be replayed without UI state |
| Artifact lineage | Outputs are hashed and referenced by `run-package.v1` |
| Operational need | Split solves scale, isolation, security, or deployment pain |
| Local command | Service runs locally with one documented command |
| Health check | `/health`, `doctor`, or equivalent exists |
| Failure behavior | Typed errors and recovery messages exist |
| Budget control | Runtime, cost, disk, network, and retry limits exist where relevant |
| Security review | Secrets, paths, origins, and redaction rules are documented |
| Rollback path | Old in-process path remains available or migration is reversible |

Anti-split rules:

- Do not split because it sounds scalable.
- Do not split before the browser worker and CLI agree on fixtures.
- Do not split a service whose output cannot be hashed.
- Do not split provider calls into the required path.
- Do not split memory/training into cross-user infrastructure before explicit consent and governance exist.

### 20.26 Microservice Implementation Sequence

Use this exact sequence if the architecture grows beyond the browser MVP:

1. Extract `core/*` so browser worker imports pure deterministic modules.
2. Add schema contracts under `schemas/*` and test them with fixtures.
3. Add `artifactSchemas.js`, `eventSchemas.js`, and `runPackage.js`.
4. Add CLI commands that call the same core modules.
5. Add file workspace locking for CLI artifacts.
6. Add `vibing doctor` and `vibing proof verify`.
7. Add `vibing serve` as a localhost wrapper over CLI/core.
8. Add local runner pairing, capability manifest, SSE events, and cancellation.
9. Add Python engine adapter behind CLI only after parity tests exist.
10. Add provider gateway/BYOK only after redaction, budget, and fallback tests exist.
11. Add local queue for unattended watch mode only after runner budgets and stop rules exist.
12. Add hosted services only after local proof, privacy, and support gates pass.

The implementation sequence must never invert deterministic proof and AI assistance. Backtest correctness comes first; agent autonomy comes after.

### 20.27 Service Capability Manifest

Every CLI, runner, or hosted service exposes capabilities before the workbench uses it.

Example:

```json
{
  "schemaVersion": "vibing.capabilities.v1",
  "serviceId": "local-runner",
  "serviceVersion": "0.1.0",
  "workspaceRoot": ".",
  "capabilities": [
    "data.validate",
    "backtest.run",
    "report.build",
    "proof.verify"
  ],
  "limits": {
    "maxRows": 1000000,
    "maxRuntimeSeconds": 3600,
    "networkDefault": false,
    "shellDefault": false
  },
  "providers": [],
  "security": {
    "localhostOnly": true,
    "pairingRequired": true,
    "secretsRedacted": true
  }
}
```

Capability rules:

- The workbench may only call advertised capabilities.
- Capabilities can be narrower than the service implementation.
- Missing capability means disabled UI, not hidden fallback.
- Capability changes are logged as events.
- Dangerous capabilities require explicit budgets and visible scope.

### 20.28 Robustness Requirements For The Whole Engine

The whole engine is robust only if these guarantees hold:

| Area | Guarantee |
|---|---|
| Correctness | Golden fixtures catch wrong setup detection, fills, metrics, and proof hashes |
| Reproducibility | Same run package produces same artifacts across browser/CLI/Python within documented tolerance |
| Privacy | Raw CSV stays local unless the user explicitly exports/uploads it |
| Autonomy | Background work has budgets, stop reasons, and resumable checkpoints |
| Observability | Every important action emits an event and can be included in a debug package |
| Security | Shell, browser automation, provider calls, and filesystem access are scoped by capability and workspace |
| Recovery | Tab close, worker crash, quota error, runner disconnect, and hash mismatch have recovery paths |
| Extensibility | New providers, engines, reports, and storage backends are adapters, not forks |
| Vibe-dev usability | A builder can run doctor, fixtures, one command, and inspect artifacts without external infrastructure |

If any guarantee fails, the feature must stay private and hidden.

---

## 21. Data Pipeline Architecture

### 21.1 Local Data Flow

```text
CSV Upload
  -> byte hash
  -> schema validation
  -> timestamp normalization
  -> duplicate/missing-bar checks
  -> session tagging
  -> IB high/low computation
  -> session VWAP computation
  -> setup detection
  -> execution simulation
  -> metrics
  -> report
  -> proof block
```

### 21.2 Data Validation Checks

Required checks:

- Required columns exist.
- OHLC values are numeric.
- `high >= max(open, close)`.
- `low <= min(open, close)`.
- `volume >= 0`.
- Timestamps parse.
- Timestamps are unique.
- Timestamps are monotonic after sorting.
- Timezone is known or inferred.
- Expected bar interval is inferred.
- Missing bars are counted by session.
- Sessions with too many gaps are excluded.
- Rows outside configured session are either ignored or marked out-of-session.

Quality score:

```text
quality_score =
  1.00
  - missing_bar_penalty
  - duplicate_penalty
  - invalid_ohlc_penalty
  - timezone_inference_penalty
  - no_volume_penalty
```

Minimum run threshold:

- `quality_score >= 0.85` for a normal report.
- `0.70 <= quality_score < 0.85` allowed but report must be marked low confidence.
- `< 0.70` blocked unless admin explicitly chooses research-only mode later.

### 21.3 Data Layers

Even in browser, keep data layered:

| Layer | Meaning | Persist? |
|---|---|---|
| Raw | Original CSV bytes/hash/filename | Optional, admin choice |
| Parsed | Normalized rows | Yes, IndexedDB |
| Validated | Rows plus quality flags | Yes |
| Feature-ready | Session, IB, VWAP, swing labels | Yes |
| Results | Trades, equity curve, metrics | Yes |
| Proof | Hashes and signatures | Yes |

---

## 22. Strategy DSL

The natural-language interface should produce a versioned deterministic object.

MVP strategy spec:

```json
{
  "schema_version": "vibing.strategy.v1",
  "strategy_id": "post_ib_vwap_inventory_v1",
  "assets": ["MNQ", "NIFTY"],
  "timeframe": "5m",
  "session": {
    "type": "rth",
    "timezone_by_asset": {
      "MNQ": "America/New_York",
      "NIFTY": "Asia/Kolkata"
    },
    "open_by_asset": {
      "MNQ": "09:30",
      "NIFTY": "09:15"
    },
    "initial_balance_minutes": 60
  },
  "features": {
    "vwap": {
      "reset": "session",
      "price": "typical_price"
    },
    "inventory": {
      "trap_threshold_points": 1,
      "reclaim_window_candles": 2
    },
    "structure_change": {
      "lookback_candles": 3,
      "requires_vwap_confirmation": true
    },
    "pullback": {
      "impulse_retrace_min": 0.33,
      "impulse_retrace_max": 0.66,
      "vwap_touch_or_zone": true
    }
  },
  "risk": {
    "account_risk_fraction": 0.002,
    "stop_points": 12,
    "tp1_points": 15,
    "tp2_points": 45,
    "tp1_exit_fraction": 0.5,
    "move_stop_to_breakeven_after_tp1": true
  },
  "filters": {
    "no_entry_before_ib_complete": true,
    "max_one_trade_per_side_per_session": true,
    "no_entry_final_session_minutes": 30,
    "max_entry_distance_from_vwap_r": 2
  }
}
```

The parser may accept beginner wording, but it must always show the normalized JSON-like spec before running the test.

---

## 23. Backtest Engine Details

### 23.1 Event Loop

For each session:

1. Load validated bars.
2. Compute IB high and low from the first 60 minutes.
3. Compute session VWAP incrementally.
4. After IB closes, scan for caught seller or caught buyer events.
5. After caught inventory appears, wait for structure change.
6. After structure change, wait for pullback.
7. After pullback, wait for entry trigger.
8. Size position using 0.2% account risk.
9. Simulate entry, stop, TP1, TP2.
10. Apply breakeven rule after TP1.
11. Record trade, MFE, MAE, R multiple, and reason codes.
12. Stop scanning that side after a full stop-loss.

### 23.2 Conservative Intrabar Fill Policy

Because 5-minute candles do not reveal the true order of high/low inside the candle:

- If entry and stop are both touched in the same candle, assume stop happened first.
- If TP1 and stop are both touched before breakeven can be confirmed, assume worst case.
- If TP1 and TP2 are both touched in the same candle after entry, allow TP1 then TP2 only if candle direction supports it; otherwise allow TP1 only.
- If breakeven and TP2 are both touched after TP1, use candle direction to decide; if ambiguous, assume breakeven.
- The report must label this as "conservative OHLC simulation".

### 23.3 Trade Record

```json
{
  "trade_id": "uuid",
  "asset": "MNQ",
  "session_date": "2026-04-24",
  "side": "long",
  "entry_time": "...",
  "entry_price": 18125.25,
  "initial_stop": 18113.25,
  "tp1": 18140.25,
  "tp2": 18170.25,
  "position_size": 4,
  "risk_dollars": 100,
  "result": "tp2",
  "net_pnl": 230,
  "r_multiple": 2.3,
  "setup_reason": "caught_sellers_bullish_choch_pullback",
  "quality_flags": []
}
```

### 23.4 Metrics

Mandatory:

- Total trades.
- Win rate.
- Average R.
- Expectancy in R.
- Net PnL.
- Max drawdown.
- Profit factor.
- Sharpe-like bar/session metric where appropriate.
- Best trade.
- Worst trade.
- Average hold time.
- TP1 hit rate.
- TP2 hit rate.
- Breakeven-after-TP1 frequency.
- Session/day distribution.
- Long vs short breakdown.
- NIFTY vs MNQ breakdown.
- Data quality score.

Reject logic:

- Fewer than 30 trades: insufficient sample.
- Profit factor below 1.2: weak.
- Max drawdown too high relative to expected return: weak/reject.
- Edge only from one outlier day: weak.
- High sensitivity to 1-point trap threshold: weak.
- Good gross but bad net after costs: reject or revise.

### 23.5 Metric Formula Appendix v1

Rounding rule:

- Store raw metric values at full JavaScript/Python double precision.
- Display percentages to 2 decimals.
- Display R multiples to 2 decimals.
- Display currency to 2 decimals unless instrument tick/point precision requires otherwise.

Trade-level formulas:

```text
initial_risk_points = abs(entry_price - initial_stop)
initial_risk_currency = initial_risk_points * point_value * position_size
gross_pnl = sum(exit_qty_i * (exit_price_i - entry_price) * side_sign * point_value)
fees = per_side_fee * (entry_qty + sum(exit_qty_i))
slippage = configured_slippage_points * point_value * (entry_qty + sum(exit_qty_i))
net_pnl = gross_pnl - fees - slippage
r_multiple = net_pnl / initial_risk_currency
mfe_points = max_favorable_price_move_from_entry
mae_points = max_adverse_price_move_from_entry
```

Portfolio/run formulas:

```text
total_trades = count(trades)
winning_trades = count(net_pnl > 0)
losing_trades = count(net_pnl < 0)
breakeven_trades = count(net_pnl == 0)
win_rate = winning_trades / total_trades
average_r = mean(r_multiple)
expectancy_r = mean(r_multiple)
gross_profit = sum(net_pnl where net_pnl > 0)
gross_loss_abs = abs(sum(net_pnl where net_pnl < 0))
profit_factor = gross_profit / gross_loss_abs
net_pnl_total = sum(net_pnl)
equity_t = starting_equity + cumulative_net_pnl_t
drawdown_t = equity_t - max(equity_0..equity_t)
drawdown_pct_t = drawdown_t / max(equity_0..equity_t)
max_drawdown = min(drawdown_t)
max_drawdown_pct = min(drawdown_pct_t)
tp1_hit_rate = count(trades where tp1_filled) / total_trades
tp2_hit_rate = count(trades where tp2_filled) / total_trades
breakeven_after_tp1_rate = count(trades where exit_reason == "breakeven_after_tp1") / count(trades where tp1_filled)
average_hold_minutes = mean(exit_time - entry_time)
```

Edge-case formulas:

- If `total_trades == 0`, all performance ratios are `null`, not `0`.
- If `gross_loss_abs == 0` and `gross_profit > 0`, profit factor is `"infinite_sample_warning"`, not trusted.
- If `gross_loss_abs == 0` and `gross_profit == 0`, profit factor is `null`.
- If point value is unknown, currency PnL is `null` and R metrics still display.
- If volume is missing, VWAP fallback is lower confidence and report must flag it.

Sharpe-like metric:

```text
session_return_t = net_pnl_session_t / starting_equity_at_session_start
sharpe_like = mean(session_return) / stddev(session_return)
```

Do not annualize Sharpe in MVP unless the session count, calendar, and sampling assumptions are explicit.

Formula test vectors:

| Test ID | Inputs | Expected |
|---|---|---|
| `MF-001` | 4 trades R: `2, -1, 0.5, -0.5` | `win_rate=0.5`, `expectancy_r=0.25`, `profit_factor=2.5` |
| `MF-002` | Starting equity `10000`, PnL `100,-50,200,-25` | `net_pnl_total=225`, max closed-trade drawdown after second trade `-50` |
| `MF-003` | No trades | Ratios `null`, verdict cannot be positive |
| `MF-004` | All winners | Profit factor warning, not deployable evidence |

---

## 24. Report Architecture

Report sections:

1. Executive verdict.
2. Strategy spec summary.
3. Dataset quality.
4. Session definitions.
5. Setup examples.
6. Trade metrics.
7. Risk metrics.
8. Equity curve.
9. Drawdown path.
10. Long/short breakdown.
11. Asset breakdown.
12. Sensitivity tests.
13. Conservative-fill caveats.
14. What would break live.
15. Next research actions.
16. Proof block.

Verdict labels:

```text
REJECT
WEAK
RESEARCH-WORTHY
PAPER-TRADE
DEPLOY-CANDIDATE
```

The MVP should be biased toward rejecting weak evidence.

### 24.1 Verdict Rules And Claim Guardrails v1

MVP verdict labels:

| Verdict | Meaning | Minimum conditions |
|---|---|---|
| `REJECT` | Evidence is bad, invalid, too costly, or unsafe to trust | Data block, negative expectancy, severe caveat, or failed proof |
| `REVISE` | Idea may be testable but current rules/data are weak | Some evidence, but fails sample, robustness, cost, or drawdown checks |
| `RESEARCH-WORTHY` | Worth further research only | At least 30 trades, positive expectancy, PF >= 1.2, no fatal data-quality issue |
| `PAPER-TRADE-CANDIDATE` | Post-MVP label only | At least 100 trades, out-of-sample/walk-forward evidence, costs included, robustness acceptable |
| `DEPLOY-CANDIDATE` | Not allowed in MVP | Requires separate live/paper evidence, legal review, risk controls, and human approval |

MVP cannot output:

- `DEPLOY-CANDIDATE`.
- "Guaranteed".
- "Proven alpha".
- "Safe to trade".
- "Will be profitable".
- "Financial advice".
- "You should trade this".

Required caveat templates:

| Condition | Required report wording |
|---|---|
| Fewer than 30 trades | "Insufficient sample: this result is not enough to infer edge." |
| 30-99 trades | "Research sample only: this needs more data and out-of-sample testing." |
| Missing volume | "VWAP used a lower-confidence fallback because volume was missing." |
| Conservative OHLC ambiguity | "5-minute OHLC bars do not reveal true intrabar order; ambiguous fills were resolved conservatively." |
| Low data quality | "Data quality issues may dominate the result; treat this as research-only." |
| No news calendar | "News filtering was not applied because event timestamps were not supplied." |
| No costs supplied | "Default cost assumptions were used; broker-specific costs may change the verdict." |
| One outlier dominates | "A large part of the result comes from a small number of trades; robustness is weak." |

Positive-language gate:

- `RESEARCH-WORTHY` may say "shows preliminary evidence worth further testing."
- `REVISE` may say "the idea is not yet supported in its current form."
- `REJECT` must say "do not trust this strategy from this test."
- No MVP report may say "ready for live trading."

Required compliance text:

```text
This report is for research and education only. It is not financial advice, investment advice, or a recommendation to trade. Historical backtests are hypothetical and can be wrong because of data quality, execution assumptions, fees, slippage, liquidity, and changing market regimes. Do not trade live from this report alone.
```

Required hypothetical-performance text:

```text
All performance shown here is simulated from the uploaded data and selected assumptions. Simulated results do not guarantee future results and may differ materially from live execution.
```

Required low-evidence text:

```text
The evidence is too weak for confidence. Treat this as a research artifact, not a trading decision.
```

Report schema v1:

```json
{
  "schema_version": "vibing.report.v1",
  "report_id": "uuid",
  "run_id": "uuid",
  "verdict": "REJECT|REVISE|RESEARCH-WORTHY|PAPER-TRADE-CANDIDATE",
  "verdict_reasons": [],
  "required_caveats": [],
  "strategy_summary": {},
  "dataset_quality": {},
  "execution_assumptions": {},
  "metrics": {},
  "trade_summary": {},
  "risk_notes": [],
  "next_experiments": [],
  "proof_refs": []
}
```

---

## 25. Blockchain / Proof Architecture

### 25.1 Decision

For strict free-for-lifetime operation, the MVP blockchain is a private local hash-chain ledger called **Vibing Proof Chain**.

This is not a public cryptocurrency network. It is a tamper-evident chain of hashes stored with the reports. It costs nothing, has no gas, exposes no private strategy data, and works offline forever.

Public-chain anchoring is optional later. It must not block the product.

### 25.2 Why Not A Paid Public Chain First

Public chains are bad for the MVP because:

- Most require gas.
- Fees can change.
- Free testnets are not production evidence.
- Raw strategy data must not be public.
- Even cheap chains create wallet/key/ops complexity.
- Backtests do not need global consensus to run.
- Hosted RPC providers have free-tier limits.

### 25.3 Chain Choice Matrix

| Option | Cost | Pros | Problems | Decision |
|---|---:|---|---|---|
| Local hash-chain | $0 | Offline, private, deterministic, no gas | Not decentralized | Use for MVP |
| Git commit proof | $0 if using existing GitHub | Public timestamp-ish, easy export | Not blockchain, depends on GitHub | Optional |
| Nano | Feeless transfers per Nano docs | Public, fast, no transaction fees | Poor fit for arbitrary report-data anchoring | Optional research only |
| IOTA | Historically promoted feeless DLT | Data/provenance fit is conceptually better | Current/rebased fee/storage model is not simple "free forever" | Do not use for MVP |
| Polygon/Solana/Base/Arbitrum | Low fees | Mature tooling | Not free; RPC/wallet costs possible | No |
| Ethereum mainnet | High trust | Strong ecosystem | Not free | No |
| Private EVM chain | No gas if local | Familiar tooling | Running validators is ops cost | No for MVP |

### 25.4 Vibing Proof Chain Block

Each important event appends one block:

```json
{
  "chain": "vibing-proof-chain",
  "version": 1,
  "height": 42,
  "previous_hash": "sha256:...",
  "event_type": "BACKTEST_REPORT_CREATED",
  "created_at": "2026-04-25T12:00:00Z",
  "payload_hash": "sha256:...",
  "payload_kind": "report",
  "dataset_hash": "sha256:...",
  "strategy_hash": "sha256:...",
  "engine_version": "vibing-backtest-js-0.1",
  "code_version": "git:...",
  "block_hash": "sha256:...",
  "signature": "ecdsa-p256:..."
}
```

Hash rule:

```text
block_hash = SHA256(canonical_json_without_signature_and_block_hash)
```

Signature rule:

```text
signature = admin_private_key.sign(block_hash)
```

Key storage:

- Generate a browser signing key with WebCrypto.
- Store private key in IndexedDB as non-extractable where supported.
- Export public key with reports.
- If non-extractable storage is not reliable in a browser, allow admin to export/import a key file manually.

### 25.5 Merkle Report Root

Each report gets a Merkle root:

```text
root = merkle(
  dataset_hash,
  strategy_hash,
  trade_ledger_hash,
  equity_curve_hash,
  metrics_hash,
  report_text_hash,
  engine_version_hash
)
```

The report can be verified later without revealing raw data if only hashes are shared.

### 25.6 Optional Public Anchor Later

If public proof becomes necessary:

1. Keep private data local.
2. Publish only the Merkle root.
3. Prefer a free non-chain proof first: signed Git commit, GitHub release artifact, or public gist.
4. If a true public feeless network is still required, evaluate Nano only as an experimental anchor, because Nano documentation describes feeless transactions, but it is not designed as a general-purpose data ledger.
5. Never make public anchoring required for the core backtest.

### 25.7 Canonical Hash And Serialization Rules v1

All proof hashes must be reproducible across browser, Node CLI, and Python.

Canonical JSON rules:

- Encoding: UTF-8.
- Object keys sorted lexicographically by Unicode code point.
- No insignificant whitespace.
- Arrays preserve order.
- Numbers use the shortest round-trip decimal representation available from the runtime; do not hash displayed rounded strings.
- Timestamps normalized to ISO 8601 UTC with `Z`.
- `undefined`, functions, symbols, and `NaN` are forbidden.
- `Infinity` and `-Infinity` are forbidden; use explicit string sentinel values such as `"infinite_sample_warning"` only where schema permits.
- Binary artifacts hash raw bytes directly, not base64 strings.
- Text artifacts normalize line endings to `\n` before hashing.

Hash format:

```text
sha256:<lowercase_hex_digest>
```

Canonical artifact hash inputs:

| Artifact | Hash input |
|---|---|
| Raw CSV | Original file bytes |
| Normalized dataset | Canonical JSON rows plus dataset metadata excluding local file path |
| Strategy spec | Canonical JSON strategy spec |
| Trade ledger | Canonical JSON trade records in execution order |
| Metrics | Canonical JSON metrics object |
| Report JSON | Canonical JSON report schema |
| Report Markdown | UTF-8 text with `\n` line endings |
| Proof block | Canonical JSON excluding `signature` and `block_hash` |

Canonicalization test vectors:

| ID | Input | Expected behavior |
|---|---|---|
| `HASH-001` | `{ "b": 2, "a": 1 }` and `{ "a": 1, "b": 2 }` | Same hash |
| `HASH-002` | Report text with CRLF vs LF | Same hash after line-ending normalization |
| `HASH-003` | Timestamp `2026-04-25T12:00:00+05:30` | Hashes normalized UTC timestamp `2026-04-25T06:30:00Z` |
| `HASH-004` | Metrics with displayed rounded `1.23` but raw `1.23456` | Hash raw canonical metric value, not display text |

### 25.8 Run Package Manifest v1

`run-package.v1.json` is the interchange format between browser, CLI, local runner, debug export, and future Python parity.

```json
{
  "schema_version": "vibing.run_package.v1",
  "package_id": "uuid",
  "created_at": "2026-04-25T00:00:00Z",
  "created_by_surface": "browser|cli|runner|python",
  "redaction_level": "metadata_only|safe_debug|full_private",
  "workspace_id": "local",
  "run_id": "uuid",
  "engine": {
    "name": "vibing-backtest-js",
    "version": "0.1.0",
    "code_version": "git:..."
  },
  "artifacts": [
    {
      "ref": "artifact:metrics:sha256:...",
      "kind": "metrics",
      "path": "runs/run_001/metrics.json",
      "hash": "sha256:...",
      "bytes": 1234,
      "contains_private_data": false
    }
  ],
  "proof_blocks": ["sha256:..."],
  "event_log": "runs/run_001/events.ndjson",
  "excluded": [
    "raw_csv_rows",
    "api_keys",
    "provider_prompts"
  ]
}
```

Manifest rules:

- `metadata_only` excludes raw rows, full transcript, screenshots, and provider prompts.
- `safe_debug` may include sanitized tool outputs and screenshots only after explicit user selection.
- `full_private` may include raw local artifacts and must never be shared publicly by default.
- Import must verify every listed hash before trusting the package.
- Missing optional artifacts produce warnings; missing required report/proof artifacts block import.

---

## 26. Security Architecture

### 26.1 Admin Access

The page must require:

- Feature flag enabled.
- Authenticated user.
- Admin role.
- Optional admin email/UID allowlist.

Failure mode:

- If not admin, route should not appear.
- If opened directly, show not found or redirect.
- Do not reveal feature name to normal users.

### 26.2 Upload Security

CSV upload risks:

- Huge files causing browser freeze.
- Malformed CSV parser edge cases.
- Formula injection in exported CSV.
- Timestamp poison.
- Memory exhaustion.

Controls:

- File size warning and hard cap for browser mode.
- Stream/chunk parse where possible.
- Escape values on export that start with `=`, `+`, `-`, or `@`.
- Reject invalid timestamps.
- Worker isolation for parsing/backtesting.
- No upload to server in MVP.

### 26.3 Privacy

Private by default:

- Uploaded CSV stays local.
- Strategy prompt stays local.
- Report stays local.
- Proof chain stays local.
- No analytics event includes strategy text or market data.
- No prompt is sent to an external LLM unless a later explicit setting enables it.

### 26.4 Secrets

MVP should need no secrets.

Forbidden in MVP:

- Market-data API keys.
- LLM API keys.
- Blockchain private keys stored on server.
- Admin strategy data in logs.

### 26.5 Abuse Controls

Even admin-only tools need safety:

- Backtest cancellation button.
- Worker timeout.
- Memory threshold warning.
- Max rows for browser mode.
- Local artifact delete button.
- Proof chain export before deletion if needed.

---

## 27. AI / Analyst Architecture

The user wants the feel of talking to a seasoned research team and expects Codex, Claude, GPT, or Opus Code to be available as an operator layer. For free-for-lifetime runtime constraints, split this into layers:

### 27.1 Free Deterministic Analyst

Always available:

- Strategy parser.
- Clarifying-question generator.
- Backtest integrity checklist.
- Risk report template.
- Rejection logic.
- Explanation generator from metrics.
- Next-experiment suggester.

This can feel intelligent without a paid LLM because the strategy family is narrow and rules are explicit.

### 27.2 Agent-Assisted Operator Layer

Assumption:

- Codex, Claude, GPT, or Opus Code will usually be available to the founder while building and operating this feature.

Role of the coding/research agent:

- Convert founder notes into updates to this canonical spec.
- Implement and refactor code.
- Inspect failed backtests.
- Generate test cases.
- Audit lookahead bias, fill assumptions, and data-quality issues.
- Explain reports in plain English.
- Suggest next experiments.
- Compare browser results against the Python runner.
- Help create new strategy templates after the MVP is stable.

Hard boundary:

- The agent is not the source of numerical truth.
- The deterministic backtest engine is the source of numerical truth.
- The strategy DSL is the source of executable strategy truth.
- The proof chain is the source of reproducibility truth.
- Any agent-written strategy change must become a versioned strategy spec before it is backtested.
- Any agent interpretation must cite the report metrics it is based on.

Agent workflow:

```text
Founder idea
  -> Codex/Claude helps refine spec
  -> deterministic strategy JSON is produced
  -> browser/Python engine runs backtest
  -> report and proof block are generated
  -> Codex/Claude critiques the result and proposes next test
```

This gives the product the "senior research desk" feeling while keeping the engine auditable and reproducible.

### 27.3 Optional Local LLM

Optional later:

- Ollama local model.
- Browser WebLLM model if bundle size and hardware allow it.
- User-provided local endpoint.

Rules:

- Local LLM can explain and summarize.
- Local LLM cannot silently change strategy logic.
- Deterministic strategy spec remains source of truth.
- Report metrics must come from engine, not model text.

### 27.4 Bring-Your-Own LLM Key Policy

The product must support a user-controlled LLM path before any platform-funded paid LLM dependency becomes mandatory.

Required provider modes:

| Mode | Description | Default |
|---|---|---|
| No LLM | Deterministic analyst only | Yes for MVP |
| Local LLM | Ollama, WebLLM, or user local endpoint | Optional |
| BYOK remote LLM | User provides their own OpenAI/Anthropic/Gemini/OpenRouter-compatible key | Optional |
| Platform-funded LLM | TradersApp pays for the model call | Off unless explicitly enabled later |

BYOK requirements:

- Every user can add, test, disable, rotate, and delete their own LLM provider key.
- The app must clearly show which provider is active before any remote model call.
- User keys must be encrypted at rest if stored, or held only in local/session storage when the user chooses local-only mode.
- User keys must never be logged, exported, placed in reports, sent to proof blocks, or included in agent context.
- Remote LLM use must be opt-in per workspace/account.
- BYOK calls must support cost caps, token caps, timeout caps, and provider-level disable switches.
- If no user key is configured, the app must still run deterministic backtests and reports.
- Platform-funded keys must never be silently substituted when the user selected BYOK-only mode.

### 27.5 Embedded Paid LLM Policy

Embedded paid APIs are not part of the free MVP.

If added later:

- Must be optional.
- Must support user-provided key.
- Must prefer BYOK or local LLM modes for users who do not want TradersApp-funded inference.
- Must redact private data where possible.
- Must show cost-risk warning.
- Must never be required for backtest execution.
- Must never replace deterministic metrics.

---

## 28. Clean-Room Agent System Lessons

This section captures high-level architectural lessons from public/user-provided descriptions of modern coding-agent systems. It must remain clean-room.

Source boundary:

- Do not download, inspect, mirror, or run leaked proprietary repositories.
- Do not copy private source code, private prompts, private tool schemas, or private implementation details.
- Treat online leak summaries as unverified product folklore unless backed by official docs or clean-room observation.
- Use only the broad system ideas that are common in agent architecture and implement original TradersApp code.
- Public MIT-licensed projects can be studied for design patterns, but TradersApp should still write original code unless a deliberate dependency decision is made.
- Repositories that describe themselves as leaked proprietary source must not be cloned, executed, imported, or used as implementation references. Only public README-level product-pattern observations may be captured as cautionary clean-room notes.

### 28.1 Core Lesson

The engine should not be "one chatbot response." It should be a structured agent workspace around deterministic tools.

For Vibing Finance, that means:

```text
User / Founder
  -> Planner
  -> Context Manager
  -> Tool Router
  -> Terminal / Shell Executor
  -> Backtest Executor
  -> Risk Analyst
  -> Report Writer
  -> Proof Manager
  -> Memory Manager
  -> Agent Export
```

The LLM/agent helps decide, explain, and iterate. The tools produce the facts.

### 28.2 Agent Roles

Planner:

- Converts the user request into a run plan.
- Selects dataset, strategy spec, and validation steps.
- Updates the visible checklist.
- Does not compute metrics.

Context Manager:

- Chooses what context the agent sees.
- Summarizes old runs into compact memory capsules.
- Keeps raw CSV private unless explicitly exported.
- Prevents context bloat.

Tool Router:

- Calls deterministic local tools.
- Validates tool inputs.
- Captures tool outputs as structured events.
- Emits transcript tool-call rows.
- Routes powerful tools through typed adapters, including browser worker, Python runner, PowerShell, Bash, terminal commands, filesystem reads/writes, MCP tools, and local services.
- Enforces task scope: tools may be used only when they directly or indirectly advance the user's research/backtesting agenda, setup, verification, reporting, or recovery from failures.

Task Queue:

- Stores the run plan as a directed acyclic graph of tasks.
- Runs independent tasks in parallel when their inputs do not conflict.
- Unblocks dependent tasks only after required artifacts exist.
- Cascades failure only to tasks that truly depend on the failed task.
- Supports explicit task assignment to planner, data, backtest, risk, report, proof, memory, or reviewer agents.

Message Bus:

- Carries typed messages between coordinator, role agents, tools, memory, and UI.
- Keeps all messages scoped to the active workspace/run.
- Persists important messages as transcript/tool events.
- Avoids direct hidden mutation between agents.

Shared Memory:

- Provides a namespaced key-value store for agent findings.
- Separates scratch notes, run facts, user preferences, validated lessons, and proof refs.
- Can start in-process/IndexedDB and later use durable local or hosted stores.
- Must not be treated as numerical truth unless backed by artifacts and proof refs.

Agent Runner:

- Owns the model -> tool -> model turn cycle for any LLM-backed agent.
- Enforces max turns, timeout, token budget, tool budget, and loop detection.
- Compresses or summarizes large consumed tool outputs to protect context budget.
- Preserves error outputs and failed tool events for audit.

Terminal / Shell Executor:

- Provides Claude Code-style local command authority for PowerShell, Bash, package scripts, Python, Node, git inspection, test runners, local services, and artifact generation.
- Runs commands as typed, logged tool events with command text, working directory, start/end time, exit code, stdout/stderr summary, and artifact hashes where relevant.
- Can run unattended after the user starts a task, including long backtests, batch experiments, report generation, comparison jobs, and verification loops.
- Must expose cancel, pause, resume, and emergency-stop controls.
- Must not run unrelated commands outside the active agenda.
- Must not access secrets, exfiltrate data, delete projects, wipe drives, modify unrelated repos, or perform irreversible infrastructure changes without a stronger approval gate.

Backtest Executor:

- Runs CSV validation, IB/VWAP, setup detection, simulation, and metrics.
- Runs in browser worker or local Python runner.
- Is deterministic and test-covered.

Risk Analyst:

- Reads the trade ledger and metrics.
- Applies rejection rules.
- Produces caveats, stress notes, and next experiments.

Report Writer:

- Turns structured facts into readable report sections.
- Must cite metrics and reason codes.
- Must not invent performance.

Proof Manager:

- Hashes dataset metadata, strategy spec, trade ledger, metrics, and report.
- Appends local proof block.
- Exports verification data.

Memory Manager:

- Stores useful summaries, not raw unbounded transcripts.
- Tracks strategy versions and lessons learned.
- Promotes only validated lessons into reusable defaults.
- Keeps per-user memory separate by default.
- Treats shared/global promotion as a gated process, not an automatic side effect of usage.

### 28.3 Continuous Work Loop

The product can feel autonomous by running a local job loop:

```text
plan
  -> run tool
  -> inspect output
  -> update plan
  -> run next tool
  -> build report
  -> generate proof
  -> propose next experiment
```

Rules:

- The loop must be visible in the UI.
- The user can stop it.
- Every action has a transcript event.
- Failed steps retry only if retry is safe.
- A retry must preserve the original failure for audit.
- Completed reports are immutable; improvements create a new report version and proof block.
- The loop may continue while the user is away from the screen after the user explicitly starts an autonomous run.
- If the local machine sleeps or loses power, the run must persist enough state to resume or mark the run as interrupted on restart.
- For true overnight execution, support a user-controlled desktop runner, local service, or VPS runner rather than depending on an active browser tab.

### 28.3.1 Autonomous Operating Modes

The agent workspace should support clear operating modes:

| Mode | Behavior | Use case |
|---|---|---|
| Manual | User approves each major step | Sensitive setup or debugging |
| Assisted | Agent proposes, user approves run batches | Early trust-building |
| Autonomous run | Agent executes the current task plan until done, blocked, cancelled, or risk stop | Long backtests and report generation |
| Background lab | Agent keeps refining queued experiments under fixed budgets and scope | Overnight research |

Autonomous run requirements:

- Requires an explicit user start for the agenda, budget, dataset scope, and allowed tool scope.
- Does not require the user to remain at the screen once started.
- Can use PowerShell, terminals, local runners, MCP tools, and filesystem operations that are in scope.
- Emits heartbeat events so the UI can show that work is still active.
- Stops on configured limits: max runtime, max cost, max experiments, max disk use, repeated failures, or policy violation.
- Writes an end-of-run summary with completed steps, failures, artifacts, report versions, proof hashes, and recommended next agenda.

### 28.4 Background Refinement

The app may support "background refinement" later, but it must not silently alter finalized evidence.

Allowed:

- Recompute a report with a newer engine version and mark it as a new run.
- Suggest better filters.
- Detect a data-quality problem after a report.
- Generate a follow-up experiment plan.
- Compare two runs and summarize differences.

Not allowed:

- Mutate an old report without a new proof block.
- Change trade results silently.
- Promote a strategy verdict without rerunning deterministic tools.
- Hide failed runs.

### 28.5 Memory Architecture

Memory layers:

| Layer | Stores | Purpose |
|---|---|---|
| Session transcript | User messages, tool events, summaries | Current work context |
| Run memory | Dataset hash, strategy hash, metrics, verdict | Compare runs |
| Strategy memory | Versioned strategy specs and changes | Research evolution |
| Lesson memory | Validated findings only | Improve defaults |
| Proof memory | Hash chain blocks | Reproducibility |
| User preference memory | Provider choice, risk preferences, formatting preferences, accepted/rejected suggestions | Personalization |
| Tool skill memory | Successful command patterns, environment fixes, runner settings | Faster future runs |

Memory capsule example:

```json
{
  "memory_type": "strategy_lesson",
  "created_at": "...",
  "strategy_id": "post_ib_vwap_inventory_v1",
  "dataset_scope": "MNQ 5m 2024 RTH",
  "finding": "Caught-seller long setups improved when entry distance from VWAP was <= 1.5R.",
  "evidence": {
    "runs": ["run_001", "run_007"],
    "min_trades": 40,
    "metric_delta": {
      "profit_factor": "+0.22",
      "max_drawdown": "-8.5%"
    }
  },
  "status": "candidate_not_default"
}
```

Promotion rule:

- A lesson can become a default only after multiple runs and explicit admin approval.
- By default, lessons remain attached to the originating user/workspace.
- User-specific lessons may improve that user's suggestions immediately, but they must be labeled as personal/candidate guidance until validated.
- Cross-user defaults require aggregation, privacy review, bias/leakage review, rollback support, and explicit promotion.

### 28.5.1 Per-User Self-Learning Mechanism

The engine should improve for every user over time without corrupting deterministic truth.

Learning signals:

- Accepted and rejected strategy edits.
- User-selected LLM provider and mode.
- Preferred report style and risk thresholds.
- Failed commands and successful repairs.
- Data-quality issues found in the user's datasets.
- Backtest outcomes tied to versioned strategy specs.
- User feedback on whether a suggested experiment was useful.

Learning loop:

```text
observe event
  -> write typed memory
  -> summarize into user memory capsule
  -> apply only to future suggestions/default UI choices
  -> validate with deterministic tools before any strategy verdict
  -> promote only through approval and proof gates
```

Rules:

- The engine may get more helpful "each minute" by updating per-user memory, queues, summaries, and candidate recommendations.
- It must not silently retrain a shared production model on private user data.
- It must not claim learned lessons are proven until enough deterministic evidence exists.
- It must keep each user's private data and strategy memory isolated by account/workspace.
- It must support reset, export, and delete for user memory.
- It must keep immutable audit logs for memory promotions and model/version changes.
- Online adaptation can change recommendations, defaults, and prioritization; it cannot change historical reports or proof blocks.

### 28.6 Context Engineering

For Codex/Claude/GPT/Opus review, export compact context:

- Current strategy spec.
- Dataset metadata and quality score.
- Run metrics.
- Trade ledger summary.
- Reason-code counts.
- Proof hashes.
- Open questions.
- Recent lessons.

Do not include by default:

- Raw CSV rows.
- Private account details beyond needed risk settings.
- API keys.
- Full transcript if not needed.

Context budget rule:

- Agent notes export should fit in a normal prompt.
- For large runs, include summaries plus hashes, not raw artifacts.
- Include user-specific learned preferences only for that user's context unless an admin explicitly reviews and promotes them.

### 28.7 Tool Integration Principle

Every powerful action must be a typed tool event:

```json
{
  "tool": "run_backtest",
  "input_hash": "sha256:...",
  "started_at": "...",
  "completed_at": "...",
  "status": "pass",
  "output_hash": "sha256:...",
  "summary": "42 trades, PF 1.41, max DD 3.8%, verdict RESEARCH-WORTHY"
}
```

Benefits:

- UI can show progress.
- Proof chain can hash outputs.
- Agents can inspect actions.
- Failed steps are debuggable.
- Reports are reproducible.

Additional event types:

- `llm_provider_configured`
- `llm_call_started`
- `llm_call_completed`
- `agent_turn_started`
- `agent_turn_completed`
- `task_created`
- `task_unblocked`
- `task_started`
- `task_completed`
- `task_failed`
- `message_published`
- `shared_memory_written`
- `cli_command_started`
- `cli_command_completed`
- `cli_command_failed`
- `runner_service_started`
- `runner_service_connected`
- `runner_service_disconnected`
- `runner_job_started`
- `runner_job_completed`
- `runner_job_failed`
- `terminal_command_started`
- `terminal_command_completed`
- `browser_automation_started`
- `browser_automation_completed`
- `browser_automation_failed`
- `autonomous_run_started`
- `autonomous_run_heartbeat`
- `autonomous_run_stopped`
- `memory_capsule_created`
- `memory_event_created`
- `memory_consolidation_started`
- `memory_consolidation_completed`
- `memory_consolidation_failed`
- `user_feedback_recorded`
- `data_import_profile_created`
- `experiment_queued`
- `experiment_started`
- `experiment_completed`
- `model_candidate_registered`
- `model_candidate_evaluated`
- `promotion_requested`
- `promotion_completed`
- `safety_policy_updated`
- `watch_mode_started`
- `watch_mode_stopped`
- `deep_plan_created`
- `lesson_promoted`

### 28.8 Defensive Design

The system should protect private strategy IP and training data, but it must not poison its own outputs.

Allowed defensive controls:

- Keep raw data local.
- Redact agent exports.
- Watermark exported reports later.
- Hash artifacts.
- Require admin approval before sharing.
- Avoid sending strategy text to external APIs by default.

Not allowed:

- Fake tool outputs.
- Misleading reports.
- Poisoned data in user-visible results.
- Any anti-copy trick that reduces trust in our own research output.

### 28.9 Public Multi-Agent Framework Lessons

Public reference: `open-multi-agent` by JackChen-me is an MIT-licensed TypeScript multi-agent orchestration project. The public README describes a model-agnostic, in-process orchestration engine with a coordinator, team abstraction, task queue, message bus, shared memory, agent runner loop, provider adapters, and schema-validated tools.

Clean-room boundary:

- Use only public architecture concepts and API-level ideas.
- Do not copy source files, examples, prompts, tests, naming internals, or exact implementation.
- Keep TradersApp domain-specific: deterministic backtesting, proof lineage, privacy, and per-user learning are stricter than a general multi-agent framework.
- Dependency decision remains open; the default plan is original TradersApp code inspired by common patterns.

Pattern mapping:

| Public pattern | Vibing Finance adaptation |
|---|---|
| Coordinator decomposes a goal | Research Coordinator turns a user agenda into a task DAG |
| Team/sub-agent model | Role agents: Planner, Data Auditor, Strategy Engineer, Backtest Executor, Risk Reviewer, Report Writer, Proof Auditor, Memory Curator |
| MessageBus | Typed workspace/run-scoped event bus feeding transcript and artifact inspector |
| SharedMemory | Namespaced per-user/run memory capsules backed by IndexedDB/local store |
| TaskQueue with dependency graph | Topological scheduler for parse -> validate -> features -> simulate -> metrics -> report -> proof -> critique |
| AgentRunner loop | Bounded model -> tool -> model turns with max-turn, timeout, loop detection, and transcript events |
| ToolRegistry / defineTool-style API | `defineVibingTool()` with schema validation, capability tags, output schema, redaction policy, and artifact hashing |
| Multi-model provider adapters | Same team can mix local LLM, Claude, OpenAI-compatible BYOK, Gemini, Copilot, or deterministic-only agents |
| In-process TypeScript runtime | Browser/Node-first orchestration without spawning one CLI process per agent |
| Built-in bash/file/grep tools | Scope-limited shell, filesystem, search, runner, and MCP adapters for the active agenda only |
| Tool output controls | Per-tool output caps, head/tail excerpts, consumed-output compression, and artifact refs for large outputs |
| Observability hooks | Progress, trace, span, and task events rendered in the visible work loop |

### 28.10 In-Process Multi-Agent Architecture Target

The long-term target is an in-process TypeScript agent kernel, not a pile of separate CLI sessions.

Kernel modules:

```text
ResearchCoordinator
  -> AgentTeam
      -> RoleAgent[]
      -> MessageBus
      -> SharedMemory
      -> TaskQueue
  -> AgentRunner
  -> ToolRegistry
  -> ProviderRegistry
  -> ArtifactStore
  -> PolicyGuard
```

Why in-process first:

- Easier to deploy in browser, Node, Docker, CI/CD, and local desktop runner.
- Easier to keep one event stream, one artifact store, and one proof chain.
- Easier to mix providers in one team.
- Avoids process-per-agent overhead for normal orchestration.
- Shell/terminal execution remains available as a tool, not as the core agent runtime.

Task DAG example:

```text
clarify_strategy
  -> normalize_strategy_spec
  -> validate_dataset
      -> compute_features
          -> detect_setups
              -> simulate_trades
                  -> compute_metrics
                      -> write_report
                          -> append_proof
                              -> generate_next_experiments
```

Parallelizable branches:

- `validate_dataset` and `validate_strategy_spec` can run independently.
- `risk_review`, `report_outline`, and `proof_precheck` can prepare after metrics exist.
- Multiple parameter sensitivity runs can fan out after the base case passes.
- Report writing and agent export can run after the structured report JSON is fixed.

Scheduler rules:

- A task starts only when all required artifact refs exist.
- A failed task blocks only descendants that require its output.
- A task can retry only when retry policy allows it and inputs are unchanged.
- Parallel tasks must declare read/write sets to avoid artifact conflicts.
- A final report cannot be marked complete until all required proof refs exist.

### 28.11 Tool Definition Contract

Every tool should be defined through a schema-first contract.

Proposed shape:

```ts
defineVibingTool({
  name: 'run_backtest',
  description: 'Run deterministic backtest from validated dataset and strategy spec.',
  capability: 'backtest.execute',
  inputSchema: BacktestInputSchema,
  outputSchema: BacktestOutputSchema,
  redactionPolicy: 'no_raw_rows_no_secrets',
  timeoutMs: 300000,
  maxOutputChars: 20000,
  execute: async (input, context) => {
    // Original TradersApp implementation only.
  },
})
```

Contract rules:

- Input validation before execution.
- Output validation before the result reaches any agent context.
- Capability tags for role-agent allowlists.
- Denylist override for dangerous actions.
- Timeout and cancellation support.
- Output truncation plus artifact refs for large data.
- Redaction policy declared at tool definition time.
- Tool execution always emits typed events.

Role tool presets:

| Preset | Allowed tools |
|---|---|
| `readonly` | Read report, read strategy spec, search artifacts, inspect proof |
| `research` | Read artifacts, generate hypotheses, compare runs, write memory candidates |
| `backtest` | Validate data, compute features, simulate, compute metrics |
| `report` | Read metrics, write report, write agent export |
| `proof` | Hash artifacts, verify proof chain, export proof |
| `full_local_runner` | Scoped shell/filesystem/local runner tools for active agenda |

### 28.12 Multi-Model Team Policy

The team should be model-agnostic.

Allowed team composition examples:

- Planner on Claude or GPT.
- Backtest Executor deterministic-only.
- Risk Reviewer on local LLM or BYOK remote LLM.
- Report Writer on user-selected provider.
- Proof Auditor deterministic-only.
- Reviewer on a second model/provider for critique.

Rules:

- A role agent must declare provider, model, tool preset, budgets, and memory access.
- Deterministic-only agents are first-class members of the team.
- BYOK/provider failure degrades to deterministic-only mode where possible.
- A provider cannot access raw CSV, API keys, or full transcripts unless the user explicitly enables that export.
- No model can directly write final strategy verdicts without deterministic metrics and proof refs.

### 28.13 Shared Memory And Message Bus Rules

Message bus channels:

| Channel | Purpose |
|---|---|
| `plan` | Task creation, assignment, dependency changes |
| `tool` | Tool start/progress/complete/fail events |
| `artifact` | Artifact created, linked, verified |
| `memory` | Memory candidate created/promoted/rejected |
| `provider` | LLM call lifecycle without secrets |
| `ui` | Visible progress and user-facing summaries |
| `policy` | Scope denials, budget stops, safety stops |

Shared memory namespaces:

```text
workspace/<workspace_id>/preference/*
run/<run_id>/scratch/*
run/<run_id>/facts/*
strategy/<strategy_id>/lessons/*
proof/<run_id>/*
tool_skill/<tool_name>/*
```

Rules:

- Scratch memory expires or is summarized after the run.
- Facts memory must cite artifact refs.
- Lesson memory must cite evidence thresholds.
- Tool skill memory cannot store secrets.
- Cross-user memory is disabled until privacy and training governance are implemented.

### 28.14 Leaked Claude Code Mirror - Safe Lessons Only

The `yasasbanukaofficial/claude-code` repository publicly describes itself as a mirror/backup of leaked proprietary Claude Code source from an npm source-map exposure and includes a disclaimer that the original source belongs to Anthropic. Treat it as a prohibited implementation source.

Hard boundary:

- Do not clone the repository.
- Do not inspect files under `src/`.
- Do not copy prompts, tool definitions, schemas, names, source layout, terminal UI code, orchestration code, memory code, or service code.
- Do not use leaked internals to claim compatibility with Claude Code.
- Do not replicate private branding, hidden features, internal modes, or proprietary naming.
- Do not depend on it as a package, submodule, reference implementation, or test oracle.

Safe high-level lessons from the public README only:

| README-level observation | Clean-room Vibing Finance lesson |
|---|---|
| Terminal-first coding-agent UX | Build a dense agent research terminal with transcript, plan, tool events, artifacts, and composer |
| Large tool surface | Use a typed tool registry with strict capability presets, not ad hoc direct function calls |
| LLM query engine + tool loop | Keep AgentRunner explicit: model request, tool call, result inspection, next turn |
| Services layer | Separate provider, MCP, auth/settings, memory, observability, and runner services from UI components |
| Multi-agent coordinator | Keep ResearchCoordinator and TaskQueue as first-class architecture, not hidden inside one chat component |
| IDE bridge | Later support VS Code/Codex/desktop runner integration through an adapter, not by coupling UI to an IDE |
| Background memory consolidation | Use a controlled memory refinement job that summarizes run logs into candidate memory capsules |
| Proactive assistant/watch mode | Allow background lab mode under user-defined agenda, budgets, and stop conditions |
| Long deep-planning lane | Add an optional "deep plan" workflow for complex research agendas before execution |
| Source-map leak story | Treat build artifacts, source maps, prompts, schemas, and debug bundles as release-security risks |

### 28.15 Terminal Workbench Requirements

The first screen should feel like an agentic workbench for trading research, not a dashboard with a chatbot bolted on.

Required regions:

```text
left rail: workspace, runs, datasets, strategies, reports
main pane: transcript with user messages, agent turns, tool events, warnings
right pane: selected artifact inspector
bottom pane: composer, mode selector, budget/scope controls
status strip: active model/provider, runner, cost/time budget, proof state
```

Workbench rules:

- The plan is visible and updates as tasks start, block, complete, retry, or fail.
- Tool events are compact but expandable.
- Artifacts can be inspected without leaving the run.
- The user can pause, stop, resume, export, or fork a run.
- Every model/provider call shows which provider was used.
- Shell commands show cwd, exit code, timeout, and summarized output.
- No UI element implies the agent is the source of numerical truth.

### 28.16 Background Memory Consolidation Job

Memory refinement must be explicit and auditable.

Job stages:

```text
orient
  -> gather run events and artifacts
  -> summarize candidate lessons
  -> link evidence refs
  -> prune scratch notes
  -> write memory capsule
  -> mark status as candidate
```

Rules:

- Runs after a completed report, not during metric computation.
- Reads transcript/tool events and artifact summaries, not raw CSV by default.
- Produces candidate memory only.
- Requires validation before becoming a default.
- Never edits historical reports, trade ledgers, metrics, or proof blocks.
- Emits `memory_consolidation_started`, `memory_consolidation_completed`, or `memory_consolidation_failed`.

### 28.17 Proactive Watch Mode

The product may later support a watch mode that keeps working while the user is away.

Allowed watch actions:

- Monitor queued experiments.
- Detect failed runs and safe retry opportunities.
- Compare completed runs.
- Draft next-experiment plans.
- Consolidate memory.
- Prepare debug packages.
- Notify the user when blocked or complete.

Not allowed:

- Spend BYOK/provider quota beyond user budget.
- Change strategy defaults without validation and approval.
- Delete artifacts.
- Access unrelated folders.
- Run unrelated shell commands.
- Upload private datasets by default.

### 28.18 Deep Planning Lane

Complex research agendas should have a dedicated planning lane before execution.

Deep planning input:

- User agenda.
- Dataset inventory.
- Strategy DSL options.
- Risk constraints.
- Existing run history.
- Budget limits.
- Allowed tools/providers.

Deep planning output:

- Task DAG.
- Required datasets/artifacts.
- Tool allowlist.
- Runtime/cost budget.
- Stop conditions.
- Expected report sections.
- Proof plan.
- Risk assumptions and caveats.

The deep plan is not evidence. It is a proposed execution map that must be validated by deterministic tools.

### 28.19 Release Security Lessons

The source-map leak story is directly relevant to TradersApp release hygiene.

Release rules:

- Do not publish source maps for private/admin-only builds unless access-controlled.
- Never include private prompts, proprietary strategy templates, API keys, tool schemas, or raw source in public static assets.
- Scan built assets for secrets and private paths before deployment.
- Keep debug bundles private and time-limited.
- Ensure `.npmignore`, build config, Vite config, Docker context, and CI artifacts exclude private internals.
- Add a release checklist item for "no source maps / no private source in public artifact."
- Treat exported agent debug packages with the same caution as production build artifacts.

---

## 29. CLI And Local Python Runner Architecture

Browser mode is the MVP. The built-in `vibing` CLI is the automation surface. Python is an optional execution engine behind the CLI for larger datasets and parity checks.

Primary local command:

```text
node scripts/vibing-finance/cli.mjs run --csv path/to/file.csv --asset MNQ --strategy strategy.json --out artifacts/vibing-finance/run.json
```

Later shorthand after adding a package `bin` entry:

```text
vibing run --csv path/to/file.csv --asset MNQ --strategy strategy.json --out artifacts/vibing-finance/run.json
```

Optional Python engine command behind the CLI:

```text
python scripts/vibing_finance/run_backtest.py --csv path/to/file.csv --asset MNQ --out artifacts/vibing-finance/run.json
```

CLI responsibilities:

- Validate inputs.
- Build run package.
- Select JS worker-compatible engine or Python engine.
- Run deterministic backtest.
- Write event log.
- Write content-addressed artifacts.
- Generate report and proof block.
- Return stable exit code.
- Support CI and unattended local jobs.

Python runner responsibilities:

- Reuse the same strategy spec.
- Use pandas/NumPy for larger datasets.
- Optionally integrate with existing `ml-engine/backtesting/rig.py`.
- Produce the same report JSON schema as browser mode.
- Produce the same proof block format.
- Never become a separate product surface with incompatible output.

This keeps hosting free because the user's machine performs heavy work.

---

## 30. Integration With Existing TradersApp

### 30.1 Frontend Integration

Add a lazy-loaded screen:

```text
screen === "vibingFinance"
```

The hub should not show it unless:

```text
VITE_ENABLE_VIBING_FINANCE === "true"
isAdminAuthenticated === true
```

### 30.2 BFF Integration

MVP should not require BFF for backtest compute.

Possible BFF use later:

- Verify admin role.
- Store only settings, not strategy data.
- Return feature flag/config.
- Proxy optional local/remote ML engine status.

### 30.3 ML Engine Integration

MVP can run without ML engine.

Later use ML engine for:

- Larger Python backtests.
- Walk-forward validation.
- Monte Carlo.
- PSO parameter search.
- Model-based regime classification.
- Report comparison across runs.

### 30.4 Existing Backtest Rig

The current `ml-engine/backtesting/rig.py` remains useful for Python parity, but browser MVP should define its own narrow JS engine first for zero-hosting cost and immediate UI feedback.

Parity requirement:

- Given the same CSV and strategy spec, browser engine and Python runner should agree within documented fill-policy assumptions.

---

## 31. Implementation Roadmap For This Architecture

### A0 - Spec Hardening

- Keep this document canonical.
- Do not add extra planning docs.
- Add architecture defaults, proof model, and free constraints here.

### A1 - Hidden Page

- Create `src/features/vibing-finance/`.
- Add feature flag.
- Add admin-only route.
- Add placeholder UI.

### A2 - CSV Intake

- Parse uploaded CSV in browser.
- Validate schema.
- Infer symbol/timezone/timeframe.
- Show data quality report.

### A3 - Strategy Spec

- Implement fixed MVP strategy spec.
- Show editable advanced settings later, but defaults should work.

### A4 - Backtest Worker

- Compute IB.
- Compute VWAP.
- Detect caught buyers/sellers.
- Detect structure change.
- Detect pullback.
- Simulate trades.
- Return trade ledger.

### A5 - Risk Report

- Build report sections.
- Add verdict logic.
- Add conservative-fill warnings.

### A6 - Proof Chain

- Hash dataset/spec/result.
- Generate local proof block.
- Sign proof block.
- Render proof in report.

### A7 - Testing

- Unit tests for parser, VWAP, IB, inventory detector, structure detector, fill policy, risk sizing.
- Fixture CSV for MNQ.
- Fixture CSV for NIFTY.
- Browser UI smoke test.
- Cross-check with Python runner later.

### A8 - Built-In CLI And Local Runner

- Add `scripts/vibing-finance/cli.mjs`.
- Implement `vibing doctor`, `validate-data`, `run`, `report`, `proof verify`, and `export`.
- Use the same `core/*` deterministic modules as the browser worker.
- Add optional Python engine only after JS/browser parity is stable.
- Match report, artifact, event, and proof schemas across browser, CLI, and Python.

### A9 - Optional Local LLM

- Add optional summarizer only after deterministic report works.

### A10 - Agent Operating Loop

- Add an "Agent Notes" export section to each report so Codex/Claude can inspect the strategy spec, dataset metadata, metrics, and proof hashes without needing private raw CSV rows.
- Add a compact JSON report format designed for coding agents.
- Keep this as export/import text, not a mandatory hosted API.
- Use agents for critique, improvement ideas, and implementation work, while keeping all final strategy runs deterministic.

---

## 32. Deep Execution Plan

This section turns the architecture into an executable build sequence. The rule is simple: do not build clever ML, public blockchain, or strategy expansion until the narrow deterministic MVP can ingest CSV, detect setups, simulate trades, and generate a strict report.

### 31.1 Planning Objective

Build the product in this order. The first usable MVP stops after step 6; steps 7+ are post-MVP/private-alpha expansion.

1. Hidden admin page.
2. CSV upload and data-quality check.
3. Fixed strategy spec.
4. Deterministic backtest worker.
5. Risk report.
6. Local proof chain.
7. Agent export after M7 passes.
8. Built-in `vibing` CLI using the same core engine.
9. Local runner service for unattended browser-to-machine execution.
10. Python parity runner later.
11. Browser automation tool for screenshots and UI smoke checks.

### 31.2 Critical Path

```text
MVP path:

Feature flag/admin gate
  -> hidden screen shell
  -> CSV parser
  -> data validation
  -> session calendar
  -> IB/VWAP feature computation
  -> inventory + structure + pullback detectors
  -> execution simulator
  -> risk metrics
  -> report builder
  -> proof chain

Post-MVP/private-alpha path:

proof chain
  -> agent notes export
  -> run package export
  -> vibing CLI parity
  -> local runner bridge
```

Anything not on this path is postponed.

### 31.3 Milestone Gates

| Milestone | Name | Deliverable | Blocks |
|---|---|---|---|
| M0 | Spec frozen for MVP | This document has all MVP defaults | All code |
| M1 | Hidden shell | Admin-only screen loads behind flag | CSV work |
| M2 | CSV intake | Validated rows + quality score | Strategy engine |
| M3 | Feature computation | Session, IB, VWAP, swings | Setup detection |
| M4 | Setup detector | Caught buyers/sellers + CHoCH + pullback | Simulation |
| M5 | Execution simulator | Trade ledger and equity curve | Report |
| M6 | Report | Institutional report and verdict | Proof |
| M7 | Proof chain | Signed local proof block | Agent export |
| M8 | Agent export | Compact JSON for Codex/Claude review | Private alpha |
| M9 | Built-in CLI | `vibing run/report/proof/export` uses same schemas as browser | Local automation |
| M10 | Local runner service | `vibing serve` connects browser to local jobs | Unattended work |
| M11 | Python parity | Optional Python engine matching browser/CLI output | Scale |
| M12 | Browser automation | `vibing browser smoke/screenshot/inspect` using Playwright | UI verification |

### 31.4 Non-Negotiable MVP Constraints

- Admin-only.
- CSV-only.
- Browser-first.
- No paid API requirement.
- No server upload of private CSV.
- No public launch.
- No public blockchain dependency.
- No LLM-generated metrics.
- No strategy expansion until M6 is working.
- No "deploy candidate" verdict until at least 100 trades or explicit research override.

### 31.5 Detailed Missing Plan Inventory

The architecture is directionally strong, but the plan still needs these concrete pieces before implementation can move without ambiguity.

| Area | Missing item | Why it matters | Priority |
|---|---|---|---|
| Product scope | Exact first strategy wording and examples | Parser/tests need real beginner prompts and expected normalized specs | P0 |
| Product scope | Final MVP asset set | All session, tick value, fee, and timezone rules depend on this | P0 |
| Product scope | Admin/founder identity rule | Hidden page must know who can open it | P0 |
| UX | Wireframe-level layout contract for workbench | Prevents drifting into generic dashboard/chat UI | P0 |
| UX | Empty, loading, failed, cancelled, completed states | Long-running jobs need predictable visual behavior | P0 |
| UX | Run fork/compare flow | Research value depends on comparing variants, not one report | P1 |
| UX | Memory visibility controls | Users need to inspect, delete, export, or disable learned memory | P1 |
| Data | Canonical CSV column mapper | Real users will upload TradingView, NinjaTrader, broker, and custom CSV formats | P0 |
| Data | Timezone/session inference confidence model | Wrong timezone produces invalid backtests | P0 |
| Data | Futures metadata table | MNQ/NQ/ES/NIFTY need point value, tick size, fees, sessions | P0 |
| Data | Contract roll and holiday rules | Required before serious futures results | P1 |
| Data | Data-quality issue taxonomy | Reports and retry logic need stable reason codes | P0 |
| Strategy DSL | Formal JSON schema file | Parser, UI editor, CLI, tests, and agent export need one contract | P0 |
| Strategy DSL | Strategy version migration plan | Old reports must stay reproducible after DSL evolves | P1 |
| Strategy DSL | Validation error taxonomy | Beginner UX needs precise fixes, not generic invalid spec errors | P0 |
| Backtest engine | Intrabar ambiguity implementation tests | Conservative fill policy is central to trust | P0 |
| Backtest engine | Fee/slippage/cost model defaults | Metrics are meaningless without explicit costs | P0 |
| Backtest engine | Position sizing edge cases | Fractional contracts, min tick, prop-firm risk rules, account size | P0 |
| Backtest engine | No-trade and sparse-trade report rules | Must avoid false conclusions from too few trades | P0 |
| Backtest engine | Parameter sensitivity runner | Strategy robustness needs controlled variation | P1 |
| Metrics | Exact formulas for every metric | Browser, CLI, Python, and reports must agree | P0 |
| Metrics | Minimum evidence thresholds | Verdict rules need trade count, regimes, drawdown, and quality gates | P0 |
| Report | Report JSON schema | Markdown/report UI should be rendered from stable facts | P0 |
| Report | Caveat/rejection reason catalog | Risk Analyst needs consistent language and codes | P0 |
| Proof | Canonical JSON hashing method | Browser/CLI/Python proof hashes must match | P0 |
| Proof | Signing key lifecycle | Need create/export/import/reset and loss recovery rules | P1 |
| Storage | IndexedDB schema migrations | Browser state will evolve over time | P1 |
| Storage | Export/import package schema | Needed before CLI/browser/local-runner interop works | P0 |
| CLI | Actual command contract tests | CLI is promised as canonical automation surface | P1 |
| CLI | Workspace lock rules | Prevent two jobs corrupting same artifacts | P1 |
| Local runner | Auth handshake between browser and localhost runner | Prevent random local pages from using runner | P1 |
| Local runner | Capability manifest schema | Browser needs to know allowed tools and limits | P1 |
| Browser automation | Allowed-origin policy | Avoid unsafe scraping or private-site automation | P1 |
| BYOK | Provider profile schema | Local/BYOK/platform modes need one config shape | P1 |
| BYOK | Secret storage decision per surface | Browser, CLI, and runner have different secret risks | P1 |
| Agent kernel | Task DAG schema | Coordinator, workbench, CLI, and watch mode need shared task state | P1 |
| Agent kernel | Role-agent presets | Prevent every agent from having full tools and full memory | P1 |
| Agent kernel | Loop detection and max-turn rules | Prevent runaway agent loops and cost leaks | P1 |
| Memory | Memory capsule schema | Learning cannot work safely without typed memory | P0 |
| Memory | Promotion workflow | Candidate lessons must not become defaults silently | P0 |
| Memory | Reset/export/delete UX | Required for user trust and privacy | P1 |
| Self-learning | Feedback capture UI | The engine needs explicit accepted/rejected/helpful/not-helpful signals | P1 |
| Self-learning | Training data consent model | Cross-user/shared training must be opt-in and governed | P1 |
| Self-learning | Offline model candidate registry | Actual ML training needs model versions, metrics, rollback | P2 |
| Testing | Golden fixture datasets | Browser/CLI/Python parity depends on stable fixtures | P0 |
| Testing | Numerical integrity test suite | Prevent metric drift after refactors | P0 |
| Testing | Leakage/lookahead test suite | Core trust requirement | P0 |
| Testing | UI smoke tests for workbench | Ensure hidden page remains usable | P1 |
| Security | Build artifact/source-map release gate | Prevent private internals leaking in public assets | P0 |
| Security | Secret scanner in CI | BYOK and provider work raises secret risk | P0 |
| Security | Debug export redaction tests | Debug packages can leak raw data if not tested | P1 |
| Compliance | Financial advice disclaimer placement | Reports must avoid certainty/advice claims | P0 |
| Compliance | Data retention policy | Users need to know where CSVs/reports/memory live | P1 |
| Docs | Beginner upload guide | First users need CSV preparation help | P1 |
| Docs | Reproducibility guide | Explains proof hashes, exports, and report versions | P1 |

P0 definition:

- Must be decided or implemented before a trustworthy private MVP report.

P1 definition:

- Needed before serious private alpha or unattended/autonomous operation.

P2 definition:

- Needed before broad productization, shared learning, or model training at scale.

### 31.6 Missing Implementation Loops

The engine needs built-in loops, not one-shot commands. Each loop must produce typed events, write artifacts/memory when appropriate, and stop on budget, policy, or quality limits.

| Loop | Purpose | Trigger | Output | Safety gate |
|---|---|---|---|---|
| Visible work loop | Make progress inspectable | User starts run | Plan/tool/report/proof events | User can stop |
| Data-quality repair loop | Improve ingestion from messy CSVs | CSV validation fails/warns | Mapping suggestions and quality report | Never mutates raw CSV silently |
| Strategy clarification loop | Turn beginner wording into executable DSL | Ambiguous prompt/spec | Clarifying questions or normalized spec | User confirms spec before run |
| Backtest execution loop | Run deterministic simulation | Valid dataset + spec | Trade ledger, metrics, report facts | Worker timeout and cancellation |
| Sensitivity loop | Test robustness of parameters | Base run passes | Variant runs and comparison report | Fixed parameter bounds |
| Walk-forward loop | Test stability over time | Enough data exists | Train/test split reports | No leakage from future periods |
| Regime comparison loop | Compare market regimes | Regime labels or time buckets exist | Regime metrics and caveats | Minimum trade thresholds |
| Report critique loop | Find weak claims and missing caveats | Report draft exists | Revised report version | Cannot change metrics |
| Proof verification loop | Keep evidence reproducible | Report/proof/export created | Verification result | Hash mismatch blocks promotion |
| Agent export loop | Prepare compact review context | Report complete | Agent notes JSON | No raw rows/secrets by default |
| Memory consolidation loop | Convert run history into candidate lessons | Run complete | Memory capsule | Candidate status only |
| User feedback loop | Learn preferences and usefulness | User accepts/rejects suggestions | Preference memory | User can reset/delete |
| Tool-skill loop | Learn reliable command/runner patterns | Tool failure/success | Tool skill memory | No secrets or destructive commands |
| Provider routing loop | Learn which LLM/local mode works best | Provider call result | Provider preference/cost notes | User budget and opt-in |
| Regression-test synthesis loop | Convert bugs into tests | Failure fixed | New fixture/test candidate | Human review before merge |
| Watch/background lab loop | Continue queued research unattended | User starts autonomous agenda | New runs, comparisons, summaries | Budget, scope, stop conditions |
| Drift/model monitoring loop | Track whether trained components degrade | Model candidate exists | Drift/quality report | No auto-production promotion |
| Offline training candidate loop | Train candidate models safely | Consented data + approved objective | Candidate model + eval report | Registry, rollback, approval |
| Promotion loop | Move candidate lessons/models into defaults | Enough evidence + approval | Versioned default update | Admin approval and proof |
| Release hygiene loop | Catch leaks before deploy | Build/release | Secret/source-map scan report | Blocks release on leak |

### 31.7 Self-Learning Loop Architecture

"Self-learning" means the system gets better through memory, feedback, experiments, and candidate models. It does not mean silently changing production logic.

Safe learning layers:

| Layer | Can update automatically? | Example | Can affect final metrics? |
|---|---|---|---|
| Session scratch | Yes, within run | Notes about current dataset quirks | No |
| User preference memory | Yes, with reset/export/delete | Preferred report depth, provider, risk threshold | No |
| Tool skill memory | Yes, scoped and redacted | "Use Python runner for CSVs > X rows" | Indirect only |
| Candidate strategy lesson | Yes, labeled candidate | "VWAP distance filter looked useful on MNQ 2024" | No until rerun |
| User-specific defaults | Only after user approval | Default risk display/report sections | No metric changes |
| Cross-user defaults | No, requires governance | Better clarification templates | No direct metric changes |
| Model candidate | No production use without approval | Trained classifier for regime labels | Only after registry approval |
| Production model/default | No silent changes | Promoted model/default strategy rule | Yes, with version/proof |

Required event flow:

```text
observe
  -> validate event schema
  -> redact secrets/raw rows
  -> write event
  -> summarize into memory candidate
  -> link artifact/proof refs
  -> score usefulness/confidence
  -> apply only to suggestions/preferences
  -> request approval for default/model promotion
  -> write promoted version with rollback pointer
```

### 31.8 Required Self-Learning Loops In Detail

#### 31.8.1 User Preference Learning Loop

Goal:

- Make the engine feel more personal each session without changing evidence.

Signals:

- Report sections expanded/collapsed.
- Suggestions accepted/rejected.
- Provider chosen.
- Risk thresholds edited.
- Repeated export formats.
- User labels: useful, not useful, wrong, too risky.

Memory written:

```json
{
  "memory_type": "user_preference",
  "scope": "workspace",
  "signal": "accepted_report_style",
  "value": "detailed_risk_first",
  "confidence": 0.72,
  "source_events": ["evt_..."],
  "status": "active_user_preference"
}
```

Guardrails:

- User can inspect, edit, disable, export, and delete this memory.
- Preference memory must not change historical reports.
- Preference memory must not override deterministic risk rules.

#### 31.8.2 Strategy Lesson Learning Loop

Goal:

- Learn which filters, setups, sessions, and assets deserve more experiments.

Signals:

- Multiple completed runs.
- Parameter sensitivity results.
- Walk-forward results.
- Regime comparisons.
- User feedback.

Memory written:

```json
{
  "memory_type": "strategy_lesson",
  "scope": "user",
  "strategy_id": "post_ib_vwap_inventory_v1",
  "finding": "Candidate: limiting entries to <= 1.5R from VWAP improved expectancy on this dataset.",
  "evidence_refs": ["artifact:metrics:sha256:...", "artifact:report_json:sha256:..."],
  "min_trades": 40,
  "confidence": "candidate",
  "status": "not_default"
}
```

Guardrails:

- Needs multiple datasets or time slices before becoming a default.
- Must state sample size and data scope.
- Must never be presented as guaranteed edge.
- Must create a new strategy spec version before testing learned changes.

#### 31.8.3 Data-Quality Learning Loop

Goal:

- Get better at recognizing user CSV formats and recurring data problems.

Signals:

- Column mapping fixes.
- Timezone corrections.
- Rejected rows.
- Session mismatch fixes.
- User-confirmed import profiles.

Memory written:

```json
{
  "memory_type": "data_import_profile",
  "source_hint": "ninjatrader_mnq_export",
  "column_map": {
    "Date": "timestamp",
    "Open": "open",
    "High": "high",
    "Low": "low",
    "Close": "close",
    "Volume": "volume"
  },
  "timezone": "America/New_York",
  "status": "user_confirmed"
}
```

Guardrails:

- Import profile suggestions require confirmation on first use.
- Raw CSV is not uploaded for shared training by default.
- Bad inferred profiles must not silently corrupt data.

#### 31.8.4 Tool Skill Learning Loop

Goal:

- Make local automation more reliable over time.

Signals:

- CLI command success/failure.
- Runner capability checks.
- Environment repairs.
- File path conventions.
- Browser smoke failures and fixes.

Memory written:

```json
{
  "memory_type": "tool_skill",
  "tool": "vibing.run",
  "lesson": "Use Python engine for MNQ files above 1,000,000 rows on this machine.",
  "machine_scope": "local-windows-001",
  "source_events": ["evt_..."],
  "status": "active_local_hint"
}
```

Guardrails:

- Never store API keys, tokens, `.env` contents, or private shell output.
- Never learn destructive commands as automatic fixes.
- Tool skill memory is machine/workspace scoped.

#### 31.8.5 Report Quality Learning Loop

Goal:

- Make reports clearer and more useful without changing numbers.

Signals:

- User edits report wording.
- User asks follow-up questions.
- User marks caveats as helpful/not helpful.
- Report sections repeatedly ignored.

Memory written:

- Preferred report order.
- Preferred detail level.
- Common caveats to emphasize.
- User's risk tolerance display preferences.

Guardrails:

- Report wording can adapt.
- Report metrics, ledgers, proof hashes, and verdict thresholds cannot be rewritten by this loop.

#### 31.8.6 Experiment Queue Learning Loop

Goal:

- Keep proposing better next experiments from evidence.

Signals:

- Failed/rejected strategies.
- Regime-specific weakness.
- Low trade count.
- High drawdown clusters.
- Parameter instability.

Output:

- Prioritized next-experiment queue.
- Estimated runtime and data needs.
- Stop criteria for each experiment.

Guardrails:

- Queued experiments are suggestions until user starts or authorizes background lab mode.
- Background lab mode obeys budget, scope, and stop rules.

#### 31.8.7 Provider Routing Learning Loop

Goal:

- Use the best available local/BYOK/provider path for advisory tasks.

Signals:

- Latency.
- Cost.
- Failure rate.
- User satisfaction.
- Task type.

Output:

- Provider preference hints by task type.
- Cost warnings.
- Deterministic fallback recommendations.

Guardrails:

- Provider selection never sends data to remote LLM unless opt-in allows it.
- BYOK budgets are hard stops.
- Provider memory stores credential IDs, never raw keys.

#### 31.8.8 Offline Model Candidate Training Loop

Goal:

- Train optional helper models only under governance.

Allowed candidate targets:

- Regime classifier.
- Data-quality classifier.
- Clarifying-question ranker.
- Setup-quality scorer.
- Report-caveat ranker.

Training loop:

```text
collect consented examples
  -> build versioned dataset
  -> run leakage checks
  -> train candidate offline
  -> evaluate out-of-sample
  -> compare to deterministic baseline
  -> register model candidate
  -> require approval
  -> deploy as optional versioned helper
  -> monitor drift and rollback
```

Guardrails:

- No public-user data without opt-in consent.
- No private strategies in shared training by default.
- No production promotion without model registry, eval report, rollback, and audit log.
- Candidate model output is advisory unless deterministic backtest validates it.

#### 31.8.9 Safety And Policy Learning Loop

Goal:

- Improve safety stops and scope checks over time.

Signals:

- Blocked commands.
- User cancellations.
- Budget stops.
- Repeated failed retries.
- Secret-scan findings.

Output:

- Better policy rules.
- Safer default budgets.
- Improved warning text.

Guardrails:

- Safety rules can become stricter automatically.
- Safety rules cannot become looser without explicit admin approval.

### 31.9 Self-Learning Definition Of Done

Self-learning is not done until these exist:

- `memory_capsule` schema.
- `memory_event` schema.
- Memory inspect/export/delete UI.
- Memory consolidation job.
- User feedback controls.
- Candidate lesson status labels.
- Evidence refs on every lesson.
- Promotion workflow.
- Rollback pointer for promoted defaults/models.
- Privacy boundary for per-user vs shared learning.
- Training consent setting.
- Offline model registry plan.
- Drift monitoring plan.
- Tests proving memory cannot change historical reports, metrics, ledgers, or proof blocks.

### 31.10 Biggest Weaknesses Of This Document

This section is a self-audit of the spec itself. These are not product bugs yet; they are weaknesses in the planning document that can cause implementation mistakes, delays, or false confidence.

| Severity | Weakness | Why it is dangerous | Required fix |
|---|---|---|---|
| Critical | The spec is too broad for the first implementation pass | It mixes MVP, private alpha, future local runner, BYOK, multi-agent orchestration, self-learning, browser automation, proof chains, ML governance, and launch planning in one continuous build story | Add a strict "Build Now / Build Later / Do Not Build Yet" cutline and keep M1-M7 tiny, with M7 proof blocked until report artifacts exist |
| Critical | Section numbering is inconsistent after later insertions | `## 32` contains `### 31.x`, `## 33` contains `### 32.x`, and later sections repeat this drift. This makes references brittle and confusing for agents and humans | Renumber all headings after the architecture freeze or use stable IDs like `MVP-CSV-001` instead of relying only on section numbers |
| Critical | The MVP is at risk of scope creep | The doc says browser-first deterministic MVP, but it also deeply specifies CLI, local runner, browser automation, BYOK, multi-agent team, watch mode, self-learning, and Python parity | Lock M1-M7 as the only MVP path; mark M8+ as blocked until deterministic report/proof works |
| Critical | "Self-learning" can be misunderstood as automatic model training | The guardrails are present, but the phrase can still lead builders to create unsafe auto-promotion or train on private user data too early | Rename early behavior to "per-user adaptive memory"; reserve "training" for governed offline candidate models only |
| Critical | The first exact strategy is not specified enough for implementation | The doc describes post-IB/VWAP/caught inventory behavior, but still lacks enough fixture examples, exact candle sequences, and expected trades for test-first development | Add 5-10 golden examples with bars, expected setup detection, entry/exit, and report result |
| Critical | Numerical formulas are not fully locked | Metrics are listed, but formulas, annualization assumptions, session normalization, rounding, and edge-case handling are not fully defined | Add a metric formula appendix with exact equations and test vectors |
| Critical | Data assumptions are still too optimistic | Real CSVs vary wildly by broker/export; current plan has general validation but not enough importer profiles or malformed-file examples | Add canonical import profiles and fixture files for TradingView, NinjaTrader, broker CSV, and malformed CSV |
| High | The doc over-specifies agent architecture before proving the backtest engine | Multi-agent orchestration is valuable later, but it can distract from the hard part: deterministic data, fills, metrics, and reports | Build deterministic core first; agent layers can wrap it only after core has golden tests |
| High | There are multiple roadmap layers that overlap | Phase plan, implementation roadmap, deep execution plan, work packages, milestone gates, missing inventory, and loop catalog repeat similar concepts | Consolidate into one authoritative roadmap table plus one backlog/gap table |
| High | Acceptance criteria are uneven | Some sections have strong acceptance tests; others are aspirational requirements without pass/fail checks | Every P0 item needs explicit acceptance criteria and at least one test or manual verification step |
| High | Clean-room reference handling is still a risk | The doc now references a leaked-source mirror as prohibited, but repeatedly mentioning it can still pull attention toward unsafe implementation sources | Keep only the warning/reference note; do not add any further implementation detail from that source |
| High | BYOK and local runner security are not yet implementation-ready | The doc says keys must be safe and runner must be scoped, but it does not yet define encryption, local auth handshake, token exchange, or browser-to-runner trust model | Add exact credential storage and localhost runner pairing protocol before implementing `vibing serve` |
| High | Proof-chain design needs canonicalization details | Hashing is central, but canonical JSON serialization, timestamp normalization, binary artifact hashing, and cross-runtime consistency are not fully specified | Add canonical hash spec and cross-browser/Node/Python hash fixtures |
| High | Browser storage migration is underdefined | IndexedDB is chosen, but schema migrations, corruption recovery, backup/export, and quota handling are not detailed enough | Add IndexedDB versioning, migration, quota, and recovery rules |
| High | Report claims can still become too confident | The doc has caveats, but report generation requirements need stricter language templates and blocked-claim rules | Add "forbidden report claims" and required caveat templates for low data quality, low trade count, and OHLC ambiguity |
| High | Legal/compliance requirements are too thin | The product generates trading reports that users may treat as advice; disclaimers and jurisdictional concerns are only lightly covered | Add a compliance checklist for financial advice, performance claims, testimonials, and user suitability language |
| Medium | The CLI is specified before the core module extraction plan is detailed | Commands are listed, but there is not yet a concrete refactor sequence from current React code to reusable `core/*` modules | Add a core extraction work package before CLI implementation |
| Medium | Python parity is vague | The doc says browser and Python should match within assumptions, but tolerance and divergence reporting are not defined | Add parity tolerance, fixture set, and mismatch report schema |
| Medium | Watch/background mode could create runaway work | Budgets and stops are mentioned, but exact default limits are missing | Add default max runtime, max experiments, max provider spend, max disk usage, and max retries |
| Medium | Memory UX is underspecified | The doc says inspect/export/delete memory, but not how the user sees learned preferences and candidate lessons | Add memory panel UX states, labels, delete confirmations, and "why did you suggest this?" explanation |
| Medium | Model/provider routing is too abstract | Provider adapters are listed, but payload redaction, prompt templates, response validation, and fallback behavior are not specified | Add provider request/response schema and redaction tests |
| Medium | The artifact package format is not finalized | Export/import is central to browser/CLI/runner interop, but package manifest and directory layout are still conceptual | Add `run-package.v1.json` manifest schema |
| Medium | Test plan is not aligned with the new missing-items list | The test plan predates the expanded CLI, runner, browser automation, memory, and learning loops | Update the test plan so every P0/P1 gap has a matching test category |
| Medium | Existing repo integration is shallow | The doc names existing files, but not exact integration points, current constraints, or likely conflicts in `src/features/shell`, auth, and terminal modules | Add a repo integration map before implementation |
| Medium | Performance limits are not quantified | Browser-first depends on knowing row limits, memory caps, worker chunk sizes, and acceptable runtime | Add benchmark targets for 10k, 100k, 1M rows and fallback thresholds |
| Medium | Failure modes are incomplete | State machines exist, but many real failures lack recovery paths: quota exceeded, worker crash, tab close mid-write, corrupted IndexedDB, partial export, runner disconnect | Add a failure/recovery matrix |
| Medium | The "single-doc rule" is becoming a liability | The doc is now large enough that agents may miss important details or contradict earlier sections | Keep this as canonical, but add a short generated implementation checklist at the top after spec freeze |
| Low | Naming is not fully stable | "Vibing Finance", "vibing", "Backtesting Engine", "Research Coordinator", and "Workbench" are all used, but brand/runtime names need final consistency | Add a naming glossary |
| Low | Some future ideas are repeated in multiple sections | BYOK, local runner, memory, CLI, proof, and clean-room rules appear in several places | After decisions stabilize, deduplicate and cross-reference |
| Low | Tables are dense and may hide priority | Long tables are useful but easy to skim past; P0 actions need a separate execution checklist | Add a top-level P0 action checklist |

Immediate cleanup order:

1. Freeze M1-M7 as the only MVP implementation path, with M7 proof blocked until M6 report artifacts exist.
2. Renumber headings or add stable IDs.
3. Add golden strategy/data fixtures.
4. Add exact metric formulas and canonical hash rules.
5. Add report claim guardrails.
6. Add import/export package schema.
7. Add memory capsule schema and feedback UI contract.
8. Add local runner/BYOK security protocol only after browser MVP is proven.
9. Collapse duplicate roadmap sections after the above decisions are locked.

Non-negotiable warning:

- Do not start implementing self-learning, multi-agent teams, BYOK remote calls, or autonomous watch mode until deterministic browser backtest, report, proof, and golden tests are working.

### 31.11 Weakness Resolution Plan

This is the careful remediation plan for every weakness listed in section 31.10. Resolve these in order. Do not skip ahead to exciting agent/automation features while unresolved P0 documentation defects still affect the deterministic MVP.

Resolution principles:

- Fix planning ambiguity before writing large code.
- Convert broad promises into schemas, fixtures, tests, and acceptance criteria.
- Prefer deleting or postponing future scope over expanding MVP.
- Every resolved weakness must leave a durable artifact inside this spec: table, schema, checklist, fixture definition, or acceptance test.
- A weakness is not resolved just because it is acknowledged.

| ID | Weakness | Dependency | Resolution steps | Acceptance check |
|---|---|---|---|---|
| W01 | Spec is too broad for first implementation | None | Add a top-level "Build Now / Build Later / Do Not Build Yet" table. Move M1-M7 into Build Now, with M7 blocked until M6 artifacts exist. Mark CLI, runner, BYOK, multi-agent, watch mode, Python parity, browser automation, and self-learning as blocked until Build Now passes. | A new reader can identify the exact first implementation scope in under 2 minutes. |
| W02 | Section numbering is inconsistent | W01 | Freeze the content order, then renumber headings from section 31 onward. If renumbering is risky, add stable IDs beside milestone headings, e.g. `MVP-M1-HIDDEN-SHELL`. Update internal references. | `rg "^##|^###"` shows no obvious mismatched parent/child numbering. |
| W03 | MVP scope creep | W01 | Add a "MVP Scope Lock" subsection. Define M1-M7 as the only MVP path, with proof after report. Add a rule that M8+ cannot begin until M7 has passing tests and proof output. | Every roadmap table says M1-M7 is MVP and M8+ is post-MVP/private-alpha. |
| W04 | "Self-learning" can be misunderstood | W01 | Rename early behavior in the spec to "per-user adaptive memory". Keep "training" only in offline model candidate sections. Add a glossary entry explaining the difference. | Searching `self-learning` shows only governed architecture/definition sections, not MVP promises. |
| W05 | First exact strategy is under-specified | W03 | Add a "Golden Strategy Fixtures" appendix with 5-10 scenarios: valid long, valid short, no caught inventory, no CHoCH, no pullback, stop-first ambiguity, TP-first case, low-quality data case. Include expected setup and trade outputs. | A developer can implement detector tests directly from the fixture table. |
| W06 | Numerical formulas are not locked | W05 | Add a "Metric Formula Appendix" defining win rate, expectancy R, profit factor, max drawdown, drawdown duration, average R, TP rates, MFE/MAE, fees, slippage, and rounding. Include small numeric test vectors. | Browser/CLI/Python can use the same formulas without interpretation. |
| W07 | Data assumptions are optimistic | W05 | Add importer profiles for canonical CSV, TradingView-like, NinjaTrader-like, broker-like, and malformed CSV. Define header maps, timestamp formats, timezone behavior, and rejection examples. | CSV intake tests can be generated from the profile table. |
| W08 | Agent architecture is over-specified before engine proof | W03 | Add a "Postpone Agent Kernel" block that explicitly freezes multi-agent team implementation until deterministic core, report, proof, and fixtures pass. Keep only visible plan/tool transcript in MVP. | Work packages for multi-agent kernel are labeled post-MVP and blocked by M6. |
| W09 | Roadmap layers overlap | W01, W03 | Choose one authoritative roadmap: milestone gates plus work packages. Mark older phase plan as historical/brainstorm or collapse it into the milestone table. | There is one roadmap marked authoritative; duplicate sections cross-reference it instead of redefining scope. |
| W10 | Acceptance criteria are uneven | W03 | Add acceptance criteria to every P0 row in section 31.5. Convert "should" statements into pass/fail checks where possible. | Each P0 item has at least one test, fixture, or manual verification criterion. |
| W11 | Clean-room reference handling risk | None | Reduce leaked-source references to one warning section and one external reference note. Add a "Do not use as implementation source" tag. Avoid adding further details from prohibited sources. | The doc contains no implementation claims copied from or dependent on leaked internals. |
| W12 | BYOK/local runner security underdefined | W03 | Add a post-MVP "Runner and BYOK Security Protocol" section: localhost pairing token, origin checks, credential storage modes, key redaction, budget enforcement, and revocation. | `vibing serve` remains blocked until this protocol exists. |
| W13 | Proof canonicalization missing | W06 | Add canonical JSON rules: UTF-8, stable key order, no insignificant whitespace, normalized timestamps, binary hash handling, and hash prefixes. Add cross-runtime test vectors. | The same artifact hashes match in browser, Node, and Python test vectors. |
| W14 | IndexedDB migration underdefined | W03 | Add IndexedDB schema version table, store definitions, migration rules, corruption recovery, quota handling, export-before-delete flow. | A browser storage migration test plan exists before implementing storage. |
| W15 | Report claims can be too confident | W06 | Add forbidden claim list and required caveat templates for low trade count, low data quality, OHLC ambiguity, overfit risk, and no out-of-sample data. | Report builder tests reject or flag forbidden certainty language. |
| W16 | Legal/compliance too thin | W15 | Add compliance checklist: no investment advice, educational/research wording, hypothetical performance disclosure, no guarantees, jurisdiction note, user responsibility language. | Every report template includes required disclaimers and avoids prohibited claims. |
| W17 | CLI specified before core extraction | W03 | Add a "Core Extraction Before CLI" work package. Define exact `core/*` modules and prove browser worker uses them before CLI work starts. | CLI M9 is blocked until core modules are imported by the browser worker and tested. |
| W18 | Python parity vague | W06, W13 | Add parity tolerance table by metric and artifact type. Define mismatch report schema and fixture set. Clarify Python is optional engine behind CLI, not separate product. | Python parity has objective pass/fail tolerances. |
| W19 | Watch/background runaway risk | W12 | Add default limits: runtime, experiments, retries, disk, provider spend, network, and idle timeout. Define stop reasons and summary output. | Watch mode cannot run without explicit budget config and stop defaults. |
| W20 | Memory UX underspecified | W04 | Add Memory Panel UX: learned preferences, candidate lessons, evidence refs, disable/delete/export, "why suggested" explanation, and reset controls. | User can inspect and remove every memory type described in self-learning sections. |
| W21 | Model/provider routing abstract | W12 | Add provider request/response schema, redaction policy, prompt payload classes, validation/fallback behavior, and provider error taxonomy. | Provider calls cannot be implemented until schemas and redaction tests exist. |
| W22 | Artifact package format missing | W13 | Add `run-package.v1.json` manifest: schema version, artifact refs, file paths, hashes, engine versions, report refs, proof refs, redaction level. | Browser export, CLI import, and debug package all target the same manifest. |
| W23 | Test plan not aligned with gaps | W05-W22 | Update section 36 with categories for every P0/P1 gap: fixtures, metrics, proof, storage, report claims, CLI contract, runner security, memory, provider redaction. | Every P0 and P1 weakness maps to at least one test category. |
| W24 | Existing repo integration shallow | W03 | Add repo integration map: shell registry, feature flags, admin auth, terminal feature, storage utilities, tests, build config, Playwright config, package scripts. | Implementation tasks reference exact existing files and likely conflict points. |
| W25 | Performance limits unquantified | W07 | Add benchmark targets for 10k, 100k, and 1M rows: parse time, worker runtime, memory cap, UI responsiveness, fallback threshold. | Browser/Python fallback rules are numeric, not subjective. |
| W26 | Failure modes incomplete | W14, W22 | Add failure/recovery matrix: worker crash, tab close, quota exceeded, corrupt IndexedDB, partial export, hash mismatch, runner disconnect, provider failure. | Every listed failure has user message, recovery action, and event code. |
| W27 | Single-doc rule is becoming a liability | W01 | Add a short "Implementation Control Panel" near top after spec freeze: Build Now checklist, P0 blockers, current milestone, blocked future features. Keep details below. | A builder can start from the top without reading the whole document every time. |
| W28 | Naming not stable | W01 | Add naming glossary: product, route, CLI, workbench, coordinator, runner, artifact package, proof chain, memory capsule. | New sections use glossary names consistently. |
| W29 | Future ideas repeated | W09 | After W01-W28, deduplicate repeated BYOK, runner, memory, CLI, proof, and clean-room text. Keep one canonical section per topic and replace duplicates with references. | Repeated requirements no longer contradict or re-state scope differently. |
| W30 | Dense tables hide priority | W01 | Add a compact P0 action checklist with owner/status fields before the long tables. Keep long tables as reference. | P0 work is visible without scanning large tables. |

### 31.12 Weakness Resolution Sequence

Resolve in this order:

1. Scope control: W01, W03, W08, W09, W27, W30.
2. Navigation and naming: W02, W28, W29.
3. Deterministic core detail: W05, W06, W07, W13, W15, W16.
4. MVP implementation contracts: W10, W14, W17, W22, W24, W25, W26.
5. Test alignment: W23.
6. Post-MVP automation security: W12, W18, W19, W21.
7. Adaptive memory and learning UX: W04, W20.
8. Clean-room maintenance: W11 throughout all phases.

Do not start any item in sequence 6 or 7 until sequences 1-5 are complete enough to produce a deterministic browser report with proof.

### 31.13 Weakness Resolution Acceptance Gate

Before implementation starts, the spec must satisfy this gate:

- Build Now / Build Later / Do Not Build Yet table exists.
- M1-M7 are the only MVP implementation scope, with M7 proof blocked until M6 report artifacts exist.
- Heading references are stable enough for agents to cite.
- Golden fixtures exist for the first strategy.
- Metric formulas and proof canonicalization are specified.
- Report claim guardrails and compliance wording are specified.
- Import/export package manifest exists.
- Storage migration and failure recovery rules exist.
- P0 tests are mapped to the test plan.
- Future-agent, BYOK, local runner, watch mode, and self-learning work are explicitly blocked until deterministic MVP passes.

After implementation starts, each weakness resolution must be treated like a requirement change: update this section with status, date, and evidence link before marking it resolved.

### 31.16 Implementation PR Sequence

Use this sequence when moving from spec to code. Do not combine unrelated milestones.

| PR | Stable ID | Goal | Main files | Required verification |
|---|---|---|---|---|
| PR1 | `MVP-M1-HIDDEN-SHELL` | Hidden admin workbench shell behind feature flag | `src/config/features.js`, `src/features/shell/AppScreenRegistry.jsx`, `src/features/vibing-finance/ui/*` | Feature hidden when flag/admin false; empty workbench renders when true |
| PR2 | `MVP-M2-CSV-INTAKE` | CSV parser, importer profiles, data-quality report | `core/csvIngestion.js`, `core/dataQuality.js`, `storage/*` | Canonical/TradingView/NinjaTrader/malformed fixture tests |
| PR3 | `MVP-M3-FEATURES` | Session tagging, IB, VWAP, swings | `core/sessionCalendar.js`, `core/vwap.js`, `core/swings.js` | MNQ/NIFTY timezone/session/IB tests |
| PR4 | `MVP-M4-SETUP-DETECTOR` | Setup state machine and golden setup fixtures | `core/inventoryDetector.js`, `core/structureDetector.js`, `core/setupStateMachine.js` | `GF-*` setup fixtures pass |
| PR5 | `MVP-M5-SIMULATOR` | Conservative execution simulator and trade ledger | `core/backtestEngine.js`, `core/fillPolicy.js`, `core/riskMetrics.js` | Fill ambiguity and metric formula tests pass |
| PR6 | `MVP-M6-REPORT` | Report schema, verdict rules, claim guardrails | `core/reportBuilder.js`, `ui/report/*` | Report forbidden-claim and verdict tests pass |
| PR7 | `MVP-M7-PROOF` | Canonical hashing, proof block, run package export | `core/canonicalJson.js`, `core/proofChain.js`, `core/runPackage.js` | Hash vectors and export/import hash checks pass |
| PR8 | `POST-M8-AGENT-EXPORT` | Compact agent export without raw rows | `core/agentExport.js` | Redaction tests pass |

Repo integration map:

| Concern | Existing repo location | Decision |
|---|---|---|
| Feature flag | `src/config/features.js` | Add `VITE_ENABLE_VIBING_FINANCE`; default false |
| Screen registry | `src/features/shell/AppScreenRegistry.jsx` | Register `screen === "vibingFinance"` lazily |
| Hub/nav visibility | `src/features/hub-content/RegimentHubScreen.jsx` | Keep hidden unless flag/admin true |
| Existing terminal UX | `src/features/terminal/` | Style inspiration only for MVP; do not couple implementation |
| Tests | existing JS test runners plus Playwright | Add focused unit tests near `src/features/vibing-finance/__tests__` |
| CLI package scripts | `package.json` | Do not add until PR7 is stable; CLI is post-MVP |

Module import rules:

- `core/*` imports no React.
- `workers/*` may import `core/*`.
- `ui/*` may import storage/adapters and render artifacts.
- `core/*` does not read provider keys, environment variables, or browser globals.
- CLI later imports `core/*`; therefore `core/*` must remain Node-compatible.

### 31.14 Plan / Target / Goal Completeness Audit

This section audits what is still missing from the plan, target, and goal. It exists because the spec has many architecture details, but a complete plan also needs exact product intent, user promise, operational boundaries, evidence standards, and success/failure definitions.

Completeness standard:

- A builder should know exactly what to build first.
- A tester should know exactly what proves it works.
- A user should know exactly what the product promises and refuses to promise.
- A future agent should know which features are blocked and why.
- A risk reviewer should know where false confidence, privacy loss, or unsafe automation can enter.

#### 31.14.1 Canonical Target Statement

Current target:

> Build a hidden, admin-only Vibing Finance workbench inside TradersApp that lets a trader upload local CSV data, describe the first approved post-initial-balance strategy for MNQ or NIFTY, convert that description into a deterministic strategy spec, run a local browser-first backtest with strict data/fill/risk assumptions, and produce an institutional-style report plus local proof block that protects the user from false confidence.

Still missing from target:

| Missing target detail | Why it matters | Required decision |
|---|---|---|
| First user's identity | "Admin" is not enough to design UX and defaults | Is first user founder only, internal trader, prop trader, beginner retail trader, or invited beta user? |
| First user pain ranked 1-3 | The product can optimize for edge discovery, avoiding bad strategies, position sizing, prop rules, or learning | Rank the first pain before UI copy and report priority are finalized |
| First benchmark task | Needed to judge if MVP is useful | Define one exact upload + strategy + expected report workflow that proves value |
| First success metric | Needed to know if private MVP succeeded | Choose: time to first report, correctness vs fixture, user trust rating, or number of rejected bad strategies |
| First "wow" moment | Needed to shape UX | Decide whether the wow is setup detection, brutal caveats, visual proof, agent-like work loop, or next-experiment plan |
| First unacceptable failure | Needed for launch gate | Define what failure blocks even private use: wrong trades, bad timezone, hidden data upload, overconfident verdict, etc. |

#### 31.14.2 Canonical Goal Ladder

The goal must be layered so future work does not dilute the first build.

| Layer | Goal | Status | Missing detail |
|---|---|---|---|
| Immediate build goal | Deterministic hidden browser MVP for one strategy family | Mostly defined | Golden fixtures, metric formulas, hash canonicalization |
| Private alpha goal | Trustworthy reports, export/import, CLI parity, stronger tests | Partly defined | Alpha user workflow, support process, bug triage rules |
| Automation goal | CLI/local runner can run unattended scoped jobs | Partly defined | Runner security handshake, budgets, workspace locks |
| Intelligence goal | Agent-like planning and critique around deterministic tools | Partly defined | Which role agents are built first, and which are explicitly deferred |
| Learning goal | Per-user adaptive memory improves suggestions safely | Partly defined | Memory UX, feedback controls, promotion gates |
| Model-training goal | Optional governed offline candidate models | Not MVP | Consent, registry, eval protocol, rollback, drift monitoring |
| Launch goal | Public user feature with legal, security, performance, support readiness | Not defined enough | Pricing, support, legal review, data retention, abuse response |

#### 31.14.3 Product Promise Gaps

The exact promise to the user is not fully locked.

Must decide:

- Does the product promise "backtest this strategy" or "help you reject weak strategies"?
- Does the product position itself as a research assistant, risk desk, strategy debugger, or learning coach?
- Does the report lead with verdict, risk, metrics, or explanation?
- Is the first user expected to already have CSV data, or should the product teach CSV preparation?
- Is the MVP only for one uploaded file, or can it compare multiple files/time periods?
- Is the first report allowed to say "paper-trade candidate", or only "research-worthy / revise / reject"?
- What exact language is forbidden because it sounds like financial advice?
- What minimum evidence is required before the product says anything positive?

Required output:

- Add a "User Promise" section with allowed and forbidden wording.
- Add a "First Report Verdict Vocabulary" table.
- Add a "Minimum Evidence Before Positive Language" table.

#### 31.14.4 Strategy Plan Gaps

The strategy is directionally defined, but implementation still needs exact state-machine behavior.

Missing details:

- Exact state names for setup detection.
- Whether caught inventory can occur before/after VWAP crossing, or only relative to IB sweep.
- Whether the structure-change candle itself can be the entry trigger.
- How long the system waits for a pullback after CHoCH before invalidating the setup.
- Whether wick touch of VWAP is enough for pullback, or close/body must interact.
- Whether "33%-66% retrace" is measured from sweep extreme to CHoCH close, CHoCH high/low, or impulse high/low.
- Whether long and short setups can both be active in the same session.
- How to handle a second sweep before entry.
- How to handle gaps through entry, stop, or targets.
- Whether entries use next candle open, trigger price, close price, or conservative fill price.
- Whether partial exits use exact target price or OHLC conservative assumptions.
- How breakeven stop is applied when TP1 and stop are both touched in the same candle.
- Whether commissions/slippage are per side, round trip, per contract, or percentage.

Required output:

- Add a setup detector finite-state machine.
- Add an execution/fill finite-state machine.
- Add at least 10 golden candle-sequence examples.

#### 31.14.5 Data And Instrument Plan Gaps

The plan cannot be correct unless instrument metadata is exact.

Missing details:

- MNQ tick size.
- MNQ point value.
- NIFTY instrument type: spot index, futures, options, or synthetic index CSV.
- NIFTY lot size if futures/options.
- NIFTY tick size and point value by instrument type.
- Currency and conversion handling.
- Whether account equity is USD, INR, or user-configured.
- Default commissions for MNQ and NIFTY.
- Default spread/slippage assumptions.
- How to detect RTH-only vs full-session MNQ data.
- How to treat half days, exchange holidays, and daylight saving time.
- How to handle CSVs with split sessions or overnight sessions.

Required output:

- Add `instrument_metadata.v1` table.
- Add `session_calendar.v1` table.
- Add default fee/slippage table.
- Add user override rules and report caveats.

#### 31.14.6 UX / Workflow Plan Gaps

The workbench shape is described, but exact user journeys still need locking.

Missing user journeys:

- First empty page.
- First CSV upload.
- CSV validation failure.
- Missing timezone confirmation.
- Strategy prompt with missing details.
- Normalized strategy confirmation.
- Backtest running.
- Run cancelled.
- Run failed.
- No trades found.
- Low-quality report generated.
- Normal report generated.
- Report exported.
- Proof verified.
- Memory candidate created.
- User deletes all local data.

Required output:

- Add a user-journey table with screen state, user action, system response, and acceptance check.
- Add exact UI copy for the first-run path.
- Add "danger/caution" copy for low confidence and bad data.

#### 31.14.7 Report And Verdict Gaps

The report standard is broad but not yet executable.

Missing details:

- Exact report section order for MVP.
- Which sections are mandatory vs optional in M6.
- Exact verdict labels.
- Exact thresholds for reject / revise / research-worthy / paper-trade candidate.
- Minimum trades threshold behavior.
- Low data-quality verdict behavior.
- No-trade verdict behavior.
- How to present positive metrics with caveats.
- How to cite evidence refs in report prose.
- How to show "not applied" sections like news filtering.
- Whether charts are required in MVP or post-MVP.

Required output:

- Add `report_schema.v1`.
- Add `verdict_rules.v1`.
- Add report copy templates for each verdict.
- Add forbidden/required language list.

#### 31.14.8 Architecture / Implementation Plan Gaps

The architecture is detailed, but implementation sequencing still has gaps.

Missing details:

- Exact first PR/file-change sequence.
- Which existing auth/admin helper is used.
- Where feature flags live now.
- How the new route is registered.
- Whether `src/features/terminal` is reused or only stylistically referenced.
- How core modules are extracted before CLI.
- What worker bundling pattern Vite will use.
- How tests run in this repo for worker modules.
- Whether Node CLI can import browser-safe ES modules without bundling issues.
- Whether `package.json` scripts should be added immediately or after CLI exists.

Required output:

- Add "Implementation PR sequence" with PR1-PRN.
- Add repo integration map with exact existing files and expected edits.
- Add module import boundary rules.

#### 31.14.9 Security / Privacy / Compliance Plan Gaps

The high-level guardrails are good, but exact controls are missing.

Missing details:

- Admin identity source and session check.
- Local-only data guarantee test.
- IndexedDB encryption decision.
- Proof signing key storage and recovery.
- Debug export redaction.
- Source-map policy for private builds.
- Secret scanning command in CI.
- BYOK key storage mode by surface.
- Runner pairing token and origin policy.
- Data deletion flow.
- Compliance copy in reports.
- Audit log retention.

Required output:

- Add `privacy_controls.v1`.
- Add `secret_handling.v1`.
- Add `runner_security.v1` before `vibing serve`.
- Add report compliance copy templates.

#### 31.14.10 Testing / Verification Plan Gaps

The test plan must become the enforcement layer for the spec.

Missing tests:

- Golden setup-detection fixtures.
- Golden execution/fill fixtures.
- Metric formula fixtures.
- Hash canonicalization fixtures.
- CSV importer profile fixtures.
- Timezone/DST/session fixtures.
- No-trade report fixture.
- Low-quality data fixture.
- Report forbidden-claim tests.
- IndexedDB migration tests.
- Export/import round-trip tests.
- Worker crash/cancel tests.
- UI smoke tests.
- No-network/no-upload tests.
- Secret redaction tests.
- CLI contract tests.
- Runner security tests later.

Required output:

- Add a test traceability matrix linking every P0 requirement to tests.

#### 31.14.11 Business / Launch Plan Gaps

The spec says hidden until useful, but the launch/business target is still underdefined.

Missing details:

- Whether this is founder-only forever, paid feature, beta feature, or public product.
- Who supports users when CSVs fail.
- Data retention promise in public terms.
- Pricing and BYOK positioning.
- Whether "free-for-lifetime" applies to all users or only MVP/local mode.
- What telemetry is allowed, if any.
- What public claims marketing can make.
- What must be manually reviewed before launch.

Required output:

- Add launch/business appendix before public beta.
- Keep business details out of MVP implementation unless they affect privacy, architecture, or report wording.

#### 31.14.12 Completeness Gate For The Plan

The plan is not complete until these exact artifacts exist in this document:

- Canonical target statement.
- User promise and forbidden claims.
- Build Now / Build Later / Do Not Build Yet table.
- MVP scope lock.
- Golden strategy fixtures.
- CSV importer profiles.
- Instrument metadata table.
- Metric formula appendix.
- Fill/execution state machine.
- Report schema and verdict rules.
- Proof canonicalization spec.
- Export/import package manifest.
- Storage migration and recovery plan.
- Failure/recovery matrix.
- Test traceability matrix.
- Repo integration map.
- Implementation PR sequence.
- Memory capsule schema.
- Feedback/memory UX contract.
- Compliance and privacy control templates.

If any item above is missing, the plan is still incomplete.

### 31.15 Absolute Non-Loss Checklist

This checklist protects the target and goal from being diluted during implementation.

Never lose these requirements:

- Hidden/admin-only until launch gates pass.
- Browser-first deterministic MVP.
- Uploaded CSV stays local by default.
- MNQ and NIFTY are the first assets.
- First strategy is post-IB, session VWAP, caught buyers/sellers, structure change, pullback, strict risk.
- No trade before IB completes.
- Risk per trade defaults to 0.2%.
- Stop defaults to 12 points.
- TP1 defaults to 15 points and exits 50%.
- TP2 defaults to 45 points and exits the rest.
- Move remaining stop to breakeven after TP1.
- Conservative OHLC intrabar fills.
- No LLM-generated metrics.
- No paid API requirement.
- No mandatory hosted compute.
- No public blockchain dependency for MVP.
- Report must protect users from false confidence.
- Weak evidence must be labeled weak.
- Every final report needs reproducibility metadata.
- Proof blocks are local and free by default.
- Agent/LLM layers are advisory only.
- Self-learning starts as per-user adaptive memory, not silent production training.
- Cross-user/shared training is opt-in, governed, and post-MVP.
- BYOK is optional and user-controlled.
- CLI/local runner/browser automation are post-browser-MVP automation surfaces.
- Do not clone or implement from leaked proprietary repos.

---

## 33. Work Package Breakdown

### 32.1 M1 - Hidden Admin Shell

Files:

```text
src/features/vibing-finance/VibingFinanceScreen.jsx
src/features/vibing-finance/vibingFinance.css
src/features/vibing-finance/vibingFinanceFlags.js
src/features/shell/AppScreenRegistry.jsx
src/features/hub-content/RegimentHubScreen.jsx
src/config/features.js
```

Tasks:

- Add `VITE_ENABLE_VIBING_FINANCE`.
- Add `isVibingFinanceEnabled()` helper.
- Add lazy-loaded screen.
- Add admin-only access check.
- Hide route from non-admin users.
- Add first Claude Code-style agent workspace layout: left rail, main transcript, right artifact inspector, bottom composer.
- Add initial transcript message types and run-plan checklist.

Acceptance:

- Flag off: feature is invisible.
- Flag on but non-admin: feature remains inaccessible.
- Flag on and admin: screen loads.
- No network request is required to render the empty page.
- First viewport reads as an agent terminal workspace, not a marketing page or normal trading dashboard.

### 32.2 M2 - CSV Intake

Files:

```text
src/features/vibing-finance/csvIngestion.js
src/features/vibing-finance/dataQuality.js
src/features/vibing-finance/storage.js
src/features/vibing-finance/__tests__/csvIngestion.test.js
```

Tasks:

- Parse required columns: `timestamp,open,high,low,close,volume`.
- Accept optional columns: `symbol,timezone,session,contract,point_value,tick_size`.
- Normalize headers case-insensitively.
- Infer symbol from file name or user selection if missing.
- Infer timezone by asset if missing.
- Infer timeframe from timestamp deltas.
- Reject invalid OHLC rows.
- Count missing bars.
- Compute data quality score.
- Store parsed dataset metadata in IndexedDB.

Acceptance:

- Good CSV produces normalized rows.
- Missing column produces clear error.
- Duplicate timestamp produces clear error.
- Invalid OHLC produces row-level error.
- Missing volume produces warning, not crash.
- No CSV row is sent to server.

### 32.3 M3 - Session and Feature Computation

Files:

```text
src/features/vibing-finance/sessionCalendar.js
src/features/vibing-finance/vwap.js
src/features/vibing-finance/swings.js
src/features/vibing-finance/__tests__/sessionCalendar.test.js
src/features/vibing-finance/__tests__/vwap.test.js
```

Tasks:

- Tag each row by session date.
- Apply NIFTY session open `09:15 Asia/Kolkata`.
- Apply MNQ New York session open `09:30 America/New_York`.
- Compute IB high/low for first 60 minutes.
- Reject pre-IB entries.
- Compute session VWAP incrementally.
- Compute 3-candle swing levels.

Acceptance:

- NIFTY 09:15-10:15 rows produce correct IB.
- MNQ 09:30-10:30 rows produce correct IB.
- VWAP resets at session open.
- Multi-day CSV produces separate session features per day.

### 32.4 M4 - Setup Detection

Files:

```text
src/features/vibing-finance/inventoryDetector.js
src/features/vibing-finance/structureDetector.js
src/features/vibing-finance/pullbackDetector.js
src/features/vibing-finance/setupDetector.js
src/features/vibing-finance/__tests__/inventoryDetector.test.js
src/features/vibing-finance/__tests__/structureDetector.test.js
src/features/vibing-finance/__tests__/pullbackDetector.test.js
```

Tasks:

- Detect caught sellers after sweep below IB low and reclaim within 2 candles.
- Detect caught buyers after sweep above IB high and reclaim within 2 candles.
- Confirm bullish structure change above prior 3-candle high and VWAP.
- Confirm bearish structure change below prior 3-candle low and VWAP.
- Detect valid pullback toward VWAP or 33%-66% impulse retrace.
- Trigger long/short entry after pullback confirmation.
- Emit reason codes for every accepted or rejected setup.

Acceptance:

- Fixture with caught sellers emits one long setup.
- Fixture with caught buyers emits one short setup.
- Failed reclaim emits no setup.
- Missing pullback emits no setup.
- Ambiguous setup is skipped, not guessed.

### 32.5 M5 - Execution Simulator

Files:

```text
src/features/vibing-finance/backtestEngine.js
src/features/vibing-finance/fillPolicy.js
src/features/vibing-finance/positionSizing.js
src/features/vibing-finance/workers/backtest.worker.js
src/features/vibing-finance/__tests__/fillPolicy.test.js
src/features/vibing-finance/__tests__/positionSizing.test.js
src/features/vibing-finance/__tests__/backtestEngine.test.js
```

Tasks:

- Run simulation in Web Worker.
- Size risk at 0.2% account equity.
- Use 12-point stop, 15-point TP1, 45-point TP2.
- Close 50% at TP1.
- Move remaining stop to breakeven after TP1.
- Close remainder at TP2.
- Apply conservative intrabar fill policy.
- Track cash/equity.
- Emit trade ledger and equity curve.

Acceptance:

- Position size never exceeds 0.2% defined risk.
- If calculated size is below 1, trade is skipped.
- Same-candle stop/target ambiguity resolves conservatively.
- TP1 moves stop to breakeven.
- Worker can be cancelled.

### 32.6 M6 - Report Builder

Files:

```text
src/features/vibing-finance/riskMetrics.js
src/features/vibing-finance/reportBuilder.js
src/features/vibing-finance/verdictEngine.js
src/features/vibing-finance/__tests__/riskMetrics.test.js
src/features/vibing-finance/__tests__/verdictEngine.test.js
```

Tasks:

- Calculate trade count, win rate, expectancy R, net PnL, drawdown, profit factor.
- Calculate TP1/TP2 hit rates.
- Separate long/short and asset breakdown.
- Include data-quality caveats.
- Include conservative-fill caveats.
- Generate verdict.
- Generate "what would break live" section.
- Generate next experiment suggestions.

Acceptance:

- Report is useful when there are trades.
- Report is useful when there are no trades.
- Weak evidence is not overpromoted.
- Metrics match trade ledger.

### 32.7 M7 - Local Proof Chain

Files:

```text
src/features/vibing-finance/proofChain.js
src/features/vibing-finance/canonicalJson.js
src/features/vibing-finance/hashUtils.js
src/features/vibing-finance/__tests__/proofChain.test.js
```

Tasks:

- Canonicalize JSON.
- Hash dataset metadata.
- Hash strategy spec.
- Hash trade ledger.
- Hash equity curve.
- Hash metrics/report.
- Build Merkle root.
- Append proof block.
- Sign proof block with browser key if available.
- Export proof block with report.

Acceptance:

- Same input produces same hash.
- Modified report changes proof root.
- Proof chain links previous block hash.
- Report can be verified offline.

### 32.8 M8 - Agent Notes Export

Files:

```text
src/features/vibing-finance/agentExport.js
src/features/vibing-finance/__tests__/agentExport.test.js
```

Tasks:

- Create compact JSON for Codex/Claude.
- Include strategy spec.
- Include dataset metadata only, not raw rows.
- Include metrics.
- Include setup counts and reason-code counts.
- Include proof hashes.
- Include open questions and next experiments.

Acceptance:

- Export is small enough to paste into an agent.
- Export contains no raw CSV rows.
- Export lets agent review the run without guessing.

### 32.9 M9 - Built-In CLI

Files:

```text
scripts/vibing-finance/cli.mjs
src/features/vibing-finance/core/*
src/features/vibing-finance/__tests__/cli-contract.test.js
```

Tasks:

- Extract deterministic browser-worker logic into `core/*`.
- Implement `doctor`, `validate-data`, `run`, `report`, `proof verify`, and `export`.
- Add `--json`, `--events`, `--workspace`, `--out`, `--no-llm`, and budget flags.
- Emit the same typed events as the browser workbench.
- Write the same artifact/report/proof schemas.
- Return documented exit codes.

Acceptance:

- A backtest can complete from terminal without opening the browser.
- CLI output can be imported into the browser workbench.
- CLI and browser produce matching metrics for the same fixture within documented fill assumptions.
- CLI runs without paid APIs or provider keys.

### 32.10 M10 - Local Runner Service

Files:

```text
scripts/vibing-finance/runner-server.mjs
src/features/vibing-finance/runnerBridge.js
src/features/vibing-finance/__tests__/runnerBridge.test.js
```

Tasks:

- Implement `vibing serve`.
- Expose `/health`, `/capabilities`, `/runs`, `/runs/:id/events`, `/runs/:id/cancel`, and artifact endpoints.
- Stream progress with Server-Sent Events.
- Reject requests outside the workspace scope.
- Surface connected/disconnected runner state in the browser workbench.

Acceptance:

- Browser can start a local CLI-backed run through `vibing serve`.
- Browser receives progress and completion events.
- Cancel stops the local job cleanly.
- Runner refuses out-of-scope paths and commands.

### 32.11 M11 - Python Parity Engine

Files:

```text
scripts/vibing_finance/run_backtest.py
ml-engine/backtesting/rig.py
tests/vibing_finance/test_python_parity.py
```

Tasks:

- Add Python engine adapter behind the CLI.
- Reuse the same strategy spec JSON.
- Emit the same report and proof schema.
- Compare Python output against JS/browser fixtures.
- Document any accepted numerical tolerance.

Acceptance:

- Python runner matches browser/CLI metrics on fixture data within tolerance.
- Large CSVs can run without browser memory pressure.
- Python output imports into the browser workbench.

### 32.12 M12 - Browser Automation Tool

Files:

```text
scripts/vibing-finance/browser-tool.mjs
src/features/vibing-finance/__tests__/browserToolContract.test.js
playwright.config.js
```

Tasks:

- Implement `vibing browser smoke`.
- Implement `vibing browser screenshot`.
- Implement `vibing browser inspect`.
- Restrict default origins to localhost and explicit allowlists.
- Store screenshots and traces as artifacts.
- Emit typed browser tool events.

Acceptance:

- CLI can verify the hidden workbench renders locally.
- CLI can capture a screenshot artifact for debug packages.
- Browser automation refuses disallowed origins by default.
- Screenshots are excluded from public exports unless explicitly included.

---

## 34. Runtime State Machines

### 33.1 Dataset State

```text
empty
  -> selected
  -> parsing
  -> parsed
  -> validating
  -> valid
  -> feature_ready
  -> rejected
```

Dataset rejected reasons:

- Missing required column.
- Invalid OHLC.
- Invalid timestamp.
- Duplicate timestamp.
- Quality score too low.
- Unsupported asset.

### 33.2 Backtest Job State

```text
idle
  -> queued
  -> validating_inputs
  -> computing_features
  -> detecting_setups
  -> simulating
  -> computing_metrics
  -> building_report
  -> proving
  -> completed
  -> failed
  -> cancelled
```

Failure must include:

```json
{
  "stage": "detecting_setups",
  "code": "NO_IB_WINDOW",
  "message": "No complete 60-minute IB window found for MNQ on 2026-04-24.",
  "recoverable": true
}
```

### 33.2.1 CLI Command State

```text
parsed
  -> validated
  -> workspace_locked
  -> running
  -> writing_artifacts
  -> verifying_outputs
  -> completed
  -> failed
  -> cancelled
```

CLI failure must include:

```json
{
  "command": "run",
  "exit_code": 4,
  "stage": "running",
  "message": "Backtest worker failed before metrics were produced.",
  "event_log": "artifacts/vibing-finance/logs/run_001.events.ndjson"
}
```

### 33.2.2 Local Runner Service State

```text
stopped
  -> starting
  -> ready
  -> running_job
  -> draining
  -> stopped
  -> failed
```

Runner health response must include:

```json
{
  "status": "ready",
  "runner_id": "local-windows-001",
  "workspace_root": "E:/TradersApp",
  "active_jobs": 0,
  "capabilities_hash": "sha256:..."
}
```

### 33.2.3 Browser Automation State

```text
idle
  -> launching
  -> navigating
  -> inspecting
  -> capturing
  -> writing_artifact
  -> completed
  -> failed
```

Browser automation failure must include:

```json
{
  "url": "http://localhost:5173",
  "stage": "navigating",
  "code": "NAVIGATION_TIMEOUT",
  "screenshot_ref": null,
  "recoverable": true
}
```

### 33.3 Report State

```text
none
  -> draft
  -> complete
  -> proof_attached
  -> exported
```

---

## 35. UI Planning Details

### 34.1 Screen Zones

The target UX is a **Claude Code-style agent workspace** adapted for trading research. It should feel like an agent is working through a strategy with tools, artifacts, plans, and results, not like a normal dashboard.

Important boundary:

- Use the interaction pattern of an agent coding terminal.
- Do not copy Claude branding, logos, proprietary names, exact colors, or exact UI assets.
- The product name remains Vibing Finance inside TradersApp.
- The interface should read as "terminal research agent" rather than "Claude clone".
- Do not download, copy, inspect, or depend on leaked/proprietary Claude, Codex, or other private backend/frontend source code.
- Use a clean-room approach: observe public product behavior, use official documentation, study permissively licensed open-source projects, and implement original code inside TradersApp.
- Any third-party reference used for implementation must have a clear license or be official public documentation.

Claude Code-style qualities to preserve:

- Full-screen working surface.
- Dense but calm terminal/editor layout.
- Conversation transcript as the main interaction.
- Explicit tool/run events.
- Visible plan/checklist state.
- Artifact files and reports in side panes.
- Bottom command composer.
- Keyboard-first operation.
- Minimal decoration.
- Monospace-heavy technical typography.
- Clear distinction between user text, agent reasoning summaries, tool output, errors, and final reports.
- Local/autonomous execution feel.

Top bar:

- Feature name.
- Admin-only badge.
- Local-only privacy badge.
- Data status.
- Run status.

Left pane:

- CSV upload.
- Dataset quality.
- Asset selector.
- Account size.
- Strategy defaults.

Center pane:

- Chat/spec conversation.
- Strategy spec preview.
- Run button.
- Progress timeline.

Right pane:

- Key metrics.
- Verdict.
- Proof block.
- Agent notes export.

Bottom/full-width pane:

- Detailed report.
- Trade ledger.
- Equity curve.
- Drawdown curve.
- Setup reason-code table.

### 34.1.1 Claude Code-Style Layout Contract

Desktop layout:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top Status Bar: Vibing Finance | local-only | admin | dataset | run status   │
├───────────────┬──────────────────────────────────────────────┬───────────────┤
│ Left Rail     │ Main Agent Transcript                         │ Right Pane    │
│               │                                              │               │
│ Datasets      │ user: "Backtest post-IB..."                  │ Strategy Spec │
│ Runs          │ agent: parsed assumptions                     │ Report        │
│ Reports       │ tool: validate_csv                            │ Trades        │
│ Proof Chain   │ tool: compute_vwap                            │ Proof         │
│ Agent Exports │ tool: run_backtest                            │ Agent Notes   │
│               │ agent: verdict + caveats                      │ JSON          │
├───────────────┴──────────────────────────────────────────────┴───────────────┤
│ Bottom Composer: type strategy/change/request | Run | Stop | Export          │
└──────────────────────────────────────────────────────────────────────────────┘
```

Mobile layout:

- Single-column transcript first.
- Collapsible left rail as drawer.
- Right pane becomes tabs below transcript.
- Composer remains sticky at bottom.

### 34.1.2 Transcript Message Types

```text
user_message
agent_summary
tool_call
tool_result
warning
error
report_verdict
proof_block
agent_notes
```

Tool-call examples:

```text
validate_csv        PASS  124,882 rows | quality 0.96
compute_ib         PASS  241 sessions
compute_vwap       PASS  session reset
detect_inventory   PASS  86 caught-seller events | 74 caught-buyer events
run_backtest       PASS  42 trades
build_report       PASS  verdict: RESEARCH-WORTHY
append_proof       PASS  block #18
```

### 34.1.3 Plan Pane

The UI should show the current execution plan like an agent checklist:

```text
[x] Parse uploaded CSV
[x] Validate timestamps and OHLC
[x] Compute session IB/VWAP
[x] Detect caught inventory
[ ] Run conservative execution simulation
[ ] Build risk report
[ ] Append proof block
```

Plan state must update during execution. It should not be static decoration.

### 34.1.4 Composer Behavior

The composer accepts natural language commands:

```text
Run the default post-IB strategy on this MNQ CSV.
Change TP1 to 20 points and rerun.
Show only losing trades.
Export agent notes.
Explain why this was rejected.
```

Composer actions:

- `Enter`: new line or submit depending mode.
- `Ctrl+Enter`: run/submit.
- `Esc`: cancel current run.
- `Ctrl+K`: command palette later.
- `Ctrl+L`: clear current transcript view, not stored runs.

### 34.1.5 Visual Style

Use a restrained technical palette:

- Background: near-black or deep neutral.
- Surface: slightly raised neutral panels.
- Text: high-contrast off-white.
- Muted text: gray.
- Success: restrained green.
- Warning: amber.
- Error: red.
- Accent: one TradersApp-compatible blue or cyan.

Typography:

- Monospace for transcript, tool output, JSON, hashes, and run status.
- Existing app sans-serif for labels and report prose if needed.
- No oversized marketing headings.

Component geometry:

- Tight panels.
- 6-8px radius max.
- Thin borders.
- No decorative glow/orbs.
- No nested card stacks.
- Stable fixed rails on desktop.

### 34.1.6 Interaction States

Required states:

- Empty: no CSV uploaded.
- CSV selected.
- CSV validation failed.
- CSV validated.
- Backtest running.
- Backtest cancelled.
- Backtest completed with trades.
- Backtest completed with no setups.
- Report rejected/weak/research-worthy.
- Proof generated.
- Agent notes exported.

### 34.1.7 UI Acceptance Criteria

- The first viewport looks like an agent terminal workspace, not a trading dashboard.
- The main action is obvious: upload CSV, then run strategy through the composer.
- A user can understand what the engine is doing from the tool-call stream.
- A user can inspect strategy spec, trades, report, proof, and agent notes without leaving the page.
- The UI stays usable with no network connection after the app is loaded.
- The UI is responsive without overlapping text or controls.
- The app does not show Claude branding or imply it is Claude Code.

### 34.2 First MVP UI Copy

Use concise in-app labels:

```text
Upload CSV
Validate Data
Run Backtest
Export Report
Agent Notes
Proof Block
```

Avoid marketing copy. This is a tool, not a landing page.

### 34.3 Empty States

No CSV:

```text
Upload a 5-minute MNQ or NIFTY CSV to start.
```

No setups:

```text
No eligible post-IB inventory setups were found under the current rules.
```

Low quality:

```text
Data quality is too low for a decision-grade report.
```

### 34.4 Admin Safety Controls

- Cancel run.
- Clear local data.
- Export proof chain.
- Reset proof key.
- Toggle conservative fill explanation.
- Show raw strategy JSON.

---

## 36. Test Plan

### 35.1 Unit Test Matrix

| Module | Must Test |
|---|---|
| CSV parser | required columns, optional columns, bad rows, duplicate timestamps |
| Data quality | missing bars, invalid OHLC, no volume, timezone inference |
| Session calendar | NIFTY IB, MNQ IB, multi-day sessions |
| VWAP | reset, cumulative formula, no-volume fallback |
| Inventory detector | caught buyers, caught sellers, failed sweeps |
| Structure detector | bullish CHoCH, bearish CHoCH, VWAP confirmation |
| Pullback detector | valid retrace, invalid retrace, no pullback |
| Fill policy | same-candle ambiguity, TP1 then BE, TP2 |
| Position sizing | 0.2% cap, integer skip, point value |
| Metrics | win rate, drawdown, profit factor, expectancy R |
| Verdict | insufficient sample, weak edge, research-worthy |
| Proof chain | deterministic hash, changed payload, linked blocks |
| Agent export | no raw rows, compact schema |

### 35.2 Fixture Plan

Create small hand-built fixtures:

```text
tests/fixtures/vibing-finance/mnq_caught_sellers_long.csv
tests/fixtures/vibing-finance/mnq_caught_buyers_short.csv
tests/fixtures/vibing-finance/nifty_caught_sellers_long.csv
tests/fixtures/vibing-finance/nifty_caught_buyers_short.csv
tests/fixtures/vibing-finance/no_setup.csv
tests/fixtures/vibing-finance/bad_ohlc.csv
tests/fixtures/vibing-finance/missing_bars.csv
```

Each fixture should be tiny and deterministic, not real private market data.

### 35.3 UI Smoke Tests

Scenarios:

- Feature flag off hides page.
- Non-admin cannot access page.
- Admin can access page.
- Upload valid CSV.
- Upload invalid CSV.
- Run fixture backtest.
- Report renders.
- Agent notes export works.
- Proof block renders.

### 35.4 Manual Review Checklist

- Does UI feel like a serious tool?
- Does report avoid exaggerated claims?
- Are weak/no-trade results still useful?
- Is local-only privacy clear?
- Does the app avoid uploading CSV?
- Are all defaults visible?
- Can Codex/Claude understand the agent export?

### 35.5 P0 Test Traceability Matrix

Every P0 planning item must have a test or manual gate before private MVP can be called trustworthy.

| Requirement | Test category | Required fixture/test |
|---|---|---|
| Hidden admin-only access | UI/access smoke | Flag off hidden, non-admin blocked, admin allowed |
| CSV local-only upload | Privacy/integration | No network request during upload/parse/backtest |
| Canonical CSV import | Unit | `canonical_ohlcv_v1` parses valid file |
| TradingView/NinjaTrader import | Unit | Header/date profile fixtures parse after confirmation |
| Malformed CSV rejection | Unit | Missing OHLC, duplicate timestamp, invalid high/low rejected |
| Timezone/session inference | Unit | MNQ ET and NIFTY IST session/IB windows correct |
| Instrument metadata | Unit | MNQ point value/tick, NIFTY synthetic/futures behavior |
| VWAP formula | Unit | Known rows produce expected session VWAP |
| Setup detector | Unit | `GF-LONG-001`, `GF-SHORT-001`, `GF-NO-*` fixtures |
| Conservative fills | Unit | `GF-FILL-001` through `GF-FILL-004` |
| Position sizing | Unit | 0.2% risk, integer contract skip, unknown point-value caveat |
| Metric formulas | Unit | `MF-001` through `MF-004` |
| Report verdict rules | Unit | Reject/revise/research-worthy thresholds and caveats |
| Forbidden claims | Unit/static | Report builder cannot emit guaranteed/proven/safe-to-trade wording |
| Proof canonicalization | Unit | `HASH-001` through `HASH-004` |
| Run package manifest | Unit | Export/import verifies artifact hashes and redaction level |
| Worker cancellation/failure | Worker/unit | Cancel and recoverable failure event emitted |
| Browser smoke | Playwright/manual | Workbench renders first viewport without layout overlap |
| Data deletion/export | Manual until storage implemented | Export proof before delete; local data removal works |
| Secret/source-map hygiene | Build/manual | No secrets or private source maps in public artifact |

---

## 37. Agent Operating Procedure

Every Codex/Claude planning or implementation loop should follow this:

1. Read this canonical spec.
2. Identify the current milestone.
3. Work only on files for that milestone.
4. Keep strategy logic deterministic.
5. Add or update tests with each logic module.
6. Do not introduce paid services.
7. Do not introduce server upload of private CSV.
8. Do not add public blockchain writes.
9. Update this spec if a decision changes.
10. Summarize changed files and verification.

Agent prompt template:

```text
Read docs/VIBING_FINANCE_BACKTESTING_ENGINE_SPEC.md.
Implement milestone <M#> only.
Do not add paid APIs, hosted storage, public blockchain writes, or raw CSV uploads.
Keep backtest metrics deterministic.
Add focused tests for the changed logic.
```

---

## 38. Definition Of Done

### 37.1 MVP Done

The private MVP is done when:

- Admin-only screen exists.
- CSV upload works locally.
- Data quality report works.
- Strategy defaults are visible.
- Backtest worker runs.
- At least 4 fixture strategies pass expected outcomes.
- Report renders.
- Proof chain block is generated.
- Run artifacts can be exported or inspected locally.
- User can configure a BYOK provider profile and choose not to use any platform key.
- No paid API is required.
- No raw CSV is uploaded.
- Section 41 milestone quality gates pass for M1-M7.

### 37.2 Private Alpha Done

Private alpha is done when:

- Real uploaded MNQ CSV can run.
- Real uploaded NIFTY CSV can run.
- At least 30-session sample is handled.
- No browser freeze on reasonable CSV size.
- Report identifies no-trade/weak-edge cases correctly.
- Agent export is useful for Codex/Claude critique.
- Local runner can execute an unattended bounded run and resume from checkpoint.
- PowerShell/tool usage is logged as typed events and policy-rejected when out of scope.
- Per-user memory improves future runs without changing shared defaults automatically.
- Section 41 scorecard averages at least 4/5 with no dimension below 3.

### 37.3 Public Launch Still Blocked Until

- Legal/compliance disclaimers are final.
- Data licensing is solved.
- Multi-user privacy is solved.
- Abuse and quota controls are solved.
- Security review is complete.
- Backtest methodology has been independently reviewed.

---

## 39. Free-Lifetime Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Cloudflare free plan changes | Hosted app may need migration | Keep app static and locally buildable |
| Worker free CPU too small | Server backtests fail | Do not require Worker compute |
| Browser memory insufficient | Large CSV fails | Chunking plus local Python runner |
| Paid data needed | Cannot stay free | Uploaded CSV only in MVP |
| Embedded paid LLM needed | Ongoing cost | Deterministic analyst first, Codex/Claude as operator layer, local LLM optional |
| Public blockchain fees | Ongoing cost | Local proof chain first |
| Free public chain changes | Proof anchoring breaks | Public anchoring optional |
| Admin browser data loss | Reports vanish | Export/import artifacts and proof chain |
| Uploaded CSV has wrong timezone | Bad backtest | Explicit timezone inference and warnings |
| OHLC intrabar ambiguity | False confidence | Conservative fill policy and report caveat |

---

## 40. External Reference Notes

These references informed the free architecture and timing defaults as of 2026-04-25:

- Cloudflare Pages currently presents a Free plan at `$0 forever`, with unlimited sites/seats/requests/bandwidth and 500 builds/month on the compared table: https://www.cloudflare.com/developer-platform/products/pages/
- Cloudflare Workers Free currently has limits such as 100,000 requests/day, 10 ms CPU time, and 128 MB memory, which makes it unsuitable for mandatory heavy backtest compute: https://developers.cloudflare.com/workers/platform/limits/
- Nano documentation describes Nano as a feeless block-lattice cryptocurrency, but it is a currency network rather than a general-purpose report-data ledger: https://docs.nano.org/protocol-design/introduction/
- NSE market timings list normal/equity derivatives open at 09:15 and close at 15:30: https://www.nseindia.com/static/market-data/market-timings
- CME material confirms Micro E-mini futures trade nearly around the clock; the MVP still intentionally uses 09:30 ET as the New York/RTH-style session open for this strategy: https://www.cmegroup.com/education/frequently-asked-questions-micro-e-mini-equity-index-futures.html
- `open-multi-agent` public README describes an MIT-licensed TypeScript multi-agent orchestration engine with `runTeam()`, task DAG orchestration, multi-model teams, MessageBus, TaskQueue, SharedMemory, AgentRunner, ToolRegistry, schema-validated custom tools, MCP integration, local model support, and in-process runtime patterns. This spec uses it only as a public clean-room architecture reference, not copied code: https://github.com/JackChen-me/open-multi-agent
- `yasasbanukaofficial/claude-code` publicly describes itself as a mirror/backup of leaked proprietary Claude Code source exposed through npm source maps. This spec treats it as a prohibited implementation source and uses only README-level cautionary lessons about agent-terminal UX, service separation, background memory, proactive modes, deep planning, and release/source-map hygiene: https://github.com/yasasbanukaofficial/claude-code

---

## 41. Best-In-Class Governance And Evidence Standard

This section prevents the spec from becoming impressive but unenforceable. It defines how decisions stay locked, how future changes are judged, and what evidence is required before anyone can claim the engine is actually excellent.

### 41.1 Gold-Standard Planning Tests

The document must pass these tests before each implementation milestone starts:

| Test | Pass condition |
|---|---|
| Two-minute builder test | A new builder can read section 0 and know exactly what to build now |
| Fixture test | The milestone has at least one fixture, test vector, or manual acceptance check |
| Boundary test | Inputs, outputs, side effects, and artifact refs are explicit |
| Failure test | At least one expected failure path and recovery action is documented |
| Privacy test | The milestone does not upload raw CSV, secrets, or private prompts by default |
| Proof test | Durable outputs can be hashed, versioned, exported, or referenced |
| Agent test | An AI coding agent can work on the milestone without broad interpretation |
| User trust test | The feature cannot create a more confident but less truthful report |

If a milestone fails any test, the spec must be patched before code work continues.

### 41.2 Architecture Decision Records

These are the locked architecture decisions. New decisions must be added here instead of being hidden in prose.

| ADR | Decision | Status | Rationale | Reversal trigger |
|---|---|---|---|---|
| ADR-001 | MVP is browser-first and local-first | Locked | Fastest private value, no hosted compute, strong privacy | Browser cannot handle fixture-scale data after optimization |
| ADR-002 | Uploaded CSV is the only MVP data source | Locked | Avoid licensing, vendor, and timing complexity | Private alpha needs a verified licensed source |
| ADR-003 | MNQ and NIFTY 5-minute data are first assets | Locked | Narrow enough to test sessions, timezone, and execution assumptions | First user changes target market before implementation |
| ADR-004 | Deterministic core owns numerical truth | Locked | Prevents LLM hallucinated metrics and hidden logic drift | Never, unless product stops being a backtester |
| ADR-005 | Conservative OHLC fill policy wins ambiguity | Locked | Avoids optimistic false confidence | Tick-level replay becomes available and verified |
| ADR-006 | Report Builder cannot invent facts | Locked | Report must be evidence-bound | Never |
| ADR-007 | Local proof chain before public chain | Locked | Free, fast, private, reproducible | Legal or customer requirement for public anchoring |
| ADR-008 | CLI comes after browser proof passes | Locked | Prevents premature surface expansion | Browser MVP is abandoned |
| ADR-009 | Local runner is localhost-only by default | Locked | Enables power tools while limiting exposure | Desktop packaging replaces localhost bridge |
| ADR-010 | BYOK/provider calls are optional and post-MVP | Locked | Avoids cost, privacy, and prompt-dependency in first build | User explicitly prioritizes provider-assisted workflow after M7 |
| ADR-011 | Per-user adaptive memory is not model training | Locked | Keeps learning auditable and reversible | Formal consent, registry, evals, rollback, and governance exist |
| ADR-012 | Microservices are boundaries first, deployments later | Locked | Best fit for a vibe-dev builder and single-repo velocity | Operational load proves a separate service is needed |

ADR change template:

```text
ADR:
Date:
Decision changed:
Why:
Evidence:
Risks:
Rollback:
Affected sections:
Tests added:
```

### 41.3 Non-Negotiable Backtesting Invariants

These invariants must become automated tests as implementation starts.

| Invariant | Failure means |
|---|---|
| Signals never use future bars | Lookahead bias |
| Session labels are timezone-explicit | Session bug or silent data drift |
| Initial balance uses only its defined window | Strategy contamination |
| VWAP uses only available bars up to the decision point | Lookahead bias |
| Setup detection emits reason codes | Unexplainable trade logic |
| Entry, stop, target, fees, and slippage are recorded per trade | Non-auditable PnL |
| If stop and target are both touched in one OHLC bar, conservative resolution applies | Optimistic fill bias |
| Metrics derive from ledger, not summary text | Non-reproducible report |
| Report verdict is computed from structured facts | LLM or prose overreach |
| Proof hash changes when any input artifact changes | Broken audit trail |
| Export/import preserves hashes | Broken reproducibility |
| Memory suggestions cannot alter historical runs | Evidence tampering |

### 41.4 Evidence Ladder

The project must not jump from idea to launch. Evidence must climb this ladder:

| Level | Evidence | Allowed claim |
|---|---|---|
| L0 | Spec only | "The plan is defined" |
| L1 | Unit tests and fixtures | "The implementation matches controlled examples" |
| L2 | Real uploaded CSV private runs | "The workflow works on real user files" |
| L3 | Cross-window and sensitivity checks | "The idea is less likely to be a single-period artifact" |
| L4 | Out-of-sample or walk-forward checks | "The idea has preliminary robustness evidence" |
| L5 | Paper-trading/live shadow comparison | "The backtest assumptions are being compared to execution reality" |
| L6 | Independent review and monitoring | "The system is launch-candidate" |

Current evidence level:

- Planning: L0 complete.
- Product: L0 only until code and fixtures exist.

### 41.5 Quality Gates By Milestone

| Milestone | Must pass before merge |
|---|---|
| M1 Hidden Shell | Feature flag off by default, admin gate, empty workbench renders, no public nav exposure |
| M2 CSV Intake | Header profiles, timestamp handling, invalid row report, timezone warning, local-only proof |
| M3 Features | IB, VWAP, swings, session labels, no future-bar access |
| M4 Setup Detector | Golden fixtures for long, short, no-trade, ambiguous, and low-quality cases |
| M5 Simulator | Conservative fills, fees/slippage, risk sizing, ledger-to-metrics consistency |
| M6 Report | Verdict rules, caveats, forbidden claim tests, low-sample warnings |
| M7 Proof | Canonical JSON, hash vectors, export/import verification, proof mismatch failure path |
| M8 Agent Export | Redaction, compact artifact refs, no raw rows by default |
| M9 CLI | Contract tests against browser artifacts, workspace lock, machine-readable exit codes |
| M10 Runner | Pairing, capabilities, budget, cancellation, origin/workspace checks |
| M11 Python | Parity tolerance table and mismatch report |
| M12 Browser Automation | Allowed-origin policy, screenshots as sensitive artifacts |

### 41.6 Spec Change Control

Change rules:

- Any change to MVP scope must update section 0 first.
- Any new service must update sections 20.20, 20.21, 20.25, and 20.27.
- Any new metric must update formulas, report rules, proof artifacts, and tests.
- Any new data source must update importer profiles, licensing, timezone rules, and data-quality tests.
- Any new provider call must update BYOK policy, redaction, budget, failure handling, and logs.
- Any new autonomous loop must update budget, stop reasons, proof, memory, and user visibility.
- Any new launch claim must update compliance language and forbidden claim tests.

Review rule:

- If a change makes the engine more powerful, it must also make observability, limits, and recovery stronger.

### 41.7 Best-In-Class Review Scorecard

Use this scorecard before implementation, private alpha, and launch.

| Dimension | 1 | 3 | 5 |
|---|---|---|---|
| Bias detection | Lookahead/survivorship/timing ignored | Main timing risks documented | Automated leakage tests and review checklist |
| Execution realism | Naive fills | Conservative OHLC fills and cost model | Sensitivity, tick/parity checks, live shadow comparison |
| Validation quality | One profitable run | Fixtures plus real private run | Walk-forward, stress, parameter stability, out-of-sample |
| Report honesty | Profit-first report | Caveats and verdict rules | Claim tests, legal review, evidence ladder labels |
| Reproducibility | Screenshots or summaries only | Exportable artifacts | Cross-runtime hash and metric verification |
| Privacy | Implicit upload or logs | Local-first defaults | Redaction tests, secret scanning, explicit upload controls |
| Autonomy safety | Hidden background jobs | Visible plans and stop button | Budgets, kill switch, event logs, recovery proofs |
| Vibe-dev maintainability | Large unclear files | Stable modules and PR sequence | Contract tests, fixtures, doctor command, agent prompts |

Best-in-class threshold:

- Planning baseline: average score 4+ with no dimension below 3.
- Private MVP: average score 4+ with all M1-M7 tests passing.
- Public launch: average score 4.5+ with no critical open risks.

### 41.8 Red-Team Questions

Before each milestone is marked done, answer:

1. How could this produce a profitable-looking but false result?
2. What timestamp, session, or timezone assumption could be wrong?
3. What hidden data upload or secret exposure could happen?
4. What would an LLM be tempted to invent here?
5. What happens if the browser tab closes mid-run?
6. What happens if IndexedDB quota is exceeded?
7. What happens if the artifact hash mismatches?
8. What proof would convince a skeptical trader this result is reproducible?
9. What should the report refuse to say?
10. What test will fail if this breaks later?

### 41.9 Implementation Evidence Ledger

When code work begins, append evidence rows here.

| Date | Milestone | Evidence | Command / artifact | Result |
|---|---|---|---|---|
| TBD | M1 | Hidden shell verification | TBD | Pending |
| TBD | M2 | CSV fixture tests | TBD | Pending |
| TBD | M3 | Feature computation tests | TBD | Pending |
| TBD | M4 | Setup fixture tests | TBD | Pending |
| TBD | M5 | Simulator and metrics tests | TBD | Pending |
| TBD | M6 | Report guardrail tests | TBD | Pending |
| TBD | M7 | Proof hash vectors | TBD | Pending |

### 41.10 Final Truth

This document can now be treated as a best-in-class planning baseline because it defines:

- The product target.
- The first user.
- The MVP scope.
- The architecture.
- The service boundaries.
- The data contracts.
- The fixtures and metrics that must exist.
- The proof model.
- The report guardrails.
- The autonomy limits.
- The self-learning limits.
- The implementation sequence.
- The launch blockers.
- The governance rules that prevent future drift.

The engine itself is not best-in-class until the implementation evidence ledger is filled with passing tests, artifacts, and private-run verification.
