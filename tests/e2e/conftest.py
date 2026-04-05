"""
Pytest configuration for E2E tests.
"""
import pytest
import requests


@pytest.fixture(scope="session")
def live_client():
    """HTTP client for ML Engine (localhost:8001)."""
    try:
        resp = requests.get("http://localhost:8001/health", timeout=5)
        if resp.status_code != 200:
            pytest.skip("ML Engine not running at localhost:8001")
    except Exception:
        pytest.skip("ML Engine not running at localhost:8001")
    return requests


@pytest.fixture(scope="session")
def bff_client():
    """HTTP client for BFF (localhost:8788)."""
    try:
        resp = requests.get("http://localhost:8788/health", timeout=5)
        if resp.status_code != 200:
            pytest.skip("BFF not running at localhost:8788")
    except Exception:
        pytest.skip("BFF not running at localhost:8788")
    return requests
