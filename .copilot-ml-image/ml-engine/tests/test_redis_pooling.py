from types import SimpleNamespace

from infrastructure import performance


def test_redis_cache_reuses_shared_connection_pool(monkeypatch):
    created_pools = []

    class DummyPool:
        def __init__(self, **kwargs):
            self.kwargs = kwargs
            self.max_connections = kwargs["max_connections"]
            self.current_connections = 0

        def disconnect(self):
            return None

        def in_use_connection_count(self):
            return 0

    class DummyRedis:
        def __init__(self, connection_pool):
            self.connection_pool = connection_pool

        def ping(self):
            return True

    def make_pool(**kwargs):
        pool = DummyPool(**kwargs)
        created_pools.append(pool)
        return pool

    monkeypatch.setattr(
        performance,
        "redis",
        SimpleNamespace(ConnectionPool=make_pool, Redis=DummyRedis),
    )
    monkeypatch.setattr(performance, "REDIS_AVAILABLE", True)

    performance.RedisCache._global_pools.clear()
    try:
        cfg = performance.CacheConfig(host="redis.internal", port=6380, db=2, max_connections=11)
        cache_a = performance.RedisCache(cfg)
        cache_b = performance.RedisCache(cfg)

        assert len(created_pools) == 1
        assert cache_a._client is not None
        assert cache_b._client is not None
        assert cache_a._client.connection_pool is cache_b._client.connection_pool
        assert cache_a.get_stats()["pool_key"] == ("redis.internal", 6380, 2)
    finally:
        performance.RedisCache._global_pools.clear()
