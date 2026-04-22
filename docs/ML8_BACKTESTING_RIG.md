# ML8 Backtesting Rig

`ML8` now has a real scaffold in [rig.py](/e:/TradersApp/ml-engine/backtesting/rig.py). It is intentionally lightweight and session-aware rather than a full execution simulator.

## Current Scope

- normalizes OHLCV input into an NSE-aware event stream
- classifies each bar into `pre_market`, `main_trading`, `post_market`, or `closed`
- supports callback strategies and a small `backtesting.py`-style class API
- closes positions at session boundaries by default
- exposes `to_backtesting_frame()` for later parity work with `kernc/backtesting`

## Usage

```python
import pandas as pd

from backtesting import EventDrivenBacktestRig, KerncStyleStrategy


class BuyOpenDrive(KerncStyleStrategy):
    def next(self):
        if len(self.data) == 1 and not self.position:
            self.buy(size=1.0, tag="open-drive")


frame = pd.read_csv("nifty_5m.csv")
rig = EventDrivenBacktestRig.from_dataframe(frame, symbol="NIFTY")
result = rig.run(BuyOpenDrive)
print(result.metrics)
```

## Verification

- [test_backtesting_rig.py](/e:/TradersApp/ml-engine/tests/test_backtesting_rig.py) covers frame shaping and session-end flattening.
- The rig still avoids a hard runtime dependency on the external `backtesting` package, but the data shape and strategy surface are compatible enough for later integration work.
