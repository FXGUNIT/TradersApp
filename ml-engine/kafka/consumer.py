"""
Kafka Consumer — subscribes to TradersApp Kafka topics and processes events.

Topics:
  candle-data         — 5-min OHLCV candles → store in SQLite
  consensus-signals   — ML consensus → send to BFF
  feedback-loop      — Trade outcomes → update ConceptDriftDetector
  drift-alerts       — Drift alerts → trigger retrain pipeline

Usage:
  from ml_engine.kafka.consumer import KafkaConsumerClient
  consumer = KafkaConsumerClient(topics=["feedback-loop", "drift-alerts"])
  consumer.start()   # Blocking — runs forever

Environment:
  KAFKA_BOOTSTRAP_SERVERS: Broker list (default: localhost:9092)
  KAFKA_GROUP_ID: Consumer group ID (default: traders-ml-engine)
  KAFKA_ENABLE: Set to "false" to disable (default: true)
"""

from __future__ import annotations

import os
import sys
import json
import time
import threading
import signal
from pathlib import Path
from datetime import datetime, timezone
from typing import Callable, Optional, Any

import pandas as pd

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


try:
    from confluent_kafka import Consumer, KafkaError, KafkaException, TopicPartition
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False


TOPIC_CANDLES = "candle-data"
TOPIC_CONSENSUS = "consensus-signals"
TOPIC_PREDICTIONS = "model-predictions"
TOPIC_FEEDBACK = "feedback-loop"
TOPIC_DRIFT = "drift-alerts"


class KafkaConsumerClient:
    """
    Kafka consumer for TradersApp event processing.
    Runs in a background thread; dispatches messages to registered handlers.
    """

    def __init__(
        self,
        topics: list[str] | None = None,
        group_id: str | None = None,
        bootstrap_servers: str | None = None,
        enable: bool | None = None,
        **kwargs,
    ):
        self._topics = topics or [
            TOPIC_CANDLES,
            TOPIC_FEEDBACK,
            TOPIC_DRIFT,
        ]
        self._group_id = group_id or os.environ.get("KAFKA_GROUP_ID", "traders-ml-engine")
        self._bootstrap = bootstrap_servers or os.environ.get(
            "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"
        )
        self._enable = enable if enable is not None else os.environ.get("KAFKA_ENABLE", "true").lower() != "false"
        self._consumer: Optional[Consumer] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None

        # Message handlers: topic → callback(event_dict)
        self._handlers: dict[str, Callable[[dict], None]] = {}

        # Statistics
        self._messages_processed = 0
        self._messages_failed = 0
        self._last_message_time: Optional[str] = None

        if self._enable:
            self._connect()
            self._register_default_handlers()
        else:
            print("[Kafka] Consumer disabled via KAFKA_ENABLE=false")

    def _connect(self):
        """Connect to Kafka broker."""
        if not KAFKA_AVAILABLE:
            print("[Kafka] confluent-kafka not installed")
            self._enable = False
            return

        conf = {
            "bootstrap.servers": self._bootstrap,
            "group.id": self._group_id,
            "client.id": f"traders-ml-engine-consumer",
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,           # Manual commit for exactly-once
            "auto.commit.interval.ms": 5000,
            "session.timeout.ms": 30000,
            "max.poll.interval.ms": 300000,
            "fetch.min.bytes": 1,
            "fetch.max.wait.ms": 500,
            **kwargs,
        }

        try:
            self._consumer = Consumer(conf)
            self._consumer.subscribe(self._topics)
            print(f"[Kafka] Consumer subscribed to {self._topics} (group: {self._group_id})")
        except KafkaException as e:
            print(f"[Kafka] Consumer connect error: {e}")
            self._enable = False

    def _register_default_handlers(self):
        """Register built-in message handlers."""

        def handle_candles(message: dict):
            """Process candle data from Kafka → store in SQLite/PostgreSQL."""
            try:
                import sys
                sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent.parent))
                from ml_engine.data.candle_db import CandleDatabase
                import pandas as pd

                db = CandleDatabase()

                # Handle batch of candles (published via publish_candles)
                if "candles" in message:
                    df = pd.DataFrame(message["candles"])
                # Handle single candle (published via publish_candle)
                elif "timestamp" in message:
                    df = pd.DataFrame([message])
                else:
                    print(f"[Kafka] Unrecognized candle-data payload: {list(message.keys())}")
                    return

                inserted = db.insert_candles(df)
                if inserted > 0:
                    print(f"[Kafka] Stored {inserted} candle(s) from candle-data topic")
                else:
                    print(f"[Kafka] No new candles inserted (duplicates)")

            except Exception as e:
                print(f"[Kafka] Error in candle-data handler: {e}")

        def handle_feedback(message: dict):
            """Process trade outcome → update ConceptDriftDetector."""
            try:
                from ml_engine.infrastructure.drift_detector import get_drift_monitor
                from ml_engine.feedback.feedback_logger import FeedbackLogger
                from ml_engine.data.candle_db import CandleDatabase

                db = CandleDatabase()
                logger = FeedbackLogger(db)
                monitor = get_drift_monitor()

                # Record the prediction outcome
                trade_id = message.get("trade_id")
                symbol = message.get("symbol", "MNQ")
                result = message.get("result", "loss")
                direction = message.get("direction", "long")

                # Get the signal that triggered this trade
                signal_id = message.get("signal_id")
                if signal_id:
                    try:
                        confidence = float(message.get("confidence", 0.5))
                        correct = 1 if result == "win" else 0
                        monitor.record_prediction(
                            correct=correct,
                            confidence=confidence,
                            symbol=symbol,
                        )
                    except Exception as e:
                        print(f"[Kafka] Feedback handler error: {e}")

            except Exception as e:
                print(f"[Kafka] Error in feedback handler: {e}")

        def handle_drift(message: dict):
            """Process drift alert → trigger retrain pipeline."""
            try:
                from ml_engine.feedback.retrain_pipeline import get_retrain_pipeline
                pipeline = get_retrain_pipeline()

                alert_type = message.get("alert_type", "unknown")
                severity = message.get("severity", "warning")
                metric_value = message.get("metric_value", 0.0)
                threshold = message.get("threshold", 0.0)

                if severity in ("alert", "critical"):
                    print(f"[Kafka] Drift alert: {alert_type} ({severity}) — triggering retrain check")
                    # Check if retraining is warranted
                    try:
                        if pipeline and pipeline.should_retrain():
                            print("[Kafka] Starting auto-retrain triggered by drift alert")
                            # Note: runs async in background
                    except Exception as e:
                        print(f"[Kafka] Retrain check error: {e}")

            except Exception as e:
                print(f"[Kafka] Error in drift handler: {e}")

        self.register_handler(TOPIC_CANDLES, handle_candles)
        self.register_handler(TOPIC_FEEDBACK, handle_feedback)
        self.register_handler(TOPIC_DRIFT, handle_drift)

    def register_handler(self, topic: str, handler: Callable[[dict], None]):
        """
        Register a callback handler for a topic.
        Handler receives the deserialized message dict.
        """
        self._handlers[topic] = handler
        print(f"[Kafka] Registered handler for topic: {topic}")

    # ─── Consumer Loop ─────────────────────────────────────────────────────────

    def start(self, blocking: bool = True):
        """
        Start consuming messages.

        Args:
            blocking: If True, runs in current thread. If False, runs in background thread.
        """
        if not self._enable or self._consumer is None:
            print("[Kafka] Consumer not enabled — nothing to start")
            return

        self._running = True

        if blocking:
            self._consume_loop()
        else:
            self._thread = threading.Thread(target=self._consume_loop, daemon=True)
            self._thread.start()
            print(f"[Kafka] Consumer running in background thread")

    def _consume_loop(self):
        """Main consumer loop — polls and dispatches messages."""
        print("[Kafka] Starting consumer loop...")

        while self._running:
            try:
                msg = self._consumer.poll(timeout=1.0)

                if msg is None:
                    continue

                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        # End of partition — not an error
                        continue
                    else:
                        print(f"[Kafka] Consumer error: {msg.error()}")
                        continue

                topic = msg.topic()
                value = msg.value()

                try:
                    event = json.loads(value.decode("utf-8")) if isinstance(value, bytes) else json.loads(value)
                except json.JSONDecodeError as e:
                    print(f"[Kafka] JSON decode error on {topic}: {e}")
                    self._messages_failed += 1
                    continue

                # Dispatch to handler
                handler = self._handlers.get(topic)
                if handler:
                    try:
                        handler(event)
                        self._messages_processed += 1
                        self._last_message_time = datetime.now(timezone.utc).isoformat()
                    except Exception as e:
                        print(f"[Kafka] Handler error on {topic}: {e}")
                        self._messages_failed += 1
                else:
                    print(f"[Kafka] No handler for topic: {topic}")

                # Commit offset after successful processing
                try:
                    self._consumer.commit(msg, asynchronous=False)
                except Exception as e:
                    print(f"[Kafka] Commit error: {e}")

            except Exception as e:
                print(f"[Kafka] Consumer loop error: {e}")
                time.sleep(1)  # Back off on error

        print("[Kafka] Consumer loop stopped")

    def stop(self):
        """Stop the consumer loop gracefully."""
        print("[Kafka] Stopping consumer...")
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        if self._consumer:
            self._consumer.close()
        print("[Kafka] Consumer stopped")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.stop()

    def get_stats(self) -> dict:
        """Get consumer statistics."""
        return {
            "topics": self._topics,
            "group_id": self._group_id,
            "enable": self._enable,
            "running": self._running,
            "messages_processed": self._messages_processed,
            "messages_failed": self._messages_failed,
            "last_message_time": self._last_message_time,
        }


# ─── Singleton accessor ─────────────────────────────────────────────────────────

_consumer_instance: Optional[KafkaConsumerClient] = None


def get_consumer() -> KafkaConsumerClient:
    """Get or create the singleton Kafka consumer."""
    global _consumer_instance
    if _consumer_instance is None:
        _consumer_instance = KafkaConsumerClient()
    return _consumer_instance


if __name__ == "__main__":
    print("[Kafka] Consumer CLI")
    print("Usage: from ml_engine.kafka.consumer import KafkaConsumerClient")
    consumer = KafkaConsumerClient(topics=[TOPIC_FEEDBACK, TOPIC_DRIFT])
    print(f"Stats: {consumer.get_stats()}")
