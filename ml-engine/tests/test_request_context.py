from fastapi import FastAPI
from fastapi.testclient import TestClient

from infrastructure.request_context import RequestIdMiddleware, get_request_id


def build_test_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)

    @app.get("/ping")
    async def ping():
        return {"request_id": get_request_id()}

    @app.get("/boom")
    async def boom():
        raise RuntimeError("boom")

    return app


def test_request_id_generated_and_returned():
    client = TestClient(build_test_app())

    response = client.get("/ping")

    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    assert response.json()["request_id"] == response.headers["X-Request-ID"]


def test_request_id_preserved_from_incoming_header():
    client = TestClient(build_test_app())

    response = client.get("/ping", headers={"X-Request-ID": "req-test-123"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "req-test-123"
    assert response.json()["request_id"] == "req-test-123"


def test_request_id_header_present_on_error_response():
    client = TestClient(build_test_app(), raise_server_exceptions=False)

    response = client.get("/boom", headers={"X-Request-ID": "req-error-500"})

    assert response.status_code == 500
    assert response.headers["X-Request-ID"] == "req-error-500"
