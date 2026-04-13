"""
Non-blocking Board Room reporter for ML Engine agents.

Disabled unless BOARD_ROOM_ENABLED is truthy and a BFF base URL is configured
through BOARD_ROOM_BFF_URL or BFF_URL.
"""
from __future__ import annotations

import os
import threading
import time
import traceback
from typing import Any

import httpx

DEFAULT_HEARTBEAT_SECONDS = 90 * 60
DEFAULT_ERROR_THROTTLE_SECONDS = 5 * 60

_heartbeat_threads: dict[str, tuple[threading.Thread, threading.Event]] = {}
_error_cooldowns: dict[str, float] = {}
_state_lock = threading.Lock()


def _truthy(raw_value: str | None, default: bool = True) -> bool:
    if raw_value is None:
        return default
    return str(raw_value).strip().lower() in {"1", "true", "yes", "on"}


def board_room_api_base() -> str:
    base = (
        os.getenv("BOARD_ROOM_BFF_URL")
        or os.getenv("BFF_URL")
        or ""
    ).strip().rstrip("/")
    if not base:
        return ""
    if base.endswith("/api"):
        return base
    return f"{base}/api"


def board_room_enabled() -> bool:
    return _truthy(os.getenv("BOARD_ROOM_ENABLED"), default=True) and bool(board_room_api_base())


def _post_json(path: str, payload: dict[str, Any], timeout_seconds: float = 2.5) -> dict[str, Any] | None:
    base = board_room_api_base()
    if not base or not board_room_enabled():
        return None

    try:
        response = httpx.post(
            f"{base}{path}",
            json=payload,
            timeout=timeout_seconds,
        )
        if response.is_success:
            return response.json()
    except Exception:
        return None
    return None


def post_heartbeat(
    agent: str,
    *,
    status: str = "active",
    focus: str | None = None,
    current_thread_id: str | None = None,
) -> dict[str, Any] | None:
    if not agent:
        return None
    return _post_json(
        "/board-room/heartbeat",
        {
            "agent": agent,
            "status": status,
            "focus": focus,
            "currentThreadId": current_thread_id,
        },
    )


def ensure_heartbeat_loop(
    agent: str,
    *,
    focus: str,
    status: str = "idle",
    current_thread_id: str | None = None,
    interval_seconds: int | None = None,
) -> bool:
    if not agent or not board_room_enabled():
        return False

    interval = max(60, int(interval_seconds or os.getenv("BOARD_ROOM_HEARTBEAT_SECONDS", DEFAULT_HEARTBEAT_SECONDS)))

    with _state_lock:
        existing = _heartbeat_threads.get(agent)
        if existing and existing[0].is_alive():
            return False

        stop_event = threading.Event()

        def _loop() -> None:
            post_heartbeat(
                agent,
                status="active",
                focus=focus,
                current_thread_id=current_thread_id,
            )
            while not stop_event.wait(interval):
                post_heartbeat(
                    agent,
                    status=status,
                    focus=focus,
                    current_thread_id=current_thread_id,
                )

        thread = threading.Thread(
            target=_loop,
            name=f"board-room-heartbeat-{agent}",
            daemon=True,
        )
        _heartbeat_threads[agent] = (thread, stop_event)
        thread.start()
        return True


def _normalize_error_message(error: Any) -> str:
    if error is None:
        return "Unknown error"
    if isinstance(error, BaseException):
        return str(error) or error.__class__.__name__
    return str(error)


def report_error(
    agent: str,
    error: Any,
    *,
    severity: str = "MEDIUM",
    thread_id: str | None = None,
    stack: str | None = None,
    throttle_seconds: int | None = None,
) -> dict[str, Any] | None:
    if not agent or not error or not board_room_enabled():
        return None

    message = _normalize_error_message(error)
    cooldown = max(30, int(throttle_seconds or os.getenv("BOARD_ROOM_ERROR_THROTTLE_SECONDS", DEFAULT_ERROR_THROTTLE_SECONDS)))
    key = f"{agent}:{message}"
    now = time.time()

    with _state_lock:
        previous = _error_cooldowns.get(key, 0.0)
        if now - previous < cooldown:
            return None
        _error_cooldowns[key] = now

    error_stack = stack
    if error_stack is None and isinstance(error, BaseException):
        error_stack = "".join(
            traceback.format_exception(type(error), error, error.__traceback__)
        )

    if isinstance(error_stack, str):
        error_stack = error_stack[:4000]

    return _post_json(
        "/board-room/error",
        {
            "agent": agent,
            "error": message,
            "severity": severity,
            "threadId": thread_id,
            "stack": error_stack,
        },
    )


def stop_heartbeat_loop(agent: str) -> None:
    with _state_lock:
        thread_data = _heartbeat_threads.pop(agent, None)
    if not thread_data:
        return
    _, stop_event = thread_data
    stop_event.set()


def reset_board_room_client_state() -> None:
    with _state_lock:
        agents = list(_heartbeat_threads.keys())
        _error_cooldowns.clear()
    for agent in agents:
        stop_heartbeat_loop(agent)
