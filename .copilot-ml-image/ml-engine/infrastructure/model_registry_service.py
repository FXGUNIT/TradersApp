"""
Redis-backed model registry for stateless serving.

The registry owns loaded model instances and exposes predictor / regime access
through a bounded LRU cache. Redis stores shared access metadata so pods can
coordinate cache invalidation and access order without relying on process
globals in the main ML API.
"""
from __future__ import annotations

import json
import os
import socket
import threading
import time
from collections import OrderedDict
from typing import Any, Callable

import pandas as pd

import config
from inference.predictor import Predictor
from models.regime.regime_ensemble import RegimeEnsemble
from training.model_store import ModelStore

try:
    import redis

    REDIS_AVAILABLE = True
except ImportError:  # pragma: no cover
    redis = None
    REDIS_AVAILABLE = False


class ModelRegistryService:
    """Owns loaded model instances for the serving process."""

    PREDICTOR = "predictor"
    REGIME_ENSEMBLE = "regime_ensemble"

    def __init__(
        self,
        store_dir: str | None = None,
        redis_url: str | None = None,
        max_cached_instances: int | None = None,
        cache_prefix: str | None = None,
    ) -> None:
        self.store_dir = store_dir or config.MODEL_STORE
        self.store = ModelStore(self.store_dir)
        self.max_cached_instances = max(1, max_cached_instances or config.MODEL_REGISTRY_MAX_CACHED_INSTANCES)
        self.cache_prefix = cache_prefix or config.MODEL_REGISTRY_CACHE_PREFIX
        self._instances: OrderedDict[str, Any] = OrderedDict()
        self._lock = threading.RLock()
        self._redis = self._connect_redis(redis_url or config.REDIS_URL)
        self._pod_id = os.getenv("HOSTNAME") or socket.gethostname()

    def _connect_redis(self, redis_url: str) -> "redis.Redis | None":
        if not REDIS_AVAILABLE:
            return None
        try:
            client = redis.Redis.from_url(
                redis_url,
                decode_responses=True,
                socket_timeout=0.5,
                socket_connect_timeout=0.5,
                health_check_interval=30,
            )
            client.ping()
            return client
        except Exception as exc:
            print(f"[ModelRegistry] Redis unavailable ({exc})")
            return None

    def _meta_key(self, instance_name: str) -> str:
        return f"{self.cache_prefix}:meta:{instance_name}"

    def _lru_key(self) -> str:
        return f"{self.cache_prefix}:lru"

    def _touch(self, instance_name: str, extra: dict[str, Any] | None = None) -> None:
        if self._redis is None:
            return
        now = time.time()
        payload = {
            "instance": instance_name,
            "pod_id": self._pod_id,
            "last_access_ts": now,
            "last_access_iso": pd.Timestamp(now, unit="s", tz="UTC").isoformat(),
        }
        if extra:
            payload.update(extra)
        try:
            pipe = self._redis.pipeline()
            pipe.zadd(self._lru_key(), {instance_name: now})
            pipe.hset(self._meta_key(instance_name), mapping={k: json.dumps(v, default=str) for k, v in payload.items()})
            pipe.expire(self._meta_key(instance_name), 86400)
            pipe.execute()
        except Exception:
            pass

    def _remove_metadata(self, instance_name: str) -> None:
        if self._redis is None:
            return
        try:
            pipe = self._redis.pipeline()
            pipe.zrem(self._lru_key(), instance_name)
            pipe.delete(self._meta_key(instance_name))
            pipe.execute()
        except Exception:
            pass

    def _load_predictor(self) -> Predictor:
        predictor = Predictor(store_dir=self.store_dir)
        predictor.load_all_models()
        self._touch(
            self.PREDICTOR,
            {
                "loaded_model_count": len(predictor._models),
                "loaded_models": sorted(predictor._models.keys()),
                "versions": {name: data.get("version") for name, data in predictor._models.items()},
            },
        )
        return predictor

    def _load_regime_ensemble(self) -> RegimeEnsemble:
        ensemble = RegimeEnsemble(random_state=42)
        self._touch(self.REGIME_ENSEMBLE, {"loaded_model_count": 1})
        return ensemble

    def _loader_for(self, instance_name: str) -> Callable[[], Any]:
        if instance_name == self.PREDICTOR:
            return self._load_predictor
        if instance_name == self.REGIME_ENSEMBLE:
            return self._load_regime_ensemble
        raise KeyError(f"Unknown model instance '{instance_name}'")

    def _status_for_instance(self, instance_name: str, instance: Any | None) -> dict[str, Any]:
        cached = instance is not None
        if instance_name == self.PREDICTOR:
            loaded_models = sorted(instance._models.keys()) if cached else []
            return {
                "cached": cached,
                "ready": bool(cached and instance.is_ready),
                "loaded_model_count": len(loaded_models),
                "loaded_models": loaded_models,
                "versions": {name: data.get("version") for name, data in instance._models.items()} if cached else {},
            }
        if instance_name == self.REGIME_ENSEMBLE:
            return {
                "cached": cached,
                "ready": cached,
                "loaded_model_count": 1 if cached else 0,
            }
        return {"cached": cached}

    def _evict_if_needed(self) -> None:
        while len(self._instances) > self.max_cached_instances:
            evicted_name, _ = self._instances.popitem(last=False)
            self._remove_metadata(evicted_name)

    def _get_instance(self, instance_name: str) -> Any:
        with self._lock:
            if instance_name in self._instances:
                instance = self._instances.pop(instance_name)
                self._instances[instance_name] = instance
                self._touch(instance_name, self._status_for_instance(instance_name, instance))
                return instance

        instance = self._loader_for(instance_name)()

        with self._lock:
            existing = self._instances.get(instance_name)
            if existing is not None:
                self._instances.move_to_end(instance_name)
                self._touch(instance_name, self._status_for_instance(instance_name, existing))
                return existing

            self._instances[instance_name] = instance
            self._evict_if_needed()
            self._touch(instance_name, self._status_for_instance(instance_name, instance))
            return instance

    def warm_models(self, names: list[str] | None = None) -> dict[str, Any]:
        for name in names or [self.PREDICTOR, self.REGIME_ENSEMBLE]:
            self._get_instance(name)
        return self.status()

    def invalidate(self, names: list[str] | None = None) -> dict[str, Any]:
        with self._lock:
            target_names = names or list(self._instances.keys())
            for name in target_names:
                self._instances.pop(name, None)
                self._remove_metadata(name)
        return self.status()

    def predict(
        self,
        candles_df: pd.DataFrame,
        trade_log_df: pd.DataFrame | None = None,
        math_engine_snapshot: dict | None = None,
        key_levels: dict | None = None,
    ) -> dict[str, Any]:
        predictor = self._get_instance(self.PREDICTOR)
        result = predictor.predict(
            candles_df=candles_df,
            trade_log_df=trade_log_df,
            math_engine_snapshot=math_engine_snapshot,
            key_levels=key_levels,
        )
        self._touch(self.PREDICTOR, self._status_for_instance(self.PREDICTOR, predictor))
        return result

    def advance_regime(self, feature_df: pd.DataFrame) -> dict[str, Any]:
        ensemble = self._get_instance(self.REGIME_ENSEMBLE)
        result = ensemble.advance(feature_df)
        self._touch(self.REGIME_ENSEMBLE, self._status_for_instance(self.REGIME_ENSEMBLE, ensemble))
        return result

    def status(self) -> dict[str, Any]:
        with self._lock:
            predictor = self._instances.get(self.PREDICTOR)
            regime = self._instances.get(self.REGIME_ENSEMBLE)
            cached_instances = list(self._instances.keys())

        return {
            "mode": "service",
            "redis_available": self._redis is not None,
            "cache_prefix": self.cache_prefix,
            "max_cached_instances": self.max_cached_instances,
            "cached_instances": cached_instances,
            "available_models": self.store.list_all_models(),
            "predictor": self._status_for_instance(self.PREDICTOR, predictor),
            "regime_ensemble": self._status_for_instance(self.REGIME_ENSEMBLE, regime),
        }

    def close(self) -> None:
        if self._redis is not None:
            try:
                self._redis.close()
            except Exception:
                pass
