"""
Candle Features FeatureView — OHLCV + computed technical indicators.

Source: candles_5min table (via Parquet offline, Redis online)
Entity: symbol + timestamp
Update frequency: Every 5 minutes (per candle close)
Point-in-time safe: Yes (all features are backward-looking)

Feature groups:
  - OHLCV raw: open, high, low, close, volume
  - Technical: atr, log_return, intrabar_momentum, range, range_pct
  - Volatility: atr_pct, rolling_std_10/20, realized_vol
  - Momentum: momentum_3bar, momentum_5bar
  - Volume: volume_ratio_5
  - Time: hour_of_day, day_of_week, minutes_into_session, session_pct
  - Key levels: price_to_pdh, price_to_pdl, near_level
  - AMD phase: amd_ACCUMULATION, amd_MANIPULATION, etc.
  - VR regime: vr_regime
"""

from feast import FeatureView, Field, FileSource
from feast.types import Float64, Int64
from feast.infra.offline_stores.parquet_source import ParquetSource

from ml_engine.features.feast_repo.data_sources.candles_source import (
    candles_parquet_source,
    kafka_candle_source,
)

# ─── Source ─────────────────────────────────────────────────────────────────────

# Batch source for offline training (Parquet)
_batch_source = candles_parquet_source

# ─── Streaming Source ───────────────────────────────────────────────────────────
# Enable Kafka streaming once Kafka is deployed.
# Set feast.streaming.enabled=true in Helm values and KAFKA_BOOTSTRAP_SERVERS env var.
# Uncomment the line below once Kafka is running:
# _stream_source = kafka_candle_source
_stream_source = None  # Disabled until Kafka is deployed


# ─── FeatureView ────────────────────────────────────────────────────────────────

candle_features = FeatureView(
    name="candle_features",
    description="OHLCV + computed technical indicators from 5-minute candles",
    entities=["symbol"],
    ttl_seconds=86400,  # 24 hours — re-materialize each trading day
    schema=[
        # OHLCV raw
        Field(name="open", dtype=Float64),
        Field(name="high", dtype=Float64),
        Field(name="low", dtype=Float64),
        Field(name="close", dtype=Float64),
        Field(name="volume", dtype=Float64),

        # Computed candle
        Field(name="tr", dtype=Float64),           # True Range
        Field(name="atr", dtype=Float64),           # ATR 14-bar
        Field(name="atr_pct", dtype=Float64),      # ATR as % of close
        Field(name="log_return", dtype=Float64),   # ln(close / prev_close)
        Field(name="intrabar_momentum", dtype=Float64),  # close - open
        Field(name="range", dtype=Float64),        # high - low
        Field(name="range_pct", dtype=Float64),    # range / low
        Field(name="upper_wick_pct", dtype=Float64),
        Field(name="lower_wick_pct", dtype=Float64),

        # Volatility
        Field(name="rolling_std_10", dtype=Float64),   # std of log_return over 10 bars
        Field(name="rolling_std_20", dtype=Float64),  # std over 20 bars
        Field(name="realized_vol", dtype=Float64),    # annualized: std20 * sqrt(78)

        # Momentum
        Field(name="momentum_3bar", dtype=Float64),
        Field(name="momentum_5bar", dtype=Float64),

        # Volume
        Field(name="volume_ratio_5", dtype=Float64),   # volume / 5-bar rolling mean

        # Time features
        Field(name="hour_of_day", dtype=Int64),       # Eastern Time hour (0-23)
        Field(name="day_of_week", dtype=Int64),       # Monday=0, Sunday=6
        Field(name="minutes_into_session", dtype=Int64),
        Field(name="session_pct", dtype=Float64),      # 0.0-1.0 position in session
        Field(name="is_first_30min", dtype=Float64),  # 1.0 if within first 30 min
        Field(name="is_last_30min", dtype=Float64),   # 1.0 if last 30 min of main session
        Field(name="is_lunch_hour", dtype=Float64),   # 1.0 if 11:30-13:00 ET

        # Key level features
        Field(name="price_to_pdh", dtype=Float64),    # (close - PDH) / ATR
        Field(name="price_to_pdl", dtype=Float64),    # (PDL - close) / ATR
        Field(name="near_level", dtype=Float64),       # 1 if within 0.5 ATR of any level

        # MathEngine / regime features (broadcast from snapshot)
        Field(name="adx", dtype=Float64),
        Field(name="ci", dtype=Float64),
        Field(name="vwap", dtype=Float64),
        Field(name="vwap_slope_entry", dtype=Float64),
        Field(name="vr", dtype=Float64),              # Volatility Ratio
        Field(name="sweep_prob", dtype=Float64),

        # AMD one-hot
        Field(name="amd_ACCUMULATION", dtype=Float64),
        Field(name="amd_MANIPULATION", dtype=Float64),
        Field(name="amd_DISTRIBUTION", dtype=Float64),
        Field(name="amd_TRANSITION", dtype=Float64),
        Field(name="amd_UNCLEAR", dtype=Float64),

        # VR regime encoding
        Field(name="vr_regime", dtype=Int64),  # 0=Compression, 1=Normal, 2=Expansion
        Field(name="volatility_regime", dtype=Int64),  # VR-encoded regime
    ],
    source=_batch_source,
    stream_source=_stream_source,  # Enable KafkaSource once deployed
    online=True,
    offline=True,
)
