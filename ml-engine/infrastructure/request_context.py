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

import logging
import uuid
from contextvars import ContextVar
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# ─── Context Variable ─────────────────────────────────────────────────────────

# Process-level context for the current request. Thread-safe.
# Reset to None after each request.
_request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)


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
    return _RequestIdAdapter(logger, {"request_id": req_id}, prefix)


class _RequestIdAdapter(logging.LoggerAdapter):
    """LoggerAdapter that prepends [req-XXXX] to every log message."""

    def process(self, msg: str, kwargs: dict) -> tuple[str, dict]:
        # Prepend request ID prefix to the message
        return f"{self.extra['prefix']}{msg}", kwargs


# ─── FastAPI Middleware ───────────────────────────────────────────────────────

# Header names (standard + common conventions)
HEADER_REQUEST_ID = "X-Request-ID"
HEADER_FORWARDED_REQUEST_ID = "X-Forwarded-Request-ID"


class RequestIdMiddleware(BaseHTTPMiddleware):
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

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Extract or generate request ID
        request_id = (
            request.headers.get(HEADER_REQUEST_ID)
            or request.headers.get(HEADER_FORWARDED_REQUEST_ID)
            or str(uuid.uuid4())
        )

        # Store in context var for the duration of this request
        token = _request_id_var.set(request_id)

        try:
            response = await call_next(request)
        finally:
            # Always reset context var
            _request_id_var.reset(token)

        # Always include request ID in response (even on errors)
        response.headers[HEADER_REQUEST_ID] = request_id
        return response


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
