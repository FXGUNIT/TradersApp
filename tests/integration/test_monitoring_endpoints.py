from __future__ import annotations

import os

import requests


BASE_URL = os.environ.get("ML_ENGINE_BASE_URL", "http://127.0.0.1:8001")


def test_health_endpoint_is_available():
    response = requests.get(f"{BASE_URL}/health", timeout=10)
    assert response.status_code == 200


def test_sla_endpoint_returns_targets():
    response = requests.get(f"{BASE_URL}/sla", timeout=10)
    assert response.status_code == 200
    payload = response.json()
    assert "targets" in payload
    assert "windows" in payload


def test_monitoring_status_contains_unified_sections():
    response = requests.get(
        f"{BASE_URL}/monitoring/status",
        params={"symbol": "MNQ", "sync_metrics": "true"},
        timeout=20,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["ok"] is True
    assert "drift" in payload
    assert "sla" in payload
    assert "mlflow" in payload
    assert "retrain" in payload


def test_metrics_contains_monitoring_gauges():
    sync_response = requests.get(
        f"{BASE_URL}/monitoring/status",
        params={"symbol": "MNQ", "sync_metrics": "true"},
        timeout=20,
    )
    assert sync_response.status_code == 200

    response = requests.get(f"{BASE_URL}/metrics", timeout=10)
    assert response.status_code == 200
    assert "ml_monitoring_last_check_timestamp" in response.text
