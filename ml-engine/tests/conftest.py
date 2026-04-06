"""
Shared pytest fixtures for ml-engine tests.
Provides consistent mock/test data across all test files.
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path
from typing import Generator

import numpy as np
import pandas as pd
import pytest

# Add ml-engine to path (conftest.py is at ml-engine/tests/conftest.py → 2 levels up)
ML_ENGINE_ROOT = Path(__file__).parent.parent
if str(ML_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ENGINE_ROOT))


# ─── Database Fixtures ─────────────────────────────────────────────────────────

@pytest.fixture
def tmp_db_path() -> Generator[str, None, None]:
    """Provide a temporary database path, cleaned up after test."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    try:
        os.unlink(path)
    except OSError:
        pass


@pytest.fixture
def temp_db(tmp_db_path):
    """Provide an initialized CandleDatabase backed by a temp SQLite file."""
    from data.candle_db import CandleDatabase
    db = CandleDatabase(tmp_db_path)
    yield db
    try:
        db._get_conn().close()
    except Exception:
        pass


# ─── Candle Fixtures ─────────────────────────────────────────────────────────

@pytest.fixture
def sample_candles() -> pd.DataFrame:
    """200 realistic 5-min ES futures candles for testing."""
    np.random.seed(42)
    dates = pd.date_range("2026-03-01 09:30", periods=200, freq="5min", tz="America/New_York")
    close = 18500 + np.cumsum(np.random.randn(200) * 5)
    high = close + np.abs(np.random.randn(200) * 2)
    low = close - np.abs(np.random.randn(200) * 2)
    open_p = close + np.random.randn(200) * 1
    volume = np.random.randint(5000, 50000, 200)
    return pd.DataFrame({
        "timestamp": dates,
        "open": open_p,
        "high": high,
        "low": low,
        "close": close,
        "volume": volume,
    })


@pytest.fixture
def small_candles() -> pd.DataFrame:
    """30 candles for fast smoke tests."""
    np.random.seed(99)
    dates = pd.date_range("2026-03-03 09:30", periods=30, freq="5min", tz="America/New_York")
    close = 18500 + np.cumsum(np.random.randn(30) * 5)
    return pd.DataFrame({
        "timestamp": dates,
        "open": close + np.random.randn(30),
        "high": close + np.abs(np.random.randn(30) * 2),
        "low": close - np.abs(np.random.randn(30) * 2),
        "close": close,
        "volume": np.random.randint(1000, 10000, 30),
    })


# ─── Trade Log Fixtures ─────────────────────────────────────────────────────

@pytest.fixture
def sample_trades() -> pd.DataFrame:
    """50 synthetic trades for testing."""
    np.random.seed(42)
    now = pd.Timestamp.now(tz="UTC")
    trades = []
    for i in range(50):
        entry = now - pd.Timedelta(minutes=(50 - i) * 30)
        exit_ = entry + pd.Timedelta(minutes=np.random.randint(5, 60))
        pnl_ticks = np.random.randn() * 10
        trades.append({
            "symbol": "MNQ",
            "direction": "LONG" if i % 2 == 0 else "SHORT",
            "entry_time": entry.isoformat(),
            "exit_time": exit_.isoformat(),
            "entry_price": 18500.0 + np.random.randn() * 5,
            "exit_price": 18500.0 + np.random.randn() * 5 + pnl_ticks,
            "pnl_ticks": pnl_ticks,
            "pnl_dollars": round(pnl_ticks * 5.0, 2),
            "result": "win" if pnl_ticks > 0 else "loss",
            "confidence": round(np.random.uniform(0.52, 0.88), 2),
            "session_id": 1,
        })
    return pd.DataFrame(trades)


@pytest.fixture
def winning_trades() -> pd.DataFrame:
    """20 winning trades (all result=win)."""
    np.random.seed(7)
    now = pd.Timestamp.now(tz="UTC")
    trades = []
    for i in range(20):
        entry = now - pd.Timedelta(minutes=(20 - i) * 20)
        exit_ = entry + pd.Timedelta(minutes=15)
        pnl_ticks = np.random.uniform(5, 25)
        trades.append({
            "symbol": "MNQ",
            "direction": "LONG",
            "entry_time": entry.isoformat(),
            "exit_time": exit_.isoformat(),
            "entry_price": 18500.0,
            "exit_price": 18500.0 + pnl_ticks,
            "pnl_ticks": pnl_ticks,
            "pnl_dollars": round(pnl_ticks * 5.0, 2),
            "result": "win",
            "confidence": round(np.random.uniform(0.6, 0.9), 2),
            "session_id": 1,
        })
    return pd.DataFrame(trades)


# ─── Feature Fixtures ────────────────────────────────────────────────────────

@pytest.fixture
def sample_feature_df(sample_candles, sample_trades) -> pd.DataFrame:
    """Engineered features from sample candles and trades."""
    from features.feature_pipeline import engineer_features
    return engineer_features(sample_candles, sample_trades, None, None, None)


# ─── Mock External Services ───────────────────────────────────────────────────

@pytest.fixture
def mock_redis(monkeypatch):
    """Mock Redis client that does nothing (always falls back to in-memory)."""
    class MockRedis:
        def get(self, *args, **kwargs):
            return None
        def set(self, *args, **kwargs):
            return True
        def delete(self, *args, **kwargs):
            return 1
        def setex(self, *args, **kwargs):
            return True
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
    try:
        import redis
        monkeypatch.setattr(redis, "Redis", lambda *a, **k: MockRedis())
    except ImportError:
        pass
    return MockRedis()


@pytest.fixture
def mock_mlflow(monkeypatch):
    """Mock MLflow so tests run without a live MLflow server."""
    class MockMLflowRun:
        info = type("obj", (), {"run_id": "mock-run-id"})()

    class MockMlflowClient:
        pass

    class MockMlflow:
        active_run_flag = False

        def set_tracking_uri(self, *a, **k): pass
        def set_experiment(self, *a, **k): pass
        def start_run(self, *a, **k): return MockMLflowRun()
        def end_run(self, *a, **k): pass
        def active_run(self): return MockMLflowRun() if self.active_run_flag else None
        def log_param(self, *a, **k): pass
        def log_metric(self, *a, **k): pass
        def set_tag(self, *a, **k): pass
        def log_artifact(self, *a, **k): pass
        def sklearn(self): return type("obj", (), {"autolog": lambda **k: None, "log_model": lambda **k: None})()

    import mlflow
    monkeypatch.setattr(mlflow, "sklearn", MockMLflow())
    return MockMLflow()


# ─── Prometheus / Monitoring Fixtures ───────────────────────────────────────

@pytest.fixture
def mock_prometheus(monkeypatch, tmp_path):
    """Mock prometheus_client so tests run without a live Prometheus server."""
    try:
        from prometheus_client import CollectorRegistry
        mock_registry = CollectorRegistry()
        monkeypatch.setattr("infrastructure.prometheus_exporter.DEFAULT_REGISTRY", mock_registry)
        monkeypatch.setattr("infrastructure.model_monitor.PROMETHEUS_SYNC_AVAILABLE", True)
    except ImportError:
        pass


# ─── Drift Monitor Fixtures ─────────────────────────────────────────────────

@pytest.fixture
def drift_monitor():
    """Pre-configured DriftMonitor with baseline established."""
    from infrastructure.drift_detector import DriftMonitor
    monitor = DriftMonitor()
    # Set up a minimal baseline
    return monitor


# ─── Candle DB Fixtures ─────────────────────────────────────────────────────

@pytest.fixture
def seeded_db(temp_db, sample_candles, sample_trades):
    """Database pre-populated with sample candles and trades."""
    temp_db.insert_candles_df(sample_candles, "MNQ", "5min")
    for _, row in sample_trades.iterrows():
        temp_db.insert_trade(row.to_dict())
def pytest_runtest_teardown(item, nextitem):
    """After test_regime_ensemble.py teardown, clear mock regime modules from sys.modules.

    test_regime_ensemble.py uses sys.modules mocking to inject fake regime model classes.
    These mock entries must be removed before test_phase1.py runs (alphabetically after),
    otherwise phase1 regime tests get the mock classes with empty train() returns.
    """
    import sys
    if item.fspath.basename == "test_regime_ensemble.py":
        if nextitem and nextitem.fspath.basename == "test_phase1.py":
            for key in list(sys.modules.keys()):
                if key in (
                    "models.regime.hmm_regime",
                    "models.regime.fp_fk_regime",
                    "models.regime.anomalous_diffusion",
                ):
                    del sys.modules[key]
            print(f"[CONFTEST] Cleaned mock regime modules, nextitem={nextitem.fspath.basename}")
