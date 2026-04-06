import os
import time
from contextlib import contextmanager
from types import SimpleNamespace

import pandas as pd

from infrastructure import model_monitor


class _FakeCursor:
    def __init__(self, count: int):
        self._count = count

    def fetchone(self):
        return (self._count,)


class _FakeConnection:
    def __init__(self, count: int):
        self._count = count

    def execute(self, query, params):
        return _FakeCursor(self._count)


class _FakeDB:
    def __init__(self, trades_df, candles_df, last_training=None, new_trades_count=0):
        self._trades_df = trades_df
        self._candles_df = candles_df
        self._last_training = last_training
        self._new_trades_count = new_trades_count

    def get_trade_log(self, limit=500, symbol="MNQ"):
        return self._trades_df.head(limit).copy()

    def get_candles(self, start, end, symbol="MNQ", limit=5000):
        return self._candles_df.head(limit).copy()

    def get_last_training(self, model_name):
        return self._last_training

    @contextmanager
    def conn(self):
        yield _FakeConnection(self._new_trades_count)


class _FakeFeatureDrift:
    def __init__(self):
        self._baselines = {}

    def update_baseline(self, features_df, trades_df):
        self._baselines["feature_a"] = list(features_df["feature_a"].values)


class _FakeConceptDrift:
    def __init__(self):
        self._baseline_win_rate = None

    def detect(self):
        return {"status": "ok", "baseline_win_rate": 0.62, "current_win_rate": 0.58, "win_rate_drop_pct": 0.0645}

    def set_baseline(self, trades_df):
        self._baseline_win_rate = 0.62


class _FakeRegimeDrift:
    def detect(self):
        return {"status": "ok"}


class _FakeDriftMonitor:
    def __init__(self, result):
        self.thresholds = SimpleNamespace(min_baseline_trades=50)
        self.feature_drift = _FakeFeatureDrift()
        self.concept_drift = _FakeConceptDrift()
        self.regime_drift = _FakeRegimeDrift()
        self._result = result

    def check_all(self, features_df=None, trades_df=None):
        return self._result


class _FakeSLAMonitor:
    def get_sla_report(self, endpoint):
        if endpoint == "/predict":
            return {"p50_ms": 12.0, "p95_ms": 42.0, "p99_ms": 80.0}
        return {"p50_ms": 10.0, "p95_ms": 35.0, "p99_ms": 70.0}


class _FakeMLflowClient:
    def get_tracking_overview(self):
        return {"available": True, "experiments": 3, "active_runs": 1}

    def get_registry_models(self, prefix):
        return {
            "direction_lightgbm": [
                {
                    "version": "7",
                    "stage": "Production",
                    "run_id": "run-123",
                    "created": (time.time() - 3600) * 1000,
                }
            ]
        }


def _sample_trades(count: int) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "entry_time": pd.date_range("2026-01-01", periods=count, freq="h").astype(str),
            "exit_time": pd.date_range("2026-01-01", periods=count, freq="h").astype(str),
            "result": ["win" if i % 2 == 0 else "loss" for i in range(count)],
        }
    )


def _sample_candles(count: int) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "timestamp": pd.date_range("2026-01-01", periods=count, freq="5min"),
            "open": [100.0 + i for i in range(count)],
            "high": [101.0 + i for i in range(count)],
            "low": [99.0 + i for i in range(count)],
            "close": [100.5 + i for i in range(count)],
            "volume": [1000 + i for i in range(count)],
        }
    )


def test_build_monitoring_snapshot_recommends_retrain_and_syncs_metrics(monkeypatch):
    captured = {"drift": None, "active_runs": None, "experiments": None, "registry": None}
    drift_result = {
        "overall_status": "alert",
        "should_retrain": True,
        "feature_drift": {"status": "alert", "psi_scores": {"feature_a": 0.31}, "drifted_features": ["feature_a"]},
        "concept_drift": {"status": "warning", "baseline_win_rate": 0.62, "current_win_rate": 0.58, "win_rate_drop_pct": 0.0645},
        "regime_drift": {"status": "ok"},
    }
    db = _FakeDB(
        _sample_trades(80),
        _sample_candles(120),
        last_training={"completed_at": "2026-01-01T00:00:00+00:00"},
        new_trades_count=25,
    )
    monitor = _FakeDriftMonitor(drift_result)

    # Clear TTL snapshot cache between tests (avoids stale cached results)
    monkeypatch.setattr(model_monitor, "_snapshot_cache", None)
    monkeypatch.setattr(model_monitor, "engineer_features", lambda candles, trades, *_: pd.DataFrame({"feature_a": [0.1] * len(trades)}))
    monkeypatch.setattr(model_monitor, "get_sla_monitor", lambda: _FakeSLAMonitor())
    monkeypatch.setattr(model_monitor, "MLFLOW_CLIENT_AVAILABLE", True)
    monkeypatch.setattr(model_monitor, "PROMETHEUS_SYNC_AVAILABLE", True)
    monkeypatch.setattr(model_monitor, "get_mlflow_client", lambda experiment: _FakeMLflowClient())
    monkeypatch.setattr(model_monitor, "set_drift_monitoring_snapshot", lambda snapshot: captured.__setitem__("drift", snapshot))
    monkeypatch.setattr(model_monitor, "set_active_runs", lambda count: captured.__setitem__("active_runs", count))
    monkeypatch.setattr(model_monitor, "set_mlflow_experiment_count", lambda count: captured.__setitem__("experiments", count))
    monkeypatch.setattr(model_monitor, "sync_mlflow_registry", lambda registry: captured.__setitem__("registry", registry))

    snapshot = model_monitor.build_monitoring_snapshot(
        db,
        monitor,
        retrain_config=SimpleNamespace(min_trades_before_retrain=20),
        sync_prometheus_metrics=True,
    )

    assert snapshot["retrain"]["recommended"] is True, f"recommended={snapshot['retrain']['recommended']}"
    assert snapshot["sla"]["predict_p95_breached"] is False
    assert snapshot["mlflow"]["registry"]["production_model_count"] == 1
    assert captured["drift"] == drift_result
    assert captured["active_runs"] == 1
    assert captured["experiments"] == 3
    assert "direction_lightgbm" in captured["registry"]


def test_build_monitoring_snapshot_handles_insufficient_trades(monkeypatch):
    db = _FakeDB(_sample_trades(10), _sample_candles(20), last_training=None, new_trades_count=0)
    monitor = _FakeDriftMonitor(
        {
            "overall_status": "ok",
            "should_retrain": False,
            "feature_drift": {"status": "ok", "psi_scores": {}, "drifted_features": []},
            "concept_drift": {"status": "ok"},
            "regime_drift": {"status": "ok"},
        }
    )

    monkeypatch.setattr(model_monitor, "get_sla_monitor", lambda: _FakeSLAMonitor())
    monkeypatch.setattr(model_monitor, "MLFLOW_CLIENT_AVAILABLE", True)
    monkeypatch.setattr(model_monitor, "get_mlflow_client", lambda experiment: _FakeMLflowClient())

    snapshot = model_monitor.build_monitoring_snapshot(
        db,
        monitor,
        retrain_config=SimpleNamespace(min_trades_before_retrain=20),
        sync_prometheus_metrics=False,
    )

    assert snapshot["retrain"]["recommended"] is False
    assert snapshot["drift"]["should_retrain"] is False
    assert "Only 10 closed trades available" in snapshot["drift"]["reason"]
