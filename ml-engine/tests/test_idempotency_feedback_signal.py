from __future__ import annotations

from fastapi import FastAPI, Request as FastAPIRequest, Response
from fastapi.testclient import TestClient

import _infrastructure as infrastructure_helpers
import _routes_pso as routes_pso
from infrastructure.idempotency import IdempotencyService
from infrastructure.request_context import RequestIdMiddleware
from schemas import FeedbackSignalRequest


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
        self.store: dict[str, str] = {}

    def get(self, key: str):
        return self.store.get(key)

    def set(self, key: str, value: str, nx: bool = False, ex: int | None = None):
        if nx and key in self.store:
            return False
        self.store[key] = value
        return True

    def delete(self, key: str):
        self.store.pop(key, None)
        return 1

    def pipeline(self):
        return FakePipeline(self)


class RecordingFeedbackLogger:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []
        self.next_signal_id = 101

    def log_signal(self, **kwargs):
        self.calls.append(kwargs)
        signal_id = self.next_signal_id
        self.next_signal_id += 1
        return signal_id


def build_test_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)

    def feedback_signal_wrapper(
        request: FeedbackSignalRequest,
        raw_request: FastAPIRequest = None,
        response: Response = None,
    ):
        return routes_pso.log_signal(request, raw_request, response)

    app.add_api_route("/feedback/signal", feedback_signal_wrapper, methods=["POST"])
    return app


def test_feedback_signal_endpoint_replays_completed_idempotent_response(monkeypatch) -> None:
    service = IdempotencyService(client=FakeRedis())
    feedback_logger = RecordingFeedbackLogger()
    app = build_test_app()
    client = TestClient(app)
    payload = {
        "signal": "LONG",
        "confidence": 0.87,
        "votes": {"ensemble": {"signal": "LONG", "confidence": 0.9}},
        "consensus": {"signal": "LONG", "confidence": 0.87},
        "symbol": "MNQ",
        "session_id": 7,
    }
    headers = {
        "Idempotency-Key": "idem-feedback-signal-001",
        "X-Request-ID": "req-feedback-signal-001",
    }

    monkeypatch.setattr(routes_pso, "feedback_logger", feedback_logger)
    monkeypatch.setattr(infrastructure_helpers, "get_idempotency_service", lambda: service)

    first_response = client.post("/feedback/signal", json=payload, headers=headers)
    second_response = client.post("/feedback/signal", json=payload, headers=headers)

    assert first_response.status_code == 200
    assert first_response.headers["Idempotency-Key"] == "idem-feedback-signal-001"
    assert first_response.headers["X-Idempotent-Replay"] == "false"
    assert first_response.json() == {
        "ok": True,
        "signal_id": 101,
        "request_id": "req-feedback-signal-001",
    }

    assert second_response.status_code == 200
    assert second_response.headers["Idempotency-Key"] == "idem-feedback-signal-001"
    assert second_response.headers["X-Idempotent-Replay"] == "true"
    assert second_response.json() == first_response.json()
    assert feedback_logger.calls == [
        {
            "signal": "LONG",
            "confidence": 0.87,
            "votes": {"ensemble": {"signal": "LONG", "confidence": 0.9}},
            "consensus": {"signal": "LONG", "confidence": 0.87},
            "regime": None,
            "regime_confidence": None,
            "market_regime": None,
            "session_phase": None,
            "symbol": "MNQ",
            "session_id": 7,
        }
    ]


def test_feedback_signal_endpoint_rejects_same_idempotency_key_for_different_payload(monkeypatch) -> None:
    service = IdempotencyService(client=FakeRedis())
    feedback_logger = RecordingFeedbackLogger()
    app = build_test_app()
    client = TestClient(app)
    base_headers = {
        "Idempotency-Key": "idem-feedback-signal-002",
        "X-Request-ID": "req-feedback-signal-002",
    }
    payload = {
        "signal": "SHORT",
        "confidence": 0.61,
        "votes": {},
        "consensus": {},
        "symbol": "MNQ",
        "session_id": 8,
    }
    conflicting_payload = {
        "signal": "LONG",
        "confidence": 0.61,
        "votes": {},
        "consensus": {},
        "symbol": "MNQ",
        "session_id": 8,
    }

    monkeypatch.setattr(routes_pso, "feedback_logger", feedback_logger)
    monkeypatch.setattr(infrastructure_helpers, "get_idempotency_service", lambda: service)

    first_response = client.post("/feedback/signal", json=payload, headers=base_headers)
    second_response = client.post("/feedback/signal", json=conflicting_payload, headers=base_headers)

    assert first_response.status_code == 200
    assert second_response.status_code == 409
    assert "reused with a different payload" in second_response.json()["detail"]
    assert len(feedback_logger.calls) == 1
