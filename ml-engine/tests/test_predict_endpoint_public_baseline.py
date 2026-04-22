from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import _routes_workflow
import data_quality.validation_pipeline as dq_mod


def _build_public_baseline_payload() -> dict:
    base_price = 18500.0
    base_time = datetime(2026, 4, 21, 9, 30, tzinfo=timezone.utc)
    candles = []

    for index in range(20):
        open_price = base_price + index * 2.0
        close_price = open_price + 1.0
        candles.append(
            {
                "symbol": "MNQ",
                "timestamp": (base_time + timedelta(minutes=index * 5)).isoformat().replace("+00:00", "Z"),
                "open": round(open_price, 2),
                "high": round(close_price + 1.0, 2),
                "low": round(open_price - 1.0, 2),
                "close": round(close_price, 2),
                "volume": 4200 + index * 20,
            }
        )

    return {
        "symbol": "MNQ",
        "session_id": 1,
        "candles": candles,
        "trades": [],
        "math_engine_snapshot": {
            "amdPhase": "ACCUMULATION",
            "vrRegime": "NORMAL",
        },
    }


class _FakeCache:
    def __init__(self) -> None:
        self.values: dict[str, dict] = {}

    def get(self, key: str):
        value = self.values.get(key)
        return deepcopy(value) if value is not None else None

    def set(self, key: str, value: dict, ttl: int = 0):
        self.values[key] = deepcopy(value)
        return True


class _FakeMonitor:
    def record(self, *args, **kwargs) -> None:
        return None


class _FakeStore:
    def load_meta(self, name: str, version: str):
        return {"name": name, "version": version}


class _RecordingRegistryClient:
    def __init__(self) -> None:
        self.predict_calls: list[dict] = []
        self.advance_calls: list[pd.DataFrame] = []

    def predict(self, candles_df, trade_log_df=None, math_engine_snapshot=None, key_levels=None):
        self.predict_calls.append(
            {
                "candles_df": candles_df.copy(),
                "trade_log_df": trade_log_df,
                "math_engine_snapshot": deepcopy(math_engine_snapshot),
                "key_levels": deepcopy(key_levels),
            }
        )
        return {
            "votes": {"direction": {"signal": "LONG", "confidence": 0.91}},
            "consensus": {"signal": "LONG", "confidence": 0.91},
        }

    def advance_regime(self, feature_df):
        self.advance_calls.append(feature_df.copy())
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


class _RecordingConsensusAggregator:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def aggregate(self, **kwargs):
        self.calls.append(deepcopy(kwargs))
        return {
            "votes": kwargs["votes"],
            "consensus": kwargs["consensus"],
            "signal": kwargs["consensus"]["signal"],
            "confidence": kwargs["consensus"]["confidence"],
            "long_score": 0.91,
            "short_score": 0.09,
            "models_used": len(kwargs["votes"]),
        }


def _build_feature_frame(df: pd.DataFrame) -> pd.DataFrame:
    last_close = float(df["close"].iloc[-1])
    return pd.DataFrame(
        [
            {
                "feature_a": round(last_close, 2),
                "vr": 1.02,
                "adx": 24.0,
                "atr": 12.5,
                "ci": 31.0,
                "vwap": round(last_close - 2.5, 2),
                "amd_ACCUMULATION": 1.0,
                "amd_MANIPULATION": 0.0,
                "amd_DISTRIBUTION": 0.0,
                "amd_TRANSITION": 0.0,
                "amd_UNCLEAR": 0.0,
            }
        ]
    )


@pytest.mark.integration
def test_predict_endpoint_accepts_recent_public_baseline_payload(monkeypatch, tmp_path):
    cache = _FakeCache()
    registry = _RecordingRegistryClient()
    aggregator = _RecordingConsensusAggregator()
    kafka_publications: list[dict] = []

    monkeypatch.setattr(_routes_workflow, "PROMETHEUS_AVAILABLE", False)
    monkeypatch.setattr(_routes_workflow, "get_cache", lambda: cache)
    monkeypatch.setattr(_routes_workflow, "get_sla_monitor", lambda: _FakeMonitor())
    monkeypatch.setattr(_routes_workflow, "get_model_registry_client", lambda: registry)
    monkeypatch.setattr(_routes_workflow, "consensus_agg", aggregator)
    monkeypatch.setattr(_routes_workflow, "store", _FakeStore())
    monkeypatch.setattr(_routes_workflow, "feast_get_all_features", lambda **kwargs: {"feature_from_feast": 9.0})
    monkeypatch.setattr(_routes_workflow, "engineer_features", lambda df, *args, **kwargs: _build_feature_frame(df))
    monkeypatch.setattr(_routes_workflow, "get_feature_vector", lambda feat_df: feat_df)
    monkeypatch.setattr(_routes_workflow, "publish_consensus_to_kafka", lambda **kwargs: kafka_publications.append(kwargs))
    monkeypatch.setattr(_routes_workflow, "get_request_id", lambda: "req-public-baseline-001")
    monkeypatch.setattr(_routes_workflow, "_claim_idempotency", lambda *args, **kwargs: (None, None))
    monkeypatch.setattr(_routes_workflow, "_store_idempotent_response", lambda *args, **kwargs: None)
    monkeypatch.setattr(_routes_workflow, "_release_idempotency_claim", lambda *args, **kwargs: None)
    monkeypatch.setattr(_routes_workflow, "MAMBA_AVAILABLE", False)
    monkeypatch.setattr(_routes_workflow, "get_mamba_prediction", lambda *args, **kwargs: {"ok": False})
    monkeypatch.setattr(_routes_workflow, "MODEL_SIZES", {})
    monkeypatch.setattr(dq_mod, "REQUIRE_GX", False)
    monkeypatch.setattr(dq_mod, "DQ_QUARANTINE_DIR", tmp_path / "dq_rejections")

    app = FastAPI()
    app.add_api_route("/predict", _routes_workflow.predict_endpoint, methods=["POST"])

    client = TestClient(app)
    payload = _build_public_baseline_payload()

    first = client.post("/predict", json=payload)
    second = client.post("/predict", json=payload)

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text

    first_body = first.json()
    second_body = second.json()

    assert first_body["signal"] == "LONG"
    assert first_body["consensus"]["signal"] == "LONG"
    assert first_body["votes"]["direction"]["signal"] == "LONG"
    assert first_body["physics_regime"]["regime"] == "NORMAL"
    assert first_body["request_id"] == "req-public-baseline-001"
    assert first_body["_latency_ms"] >= 0
    assert second_body["_cached"] is True
    assert len(registry.predict_calls) == 1
    assert len(registry.advance_calls) == 1

    predict_call = registry.predict_calls[0]
    candles_df = predict_call["candles_df"]
    assert len(candles_df) == 20
    assert list(candles_df.columns) == ["symbol", "timestamp", "open", "high", "low", "close", "volume"]
    assert str(candles_df["timestamp"].dtype).startswith("datetime64")
    assert candles_df.iloc[0]["symbol"] == "MNQ"
    assert predict_call["trade_log_df"] is None
    assert predict_call["math_engine_snapshot"] == {
        "amdPhase": "ACCUMULATION",
        "vrRegime": "NORMAL",
    }
    assert predict_call["key_levels"] is None

    aggregate_call = aggregator.calls[0]
    assert aggregate_call["session_id"] == 1
    assert aggregate_call["math_engine_snapshot"]["amdPhase"] == "ACCUMULATION"
    assert aggregate_call["feature_dict"]["feature_a"] == pytest.approx(18539.0)
    assert aggregate_call["feature_dict"]["feature_from_feast"] == 9.0
    assert aggregate_call["feature_dict"]["session_id"] == 1

    assert kafka_publications == [
        {
            "symbol": "MNQ",
            "signal": {
                "signal": "LONG",
                "confidence": 0.91,
                "long_score": 0.91,
                "short_score": 0.09,
                "votes": {"direction": {"signal": "LONG", "confidence": 0.91}},
            },
            "regime": "NORMAL",
        }
    ]
