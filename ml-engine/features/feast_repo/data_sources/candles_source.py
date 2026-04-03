"""
Feast Data Sources — define where feature data comes from.

Architecture:
  - Offline: Parquet files (generated from SQLite via export script)
    Upgradable to: S3/GCS + Redshift/BigQuery for production
  - Online: Redis (served by custom provider)

For production: export features to Parquet nightly via `scripts/export_features_parquet.py`

Offline Parquet files:
  - candles_features.parquet   — OHLCV + computed features, indexed by (symbol, timestamp)
  - trade_features.parquet    — historical trade features, indexed by (symbol)
  - session_features.parquet   — session aggregate features, indexed by (symbol, date, session_id)
"""

from feast import FileSource, KafkaSource
from pathlib import Path

# ─── Offline Parquet Sources ─────────────────────────────────────────────────────

FEATURES_DIR = Path(__file__).parent.parent.parent.parent.parent / "data" / "feast_features"
FEATURES_DIR.mkdir(parents=True, exist_ok=True)

# Candle features: OHLCV + technical indicators, indexed by (symbol, timestamp)
candles_parquet_source = FileSource(
    name="candles_parquet_source",
    path=str(FEATURES_DIR / "candles_features.parquet"),
    timestamp_field="timestamp",
    created_timestamp_column="created_at",
)

# Historical trade features: rolling win rate, expectancy, indexed by (symbol)
trade_log_parquet_source = FileSource(
    name="trade_log_parquet_source",
    path=str(FEATURES_DIR / "trade_features.parquet"),
    timestamp_field="entry_time",
    created_timestamp_column="created_at",
)

# Session aggregate features: gap, range, volume, indexed by (symbol, trade_date, session_id)
session_agg_parquet_source = FileSource(
    name="session_agg_parquet_source",
    path=str(FEATURES_DIR / "session_features.parquet"),
    timestamp_field="trade_date",
    created_timestamp_column="created_at",
)


# ─── Streaming Source (optional — for real-time candles) ───────────────────────

# Kafka source for real-time candle streaming (when Kafka is deployed)
# Uncomment when Kafka is set up (Phase 3)
# kafka_candle_source = KafkaSource(
#     name="kafka_candle_source",
#     kafka_bootstrap_server="${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}",
#     topic="candle-data",
#     timestamp_field="timestamp",
#     batch_source=candles_parquet_source,
# )
