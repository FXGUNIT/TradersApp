from __future__ import annotations

from types import SimpleNamespace

import pandas as pd
from fastapi import FastAPI
from fastapi.testclient import TestClient

import _routes_data
import _routes_pso
import _routes_workflow
import config
from infrastructure.model_registry_service import ModelRegistryService
from training.model_store import ModelStore


def _build_candles(count: int) -> list[dict]:
    candles = []
    for index in range(count):
        candles.append(
            {
                "timestamp": f"2026-04-15T09:{index % 60:02d}:00Z",
                "open": 18500.0 + index,
                "high": 18501.0 + index,
                "low": 18499.0 + index,
                "close": 18500.5 + index,
                "volume": 1000 + index,
            }
        )
    return candles


def test_incompatible_schema_versions_are_rejected_consistently():
    app = FastAPI()
    app.add_api_route("/predict", _routes_workflow.predict_endpoint, methods=["POST"])
    app.add_api_route("/pso/discover", _routes_pso.pso_discover, methods=["POST"])
    app.add_api_route("/candles/upload", _routes_data.upload_candles, methods=["POST"])

    client = TestClient(app)

    predict_response = client.post(
        "/predict",
        json={
            "schema_version": "2.0",
            "symbol": "MNQ",
            "session_id": 1,
            "candles": [],
            "trades": [],
        },
    )
    pso_response = client.post(
        "/pso/discover",
        json={
            "schema_version": "2.0",
            "symbol": "MNQ",
            "candles": _build_candles(60),
            "n_particles": 20,
            "max_iterations": 15,
            "regime": "ALL",
        },
    )
    candles_response = client.post(
        "/candles/upload",
        json={
            "schema_version": "2.0",
            "symbol": "MNQ",
            "candles": _build_candles(1),
        },
    )

    assert predict_response.status_code == 422
    assert pso_response.status_code == 422
    assert candles_response.status_code == 422


def test_large_payloads_are_rejected_at_contract_boundary():
    app = FastAPI()
    app.add_api_route("/predict", _routes_workflow.predict_endpoint, methods=["POST"])
    app.add_api_route("/candles/upload", _routes_data.upload_candles, methods=["POST"])
    client = TestClient(app)

    predict_response = client.post(
        "/predict",
        json={
            "schema_version": "1.0",
            "symbol": "MNQ",
            "session_id": 1,
            "candles": _build_candles(5001),
            "trades": [],
        },
    )
    candles_response = client.post(
        "/candles/upload",
        json={
            "schema_version": "1.0",
            "symbol": "MNQ",
            "candles": _build_candles(10001),
        },
    )

    assert predict_response.status_code == 422
    assert candles_response.status_code == 422


def test_registry_service_reloads_serialized_artifact_after_restart(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "MODEL_STORE_READ_ONLY", False)
    store = ModelStore(str(tmp_path))
    artifact_version = "20260415_000001"
    artifact_payload = {"kind": "direction-model", "weights": [1, 2, 3]}
    store.save(
        model_name="direction",
        pipeline=artifact_payload,
        metrics={"accuracy": 0.95},
        feature_cols=["feature_a"],
        version=artifact_version,
    )

    def build_service() -> ModelRegistryService:
        service = ModelRegistryService(
            store_dir=str(tmp_path),
            redis_url="redis://127.0.0.1:6399/0",
            max_cached_instances=1,
        )
        monkeypatch.setattr(service.store, "list_all_models", lambda: ["direction"])

        class _SerializedArtifactPredictor:
            def __init__(self, payload, version):
                self._models = {"direction": {"payload": payload, "version": version}}
                self.is_ready = True

            def predict(
                self,
                candles_df,
                trade_log_df=None,
                math_engine_snapshot=None,
                key_levels=None,
            ):
                return {
                    "votes": {"direction": {"signal": "NEUTRAL", "confidence": 0.5}},
                    "consensus": {"signal": "NEUTRAL", "confidence": 0.5},
                    "artifact_version": self._models["direction"]["version"],
                    "artifact_payload": self._models["direction"]["payload"],
                    "rows": len(candles_df),
                }

        def load_predictor_from_store():
            pipeline, meta = service.store.load("direction", "latest")
            return _SerializedArtifactPredictor(pipeline, meta.get("version"))

        monkeypatch.setattr(service, "_load_predictor", load_predictor_from_store)
        monkeypatch.setattr(
            service,
            "_load_regime_ensemble",
            lambda: SimpleNamespace(advance=lambda feature_df: {"regime": "NORMAL"}),
        )
        return service

    candles = pd.DataFrame([{"timestamp": "2026-04-15T10:00:00Z", "close": 18500.0}])

    service_a = build_service()
    first = service_a.predict(candles)
    service_a.close()

    service_b = build_service()
    second = service_b.predict(candles)
    service_b.close()

    assert first["artifact_version"] == artifact_version
    assert second["artifact_version"] == artifact_version
    assert second["artifact_payload"] == artifact_payload
