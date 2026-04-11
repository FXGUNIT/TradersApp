from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from infrastructure.request_context import (
    RequestIdMiddleware,
    install_request_id_logging,
    request_id_context,
)


class RecordingHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)


def build_test_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)

    @app.get("/ping")
    async def ping() -> dict[str, bool]:
        return {"ok": True}

    return app


def test_request_id_filter_injects_request_id_into_log_records() -> None:
    logger = logging.getLogger("test.request_context.filter")
    handler = RecordingHandler()
    original_handlers = logger.handlers[:]
    original_level = logger.level
    original_propagate = logger.propagate

    logger.handlers = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False

    try:
        install_request_id_logging(logger)

        with request_id_context("request-filter-123"):
            logger.info("hello from filter")
    finally:
        logger.handlers = original_handlers
        logger.setLevel(original_level)
        logger.propagate = original_propagate

    assert handler.records
    record = handler.records[0]
    assert record.request_id == "request-filter-123"
    assert record.getMessage() == "hello from filter"


def test_request_middleware_log_record_carries_request_id(caplog) -> None:
    logger = logging.getLogger("ml-engine.request")
    original_level = logger.level
    logger.setLevel(logging.INFO)

    try:
        install_request_id_logging(logger)
        client = TestClient(build_test_app())

        with caplog.at_level(logging.INFO, logger="ml-engine.request"):
            response = client.get("/ping", headers={"X-Request-ID": "request-middleware-123"})
    finally:
        logger.setLevel(original_level)

    assert response.status_code == 200

    records = [
        record
        for record in caplog.records
        if record.name == "ml-engine.request" and "Request completed" in record.getMessage()
    ]

    assert records
    record = records[-1]
    assert record.request_id == "request-middleware-123"
    assert record.getMessage().startswith("[req-request-middleware-123] Request completed")
