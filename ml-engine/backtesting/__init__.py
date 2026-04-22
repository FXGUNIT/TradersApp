"""
Event-driven backtesting scaffolding for the ML engine.

This package is intentionally lightweight. It provides an NSE session-aware
loop and a small strategy API without wiring itself into live inference or
training paths.
"""

from .rig import (
    BacktestMetrics,
    BacktestResult,
    EventDrivenBacktestRig,
    FillEvent,
    KerncStyleStrategy,
    MarketBar,
    OrderRequest,
    PositionState,
    StrategyContext,
    TradeRecord,
)

__all__ = [
    "BacktestMetrics",
    "BacktestResult",
    "EventDrivenBacktestRig",
    "FillEvent",
    "KerncStyleStrategy",
    "MarketBar",
    "OrderRequest",
    "PositionState",
    "StrategyContext",
    "TradeRecord",
]
