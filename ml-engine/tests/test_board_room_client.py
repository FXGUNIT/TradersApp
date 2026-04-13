from __future__ import annotations

from infrastructure import board_room_client


class _FakeResponse:
    def __init__(self, payload=None, is_success=True):
        self._payload = payload or {"ok": True}
        self.is_success = is_success

    def json(self):
        return self._payload


def teardown_function():
    board_room_client.reset_board_room_client_state()


def test_board_room_api_base_uses_bff_url(monkeypatch):
    monkeypatch.setenv("BOARD_ROOM_ENABLED", "true")
    monkeypatch.setenv("BFF_URL", "http://localhost:8788")

    assert board_room_client.board_room_api_base() == "http://localhost:8788/api"
    assert board_room_client.board_room_enabled() is True


def test_post_heartbeat_posts_to_board_room_endpoint(monkeypatch):
    captured = {}

    def fake_post(url, json=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return _FakeResponse({"ok": True, "heartbeat": {"agent": json["agent"]}})

    monkeypatch.setenv("BOARD_ROOM_ENABLED", "true")
    monkeypatch.setenv("BFF_URL", "http://board-room.test")
    monkeypatch.setattr(board_room_client.httpx, "post", fake_post)

    result = board_room_client.post_heartbeat(
        "ML.Predictor",
        status="active",
        focus="Serving models",
    )

    assert captured["url"] == "http://board-room.test/api/board-room/heartbeat"
    assert captured["json"]["agent"] == "ML.Predictor"
    assert result["heartbeat"]["agent"] == "ML.Predictor"


def test_report_error_throttles_duplicate_messages(monkeypatch):
    calls = []

    def fake_post(url, json=None, timeout=None):
        calls.append((url, json, timeout))
        return _FakeResponse()

    monkeypatch.setenv("BOARD_ROOM_ENABLED", "true")
    monkeypatch.setenv("BFF_URL", "http://board-room.test")
    monkeypatch.setattr(board_room_client.httpx, "post", fake_post)

    first = board_room_client.report_error(
        "ML.Predictor",
        RuntimeError("temporary failure"),
        severity="HIGH",
    )
    second = board_room_client.report_error(
        "ML.Predictor",
        RuntimeError("temporary failure"),
        severity="HIGH",
    )

    assert first == {"ok": True}
    assert second is None
    assert len(calls) == 1
    assert calls[0][0] == "http://board-room.test/api/board-room/error"


def test_ensure_heartbeat_loop_noops_when_disabled(monkeypatch):
    monkeypatch.delenv("BFF_URL", raising=False)
    monkeypatch.delenv("BOARD_ROOM_BFF_URL", raising=False)
    monkeypatch.setenv("BOARD_ROOM_ENABLED", "true")

    started = board_room_client.ensure_heartbeat_loop(
        "ML.SessionProbability",
        focus="Testing disabled path",
    )

    assert started is False
