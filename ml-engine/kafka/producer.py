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
import sys
import json
import time
import signal
import logging
import functools
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

ALL_TOPICS = [
    TOPIC_CANDLES,
    TOPIC_CONSENSUS,
    TOPIC_PREDICTIONS,
    TOPIC_FEEDBACK,
    TOPIC_DRIFT,
]

KAFKA_REQUEST_ID_HEADER = "x-request-id"


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

        if self._enable:
            self._connect(**kwargs)
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
            "client.id": "traders-ml-engine",
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
            self._log(logging.INFO, "Producer connected to %s", self._bootstrap)
        except KafkaException as e:
            self._log(logging.ERROR, "Failed to connect: %s", e)
            self._enable = False

    def _delivery_callback(self, err, msg, request_id: str | None = None):
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
                self._log(logging.ERROR, "Delivery failed topic=%s error=%s", report["topic"], err)
            else:
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
                "triggered_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def _publish(self, topic: str, key: str, value: dict) -> bool:
        """
        Core publish method with delivery callback.
        Returns True if message was accepted by broker, False otherwise.
        """
        request_id = self._resolve_request_id(value)
        payload = {**value, "request_id": request_id}

        if not self._enable or self._producer is None:
            with request_id_context(request_id):
                self._log(logging.INFO, "Disabled; skipped publish topic=%s key=%s", topic, key)
            return True  # Graceful degradation

        try:
            self._producer.produce(
                topic=topic,
                key=key.encode("utf-8"),
                value=_dumps(payload),
                headers=self._build_headers(request_id),
                callback=functools.partial(self._delivery_callback, request_id=request_id),
            )
            self._producer.poll(0)  # Trigger delivery callbacks
            with request_id_context(request_id):
                self._log(logging.INFO, "Queued publish topic=%s key=%s", topic, key)
            return True
        except BufferError:
            with request_id_context(request_id):
                self._log(logging.WARNING, "Local queue full; waiting for delivery topic=%s", topic)
            self._producer.flush(timeout=5)
            return False
        except KafkaException as e:
            with request_id_context(request_id):
                self._log(logging.ERROR, "Publish error topic=%s error=%s", topic, e)
            return False

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
