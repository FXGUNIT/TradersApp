"""
ML Engine — Lifespan Management
Extracted from main.py (Rule #3 hard limit: Python ≤600 lines)

Holds: global state (db, trainer, etc.) and asynccontextmanager lifespan.
"""
import os
import time
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import config
from data.candle_db import CandleDatabase
from infrastructure.performance import RedisCache
from infrastructure.model_registry_client import ModelRegistryClient

# Conditional imports — may not be installed
try:
    from kafka.producer import get_producer
    from kafka.consumer import get_consumer
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False
    get_producer = None
    get_consumer = None

try:
    from infrastructure.prometheus_exporter import (
        set_models_loaded as set_prometheus_models_loaded,
        record_retrain as record_prometheus_retrain,
    )
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    set_prometheus_models_loaded = None
    record_prometheus_retrain = None

try:
    from infrastructure.profiler import init_profiler
except ImportError:
    init_profiler = lambda: None

try:
    from infrastructure.model_monitor import build_monitoring_snapshot
except Exception:
    build_monitoring_snapshot = None

from training.trainer import Trainer
from training.model_store import ModelStore
from inference.consensus_aggregator import ConsensusAggregator
from feedback.feedback_logger import FeedbackLogger
from feedback.trade_log_processor import TradeLogProcessor
from feedback.retrain_pipeline import RetrainPipeline
from infrastructure.drift_detector import DriftMonitor

if TYPE_CHECKING:
    from inference.triton_client import TritonInferenceClient
    from features.feature_lineage import FeatureLineageRegistry
    from typing import Any


# -------------------------------------------------------------------------
# Global state — set in lifespan, read by route handlers
# -------------------------------------------------------------------------

db: CandleDatabase | None = None
trainer: Trainer | None = None
consensus_agg: ConsensusAggregator | None = None
store: ModelStore | None = None
drift_monitor: DriftMonitor | None = None
feedback_logger: FeedbackLogger | None = None
trade_processor: TradeLogProcessor | None = None
retrain_pipeline: RetrainPipeline | None = None
triton_client: "TritonInferenceClient | None" = None
kafka_producer: "Any | None" = None
kafka_consumer: "Any | None" = None
lineage_registry: "FeatureLineageRegistry | None" = None
feast_warmed: bool = False
start_time: float = time.time()


@asynccontextmanager
async def lifespan(app: "FastAPI"):
    global db, trainer, consensus_agg, store, drift_monitor
    global feedback_logger, trade_processor, retrain_pipeline
    global triton_client, kafka_producer, kafka_consumer
    global lineage_registry, feast_warmed

    # Core services
    db = CandleDatabase(db_path=config.DB_PATH, database_url=config.DATABASE_URL)
    trainer = Trainer(db_path=config.DB_PATH, store_dir=config.MODEL_STORE)
    consensus_agg = ConsensusAggregator()
    store = ModelStore(config.MODEL_STORE)
    drift_monitor = DriftMonitor()
    app.state.model_registry_client = ModelRegistryClient()

    init_profiler()

    # Feedback loop
    feedback_logger = FeedbackLogger(db)
    trade_processor = TradeLogProcessor(db, feedback_logger)
    retrain_pipeline = RetrainPipeline(db, trainer, drift_monitor, trade_processor)

    # Kafka producer + consumer
    if KAFKA_AVAILABLE and get_producer is not None:
        try:
            kafka_producer = get_producer()
            kafka_consumer = get_consumer()
            if kafka_consumer and getattr(kafka_consumer, "_enable", False):
                kafka_consumer.start(blocking=False)
                print("[Kafka] Consumer running in background thread")
        except Exception as e:
            print(f"[Kafka] Init warning: {e}")
            kafka_producer = None
            kafka_consumer = None
    else:
        print("[Kafka] confluent-kafka not installed — event publishing disabled")
        kafka_producer = None
        kafka_consumer = None

    # Triton inference client (lazy)
    try:
        from inference.triton_client import get_inference_client
        triton_client = get_inference_client()
        src = triton_client.get_server_status().get("connected") and "triton" or "local"
        print(f"[Triton] Inference client ready (source: {src})")
    except Exception as e:
        print(f"[Triton] Client unavailable: {e}")
        triton_client = None

    # Feature lineage
    try:
        from features.feature_lineage import (
            FeatureLineageRegistry,
            register_tradersapp_lineage,
            warmup_online_store,
        )
        lineage_registry = FeatureLineageRegistry()
        register_tradersapp_lineage(lineage_registry)
        print(f"[Feast] Feature lineage registered ({len(lineage_registry.get_all())} features)")

        warmup_result = warmup_online_store(
            redis_url=os.environ.get("FEAST_REDIS_URL", "redis://localhost:6379"),
            db_path=config.DB_PATH,
            symbol="MNQ",
            lookback_minutes=60,
        )
        print(f"[Feast] Online store warmed: {warmup_result['timestamps_warmed']} timestamps "
              f"loaded in {warmup_result['duration_ms']:.1f}ms")
        feast_warmed = True
    except Exception as e:
        print(f"[Feast] Warmup skipped (online store unavailable): {e}")
        feast_warmed = False
        try:
            from features.feature_lineage import FeatureLineageRegistry
            lineage_registry = FeatureLineageRegistry()
        except Exception:
            lineage_registry = None

    # Warm model registry
    try:
        registry_status = app.state.model_registry_client.warm_models()
        print(f"[ModelRegistry] Warmed: {registry_status.get('cached_instances', [])}")
        if PROMETHEUS_AVAILABLE and set_prometheus_models_loaded:
            cnt = registry_status.get("predictor", {}).get("loaded_model_count", 0)
            set_prometheus_models_loaded(cnt)
    except Exception as e:
        print(f"Warning: could not warm model registry on startup: {e}")
    finally:
        if PROMETHEUS_AVAILABLE and record_prometheus_retrain:
            record_prometheus_retrain(triggered=False, in_progress=False)

    yield

    # Shutdown
    print("ML Engine shutting down...")
    RedisCache.close_pools()
    model_registry_client = getattr(app.state, "model_registry_client", None)
    if model_registry_client is not None:
        model_registry_client.close()
    if kafka_consumer:
        kafka_consumer.stop()
    if kafka_producer:
        kafka_producer.close()