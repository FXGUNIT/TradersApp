"""
Feast Data Sources — define where feature data comes from.

Architecture:
  - Offline: Parquet files (generated from SQLite via export script)
    Upgradable to: S3/GCS + Redshift/BigQuery for production
  - Online: Redis (served by custom provider)
  - Streaming: Kafka (real-time candle ingestion via KafkaSource)

For production: export features to Parquet nightly via `scripts/export_features_parquet.py`

Offline Parquet files:
  - candles_features.parquet   — OHLCV + computed features, indexed by (symbol, timestamp)
  - trade_features.parquet    — historical trade features, indexed by (symbol)
  - session_features.parquet  — session aggregate features, indexed by (symbol, date, session_id)
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


# ─── Streaming Source (Kafka — real-time candle ingestion) ─────────────────────

# Consumes from the candle-data topic published by ml-engine/kafka/producer.py.
# Message schema (JSON):
#   {
#     "symbol": "MNQ",
#     "timestamp": "2026-04-04T14:30:00+00:00",
#     "open": 18420.0,
#     "high": 18425.0,
#     "low": 18418.0,
#     "close": 18423.0,
#     "volume": 1234
#   }
#
# Requires Kafka to be deployed (kafka.enabled=true in Helm values).
# The streaming CronJob (k8s/helm/tradersapp/templates/feast.yaml) polls
# this source every 5 minutes and materializes new candles to Redis.
#
# Environment variables:
#   KAFKA_BOOTSTRAP_SERVERS — defaults to "kafka:29092" in-cluster
#                             set "localhost:9092" for local dev
kafka_candle_source = KafkaSource(
    name="kafka_candle_source",
    kafka_bootstrap_server="${KAFKA_BOOTSTRAP_SERVERS:kafka:29092}",
    topic="candle-data",
    timestamp_field="timestamp",
    batch_source=candles_parquet_source,
    # Helm bootstraps topics declaratively; local dev still relies on auto-create.
    message_format="json",
)
