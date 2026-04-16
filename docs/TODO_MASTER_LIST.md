# TODO Master List
**Last Updated:** 2026-04-16
**Based on:** Trading Session & Dashboard Redesign Plan + ML Engine Research Foundation

---

## ⚠️ EXECUTION PRIORITY — READ FIRST

### TIER 1 — DO NOW: Get App Live 24x7
**Stage P only.** Push DNS, secrets, CI pipeline. Get traders.app deployed and working from any device. Everything else waits.

### TIER 2 — AFTER LIVE: Backend ML Improvements
All Stages S1–S6, ML1–ML8, RESEARCH, FX, OPTS are BACKGROUND tasks. Implement carefully in the backend, update the live app when ready. No rush, no deadline.

### Why?
- A live app with current ML = earning NOW
- A perfect app that doesn't deploy = zero value
- Backend improvements happen WHILE the app earns

---

---

## STAGE P — Production Deployment (Stage P: P01–P15)
*See: `docs/STAGE_P_ROADMAP.md` for full detail*

- [ ] P01 — Reserve domain name (traders.app)
- [ ] P02 — Create DNS A/CNAME records at domain registrar
  **Needed:** bff.traders.app → Railway BFF IP, api.traders.app → Railway ML IP, staging.traders.app → Railway staging
- [x] P03 — Configure frontend `vite.config.ts` binding to domain ✅
- [ ] P04 — Push all 8 GitHub Actions secrets
  **Partial.** Run `python scripts/setup_stage_p.py --init` to generate template, fill real values in `scripts/STAGE_P_VALUES.json`, then `python scripts/setup_stage_p.py` to push.
  Still needed:
  - Vercel token + org ID + project ID (for frontend deploy)
  - Railway token (for backend deploy)
  - Discord/Slack/PagerDuty webhook URLs
  Already pushed: INFISICAL_TOKEN, FINNHUB_TOKEN, NEWS_API_KEY, MLFLOW_TRACKING_URI, AWS keys
- [ ] P05 — Push all Railway environment variables
  **Needed:** 6 Railway IDs (prod/staging env + service IDs for ML Engine + BFF)
  Run `python scripts/setup_stage_p.py --init` → fill `scripts/STAGE_P_VALUES.json` → `python scripts/setup_stage_p.py`
- [ ] P06 — Verify BFF health endpoint returns HTTP 200
- [ ] P07 — Verify CI pipeline `deploy-production` job succeeds

> **CI Pipeline — Latest Run: #944 (id: 24517846294) — 2026-04-16 evening**
>
> | Job | Status | Notes |
> |---|---|---|
> | Unit Tests | ✅ success | — |
> | BFF Server | ✅ success | — |
> | ML Engine Docker Build | ✅ success | — |
> | Frontend Build | ✅ success | — |
> | Security Scan — Bandit | ✅ success | — |
> | Type Check — MyPy | ✅ success | — |
> | File Size Gate | ✅ success | — |
> | Architecture Contracts | ✅ success | — |
> | Dockerfile Lint — Hadolint | ✅ success | — |
> | Helm Chart Lint | ✅ success | — |
> | Validate ADRs | ✅ success | — |
> | Browser Compatibility — Playwright | ✅ success | — |
> | UI Quality Matrix — Playwright | ✅ success | — |
> | Integration Tests | ✅ success | `docker run` directly, bridge network fallback |
> | **Load Tests — Locust** | ✅ **success** | `docker exec curl` health check confirmed working |
> | Container Security Scan | 🔴 independent | separate trigger, not blocking |
> | **Deploy Production** | 🔴 **failure** | `Validate production deploy contract` step failed — missing 7 secrets/variables |
> | Deploy Staging | ⏳ blocked | same missing secrets |
>
> **Deploy Production blocker:** Missing 7 items from `setup_stage_p.py`:
> 1. `secrets.RAILWAY_TOKEN`
> 2. `secrets.VERCEL_TOKEN`
> 3. `secrets.VERCEL_ORG_ID`
> 4. `secrets.VERCEL_PROJECT_ID`
> 5. `secrets.INFISICAL_TOKEN` (may already be set)
> 6. `vars.RAILWAY_PROD_ENV_ID`
> 7. `vars.RAILWAY_PROD_ML_SERVICE_ID`
> 8. `vars.RAILWAY_PROD_BFF_SERVICE_ID`
>
> **Action:** Run `python scripts/setup_stage_p.py --init` → fill `scripts/STAGE_P_VALUES.json` → `python scripts/setup_stage_p.py`

- [ ] P08 — Verify frontend loads at public URL
- [ ] P09 — Configure Infisical secret sync pipeline
- [ ] P10 — DNS propagation verified (48h after P01/P02)
- [ ] P11 — Observability validated (Prometheus + Grafana + Slack alerts)
- [ ] P12 — Backup drill completed
- [ ] P13 — Rollback rehearsal completed
- [ ] P14 — Go-live certificate signed off
- [ ] P15 — Post-deploy smoke tests passed

---

## STAGE S — Trading Session & Dashboard Redesign
*See: `C:\Users\Asus\.claude\plans\sorted-wishing-nebula.md`*

### Phase S1 — Trading Session Config Foundation
- [ ] S1-01 — Create `ml-engine/config/trading_sessions.yaml` (single source of truth)
  - Sessions: `nifty_morning` (ID 4), `mnq_main` (ID 3), `us100_main` (ID 6), `eurusd_main` (ID 7)
  - Blackout dates: NSE 2026 + US 2026 holidays
  - DST transitions 2026: March 8, November 1
  - Risk multipliers per session
- [ ] S1-02 — Create `ml-engine/infrastructure/timezone_utils.py`
  - UTC internal contract (no ET/IST beyond boundaries)
  - `is_dst_active()`, `get_utc_offset_minutes()`, `is_dstransition_near()`
  - `to_ist()`, `to_et()`, `now_utc()`, `to_utc()`
- [ ] S1-03 — Create `ml-engine/infrastructure/session_state_machine.py`
  - `SessionStateMachine` class: `get_state(utc_dt, event_extended)`
  - States: CLOSED, PRE_MARKET, OPEN, POST_MARKET, EXTENDED
  - `is_in_entry_window()` with news extension support
- [ ] S1-04 — Create `ml-engine/infrastructure/session_loader.py`
  - Load and cache `trading_sessions.yaml`
  - `get_session_for_instrument()`, `get_instrument_config()`
  - `detect_active_instrument()` from UTC datetime
  - `is_blackout_date()`
- [ ] S1-05 — Update `ml-engine/config.py`
  - Import from YAML config loader
  - Fix `FIRM_MAX_RISK_PCT` from 0.003 → 0.01 (1%)
  - Add `OVERNIGHT_ALLOWED = false`, `MAX_CONCURRENT_POSITIONS = 1`
  - Backward compat: old IDs 0/1/2 unchanged for historical data
- [ ] S1-06 — Update `ml-engine/features/feature_pipeline.py`
  - `assign_session_ids()` accepts `symbol` parameter
  - Use `SessionStateMachine` instead of inline logic
  - Add new features: `hour_sin`, `hour_cos`, `market_type`, `is_dst_active`, `dstransition_near`
- [ ] S1-07 — Update `ml-engine/session/session_probability.py`
  - Use `SessionStateMachine` for session state
  - Remove hardcoded best alpha windows
  - Add instrument-specific session handling
- [ ] S1-08 — Update `ml-engine/models/session/time_probability.py`
  - Use `session_loader` instead of inline time logic
  - Remove hardcoded session starts dict
- [ ] S1-09 — Update `ml-engine/data/schema.sql`
  - ALTER TABLE: add `session_name`, `instrument`, `is_dst_active`, `market_local_time` columns
  - New tables: `options_trade`, `partial_exit`, `session_summary`, `promotion_log`
- [ ] S1-10 — Add `infrastructure/` to `ml-engine/` directory structure
- [ ] S1-11 — Write DST transition test suite: 15 test cases covering March 8, Nov 1 2026

### Phase S2 — BFF Multi-Instrument Routing
- [ ] S2-01 — Create `bff/services/instrumentRegistry.mjs`
  - `SESSION_REGISTRY`: NIFTY (session 4) + US_EVENING (session 3, instruments: MNQ/US100/EURUSD)
  - `detectActiveSession()` from IST time
  - Max 1 position, no overnight
- [ ] S2-02 — Create `bff/services/circuitBreakerRegistry.mjs`
  - Per-instrument `Map<instrument, CircuitBreaker>`
  - Override `getRateLimitConfig()` in `security.mjs` for calendar endpoints
- [ ] S2-03 — Rewrite `bff/routes/consensusRoutes.mjs`
  - GET `/ml/consensus/nifty` → Nifty consensus + calendar
  - GET `/ml/consensus/us_evening` → MNQ + US100 + EURUSD simultaneously
  - Auto-detection: `detectActiveSession()` from IST
  - Per-instrument circuit breakers
- [ ] S2-04 — Create `bff/routes/calendarRoutes.mjs`
  - GET `/calendar/status` → today's events + expiry status
  - GET `/calendar/blackouts` → user blackout dates
  - POST/DELETE for blackout date CRUD
- [ ] S2-05 — Register routes in `bff/server.mjs`
- [ ] S2-06 — Update `bff/services/consensusEngine.mjs`
  - Instrument-aware ML Engine calls
  - Cache TTL per instrument (Nifty 60s, US Evening 60s, forex 30s)
- [ ] S2-07 — Create `bff/services/calendarService.mjs`
  - Forex Factory scraping (existing) + static event table
  - Session extension logic: if event → max(18:30, event_end+30min) capped 23:30
  - Embed calendar in consensus response

### Phase S3 — Frontend Dashboard Redesign
- [ ] S3-01 — Create `src/features/dashboard/ActiveInstrumentContext.jsx`
  - Zustand `useTradingContext` store: `sessionMode`, `instrument`, `activeTradingMode`
  - `useActiveInstrument()` hook
- [ ] S3-02 — Create `src/features/dashboard/InstrumentSwitcher.jsx`
  - Two-axis: session row (Morning Indian / Evening US) + instrument row (MNQ / US100 / EURUSD)
  - Auto-detect with manual override + "Auto" reset button
- [ ] S3-03 — Create `src/features/dashboard/MarketTimelineClock.jsx`
  - Real-time clock: market local time + UTC
  - Session state badge: OPEN / PRE_MARKET / CLOSED / EXTENDED
  - Updates every second
- [ ] S3-04 — Create `src/features/dashboard/SessionStatusPanel.jsx`
  - Current session: time remaining, entry window status, position count
  - Max 2 trades indicator
- [ ] S3-05 — Create `src/features/calendar/EventCalendarCompact.jsx`
  - **RED CORNER urgency UI**: left rail border transitions transparent → deep red as event approaches
  - Countdown timer always visible
  - Always embedded in dashboard, never dismissed
  - Color coding: transparent → amber(60min) → orange(30min) → red(15min) → deep red(5min)
- [ ] S3-06 — Create `src/features/calendar/ExpiryCalendarPanel.jsx`
  - Next expiry date, days to expiry, is today expiry flag
  - NSE holiday calendar for current week
- [ ] S3-07 — Redesign `src/pages/CollectiveConsciousness.jsx`
  - 2-column grid layout replacing single-column stack
  - Collapsible left rail (auto-collapse during active trading)
  - Instrument-adaptive panel rendering
- [ ] S3-08 — Create `src/pages/CollectiveConsciousness.css`
  - Left rail: 280px → 40px collapsed
  - Panel grid: responsive 2-column
  - Urgency border CSS with transition
  - Mobile: single column
- [ ] S3-09 — Update `src/features/consensus/consensusGateway.js`
  - Multi-instrument `fetchConsensus({ instrument })`
  - Replace with `.mjs` module
- [ ] S3-10 — Create `src/services/calendarGateway.js`
  - Fetch `/calendar/status` and `/calendar/blackouts`
- [ ] S3-11 — Update `src/features/consensus/SessionProbabilityPanel.jsx`
  - Remove hardcoded "Best Alpha Window 10:00–11:30 ET"
  - Config-driven from instrument registry
- [ ] S3-12 — Create pre-session briefing component (30 min before open)
- [ ] S3-13 — Create `src/features/dashboard/InstrumentQuickStats.jsx`
  - Per-instrument quick stats in left rail
  - Trades today, session P&L, position count

### Phase S4 — Options Module (Greenfield)
- [ ] S4-01 — Create `src/features/options/optionsGateway.js`
  - Dhan API integration (free lifetime): https://api.dhan.co.in
  - Fetch Nifty option chain
  - Fetch Greeks: delta, theta, vega, gamma, IV
  - Fetch India VIX
  - Fallback: manual spot entry
- [ ] S4-02 — Create `src/features/options/OptionsStrikePanel.jsx`
  - ATM strike selection: round(spot / 50) × 50
  - Strike distance: spot ± 200–400 points (confirmed from playbook)
  - Delta range filter: 0.10–0.25
  - Premium filter: ₹15–₹40 (avoid <₹10, >₹80)
  - DTE: weekly only (Thursday)
  - Lot size: 25
  - Long options only (no shorts in Phase 1)
- [ ] S4-03 — Create `src/features/options/GreeksDisplayPanel.jsx`
  - Delta, Theta, Vega, Gamma from Dhan API
  - IV vs HV comparison
  - Color-coded: green = favorable, red = unfavorable
- [ ] S4-04 — Create `src/features/options/ExpiryAdvisor.jsx`
  - Weekly vs monthly expiry display
  - Days to expiry countdown
  - Expiry day warning (Thursday = avoid completely)
- [ ] S4-05 — Create `src/features/options/PositionRiskCard.jsx`
  - Max loss = premium × lots × 25
  - Max profit = (target_pct × premium × lots × 25)
  - 2× SL = immediate exit
  - 20–30% TP = exit
- [ ] S4-06 — Create `src/features/options/VolRegimeIndicator.jsx`
  - IV vs HV ratio
  - Regimes: HIGH_IV, NORMAL, LOW_IV, CRUSHING
  - IV rank display
- [ ] S4-07 — Update position sizing panel for options
  - Replace futures tick formula with lot-based formula
  - `lots = floor((account × 1%) / (premium × 25))`
  - Display in ₹, not ticks

### Phase S5 — Economic Calendar & Expiry Calendar
- [ ] S5-01 — Create `bff/services/expiryCalendar.mjs`
  - Nifty weekly expiry: every Thursday
  - Holiday adjustment: Thursday holiday → previous Wednesday
  - Good Friday 2026: expiry April 1 (Wednesday)
  - `getNextExpiry()`, `daysToExpiry()`, `isExpiryDay()`
  - 2026 full expiry calendar hardcoded
- [ ] S5-02 — Create `ml-engine/calendar/_seeds.py`
  - 2026 NSE holidays + US holidays
  - Nifty expiry dates 2026
  - Diwali marked tentative
- [ ] S5-03 — Create `ml-engine/calendar/expiry_engine.py`
  - `get_next_nifty_expiry()`
  - `is_trading_day()` — checks blackout dates
  - `get_trading_status()` — BLOCKED / REDUCED / NORMAL
- [ ] S5-04 — Create `ml-engine/calendar/holiday_calendar.py`
  - NSE + US holiday detection
  - Half-day detection
  - EURUSD UK bank holidays (Boxing Day, Easter Monday)
- [ ] S5-05 — Create `ml-engine/calendar/blackout_store.py`
  - SQLite CRUD for user-defined blackout dates
  - Recurring blackout support (month+day pattern)
  - Blackout overrides expiry detection
- [ ] S5-06 — Create `ml-engine/calendar/calendar_service.py`
  - Aggregated `CalendarStatus` response
  - Combines: expiry + holidays + blackouts + today's economic events
- [ ] S5-07 — Create `ml-engine/_routes_calendar.py`
  - GET `/calendar/status` — full calendar status
  - GET/POST/DELETE `/calendar/blackouts` — CRUD
  - GET `/calendar/expiry/{date}` — expiry info
- [ ] S5-08 — Update `bff/routes/consensusRoutes.mjs` — embed calendar in response
- [ ] S5-09 — Update `src/features/calendar/EventCalendarCompact.jsx`
  - Use embedded calendar from consensus response
  - Red corner urgency UI (already in S3-05)

### Phase S6 — Paper Trading Journal
- [ ] S6-01 — Update `ml-engine/data/schema.sql` — add new tables
  - `options_trade`: strike, expiry, premium, Greeks, DTE, IV, exit_reason
  - `partial_exit`: scaling support
  - `session_summary`: daily aggregated metrics
  - `promotion_log`: paper→live audit trail
  - Extended columns: `session_name`, `instrument`, `is_promoted`, `stage`, `setup_type`
- [ ] S6-02 — Create `ml-engine/inference/paperTradingJournal.py`
  - `PaperTradingJournal` class
  - `log_trade()` with full options + futures fields
  - `log_options_trade()` with Greeks snapshot
  - `log_partial_exit()`
  - `get_session_summary()`
  - 6-gate promotion: min_days=7, min_trades=20, win_rate≥50%, expectancy>0, human_approval, drift<0.3
  - `can_promote()`, `promote()`
- [ ] S6-03 — Update `ml-engine/feedback/feedback_logger.py`
  - Add: `trade_mode`, `session_type`, `instrument`, `setup_type`, `strategy_type`
  - Options-specific feedback: theta_decay, vega_sensitivity, DTE_effectiveness, strike_selection_accuracy
- [ ] S6-04 — Create `src/features/journal/SessionBriefingPanel.jsx`
  - Pre-session: yesterday's stats + today's plan + expiry reminder
  - Post-session: full breakdown + lessons
- [ ] S6-05 — Create `src/features/journal/PromotionGatePanel.jsx`
  - Show 6 gates with pass/fail status
  - Human approval button
  - Drift score display
- [ ] S6-06 — Create `src/features/journal/ExitReasonChart.jsx`
  - Bar chart of exit reasons distribution
  - Win rate by exit reason
- [ ] S6-07 — Create `src/features/journal/SessionComparisonPanel.jsx`
  - Morning vs Evening side-by-side stats
  - Instrument breakdown for US evening

---

## STAGE ML — ML Engine Training & Options Intelligence

### Phase ML1 — Dhan API Integration
- [ ] ML1-01 — Register Dhan API account and get credentials
  - https://api.dhan.co.in
  - Free lifetime — no expiry
  - Client ID + Secret Key
- [ ] ML1-02 — Create `ml-engine/data_providers/dhan_client.py`
  - NSE option chain fetch: `get_option_chain(symbol, expiry)`
  - Spot price: `get_spot_price(symbol)`
  - Greeks: delta, theta, vega, gamma, IV (from live chain)
  - India VIX fetch
  - Rate limiting: 1 req/sec
- [ ] ML1-03 — Create `ml-engine/data_providers/vix_client.py`
  - Fetch India VIX from NSE/BSE or Dhan
  - Cache TTL: 5 min
- [ ] ML1-04 — Create `ml-engine/data_providers/forex_factory_scraper.py`
  - Scrape Forex Factory for US macro events (NFP, FOMC, CPI, etc.)
  - 3-star (high impact) events only
  - Cache TTL: 1 hour
- [ ] ML1-05 — Store Dhan credentials in Infisical

### Phase ML2 — Label Collection Framework (Day 1)
- [ ] ML2-01 — Update `trade_log` INSERT to capture:
  - `setup_type`: RANGE_DAY | FAILED_BREAKOUT | TREND_PULLBACK | NO_SETUP
  - `candle1_close_inside_ib`: bool
  - `candle2_close_confirms`: bool (critical entry trigger)
  - `wick_alone`: bool (flag wick-only rejections as no-trade)
  - `rejection_strength`: float (body/range ratio)
  - `inventory_bias`: LONG | SHORT | NEUTRAL
  - `atr_5min`, `atr_20`
  - `time_in_ist`, `trades_today_count`
- [ ] ML2-02 — Update options_trade INSERT:
  - `premium_received` (for short = credit, for long = debit)
  - `premium_paid` (for long)
  - `delta_at_entry`, `theta_at_entry`, `vega_at_entry`, `iv_at_entry`
  - `india_vix`, `iv_vs_hv_ratio`
  - `strike_distance_from_spot`
  - `premium_per_lot`, `lots_traded`
- [ ] ML2-03 — Update futures_trade fields:
  - `stop_ticks`, `target_ticks`
  - `atr_at_entry`, `atr_threshold_met`: bool
  - `pnl_ticks`, `pnl_pips` (EURUSD)

### Phase ML3 — Setup Classifier Model (NEW)
- [ ] ML3-01 — Create `ml-engine/models/setup/classifier.py`
  - Input: price, IB_high, IB_low, VAH, VAL, POC, candle_series, atr, volume_profile
  - Output: RANGE_DAY | FAILED_BREAKOUT | TREND_PULLBACK | NO_SETUP + confidence
  - Algorithm: Random Forest (fast, interpretable) → can upgrade to XGBoost
  - Features: IB_position, near_POC, rejection_candles, volume_ratio, atr_regime, time_of_day
- [ ] ML3-02 — Create `ml-engine/features/setup_features.py`
  - `extract_ib_position()`: where is price relative to IB high/low
  - `extract_rejection_pattern()`: wick ratio, body direction, second candle confirmation
  - `extract_volume_profile()`: volume at IB boundaries vs inside IB
  - `extract_atr_regime()`: LOW / MEDIUM / HIGH from atr_5 / atr_20
- [ ] ML3-03 — Train setup classifier on historical Nifty data
  - Minimum 20 trades per setup type before evaluation
  - Walk-forward: 90-day train, 7-day test
  - Report: per-setup accuracy, confusion matrix

### Phase ML4 — Entry Confirmation Model (NEW)
- [ ] ML4-01 — Create `ml-engine/models/setup/entry_confirmer.py`
  - Input: first rejection candle features
  - Output: P(second candle confirms) → probability 0–1
  - Decision: if P > 0.65 → ALLOW ENTRY, else → SKIP
  - Hardcoded rule: second candle CLOSE must confirm (no wick-only)
- [ ] ML4-02 — Feature engineering for entry confirmation:
  - `wick_to_body_ratio`: high ratio = stronger rejection signal
  - `close_position_in_range`: where did candle close relative to range
  - `volume_on_candle`: confirmation with volume = stronger
  - `atr_during_rejection`: low atr = rejection more significant
  - `distance_from_vah_val`: further from value = more extreme

### Phase ML5 — Strike & Premium Estimator (NEW)
- [ ] ML5-01 — Create `ml-engine/models/options/strike_estimator.py`
  - Input: IV regime, current IV, time to expiry, expected move (from ML consensus)
  - Output: recommended strike distance (200–400 pts), expected premium range
  - Train on: historical premium at various IV levels + outcomes
- [ ] ML5-02 — Create `ml-engine/models/options/premium_model.py`
  - Predict: expected premium given IV, DTE, moneyness
  - Flag: premium < ₹10 → NO TRADE (insufficient decay)
  - Flag: premium > ₹80 → REDUCE SIZE (too risky)
- [ ] ML5-03 — Validate strike estimator on walk-forward data

### Phase ML6 — Vol Forecasting Layer
- [ ] ML6-01 — Create `ml-engine/models/vol/vol_forecaster.py`
  - HAR (Heterogeneous Autoregressive) baseline
  - GARCH(1,1) baseline
  - ML variant: XGBoost with HAR features + microstructure
  - Target: IV_change (not just IV level) → measure edge = IV - forecasted_RV
- [ ] ML6-02 — Create `ml-engine/features/vol_features.py`
  - Realized vol (Parkinson, Garman-Klass estimators)
  - IV - RV spread
  - Term slope (IV_7d / IV_30d)
  - Risk reversal (25∆ RR)
  - India VIX features
- [ ] ML6-03 — Implement "Volatility is Rough" paper insights
  - Fractional calculus applied to vol forecasting
  - Rough vol model (rHeston) vs classical Heston
  - Measure Hurst exponent from historical vol
- [ ] ML6-04 — StatsForecast baselines: beat HAR + GARCH before trusting deep models

### Phase ML7 — Vol Surface Calibration
- [ ] ML7-01 — Create `ml-engine/models/surface/calibrator.py`
  - Heston calibration to Nifty IV surface
  - QuantLib + least-squares optimization
  - Weights: vega-weighted for ATM strikes
- [ ] ML7-02 — Create `ml-engine/models/surface/surface_features.py`
  - ATM IV, skew slope, term slope, convexity
  - Risk reversal (10∆, 25∆), butterfly
  - Local vol from Dupire formula
- [ ] ML7-03 — Create `ml-engine/models/surface/neural_calibrator.py` (Phase 2)
  - Neural network surrogate for Heston calibration
  - Train on: 1000+ calibrated surfaces
  - Inference: microseconds → real-time use

### Phase ML8 — Deep Hedging (Phase 2)
- [ ] ML8-01 — Install and test PFHedge
  - `pip install pfhedge`
  - Verify deep hedging runs on GPU
- [ ] ML8-02 — Implement deep hedging for short naked options
  - State: (spot, vol, time, position_greeks)
  - Action: hedge trade quantity
  - Objective: minimize hedging shortfall under transaction costs
- [ ] ML8-03 — Evaluate: hedged PnL under costs vs price-fit alone
  - Measure: shortfall percentiles, not just mean PnL
  - Compare: Deep Hedging vs static delta hedge vs no hedge

### Phase ML9 — World-Class Self-Learning Engine
*Converts partial batch-retrain system into true per-prediction feedback loop with exponential compounding. Every guess and result trains the model immediately.*

#### ML9-A: Real Fisher Matrix Computation
- [ ] ML9-A01 — Audit `ml-engine/models/mamba/mamba_sequence_model.py`
  - Locate `save_fisher_matrix()` stub
  - Confirm it currently saves only `{hash, timestamp}` dict
- [ ] ML9-A02 — Implement real empirical Fisher diagonal in `ml-engine/models/mamba/mamba_sequence_model.py`
  - Forward-pass 256 training samples, accumulate `grad²` per parameter
  - Store as `.npz` (NumPy compressed) per training round
  - Fisher used in EWC loss: `λ × Σ F_ii × (θ_i − θ*_i)²`
  - Diagonal only — full N×N matrix is intractable
- [ ] ML9-A03 — Create `ml-engine/infrastructure/fisher_utils.py`
  - `load_fisher_for_round(round_id) → np.load()` dict
  - `save_fisher_matrix(model, round_id)` → .npz path
  - `compute_ewc_penalty(params, fisher_dict, theta_star)` → scalar loss term
  - Backward compat: if no Fisher file found, skip EWC penalty gracefully

#### ML9-B: Online Learning Layer (Per-Trade Weight Update)
- [ ] ML9-B01 — Create `ml-engine/infrastructure/online_learner_config.py`
  - `OnlineLearningConfig` dataclass:
    - `min_trades_before_online: int = 10` — gate online updates
    - `confidence_boost_correct: float = 0.02`
    - `confidence_penalty_wrong: float = 0.05`
    - `max_confidence_delta_per_trade: float = 0.10`
    - `lightgbm_partial_fit_min_samples: int = 20`
    - `mamba_nudge_threshold: int = 5`
    - `ewc_lambda_online: float = 50.0`
- [ ] ML9-B02 — Create `ml-engine/infrastructure/pattern_confidence_tracker.py`
  - Pattern key: `"{setup}|{regime}|{session}"` (e.g. `"FAILED_BREAKOUT|NEUTRAL|nifty_morning"`)
  - Log-odds compounding: `new_odds = old_odds × multiplier`
  - Correct: multiplier = 1.05; Wrong: multiplier = 0.90
  - Capped at [0.05, 0.95]; Persisted to `ml-engine/data/continual_learning/pattern_confidence.json`
  - `_load()`: init all known pattern combos at 0.5 (neutral)
  - `record_trade(setup, regime, session, correct, confidence) → float` — returns updated confidence
  - `get_confidence(setup, regime, session) → float`
  - Thread-safe via `threading.Lock`
- [ ] ML9-B03 — Create `ml-engine/inference/online_learner.py`
  - `OnlineLearner` class: `process_outcome(signal_id, trade_id, setup, regime, session, correct, confidence, pnl) → dict`
  - **Layer 1** (instant, no model change): call `PatternConfidenceTracker.record_trade()`
  - **Layer 2** (every 20 trades): `LightGBM.partial_fit()` on new trades only, `init_model=current_model`
  - **Layer 3** (every 5 trades): Mamba EWC online nudge — 1 epoch, LR×0.1, load Fisher from last batch round
  - `_log_online_update()` → append to `ml-engine/data/continual_learning/online_learning_log.jsonl`
  - `get_learning_stats() → dict`: pattern counts, avg confidence, update count
- [ ] ML9-B04 — Create `ml-engine/infrastructure/fisher_utils.py`
  - `load_fisher_for_round(round_id) -> dict[str, np.ndarray]`
  - `save_fisher_matrix(model, round_id) -> Path`
  - Graceful fallback: return empty dict if no Fisher files exist yet

#### ML9-C: Setup Classifier (Universal Self-Learning Model)
- [ ] ML9-C01 — Create `ml-engine/models/setup/setup_classifier.py`
  - `SetupClassifier` class: 4-class LightGBM (`NO_SETUP`, `RANGE_DAY`, `FAILED_BREAKOUT`, `TREND_PULLBACK`)
  - `predict(features: dict) -> dict`: returns `{setup, confidence, probabilities, entry_ready}`
  - `predict_setup_from_candles(candles_df, ib_high, ib_low, vah, val, poc, regime, session) -> dict`
  - `train(X, y, mode)` — full or incremental (`partial_fit`)
  - `set_pattern_tracker(tracker)` — inject PatternConfidenceTracker for bias blending
  - Pattern bias blending: 70% model / 30% learned pattern confidence (configurable)
  - `_fallback_predict()` — rule-based fallback when model not yet trained (Day 1)
  - `_features_to_array()` — encode features dict to numpy array for LGB
- [ ] ML9-C02 — Create `ml-engine/features/setup_features.py`
  - `extract_setup_features(candles_df, ib_high, ib_low, vah, val, poc) -> dict`
  - Features: IB geometry, wick/body ratios, ATR regime, volume profile, cyclical time, regime
  - `detect_dead_chop(atr_5m, atr_20m) -> bool`
  - `detect_rejection_strength(candle) -> float` (body/range ratio)
- [ ] ML9-C03 — Update `ml-engine/data/schema.sql`
  - `ALTER TABLE trade_log ADD COLUMN setup_type TEXT;`
  - `ALTER TABLE trade_log ADD COLUMN setup_confidence REAL;`
  - `ALTER TABLE trade_log ADD COLUMN entry_confirmed INTEGER;` — 1 if second candle confirmed
  - `ALTER TABLE trade_log ADD COLUMN board_veto_active INTEGER;`
  - `ALTER TABLE trade_log ADD COLUMN board_veto_member TEXT;`
  - `ALTER TABLE trade_log ADD COLUMN pattern_confidence REAL;` — from PatternConfidenceTracker
- [ ] ML9-C04 — Update `ml-engine/feedback/feedback_logger.py`
  - Add `setup_type`, `setup_confidence`, `entry_confirmed` to `log_signal()` INSERT
  - Add `pattern_confidence` to `record_outcome()` — join from pattern tracker
- [ ] ML9-C05 — Update `ml-engine/feedback/trade_log_processor.py`
  - Auto-label setup from IB behavior + candle close confirmation:
    ```
    if price_broke_IB AND returned AND candle2_CLOSED_confirming → "FAILED_BREAKOUT"
    elif price_inside_IB AND near_POC AND volume_active → "RANGE_DAY"
    elif confirmed_trend AND small_pullback_candles → "TREND_PULLBACK"
    else → "NO_SETUP"
    ```
  - Auto-label `entry_confirmed`: second candle CLOSE confirms = 1, wick-only = 0
  - Persist auto-labels to `trade_log.setup_type` after trade closes

#### ML9-D: Deliberative Board Room
- [ ] ML9-D01 — Create `ml-engine/infrastructure/board_room_deliberation.py`
  - `BoardMember` dataclass: name, specialty, confidence (0.5→0.95), total_votes, correct_votes, veto_power, veto_conditions
  - `DeliberationResult` dataclass: consensus, votes dict, confidence, veto_active, veto_member, reasoning, majority_count
  - `DeliberativeBoardRoom` class — 5 board members:

    | Member | Specialty | Veto? | Veto Conditions |
    |---|---|---|---|
    | Tech_IB | IB/VA geometry | No | dead_chop, atr_low |
    | Tech_Candle | Candle patterns | No | wick_noise, no_confirm |
    | RegimeWatcher | Market regime | **Yes** | CRISIS, CONTAGION |
    | OptionsDesk | IV / premium | **Yes** | expiry_day, LOW_IV |
    | RiskOfficer | Risk management | **Yes** | 2 losses today, position_open |

  - `deliberate(ml_signal, ml_confidence, setup, regime, iv_regime, atr_5m, atr_20m, is_expiry_day, losses_today, positions_open) -> DeliberationResult`
  - Consensus: 3/5 agree → proceed; any veto → NEUTRAL (no trade)
  - `record_outcome(result, pnl)`: update each agent's accuracy + confidence
  - `get_board_status() -> dict`: per-agent accuracy + confidence, deliberation count
  - Persist state to `ml-engine/data/continual_learning/board_state.json`
- [ ] ML9-D02 — Create `ml-engine/infrastructure/board_room_telemetry.py`
  - `BoardRoomTelemetry`: replaces current passive heartbeat-only client
  - `post_deliberation(result)` — POST to BFF after each deliberation
  - `post_outcome(outcome)` — POST after each trade result
  - `ensure_deliberation_loop()` — daemon thread, triggers on each consensus call
  - Keep existing heartbeat: `post_heartbeat()` at 90-min intervals
  - `report_board_error()` — separate error channel with 5-min cooldown

#### ML9-E: Integration Into Consensus Pipeline
- [ ] ML9-E01 — Update `ml-engine/inference/predictor.py`
  - Instantiate `SetupClassifier` on startup
  - Call `setup_classifier.predict_setup_from_candles()` before consensus
  - Inject `PatternConfidenceTracker.get_confidence()` into setup features
  - Include `{setup, setup_confidence, entry_ready}` in consensus response
- [ ] ML9-E02 — Update `ml-engine/inference/consensus_aggregator.py`
  - Accept `setup_confidence` from setup classifier
  - Include board deliberation result in consensus output:
    ```python
    board_result = board_room.deliberate(
        ml_signal=direction,
        ml_confidence=consensus_confidence,
        setup=setup_result["setup"],
        regime=regime,
        ...
    )
    final_signal = board_result.consensus if not board_result.veto_active else "NEUTRAL"
    ```
  - Append board votes + reasoning to consensus response payload
- [ ] ML9-E03 — Update `ml-engine/_routes_pso.py` (feedback routes section)
  - Wire `OnlineLearner.process_outcome()` into `record_outcome` endpoint
  - Call `PatternConfidenceTracker.record_trade()` after every matched trade
  - Call `BoardRoom.record_outcome()` after trade closes
  - Log all online learning updates to `online_learning_log.jsonl`
- [ ] ML9-E04 — Update `ml-engine/inference/predictor.py` — MLflow integration
  - After every batch retrain (RetrainPipeline): log to MLflow with tags `{setup, regime, session}`
  - Champion-challenger: if challenger accuracy ≥ baseline: promote to Production
  - Log DVC commit hash as `dvc_commit` tag on every MLflow run
- [ ] ML9-E05 — Create `ml-engine/tests/test_online_learner.py`
  - Test PatternConfidenceTracker: log-odds compounding, bounds [0.05, 0.95]
  - Test OnlineLearner: layer gating (10-trade gate, 20-trade LGB, 5-trade Mamba)
  - Test BoardRoom: veto conditions, majority voting, outcome recording
  - Test SetupClassifier: rule-based fallback on Day 1, pattern bias blending
  - Test FisherUtils: round-trip save/load, graceful missing file handling
- [ ] ML9-E06 — Create `ml-engine/tests/test_setup_classifier.py`
  - Test: NO_SETUP when dead chop
  - Test: FAILED_BREAKOUT when IB broken + returned
  - Test: RANGE_DAY when inside IB + near POC
  - Test: fallback returns valid structure when model=None
  - Test: pattern confidence bias is applied to probabilities

---

## STAGE RESEARCH — Research Foundation & Reading
*See: `memory/ml_engine_research_foundation.md`*

### Reading Roadmap
- [ ] R-01 — Read: Hull — Options, Futures, and Other Derivatives (entire book)
- [ ] R-02 — Read: Natenberg — Option Volatility & Pricing (entire book)
- [ ] R-03 — Read: Gatheral — The Volatility Surface (entire book)
- [ ] R-04 — Read: López de Prado — Advances in Financial Machine Learning (Ch 1–8)
- [ ] R-05 — Read: Bergomi — Stochastic Volatility Modeling (Ch 1–4)
- [ ] R-06 — Read: Taleb — Dynamic Hedging (selected chapters)
- [ ] R-07 — Read: Sinclair — Volatility Trading (selected chapters)
- [ ] R-08 — Paper: Black-Scholes
- [ ] R-09 — Paper: Heston
- [ ] R-10 — Paper: Gatheral, Jaisson, Rosenbaum — "Volatility is Rough"
- [ ] R-11 — Paper: Bühler et al. — "Deep Hedging"
- [ ] R-12 — Paper: SABR Hagan et al.
- [ ] R-13 — Paper: Dupire local volatility

### Python Stack Setup
- [ ] PY-01 — `pip install QuantLib-Python` — verify pricing works
- [ ] PY-02 — `pip install py_vollib` — verify fast IV + Greeks
- [ ] PY-03 — `pip install pyfeng` — Heston, SABR, CEV experiments
- [ ] PY-04 — `pip install pysabr` — SABR calibration
- [ ] PY-05 — `pip install pfhedge` — deep hedging experiments
- [ ] PY-06 — `pip install mlfinlab` — labeling, purged CV
- [ ] PY-07 — `pip install statsforecast` — vol forecasting baselines
- [ ] PY-08 — `pip install vectorbt` — rapid backtesting
- [ ] PY-09 — `pip install backtrader` — event-driven backtests
- [ ] PY-10 — QuantLib: build NSE calendar, verify holiday list

### Hands-On Experiments
- [ ] HX-01 — py_vollib: compute Greeks for Nifty options from live prices
- [ ] HX-02 — QuantLib: build Nifty IV surface from option chain
- [ ] HX-03 — QuantLib: Heston calibration to Nifty surface
- [ ] HX-04 — pyfeng: Bachelier, CEV pricing experiments
- [ ] HX-05 — mlfinlab: implement triple-barrier labeling for options
- [ ] HX-06 — mlfinlab: implement purged cross-validation
- [ ] HX-07 — statsforecast: HAR + GARCH vol forecasting baselines
- [ ] HX-08 — vectorbt: backtest RANGE_DAY setup on historical data
- [ ] HX-09 — pfhedge: deep hedging experiment for short naked put
- [ ] HX-10 — Walk-forward: 90-day train / 7-day test framework

---

## STAGE FX — Futures & CFD Specifics
*MNQ, US100 CFD, EURUSD — all share evening 18:30–22:30 IST*

- [ ] FX-01 — Verify MNQ contract specs: $2/tick, 0.25pt tick size
- [ ] FX-02 — Verify US100 CFD specs: $1/tick (confirm with broker)
- [ ] FX-03 — Verify EURUSD CFD specs: pip = $10/std lot, micro = $0.10/pip
- [ ] FX-04 — Confirm broker for MNQ/US100/EURUSD (same as Dhan? different?)
- [ ] FX-05 — Create `ml-engine/config/instrument_specs.py`
  - MNQ: tick=2.0, lot=1, session=mnq_main
  - US100: tick=1.0, lot=1, session=us100_main, overnight_swap=true
  - EURUSD: pip=0.0001, pip_value=10.0, lot=1000, session=eurusd_main
- [ ] FX-06 — Position sizing for EURUSD: pips × pip_value × lots
- [ ] FX-07 — Confirm futures stop-loss in ticks for MNQ/US100 (TBD from user rules)
- [ ] FX-08 — Auto-liquidate all positions by 22:30 IST (session close, no overnight)

---

## STAGE OPTS — Options Strategy Rules (User's Complete Playbook)
*See: docs/trading_playbook.md*

- [ ] OPTS-01 — Document 3 setups: RANGE_DAY, FAILED_BREAKOUT, TREND_PULLBACK
- [ ] OPTS-02 — Document IB rules: 9:15–10:15 IST, first hour = observe only
- [ ] OPTS-03 — Document candle confirmation: first candle = ALERT, second candle CLOSE = ENTRY
- [ ] OPTS-04 — Document inventory rules: above value = LONG bias, below = SHORT bias, neutral = both
- [ ] OPTS-05 — Document strike distance: always from SPOT, 200–400 pts OTM
- [ ] OPTS-06 — Document premium rules: ₹15–₹40 ideal, avoid <₹10, >₹80
- [ ] OPTS-07 — Document delta rules: 0.10–0.25 ideal range
- [ ] OPTS-08 — Document SL: 2× premium — immediate exit, no rolling
- [ ] OPTS-09 — Document TP: 20–30% of premium received
- [ ] OPTS-10 — Document trade management: hold while valid, exit if structure broken
- [ ] OPTS-11 — Document daily stop: 2 losses = stop for the day
- [ ] OPTS-12 — Document expiry rule: complete avoidance of Nifty on Thursday expiry
- [ ] OPTS-13 — Document time rules: no entries after 13:30 IST, exit all before 15:00 IST
- [ ] OPTS-14 — Document NEVER TRADE filters:
  - First breakout candle
  - Fast momentum / panic candles
  - Dead chop (atr < atr_avg × 0.5)
  - WICK ALONE (no close confirmation)
  - If confused: don't trade
- [ ] OPTS-15 — Document position rules: 1 lot only, max 2 trades/day

---

## COMPLETED (as of 2026-04-16)
- [x] R12, R15, R16, R17, R18, R19 (from prior sessions)
- [x] Architecture design: 5-layer ML engine
- [x] Research foundation memory: memory/ml_engine_research_foundation.md
- [x] Trading session plan: C:\Users\Asus\.claude\plans\sorted-wishing-nebula.md
- [x] User's complete playbook documented: Naked Option Selling Live Execution Checklist
- [x] Dhan API confirmed as broker (free lifetime)
- [x] FIRM_MAX_RISK_PCT: 0.003 → 0.01 confirmed
- [x] Calendar urgency UI: red corner design confirmed
- [x] US evening: all 3 instruments in 1 view confirmed
- [x] 3 setups universal across all asset classes confirmed
- [x] Phase ML9 design: World-Class Self-Learning Engine (Phase 7 in plan)
  - 4 critical gaps identified: Fisher stubs, batch-only learning, no setup classifier, passive Board Room
  - 3-layer online learning architecture: PatternConfidenceTracker + LGB partial_fit + Mamba EWC nudge
  - Log-odds compounding for pattern confidence (exponential growth)
  - 5-agent Deliberative Board Room: Tech_IB, Tech_Candle, RegimeWatcher, OptionsDesk, RiskOfficer
  - Universal Setup Classifier: RANGE_DAY / FAILED_BREAKOUT / TREND_PULLBACK / NO_SETUP
  - Auto-labeling from IB behavior + candle close confirmation
  - Real Fisher diagonal computation replacing torch stub


<!-- live-status:start -->
## Live Status
Generated: `2026-04-17 00:37`  ·  Run `python scripts/update_todo_progress.py --once` to update

```text
Active Backlog    0.0%  [------------------------]
Stage Progress  00/00 complete
Task Counts     done 000 | in progress 000 | blocked 000 | todo 000 | total 000
```

| Section | Tasks | Progress | Status |
|---|---|---:|---|


<!-- live-status:end -->
