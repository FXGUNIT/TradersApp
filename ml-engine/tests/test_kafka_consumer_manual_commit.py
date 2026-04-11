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
    # The ml-engine package lives at e:\TradersApp\ml-engine (hyphenated directory name).
    # Add the TradersApp root to sys.path so Python resolves "ml_engine" → the
    # ml-engine directory (Windows is case-insensitive for the name, hyphens ≠ underscores
    # in identifiers so the directory must be found via path lookup).
    import pathlib
    tradersapp_root = str(pathlib.Path(__file__).resolve().parents[2])
    monkeypatch.syspath_prepend(tradersapp_root)

    # Block kafka-python from sys.modules so we can replace it with the project's
    # ml_engine.kafka package before any real imports happen.
    for key in list(sys.modules):
        if key == "kafka" or key.startswith("kafka."):
            monkeypatch.setitem(sys.modules, key, None)

    # Wire "kafka" → ml_engine.kafka so `from kafka import consumer` lands on the
    # project module (which defines KafkaConsumerClient, TOPIC_PREDICTIONS, etc.).
    import ml_engine.kafka
    monkeypatch.setitem(sys.modules, "kafka", ml_engine.kafka)
    monkeypatch.setitem(sys.modules, "kafka.consumer", ml_engine.kafka.consumer)
    monkeypatch.setitem(sys.modules, "kafka.producer", ml_engine.kafka.producer)

    # Mock confluent_kafka (the production broker library) so KAFKA_AVAILABLE=False.
    fake_confluent = ModuleType("confluent_kafka")
    fake_confluent.Consumer = type("Consumer", (), {})
    fake_confluent.KafkaError = type("KafkaError", (), {"_PARTITION_EOF": -191})
    fake_confluent.KafkaException = Exception
    fake_confluent.TopicPartition = type("TopicPartition", (), {})
    monkeypatch.setitem(sys.modules, "confluent_kafka", fake_confluent)

    consumer_module = importlib.reload(
        __import__("kafka.consumer", fromlist=["KafkaConsumerClient"])
    )
    monkeypatch.setattr(consumer_module, "KAFKA_AVAILABLE", False, raising=False)
    monkeypatch.setattr(consumer_module, "DLQ_MAX_RETRIES", 2, raising=False)
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

    import ml_engine.kafka.producer as mlq_producer
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
