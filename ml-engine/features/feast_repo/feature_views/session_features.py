"""
Session Features FeatureView — pre-computed session aggregate features.

Source: session_aggregates table (via Parquet offline, Redis online)
Entity: symbol + (date, session_id) as timestamp
Update frequency: Once per trading session (after session closes)
Point-in-time safe: Yes (session data is known at session open)
TTL: 7 days (sessions older than a week not needed online)

Features:
  - gap_pct: overnight gap as % of prior close
  - range_vs_atr: session range normalized by ATR
  - volume_ratio_sess: session volume vs average
  - daily_range_used_pct: cumulative intraday range / ATR*14
  - close_to_open: session close vs open direction
"""

from feast import FeatureView, Field
from feast.types import Float64, Int64

from ml_engine.features.feast_repo.data_sources.candles_source import session_agg_parquet_source


# ─── FeatureView ────────────────────────────────────────────────────────────────

session_features = FeatureView(
    name="session_features",
    description="Pre-computed session aggregate features (gap, range, volume, direction)",
    entities=["symbol"],
    ttl_seconds=86400 * 7,  # 7 days — old sessions not needed online
    schema=[
        # Session direction
        Field(name="direction", dtype=Int64),          # 1=LONG bias, -1=SHORT bias
        Field(name="close_to_open", dtype=Float64),    # close - open (absolute)
        Field(name="gap_pct", dtype=Float64),         # overnight gap as % of prior close

        # Session range
        Field(name="session_range", dtype=Float64),    # high - low for the session
        Field(name="range_vs_atr", dtype=Float64),    # session_range / ATR
        Field(name="gap_fill_pct", dtype=Float64),    # proxy for gap fill (0-1)
        Field(name="daily_range_used_pct", dtype=Float64),  # cumulative range / (ATR*14)

        # Volume
        Field(name="volume_ratio_sess", dtype=Float64),  # session volume / avg session volume

        # Candle count
        Field(name="candle_count", dtype=Int64),      # number of 5-min candles in session
    ],
    source=session_agg_parquet_source,
    online=True,
    offline=True,
)
