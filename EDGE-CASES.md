# TradersApp — Edge Cases & Market Scenario Registry

**Last Updated:** 2026-04-02
**Purpose:** Every known market edge case that MUST be handled by any code touching execution or data.

---

## TRADING SESSION EDGE CASES

### Market Hours
- [ ] **Pre-market gap** — Price opens with a gap > 2x ATR. Models trained on continuous data may misfire. Session probability should cap confidence.
- [ ] **Post-market data** — ETH/GLOBEX session candles may be sparse. Detect and flag insufficient data.
- [ ] **Holiday trading** — Reduced volume, wider spreads. Session edge calculations must account for thin markets.
- [ ] **Early close days** (e.g., day before Thanksgiving) — Shorter RTH session, model must not assume full 6.5h session.
- [ ] **Triple witching / options expiry** — High volatility, anomalous volume. Regime detector should upweight anomaly sensitivity.
- [ ] **First trading day of month** — Month-end portfolio rebalancing effects. May cause momentum anomalies.

### Data Quality
- [ ] **Missing candles** — Network gap or data provider downtime. Must not interpolate silently. Flag and use previous valid state.
- [ ] **Stale data** — Candle older than MAX_CANDLE_AGE_HOURS. Do not use for prediction, warn user.
- [ ] **Out-of-order ticks** — High/low/close violate OHLC logic. Reject candle, log anomaly.
- [ ] **Duplicate candles** — Same timestamp appears twice. Deduplicate, keep latest.
- [ ] **Partial candle** — Current candle not yet closed. Never use unclosed candle for model input.

---

## REGIME EDGE CASES

### Volatility Regimes
- [ ] **Volatility crush** — VIX drops > 50% in one day. HMM may misclassify. Use wider bands.
- [ ] **Flash crash** — Violent intraday move > 5 ATR. Anomalous diffusion model should flag as high-risk regime.
- [ ] **Slow grind** — 30+ days of low volatility. HMM may stay in "low vol" forever. FP-FK should detect gradual buildup.
- [ ] **Spike vol** — Single big candle in otherwise quiet market. Detect and treat as anomaly, not new regime.
- [ ] **Regime change during a trade** — Open position encounters regime shift. Exit rules must re-evaluate on regime change.

### Model-Specific
- [ ] **HMM underfitting** — Fewer than 500 training samples. Fall back to rule-based regime detection.
- [ ] **Anomalous diffusion divergence** — Model predicts mean-reversion but price keeps trending. Cap alpha contribution.
- [ ] **Mamba SSM cold start** — Less than 100 candles. Use simpler models only, no Mamba.
- [ ] **Ensemble disagreement** — 3+ models disagree on direction. Output NEUTRAL, increase confidence threshold.

---

## SIGNAL & EXECUTION EDGE CASES

### Consensus
- [ ] **All models agree** — 6/6 LONG/SHORT. Max confidence (0.95). Flag as strong consensus.
- [ ] **Split vote (3-3)** — Dead tie. Output NEUTRAL. Do not fabricate direction.
- [ ] **One model dissent** — 5/6 agree. Cap confidence at 0.85, note dissenting model.
- [ ] **Confidence < 0.5** — Output NEUTRAL regardless of direction vote.
- [ ] **New regime during consensus** — Recalculate immediately, do not use stale regime.
- [ ] **Session probability < 0.5** — Reduce direction confidence by 50%, flag as reduced-conviction signal.

### Exit Strategy
- [ ] **No recent high** — ATR-based stop may be inside spread. Use minimum of 1.5x ATR.
- [ ] **Trailing stop in chop** — Price whipsaws in tight range. Trail only after 2x ATR move in favor.
- [ ] **Target reached but regime weakening** — Partial exit recommended, don't hold to ideal target.
- [ ] **Breakeven too tight** — Breakeven move < 0.5 ATR. Skip breakeven move, keep original stop.

### Position Sizing
- [ ] **Account balance < $1000** — Cap position at 10% of account (no more than $100 at risk).
- [ ] **Volatility explosion** — Current ATR > 2x session average ATR. Reduce size by 50%.
- [ ] **Consecutive losses** — 3+ losses in a row. Cap max position size at 50% of normal.
- [ ] **Large account (> $100k)** — Use fixed fractional, not fixed lot. Limit single position to 5% of equity.

---

## NEWS & SENTIMENT EDGE CASES

- [ ] **News during closed market** — Queue for next session open, don't act on overnight news immediately.
- [ ] **Contradictory news** — Bullish and bearish news within 1 hour. Neutral sentiment, weight toward technicals.
- [ ] **Breaking news with no historical context** — Model uncertainty high. Cap sentiment weight at 10%.
- [ ] **Social media / Reddit pump** — Not captured by Finnhub. Flag as unmodeled variable, reduce confidence.
- [ ] **Delayed news** — News timestamp > 30 min old. Degrade relevance score to 0.5x.

---

## ML MODEL EDGE CASES

- [ ] **Prediction on training data** — Sanity check: never call predict() on data that was in train set.
- [ ] **Feature values outside training range** — Extrapolation risk. Cap features at training min/max.
- [ ] **NaN in features** — Any NaN propagates to prediction. Return NEUTRAL, log error.
- [ ] **Model not trained yet** — No model weights on disk. Return NEUTRAL, warn user.
- [ ] **Model file corrupted** — Loading fails. Return NEUTRAL, log FATAL.
- [ ] **Class imbalance** — > 80% same direction in training labels. Apply class weights, flag in metadata.
- [ ] **Look-ahead bias** — Any feature that uses future data (e.g., close of current candle). Strictly forbidden.

---

## DEPLOYMENT EDGE CASES

- [ ] **ML Engine down** — BFF returns stale cached response with age warning. Never hallucinate a signal.
- [ ] **Database locked** — Concurrent write attempt. Retry 3x with exponential backoff, then fail gracefully.
- [ ] **Memory pressure on Railway** — ML models loaded lazily, unloaded after 5 min inactivity.
- [ ] **Cold start latency** — First request after idle may take 10+ seconds. Pre-warm on schedule if needed.
- [ ] **Infisical unreachable** — Fail open with last known config, log critical error.
- [ ] **Git push during active session** — Warn user, do not auto-merge.

---

## ⚠️ BEFORE ANY CODE TOUCHING DATA, EXECUTION, OR RISK:

1. Review this file
2. Check if new edge case applies
3. If new case found: add to this file FIRST, then implement
4. Paste relevant sections into every prompt about data/risk/execution
