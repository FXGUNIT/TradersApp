from __future__ import annotations

from copy import deepcopy

import pandas as pd
from fastapi import FastAPI
from fastapi.testclient import TestClient

from infrastructure.idempotency import IdempotencyService

import _infrastructure
import _routes_workflow


class FakePipeline:
    def __init__(self, client: "FakeRedis") -> None:
        self.client = client
        self.ops: list[tuple[str, str, object | None]] = []

    def setex(self, key: str, ttl_seconds: int, value: str):
        self.ops.append(("setex", key, value))
        return self

    def delete(self, key: str):
        self.ops.append(("delete", key, None))
        return self

    def execute(self):
        for op, key, value in self.ops:
            if op == "setex":
                self.client.store[key] = value
            elif op == "delete":
                self.client.store.pop(key, None)
        self.ops.clear()
        return True


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, object] = {}

    def get(self, key: str):
        return self.store.get(key)

    def set(self, key: str, value: object, nx: bool = False, ex: int | None = None):
        if nx and key in self.store:
            return False
        self.store[key] = value
        return True

    def delete(self, key: str):
        self.store.pop(key, None)
        return 1

    def pipeline(self):
        return FakePipeline(self)


class FakeCache:
    def __init__(self) -> None:
        self.store: dict[str, dict] = {}

    def get(self, key: str):
        value = self.store.get(key)
        return deepcopy(value) if value is not None else None

    def set(self, key: str, value: dict, ttl: int = 0):
        self.store[key] = deepcopy(value)
        return True

    def delete(self, key: str):
        self.store.pop(key, None)
        return 1

    def delete_pattern(self, pattern: str):
        return 0


class FakeSlaMonitor:
    def record(self, *args, **kwargs) -> None:
        return None


class FakeTrainer:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def train_direction_models(self, *, mode: str, symbol: str, min_trades: int, verbose: bool):
        self.calls.append(
            {
                "mode": mode,
                "symbol": symbol,
                "min_trades": min_trades,
                "verbose": verbose,
            }
        )
        return {
            "status": "trained",
            "mode": mode,
            "symbol": symbol,
            "min_trades": min_trades,
        }


class FakeStore:
    def load_meta(self, name: str, version: str):
        return {"name": name, "version": version}


class FakeConsensusAggregator:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def aggregate(self, **kwargs):
        self.calls.append(kwargs)
        consensus = kwargs["consensus"]
        votes = kwargs["votes"]
        return {
            "votes": votes,
            "consensus": consensus,
            "signal": consensus.get("signal", "LONG"),
            "confidence": consensus.get("confidence", 0.91),
            "long_score": 0.91,
            "short_score": 0.09,
            "models_used": len(votes) or 1,
        }


class FakeModelRegistryClient:
    def __init__(self) -> None:
        self.predict_calls = 0
        self.advance_calls = 0
        self.invalidate_calls: list[list[str]] = []
        self.warm_calls: list[list[str]] = []

    def predict(self, candles_df, trade_log_df=None, math_engine_snapshot=None, key_levels=None):
        self.predict_calls += 1
        return {
            "votes": {"direction": {"signal": "LONG", "confidence": 0.91}},
            "consensus": {"signal": "LONG", "confidence": 0.91},
        }

    def advance_regime(self, feature_df):
        self.advance_calls += 1
        return {
            "regime": "NORMAL",
            "regime_id": 1,
            "regime_confidence": 0.73,
            "regime_posteriors": {"NORMAL": 0.73},
            "fp_fk": {
                "q_parameter": 1.1,
                "fk_wave_speed": 0.2,
                "fk_wave_acceleration": 0.01,
                "criticality_index": 0.05,
                "front_direction": "STABLE",
                "explanation": "stable",
            },
            "anomalous_diffusion": {
                "hurst_H": 0.5,
                "diffusion_type": "NORMAL",
                "vol_clustering": "MODERATE",
            },
            "deleverage_signal": 0.0,
            "deleverage_reason": "none",
            "stop_multiplier": 1.0,
            "position_adjustment": 0.0,
            "signal_adjustment": "BALANCED",
            "explanation": "stable",
        }

    def invalidate(self, names: list[str]):
        self.invalidate_calls.append(list(names))

    def warm_models(self, names: list[str]):
        self.warm_calls.append(list(names))
        return {"predictor": {"loaded_model_count": 1}}


def build_predict_candles() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "timestamp": f"2026-04-10T09:{30 + idx:02d}:00Z",
                "open": 18500.0 + idx,
                "high": 18501.0 + idx,
                "low": 18499.0 + idx,
                "close": 18500.5 + idx,
                "volume": 1000 + idx,
            }
            for idx in range(20)
        ]
    )


def build_test_app(monkeypatch, *, cache: FakeCache, registry: FakeModelRegistryClient, trainer: FakeTrainer):
    monkeypatch.setattr(_routes_workflow, "PROMETHEUS_AVAILABLE", False)
    monkeypatch.setattr(_routes_workflow, "ensure_training_enabled", lambda: None)
    monkeypatch.setattr(_routes_workflow, "db", type("FakeDB", (), {"get_latest_candles": staticmethod(lambda symbol, n=100: build_predict_candles())})())
    monkeypatch.setattr(_routes_workflow, "trainer", trainer)
    monkeypatch.setattr(_routes_workflow, "consensus_agg", FakeConsensusAggregator())
    monkeypatch.setattr(_routes_workflow, "store", FakeStore())
    monkeypatch.setattr(_routes_workflow, "get_cache", lambda: cache)
    monkeypatch.setattr(_routes_workflow, "get_sla_monitor", lambda: FakeSlaMonitor())
    monkeypatch.setattr(_routes_workflow, "get_model_registry_client", lambda: registry)
    monkeypatch.setattr(_routes_workflow, "engineer_features", lambda df, *args, **kwargs: pd.DataFrame([{"feature_a": 1.0}]))
    monkeypatch.setattr(_routes_workflow, "get_feature_vector", lambda feat_df: feat_df)
    monkeypatch.setattr(_routes_workflow, "feast_get_all_features", lambda **kwargs: {})
    monkeypatch.setattr(_routes_workflow, "publish_consensus_to_kafka", lambda *args, **kwargs: None)
    monkeypatch.setattr(_routes_workflow, "MAMBA_AVAILABLE", False)
    monkeypatch.setattr(_routes_workflow, "get_mamba_prediction", lambda *args, **kwargs: {"ok": False})
    monkeypatch.setattr(_routes_workflow, "MODEL_SIZES", {})

    app = FastAPI()
    app.add_api_route("/predict", _routes_workflow.predict_endpoint, methods=["POST"])
    app.add_api_route("/train", _routes_workflow.train_endpoint, methods=["POST"])
    return app


def test_predict_endpoint_returns_cached_response_on_repeat_request(monkeypatch):
    cache = FakeCache()
    registry = FakeModelRegistryClient()
    trainer = FakeTrainer()
    app = build_test_app(monkeypatch, cache=cache, registry=registry, trainer=trainer)

    client = TestClient(app)
    payload = {"symbol": "MNQ", "session_id": 1, "candles": [], "trades": []}

    first = client.post("/predict", json=payload)
    second = client.post("/predict", json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["signal"] == "LONG"
    assert "_cached" not in first.text
    assert second.json()["_cached"] is True
    assert registry.predict_calls == 1
    assert registry.advance_calls == 1


def test_predict_endpoint_replays_completed_response_for_same_idempotency_key(monkeypatch):
    cache = FakeCache()
    registry = FakeModelRegistryClient()
    trainer = FakeTrainer()
    app = build_test_app(monkeypatch, cache=cache, registry=registry, trainer=trainer)

    service = IdempotencyService(client=FakeRedis())
    monkeypatch.setattr(_infrastructure, "get_idempotency_service", lambda: service)
    monkeypatch.setattr(_routes_workflow, "get_request_id", lambda: "req-predict-001")

    client = TestClient(app)
    payload = {"symbol": "MNQ", "session_id": 1, "candles": [], "trades": []}
    headers = {"Idempotency-Key": "predict-idem-001"}

    first = client.post("/predict", json=payload, headers=headers)
    second = client.post("/predict", json=payload, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.headers["Idempotency-Key"] == "predict-idem-001"
    assert first.headers["X-Idempotent-Replay"] == "false"
    assert second.headers["X-Idempotent-Replay"] == "true"
    assert second.json() == first.json()
    assert registry.predict_calls == 1
    assert registry.advance_calls == 1


def test_predict_endpoint_accepts_bff_style_dict_candles(monkeypatch):
    cache = FakeCache()
    registry = FakeModelRegistryClient()
    trainer = FakeTrainer()
    app = build_test_app(monkeypatch, cache=cache, registry=registry, trainer=trainer)
    monkeypatch.setattr(_routes_workflow, "get_request_id", lambda: "req-bff-001")

    client = TestClient(app)
    payload = {
        "symbol": "MNQ",
        "session_id": 1,
        "math_engine_snapshot": {"session_pct": 0.42, "minutes_into_session": 75},
        "key_levels": {"vwap": 18495},
        "candles": [
            {
                "timestamp": "2026-04-10T09:30:00Z",
                "open": 18500.0,
                "high": 18501.0,
                "low": 18499.0,
                "close": 18500.5,
                "volume": 1000,
            },
            {
                "timestamp": "2026-04-10T09:35:00Z",
                "open": 18501.0,
                "high": 18502.0,
                "low": 18500.0,
                "close": 18501.5,
                "volume": 1005,
            },
        ],
        "trades": [],
        "features": {"ignored_by_schema": True},
    }

    response = client.post("/predict", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["signal"] == "LONG"
    assert body["request_id"] == "req-bff-001"
    assert registry.predict_calls == 1
    assert registry.advance_calls == 1


def test_train_endpoint_replays_completed_response_for_same_idempotency_key(monkeypatch):
    cache = FakeCache()
    registry = FakeModelRegistryClient()
    trainer = FakeTrainer()
    app = build_test_app(monkeypatch, cache=cache, registry=registry, trainer=trainer)

    service = IdempotencyService(client=FakeRedis())
    monkeypatch.setattr(_infrastructure, "get_idempotency_service", lambda: service)

    client = TestClient(app)
    payload = {"mode": "incremental", "symbol": "MNQ", "min_trades": 100}
    headers = {"Idempotency-Key": "train-idem-001"}

    first = client.post("/train", json=payload, headers=headers)
    second = client.post("/train", json=payload, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["status"] == "training_started"
    assert second.json() == first.json()
    assert first.headers["Idempotency-Key"] == "train-idem-001"
    assert first.headers["X-Idempotent-Replay"] == "false"
    assert second.headers["X-Idempotent-Replay"] == "true"
    assert trainer.calls == [
        {"mode": "incremental", "symbol": "MNQ", "min_trades": 100, "verbose": True}
    ]
    assert registry.invalidate_calls == [["predictor"]]
    assert registry.warm_calls == [["predictor"]]
