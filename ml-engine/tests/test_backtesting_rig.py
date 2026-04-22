from __future__ import annotations

from datetime import datetime

import pandas as pd

from backtesting import EventDrivenBacktestRig, KerncStyleStrategy


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "timestamp": datetime(2026, 4, 22, 9, 15),
                "open": 22010.0,
                "high": 22018.0,
                "low": 22005.0,
                "close": 22016.0,
                "volume": 1400,
                "symbol": "NIFTY",
            },
            {
                "timestamp": datetime(2026, 4, 22, 9, 20),
                "open": 22016.0,
                "high": 22030.0,
                "low": 22014.0,
                "close": 22028.0,
                "volume": 1550,
                "symbol": "NIFTY",
            },
            {
                "timestamp": datetime(2026, 4, 22, 15, 32),
                "open": 22028.0,
                "high": 22034.0,
                "low": 22018.0,
                "close": 22020.0,
                "volume": 980,
                "symbol": "NIFTY",
            },
        ]
    )


class BuyOnceStrategy(KerncStyleStrategy):
    def next(self):
        if len(self.data) == 1 and not self.position:
            self.buy(size=1.0, tag="open-drive")


def test_backtesting_frame_is_shaped_for_backtesting_py():
    rig = EventDrivenBacktestRig.from_dataframe(_sample_frame(), symbol="NIFTY")

    frame = rig.to_backtesting_frame()

    assert list(frame.columns) == ["Open", "High", "Low", "Close", "Volume"]
    assert len(frame) == 3


def test_event_driven_rig_flattens_at_session_end():
    rig = EventDrivenBacktestRig.from_dataframe(_sample_frame(), symbol="NIFTY")

    result = rig.run(BuyOnceStrategy)

    assert result.symbol == "NIFTY"
    assert result.metrics.closed_trades == 1
    assert result.trades[0].exit_tag == "session_end"
    assert result.session_counts["main_trading"] >= 2
