"""
Chaos engineering fixtures for TradersApp ML Engine fault injection tests.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Generator

import numpy as np
import pandas as pd
import pytest

ML_ENGINE = Path(__file__).parent.parent / "ml-engine"
sys.path.insert(0, str(ML_ENGINE))


@pytest.fixture
def chaos_enabled():
    """Check if chaos testing is enabled (via environment variable)."""
    return os.environ.get("CHAOS_ENABLED", "false").lower() in ("true", "1", "yes")


@pytest.fixture
def ml_engine_client():
    """HTTP client for ML Engine with timeout support."""
    import httpx
    base_url = os.environ.get("ML_ENGINE_URL", "http://localhost:8001")
    client = httpx.Client(base_url=base_url, timeout=10.0)
    yield client
    client.close()


@pytest.fixture
def bff_client():
    """HTTP client for BFF with timeout support."""
    import httpx
    base_url = os.environ.get("BFF_URL", "http://localhost:8788")
    client = httpx.Client(base_url=base_url, timeout=10.0)
    yield client
    client.close()


@pytest.fixture
def synthetic_candles():
    """Generate deterministic synthetic candles for reproducible chaos tests."""
    np.random.seed(123)
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    candles = []
    base_price = 18500.0
    for i in range(20):
        candles.append({
            "symbol": "MNQ",
            "timestamp": str(int(now.timestamp() - (20 - i) * 300)),
            "open": round(base_price + np.random.randn() * 3, 2),
            "high": round(base_price + np.abs(np.random.randn() * 3) + 2, 2),
            "low": round(base_price - np.abs(np.random.randn() * 3) - 2, 2),
            "close": round(base_price + np.random.randn() * 3, 2),
            "volume": int(np.random.randint(1000, 10000)),
        })
        base_price = candles[-1]["close"]
    return candles


@pytest.fixture
def synthetic_trades():
    """Generate deterministic synthetic trades for reproducible chaos tests."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    trades = []
    for i in range(10):
        entry_ts = int((now.timestamp() - (10 - i) * 600))
        exit_ts = int(entry_ts + np.random.randint(300, 1800))
        pnl = round(np.random.uniform(-15, 25), 2)
        trades.append({
            "symbol": "MNQ",
            "direction": "LONG" if i % 2 == 0 else "SHORT",
            "entry_time": entry_ts,
            "exit_time": exit_ts,
            "pnl_ticks": pnl,
            "pnl_dollars": round(pnl * 5.0, 2),
            "result": "win" if pnl > 0 else "loss",
            "confidence": round(np.random.uniform(0.55, 0.88), 2),
        })
    return trades
