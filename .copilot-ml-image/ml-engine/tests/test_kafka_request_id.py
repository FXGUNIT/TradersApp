import json

from infrastructure.request_context import get_request_id, request_id_context
from kafka.consumer import KafkaConsumerClient, TOPIC_PREDICTIONS
from kafka.producer import KAFKA_REQUEST_ID_HEADER, KafkaProducerClient


class DummyDeliveredMessage:
    def __init__(self, topic: str, partition: int = 2, offset: int = 7):
        self._topic = topic
        self._partition = partition
        self._offset = offset

    def topic(self):
        return self._topic

    def partition(self):
        return self._partition

    def offset(self):
        return self._offset


class DummyProducer:
    def __init__(self):
        self.produced = []

    def produce(self, **kwargs):
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


class DummyMessage:
    def __init__(self, topic: str, payload: dict, headers: list[tuple[str, bytes]]):
        self._topic = topic
        self._payload = json.dumps(payload).encode("utf-8")
        self._headers = headers

    def error(self):
        return None

    def topic(self):
        return self._topic

    def value(self):
        return self._payload

    def headers(self):
        return self._headers

    def partition(self):
        return 1

    def offset(self):
        return 42


class DummyConsumer:
    def __init__(self, message: DummyMessage):
        self.message = message
        self.calls = 0
        self.owner = None
        self.commits = []

    def poll(self, timeout=1.0):
        self.calls += 1
        if self.calls == 1:
            return self.message
        self.owner._running = False
        return None

    def commit(self, msg, asynchronous=False):
        self.commits.append((msg, asynchronous))

    def close(self):
        return None


def test_kafka_producer_includes_request_id_in_headers_and_payload():
    producer = KafkaProducerClient(enable=False)
    producer._enable = True
    producer._producer = DummyProducer()

    with request_id_context("req-kafka-producer"):
        published = producer.publish_prediction(
            symbol="MNQ",
            model_name="direction",
            prediction={"signal": "LONG", "probability_long": 0.81, "confidence": 0.91},
        )

    assert published is True
    produced = producer._producer.produced[0]
    headers = dict(produced["headers"])
    payload = json.loads(produced["value"].decode("utf-8"))

    assert headers[KAFKA_REQUEST_ID_HEADER] == b"req-kafka-producer"
    assert payload["request_id"] == "req-kafka-producer"
    assert producer.get_stats()["delivery_reports"][-1]["request_id"] == "req-kafka-producer"


def test_kafka_consumer_binds_request_id_from_headers_to_handler_context():
    captured = {}
    request_id = "req-kafka-consumer"
    message = DummyMessage(
        topic=TOPIC_PREDICTIONS,
        payload={"symbol": "MNQ", "signal": "LONG"},
        headers=[(KAFKA_REQUEST_ID_HEADER, request_id.encode("utf-8"))],
    )

    consumer = KafkaConsumerClient(enable=False)
    consumer._enable = True
    consumer._consumer = DummyConsumer(message)
    consumer._consumer.owner = consumer

    def handler(event: dict):
        captured["request_id"] = get_request_id()
        captured["event"] = event

    consumer.register_handler(TOPIC_PREDICTIONS, handler)
    consumer._running = True
    consumer._consume_loop()

    assert captured["request_id"] == request_id
    assert captured["event"]["request_id"] == request_id
    assert consumer._messages_processed == 1
    assert consumer._consumer.commits == [(message, False)]
