"""
Feast Feature Store — TradersApp ML Engine

Centralized, versioned feature access for training and inference.

Architecture:
  - Feature views: candle_features, historical_features, session_features
  - Entities: symbol
  - Offline store: SQLite → Parquet export (for production: S3 + Redshift/BigQuery)
  - Online store: Redis
  - Registry: local filesystem (feast_repo/.registry)

Usage:
  1. Register:       feast apply
  2. Materialize:   python scripts/export_features_parquet.py && feast materialize
  3. Retrieve:      from ml_engine.features.feast_repo import get_features
                       features = get_features(symbol="MNQ", lookback="7d")

Imports all feature views and entities for Feast registration.
"""

from ml_engine.features.feast_repo.entities.symbol_entity import symbol
from ml_engine.features.feast_repo.feature_views.candle_features import candle_features
from ml_engine.features.feast_repo.feature_views.historical_features import historical_features
from ml_engine.features.feast_repo.feature_views.session_features import session_features

__all__ = [
    "symbol",
    "candle_features",
    "historical_features",
    "session_features",
]
