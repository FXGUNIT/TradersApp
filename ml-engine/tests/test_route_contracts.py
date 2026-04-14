from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

import _health
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
