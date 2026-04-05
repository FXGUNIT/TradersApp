# TradersApp Feature Catalog

**Last Updated:** 2026-04-06
**Owner:** ML Engine Team
**Feature Store:** Feast (`ml-engine/features/feast_repo/`)
**Online Store:** Redis (serves < 10ms)
**Offline Store:** SQLite → Parquet (training pipelines)

---

## Feature View: `candle_features`

**Purpose:** OHLCV + computed technical indicators from 5-minute candles
**Entity:** `symbol`
**Source:** `candles_5min` table (SQLite) → Parquet export → Redis materialization
**Stream Source:** Kafka topic `candle-data`
**TTL:** 24 hours
**Update Frequency:** Every 5 minutes (per candle close)
**Freshness SLA:** < 5 minutes
**Point-in-time Safe:** Yes (all features are backward-looking)

### Feature Schema

| Name | Type | Description | Consumer | Owner |
|------|------|-------------|----------|-------|
| `open` | Float64 | Candle open price | All direction models | Data Ingestion |
| `high` | Float64 | Candle high price | All direction models | Data Ingestion |
| `low` | Float64 | Candle low price | All direction models | Data Ingestion |
| `close` | Float64 | Candle close price | All models | Data Ingestion |
| `volume` | Float64 | Candle volume | Volume-ratio features | Data Ingestion |
| `tr` | Float64 | True Range (H-L, H-PDC, L-PDC) | ATR, volatility models | Feature Pipeline |
| `atr` | Float64 | ATR 14-bar rolling average | Direction, regime models | Feature Pipeline |
| `atr_pct` | Float64 | ATR as % of close price | Regime detection | Feature Pipeline |
| `log_return` | Float64 | ln(close / prev_close) | Momentum, volatility features | Feature Pipeline |
| `intrabar_momentum` | Float64 | close - open | Direction classification | Feature Pipeline |
| `range` | Float64 | high - low | Range-based features | Feature Pipeline |
| `range_pct` | Float64 | range / low | Normalized range | Feature Pipeline |
| `upper_wick_pct` | Float64 | (high - max(open,close)) / range | Candle pattern detection | Feature Pipeline |
| `lower_wick_pct` | Float64 | (min(open,close) - low) / range | Candle pattern detection | Feature Pipeline |
| `rolling_std_10` | Float64 | StdDev of log_return over 10 bars | Direction, regime models | Feature Pipeline |
| `rolling_std_20` | Float64 | StdDev of log_return over 20 bars | Direction, regime models | Feature Pipeline |
| `realized_vol` | Float64 | rolling_std_20 * sqrt(78) annualized | Regime, position sizing | Feature Pipeline |
| `momentum_3bar` | Float64 | Sum of log_return over 3 bars | Short-term momentum | Feature Pipeline |
| `momentum_5bar` | Float64 | Sum of log_return over 5 bars | Medium-term momentum | Feature Pipeline |
| `volume_ratio_5` | Float64 | volume / 5-bar rolling mean volume | Volume anomaly detection | Feature Pipeline |
| `hour_of_day` | Int64 | Eastern Time hour (0-23) | Session probability | MathEngine.js |
| `day_of_week` | Int64 | Monday=0, Sunday=6 | Session probability | MathEngine.js |
| `minutes_into_session` | Int64 | Minutes since session open | Session probability | MathEngine.js |
| `session_pct` | Float64 | 0.0-1.0 position in session | Session probability | MathEngine.js |
| `is_first_30min` | Float64 | 1.0 if within first 30 min of session | Session probability | MathEngine.js |
| `is_last_30min` | Float64 | 1.0 if within last 30 min of session | Session probability | MathEngine.js |
| `is_lunch_hour` | Float64 | 1.0 if 11:30-13:00 ET | Session probability | MathEngine.js |
| `price_to_pdh` | Float64 | (close - PDH) / ATR | Key level proximity | MathEngine.js |
| `price_to_pdl` | Float64 | (PDL - close) / ATR | Key level proximity | MathEngine.js |
| `near_level` | Float64 | 1.0 if within 0.5 ATR of any level | Key level breakout | MathEngine.js |
| `adx` | Float64 | Average Directional Index (14-bar) | Trend strength | MathEngine.js |
| `ci` | Float64 | Commodity Channel Index | Overbought/oversold | MathEngine.js |
| `vwap` | Float64 | Volume-Weighted Average Price | Mean reversion | MathEngine.js |
| `vwap_slope_entry` | Float64 | VWAP slope for entry sizing | Entry timing | MathEngine.js |
| `vr` | Float64 | Volatility Ratio = ATR / rolling_std_10 | Volatility regime | MathEngine.js |
| `sweep_prob` | Float64 | Probability of key level sweep | False breakout detection | MathEngine.js |
| `amd_ACCUMULATION` | Float64 | AMD phase one-hot (1.0 if ACCUMULATION) | Direction classification | AMD Model |
| `amd_MANIPULATION` | Float64 | AMD phase one-hot (1.0 if MANIPULATION) | Direction classification | AMD Model |
| `amd_DISTRIBUTION` | Float64 | AMD phase one-hot (1.0 if DISTRIBUTION) | Direction classification | AMD Model |
| `amd_TRANSITION` | Float64 | AMD phase one-hot (1.0 if TRANSITION) | Direction classification | AMD Model |
| `amd_UNCLEAR` | Float64 | AMD phase one-hot (1.0 if UNCLEAR) | Direction classification | AMD Model |
| `vr_regime` | Int64 | VR-encoded regime: 0=COMPRESSION, 1=NORMAL, 2=EXPANSION | Regime features | Feature Pipeline |

**Total Features:** 44

---

## Feature View: `historical_features`

**Purpose:** Rolling trade statistics from paper trade log
**Entity:** `symbol`
**Source:** `trade_log` table (SQLite) → rolling window SQL → Redis materialization
**TTL:** 30 days (rolling window — older trades not needed online)
**Update Frequency:** Per trade close (appended, not updated in-place)
**Freshness SLA:** < 1 minute after trade close
**Point-in-time Safe:** Yes (merge_asof backward ensures no look-ahead bias)

### Feature Schema

| Name | Type | Description | Consumer | Owner |
|------|------|-------------|----------|-------|
| `win_rate_20` | Float64 | Rolling 20-trade win rate (0.0-1.0) | Direction models | Portfolio Context |
| `win_rate_50` | Float64 | Rolling 50-trade win rate (0.0-1.0) | Direction models | Portfolio Context |
| `expectancy_20` | Float64 | Rolling 20-trade average PnL ($) | Position sizing | Portfolio Context |
| `profit_factor_20` | Float64 | Rolling 20-trade gross wins / gross losses | Direction models | Portfolio Context |
| `amd_win_rate_ACCUMULATION` | Float64 | Historical win rate during ACCUMULATION phase | AMD Classifier | Portfolio Context |
| `amd_win_rate_MANIPULATION` | Float64 | Historical win rate during MANIPULATION phase | AMD Classifier | Portfolio Context |
| `amd_win_rate_DISTRIBUTION` | Float64 | Historical win rate during DISTRIBUTION phase | AMD Classifier | Portfolio Context |
| `amd_win_rate_TRANSITION` | Float64 | Historical win rate during TRANSITION phase | AMD Classifier | Portfolio Context |

**Total Features:** 8

**Computation:**
```sql
-- Rolling 20-trade win rate
SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END)
  OVER (ORDER BY entry_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW)
  / COUNT(*) OVER (ORDER BY entry_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW)
```

---

## Feature View: `session_features`

**Purpose:** Pre-computed session aggregate features (gap, range, volume, direction)
**Entity:** `symbol`
**Source:** `session_aggregates` table (SQLite)
**TTL:** 7 days (old sessions not needed online)
**Update Frequency:** Once per trading session (after session closes)
**Freshness SLA:** < 1 hour after session close
**Point-in-time Safe:** Yes (session data is known at session open)

### Feature Schema

| Name | Type | Description | Consumer | Owner |
|------|------|-------------|----------|-------|
| `direction` | Int64 | Session bias: 1=LONG, -1=SHORT, 0=NEUTRAL | Direction models | Data Ingestion |
| `close_to_open` | Float64 | Session close - session open (absolute ticks) | Direction models | Data Ingestion |
| `gap_pct` | Float64 | Overnight gap as % of prior close | Direction, regime models | Data Ingestion |
| `session_range` | Float64 | Session high - session low | Range-based features | Data Ingestion |
| `range_vs_atr` | Float64 | session_range / ATR | Regime detection | Data Ingestion |
| `gap_fill_pct` | Float64 | How much of the gap has been filled (0.0-1.0) | Gap trading strategies | Data Ingestion |
| `daily_range_used_pct` | Float64 | Cumulative intraday range / (ATR * 14) | ATR-based sizing | Data Ingestion |
| `volume_ratio_sess` | Float64 | Session volume / average session volume | Volume anomaly | Data Ingestion |
| `candle_count` | Int64 | Number of 5-min candles in session | Data quality check | Data Ingestion |

**Total Features:** 9

---

## Feature Lineage

```
Data Sources
    │
    ├── NinjaTrader CSV (manual upload)
    │       └── load_ninjatrader_csv.py
    │               └── candles_5min table (SQLite)
    │                       └── Feature Pipeline (feature_pipeline.py)
    │                               └── candle_features (Feast)
    │
    ├── Kafka Topic: candle-data (live streaming)
    │       └── Streaming materialization CronJob (every 5 min)
    │               └── candle_features (Redis online)
    │
    └── Manual Trade Upload
            └── Trade log (trade_log table)
                    └── Rolling window SQL queries
                            └── historical_features (Feast)
```

---

## Feature Freshness SLAs

| Feature Group | Online Store | Freshness Target | Alert Threshold |
|--------------|-------------|-----------------|-----------------|
| `candle_features` | Redis | < 5 min | > 10 min |
| `historical_features` | Redis | < 1 min | > 5 min |
| `session_features` | Redis | < 1 hour | > 4 hours |

---

## Feature Drift Monitoring

Monitored via `ml-engine/infrastructure/evaluation.py`:

| Drift Type | Detection | Threshold | Action |
|------------|----------|-----------|--------|
| Feature drift (PSI) | Population Stability Index | PSI > 0.2 | Alert + log |
| Concept drift (KL divergence) | KL divergence on label distribution | KL > 0.5 | Trigger retraining |
| Regime drift (Hellinger) | Hellinger distance on regime probabilities | H > 0.3 | Alert |

---

## Usage Examples

### Python: Retrieve online features for inference
```python
from ml_engine.features.feast_client import get_candle_features, get_historical_features

# Online retrieval (< 10ms from Redis)
candle_feats = get_candle_features(symbol="MNQ", timestamp="2026-04-06T09:35:00Z")
historical_feats = get_historical_features(symbol="MNQ", timestamp="2026-04-06T09:35:00Z")

# Merge into single feature dict
features = {**candle_feats, **historical_feats}
```

### Python: Retrieve offline features for training
```python
import pandas as pd
from ml_engine.features.feast_repo.custom_provider import TradersProvider

provider = TradersProvider(config={})
entity_df = pd.DataFrame({
    "symbol": ["MNQ"] * 100,
    "timestamp": pd.date_range("2026-01-01", periods=100, freq="5min"),
})
features_df = provider.pull_latest_from_offline_store(
    feature_views=[candle_features, historical_features],
    entity_df=entity_df,
)
```

### BFF: Via REST endpoint
```javascript
const response = await fetch(`${ML_ENGINE_URL}/features/online?symbol=MNQ&timestamp=${ts}`);
const { candle_features, historical_features } = await response.json();
```

---

## Backfill Guide

To backfill historical features from SQLite to Redis:

```bash
# Option 1: Feast CLI (full backfill)
cd ml-engine/features/feast_repo
feast materialize 2025-01-01T00:00:00Z 2026-04-06T00:00:00Z

# Option 2: Custom script (per symbol)
python -m ml_engine.features.feast_repo.backfill \
    --symbol MNQ \
    --start 2025-01-01 \
    --end 2026-04-06 \
    --batch-size 10000

# Option 3: DVC pipeline (production)
python -m dvc repro feast_export
```

---

## Materialization Validation

After materialization, run:

```bash
python -m ml_engine.features.feast_repo.validate_materialization --check-freshness
```

Checks:
1. Redis key count matches expected row count
2. Feature values are within expected ranges
3. Null ratio < 0.1% for all features
4. Timestamp is recent (< 5 min old for candles)
