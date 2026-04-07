"""
Request Context Middleware — Request ID propagation for distributed tracing.

Every HTTP request gets a unique X-Request-ID (UUID4). The ID is:
1. Propagated via HTTP header X-Request-ID (BFF → ML Engine)
2. Stored in contextvars for access anywhere in the call stack
3. Injected into all log messages automatically
4. Returned in the response X-Request-ID header
5. Forwarded to downstream calls (MLflow, Redis, etc.)

Usage:
    from infrastructure.request_context import get_request_id, request_logger

    @app.get("/predict")
    async def predict():
        request_id = get_request_id()           # access from anywhere
        logger = request_logger()               # logger with request_id field
        logger.info("Running prediction")

    from starlette.middleware.base import BaseHTTPMiddleware
    app.add_middleware(RequestIdMiddleware)      # register once in main.py
"""
from __future__ import annotations

import contextlib
import logging
import time
import uuid
from contextvars import ContextVar
from typing import Any, Iterable

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# ─── Context Variable ─────────────────────────────────────────────────────────

# Process-level context for the current request. Thread-safe.
# Reset to None after each request.
_request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)


def generate_request_id() -> str:
    """Generate a new UUID4 request ID."""
    return str(uuid.uuid4())


def _decode_header_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)


def extract_request_id_from_headers(headers: Any) -> str | None:
    """
    Extract request ID from HTTP headers or Kafka headers.

    Supports:
    - Starlette/FastAPI Headers objects
    - dict-like mappings
    - Kafka header lists: [(key, value), ...]
    """
    if headers is None:
        return None

    for header_name in (HEADER_REQUEST_ID, HEADER_FORWARDED_REQUEST_ID):
        if hasattr(headers, "get"):
            value = headers.get(header_name) or headers.get(header_name.lower())
            if value:
                return _decode_header_value(value)

    if isinstance(headers, dict):
        lower_headers = {str(key).lower(): value for key, value in headers.items()}
        for header_name in (HEADER_REQUEST_ID.lower(), HEADER_FORWARDED_REQUEST_ID.lower()):
            if header_name in lower_headers:
                value = _decode_header_value(lower_headers[header_name])
                if value:
                    return value

    if isinstance(headers, Iterable):
        for item in headers:
            if not isinstance(item, tuple) or len(item) != 2:
                continue
            key, value = item
            if str(key).lower() in (HEADER_REQUEST_ID.lower(), HEADER_FORWARDED_REQUEST_ID.lower()):
                decoded = _decode_header_value(value)
                if decoded:
                    return decoded

    return None


def get_request_id() -> str | None:
    """
    Get the request ID for the current request.
    Returns None if called outside of a request context.

    Usage anywhere in the call stack (models, DB, cache, etc.):
        from infrastructure.request_context import get_request_id
        rid = get_request_id()  # access without passing through all layers
    """
    return _request_id_var.get()


def get_request_id_or_default(default: str = "no-request-id") -> str:
    """Get request ID, or return a default if not in a request context."""
    return _request_id_var.get() or default


@contextlib.contextmanager
def request_id_context(request_id: str | None = None):
    """Temporarily bind a request ID to the current execution context."""
    token = _request_id_var.set(request_id or generate_request_id())
    try:
        yield _request_id_var.get()
    finally:
        _request_id_var.reset(token)


# ─── Request-scoped Logger ────────────────────────────────────────────────────

def request_logger(name: str = "ml-engine") -> logging.LoggerAdapter:
    """
    Return a LoggerAdapter that prepends the current request ID to every log line.

    Example log output:
        [req-a1b2c3d4] GET /inference/predict 200 OK 45ms
        [req-a1b2c3d4] Cache hit for predict:mnq:session1

    Usage:
        logger = request_logger(__name__)
        logger.info("Starting inference")
        logger.warning("Cache miss, computing...")
    """
    logger = logging.getLogger(name)
    req_id = get_request_id_or_default("no-request-id")
    prefix = f"[req-{req_id}] "
    return _RequestIdAdapter(logger, {"request_id": req_id, "prefix": prefix})


class _RequestIdAdapter(logging.LoggerAdapter):
    """LoggerAdapter that prepends [req-XXXX] to every log message."""

    def process(self, msg: str, kwargs: dict) -> tuple[str, dict]:
        # Prepend request ID prefix to the message
        return f"{self.extra['prefix']}{msg}", kwargs


# ─── FastAPI Middleware ───────────────────────────────────────────────────────

# Header names (standard + common conventions)
HEADER_REQUEST_ID = "X-Request-ID"
HEADER_FORWARDED_REQUEST_ID = "X-Forwarded-Request-ID"


def install_request_id_logging(logger: logging.Logger | None = None) -> None:
    """Attach RequestIdFilter once to the root logger and existing handlers."""
    target = logger or logging.getLogger()
    filters = target.filters
    if not any(isinstance(item, RequestIdFilter) for item in filters):
        target.addFilter(RequestIdFilter())

    for handler in target.handlers:
        if not any(isinstance(item, RequestIdFilter) for item in handler.filters):
            handler.addFilter(RequestIdFilter())


class RequestIdMiddleware:
    """
    FastAPI middleware that assigns a unique request ID to every HTTP request.

    Behavior:
    1. Extracts request ID from X-Request-ID or X-Forwarded-Request-ID header if present
       (enables trace continuity when BFF or API gateway already assigned one)
    2. Generates a fresh UUID4 if none provided
    3. Stores it in contextvars for access anywhere in the call stack
    4. Adds X-Request-ID to the response headers
    5. Injects into the Python logging context via RequestIdAdapter

    Thread-safety: uses contextvars — safe for async and threaded execution.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        raw_headers = {
            key.decode("latin1"): value.decode("latin1")
            for key, value in scope.get("headers", [])
        }
        request_id = extract_request_id_from_headers(raw_headers) or generate_request_id()
        method = scope.get("method", "UNKNOWN")
        path = scope.get("path", "")
        start = time.perf_counter()
        status_code = 500

        token = _request_id_var.set(request_id)

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
                headers = MutableHeaders(scope=message)
                headers[HEADER_REQUEST_ID] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
            duration_ms = (time.perf_counter() - start) * 1000
            request_logger("ml-engine.request").info(
                "Request completed method=%s path=%s status=%s duration_ms=%.1f",
                method,
                path,
                status_code,
                duration_ms,
            )
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            request_logger("ml-engine.request").exception(
                "Request failed method=%s path=%s status=%s duration_ms=%.1f",
                method,
                path,
                status_code,
                duration_ms,
            )
            raise
        finally:
            _request_id_var.reset(token)


# ─── Log Injection (for stdlib logging) ──────────────────────────────────────

class RequestIdFilter(logging.Filter):
    """
    Logging filter that injects the current request ID into every LogRecord.

    Use with structlog or stdlib logging:
        handler.addFilter(RequestIdFilter())

    Each log record will have record.request_id set to the current request ID.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id_or_default("no-request-id")
        return True
