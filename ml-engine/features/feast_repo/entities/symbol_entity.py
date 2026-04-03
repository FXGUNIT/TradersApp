"""
Entities — the primary keys for all feature views.

Entity: symbol
  Primary key for all trading features. Combined with timestamp for temporal features.

Usage in Feast:
  feast get-online-features \
    --entity-rows '[{"symbol": "MNQ"}]' \
    --feature-view candle_features \
    --features 'candle_features:close,candle_features:atr'
"""

from feast import Entity, Field
from feast.types import String, Int64
from pydantic import BaseModel


class SymbolEntity(BaseModel):
    """Entity row for feature retrieval."""
    symbol: str = "MNQ"


# ─── Symbol Entity ──────────────────────────────────────────────────────────────

symbol = Entity(
    name="symbol",
    description="Trading symbol (e.g. MNQ, ES)",
    join_keys=["symbol"],
)
