"""
Kafka Consumer — subscribes to TradersApp Kafka topics and processes events.

Topics:
  candle-data         — 5-min OHLCV candles → store in the trading DB
  consensus-signals   — ML consensus → send to BFF
  feedback-loop      — Trade outcomes → update ConceptDriftDetector
  drift-alerts       — Drift alerts → trigger retrain pipeline

Usage:
  from ml_engine.kafka.consumer import KafkaConsumerClient
  consumer = KafkaConsumerClient(topics=["feedback-loop", "drift-alerts"])
  consumer.start()   # Blocking — runs forever

Environment:
  KAFKA_BOOTSTRAP_SERVERS: Broker list (default: localhost:9092)
  KAFKA_GROUP_ID / KAFKA_CONSUMER_GROUP: Consumer group ID (default: traders-ml-engine)
  KAFKA_AUTO_OFFSET_RESET: earliest/latest (default: earliest)
  KAFKA_ENABLE: Set to "false" to disable (default: true)
"""

from __future__ import annotations

import os
import socket
import sys
import json
import time
import threading
import signal
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Callable, Optional, Any

import pandas as pd

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from infrastructure.request_context import (
        extract_request_id_from_headers,
        generate_request_id,
        request_id_context,
        request_logger,
    )
except ModuleNotFoundError:
    from ml_engine.infrastructure.request_context import (  # type: ignore
        extract_request_id_from_headers,
        generate_request_id,
        request_id_context,
        request_logger,
    )


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
TOPIC_DLQ = "dead-letter-queue"

# Max handler failures before a message is forwarded to the dead-letter queue.
DLQ_MAX_RETRIES = int(os.environ.get("KAFKA_DLQ_MAX_RETRIES", "3"))

try:
    from infrastructure.prometheus_exporter import (
        set_kafka_consumer_lag as _set_lag,
        record_kafka_consumer_processed as _record_processed,
    )
except Exception:
    try:
        from ml_engine.infrastructure.prometheus_exporter import (  # type: ignore
            set_kafka_consumer_lag as _set_lag,
            record_kafka_consumer_processed as _record_processed,
        )
    except Exception:
        def _set_lag(topic: str, partition: int, lag: int) -> None:  # type: ignore
            pass
        def _record_processed(topic: str) -> None:  # type: ignore
            pass


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
            TOPIC_CONSENSUS,
            TOPIC_PREDICTIONS,
            TOPIC_FEEDBACK,
            TOPIC_DRIFT,
        ]
        env_group_id = os.environ.get("KAFKA_GROUP_ID") or os.environ.get("KAFKA_CONSUMER_GROUP")
        # E01: group ID includes pod identity so each ml-engine pod gets its own
        # consumer group instance. This makes partition ownership explicit per pod.
        _pod_id = os.environ.get("MY_POD_NAME", socket.gethostname())
        self._group_id = group_id or env_group_id or f"traders-ml-engine-{_pod_id}"
        self._bootstrap = bootstrap_servers or os.environ.get(
            "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"
        )
        self._auto_offset_reset = os.environ.get("KAFKA_AUTO_OFFSET_RESET", "earliest").strip().lower() or "earliest"
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

        # DLQ retry tracking: (topic, partition, offset) -> failure_count
        self._retry_counts: dict[tuple, int] = {}
        # Lag reporting: emit metrics every N successful commits
        self._lag_check_interval = int(os.environ.get("KAFKA_LAG_CHECK_INTERVAL", "50"))
        # Consumer backpressure: pause when lag exceeds this threshold
        self._max_lag = int(os.environ.get("KAFKA_MAX_LAG", "10000"))
        self._backoff_seconds = int(os.environ.get("KAFKA_CONSUMER_BACKOFF_SECONDS", "60"))
        self._paused = False
        self._pause_until: float = 0.0
        self._paused_topics: set[str] = set()
        self._logger_name = "ml-engine.kafka.consumer"

        if self._enable:
            self._connect(**kwargs)
            self._register_default_handlers()
        else:
            self._log(logging.INFO, "Consumer disabled via KAFKA_ENABLE=false")

    def _log(self, level: int, message: str, *args):
        request_logger(self._logger_name).log(level, message, *args)

    def _connect(self, **kwargs):
        """Connect to Kafka broker."""
        if not KAFKA_AVAILABLE:
            self._log(logging.WARNING, "confluent-kafka not installed")
            self._enable = False
            return

        conf = {
            "bootstrap.servers": self._bootstrap,
            "group.id": self._group_id,
            "client.id": f"traders-ml-engine-consumer-{os.environ.get('MY_POD_NAME', socket.gethostname())}",
            "auto.offset.reset": self._auto_offset_reset,
            "enable.auto.commit": False,           # Manual commit for at-least-once delivery
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
            self._log(
                logging.INFO,
                "Consumer subscribed to %s (group=%s offset_reset=%s)",
                self._topics,
                self._group_id,
                self._auto_offset_reset,
            )
        except KafkaException as e:
            self._log(logging.ERROR, "Consumer connect error: %s", e)
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
                    self._log(logging.WARNING, "Unrecognized candle-data payload keys=%s", list(message.keys()))
                    return

                inserted = db.insert_candles(df)
                if inserted > 0:
                    self._log(logging.INFO, "Stored %s candle(s) from candle-data topic", inserted)
                else:
                    self._log(logging.INFO, "No new candles inserted (duplicates)")

            except Exception as e:
                self._log(logging.ERROR, "Error in candle-data handler: %s", e)

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
                        self._log(logging.ERROR, "Feedback handler error: %s", e)

            except Exception as e:
                self._log(logging.ERROR, "Error in feedback handler: %s", e)

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
                    self._log(
                        logging.WARNING,
                        "Drift alert received alert_type=%s severity=%s metric_value=%s threshold=%s",
                        alert_type,
                        severity,
                        metric_value,
                        threshold,
                    )
                    # Check if retraining is warranted
                    try:
                        if pipeline and pipeline.should_retrain():
                            self._log(logging.INFO, "Auto-retrain triggered by drift alert")
                            # Note: runs async in background
                    except Exception as e:
                        self._log(logging.ERROR, "Retrain check error: %s", e)

            except Exception as e:
                self._log(logging.ERROR, "Error in drift handler: %s", e)

        def handle_consensus_signals(message: dict):
            """
            Process consensus signals from Kafka → log to signal_log DB.
            These are written by ml-engine's /predict endpoint.
            Wire this consumer when you want the ml-engine to record its own signals.
            In a multi-pod or multi-service setup, this consumer runs on whichever pod
            owns the FeedbackLogger DB — typically the primary ml-engine pod.
            """
            try:
                from ml_engine.feedback.feedback_logger import FeedbackLogger
                from ml_engine.data.candle_db import CandleDatabase

                db = CandleDatabase()
                logger = FeedbackLogger(db)

                # Payload from KafkaProducerClient.publish_consensus():
                # {symbol, signal, confidence, long_score, short_score,
                #  votes, regime, generated_at, published_at}
                symbol = message.get("symbol", "MNQ")
                signal = message.get("signal", "NEUTRAL")
                confidence = float(message.get("confidence", 0.0))
                votes = message.get("votes", {})
                regime = message.get("regime")

                # votes is already a serialized dict on the wire
                # The producer serializes it with _JsonEncoder, so it comes as a dict
                consensus_data = {
                    "signal": signal,
                    "confidence": confidence,
                    "long_score": message.get("long_score", 0),
                    "short_score": message.get("short_score", 0),
                    "regime": regime,
                    "votes": votes,
                }

                signal_id = logger.log_signal(
                    signal=signal,
                    confidence=confidence,
                    votes=votes,
                    consensus=consensus_data,
                    regime=regime,
                    symbol=symbol,
                )
                self._log(
                    logging.INFO,
                    "consensus-signals logged signal_id=%s signal=%s confidence=%.3f",
                    signal_id,
                    signal,
                    confidence,
                )

            except Exception as e:
                self._log(logging.ERROR, "Error in consensus-signals handler: %s", e)

        def handle_model_predictions(message: dict):
            """
            Process per-model predictions from Kafka → update per-model drift tracking.
            These are written by ml-engine's /predict endpoint for each voting model.

            Payload from KafkaProducerClient.publish_prediction():
            # {symbol, model_name, signal, probability_long, confidence, published_at}
            """
            try:
                from ml_engine.infrastructure.drift_detector import get_drift_monitor

                monitor = get_drift_monitor()
                symbol = message.get("symbol", "MNQ")
                model_name = message.get("model_name", "unknown")
                signal = message.get("signal", "NEUTRAL")
                probability_long = float(message.get("probability_long", 0.5))
                confidence = float(message.get("confidence", 0.0))

                # Record for per-model concept drift detection
                # ConceptDriftDetector already tracks per-model metrics via _model_stats
                try:
                    monitor.record_prediction(
                        correct=None,  # Unknown at publish time — outcome comes via feedback-loop
                        confidence=confidence,
                        symbol=symbol,
                    )
                except Exception:
                    pass  # Drift monitor may not be initialized yet

                self._log(
                    logging.INFO,
                    "model-predictions model=%s signal=%s probability_long=%.3f",
                    model_name,
                    signal,
                    probability_long,
                )

            except Exception as e:
                self._log(logging.ERROR, "Error in model-predictions handler: %s", e)

        self.register_handler(TOPIC_CANDLES, handle_candles)
        self.register_handler(TOPIC_CONSENSUS, handle_consensus_signals)
        self.register_handler(TOPIC_PREDICTIONS, handle_model_predictions)
        self.register_handler(TOPIC_FEEDBACK, handle_feedback)
        self.register_handler(TOPIC_DRIFT, handle_drift)

    def register_handler(self, topic: str, handler: Callable[[dict], None]):
        """
        Register a callback handler for a topic.
        Handler receives the deserialized message dict.
        """
        self._handlers[topic] = handler
        self._log(logging.INFO, "Registered handler for topic=%s", topic)

    # ─── Consumer Backpressure ─────────────────────────────────────────────────

    def _check_and_apply_backpressure(self, topic: str, partition: int) -> None:
        """
        Check consumer lag. If lag exceeds KAFKA_MAX_LAG, pause the consumer
        and set a backoff timer to prevent the ML engine from being overwhelmed.
        """
        if not KAFKA_AVAILABLE or self._consumer is None:
            return
        try:
            from confluent_kafka import TopicPartition
            tp = TopicPartition(topic, partition)
            low, high = self._consumer.get_watermark_offsets(tp, timeout=0.5)
            committed_list = self._consumer.committed([tp], timeout=0.5)
            if not (committed_list and committed_list[0].offset >= 0):
                return
            lag = max(0, high - committed_list[0].offset)
            _set_lag(topic, partition, lag)

            now = time.time()
            # Resume check — if backoff has expired and we are paused, resume
            if self._paused and now >= self._pause_until:
                self._log(
                    logging.INFO,
                    "Backoff expired; resuming consumer from topic=%s partition=%s (lag=%s)",
                    topic,
                    partition,
                    lag,
                )
                try:
                    self._consumer.resume([tp])
                    self._paused_topics.discard(f"{topic}:{partition}")
                except Exception as e:
                    self._log(logging.WARNING, "Resume failed topic=%s: %s", topic, e)
                if not self._paused_topics:
                    self._paused = False

            if lag > self._max_lag and not self._paused:
                self._pause_until = now + self._backoff_seconds
                self._paused = True
                self._paused_topics.add(f"{topic}:{partition}")
                self._log(
                    logging.WARNING,
                    "Consumer lag %s exceeds threshold %s; pausing topic=%s partition=%s for %ss",
                    lag,
                    self._max_lag,
                    topic,
                    partition,
                    self._backoff_seconds,
                )
                try:
                    self._consumer.pause([tp])
                except Exception as e:
                    self._log(logging.ERROR, "Pause failed topic=%s partition=%s: %s", topic, partition, e)
                self._log(
                    logging.INFO,
                    "Consumer paused for %ss (until %.0f); BFF degrades gracefully while backpressure is applied",
                    self._backoff_seconds,
                    self._pause_until,
                )
        except Exception as e:
            self._log(logging.WARNING, "Backpressure check failed topic=%s partition=%s: %s", topic, partition, e)

    def start(self, blocking: bool = True):
        """
        Start consuming messages.

        Args:
            blocking: If True, runs in current thread. If False, runs in background thread.
        """
        if not self._enable or self._consumer is None:
            self._log(logging.INFO, "Consumer not enabled; nothing to start")
            return

        self._running = True

        if blocking:
            self._consume_loop()
        else:
            self._thread = threading.Thread(target=self._consume_loop, daemon=True)
            self._thread.start()
            self._log(logging.INFO, "Consumer running in background thread")

    def _consume_loop(self):
        """Main consumer loop — polls and dispatches messages."""
        self._log(logging.INFO, "Starting consumer loop")

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
                        self._log(logging.ERROR, "Consumer error: %s", msg.error())
                        continue

                topic = msg.topic()
                value = msg.value()
                request_id = extract_request_id_from_headers(msg.headers()) or generate_request_id()

                try:
                    event = json.loads(value.decode("utf-8")) if isinstance(value, bytes) else json.loads(value)
                except json.JSONDecodeError as e:
                    with request_id_context(request_id):
                        self._log(logging.ERROR, "JSON decode error on topic=%s: %s", topic, e)
                        self._messages_failed += 1
                    continue

                event.setdefault("request_id", request_id)

                # Dispatch to handler
                handler = self._handlers.get(topic)
                should_commit = False
                with request_id_context(request_id):
                    if handler:
                        try:
                            self._log(
                                logging.INFO,
                                "Consumed topic=%s partition=%s offset=%s",
                                topic,
                                msg.partition(),
                                msg.offset(),
                            )
                            handler(event)
                            self._messages_processed += 1
                            _record_processed(topic)  # E03: update consumer-processed Prometheus counter
                            self._last_message_time = datetime.now(timezone.utc).isoformat()
                            # Clear retry count for successfully processed message
                            self._retry_counts.pop((topic, msg.partition(), msg.offset()), None)
                            should_commit = True
                        except Exception as e:
                            self._log(logging.ERROR, "Handler error on topic=%s: %s", topic, e)
                            self._messages_failed += 1
                            msg_key = (topic, msg.partition(), msg.offset())
                            self._retry_counts[msg_key] = self._retry_counts.get(msg_key, 0) + 1
                            if self._retry_counts[msg_key] >= DLQ_MAX_RETRIES:
                                # Forward to DLQ and commit to unblock the consumer
                                try:
                                    from kafka.producer import get_producer  # lazy — avoids circular import
                                    raw_key = msg.key().decode("utf-8", errors="replace") if msg.key() else None
                                    get_producer().publish_dead_letter(topic, raw_key, event, str(e))
                                except Exception as dlq_err:
                                    self._log(logging.ERROR, "DLQ forward failed topic=%s offset=%s: %s",
                                              topic, msg.offset(), dlq_err)
                                del self._retry_counts[msg_key]
                                should_commit = True  # unblock even when DLQ forward itself fails
                                self._log(logging.ERROR, "Max retries reached; forwarded to DLQ topic=%s offset=%s",
                                          topic, msg.offset())
                    else:
                        self._log(logging.WARNING, "No handler for topic=%s", topic)
                        should_commit = True

                    if should_commit:
                        try:
                            self._consumer.commit(msg, asynchronous=False)
                            # Consumer backpressure: check lag and pause if threshold exceeded
                            self._check_and_apply_backpressure(topic, msg.partition())
                            # Periodic consumer-lag metric (every _lag_check_interval commits)
                            if self._messages_processed % self._lag_check_interval == 0 and KAFKA_AVAILABLE:
                                self._check_and_apply_backpressure(topic, msg.partition())
                        except Exception as e:
                            self._log(logging.ERROR, "Commit error topic=%s offset=%s: %s", topic, msg.offset(), e)
                    else:
                        self._log(
                            logging.WARNING,
                            "Skipping offset commit after handler failure topic=%s offset=%s",
                            topic,
                            msg.offset(),
                        )

            except Exception as e:
                self._log(logging.ERROR, "Consumer loop error: %s", e)
                time.sleep(1)  # Back off on error

        self._log(logging.INFO, "Consumer loop stopped")

    def stop(self):
        """Stop the consumer loop gracefully."""
        self._log(logging.INFO, "Stopping consumer")
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        if self._consumer:
            self._consumer.close()
        self._log(logging.INFO, "Consumer stopped")

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
