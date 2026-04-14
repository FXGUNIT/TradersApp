"""
ML Engine — Kafka Producer/Consumer Management
Extracted from main.py (Rule #3 hard limit: Python ≤600 lines)
"""
from typing import TYPE_CHECKING

import _lifespan

kafka_producer = None
kafka_consumer = None


def _runtime_value(name):
    value = globals().get(name)
    return getattr(_lifespan, name) if value is None else value

try:
    from kafka.producer import get_producer
    from kafka.consumer import get_consumer
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False
    get_producer = None
    get_consumer = None


def publish_consensus_to_kafka(symbol: str, signal: dict, regime: str | None) -> None:
    """Publish consensus signal to Kafka topic (non-blocking)."""
    runtime_kafka_producer = _runtime_value("kafka_producer")
    if not KAFKA_AVAILABLE or runtime_kafka_producer is None:
        return
    try:
        from datetime import datetime as dt
        runtime_kafka_producer.publish_consensus(
            symbol=symbol,
            signal={
                "signal": signal.get("signal", "NEUTRAL"),
                "confidence": signal.get("confidence", 0.0),
                "long_score": signal.get("long_score", 0),
                "short_score": signal.get("short_score", 0),
                "votes": signal.get("votes", {}),
                "generated_at": dt.now().isoformat(),
            },
            regime=regime,
        )
        for model_name, vote in signal.get("votes", {}).items():
            runtime_kafka_producer.publish_prediction(
                symbol=symbol,
                model_name=model_name,
                prediction=vote,
            )
    except Exception:
        pass  # Never block response for Kafka failure
