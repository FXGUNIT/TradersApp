# Vibing Finance Backtesting Engine - Single Canonical Spec

**Status:** Brainstorm draft v0.1  
**Last updated:** 2026-04-25  
**Owner:** TradersApp  
**Visibility:** Secret/internal only until the launch gates in this document are met  
**Single-doc rule:** All product, architecture, security, data, ML, blockchain, UX, launch, and open-question details for this feature must live in this document. Do not create separate planning docs for this feature unless this document explicitly retires that rule.

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

## 13. Default Assumptions Until User Answers

These are temporary assumptions, not final decisions.

- First user: founder/admin only.
- First asset: MNQ or NQ, because existing docs and app context already reference these heavily.
- First strategy family: opening range breakout or ATR trend continuation.
- First timeframe: 5-minute OHLCV.
- First data source: existing uploaded candle/trade data path or CSV upload.
- First report standard: net backtest plus drawdown, costs, walk-forward, Monte Carlo, and caveats.
- First blockchain use: none in MVP; revisit as audit-proof layer only after the engine works.
- First UX: one hidden chat page with structured strategy spec and report output.
- First launch state: hidden behind feature flag and admin role.

---

## 14. Immediate Next Decision

Before code starts, choose these four items:

1. First asset.
2. First strategy family.
3. First available data source.
4. First user/access rule.

Recommended conservative answer:

```text
First asset: MNQ or NQ
First strategy: opening range breakout
First data: user-uploaded 5m CSV first, then database-backed data
First access: admin-only hidden page behind feature flag
```

---

## 15. Working MVP Definition

Proposed MVP:

> A hidden admin-only page where the trader describes one intraday futures strategy in plain English, the app converts it into a validated strategy spec, runs a realistic net backtest on uploaded 5-minute data, and returns a strict risk report with a reject/revise/paper-trade verdict.

This MVP is intentionally narrow. Once it is trustworthy, expand asset coverage, data sources, strategy families, ML optimization, research-paper retrieval, and audit proofs.

