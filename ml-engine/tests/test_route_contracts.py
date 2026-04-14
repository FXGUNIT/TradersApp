from __future__ import annotations

import sys
from types import ModuleType, SimpleNamespace
from datetime import datetime, timedelta, timezone

import pandas as pd
from fastapi import FastAPI
from fastapi.testclient import TestClient

import _health
import _infrastructure
import main
import _routes_data
import _routes_features
import _routes_news
import _routes_pso
import _routes_workflow


class _FakeCache:
    def get(self, key: str):
        return None

    def set(self, key: str, value, ttl: int = 0):
        return True


class _FakeMonitor:
    def record(self, *args, **kwargs) -> None:
        return None


class _FakeDbHealthy:
    backend_type = "sqlite"

    def get_stats(self):
        return {"candles": 12, "trades": 3, "sessions": 1, "last_training": None}

    def health_check(self):
        return True


class _FakeDbNotReady:
    backend_type = "sqlite"

    def health_check(self):
        return False


def _build_candles(count: int) -> list[dict]:
    start = datetime(2026, 4, 14, 9, 30, tzinfo=timezone.utc)
    candles = []
    for index in range(count):
        ts = start + timedelta(minutes=index * 5)
        price = 18500.0 + index
        candles.append(
            {
                "timestamp": ts.isoformat(),
                "open": price,
                "high": price + 1.0,
                "low": price - 1.0,
                "close": price + 0.5,
                "volume": 1000 + index,
            }
        )
    return candles


def test_live_endpoint_returns_lightweight_status(monkeypatch):
    app = FastAPI()
    app.add_api_route("/live", _health.live, methods=["GET"])
    monkeypatch.setattr(_health, "start_time", 0.0)
    monkeypatch.setattr(_health, "get_request_id", lambda: "req-live-001")

    client = TestClient(app)
    response = client.get("/live")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "live"
    assert payload["service"] == "tradersapp-ml-engine"
    assert payload["request_id"] == "req-live-001"
    assert "timestamp" in payload


def test_create_app_registers_infrastructure_app_reference(monkeypatch):
    monkeypatch.setattr(_infrastructure, "app", None)

    app = main.create_app()

    assert _infrastructure.app is app


def test_ready_endpoint_reports_starting_when_db_unavailable(monkeypatch):
    app = FastAPI()
    app.add_api_route("/ready", _health.ready, methods=["GET"])
    monkeypatch.setattr(_health, "db", _FakeDbNotReady())
    monkeypatch.setattr(_health, "feast_warmed", False)
    monkeypatch.setattr(_health, "get_request_id", lambda: "req-ready-001")

    client = TestClient(app)
    response = client.get("/ready")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "starting"
    assert payload["db_available"] is False
    assert payload["db_backend"] == "sqlite"
    assert payload["request_id"] == "req-ready-001"


def test_health_endpoint_surfaces_registry_error_without_crashing(monkeypatch):
    app = FastAPI()
    app.add_api_route("/health", _health.health, methods=["GET"])
    monkeypatch.setattr(_health, "db", _FakeDbHealthy())
    monkeypatch.setattr(_health, "start_time", 0.0)
    monkeypatch.setattr(_health, "feast_warmed", True)
    monkeypatch.setattr(_health, "lineage_registry", None)
    monkeypatch.setattr(_health, "get_request_id", lambda: "req-health-001")
    monkeypatch.setattr(_health, "get_model_registry_status", lambda: (_ for _ in ()).throw(RuntimeError("registry unavailable")))

    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert payload["request_id"] == "req-health-001"
    assert payload["model_registry"]["error"] == "registry unavailable"
    assert payload["models_loaded"] == 0


def test_metrics_endpoint_returns_placeholder_when_prometheus_unavailable(monkeypatch):
    app = FastAPI()
    app.add_api_route("/metrics", _health.metrics_endpoint, methods=["GET"])
    monkeypatch.setattr(_health, "PROMETHEUS_AVAILABLE", False)
    monkeypatch.setattr(_health, "_HANDLE_METRICS", None)

    client = TestClient(app)
    response = client.get("/metrics")

    assert response.status_code == 200
    assert "ml_monitoring_last_check_timestamp" in response.text


def test_regime_endpoint_rejects_short_candle_history(monkeypatch):
    app = FastAPI()
    app.add_api_route("/regime", _routes_workflow.regime_endpoint, methods=["POST"])
    monkeypatch.setattr(_routes_workflow, "PROMETHEUS_AVAILABLE", False)
    monkeypatch.setattr(_routes_workflow, "get_cache", lambda: _FakeCache())
    monkeypatch.setattr(_routes_workflow, "get_sla_monitor", lambda: _FakeMonitor())

    client = TestClient(app)
    response = client.post("/regime", json={"symbol": "MNQ", "candles": _build_candles(10)})

    assert response.status_code == 400
    assert response.json()["detail"] == "Need at least 50 candles for regime analysis."


def test_inference_predict_returns_503_when_inference_unavailable(monkeypatch):
    app = FastAPI()
    app.add_api_route("/inference/predict", _routes_pso.inference_predict, methods=["POST"])
    monkeypatch.setattr(_routes_pso, "INFERENCE_AVAILABLE", False)

    client = TestClient(app)
    response = client.post(
        "/inference/predict",
        json={"symbol": "MNQ", "model_name": "lightgbm_direction", "features": [[1.0, 2.0, 3.0]]},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Inference client not available"


def test_inference_status_reports_unavailable_cleanly(monkeypatch):
    app = FastAPI()
    app.add_api_route("/inference/status", _routes_pso.inference_status, methods=["GET"])
    monkeypatch.setattr(_routes_pso, "INFERENCE_AVAILABLE", False)

    client = TestClient(app)
    response = client.get("/inference/status")

    assert response.status_code == 200
    assert response.json() == {"error": "Inference not available"}


def test_mamba_predict_reports_unavailable_without_throwing(monkeypatch):
    app = FastAPI()
    app.add_api_route("/mamba/predict", _routes_pso.mamba_predict, methods=["POST"])
    monkeypatch.setattr(_routes_pso, "MAMBA_AVAILABLE", False)
    monkeypatch.setattr(_routes_pso, "MODEL_SIZES", {})

    client = TestClient(app)
    response = client.post(
        "/mamba/predict",
        json={"symbol": "MNQ", "model_size": "mamba-790m", "task": "full", "candles": []},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is False
    assert payload["available"] is False
    assert "Mamba not available" in payload["error"]


def test_news_trigger_accepts_json_body_contract():
    app = FastAPI()
    app.add_api_route("/news-trigger", _routes_news.feedback_signal_news_trigger, methods=["POST"])

    client = TestClient(app)
    response = client.post(
        "/news-trigger",
        json={
            "news": {
                "id": "news-001",
                "title": "Fed signals rate cut",
                "description": "Macro pressure cools inflation.",
                "sentiment": "bullish",
                "impact": "HIGH",
                "keywords": ["fed", "inflation"],
            },
            "trigger_type": "breaking_news_high_impact",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["news_id"] == "news-001"
    assert payload["retrain_scheduled"] is True


def test_candles_upload_accepts_json_body_contract(monkeypatch):
    class _FakeUploadDb:
        def insert_candles(self, df):
            return len(df)

        def get_candle_count(self, symbol):
            return 7

    app = FastAPI()
    app.add_api_route("/candles/upload", _routes_data.upload_candles, methods=["POST"])
    monkeypatch.setattr(_routes_data, "db", _FakeUploadDb())
    monkeypatch.setattr(_routes_data, "QUALITY_GATE_AVAILABLE", False)

    client = TestClient(app)
    response = client.post(
        "/candles/upload",
        json={"symbol": "MNQ", "candles": _build_candles(3)},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["candles_inserted"] == 3
    assert payload["total_candles"] == 7


def test_drift_record_prediction_accepts_json_body_contract(monkeypatch):
    class _FakeConceptDrift:
        def __init__(self):
            self.recorded = []

        def record_prediction(self, *, correct, confidence):
            self.recorded.append((correct, confidence))

        def detect(self):
            return {"status": "ok", "accuracy": 0.75}

        def should_retrain(self):
            return False

    fake_concept = _FakeConceptDrift()
    fake_monitor = SimpleNamespace(
        concept_drift=fake_concept,
        regime_drift=SimpleNamespace(detect=lambda: {"status": "ok"}),
    )

    app = FastAPI()
    app.add_api_route("/drift/record-prediction", _routes_features.drift_record_prediction, methods=["POST"])
    monkeypatch.setattr(_routes_features._lifespan, "drift_monitor", fake_monitor)
    monkeypatch.setattr(_routes_features, "record_prometheus_drift_monitoring_snapshot", lambda *args, **kwargs: None)

    client = TestClient(app)
    response = client.post(
        "/drift/record-prediction",
        json={"correct": True, "confidence": 0.82, "model_name": "ensemble"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["recorded"] is True
    assert fake_concept.recorded == [(True, 0.82)]


def test_feedback_retrain_accepts_json_body_contract(monkeypatch):
    fake_config = SimpleNamespace(
        training_mode="full",
        symbol="MNQ",
        auto_retrain_on_drift=False,
    )
    fake_report = SimpleNamespace(
        triggered=True,
        reason="manual",
        drift_status={"should_retrain": True, "overall_status": "alert"},
        training_result={"models": {"direction": {"ok": True}}},
        error=None,
        duration_sec=1.25,
        timestamp="2026-04-14T16:00:00Z",
    )
    fake_pipeline = SimpleNamespace(
        config=fake_config,
        run=lambda trigger, verbose: fake_report,
    )

    app = FastAPI()
    app.add_api_route("/feedback/retrain", _routes_pso.trigger_retrain, methods=["POST"])
    monkeypatch.setattr(_routes_pso, "retrain_pipeline", fake_pipeline)

    client = TestClient(app)
    response = client.post(
        "/feedback/retrain",
        json={
            "trigger": "manual",
            "symbol": "MNQ",
            "training_mode": "incremental",
            "auto_retrain_on_drift": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["triggered"] is True
    assert payload["reason"] == "manual"
    assert payload["training_result"] == {"direction": {"ok": True}}


def test_pso_discover_accepts_dict_candles_payload(monkeypatch):
    fake_features = ModuleType("features.feature_pipeline")
    fake_features.engineer_features = lambda *args, **kwargs: pd.DataFrame([{"feature_a": 1.0}])
    monkeypatch.setitem(sys.modules, "features.feature_pipeline", fake_features)

    class _FakePsoDb:
        def get_trade_log(self, limit=5000):
            return pd.DataFrame([{"pnl_ticks": 1.0}])

    app = FastAPI()
    app.add_api_route("/pso/discover", _routes_pso.pso_discover, methods=["POST"])
    monkeypatch.setattr(_routes_pso, "db", _FakePsoDb())
    monkeypatch.setattr(_routes_pso, "PSO_AVAILABLE", True)
    monkeypatch.setattr(_routes_pso, "PROMETHEUS_AVAILABLE", False)
    monkeypatch.setattr(_routes_pso, "get_cache", lambda: _FakeCache())
    monkeypatch.setattr(_routes_pso, "get_sla_monitor", lambda: _FakeMonitor())
    monkeypatch.setattr(_routes_pso, "_claim_idempotency", lambda *args, **kwargs: (None, None))
    monkeypatch.setattr(_routes_pso, "_store_idempotent_response", lambda *args, **kwargs: None)
    monkeypatch.setattr(_routes_pso, "_release_idempotency_claim", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        _routes_pso,
        "run_alpha_discovery",
        lambda *args, **kwargs: {
            "regimes_found": 1,
            "best_regime": "ALL",
            "best_regime_alpha": 1.0,
            "total_alpha": 1.0,
            "timestamp": "2026-04-14T16:00:00Z",
        },
    )

    client = TestClient(app)
    response = client.post(
        "/pso/discover",
        json={
            "symbol": "MNQ",
            "candles": _build_candles(60),
            "n_particles": 20,
            "max_iterations": 15,
            "regime": "ALL",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["regimes_found"] == 1
    assert payload["best_regime"] == "ALL"
