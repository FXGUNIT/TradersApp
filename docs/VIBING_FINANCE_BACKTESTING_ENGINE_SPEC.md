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

### 20.1 Frontend Components

Proposed files:

```text
src/features/vibing-finance/VibingFinanceScreen.jsx
src/features/vibing-finance/vibingFinance.css
src/features/vibing-finance/vibingFinanceFlags.js
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
- Run backtest in worker.
- Show progress.
- Render institutional report.
- Store local artifacts.
- Export report JSON/CSV if needed.
- Append audit event to local proof chain.

### 20.2 Local Storage Components

Use browser IndexedDB, not localStorage, for structured artifacts.

Object stores:

```text
datasets
strategy_specs
backtest_runs
reports
proof_blocks
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

### 27.4 Embedded Paid LLM Policy

Embedded paid APIs are not part of the free MVP.

If added later:

- Must be optional.
- Must support user-provided key.
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

### 28.1 Core Lesson

The engine should not be "one chatbot response." It should be a structured agent workspace around deterministic tools.

For Vibing Finance, that means:

```text
User / Founder
  -> Planner
  -> Context Manager
  -> Tool Router
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

---

## 29. Local Python Runner Architecture

Browser mode is the MVP. Local runner is the escape hatch for large files.

Proposed local command later:

```text
python scripts/vibing_finance/run_backtest.py --csv path/to/file.csv --asset MNQ --out artifacts/vibing-finance/run.json
```

Local runner responsibilities:

- Reuse the same strategy spec.
- Use pandas/NumPy for larger datasets.
- Optionally integrate with existing `ml-engine/backtesting/rig.py`.
- Produce the same report JSON schema as browser mode.
- Produce the same proof block format.

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

### A8 - Local Runner

- Add optional Python CLI after browser MVP works.
- Match report schema.

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

Build the first usable private version in this order:

1. Hidden admin page.
2. CSV upload and data-quality check.
3. Fixed strategy spec.
4. Deterministic backtest worker.
5. Risk report.
6. Local proof chain.
7. Agent export.
8. Python parity runner later.

### 31.2 Critical Path

```text
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
  -> agent notes export
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
| M9 | Python parity | Optional local runner matching browser output | Scale |

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
- Agent notes export exists.
- No paid API is required.
- No raw CSV is uploaded.

### 37.2 Private Alpha Done

Private alpha is done when:

- Real uploaded MNQ CSV can run.
- Real uploaded NIFTY CSV can run.
- At least 30-session sample is handled.
- No browser freeze on reasonable CSV size.
- Report identifies no-trade/weak-edge cases correctly.
- Agent export is useful for Codex/Claude critique.

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
