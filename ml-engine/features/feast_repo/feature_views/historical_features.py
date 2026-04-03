"""
Historical Features FeatureView — rolling trade statistics from trade_log.

Source: trade_log table (via Parquet offline, Redis online)
Entity: symbol
Update frequency: Per trade close (appended, not updated)
Point-in-time safe: Yes (merge_asof backward ensures no look-ahead)
TTL: 30 days (rolling window features, older data not needed online)

Features:
  - win_rate_20: rolling 20-trade win rate
  - win_rate_50: rolling 50-trade win rate
  - expectancy_20: rolling 20-trade average PnL in dollars
  - profit_factor_20: rolling 20-trade gross wins / gross losses
  - amd_win_rate_*: historical win rate per AMD phase (scalar broadcast)
"""

from feast import FeatureView, Field
from feast.types import Float64

from ml_engine.features.feast_repo.data_sources.candles_source import trade_log_parquet_source


# ─── FeatureView ────────────────────────────────────────────────────────────────

historical_features = FeatureView(
    name="historical_features",
    description="Rolling trade statistics from the paper trade log",
    entities=["symbol"],
    ttl_seconds=86400 * 30,  # 30 days — older trades not needed for online inference
    schema=[
        # Rolling performance metrics
        Field(name="win_rate_20", dtype=Float64),
        Field(name="win_rate_50", dtype=Float64),
        Field(name="expectancy_20", dtype=Float64),     # avg PnL per trade (dollars)
        Field(name="profit_factor_20", dtype=Float64),  # gross wins / gross losses

        # AMD phase win rates (historical, not rolling — same for all timestamps)
        Field(name="amd_win_rate_ACCUMULATION", dtype=Float64),
        Field(name="amd_win_rate_MANIPULATION", dtype=Float64),
        Field(name="amd_win_rate_DISTRIBUTION", dtype=Float64),
        Field(name="amd_win_rate_TRANSITION", dtype=Float64),
    ],
    source=trade_log_parquet_source,
    online=True,
    offline=True,
)
