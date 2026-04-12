from __future__ import annotations

from types import SimpleNamespace

from data import candle_db as candle_db_module


class _FakePool:
    def __init__(self):
        self.closed = False

    def closeall(self):
        self.closed = True


def _enable_fake_postgres(monkeypatch, factory):
    monkeypatch.setattr(candle_db_module, "PSYCOPG2_AVAILABLE", True)
    monkeypatch.setattr(
        candle_db_module,
        "pool",
        SimpleNamespace(ThreadedConnectionPool=factory),
    )


def test_postgres_backend_retries_transient_pool_bootstrap_failures(monkeypatch):
    attempts = []
    created_pools = []

    def fake_pool(min_connections, max_connections, database_url):
        attempts.append((min_connections, max_connections, database_url))
        if len(attempts) < 3:
            raise RuntimeError("Temporary failure in name resolution")
        created_pools.append(_FakePool())
        return created_pools[-1]

    sleep_calls = []
    _enable_fake_postgres(monkeypatch, fake_pool)
    monkeypatch.setenv("POSTGRES_CONNECT_RETRY_ATTEMPTS", "3")
    monkeypatch.setenv("POSTGRES_CONNECT_RETRY_DELAY_SECONDS", "0.25")
    monkeypatch.setenv("POSTGRES_CONNECT_RETRY_BACKOFF", "2")
    monkeypatch.setattr(
        candle_db_module.time,
        "sleep",
        lambda seconds: sleep_calls.append(seconds),
    )
    monkeypatch.setattr(candle_db_module.PostgresBackend, "_init_schema", lambda self: None)

    backend = candle_db_module.PostgresBackend("postgresql://example/db")

    assert len(attempts) == 3
    assert sleep_calls == [0.25, 0.5]
    assert backend._pool is created_pools[0]


def test_postgres_backend_retries_schema_init_and_closes_failed_pools(monkeypatch):
    created_pools = []

    def fake_pool(min_connections, max_connections, database_url):
        created_pools.append(_FakePool())
        return created_pools[-1]

    schema_attempts = []
    sleep_calls = []

    def fake_init_schema(self):
        schema_attempts.append(self._pool)
        if len(schema_attempts) == 1:
            raise RuntimeError("database not ready")

    _enable_fake_postgres(monkeypatch, fake_pool)
    monkeypatch.setenv("POSTGRES_CONNECT_RETRY_ATTEMPTS", "2")
    monkeypatch.setenv("POSTGRES_CONNECT_RETRY_DELAY_SECONDS", "0.1")
    monkeypatch.setenv("POSTGRES_CONNECT_RETRY_BACKOFF", "1")
    monkeypatch.setattr(
        candle_db_module.time,
        "sleep",
        lambda seconds: sleep_calls.append(seconds),
    )
    monkeypatch.setattr(candle_db_module.PostgresBackend, "_init_schema", fake_init_schema)

    backend = candle_db_module.PostgresBackend("postgresql://example/db")

    assert len(created_pools) == 2
    assert created_pools[0].closed is True
    assert created_pools[1].closed is False
    assert backend._pool is created_pools[1]
    assert sleep_calls == [0.1]
