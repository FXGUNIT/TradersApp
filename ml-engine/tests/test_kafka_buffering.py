import json
import time

from infrastructure.request_context import request_id_context
from kafka.producer import KafkaProducerClient, KAFKA_CB_CLOSED, KAFKA_CB_OPEN


class DummyDeliveredMessage:
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
    def __init__(self):
        self.fail_next = True
        self.produced = []

    def produce(self, **kwargs):
        if self.fail_next:
            self.fail_next = False
            raise BufferError("broker unavailable")
        self.produced.append(kwargs)
        callback = kwargs.get("callback")
        if callback:
            callback(None, DummyDeliveredMessage(kwargs["topic"]))

    def poll(self, timeout):
        return None

    def flush(self, timeout=0):
        return 0

    def outq_len(self):
        return 0


def test_publish_buffers_and_recovers_after_circuit_opens():
    producer = KafkaProducerClient(enable=False)
    producer._enable = True
    producer._failure_threshold = 1
    producer._recovery_timeout_seconds = 1
    producer._producer = FlakyProducer()

    with request_id_context("req-kafka-buffer"):
        published = producer.publish_prediction(
            symbol="MNQ",
            model_name="direction",
            prediction={"signal": "SHORT", "probability_long": 0.2, "confidence": 0.8},
        )

    assert published is True
    assert producer.get_stats()["buffered_messages"] == 1
    assert producer.get_stats()["circuit_state"] == KAFKA_CB_OPEN
    assert producer._producer.produced == []

    producer._drain_buffer()
    assert producer.get_stats()["buffered_messages"] == 1
    assert producer.get_stats()["circuit_state"] == KAFKA_CB_OPEN

    producer._last_failure_time = time.time() - producer._recovery_timeout_seconds
    producer._drain_buffer()

    assert producer.get_stats()["buffered_messages"] == 0
    assert producer.get_stats()["circuit_state"] == KAFKA_CB_CLOSED
    assert len(producer._producer.produced) == 1

    delivered = producer._producer.produced[0]
    payload = json.loads(delivered["value"].decode("utf-8"))
    assert payload["request_id"] == "req-kafka-buffer"
