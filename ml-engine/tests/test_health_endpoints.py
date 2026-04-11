import sqlite3

import _health


class _FakeDb:
    backend_type = "postgresql"

    def get_stats(self):
        return {
            "candles": 0,
            "trades": 0,
            "sessions": 0,
            "last_training": None,
        }

    def health_check(self):
        return True


class _LockedRegistry:
    def get_all(self):
        raise sqlite3.OperationalError("database is locked")


def test_health_tolerates_lineage_registry_lock(monkeypatch):
    monkeypatch.setattr(_health, "db", _FakeDb())
    monkeypatch.setattr(_health, "lineage_registry", _LockedRegistry())
    monkeypatch.setattr(_health, "feast_warmed", False)

    payload = _health.health()

    assert payload["status"] == "healthy"
    assert payload["db_backend"] == "postgresql"
    assert payload["feast"]["lineage_registered"] == 0
    assert "lineage_error" in payload["feast"]
