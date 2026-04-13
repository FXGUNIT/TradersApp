from __future__ import annotations

import importlib
import sys
from types import ModuleType

import pytest


class DummyMessage:
    def __init__(
        self,
        topic: str,
        payload: dict,
        partition: int = 0,
        offset: int = 1,
        key: bytes | None = None,
    ):
        self._topic = topic
        self._payload = payload
        self._partition = partition
        self._offset = offset
        self._key = key

    def error(self):
        return None

    def topic(self):
        return self._topic

    def value(self):
        import json

        return json.dumps(self._payload).encode("utf-8")

    def headers(self):
        return []

    def partition(self):
        return self._partition

    def offset(self):
        return self._offset

    def key(self):
        return self._key


class DummyConsumer:
    def __init__(self, messages: list[DummyMessage]):
        self._messages = list(messages)
        self.commits = []
        self.owner = None

    def poll(self, timeout=1.0):
        if self._messages:
            return self._messages.pop(0)
        if self.owner is not None:
            self.owner._running = False
        return None

    def commit(self, msg, asynchronous=False):
        self.commits.append((msg.topic(), msg.partition(), msg.offset(), asynchronous))

    def close(self):
        return None


class DummyDLQProducer:
    def __init__(self):
        self.published = []

    def publish_dead_letter(self, topic, raw_key, event, error_message):
        self.published.append((topic, raw_key, event, error_message))


@pytest.fixture
def consumer_module(monkeypatch):
    """
    Load ml_engine.kafka.consumer directly from the filesystem using importlib,
    bypassing the kafka-python / ml_engine namespace problem:

    - The project consumer lives at e:/TradersApp/ml-engine/kafka/consumer.py
    - The ml-engine directory is hyphenated ("ml-engine") but Python imports it
      with an underscore ("ml_engine") via conftest.py adding it to sys.path.
      This DOES NOT work on Windows because hyphens ≠ underscores in identifiers.
    - kafka-python also occupies the top-level "kafka" package namespace.

    Solution: load the consumer.py module directly via importlib.util and
    expose only the symbols the tests need on a synthetic module object.
    """
    import importlib.util
    import pathlib

    # ── 1. Block kafka-python so it doesn't interfere ────────────────────────
    for key in list(sys.modules):
        if key == "kafka" or key.startswith("kafka."):
            monkeypatch.setitem(sys.modules, key, None)

    # ── 2. Load ml_engine.kafka.consumer directly from its filesystem path ───
    # ml-engine/tests/ → ml-engine/ → parent repo root (e:\TradersApp)
    tests_dir = pathlib.Path(__file__).resolve().parent          # ml-engine/tests
    ml_engine_root = tests_dir.parent                             # ml-engine
    kafka_dir = ml_engine_root / "kafka"                          # ml-engine/kafka
    consumer_path = kafka_dir / "consumer.py"

    spec = importlib.util.spec_from_file_location(
        "kafka.consumer",
        consumer_path,
        submodule_search_locations=[str(kafka_dir)],
    )
    raw_consumer = importlib.util.module_from_spec(spec)

    # ── 3. Mock confluent_kafka so KAFKA_AVAILABLE=False ───────────────────
    fake_confluent = ModuleType("confluent_kafka")
    fake_confluent.Consumer = type("Consumer", (), {})
    fake_confluent.KafkaError = type("KafkaError", (), {"_PARTITION_EOF": -191})
    fake_confluent.KafkaException = Exception
    fake_confluent.TopicPartition = type("TopicPartition", (), {})
    monkeypatch.setitem(sys.modules, "confluent_kafka", fake_confluent)

    # ── 4. Execute the consumer module with mocks in place ──────────────────
    # Patch request_context so the module can be loaded without a live infra setup.
    fake_rc = ModuleType("infrastructure.request_context")

    def noop_logger(name: str):
        import logging
        return logging.getLogger(name)

    fake_rc.request_logger = noop_logger
    fake_rc.extract_request_id_from_headers = lambda *a, **k: None
    fake_rc.generate_request_id = lambda: "test-request-id"
    fake_rc.request_id_context = lambda *a, **k: __import__("contextlib").nullcontext()
    monkeypatch.setitem(sys.modules, "infrastructure.request_context", fake_rc)
    monkeypatch.setitem(sys.modules, "infrastructure", fake_rc)
    monkeypatch.setitem(sys.modules, "ml_engine.infrastructure.request_context", fake_rc)
    monkeypatch.setitem(sys.modules, "ml_engine.infrastructure", fake_rc)

    # Mock infrastructure.prometheus_exporter so backpressure helpers don't fail.
    fake_prom = ModuleType("infrastructure")
    fake_prom.set_kafka_consumer_lag = lambda *a, **k: None
    fake_prom.record_kafka_consumer_processed = lambda *a, **k: None
    fake_prom.DEFAULT_REGISTRY = None
    monkeypatch.setitem(sys.modules, "infrastructure.prometheus_exporter", fake_prom)
    monkeypatch.setitem(sys.modules, "ml_engine.infrastructure.prometheus_exporter", fake_prom)

    # Patch ML engine sub-modules that get imported lazily inside handler closures.
    _mock_defs = [
        ("ml_engine.infrastructure.drift_detector", ModuleType("ml_engine.infrastructure.drift_detector")),
        ("ml_engine.feedback.feedback_logger", ModuleType("ml_engine.feedback.feedback_logger")),
        ("ml_engine.data.candle_db", ModuleType("ml_engine.data.candle_db")),
    ]
    for mod_name, mock_cls in _mock_defs:
        mock_cls.get_drift_monitor = lambda *a, **k: None
        mock_cls.FeedbackLogger = type("FeedbackLogger", (), {})
        mock_cls.CandleDatabase = type("CandleDatabase", (), {})
        monkeypatch.setitem(sys.modules, mod_name, mock_cls)

    # Execute the module so all its globals (TOPIC_PREDICTIONS, KafkaConsumerClient,
    # KAFKA_AVAILABLE, DLQ_MAX_RETRIES) are populated.
    try:
        spec.loader.exec_module(raw_consumer)  # type: ignore[union-attr]
    except Exception:
        pass  # Some imports may fail during load; module attrs are still accessible

    # Force KAFKA_AVAILABLE = False (overrides whatever the module set during load).
    raw_consumer.KAFKA_AVAILABLE = False
    monkeypatch.setattr(raw_consumer, "KAFKA_AVAILABLE", False, raising=False)
    monkeypatch.setattr(raw_consumer, "DLQ_MAX_RETRIES", 2, raising=False)

    # ── 5. Expose only the symbols the test functions use ───────────────────
    consumer_module = ModuleType("kafka.consumer")
    consumer_module.TOPIC_PREDICTIONS = raw_consumer.TOPIC_PREDICTIONS
    consumer_module.KafkaConsumerClient = raw_consumer.KafkaConsumerClient
    consumer_module.KAFKA_AVAILABLE = False
    consumer_module.DLQ_MAX_RETRIES = 2
    monkeypatch.setitem(sys.modules, "kafka.consumer", consumer_module)

    return consumer_module


def _build_consumer(consumer_module, message_or_messages, handler):
    consumer = consumer_module.KafkaConsumerClient(enable=False)
    consumer._enable = True
    consumer._consumer = DummyConsumer(
        message_or_messages if isinstance(message_or_messages, list) else [message_or_messages]
    )
    consumer._consumer.owner = consumer
    consumer.register_handler(consumer_module.TOPIC_PREDICTIONS, handler)
    consumer._running = True
    return consumer


def test_manual_commit_on_success(consumer_module):
    message = DummyMessage(
        topic=consumer_module.TOPIC_PREDICTIONS,
        payload={"symbol": "MNQ", "signal": "LONG"},
        partition=1,
        offset=42,
    )
    seen = []

    def handler(event: dict):
        seen.append(event)

    consumer = _build_consumer(consumer_module, message, handler)

    consumer._consume_loop()

    assert len(seen) == 1
    assert consumer._messages_processed == 1
    assert consumer._messages_failed == 0
    assert consumer._consumer.commits == [(consumer_module.TOPIC_PREDICTIONS, 1, 42, False)]


def test_manual_commit_skipped_before_dlq_exhaustion(consumer_module):
    message = DummyMessage(
        topic=consumer_module.TOPIC_PREDICTIONS,
        payload={"symbol": "MNQ", "signal": "SHORT"},
        partition=2,
        offset=84,
    )

    def handler(_event: dict):
        raise RuntimeError("handler failed")

    consumer = _build_consumer(consumer_module, message, handler)

    consumer._consume_loop()

    assert consumer._messages_processed == 0
    assert consumer._messages_failed == 1
    assert consumer._consumer.commits == []
    assert consumer._retry_counts[(consumer_module.TOPIC_PREDICTIONS, 2, 84)] == 1


def test_manual_commit_after_dlq_exhaustion_unblocks_consumer(consumer_module, monkeypatch):
    message = DummyMessage(
        topic=consumer_module.TOPIC_PREDICTIONS,
        payload={"symbol": "MNQ", "signal": "NEUTRAL"},
        partition=3,
        offset=126,
    )
    dlq_producer = DummyDLQProducer()

    # Patch the get_producer function on the raw consumer module so the DLQ
    # forward path (from kafka.producer.get_producer) returns our dummy.
    sys.modules.pop("kafka", None)
    sys.modules.pop("kafka.producer", None)
    import kafka.producer as mlq_producer
    monkeypatch.setattr(mlq_producer, "get_producer", lambda: dlq_producer)

    def handler(_event: dict):
        raise RuntimeError("handler failed")

    consumer = _build_consumer(consumer_module, [message, message], handler)

    consumer._consume_loop()

    assert consumer._messages_processed == 0
    assert consumer._messages_failed == 2
    assert consumer._consumer.commits == [(consumer_module.TOPIC_PREDICTIONS, 3, 126, False)]
    assert len(dlq_producer.published) == 1
    topic, raw_key, event, error_message = dlq_producer.published[0]
    assert topic == consumer_module.TOPIC_PREDICTIONS
    assert raw_key is None
    assert event["symbol"] == "MNQ"
    assert event["signal"] == "NEUTRAL"
    assert "request_id" in event
    assert error_message == "handler failed"
    assert consumer._retry_counts == {}
