"""
Redis-backed idempotency coordinator for retry-safe API endpoints.

The coordinator stores completed responses in Redis and uses a short-lived
lock key to ensure only one worker processes a given idempotency key at a
time across all pods.
"""
from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass
from hashlib import sha256
from typing import Any

import config

try:
    import redis

    REDIS_AVAILABLE = True
except ImportError:  # pragma: no cover
    redis = None
    REDIS_AVAILABLE = False


DEFAULT_PREFIX = os.getenv("IDEMPOTENCY_REDIS_PREFIX", "tradersapp:idempotency")


@dataclass(slots=True)
class IdempotencyClaim:
    scope: str
    key: str
    fingerprint: str
    owner: bool
    replay_response: Any | None = None
    in_progress: bool = False


class IdempotencyService:
    """Coordinates idempotent request execution across distributed workers."""

    _pool: Any | None = None
    _pool_lock = threading.Lock()

    def __init__(self, redis_url: str | None = None, prefix: str = DEFAULT_PREFIX, client: Any | None = None) -> None:
        self.prefix = prefix
        self._client = client or self._connect(redis_url or config.REDIS_URL)

    @classmethod
    def _connect(cls, redis_url: str) -> "redis.Redis | None":
        if not REDIS_AVAILABLE:
            return None

        with cls._pool_lock:
            if cls._pool is None:
                cls._pool = redis.ConnectionPool.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_timeout=0.5,
                    socket_connect_timeout=0.5,
                    health_check_interval=30,
                    retry_on_timeout=True,
                )

        try:
            client = redis.Redis(connection_pool=cls._pool)
            client.ping()
            return client
        except Exception:
            return None

    def available(self) -> bool:
        return self._client is not None

    def _base_key(self, scope: str, key: str) -> str:
        return f"{self.prefix}:{scope}:{key}"

    def _response_key(self, scope: str, key: str) -> str:
        return f"{self._base_key(scope, key)}:response"

    def _lock_key(self, scope: str, key: str) -> str:
        return f"{self._base_key(scope, key)}:lock"

    @staticmethod
    def fingerprint(payload: Any) -> str:
        normalized = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
        return sha256(normalized.encode("utf-8")).hexdigest()

    def _load_envelope(self, scope: str, key: str) -> dict[str, Any] | None:
        if self._client is None:
            return None

        data = self._client.get(self._response_key(scope, key))
        if not data:
            return None
        return json.loads(data)

    def _load_lock_fingerprint(self, scope: str, key: str) -> str | None:
        if self._client is None:
            return None
        value = self._client.get(self._lock_key(scope, key))
        return str(value) if value else None

    def _acquire_lock(self, scope: str, key: str, fingerprint: str, lock_ttl_seconds: int) -> bool:
        if self._client is None:
            return True
        return bool(
            self._client.set(
                self._lock_key(scope, key),
                fingerprint,
                nx=True,
                ex=max(1, int(lock_ttl_seconds)),
            )
        )

    def claim(
        self,
        scope: str,
        key: str | None,
        payload: Any,
        *,
        wait_timeout_seconds: float = 2.0,
        poll_interval_seconds: float = 0.05,
        lock_ttl_seconds: int = 30,
    ) -> IdempotencyClaim | None:
        """
        Claim ownership for processing or return a cached replay response.

        Returns:
        - `None` when no idempotency key is available.
        - `IdempotencyClaim(..., owner=True)` for the active worker.
        - `IdempotencyClaim(..., replay_response=...)` when a prior response exists.
        - `IdempotencyClaim(..., in_progress=True)` when another worker still owns the key.
        """
        if not key:
            return None

        fingerprint = self.fingerprint(payload)

        if self._client is None:
            return IdempotencyClaim(scope=scope, key=key, fingerprint=fingerprint, owner=True)

        envelope = self._load_envelope(scope, key)
        if envelope is not None:
            self._ensure_matching_fingerprint(scope, key, fingerprint, envelope.get("fingerprint"))
            return IdempotencyClaim(
                scope=scope,
                key=key,
                fingerprint=fingerprint,
                owner=False,
                replay_response=envelope.get("response"),
            )

        if self._acquire_lock(scope, key, fingerprint, lock_ttl_seconds):
            return IdempotencyClaim(scope=scope, key=key, fingerprint=fingerprint, owner=True)

        deadline = time.time() + max(0.0, wait_timeout_seconds)
        while time.time() < deadline:
            envelope = self._load_envelope(scope, key)
            if envelope is not None:
                self._ensure_matching_fingerprint(scope, key, fingerprint, envelope.get("fingerprint"))
                return IdempotencyClaim(
                    scope=scope,
                    key=key,
                    fingerprint=fingerprint,
                    owner=False,
                    replay_response=envelope.get("response"),
                )
            time.sleep(max(0.01, poll_interval_seconds))

        self._ensure_matching_fingerprint(scope, key, fingerprint, self._load_lock_fingerprint(scope, key))
        return IdempotencyClaim(scope=scope, key=key, fingerprint=fingerprint, owner=False, in_progress=True)

    def store_response(self, claim: IdempotencyClaim | None, response: Any, ttl_seconds: int) -> None:
        if claim is None or not claim.owner or self._client is None:
            return

        envelope = {
            "fingerprint": claim.fingerprint,
            "stored_at": time.time(),
            "response": response,
        }
        pipe = self._client.pipeline()
        pipe.setex(
            self._response_key(claim.scope, claim.key),
            max(1, int(ttl_seconds)),
            json.dumps(envelope, default=str),
        )
        pipe.delete(self._lock_key(claim.scope, claim.key))
        pipe.execute()

    def release(self, claim: IdempotencyClaim | None) -> None:
        if claim is None or self._client is None:
            return

        lock_key = self._lock_key(claim.scope, claim.key)
        current = self._client.get(lock_key)
        if current == claim.fingerprint:
            self._client.delete(lock_key)

    @staticmethod
    def _ensure_matching_fingerprint(scope: str, key: str, fingerprint: str, existing: str | None) -> None:
        if existing and existing != fingerprint:
            raise ValueError(
                f"Idempotency key '{key}' for scope '{scope}' was reused with a different payload."
            )


_idempotency_service: IdempotencyService | None = None
_idempotency_lock = threading.Lock()


def get_idempotency_service() -> IdempotencyService:
    global _idempotency_service
    with _idempotency_lock:
        if _idempotency_service is None:
            _idempotency_service = IdempotencyService()
    return _idempotency_service
