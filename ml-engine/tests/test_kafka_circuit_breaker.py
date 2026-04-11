"""
Unit tests for Kafka Producer circuit breaker (Phase 2 Task 19).

Tests cover:
  (a) mocks broker failure
  (b) verifies circuit opens after consecutive failures
  (c) verifies local message buffer fills while circuit is open
  (d) verifies retry on half-open (buffer replay after recovery timeout)
  (e) verifies Prometheus metric is exported on state transitions

Uses unittest.mock to patch the underlying producer.produce() call.
"""

import json
import time
import unittest
from unittest.mock import patch, MagicMock, call

from infrastructure.request_context import request_id_context

# Must import after setting up sys.path (handled by ml-engine package structure)
# Run from ml-engine/ directory: python -m pytest tests/test_kafka_circuit_breaker.py


class DummyDeliveredMessage:
    """Fake delivery report returned by the mocked callback."""

    def __init__(self, topic: str, partition: int = 0, offset: int = 1):
        self._topic = topic
        self._partition = partition
        self._offset = offset

    def topic(self):
        return self._topic

    def partition(self):
        return self._partition

    def offset(self):
        return self._offset


class FlakyProducer:
    """
    Mock producer that fails N times before succeeding.
    Tracks all produce() calls for assertions.
    """

    def __init__(self, fail_count: int = 1):
        self.fail_count = fail_count
        self.attempt_count = 0
        self.produced = []

    def produce(self, **kwargs):
        self.attempt_count += 1
        if self.attempt_count <= self.fail_count:
            raise BufferError("broker unavailable")
        self.produced.append(kwargs)
        callback = kwargs.get("callback")
        if callback:
            callback(None, DummyDeliveredMessage(kwargs["topic"]))

    def poll(self, timeout=0):
        return None

    def flush(self, timeout=0):
        return 0

    def outq_len(self):
        return 0


def _patch_confluent_kafka():
    """Install mock confluent_kafka module on sys.modules."""
    mock_producer = MagicMock()
    mock_consumer = MagicMock()
    mock_topicpartition = MagicMock()
    import sys
    sys.modules["confluent_kafka"] = MagicMock(
        Producer=mock_producer,
        Consumer=mock_consumer,
        TopicPartition=mock_topicpartition,
        KafkaError=Exception,
        KafkaException=Exception,
    )


class TestKafkaProducerCircuitBreaker(unittest.TestCase):
    """Tests for KafkaProducerClient circuit breaker behavior."""

    def setUp(self):
        # Patch confluent_kafka so we can import producer without a real broker
        import sys
        sys.modules["confluent_kafka"] = MagicMock(
            Producer=MagicMock(),
            Consumer=MagicMock(),
            TopicPartition=MagicMock(),
            KafkaError=Exception,
            KafkaException=Exception,
        )

    def tearDown(self):
        import sys
        # Reset singleton so test order doesn't matter
        from ml_engine.kafka import producer as _p
        _p._producer_instance = None
        if "ml_engine.kafka.producer" in sys.modules:
            del sys.modules["ml_engine.kafka.producer"]
        if "confluent_kafka" in sys.modules:
            del sys.modules["confluent_kafka"]

    # ── Test (a): broker failure is handled without crashing ──────────────────

    def test_publish_returns_true_when_broker_down(self):
        """publish_* methods must never raise — they return True and buffer."""
        from ml_engine.kafka.producer import KafkaProducerClient

        producer = KafkaProducerClient(enable=False)
        producer._enable = True  # re-enable without real broker

        # Simulate the underlying produce() raising BufferError
        with patch.object(producer, "_producer", None):
            # _publish handles producer=None by buffering — verify no exception
            result = producer._publish(
                topic="candle-data",
                key="MNQ",
                value={"timestamp": "2026-01-01T00:00:00Z"},
            )
            self.assertTrue(result)  # Never fails
            self.assertEqual(producer.get_stats()["buffered_messages"], 1)

    # ── Test (b): circuit opens after N consecutive failures ───────────────────

    def test_circuit_opens_after_failure_threshold(self):
        """Circuit must transition to OPEN after _failure_threshold failures."""
        from ml_engine.kafka.producer import (
            KafkaProducerClient,
            KAFKA_CB_OPEN,
            KAFKA_CB_CLOSED,
        )

        producer = KafkaProducerClient(enable=False)
        producer._enable = True
        producer._failure_threshold = 3
        producer._producer = FlakyProducer(fail_count=99)  # always fails
        producer._failure_count = 0
        producer._circuit_state = KAFKA_CB_CLOSED

        with request_id_context("test-circuit-open"):
            for i in range(3):
                producer._record_failure(RuntimeError(f"failure {i}"))

        self.assertEqual(producer._circuit_state, KAFKA_CB_OPEN)

    # ── Test (c): messages are buffered while circuit is open ───────────────────

    def test_buffer_fills_when_circuit_open(self):
        """When circuit is OPEN, _publish buffers messages instead of discarding."""
        from ml_engine.kafka.producer import (
            KafkaProducerClient,
            KAFKA_CB_OPEN,
        )

        producer = KafkaProducerClient(enable=False)
        producer._enable = True
        producer._failure_threshold = 3
        producer._circuit_state = KAFKA_CB_OPEN
        producer._last_failure_time = time.time()  # just opened — not yet half-open
        producer._failure_count = producer._failure_threshold

        with request_id_context("test-buffer-fill"):
            result = producer._publish(
                topic="candle-data",
                key="MNQ",
                value={"timestamp": "2026-01-01T00:00:00Z"},
            )

        self.assertTrue(result)
        self.assertEqual(producer.get_stats()["buffered_messages"], 1)

    # ── Test (d): buffered messages are retried when circuit half-opens ───────────

    def test_buffer_retry_on_half_open(self):
        """After recovery timeout, circuit half-opens and _drain_buffer replays messages."""
        from ml_engine.kafka.producer import (
            KafkaProducerClient,
            KAFKA_CB_CLOSED,
            KAFKA_CB_HALF_OPEN,
        )

        producer = KafkaProducerClient(enable=False)
        producer._enable = True
        producer._recovery_timeout_seconds = 1  # 1 second for fast test
        producer._failure_threshold = 3

        # Pre-populate the buffer with one message
        producer._circuit_state = KAFKA_CB_OPEN
        producer._last_failure_time = time.time() - producer._recovery_timeout_seconds - 0.1
        producer._buffer.append(
            {
                "topic": "candle-data",
                "key": "MNQ",
                "request_id": "test-retry-req",
                "payload": {"timestamp": "2026-01-01T00:00:00Z"},
                "headers": [("x-request-id", b"test-retry-req")],
                "queued_at": "2026-01-01T00:00:00Z",
                "attempts": 1,
            }
        )

        # Mock produce succeeds (FlakyProducer with fail_count=0)
        producer._producer = FlakyProducer(fail_count=0)
        producer._failure_count = producer._failure_threshold
        producer._circuit_state = KAFKA_CB_OPEN

        # Advance time so circuit half-opens
        producer._last_failure_time = time.time() - producer._recovery_timeout_seconds
        producer._drain_buffer()

        # Circuit should now be HALF_OPEN or CLOSED after drain
        self.assertIn(
            producer.get_stats()["circuit_state"],
            {KAFKA_CB_HALF_OPEN, KAFKA_CB_CLOSED},
        )
        # Message should have been consumed from buffer
        self.assertEqual(len(producer._buffer), 0)
        # Message should have been forwarded to producer
        self.assertEqual(len(producer._producer.produced), 1)

    # ── Test (e): Prometheus metric exported on state transitions ───────────────

    def test_prometheus_metric_exported_on_circuit_open(self):
        """set_kafka_producer_circuit_state must be called on OPEN transition."""
        from ml_engine.kafka.producer import KafkaProducerClient, KAFKA_CB_OPEN
        from ml_engine.infrastructure import prometheus_exporter

        called_states = []

        def mock_set_state(state: str, broker: str = "default"):
            called_states.append((state, broker))

        original = getattr(prometheus_exporter, "set_kafka_producer_circuit_state", None)
        try:
            prometheus_exporter.set_kafka_producer_circuit_state = mock_set_state

            producer = KafkaProducerClient(enable=False)
            producer._enable = True
            producer._circuit_state = KAFKA_CB_OPEN
            producer._record_failure(RuntimeError("test"))

            self.assertIn((KAFKA_CB_OPEN, producer._bootstrap), called_states)
        finally:
            if original:
                prometheus_exporter.set_kafka_producer_circuit_state = original

    def test_prometheus_metric_exported_on_circuit_half_open(self):
        """set_kafka_producer_circuit_state must be called when circuit half-opens."""
        from ml_engine.kafka.producer import KafkaProducerClient, KAFKA_CB_OPEN
        from ml_engine.infrastructure import prometheus_exporter

        called_states = []

        def mock_set_state(state: str, broker: str = "default"):
            called_states.append((state, broker))

        original = getattr(prometheus_exporter, "set_kafka_producer_circuit_state", None)
        try:
            prometheus_exporter.set_kafka_producer_circuit_state = mock_set_state

            producer = KafkaProducerClient(enable=False)
            producer._enable = True
            producer._circuit_state = KAFKA_CB_OPEN
            producer._last_failure_time = time.time() - producer._recovery_timeout_seconds - 0.1

            # Trigger half-open transition check
            allowed = producer._circuit_allows_attempt()

            self.assertTrue(allowed)
            self.assertIn((producer._circuit_state, producer._bootstrap), called_states)
        finally:
            if original:
                prometheus_exporter.set_kafka_producer_circuit_state = original


class TestKafkaProducerBufferBehavior(unittest.TestCase):
    """Tests for deque buffer behavior and FIFO eviction."""

    def setUp(self):
        import sys
        sys.modules["confluent_kafka"] = MagicMock(
            Producer=MagicMock(),
            Consumer=MagicMock(),
            KafkaError=Exception,
            KafkaException=Exception,
        )

    def tearDown(self):
        import sys
        from ml_engine.kafka import producer as _p
        _p._producer_instance = None
        if "ml_engine.kafka.producer" in sys.modules:
            del sys.modules["ml_engine.kafka.producer"]
        if "confluent_kafka" in sys.modules:
            del sys.modules["confluent_kafka"]

    def test_buffer_fifo_eviction(self):
        """When buffer is full, oldest message is evicted (FIFO)."""
        from ml_engine.kafka.producer import KafkaProducerClient

        producer = KafkaProducerClient(enable=False)
        producer._enable = True
        producer._buffer_max_size = 3
        producer._circuit_state = "OPEN"
        producer._last_failure_time = time.time()

        for i in range(5):
            with request_id_context(f"test-evict-{i}"):
                producer._publish(
                    topic="candle-data",
                    key="MNQ",
                    value={"seq": i},
                )

        # Buffer should hold at most _buffer_max_size messages
        self.assertLessEqual(len(producer._buffer), producer._buffer_max_size)
        # Dropped count should reflect evicted messages
        self.assertEqual(producer.get_stats()["buffer_dropped"], 2)
        # Most recent messages should be in buffer
        ids_in_buffer = [e["request_id"] for e in producer._buffer]
        self.assertIn("test-evict-4", ids_in_buffer)
        self.assertNotIn("test-evict-0", ids_in_buffer)


if __name__ == "__main__":
    unittest.main()
