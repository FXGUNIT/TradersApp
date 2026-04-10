"""
Kafka Producer — publishes TradersApp events to Kafka topics.

Topics:
  candle-data         — 5-min OHLCV candles
  consensus-signals   — ML consensus outputs
  model-predictions   — Per-model predictions
  feedback-loop       — Trade outcomes
  drift-alerts       — DriftMonitor alerts

Usage:
  from ml_engine.kafka.producer import KafkaProducerClient
  producer = KafkaProducerClient()
  producer.publish_candle(symbol="MNQ", candle={...})
  producer.publish_consensus(signal={...})
  producer.close()

Environment:
  KAFKA_BOOTSTRAP_SERVERS: Comma-separated broker list (default: localhost:9092)
  KAFKA_SECURITY_PROTOCOL: Security protocol (default: PLAINTEXT)
  KAFKA_SSL_CAFILE: CA certificate file (optional)
  KAFKA_ENABLE: Set to "false" to disable Kafka (default: true)
"""

from __future__ import annotations

import os
import socket
import sys
import json
import time
import signal
import logging
import functools
import threading
from collections import deque
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Any

import pandas as pd

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from infrastructure.request_context import (
        get_request_id,
        request_id_context,
        request_logger,
        generate_request_id,
    )
except ModuleNotFoundError:
    from ml_engine.infrastructure.request_context import (  # type: ignore
        get_request_id,
        request_id_context,
        request_logger,
        generate_request_id,
    )


try:
    from confluent_kafka import Producer, KafkaError, KafkaException
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False


# ─── Topic Definitions ────────────────────────────────────────────────────────────

TOPIC_CANDLES = "candle-data"
TOPIC_CONSENSUS = "consensus-signals"
TOPIC_PREDICTIONS = "model-predictions"
TOPIC_FEEDBACK = "feedback-loop"
TOPIC_DRIFT = "drift-alerts"
TOPIC_DLQ = "dead-letter-queue"

ALL_TOPICS = [
    TOPIC_CANDLES,
    TOPIC_CONSENSUS,
    TOPIC_PREDICTIONS,
    TOPIC_FEEDBACK,
    TOPIC_DRIFT,
    TOPIC_DLQ,
]

KAFKA_REQUEST_ID_HEADER = "x-request-id"

KAFKA_CB_CLOSED = "CLOSED"
KAFKA_CB_OPEN = "OPEN"
KAFKA_CB_HALF_OPEN = "HALF_OPEN"


class _JsonEncoder(json.JSONEncoder):
    """JSON encoder that handles datetime, pd.Timestamp, bytes, and numpy types."""
    def default(self, obj):
        if isinstance(obj, (datetime, pd.Timestamp)):
            return obj.isoformat()
        if hasattr(obj, "tolist"):
            return obj.tolist()
        if isinstance(obj, bytes):
            return obj.decode("utf-8", errors="replace")
        return super().default(obj)


def _dumps(obj: dict) -> bytes:
    return json.dumps(obj, cls=_JsonEncoder).encode("utf-8")


# ─── Kafka Producer ──────────────────────────────────────────────────────────────

class KafkaProducerClient:
    """
    Thread-safe Kafka producer for TradersApp events.
    Implements delivery reports with retry on failure.
    """

    def __init__(
        self,
        bootstrap_servers: str | None = None,
        enable: bool | None = None,
        **kwargs,
    ):
        self._enable = enable if enable is not None else os.environ.get("KAFKA_ENABLE", "true").lower() != "false"
        self._bootstrap = bootstrap_servers or os.environ.get(
            "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"
        )
        self._producer: Optional[Producer] = None
        self._delivery_reports: list[dict] = []
        self._closed = False
        self._logger_name = "ml-engine.kafka.producer"
        self._connect_kwargs = dict(kwargs)
        self._buffer_max_size = max(1, int(os.environ.get("KAFKA_BUFFER_MAX_SIZE", "1000")))
        self._buffer_retry_interval_seconds = max(
            0.5,
            float(os.environ.get("KAFKA_BUFFER_RETRY_INTERVAL_SECONDS", "5")),
        )
        self._buffer: deque[dict[str, Any]] = deque()
        self._buffer_lock = threading.Lock()
        self._circuit_state = KAFKA_CB_CLOSED
        self._failure_threshold = max(1, int(os.environ.get("KAFKA_CB_FAILURE_THRESHOLD", "3")))
        self._recovery_timeout_seconds = max(
            1.0,
            float(os.environ.get("KAFKA_CB_RECOVERY_TIMEOUT_SECONDS", "30")),
        )
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._buffered_count = 0
        self._dropped_count = 0
        self._stop_event = threading.Event()
        self._retry_thread: threading.Thread | None = None

        if self._enable:
            self._connect(**kwargs)
            self._start_retry_worker()
        else:
            self._log(logging.INFO, "Kafka disabled via KAFKA_ENABLE=false; messages will be skipped")

    def _log(self, level: int, message: str, *args):
        request_logger(self._logger_name).log(level, message, *args)

    def _connect(self, **kwargs):
        """Connect to Kafka broker."""
        if not KAFKA_AVAILABLE:
            self._log(logging.WARNING, "confluent-kafka not installed. Install: pip install confluent-kafka")
            self._enable = False
            return

        conf = {
            "bootstrap.servers": self._bootstrap,
            "client.id": f"traders-ml-engine-{os.environ.get('MY_POD_NAME', socket.gethostname())}",
            "acks": "all",                        # Wait for all replicas
            "retries": 3,
            "retry.backoff.ms": 1000,
            "max.in.flight.requests.per.connection": 1,  # Exactly-once semantics
            "enable.idempotence": True,
            "compression.type": "zstd",            # Compress messages
            "linger.ms": 5,                       # Batch up to 5ms
            "batch.size": 16384,                  # 16KB batch size
            **kwargs,
        }

        try:
            self._producer = Producer(conf)
            self._record_success()
            self._log(logging.INFO, "Producer connected to %s", self._bootstrap)
        except KafkaException as e:
            self._producer = None
            self._record_failure(e)
            self._log(logging.ERROR, "Failed to connect: %s", e)

    def _delivery_callback(self, err, msg, request_id: str | None = None, buffered_entry: dict[str, Any] | None = None):
        """Called when message is delivered or failed."""
        with request_id_context(request_id):
            report = {
                "topic": msg.topic() if msg else None,
                "partition": msg.partition() if msg else None,
                "offset": msg.offset() if msg else None,
                "error": str(err) if err else None,
                "request_id": request_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            self._delivery_reports.append(report)
            if err:
                self._record_failure(err)
                if buffered_entry is not None:
                    self._enqueue_buffered(
                        buffered_entry,
                        reason=f"delivery_failed:{err}",
                        increment_attempts=True,
                    )
                self._log(logging.ERROR, "Delivery failed topic=%s error=%s", report["topic"], err)
            else:
                self._record_success()
                self._log(
                    logging.INFO,
                    "Delivered topic=%s partition=%s offset=%s",
                    msg.topic(),
                    msg.partition(),
                    msg.offset(),
                )

    def _resolve_request_id(self, value: dict) -> str:
        return str(value.get("request_id") or get_request_id() or generate_request_id())

    def _build_headers(self, request_id: str, extra_headers: list[tuple[str, bytes]] | None = None) -> list[tuple[str, bytes]]:
        headers = [(KAFKA_REQUEST_ID_HEADER, request_id.encode("utf-8"))]
        if extra_headers:
            headers.extend(extra_headers)
        return headers

    def _start_retry_worker(self) -> None:
        if self._retry_thread is not None or not self._enable:
            return
        self._retry_thread = threading.Thread(
            target=self._retry_loop,
            name="kafka-producer-retry",
            daemon=True,
        )
        self._retry_thread.start()

    def _retry_loop(self) -> None:
        while not self._stop_event.wait(self._buffer_retry_interval_seconds):
            if self._closed or not self._enable:
                break
            try:
                self._drain_buffer()
            except Exception as exc:
                self._record_failure(exc)
                self._log(logging.ERROR, "Retry loop error: %s", exc)

    def _record_success(self) -> None:
        self._failure_count = 0
        if self._circuit_state in (KAFKA_CB_OPEN, KAFKA_CB_HALF_OPEN):
            self._log(logging.INFO, "Kafka circuit state %s -> %s", self._circuit_state, KAFKA_CB_CLOSED)
        self._circuit_state = KAFKA_CB_CLOSED

    def _record_failure(self, error: Exception | str) -> None:
        self._failure_count += 1
        self._last_failure_time = time.time()
        if self._circuit_state == KAFKA_CB_HALF_OPEN:
            self._circuit_state = KAFKA_CB_OPEN
        elif self._failure_count >= self._failure_threshold:
            self._circuit_state = KAFKA_CB_OPEN
        self._log(
            logging.WARNING,
            "Kafka failure recorded state=%s failures=%s error=%s",
            self._circuit_state,
            self._failure_count,
            error,
        )

    def _circuit_allows_attempt(self) -> bool:
        if self._circuit_state != KAFKA_CB_OPEN:
            return True
        if time.time() - self._last_failure_time >= self._recovery_timeout_seconds:
            self._circuit_state = KAFKA_CB_HALF_OPEN
            self._log(logging.INFO, "Kafka circuit OPEN -> HALF_OPEN")
            return True
        return False

    def _ensure_producer(self) -> bool:
        if not self._enable or not self._circuit_allows_attempt():
            return False
        if self._producer is not None:
            return True
        self._connect(**self._connect_kwargs)
        return self._producer is not None

    def _make_buffer_entry(self, topic: str, key: str, request_id: str, payload: dict) -> dict[str, Any]:
        return {
            "topic": topic,
            "key": key,
            "request_id": request_id,
            "payload": payload,
            "headers": self._build_headers(request_id),
            "queued_at": datetime.now(timezone.utc).isoformat(),
            "attempts": 0,
        }

    def _enqueue_buffered(
        self,
        entry: dict[str, Any],
        *,
        reason: str,
        increment_attempts: bool = False,
    ) -> None:
        entry_to_store = dict(entry)
        if increment_attempts:
            entry_to_store["attempts"] = int(entry_to_store.get("attempts", 0)) + 1
        with self._buffer_lock:
            if len(self._buffer) >= self._buffer_max_size:
                self._buffer.popleft()
                self._dropped_count += 1
            self._buffer.append(entry_to_store)
            self._buffered_count += 1
            buffered_size = len(self._buffer)
        with request_id_context(entry_to_store.get("request_id")):
            self._log(
                logging.WARNING,
                "Buffered Kafka message topic=%s key=%s reason=%s buffered=%s attempts=%s",
                entry_to_store.get("topic"),
                entry_to_store.get("key"),
                reason,
                buffered_size,
                entry_to_store.get("attempts", 0),
            )

    def _produce_entry(self, entry: dict[str, Any]) -> None:
        if self._producer is None:
            raise BufferError("Kafka producer is unavailable")
        self._producer.produce(
            topic=entry["topic"],
            key=str(entry["key"]).encode("utf-8"),
            value=_dumps(entry["payload"]),
            headers=entry["headers"],
            callback=functools.partial(
                self._delivery_callback,
                request_id=entry["request_id"],
                buffered_entry=entry,
            ),
        )
        self._producer.poll(0)

    def _drain_buffer(self, max_messages: int = 100) -> None:
        if not self._buffer:
            return
        if not self._ensure_producer():
            return

        drained = 0
        while drained < max_messages:
            with self._buffer_lock:
                if not self._buffer:
                    break
                entry = self._buffer[0]
            try:
                self._produce_entry(entry)
                with self._buffer_lock:
                    if self._buffer and self._buffer[0] is entry:
                        self._buffer.popleft()
                drained += 1
            except BufferError:
                break
            except Exception as exc:
                self._record_failure(exc)
                break

        if drained:
            self._log(logging.INFO, "Drained %s buffered Kafka message(s)", drained)

    # ─── Public API ─────────────────────────────────────────────────────────────

    def publish_candle(self, symbol: str, candle: dict) -> bool:
        """
        Publish a candle data point to the candle-data topic.
        Uses symbol as partition key for ordering within each symbol.
        """
        return self._publish(
            topic=TOPIC_CANDLES,
            key=symbol,
            value={**candle, "symbol": symbol, "published_at": datetime.now(timezone.utc).isoformat()},
        )

    def publish_candles(self, symbol: str, candles: list[dict]) -> bool:
        """
        Publish a batch of candles to the candle-data topic.
        Uses the first candle timestamp as event time.
        """
        if not candles:
            return True

        timestamp = candles[0].get("timestamp", datetime.now(timezone.utc).isoformat())
        return self._publish(
            topic=TOPIC_CANDLES,
            key=symbol,
            value={
                "symbol": symbol,
                "candles": candles,
                "count": len(candles),
                "start_time": timestamp,
                "published_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def publish_consensus(
        self,
        symbol: str,
        signal: dict,
        regime: str | None = None,
    ) -> bool:
        """
        Publish a consensus signal to the consensus-signals topic.
        Keyed by symbol for ordered processing.
        """
        return self._publish(
            topic=TOPIC_CONSENSUS,
            key=symbol,
            value={
                "symbol": symbol,
                "signal": signal.get("signal", "NEUTRAL"),
                "confidence": signal.get("confidence", 0.0),
                "long_score": signal.get("long_score", 0),
                "short_score": signal.get("short_score", 0),
                "votes": signal.get("votes", {}),
                "regime": regime,
                "generated_at": signal.get("generated_at", datetime.now(timezone.utc).isoformat()),
                "published_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def publish_prediction(
        self,
        symbol: str,
        model_name: str,
        prediction: dict,
    ) -> bool:
        """Publish per-model prediction to the model-predictions topic."""
        return self._publish(
            topic=TOPIC_PREDICTIONS,
            key=f"{symbol}:{model_name}",
            value={
                "symbol": symbol,
                "model_name": model_name,
                "signal": prediction.get("signal", "NEUTRAL"),
                "probability_long": prediction.get("probability_long", 0.5),
                "confidence": prediction.get("confidence", 0.0),
                "published_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def publish_trade_outcome(self, outcome: dict) -> bool:
        """Publish a trade outcome to the feedback-loop topic."""
        trade_id = outcome.get("trade_id") or outcome.get("id") or str(time.time())
        return self._publish(
            topic=TOPIC_FEEDBACK,
            key=trade_id,
            value={
                **outcome,
                "published_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def publish_drift_alert(
        self,
        alert_type: str,
        severity: str,
        metric_value: float,
        threshold: float,
        description: str,
    ) -> bool:
        """Publish a drift alert to the drift-alerts topic."""
        return self._publish(
            topic=TOPIC_DRIFT,
            key=alert_type,
            value={
                "alert_type": alert_type,
                "severity": severity,
                "metric_value": metric_value,
                "threshold": threshold,
                "description": description,
            },
        )

    def publish_dead_letter(
        self,
        original_topic: str,
        original_key: str | None,
        original_payload: dict,
        error: str,
    ) -> bool:
        """Forward an unprocessable message to the dead-letter-queue topic."""
        return self._publish(
            topic=TOPIC_DLQ,
            key=original_key or original_topic,
            value={
                "original_topic": original_topic,
                "original_key": original_key,
                "original_payload": original_payload,
                "error": error,
                "forwarded_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def _publish(self, topic: str, key: str, value: dict) -> bool:
        """
        Core publish method with delivery callback.
        Requests never fail because of Kafka availability: when Kafka is down,
        messages are buffered locally and retried in the background.
        """
        request_id = self._resolve_request_id(value)
        payload = {**value, "request_id": request_id}
        entry = self._make_buffer_entry(topic, key, request_id, payload)

        if not self._enable or self._producer is None:
            with request_id_context(request_id):
                if not self._enable:
                    self._log(logging.INFO, "Disabled; skipped publish topic=%s key=%s", topic, key)
                    return True
                self._enqueue_buffered(entry, reason="producer_unavailable")
            return True

        try:
            if not self._circuit_allows_attempt():
                with request_id_context(request_id):
                    self._enqueue_buffered(entry, reason="circuit_open")
                return True

            self._produce_entry(entry)
            self._drain_buffer()
            with request_id_context(request_id):
                self._log(logging.INFO, "Queued publish topic=%s key=%s", topic, key)
            return True
        except BufferError as exc:
            self._record_failure(exc)
            with request_id_context(request_id):
                self._enqueue_buffered(entry, reason="local_queue_full")
            return True
        except Exception as exc:
            self._record_failure(exc)
            with request_id_context(request_id):
                self._enqueue_buffered(entry, reason=f"publish_error:{exc}")
                self._log(logging.ERROR, "Publish error topic=%s error=%s", topic, exc)
            return True

    def flush(self, timeout: float = 10.0):
        """Flush pending messages to broker."""
        if self._producer:
            remaining = self._producer.flush(timeout=timeout)
            self._log(logging.INFO, "Flush complete; %s messages remaining in queue", remaining)

    def close(self):
        """Close producer gracefully."""
        if self._closed:
            return
        self._closed = True
        self._stop_event.set()
        if self._retry_thread and self._retry_thread.is_alive():
            self._retry_thread.join(timeout=2)
        if self._producer:
            self.flush(timeout=10.0)
            self._producer = None
        self._log(logging.INFO, "Producer closed")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def get_stats(self) -> dict:
        """Get producer statistics."""
        return {
            "enable": self._enable,
            "bootstrap": self._bootstrap,
            "connected": self._producer is not None,
            "circuit_state": self._circuit_state,
            "buffered_messages": len(self._buffer),
            "buffered_total": self._buffered_count,
            "buffer_dropped": self._dropped_count,
            "delivery_reports": self._delivery_reports[-100:],  # Last 100 reports
            "queue_size": self._producer.outq_len() if self._producer else 0,
        }


# ─── Kafka Producer as Context Manager ─────────────────────────────────────────

_producer_instance: Optional[KafkaProducerClient] = None


def get_producer() -> KafkaProducerClient:
    """Get or create the singleton Kafka producer."""
    global _producer_instance
    if _producer_instance is None:
        _producer_instance = KafkaProducerClient()
    return _producer_instance


if __name__ == "__main__":
    print("[Kafka] Producer CLI")
    print("Usage: from ml_engine.kafka.producer import KafkaProducerClient")
    producer = KafkaProducerClient()
    print(f"Stats: {producer.get_stats()}")
