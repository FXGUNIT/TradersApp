"""
Unit tests for Kafka Consumer backpressure (Phase 2 Task 19 companion).

Tests cover:
  (a) consumer lag below threshold — no pause
  (b) consumer lag above KAFKA_MAX_LAG — consumer.pause() is called
  (c) backoff timer expires — consumer.resume() is called
  (d) Prometheus lag metric is exported

Uses unittest.mock to patch the underlying consumer.get_watermark_offsets() call.
"""

import time
import unittest
from unittest.mock import patch, MagicMock, call

try:
    from ml_engine.kafka.consumer import KafkaConsumerClient, TopicPartition
except ImportError:
    import sys
    sys.path.insert(0, ".")
    from ml_engine.kafka.consumer import KafkaConsumerClient


class FakeTopicPartition:
    """Fake TopicPartition for mock committed() / get_watermark_offsets() results."""

    def __init__(self, topic: str, partition: int, offset: int = 100):
        self.topic = topic
        self.partition = partition
        self.offset = offset
        self.error = None


class FakeMessage:
    """Minimal fake Kafka message to satisfy the consumer loop."""

    def __init__(self, topic: str = "candle-data", partition: int = 0, offset: int = 1):
        self._topic = topic
        self._partition = partition
        self._offset = offset

    def topic(self):
        return self._topic

    def partition(self):
        return self._partition

    def offset(self):
        return self._offset

    def value(self):
        import json
        return json.dumps({"symbol": "MNQ", "timestamp": "2026-01-01T00:00:00Z"}).encode()

    def headers(self):
        return []

    def error(self):
        return None

    def key(self):
        return None


class MockConsumer:
    """Mock Kafka consumer that tracks pause/resume calls and watermark offsets."""

    def __init__(
        self,
        high_watermark: int = 200,
        committed_offset: int = 100,
        fail_watermarks: bool = False,
    ):
        self._watermark_high = watermark
        self._committed_offset = committed_offset
        self.fail_watermarks = fail_watermarks
        self.paused_partitions = []
        self.resumed_partitions = []
        self.commit_called = []

    def get_watermark_offsets(self, tp: FakeTopicPartition, timeout: float = 0.5):
        if self.fail_watermarks:
            raise RuntimeError("broker unavailable")
        return (0, self._watermark_high)

    def committed(self, partitions: list, timeout: float = 0.5):
        return [FakeTopicPartition(p.topic, p.partition, self._committed_offset) for p in partitions]

    def pause(self, partitions: list):
        for tp in partitions:
            self.paused_partitions.append((tp.topic, tp.partition))

    def resume(self, partitions: list):
        for tp in partitions:
            self.resumed_partitions.append((tp.topic, tp.partition))

    def commit(self, message, asynchronous=False):
        self.commit_called.append((message.topic(), message.partition(), message.offset()))

    def poll(self, timeout=1.0):
        return None

    def subscribe(self, topics):
        pass

    def close(self):
        pass


class TestKafkaConsumerBackpressure(unittest.TestCase):
    """Tests for KafkaConsumerClient backpressure behavior."""

    def setUp(self):
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
        from ml_engine.kafka import consumer as _c
        _c._consumer_instance = None
        if "ml_engine.kafka.consumer" in sys.modules:
            del sys.modules["ml_engine.kafka.consumer"]
        if "confluent_kafka" in sys.modules:
            del sys.modules["confluent_kafka"]

    # ── Test (a): lag below threshold — no pause ────────────────────────────────

    def test_no_pause_when_lag_below_threshold(self):
        """When lag <= KAFKA_MAX_LAG, consumer.pause() must NOT be called."""
        consumer = KafkaConsumerClient(
            topics=["candle-data"],
            enable=False,
        )
        consumer._enable = True
        consumer._max_lag = 10000
        consumer._backoff_seconds = 60
        consumer._paused = False
        consumer._paused_topics = set()

        mock_consumer = MockConsumer(high_watermark=200, committed_offset=100)  # lag = 100
        consumer._consumer = mock_consumer

        consumer._check_and_apply_backpressure("candle-data", 0)

        self.assertEqual(mock_consumer.paused_partitions, [])
        self.assertFalse(consumer._paused)

    # ── Test (b): lag above threshold — pause called ────────────────────────────

    def test_pause_called_when_lag_exceeds_threshold(self):
        """When lag > KAFKA_MAX_LAG, consumer.pause() MUST be called."""
        consumer = KafkaConsumerClient(
            topics=["candle-data"],
            enable=False,
        )
        consumer._enable = True
        consumer._max_lag = 10000
        consumer._backoff_seconds = 60
        consumer._paused = False
        consumer._paused_topics = set()

        # Lag = 50000 (way above threshold)
        mock_consumer = MockConsumer(high_watermark=50100, committed_offset=100)
        consumer._consumer = mock_consumer

        consumer._check_and_apply_backpressure("candle-data", 0)

        self.assertTrue(consumer._paused)
        self.assertIn(("candle-data", 0), mock_consumer.paused_partitions)

    # ── Test (c): backoff timer expiry — resume called ─────────────────────────

    def test_resume_called_after_backoff_expires(self):
        """After _backoff_seconds, consumer.resume() MUST be called on next check."""
        consumer = KafkaConsumerClient(
            topics=["candle-data"],
            enable=False,
        )
        consumer._enable = True
        consumer._max_lag = 10000
        consumer._backoff_seconds = 1  # 1 second for fast test
        consumer._paused = True
        consumer._paused_topics = {"candle-data:0"}

        # Simulate: backoff has already expired (pause_until in the past)
        consumer._pause_until = time.time() - 1

        mock_consumer = MockConsumer(high_watermark=50100, committed_offset=100)
        consumer._consumer = mock_consumer

        consumer._check_and_apply_backpressure("candle-data", 0)

        self.assertIn(("candle-data", 0), mock_consumer.resumed_partitions)
        self.assertFalse(consumer._paused)
        self.assertNotIn("candle-data:0", consumer._paused_topics)

    # ── Test (d): Prometheus lag metric is exported ────────────────────────────

    def test_lag_metric_exported_on_check(self):
        """_set_lag (prometheus_exporter.set_kafka_consumer_lag) must be called."""
        from ml_engine.infrastructure import prometheus_exporter

        recorded_lags = []

        original = getattr(prometheus_exporter, "set_kafka_consumer_lag", None)
        try:
            prometheus_exporter.set_kafka_consumer_lag = lambda t, p, l: recorded_lags.append((t, p, l))

            consumer = KafkaConsumerClient(
                topics=["candle-data"],
                enable=False,
            )
            consumer._enable = True
            consumer._max_lag = 10000
            consumer._backoff_seconds = 60
            consumer._paused = False
            consumer._paused_topics = set()

            mock_consumer = MockConsumer(high_watermark=200, committed_offset=100)  # lag = 100
            consumer._consumer = mock_consumer

            consumer._check_and_apply_backpressure("candle-data", 0)

            self.assertEqual(len(recorded_lags), 1)
            topic, partition, lag = recorded_lags[0]
            self.assertEqual(topic, "candle-data")
            self.assertEqual(partition, 0)
            self.assertEqual(lag, 100)
        finally:
            if original:
                prometheus_exporter.set_kafka_consumer_lag = original


class TestKafkaConsumerBackpressureEnvVars(unittest.TestCase):
    """Tests that backpressure thresholds are configurable via environment variables."""

    def setUp(self):
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
        from ml_engine.kafka import consumer as _c
        _c._consumer_instance = None
        if "ml_engine.kafka.consumer" in sys.modules:
            del sys.modules["ml_engine.kafka.consumer"]
        if "confluent_kafka" in sys.modules:
            del sys.modules["confluent_kafka"]

    def test_max_lag_from_env(self):
        """KAFKA_MAX_LAG env var must control the pause threshold."""
        import os
        old_val = os.environ.get("KAFKA_MAX_LAG")
        try:
            os.environ["KAFKA_MAX_LAG"] = "5000"
            consumer = KafkaConsumerClient(enable=False)
            self.assertEqual(consumer._max_lag, 5000)
        finally:
            if old_val is not None:
                os.environ["KAFKA_MAX_LAG"] = old_val
            elif "KAFKA_MAX_LAG" in os.environ:
                del os.environ["KAFKA_MAX_LAG"]

    def test_backoff_from_env(self):
        """KAFKA_CONSUMER_BACKOFF_SECONDS env var must control the backoff duration."""
        import os
        old_val = os.environ.get("KAFKA_CONSUMER_BACKOFF_SECONDS")
        try:
            os.environ["KAFKA_CONSUMER_BACKOFF_SECONDS"] = "30"
            consumer = KafkaConsumerClient(enable=False)
            self.assertEqual(consumer._backoff_seconds, 30)
        finally:
            if old_val is not None:
                os.environ["KAFKA_CONSUMER_BACKOFF_SECONDS"] = old_val
            elif "KAFKA_CONSUMER_BACKOFF_SECONDS" in os.environ:
                del os.environ["KAFKA_CONSUMER_BACKOFF_SECONDS"]


if __name__ == "__main__":
    unittest.main()
