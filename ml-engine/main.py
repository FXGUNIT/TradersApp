"""
ML Engine — FastAPI Application
Port 8001 — handles training, prediction, consensus, health
"""
import os
import sys
import time
import traceback
import hashlib
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from pydantic import BaseModel, Field
from typing import Optional

# Add ml-engine to path
sys.path.insert(0, str(Path(__file__).parent))

import config
from data.candle_db import CandleDatabase
from infrastructure.performance import (
    get_cache, get_sla_monitor, RedisCache, CacheConfig, SLAMonitor,
)
from infrastructure.drift_detector import (
    DriftMonitor, DriftThresholds,
)
from feedback.feedback_logger import FeedbackLogger

# ── Event-driven: Kafka producer + consumer ──────────────────────────────────────
_kafka_producer: Optional[Any] = None
_kafka_consumer: Optional[Any] = None

try:
    from kafka.producer import KafkaProducerClient, get_producer
    from kafka.consumer import KafkaConsumerClient, get_consumer
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False
    KafkaProducerClient = None
    KafkaConsumerClient = None
    get_producer = None
    get_consumer = None

# ── Observability: Prometheus metrics ──────────────────────────────────────────
try:
    from infrastructure.prometheus_exporter import (
        PrometheusMiddleware,
        handle_metrics,
        record_prediction as record_prometheus_prediction,
        record_cache as record_prometheus_cache,
        record_retrain as record_prometheus_retrain,
        set_models_loaded as set_prometheus_models_loaded,
    )
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    PrometheusMiddleware = None
    record_prometheus_prediction = None
    record_prometheus_cache = None
    record_prometheus_retrain = None
    set_prometheus_models_loaded = None

# ── Observability: Jaeger tracing ─────────────────────────────────────────────
try:
    from infrastructure.tracing import init_tracing, add_jaeger_middleware
    TRACING_AVAILABLE = True
except ImportError:
    TRACING_AVAILABLE = False
    add_jaeger_middleware = None
from feedback.trade_log_processor import TradeLogProcessor
from feedback.retrain_pipeline import RetrainPipeline, RetrainConfig
from features.feature_pipeline import engineer_features, get_feature_vector
from training.trainer import Trainer
from training.model_store import ModelStore
from inference.predictor import Predictor
from inference.consensus_aggregator import ConsensusAggregator
from inference.triton_client import TritonInferenceClient, get_inference_client
from inference.onnx_exporter import export_model, export_all as export_all_models, list_onnx_models, get_onnx_output_dir
from inference.triton_server import TRITON_REPO

ONNX_DIR = get_onnx_output_dir()
from optimization.pso_optimizer import run_alpha_discovery, NichingPSO, PSOOptimizer
from models.mamba.mamba_sequence_model import get_mamba_prediction, MambaTradingModel, MAMBA_AVAILABLE, MODEL_SIZES
from models.regime.regime_ensemble import RegimeEnsemble
from backtest.pbo_engine import (
    PBOConfig,
    WFPBOConfig,
    evaluate_pbo,
    walk_forward_pbo,
    monte_carlo_pbo,
    monte_carlo_returns,
    run_full_pbo_evaluation,
    auto_tune_to_pass_pbo,
    momentum_strategy,
    mean_reversion_strategy,
    regime_switching_strategy,
    sharpe_ratio,
)


# -------------------------------------------------------------------------
# Lifespan
# -------------------------------------------------------------------------

db: CandleDatabase | None = None
trainer: Trainer | None = None
predictor: Predictor | None = None
consensus_agg: ConsensusAggregator | None = None
store: ModelStore | None = None
regime_ensemble: RegimeEnsemble | None = None
drift_monitor: DriftMonitor | None = None
feedback_logger: FeedbackLogger | None = None
trade_processor: TradeLogProcessor | None = None
retrain_pipeline: RetrainPipeline | None = None
triton_client: TritonInferenceClient | None = None
kafka_producer: Any | None = None   # set in lifespan
kafka_consumer: Any | None = None   # set in lifespan
start_time: float = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db, trainer, predictor, consensus_agg, store, regime_ensemble, drift_monitor
    global feedback_logger, trade_processor, retrain_pipeline, triton_client
    global kafka_producer, kafka_consumer

    db = CandleDatabase(config.DB_PATH)
    trainer = Trainer(db_path=config.DB_PATH, store_dir=config.MODEL_STORE)
    predictor = Predictor(store_dir=config.MODEL_STORE)
    consensus_agg = ConsensusAggregator()
    store = ModelStore(config.MODEL_STORE)
    regime_ensemble = RegimeEnsemble(random_state=42)
    drift_monitor = DriftMonitor()

    # Feedback loop — closed-loop retraining pipeline
    feedback_logger = FeedbackLogger(db)
    trade_processor = TradeLogProcessor(db, feedback_logger)
    retrain_pipeline = RetrainPipeline(db, trainer, drift_monitor, trade_processor)

    # ── Kafka: producer + consumer ──────────────────────────────────────────────
    if KAFKA_AVAILABLE:
        try:
            kafka_producer = get_producer()
            kafka_consumer = get_consumer()
            if kafka_consumer and kafka_consumer._enable:
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

    # Triton inference client (lazy — only connects when needed)
    triton_client = get_inference_client()
    print(f"[Triton] Inference client ready (source: {triton_client.get_server_status().get('connected') and 'triton' or 'local'})")

    # Load models on startup
    try:
        predictor.load_all_models()
        print(f"Loaded {len(predictor._models)} models on startup")
    except Exception as e:
        print(f"Warning: could not load models on startup: {e}")
    finally:
        if PROMETHEUS_AVAILABLE and set_prometheus_models_loaded and predictor is not None:
            set_prometheus_models_loaded(len(predictor._models))
        if PROMETHEUS_AVAILABLE and record_prometheus_retrain:
            record_prometheus_retrain(triggered=False, in_progress=False)

    yield

    # Cleanup
    print("ML Engine shutting down...")
    if kafka_consumer:
        kafka_consumer.stop()
    if kafka_producer:
        kafka_producer.close()


# -------------------------------------------------------------------------
# App
# -------------------------------------------------------------------------

app = FastAPI(
    title="TradersApp ML Engine",
    description="Multi-Model Self-Training Session-Based Trading Intelligence",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — restrict to known origins in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Lock down with explicit origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Observability middleware ───────────────────────────────────────────────────
# Prometheus HTTP metrics (must be outermost to capture all requests)
if PROMETHEUS_AVAILABLE and PrometheusMiddleware:
    app.add_middleware(PrometheusMiddleware)

# Jaeger distributed tracing
if TRACING_AVAILABLE and add_jaeger_middleware:
    init_tracing()   # initialize once at startup
    add_jaeger_middleware(app)


# -------------------------------------------------------------------------
# Pydantic models
# -------------------------------------------------------------------------

class TrainRequest(BaseModel):
    mode: str = Field(default="full", pattern="^(full|incremental)$")
    symbol: str = Field(default="MNQ")
    min_trades: int = Field(default=100, ge=50, le=10000)


class PredictRequest(BaseModel):
    symbol: str = Field(default="MNQ")
    session_id: int = Field(default=1, ge=0, le=2)
    math_engine_snapshot: Optional[dict] = Field(default=None)
    key_levels: Optional[dict] = Field(default=None)
    # Last N candles (OHLCV)
    candles: list[dict] = Field(default_factory=list)
    # Recent trades for rolling stats
    trades: list[dict] = Field(default_factory=list)


class CandleInput(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    session_id: Optional[int] = None


class TradeInput(BaseModel):
    entry_time: str
    exit_time: Optional[str] = None
    entry_price: float
    exit_price: Optional[float] = None
    direction: int
    session_id: int
    pnl_ticks: Optional[float] = None
    pnl_dollars: Optional[float] = None
    result: Optional[str] = None
    amd_phase: Optional[str] = None


class UploadCandlesRequest(BaseModel):
    symbol: str = Field(default="MNQ")
    candles: list[CandleInput]


class UploadTradesRequest(BaseModel):
    symbol: str = Field(default="MNQ")
    trades: list[TradeInput]


# -------------------------------------------------------------------------
# Backtest / PBO Pydantic models
# -------------------------------------------------------------------------

class PBOBacktestRequest(BaseModel):
    """Run CPCV-based PBO evaluation on strategy variants."""
    strategy_name: str = Field(default="momentum")
    symbol: str = Field(default="MNQ")
    strategy_type: str = Field(default="momentum", pattern="^(momentum|mean_reversion|regime_switching)$")
    lookback: list[int] = Field(default_factory=lambda: [5, 10, 20, 30, 50])
    threshold: list[float] = Field(default_factory=lambda: [0.005, 0.01, 0.015, 0.02])
    n_trials: int = Field(default=100, ge=20, le=500)
    n_permutations: int = Field(default=100, ge=20, le=500)
    n_train_splits: int = Field(default=5, ge=2, le=10)
    purge_pct: float = Field(default=0.1, ge=0.0, le=0.3)
    embargo_pct: float = Field(default=0.1, ge=0.0, le=0.3)
    confidence_level: float = Field(default=0.05, ge=0.01, le=0.2)
    min_trades: int = Field(default=100, ge=20)


class MCBacktestRequest(BaseModel):
    """Run Monte Carlo PBO evaluation."""
    strategy_name: str = Field(default="momentum")
    symbol: str = Field(default="MNQ")
    strategy_type: str = Field(default="momentum", pattern="^(momentum|mean_reversion|regime_switching)$")
    n_simulations: int = Field(default=1000, ge=100, le=5000)
    n_trials: int = Field(default=50, ge=10, le=200)
    block_size: int = Field(default=20, ge=5, le=100)
    min_trades: int = Field(default=100, ge=20)


class FullPBOBacktestRequest(BaseModel):
    """Run all 3 PBO modes: CPCV + Walk-Forward + Monte Carlo."""
    strategy_name: str = Field(default="momentum")
    symbol: str = Field(default="MNQ")
    strategy_type: str = Field(default="momentum", pattern="^(momentum|mean_reversion|regime_switching)$")
    lookback: list[int] = Field(default_factory=lambda: [5, 10, 20, 30, 50])
    threshold: list[float] = Field(default_factory=lambda: [0.005, 0.01, 0.015, 0.02])
    n_trials: int = Field(default=100, ge=20, le=500)
    n_simulations: int = Field(default=1000, ge=100, le=5000)
    min_trades: int = Field(default=100, ge=20)


class AutotuneRequest(BaseModel):
    """Auto-tune ML model hyperparameters to minimize PBO."""
    strategy_name: str = Field(default="momentum")
    symbol: str = Field(default="MNQ")
    strategy_type: str = Field(default="momentum", pattern="^(momentum|mean_reversion|regime_switching)$")
    initial_grid: dict = Field(default_factory=lambda: {
        "lookback": [5, 10, 20, 30],
        "threshold": [0.005, 0.01, 0.015],
    })
    target_pbo: float = Field(default=0.05, ge=0.01, le=0.2)
    max_refinements: int = Field(default=3, ge=1, le=5)
    min_trades: int = Field(default=100, ge=20)


class BacktestTradesRequest(BaseModel):
    """Upload trade log for PBO evaluation."""
    symbol: str = Field(default="MNQ")
    trades: list[TradeInput]
    returns_override: list[float] | None = Field(default=None)  # precomputed returns


# -------------------------------------------------------------------------
# Health
# -------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Health check endpoint."""
    uptime = time.time() - start_time
    try:
        stats = db.get_stats()
    except Exception:
        stats = {}
    try:
        models = store.list_all_models() if store else []
    except Exception:
        models = []

    return {
        "status": "healthy",
        "uptime_sec": round(uptime, 1),
        "db_candles": stats.get("candles", 0),
        "db_trades": stats.get("trades", 0),
        "db_sessions": stats.get("sessions", 0),
        "models_loaded": len(predictor._models) if predictor else 0,
        "models_available": models,
        "last_training": stats.get("last_training"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Prometheus /metrics ────────────────────────────────────────────────────────
if PROMETHEUS_AVAILABLE:

    @app.get("/metrics", include_in_schema=False)
    async def metrics():
        """Prometheus metrics endpoint for scraping."""
        body, content_type = handle_metrics()
        return Response(content=body, headers={"Content-Type": content_type})

else:

    @app.get("/metrics", include_in_schema=False)
    async def metrics_unavailable():
        return PlainTextResponse(content="# prometheus-client not installed\n", media_type="text/plain")


@app.get("/sla")
async def get_sla_report(endpoint: str | None = None):
    """
    SLA compliance report for ML Engine endpoints.
    Use ?endpoint=/predict to filter to a specific endpoint.
    Returns P50/P95/P99 latency, error rate, and uptime per rolling window.
    """
    monitor = get_sla_monitor()
    report = monitor.get_sla_report(endpoint or "ALL")
    return {
        "endpoint": endpoint or "ALL",
        "windows": report,
        "targets": SLAMonitor.SLA_TARGETS,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/cache/stats")
async def get_cache_stats():
    """Cache hit/miss statistics for Redis + in-memory LRU."""
    cache = get_cache()
    return {
        "cache_stats": cache.get_stats(),
        "redis_available": cache._client is not None,
    }


# -------------------------------------------------------------------------
# MLflow Integration
# -------------------------------------------------------------------------

MLFLOW_AVAILABLE = False
try:
    from infrastructure.mlflow_client import get_mlflow_client, MLFLOW_TRACKING_URI, MLFLOW_AVAILABLE as _MLF_AVAILABLE
    MLFLOW_AVAILABLE = _MLF_AVAILABLE
except ImportError:
    MLFLOW_AVAILABLE = False
    MLFLOW_TRACKING_URI = "http://localhost:5000"
    def get_mlflow_client(*args, **kwargs):
        class NoOpClient:
            def start_run(self, *a, **k): return self
            def log_params(self, *a, **k): pass
            def log_metrics(self, *a, **k): pass
            def log_tag(self, *a, **k): pass
            def get_experiment_summary(self): return {"available": False}
            def __enter__(self): return self
            def __exit__(self, *a): pass
            def end_run(self, *a, **k): pass
        return NoOpClient()


@app.get("/mlflow/status")
async def mlflow_status():
    """Check MLflow server connectivity and availability."""
    if not MLFLOW_AVAILABLE:
        return {
            "ok": False,
            "mlflow_available": False,
            "message": "mlflow package not installed. Install: pip install mlflow",
        }
    try:
        from infrastructure.mlflow_client import get_mlflow_client
        client = get_mlflow_client("direction")
        summary = client.get_experiment_summary()
        return {
            "ok": True,
            "mlflow_available": True,
            "tracking_uri": MLFLOW_TRACKING_URI,
            "experiments": summary,
        }
    except Exception as e:
        return {
            "ok": False,
            "mlflow_available": True,
            "mlflow_error": str(e),
            "tracking_uri": MLFLOW_TRACKING_URI,
            "message": "MLflow installed but server unreachable. Start with: docker compose -f docker-compose.mlflow.yml up -d",
        }


@app.get("/mlflow/experiments")
async def mlflow_experiments(experiment: str | None = None):
    """
    Query MLflow experiments and runs.
    Use ?experiment=direction to filter by experiment name.
    """
    if not MLFLOW_AVAILABLE:
        return {"ok": False, "error": "mlflow not installed"}
    try:
        from infrastructure.mlflow_client import get_mlflow_client
        exp_name = experiment or "direction"
        client = get_mlflow_client(exp_name)
        return {
            "ok": True,
            "experiment": f"tradersapp_{exp_name}",
            "summary": client.get_experiment_summary(),
            "tracking_uri": MLFLOW_TRACKING_URI,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/mlflow/models")
async def mlflow_models(model_prefix: str = "direction"):
    """
    List registered models in MLflow model registry.
    Shows all registered versions for the requested model prefix.
    """
    if not MLFLOW_AVAILABLE:
        return {"ok": False, "error": "mlflow not installed"}
    try:
        from infrastructure.mlflow_client import get_mlflow_client
        client = get_mlflow_client(model_prefix)
        results = client.get_registry_models(f"{model_prefix}_")

        return {
            "ok": True,
            "models": results,
            "tracking_uri": MLFLOW_TRACKING_URI,
            "dashboard_url": f"{MLFLOW_TRACKING_URI}/#/models",
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/mlflow/promote")
async def mlflow_promote(
    model_name: str,
    from_stage: str = "staging",
    to_stage: str = "production",
):
    """
    Promote a model from staging → production in MLflow registry.
    Example: POST /mlflow/promote?model_name=direction_lightgbm
    """
    if not MLFLOW_AVAILABLE:
        return {"ok": False, "error": "mlflow not installed"}
    try:
        from infrastructure.mlflow_client import get_mlflow_client
        client = get_mlflow_client("direction")
        result = client.promote_model(model_name, from_stage, to_stage)
        if not result.get("ok", False):
            return {
                "ok": False,
                "error": result.get("error") or result.get("reason") or "Model promotion failed",
                "promotion": result,
            }
        return {"ok": True, "promotion": result}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# -------------------------------------------------------------------------
# Drift Detection
# -------------------------------------------------------------------------

class RecordPredictionRequest(BaseModel):
    """Record a prediction result for concept drift monitoring."""
    correct: bool
    confidence: float = Field(ge=0.0, le=1.0)
    model_name: str = Field(default="ensemble")


class DriftDetectRequest(BaseModel):
    """Run drift detection on demand."""
    symbol: str = Field(default="MNQ")
    candles: list[dict] = Field(default_factory=list)
    trades: list[dict] = Field(default_factory=list)
    current_regime: str | None = Field(default=None)
    regime_confidence: float = Field(default=1.0, ge=0.0, le=1.0)


@app.get("/drift/status", tags=["drift"])
async def drift_status():
    """
    Get current drift status for all three drift detectors:
    - Feature drift (PSI on rolling windows)
    - Concept drift (rolling win rate vs baseline)
    - Regime drift (HMM posterior persistence)
    """
    if drift_monitor is None:
        return {"ok": False, "error": "DriftMonitor not initialized"}
    try:
        features_df = pd.DataFrame()
        trades_df = pd.DataFrame()
        if db is not None:
            try:
                trades_df = db.get_trade_log(limit=500)
            except Exception:
                pass
        result = drift_monitor.check_all(features_df, trades_df)
        return {"ok": True, **result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/drift/detect", tags=["drift"])
async def drift_detect(request: DriftDetectRequest):
    """
    Run full drift detection across all three drift detectors.

    - Feature drift: PSI against rolling baseline distributions
    - Concept drift: rolling win rate vs training-time baseline
    - Regime drift: HMM posterior consistency

    Returns should_retrain = True when drift severity warrants retraining.
    """
    if drift_monitor is None:
        return {"ok": False, "error": "DriftMonitor not initialized"}
    try:
        features_df = pd.DataFrame(request.candles) if request.candles else pd.DataFrame()
        if not features_df.empty and "timestamp" in features_df.columns:
            features_df["timestamp"] = pd.to_datetime(features_df["timestamp"], errors="coerce")

        trades_df = pd.DataFrame(request.trades) if request.trades else pd.DataFrame()

        result = drift_monitor.check_all(
            features_df=features_df,
            trades_df=trades_df,
            current_regime=request.current_regime,
            regime_confidence=request.regime_confidence,
        )

        return {"ok": True, **result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/drift/record-prediction", tags=["drift"])
async def drift_record_prediction(request: RecordPredictionRequest):
    """
    Record a prediction result for concept drift monitoring.

    After each trade resolves (win/loss), call this to track
    rolling accuracy against the training-time baseline.
    When accuracy drops below threshold, retraining is recommended.
    """
    if drift_monitor is None:
        return {"ok": False, "error": "DriftMonitor not initialized"}
    try:
        drift_monitor.concept_drift.record_prediction(
            correct=request.correct,
            confidence=request.confidence,
        )
        concept_result = drift_monitor.concept_drift.detect()
        return {
            "ok": True,
            "recorded": True,
            "concept_drift": concept_result,
            "should_retrain": drift_monitor.concept_drift.should_retrain(),
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/drift/baseline", tags=["drift"])
async def drift_set_baseline(symbol: str = "MNQ"):
    """
    Refresh the drift baselines from current DB data.

    Call this after training to establish the new "normal" baseline
    against which future drift is measured.
    """
    if drift_monitor is None or db is None:
        return {"ok": False, "error": "DriftMonitor or DB not initialized"}
    try:
        trades_df = db.get_trade_log(limit=10000, symbol=symbol)
        end = datetime.now(timezone.utc).isoformat()
        start = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        features_df_raw = db.get_candles(start, end, symbol, limit=10000)
        features_df = features_df_raw

        if len(trades_df) < 50:
            return {"ok": False, "error": f"Not enough trades: {len(trades_df)} (need ≥50)"}

        drift_monitor.feature_drift.update_baseline(features_df, trades_df)
        drift_monitor.concept_drift.set_baseline(trades_df)

        return {
            "ok": True,
            "baseline_trades": len(trades_df),
            "baseline_candles": len(features_df),
            "message": "Drift baselines updated. Future drift will be measured against this data.",
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/drift/thresholds", tags=["drift"])
async def drift_thresholds():
    """Get current drift detection thresholds."""
    if drift_monitor is None:
        return {"ok": False, "error": "DriftMonitor not initialized"}
    t = drift_monitor.thresholds
    return {
        "ok": True,
        "psi_feature_warning": t.psi_feature_warning,
        "psi_feature_alert": t.psi_feature_alert,
        "psi_feature_critical": t.psi_feature_critical,
        "accuracy_drop_warning": t.accuracy_drop_warning,
        "accuracy_drop_alert": t.accuracy_drop_alert,
        "rolling_window_trades": t.rolling_window_trades,
        "regime_change_threshold": t.regime_change_threshold,
        "min_baseline_trades": t.min_baseline_trades,
        "min_current_trades": t.min_current_trades,
    }


# -------------------------------------------------------------------------
# Training
# -------------------------------------------------------------------------

@app.post("/train")
async def train(request: TrainRequest, background: BackgroundTasks):
    """
    Trigger model training.
    Runs in background — returns immediately with training job ID.
    """
    def _do_train():
        try:
            result = trainer.train_direction_models(
                mode=request.mode,
                symbol=request.symbol,
                min_trades=request.min_trades,
                verbose=True,
            )
            # Reload models after training
            predictor.load_all_models()
            if PROMETHEUS_AVAILABLE and set_prometheus_models_loaded and predictor is not None:
                set_prometheus_models_loaded(len(predictor._models))
            return result
        except Exception as e:
            return {"error": str(e), "traceback": traceback.format_exc()}
        finally:
            if PROMETHEUS_AVAILABLE and record_prometheus_retrain:
                record_prometheus_retrain(triggered=False, in_progress=False)

    if PROMETHEUS_AVAILABLE and record_prometheus_retrain:
        record_prometheus_retrain(triggered=True, in_progress=True)
    background.add_task(_do_train)

    return {
        "status": "training_started",
        "mode": request.mode,
        "symbol": request.symbol,
        "message": "Training running in background. Poll /model-status for results.",
    }


@app.post("/train-sync")
async def train_sync(request: TrainRequest):
    """Synchronous training — waits for completion."""
    try:
        if PROMETHEUS_AVAILABLE and record_prometheus_retrain:
            record_prometheus_retrain(triggered=True, in_progress=True)
        result = trainer.train_direction_models(
            mode=request.mode,
            symbol=request.symbol,
            min_trades=request.min_trades,
            verbose=True,
        )
        predictor.load_all_models()
        if PROMETHEUS_AVAILABLE and set_prometheus_models_loaded and predictor is not None:
            set_prometheus_models_loaded(len(predictor._models))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if PROMETHEUS_AVAILABLE and record_prometheus_retrain:
            record_prometheus_retrain(triggered=False, in_progress=False)


# -------------------------------------------------------------------------
# Prediction / Consensus
# -------------------------------------------------------------------------

@app.post("/predict")
async def predict(request: PredictRequest):
    """
    Run all loaded models on current market state.
    Returns per-model votes + consensus signal.
    Cached in Redis (10s TTL) for sub-50ms repeat predictions.
    """
    try:
        # ── SLA Monitor ───────────────────────────────────────────────────
        monitor = get_sla_monitor()
        start = time.time()

        # ── Cache check (Redis or in-memory LRU) ──────────────────────────
        cache = get_cache()
        candle_hash = hashlib.sha256(
            json.dumps(request.candles[-20:], sort_keys=True, default=str).encode()
        ).hexdigest()[:16]
        cache_key = f"predict:{request.symbol}:{request.session_id}:{candle_hash}"

        cached = cache.get(cache_key)
        if cached is not None:
            if PROMETHEUS_AVAILABLE and record_prometheus_cache:
                record_prometheus_cache(hit=True)
            cached["_cached"] = True
            cached["_cache_age_ms"] = round((time.time() - start) * 1000, 1)
            latency_ms = (time.time() - start) * 1000
            monitor.record("/predict", latency_ms, 200)
            if PROMETHEUS_AVAILABLE and record_prometheus_prediction:
                record_prometheus_prediction(
                    latency_seconds=latency_ms / 1000,
                    confidence=float(cached.get("confidence") or 0.0),
                    symbol=request.symbol,
                )
            return cached
        elif PROMETHEUS_AVAILABLE and record_prometheus_cache:
            record_prometheus_cache(hit=False)

        # Build candles DataFrame
        if request.candles:
            df = pd.DataFrame([c.model_dump() for c in request.candles])
            df["timestamp"] = pd.to_datetime(df["timestamp"])
        else:
            # Use latest candles from DB
            df = db.get_latest_candles(request.symbol, n=100)
            if df.empty:
                raise HTTPException(status_code=400, detail="No candles available. Upload data first.")

        # Build trades DataFrame
        trade_df = None
        if request.trades:
            trade_df = pd.DataFrame([t.model_dump() for t in request.trades])

        # Build feature dict from math engine snapshot
        me = request.math_engine_snapshot or {}

        # Get votes from all models
        votes_result = predictor.predict(
            candles_df=df,
            trade_log_df=trade_df,
            math_engine_snapshot=me,
            key_levels=request.key_levels,
        )

        votes = votes_result.get("votes", {})
        consensus = votes_result.get("consensus", {})

        # Build feature dict for explanations
        if not df.empty:
            feat_df = engineer_features(df, trade_df, None, me, request.key_levels)
            feat_vec = get_feature_vector(feat_df)
            feat_dict = feat_vec.iloc[-1].to_dict() if not feat_vec.empty else {}
            feat_dict["session_id"] = request.session_id
        else:
            feat_dict = {}

        # Aggregate
        model_metas = {}
        for name in votes.keys():
            try:
                meta = store.load_meta(name, "latest")
                model_metas[name] = meta
            except Exception:
                pass

        output = consensus_agg.aggregate(
            votes=votes,
            consensus=consensus,
            model_metas=model_metas,
            feature_dict=feat_dict,
            session_id=request.session_id,
            math_engine_snapshot=me,
        )

        # Append physics-based regime from FP-FK + Anomalous Diffusion
        try:
            if not df.empty and regime_ensemble is not None:
                feat_for_regime = engineer_features(df)
                for col in ["vr", "adx", "atr", "ci", "vwap", "amd_ACCUMULATION",
                            "amd_MANIPULATION", "amd_DISTRIBUTION", "amd_TRANSITION", "amd_UNCLEAR"]:
                    if col not in feat_for_regime.columns:
                        feat_for_regime[col] = 0.0
                regime_result = regime_ensemble.advance(feat_for_regime)
                output["physics_regime"] = {
                    "regime": regime_result["regime"],
                    "regime_id": regime_result["regime_id"],
                    "confidence": regime_result["regime_confidence"],
                    "posteriors": regime_result["regime_posteriors"],
                    "q_parameter": regime_result["fp_fk"]["q_parameter"],
                    "fk_wave_speed": regime_result["fp_fk"]["fk_wave_speed"],
                    "fk_wave_acceleration": regime_result["fp_fk"]["fk_wave_acceleration"],
                    "criticality_index": regime_result["fp_fk"]["criticality_index"],
                    "front_direction": regime_result["fp_fk"]["front_direction"],
                    "hurst_H": regime_result["anomalous_diffusion"]["hurst_H"],
                    "diffusion_type": regime_result["anomalous_diffusion"]["diffusion_type"],
                    "vol_clustering": regime_result["anomalous_diffusion"]["vol_clustering"],
                    "deleverage_signal": regime_result["deleverage_signal"],
                    "deleverage_reason": regime_result["deleverage_reason"],
                    "stop_multiplier": regime_result["stop_multiplier"],
                    "position_adjustment": regime_result["position_adjustment"],
                    "signal_adjustment": regime_result["signal_adjustment"],
                    "explanation": regime_result["explanation"],
                }
        except Exception as e:
            output["physics_regime"] = {"error": str(e)}

        # ── Append Mamba SSM vote into consensus ─────────────────────────────
        try:
            if request.candles or not df.empty:
                candle_list = request.candles if request.candles else df.to_dict("records")
                if candle_list:
                    mamba_result = get_mamba_prediction(candle_list, model_size="mamba-790m")
                    if mamba_result.get("ok", False):
                        output["votes"]["mamba_ssm"] = {
                            "signal": mamba_result["signal"],
                            "confidence": mamba_result["confidence"],
                            "probability_long": mamba_result["probability_long"],
                            "probability_short": mamba_result["probability_short"],
                            "primary_reason": mamba_result.get("reasoning", ""),
                            "model": mamba_result.get("model_used", "mamba-790m"),
                            "inference_ms": mamba_result.get("inference_ms", 0),
                        }
                        output["mamba"] = {
                            "signal": mamba_result["signal"],
                            "confidence": mamba_result["confidence"],
                            "alpha_score": mamba_result.get("alpha_score", 0),
                            "pattern_type": mamba_result.get("pattern_type", "UNKNOWN"),
                            "predicted_regime": mamba_result.get("predicted_regime", "NORMAL"),
                            "regime_probs": mamba_result.get("regime_probs", {}),
                            "expected_move_ticks": mamba_result.get("expected_move_ticks", 0),
                            "inference_ms": mamba_result.get("inference_ms", 0),
                            "model_used": mamba_result.get("model_used", "mamba-790m"),
                            "model_info": MODEL_SIZES.get("mamba-790m", {}),
                        }
                        output["models_used"] = output.get("models_used", 0) + 1
                    else:
                        output["mamba"] = {"available": False, "error": mamba_result.get("error", "unknown")}
        except Exception as e:
            output["mamba"] = {"available": False, "error": str(e)}

        # ── Publish consensus signal to Kafka (non-blocking) ─────────────
        if KAFKA_AVAILABLE and kafka_producer is not None:
            try:
                from datetime import datetime as dt
                kafka_producer.publish_consensus(
                    symbol=request.symbol,
                    signal={
                        "signal": output.get("signal", "NEUTRAL"),
                        "confidence": output.get("confidence", 0.0),
                        "long_score": output.get("long_score", 0),
                        "short_score": output.get("short_score", 0),
                        "votes": output.get("votes", {}),
                        "generated_at": dt.now().isoformat(),
                    },
                    regime=output.get("physics_regime", {}).get("regime"),
                )
                # Also publish per-model predictions
                for model_name, vote in output.get("votes", {}).items():
                    kafka_producer.publish_prediction(
                        symbol=request.symbol,
                        model_name=model_name,
                        prediction=vote,
                    )
            except Exception:
                pass  # Never block response for Kafka failure

        # ── Cache result (10s TTL for live predictions) ───────────────────
        cache.set(cache_key, output, ttl=10)

        # ── SLA recording ─────────────────────────────────────────────────
        latency_ms = (time.time() - start) * 1000
        monitor.record("/predict", latency_ms, 200)
        if PROMETHEUS_AVAILABLE and record_prometheus_prediction:
            record_prometheus_prediction(
                latency_seconds=latency_ms / 1000,
                confidence=float(output.get("confidence") or 0.0),
                symbol=request.symbol,
            )
        output["_latency_ms"] = round(latency_ms, 1)
        return output

    except HTTPException:
        raise
    except Exception as e:
        latency_ms = (time.time() - start) * 1000
        monitor.record("/predict", latency_ms, 500)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------------------
# FP-FK + Anomalous Diffusion Regime Endpoint
# -------------------------------------------------------------------------

class RegimeRequest(BaseModel):
    symbol: str = Field(default="MNQ")
    candles: list[dict] = Field(default_factory=list)


@app.post("/regime")
async def get_regime(request: RegimeRequest):
    """
    Full physics-based regime analysis combining:

    1. HMM — Gaussian Hidden Markov Model (COMPRESSION/NORMAL/EXPANSION)
    2. FP-FK — Fokker-Planck + Fisher-KPP PDE with Tsallis q-Gaussians
       - Tsallis q-parameter: measures fat-tailedness/deviation from Gaussian
       - Fisher-KPP wave speed: velocity of regime transition front
       - Criticality index κ: divergence of probability flux (deleverage trigger)
       - Wave front acceleration: imminent regime shift warning
    3. Anomalous Diffusion — Hurst exponent via DFA + GHE
       - H < 0.5 → antipersistent (mean-reversion)
       - H > 0.5 → persistent (momentum)
       - Multifractality: complexity of return dynamics

    Returns deleverage probability, stop loss multiplier, and signal adjustment.
    Cached in Redis (60s TTL) — regime changes slowly.
    """
    start = time.time()
    cache = get_cache()
    monitor = get_sla_monitor()

    # ── Cache check (regime changes slowly — 60s TTL) ────────────────────
    candle_hash = hashlib.sha256(
        json.dumps(request.candles[-20:], sort_keys=True, default=str).encode()
    ).hexdigest()[:16]
    cache_key = f"regime:{request.symbol}:{candle_hash}"
    cached = cache.get(cache_key)
    if cached is not None:
        if PROMETHEUS_AVAILABLE and record_prometheus_cache:
            record_prometheus_cache(hit=True)
        cached["_cached"] = True
        cached["_cache_age_ms"] = round((time.time() - start) * 1000, 1)
        monitor.record("/regime", (time.time() - start) * 1000, 200)
        return cached
    elif PROMETHEUS_AVAILABLE and record_prometheus_cache:
        record_prometheus_cache(hit=False)

    try:
        # Build candles DataFrame
        if request.candles:
            df = pd.DataFrame([c for c in request.candles])
            df["timestamp"] = pd.to_datetime(df["timestamp"])
        else:
            df = db.get_latest_candles(request.symbol, n=200)
            if df.empty:
                raise HTTPException(status_code=400, detail="No candles available.")

        if len(df) < 50:
            raise HTTPException(status_code=400, detail="Need at least 50 candles for regime analysis.")

        # Engineer features needed for regime models
        feat_df = engineer_features(df)
        me_snapshot = request.candles[0] if request.candles else {}

        # Inject math engine features if available
        for col in ["vr", "adx", "atr", "ci", "vwap", "amd_ACCUMULATION",
                    "amd_MANIPULATION", "amd_DISTRIBUTION", "amd_TRANSITION", "amd_UNCLEAR"]:
            if col not in feat_df.columns:
                feat_df[col] = 0.0

        # Advance the regime ensemble
        regime_result = regime_ensemble.advance(feat_df)

        return {
            "ok": True,
            "regime": regime_result["regime"],
            "regime_id": regime_result["regime_id"],
            "confidence": regime_result["regime_confidence"],
            "posteriors": regime_result["regime_posteriors"],
            "model_weights": regime_result["model_weights"],
            "hmm_agreement": regime_result["model_weights"]["hmm"] == regime_result["model_weights"]["fp_fk"],

            # FP-FK
            "fp_fk": {
                "regime": regime_result["fp_fk"]["regime"],
                "q_parameter": regime_result["fp_fk"]["q_parameter"],
                "fk_wave_speed": regime_result["fp_fk"]["fk_wave_speed"],
                "fk_min_wave_speed": regime_result["fp_fk"]["fk_min_wave_speed"],
                "fk_wave_acceleration": regime_result["fp_fk"]["fk_wave_acceleration"],
                "criticality_index": regime_result["fp_fk"]["criticality_index"],
                "front_direction": regime_result["fp_fk"]["front_direction"],
                "front_position_normalized": regime_result["fp_fk"]["front_position_normalized"],
                "reaction_rate": regime_result["fp_fk"]["reaction_rate"],
                "diffusion_coeff": regime_result["fp_fk"]["diffusion_coeff"],
                "drift_vr": regime_result["fp_fk"]["drift_vr"],
                "drift_adx": regime_result["fp_fk"]["drift_adx"],
                "entropy_rate": regime_result["fp_fk"]["entropy_rate"],
                "current_vr": regime_result["fp_fk"]["current_vr"],
                "current_adx": regime_result["fp_fk"]["current_adx"],
                "explanation": regime_result["fp_fk"]["explanation"],
            },

            # HMM
            "hmm": {
                "regime": regime_result["hmm"]["regime"],
                "confidence": regime_result["hmm"]["confidence"],
                "previous_regime": regime_result["hmm"]["previous_regime"],
                "regime_change": regime_result["hmm"]["regime_change"],
                "transition_prob": regime_result["hmm"]["transition_prob"],
            },

            # Anomalous Diffusion
            "anomalous_diffusion": {
                "hurst_H": regime_result["anomalous_diffusion"]["hurst_H"],
                "H_dfa": regime_result["anomalous_diffusion"]["H_dfa"],
                "H_vr": regime_result["anomalous_diffusion"]["H_vr"],
                "H_ghe": regime_result["anomalous_diffusion"]["H_ghe"],
                "diffusion_type": regime_result["anomalous_diffusion"]["diffusion_type"],
                "multifractality": regime_result["anomalous_diffusion"]["multifractality"],
                "H_trend": regime_result["anomalous_diffusion"]["H_trend"],
                "vol_clustering": regime_result["anomalous_diffusion"]["vol_clustering"],
                "position_adjustment": regime_result["anomalous_diffusion"]["position_adjustment"],
                "implication": regime_result["anomalous_diffusion"]["implication"],
            },

            # Deleverage & adjustments
            "deleverage_signal": regime_result["deleverage_signal"],
            "deleverage_reason": regime_result["deleverage_reason"],
            "signal_adjustment": regime_result["signal_adjustment"],
            "stop_multiplier": regime_result["stop_multiplier"],
            "position_adjustment": regime_result["position_adjustment"],

            # Full explanation
            "physics_explanation": regime_result["explanation"],
            "n_candles": len(df),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # ── Cache result (60s TTL for regime) ───────────────────────────
        cache.set(cache_key, output, ttl=60)
        latency_ms = (time.time() - start) * 1000
        monitor.record("/regime", latency_ms, 200)
        output["_latency_ms"] = round(latency_ms, 1)
        return output

    except HTTPException:
        raise
    except Exception as e:
        latency_ms = (time.time() - start) * 1000
        monitor.record("/regime", latency_ms, 500)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------------------
# Backtest / PBO Endpoints
# -------------------------------------------------------------------------

def _build_returns(
    symbol: str,
    trades: list[dict] | None,
    returns_override: list[float] | None,
    min_trades: int,
) -> np.ndarray:
    """
    Build returns array from trade log or precomputed returns.
    Returns: 1D numpy array of tick-level or trade-level returns.
    """
    if returns_override is not None:
        arr = np.array(returns_override, dtype=float)
        if len(arr) < min_trades:
            raise HTTPException(
                status_code=400,
                detail=f"Need {min_trades} returns, got {len(arr)}"
            )
        return arr

    if trades:
        pnl = [t.get("pnl_ticks", 0.0) or 0.0 for t in trades]
        arr = np.array(pnl, dtype=float)
        if len(arr) < min_trades:
            raise HTTPException(
                status_code=400,
                detail=f"Need {min_trades} trades, got {len(trades)}"
            )
        return arr

    # Fallback: use candle returns from DB
    try:
        end = datetime.now(timezone.utc).isoformat()
        start = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        df = db.get_candles(start, end, symbol, limit=10000)
        if df.empty:
            raise HTTPException(status_code=400, detail="No candle data. Upload data first.")
        returns = np.diff(df["close"].values) / df["close"].values[:-1]
        if len(returns) < min_trades:
            raise HTTPException(
                status_code=400,
                detail=f"Need {min_trades} candles, got {len(returns)}"
            )
        return returns
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build returns: {e}")


def _get_strategy_fn(stype: str):
    """Map strategy type string to function."""
    return {
        "momentum": momentum_strategy,
        "mean_reversion": mean_reversion_strategy,
        "regime_switching": regime_switching_strategy,
    }.get(stype, momentum_strategy)


def _serialize_pbo_result(result) -> dict:
    """Convert PBOResult dataclass to dict for JSON serialization."""
    return {
        "strategy_name": result.strategy_name,
        "pbo": round(result.pbo, 6),
        "sharpe_oracle": round(result.sharpe_oracle, 4),
        "sharpe_oos": round(result.sharpe_oos, 4),
        "sharpe_avg": round(result.sharpe_avg, 4),
        "sharpe_std": round(result.sharpe_std, 4),
        "sharpe_diff": round(result.sharpe_diff, 4),
        "sharpe_sharpe": round(result.sharpe_sharpe, 4),
        "sharpe_prob": round(result.sharpe_prob, 4),
        "n_trials": result.n_trials,
        "n_passed": result.n_passed,
        "pass_rate": round(result.pass_rate, 4),
        "best_variant_idx": result.best_variant_idx,
        "best_params": result.best_params,
        "oos_return_pct": round(result.oos_return_pct, 4),
        "overfit_bands": [round(x, 4) for x in result.overfit_bands],
        "passing": result.passing,
    }


# ─── Breaking News Self-Training ──────────────────────────────────────────────

class BreakingNewsRequest(BaseModel):
    """Payload from BFF when HIGH impact breaking news arrives."""
    news: dict = Field(..., description="Breaking news item")
    trigger_type: str = Field(
        default="breaking_news_high_impact",
        description="Type of trigger: breaking_news_high_impact | scheduled_event_3star"
    )
    candle_snapshot: Optional[dict] = Field(
        default=None,
        description="Optional candle prices at time of news for reaction tracking"
    )


class NewsReactionRequest(BaseModel):
    """Log market reaction to a specific breaking news item."""
    news_id: str
    reaction_5m: Optional[float] = None
    reaction_15m: Optional[float] = None
    reaction_30m: Optional[float] = None
    reaction_60m: Optional[float] = None
    direction: Optional[str] = None  # up | down | flat
    magnitude: Optional[float] = None  # ticks


# In-memory news reaction log (persisted to DB in production)
_news_reaction_log: list[dict] = []
_NEWS_LOG_PATH = Path(__file__).parent / "data" / "news_reactions.csv"
_NEWS_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)


def _persist_news_reaction(entry: dict) -> None:
    """Append news reaction to CSV log for ML training."""
    try:
        df = pd.DataFrame([entry])
        if _NEWS_LOG_PATH.exists():
            df.to_csv(_NEWS_LOG_PATH, mode="a", header=False, index=False)
        else:
            df.to_csv(_NEWS_LOG_PATH, mode="w", header=True, index=False)
    except Exception:
        pass  # Non-fatal


def _classify_news_impact(news: dict) -> dict:
    """
    Classify news impact on MNQ/ES trading.
    Returns sentiment bias, expected market move direction, and confidence.
    """
    title = news.get("title", "").lower()
    desc = news.get("description", "").lower()
    sentiment = news.get("sentiment", "neutral")
    keywords = news.get("keywords", [])
    text = f"{title} {desc}"

    # Map news sentiment to expected market direction
    # Bullish news → typically positive for stocks (up)
    # Bearish news → typically negative for stocks (down)
    sentiment_to_direction = {
        "bullish": ("up", 0.65),
        "bearish": ("down", 0.65),
        "neutral": ("flat", 0.5),
    }
    direction, base_conf = sentiment_to_direction.get(sentiment, ("flat", 0.5))

    # Adjust confidence based on keywords
    confidence_boost = 0
    if any(k in text for k in ["fed", "rate", "inflation", "cpi"]):
        confidence_boost += 0.15  # Fed/macro moves markets most
    if any(k in text for k in ["jobs", "nfp", "employment", "gdp"]):
        confidence_boost += 0.10
    if any(k in text for k in ["earnings", "apple", "nvidia", "meta", "amazon", "google"]):
        confidence_boost += 0.08
    if any(k in text for k in ["crisis", "recession", "crash", "war"]):
        confidence_boost += 0.12

    confidence = min(0.95, base_conf + confidence_boost)

    # High impact keywords that typically cause >0.5% moves in MNQ
    high_impact = any(k in text for k in [
        "fed", "rate hike", "rate cut", "inflation", "cpi", "jobs report",
        "nonfarm", "gdp", "earnings surprise", "profit warning",
        "recession", "crisis", "trade war", "bankruptcy"
    ])

    # Expected move in ticks (MNQ: 1 tick = $0.25)
    if high_impact:
        expected_move_ticks = 20.0  # ~0.5% of ~40,000 = ~200 pts = 800 ticks; in MNQ: 20-40 ticks
        expected_move_dollars = expected_move_ticks * 0.25
    else:
        expected_move_ticks = 8.0
        expected_move_dollars = expected_move_ticks * 0.25

    return {
        "expected_direction": direction,
        "expected_move_ticks": expected_move_ticks,
        "expected_move_dollars": expected_move_dollars,
        "impact_confidence": confidence,
        "is_high_impact": high_impact,
        "news_keywords": keywords,
        "trigger_type": news.get("trigger_type", "breaking_news"),
        "ml_note": (
            f"{sentiment.upper()} news on {keywords[0] if keywords else 'general'}. "
            f"Expected {direction} move of ~{expected_move_ticks:.0f} ticks. "
            f"Confidence: {confidence:.0%}. "
            f"Record market reaction at 5/15/30/60 min to validate this signal."
        ),
    }


@app.post("/news-trigger", tags=["news"])
async def trigger_on_news(request: BreakingNewsRequest):
    """
    Called by BFF when HIGH impact breaking news arrives.

    Actions:
    1. Classify news impact (direction, magnitude, confidence)
    2. Log to news_reactions.csv for ML self-training
    3. Optionally trigger incremental model retrain (async, non-blocking)
    4. Return impact classification to BFF for UI display
    """
    news = request.news
    news_id = news.get("id", f"manual_{int(time.time())}")

    # Classify impact
    classification = _classify_news_impact(news)

    # Build log entry
    entry = {
        "news_id": news_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "title": news.get("title", ""),
        "source": news.get("source", ""),
        "sentiment": news.get("sentiment", "neutral"),
        "impact": news.get("impact", "UNKNOWN"),
        "keywords": ",".join(news.get("keywords", [])),
        "trigger_type": request.trigger_type,
        "expected_direction": classification["expected_direction"],
        "expected_move_ticks": classification["expected_move_ticks"],
        "expected_move_dollars": classification["expected_move_dollars"],
        "impact_confidence": classification["impact_confidence"],
        "reaction_5m": None,
        "reaction_15m": None,
        "reaction_30m": None,
        "reaction_60m": None,
        "actual_direction": None,
        "actual_move_ticks": None,
        "alpha_ticks": None,
        "validated": False,
    }

    # Persist to CSV
    _persist_news_reaction(entry)
    _news_reaction_log.append(entry)

    # Keep log bounded (max 1000 entries in memory)
    if len(_news_reaction_log) > 1000:
        _news_reaction_log[:] = _news_reaction_log[-1000:]

    # Fire-and-forget: trigger incremental retrain if HIGH impact
    # (non-blocking via BackgroundTasks — doesn't slow down the response)
    async def _async_retrain():
        try:
            if classification["is_high_impact"] and trainer is not None:
                await trainer.incremental_train()
                return {"retrained": True}
        except Exception as e:
            print(f"[news-trigger] Background retrain failed: {e}")
        return {"retrained": False}

    # Schedule async retrain (FastAPI handles it after response sent)
    BackgroundTasks().add_task(_async_retrain)

    return {
        "ok": True,
        "news_id": news_id,
        "classification": classification,
        "ml_note": classification["ml_note"],
        "retrain_scheduled": classification["is_high_impact"],
        "logged_at": entry["timestamp"],
        "total_news_logged": len(_news_reaction_log),
    }


@app.post("/news/reaction", tags=["news"])
async def log_news_reaction(request: NewsReactionRequest):
    """
    Log actual market reaction to a previously triggered news item.
    Called by BFF at 5/15/30/60 min after HIGH impact news.

    Updates the news_reactions.csv entry and computes actual alpha vs expected.
    """
    news_id = request.news_id

    # Find the entry
    entry_idx = None
    for i, e in enumerate(reversed(_news_reaction_log)):
        if e["news_id"] == news_id:
            entry_idx = len(_news_reaction_log) - 1 - i
            break

    if entry_idx is None:
        return {"ok": False, "error": "news_id not found in log"}

    entry = _news_reaction_log[entry_idx]

    # Update with actual reactions
    if request.reaction_5m is not None:
        entry["reaction_5m"] = request.reaction_5m
    if request.reaction_15m is not None:
        entry["reaction_15m"] = request.reaction_15m
    if request.reaction_30m is not None:
        entry["reaction_30m"] = request.reaction_30m
    if request.reaction_60m is not None:
        entry["reaction_60m"] = request.reaction_60m
    if request.direction is not None:
        entry["actual_direction"] = request.direction
    if request.magnitude is not None:
        entry["actual_move_ticks"] = request.magnitude

    # Compute alpha (actual - expected)
    actual_moves = [v for v in [entry["reaction_5m"], entry["reaction_15m"],
                                  entry["reaction_30m"], entry["reaction_60m"]] if v is not None]
    if actual_moves and entry["expected_move_ticks"]:
        # Alpha = did price move as expected? Positive = confirmed signal
        avg_actual = sum(actual_moves) / len(actual_moves)
        entry["alpha_ticks"] = avg_actual - entry["expected_move_ticks"]
        # Direction match?
        if entry["actual_direction"] == entry["expected_direction"]:
            entry["validated"] = True
        # Persist updated entry
        _persist_news_reaction(entry)

    _news_reaction_log[entry_idx] = entry

    return {
        "ok": True,
        "news_id": news_id,
        "entry": {k: v for k, v in entry.items() if k != "title"},
        "alpha_ticks": entry.get("alpha_ticks"),
        "validated": entry.get("validated", False),
    }


@app.get("/news/reactions", tags=["news"])
async def get_news_reactions(
    limit: int = Query(default=50, le=500),
    minutes: int = Query(default=0, le=10080),
):
    """
    Get recent news reaction log for ML training analysis.
    Used by Alpha Engine to learn how markets react to different news types.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes) if minutes > 0 else None

    entries = _news_reaction_log[-limit:]
    if cutoff:
        entries = [e for e in entries if datetime.fromisoformat(e["timestamp"]) > cutoff]

    # Compute aggregate statistics
    valid_entries = [e for e in entries if e.get("alpha_ticks") is not None]
    if valid_entries:
        avg_alpha = sum(e["alpha_ticks"] for e in valid_entries) / len(valid_entries)
        validated_pct = sum(1 for e in valid_entries if e.get("validated")) / len(valid_entries) * 100
    else:
        avg_alpha = 0.0
        validated_pct = 0.0

    return {
        "ok": True,
        "entries": entries,
        "total": len(entries),
        "with_reactions": len(valid_entries),
        "avg_alpha_ticks": round(avg_alpha, 4),
        "validated_pct": round(validated_pct, 1),
        "by_sentiment": {
            s: {
                "count": sum(1 for e in entries if e.get("sentiment") == s),
                "avg_alpha": round(
                    sum(e["alpha_ticks"] for e in valid_entries if e.get("sentiment") == s) /
                    max(1, sum(1 for e in valid_entries if e.get("sentiment") == s)), 4
                ),
            }
            for s in ["bullish", "bearish", "neutral"]
        },
        "log_file": str(_NEWS_LOG_PATH),
    }


@app.post("/backtest/pbo", tags=["backtest"])
async def run_pbo_backtest(request: PBOBacktestRequest):
    """
    Run Combinatorial Purged Cross-Validation (CPCV) PBO evaluation.

    Implements Marco Lopez de Prado's PBO methodology:
    1. Grid search over strategy hyperparameter variants
    2. CPCV splits with train/purge/embargo buffers
    3. Permutation test: shuffle Sharpe distribution N times
    4. PBO = fraction of shuffles where best < median

    Returns per-model votes + consensus signal.
    Pass if PBO < confidence_level (default 0.05).
    """
    try:
        returns = _build_returns(request.symbol, None, None, request.min_trades)

        # Build param grid
        param_grid = {
            "lookback": request.lookback,
            "threshold": request.threshold,
        }

        config = PBOConfig(
            n_trials=request.n_trials,
            n_permutations=request.n_permutations,
            n_train_splits=request.n_train_splits,
            purge_pct=request.purge_pct,
            embargo_pct=request.embargo_pct,
            confidence_level=request.confidence_level,
            random_state=42,
        )

        strategy_fn = _get_strategy_fn(request.strategy_type)

        result = evaluate_pbo(
            strategy_name=request.strategy_name,
            returns=returns,
            strategy_fn=strategy_fn,
            param_grid=param_grid,
            config=config,
            verbose=True,
        )

        return {
            "ok": True,
            "mode": "cpcv_pbo",
            "strategy_name": request.strategy_name,
            "strategy_type": request.strategy_type,
            "returns_count": int(len(returns)),
            "param_grid": param_grid,
            **_serialize_pbo_result(result),
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/backtest/mc", tags=["backtest"])
async def run_mc_backtest(request: MCBacktestRequest):
    """
    Run Monte Carlo PBO evaluation.

    Generates synthetic return paths via block bootstrap (regime-aware)
    and evaluates PBO across N simulated market paths.

    Pass if PBO < 0.05.
    """
    try:
        returns = _build_returns(request.symbol, None, None, request.min_trades)

        param_grid = {
            "lookback": [5, 10, 20, 30],
            "threshold": [0.005, 0.01, 0.015],
        }

        config = PBOConfig(
            n_trials=request.n_trials,
            n_permutations=50,
            random_state=42,
        )

        strategy_fn = _get_strategy_fn(request.strategy_type)

        result = monte_carlo_pbo(
            strategy_name=request.strategy_name,
            returns=returns,
            strategy_fn=strategy_fn,
            param_grid=param_grid,
            n_simulations=request.n_simulations,
            pbo_config=config,
            random_state=42,
            verbose=True,
        )

        return {
            "ok": True,
            "mode": "monte_carlo_pbo",
            "strategy_name": request.strategy_name,
            "strategy_type": request.strategy_type,
            "returns_count": int(len(returns)),
            "n_simulations": result["n_simulations"],
            "n_variants": result["n_variants"],
            "pbo": round(result["pbo"], 6),
            "passing": result["passing"],
            "aggregate": {k: round(v, 4) if isinstance(v, float) else v
                          for k, v in result["aggregate"].items()},
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/backtest/full", tags=["backtest"])
async def run_full_pbo(request: FullPBOBacktestRequest):
    """
    Run ALL 3 PBO evaluation modes and return unified result.

    Modes:
      1. CPCV PBO — Combinatorial Purged Cross-Validation
      2. Walk-Forward PBO — Expanding window with OOS validation
      3. Monte Carlo PBO — Block bootstrap synthetic paths

    Strategy PASSES overall if ≥ 2/3 modes pass (PBO < 0.05).

    This is the primary backtest endpoint for model self-validation.
    Each ML model should call this after training to verify it passes PBO.
    """
    try:
        returns = _build_returns(request.symbol, None, None, request.min_trades)

        param_grid = {
            "lookback": request.lookback,
            "threshold": request.threshold,
        }

        strategy_fn = _get_strategy_fn(request.strategy_type)

        results = run_full_pbo_evaluation(
            strategy_name=request.strategy_name,
            returns=returns,
            strategy_fn=strategy_fn,
            param_grid=param_grid,
            n_trials=request.n_trials,
            verbose=True,
        )

        # Serialize each mode's result
        output = {
            "ok": True,
            "mode": "full_pbo",
            "strategy_name": request.strategy_name,
            "strategy_type": request.strategy_type,
            "returns_count": int(len(returns)),
            "n_trials": request.n_trials,
            "n_simulations": request.n_simulations,
            "overall_passing": results["overall_passing"],
            "modes_passed": results["modes_passed"],
            "total_modes": results["total_modes"],
            "passing_modes": results["passing_modes"],
        }

        # CPCV results
        if results.get("cpcv"):
            cpcv = results["cpcv"]
            output["cpcv"] = {
                "pbo": round(cpcv["pbo"], 6),
                "sharpe_oos": round(cpcv["sharpe_oos"], 4),
                "sharpe_avg": round(cpcv["sharpe_avg"], 4),
                "sharpe_sharpe": round(cpcv["sharpe_sharpe"], 4),
                "passing": cpcv["passing"],
                "best_params": cpcv.get("best_params", {}),
            }

        # Walk-forward results
        if results.get("walk_forward"):
            wf = results["walk_forward"]
            output["walk_forward"] = {
                "n_windows": wf.get("n_windows", 0),
                "avg_oos_sharpe": round(wf["avg_oos_sharpe"], 4),
                "sharpe_consistency": round(wf["sharpe_consistency"], 4),
                "avg_pbo": round(wf["avg_pbo"], 6),
                "pbo_pass_rate": round(wf["pbo_pass_rate"], 4),
                "passing": wf["passing"],
            }

        # Monte Carlo results
        if results.get("monte_carlo"):
            mc = results["monte_carlo"]
            output["monte_carlo"] = {
                "pbo": round(mc["pbo"], 6),
                "avg_sharpe": round(mc["avg_sharpe"], 4),
                "sharpe_sharpe": round(mc["sharpe_sharpe"], 4),
                "sharpe_consistency": round(mc["sharpe_consistency"], 4),
                "passing": mc["passing"],
            }

        return output

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/backtest/autotune", tags=["backtest"])
async def autotune_pbo(request: AutotuneRequest):
    """
    Auto-tune a strategy's hyperparameters to pass PBO testing.

    Algorithm:
      1. Run PBO on initial grid
      2. If PBO > target: narrow grid toward best params
      3. Repeat up to max_refinements
      4. Return the params that minimize PBO

    Each ML model should call this as part of its training pipeline.
    The auto-tuned params are then used in the model for live trading.
    """
    try:
        returns = _build_returns(request.symbol, None, None, request.min_trades)

        strategy_fn = _get_strategy_fn(request.strategy_type)

        config = PBOConfig(
            n_trials=max(20, request.n_trials // 2),
            n_permutations=100,
            n_train_splits=5,
            purge_pct=0.1,
            embargo_pct=0.1,
            confidence_level=request.target_pbo,
            random_state=42,
        )

        best_result, best_params = auto_tune_to_pass_pbo(
            strategy_name=request.strategy_name,
            returns=returns,
            strategy_fn=strategy_fn,
            initial_param_grid=request.initial_grid,
            pbo_config=config,
            target_pbo=request.target_pbo,
            max_refinements=request.max_refinements,
            verbose=True,
        )

        return {
            "ok": True,
            "mode": "autotune_pbo",
            "strategy_name": request.strategy_name,
            "strategy_type": request.strategy_type,
            "returns_count": int(len(returns)),
            "target_pbo": request.target_pbo,
            "max_refinements": request.max_refinements,
            "overall_passing": best_result.passing if best_result else False,
            "final_pbo": round(best_result.pbo, 6) if best_result else None,
            "best_params": best_params,
            "best_sharpe_oos": round(best_result.sharpe_oos, 4) if best_result else None,
            "best_sharpe_avg": round(best_result.sharpe_avg, 4) if best_result else None,
            "sharpe_sharpe": round(best_result.sharpe_sharpe, 4) if best_result else None,
            "passing": best_result.passing if best_result else False,
            "recommendation": (
                f"Use params {best_params} for {request.strategy_name}. "
                f"PBO={round(best_result.pbo, 4) if best_result else 'N/A'} "
                f"({'PASS' if best_result and best_result.passing else 'FAIL'} at "
                f"target {request.target_pbo:.2%})"
            ) if best_result else "Could not find passing parameters",
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/backtest/returns", tags=["backtest"])
async def compute_returns_for_backtest(request: BacktestTradesRequest):
    """
    Convert uploaded trades into returns array for backtesting.
    Returns the PnL sequence that can be passed to /backtest/full.
    """
    try:
        if not request.trades:
            raise HTTPException(status_code=400, detail="No trades provided")

        if request.returns_override:
            arr = np.array(request.returns_override, dtype=float)
        else:
            pnl = [t.get("pnl_ticks", 0.0) or 0.0 for t in request.trades]
            arr = np.array(pnl, dtype=float)

        if len(arr) < 50:
            raise HTTPException(
                status_code=400,
                detail=f"Need at least 50 trades/returns, got {len(arr)}"
            )

        return {
            "ok": True,
            "count": len(arr),
            "mean_return": round(float(np.mean(arr)), 4),
            "std_return": round(float(np.std(arr)), 4),
            "sharpe": round(sharpe_ratio(arr), 4),
            "positive_count": int(np.sum(arr > 0)),
            "negative_count": int(np.sum(arr < 0)),
            "total_return": round(float(np.sum(arr)), 4),
            "max_drawdown": round(float(np.min(np.maximum.accumulate(arr) - arr)), 4),
            "returns_preview": arr[:20].tolist(),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------------------
# Model status
# -------------------------------------------------------------------------

@app.get("/model-status")
async def model_status():
    """Get status of all trained models."""
    try:
        models = store.list_all_models()
        status = {}
        for name in models:
            try:
                meta = store.load_meta(name, "latest")
                status[name] = {
                    "version": meta.get("version"),
                    "trained_at": meta.get("saved_at"),
                    "metrics": meta.get("metrics", {}),
                    "feature_count": len(meta.get("feature_cols", [])),
                    "data_trades": meta.get("training_samples", 0),
                }
            except Exception:
                status[name] = {"error": "Could not load"}

        return {
            "models": status,
            "predictor_ready": predictor.is_ready if predictor else False,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------------------
# Data upload
# -------------------------------------------------------------------------

@app.post("/candles/upload")
async def upload_candles(request: UploadCandlesRequest):
    """Bulk upload candles from NinjaTrader CSV."""
    try:
        if not request.candles:
            raise HTTPException(status_code=400, detail="No candles provided")

        rows = []
        for c in request.candles:
            row = c.model_dump()
            rows.append(row)

        df = pd.DataFrame(rows)
        df["timestamp"] = pd.to_datetime(df["timestamp"])

        inserted = db.insert_candles(df)

        return {
            "status": "success",
            "candles_inserted": inserted,
            "total_candles": db.get_candle_count(request.symbol),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/trades/upload")
async def upload_trades(request: UploadTradesRequest):
    """Bulk upload trade journal entries."""
    try:
        if not request.trades:
            raise HTTPException(status_code=400, detail="No trades provided")

        rows = []
        for t in request.trades:
            row = t.model_dump()
            rows.append(row)

        for row in rows:
            db.upsert_trade(row)

        total = db.get_trade_count(request.symbol)

        return {
            "status": "success",
            "trades_uploaded": len(request.trades),
            "total_trades": total,
            "min_for_training": 100,
            "ready": total >= 100,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/candles/parse-csv")
async def parse_csv(file_content: str = Query(...)):
    """
    Parse raw CSV content (NinjaTrader format).
    Expected columns: Date, Time, Open, High, Low, Close, Volume
    Returns parsed candles without persisting.
    """
    import io
    try:
        # Parse CSV
        lines = file_content.strip().split("\n")
        if not lines:
            raise HTTPException(status_code=400, detail="Empty CSV content")

        # Detect header
        header = lines[0].split(",")
        header = [h.strip().strip('"') for h in header]
        header = [h.lower() for h in header]

        data_lines = lines[1:]

        # Detect format
        if "date" in header and "time" in header:
            # NinjaTrader format: Date, Time, Open, High, Low, Close, Volume
            dates, times, opens, highs, lows, closes, volumes = [], [], [], [], [], [], []
            for line in data_lines:
                parts = line.split(",")
                if len(parts) >= 7:
                    dates.append(parts[0].strip().strip('"'))
                    times.append(parts[1].strip().strip('"'))
                    opens.append(float(parts[2]))
                    highs.append(float(parts[3]))
                    lows.append(float(parts[4]))
                    closes.append(float(parts[5]))
                    volumes.append(int(parts[6]))

            df = pd.DataFrame({
                "timestamp": pd.to_datetime([f"{d} {t}" for d, t in zip(dates, times)]),
                "open": opens,
                "high": highs,
                "low": lows,
                "close": closes,
                "volume": volumes,
            })
        else:
            # Generic OHLCV
            reader = pd.read_csv(io.StringIO(file_content))
            reader.columns = [c.lower().strip() for c in reader.columns]
            df = reader.copy()

            # Try to parse timestamp
            ts_cols = [c for c in df.columns if "date" in c or "time" in c or "timestamp" in c]
            if ts_cols:
                df["timestamp"] = pd.to_datetime(df[ts_cols[0]])
            elif "open" in df.columns:
                df = df.rename(columns={df.columns[0]: "timestamp"})

            for col in ["open", "high", "low", "close", "volume"]:
                if col not in df.columns:
                    raise HTTPException(status_code=400, detail=f"Missing required column: {col}")

            df = df[["timestamp", "open", "high", "low", "close", "volume"]]

        # Engineer features
        from features.feature_pipeline import assign_session_ids
        df = assign_session_ids(df)

        inserted = db.insert_candles(df)

        return {
            "status": "success",
            "rows_parsed": len(df),
            "candles_inserted": inserted,
            "date_range": {
                "start": str(df["timestamp"].min()),
                "end": str(df["timestamp"].max()),
            },
            "session_breakdown": {
                "pre": int((df["session_id"] == 0).sum()),
                "main": int((df["session_id"] == 1).sum()),
                "post": int((df["session_id"] == 2).sum()),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------------------
# Data query
# -------------------------------------------------------------------------

@app.get("/candles")
async def get_candles(
    symbol: str = "MNQ",
    start: str = "",
    end: str = "",
    session_id: int | None = None,
    limit: int = 1000,
):
    """Query candle data."""
    try:
        if start and end:
            df = db.get_candles(start, end, symbol, session_id, limit)
        else:
            df = db.get_latest_candles(symbol, min(limit, 5000))
            if session_id is not None:
                df = df[df["session_id"] == session_id]

        return {
            "count": len(df),
            "candles": df.to_dict(orient="records"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/trades")
async def get_trades(symbol: str = "MNQ", limit: int = 500):
    """Query trade log."""
    try:
        df = db.get_trade_log(limit, symbol)
        return {
            "count": len(df),
            "trades": df.to_dict(orient="records"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stats")
async def get_stats():
    """Get database statistics."""
    try:
        return db.get_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------------------
# PSO Alpha Discovery Endpoint
# -------------------------------------------------------------------------

class PSORequest(BaseModel):
    symbol: str = Field(default="MNQ")
    candles: list[dict] = Field(default_factory=list)
    n_particles: int = Field(default=40, ge=10, le=200)
    max_iterations: int = Field(default=150, ge=10, le=500)
    regime: str = Field(default="ALL")  # ALL, COMPRESSION, NORMAL, EXPANSION


class PSOResult(BaseModel):
    regimes_found: int
    best_regime: str
    best_regime_alpha: float
    total_alpha: float
    regimes: dict
    timestamp: str


@app.post("/pso/discover")
async def pso_alpha_discovery(request: PSORequest):
    """
    Run Particle Swarm Optimization for alpha discovery.
    Uses historical candle data to find optimal parameters:
    - LightGBM/XGBoost hyperparameters
    - Entry/exit thresholds
    - Feature weights
    - Session-specific R:R ratios
    - Position sizing parameters

    Returns optimal parameters per market regime (COMPRESSION/NORMAL/EXPANSION).
    """
    try:
        if request.candles:
            df = pd.DataFrame([c.model_dump() for c in request.candles])
            df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        else:
            df = db.get_latest_candles(request.symbol, n=2000)

        if df.empty:
            raise HTTPException(
                status_code=400,
                detail="No candles available. Upload historical data first."
            )

        trade_df = db.get_trade_log(limit=5000)
        feat_df = engineer_features(df, trade_df, None, {}, {})

        if request.regime != "ALL":
            # Run single-regime PSO
            niche_config = NichingPSO.REGIME_NICHES.get(request.regime.upper())
            if not niche_config:
                raise HTTPException(status_code=400, detail=f"Unknown regime: {request.regime}")
            pso = PSOOptimizer(n_particles=request.n_particles, max_iterations=request.max_iterations)
            result = pso.optimize(df, trade_df, feat_df, regime=request.regime.upper())
            return {
                "regimes_found": 1,
                "best_regime": request.regime.upper(),
                "best_regime_alpha": float(result.alpha_contribution),
                "total_alpha": float(result.alpha_contribution),
                "regimes": {
                    request.regime.upper(): {
                        "alpha_ticks": round(result.alpha_contribution, 3),
                        "expectancy": round(result.best_metrics.expectancy, 3),
                        "win_rate": round(result.best_metrics.win_rate, 3),
                        "sharpe": round(result.best_metrics.sharpe, 3),
                        "max_drawdown": round(result.best_metrics.max_drawdown, 3),
                        "profit_factor": round(result.best_metrics.profit_factor, 3),
                        "trades_analyzed": result.best_metrics.trades_count,
                        "convergence_iters": result.iterations_run,
                        "best_params": result.params,
                        "convergence_history": [round(x, 4) for x in result.convergence_history[-20:]],
                    }
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        else:
            # Run full niching PSO across all regimes
            result = run_alpha_discovery(
                df,
                trade_df,
                n_particles=request.n_particles,
                max_iterations=request.max_iterations,
            )
            return result

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------------------
# Mamba SSM Sequence Model Endpoint
# -------------------------------------------------------------------------

class MambaRequest(BaseModel):
    symbol: str = Field(default="MNQ")
    candles: list[dict] = Field(default_factory=list)
    model_size: str = Field(default="mamba-790m")
    task: str = Field(default="full")  # direction, regime, pattern, full


@app.post("/mamba/predict")
async def mamba_predict(request: MambaRequest):
    """
    Run Mamba SSM on a candle sequence for:
    - Direction prediction (LONG/SHORT/NEUTRAL)
    - Regime inference (COMPRESSION/NORMAL/EXPANSION)
    - Alpha pattern detection (BREAKOUT/MEAN_REVERT/MOMENTUM/FADE_EXTENSION)
    - Expected move magnitude

    Mamba is a State Space Model — O(n) time, no quadratic attention.
    Available models: mamba-130m, mamba-370m, mamba-790m, mamba-1.4b, mamba-2.8b
    Also Mamba-2 hybrid: mamba2-130m, mamba2-370m, mamba2-2.7b

    Install: pip install torch transformers accelerate
    """
    try:
        if not MAMBA_AVAILABLE:
            return {
                "ok": False,
                "available": False,
                "error": "Mamba not available. Install: pip install torch transformers",
                "model_sizes": list(MODEL_SIZES.keys()),
                "recommendation": "For CPU: use mamba-130m or mamba-370m",
            }

        if request.model_size not in MODEL_SIZES:
            return {
                "ok": False,
                "error": f"Unknown model: {request.model_size}. Available: {list(MODEL_SIZES.keys())}",
            }

        if request.candles:
            df_candles = request.candles
        else:
            df = db.get_latest_candles(request.symbol, n=200)
            df_candles = df.to_dict("records")

        if not df_candles:
            raise HTTPException(status_code=400, detail="No candles available")

        result = get_mamba_prediction(df_candles, request.model_size, request.task)
        result["model_info"] = MODEL_SIZES.get(request.model_size, {})
        return result

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/mamba/status")
async def mamba_status():
    """Check Mamba availability and available models."""
    return {
        "available": MAMBA_AVAILABLE,
        "models": MODEL_SIZES,
        "default_model": "mamba-790m",
        "recommendation": (
            "GPU: mamba-2.8b (best quality) or mamba2-2.7b (hybrid SSM+attention) "
            "| CPU: mamba-370m (fast) or mamba-790m (better quality)"
        ),
    }


@app.post("/mamba/finetune")
async def mamba_finetune(request: MambaRequest):
    """
    Fine-tune Mamba on trading data with EWC (Elastic Weight Consolidation).
    EWC prevents catastrophic forgetting — the model learns new patterns
    WITHOUT unlearning old ones.

    This is called by POST /train or POST /news-trigger for continual learning.
    """
    try:
        if not MAMBA_AVAILABLE:
            raise HTTPException(status_code=503, detail="Mamba not available")

        if request.candles:
            df_candles = request.candles
        else:
            df = db.get_latest_candles(request.symbol, n=2000)
            df_candles = df.to_dict("records")

        if len(df_candles) < 50:
            raise HTTPException(status_code=400, detail="Need at least 50 candles")

        # Generate labels: 1 if next candle close > current, else 0
        labels = []
        for i in range(len(df_candles) - 1):
            curr = df_candles[i].get("close", 0)
            nxt = df_candles[i + 1].get("close", 0)
            labels.append(1 if nxt > curr else 0)

        model = MambaTradingModel.get_instance(request.model_size)
        if not model._loaded:
            model.load()

        model.fine_tune_with_continual_learning(
            candles=df_candles,
            labels=labels,
            epochs=3,
            ewc_lambda=100,
        )

        return {
            "ok": True,
            "message": "Mamba fine-tuned with EWC protection",
            "candles_used": len(df_candles),
            "labels_used": len(labels),
            "ewc_lambda": 100,
            "continual_learning": True,
            "catastrophic_forgetting": "PREVENTED via Elastic Weight Consolidation",
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------------------
# Error handlers
# -------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "type": type(exc).__name__},
    )


# -------------------------------------------------------------------------
# Entry point
# -------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=False)


# -------------------------------------------------------------------------
# Feedback Loop Endpoints
# -------------------------------------------------------------------------

class FeedbackSignalRequest(BaseModel):
    """Log a consensus signal for outcome tracking."""
    signal: str = Field(..., description="LONG / SHORT / NEUTRAL")
    confidence: float = Field(..., ge=0.0, le=1.0)
    votes: dict = Field(default_factory=dict)
    consensus: dict = Field(default_factory=dict)
    regime: str | None = None
    regime_confidence: float | None = None
    market_regime: str | None = None
    session_phase: str | None = None
    symbol: str = Field(default="MNQ")
    session_id: int = Field(default=1)


class FeedbackRetrainRequest(BaseModel):
    """Trigger a retrain pipeline run."""
    trigger: str = Field(
        default="manual",
        description="manual | drift | scheduled",
    )
    symbol: str = Field(default="MNQ")
    training_mode: str = Field(
        default="incremental",
        description="full or incremental",
    )
    auto_retrain_on_drift: bool = Field(default=True)


@app.post("/feedback/signal")
async def log_signal(request: FeedbackSignalRequest):
    """
    Log a consensus signal for later outcome matching.

    Call this after every /predict or /consensus call to record
    the signal + market context for the feedback loop.

    Returns signal_id — save this to link to trade outcomes later.
    """
    if feedback_logger is None:
        raise HTTPException(status_code=503, detail="Feedback logger not initialized")

    try:
        signal_id = feedback_logger.log_signal(
            signal=request.signal,
            confidence=request.confidence,
            votes=request.votes,
            consensus=request.consensus,
            regime=request.regime,
            regime_confidence=request.regime_confidence,
            market_regime=request.market_regime,
            session_phase=request.session_phase,
            symbol=request.symbol,
            session_id=request.session_id,
        )
        return {"ok": True, "signal_id": signal_id}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feedback/record-outcome")
async def record_outcome(
    signal_id: int = Query(..., description="Signal ID from the consensus log"),
    trade_id: int = Query(..., description="Trade ID from execution"),
    result: str = Query(..., description="win / loss / be"),
    correct: bool = Query(..., description="Whether the signal was correct"),
    pnl_ticks: float | None = Query(None, description="PnL in ticks"),
    pnl_dollars: float | None = Query(None, description="PnL in dollars"),
    actual_move_ticks: float | None = Query(None, description="Actual price move in ticks"),
    expected_move_ticks: float | None = Query(None, description="Expected price move in ticks"),
):
    """
    Record the outcome of a matched trade for a previously logged signal.

    This closes the feedback loop: signal → trade closed → outcome recorded.
    Also feeds the ConceptDriftDetector for rolling accuracy monitoring.
    """
    if feedback_logger is None or trade_processor is None:
        raise HTTPException(status_code=503, detail="Feedback components not initialized")

    try:
        feedback_logger.record_outcome(
            signal_id=signal_id,
            trade_id=trade_id,
            result=result,
            correct=correct,
            pnl_ticks=pnl_ticks,
            pnl_dollars=pnl_dollars,
            actual_move_ticks=actual_move_ticks,
            expected_move_ticks=expected_move_ticks,
        )

        # Feed concept drift detector
        if drift_monitor is not None:
            # Get signal confidence for this signal_id
            with db.conn() as c:
                row = c.execute(
                    "SELECT signal, confidence FROM signal_log WHERE id = ?",
                    (signal_id,),
                ).fetchone()
            if row:
                correct_val = 1 if correct else 0
                drift_monitor.concept_drift.record_prediction(
                    correct=bool(correct_val),
                    confidence=float(row[1]) if row[1] else 0.5,
                )

        return {"ok": True, "signal_id": signal_id, "trade_id": trade_id, "correct": correct}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/feedback/signals")
async def get_signals(
    limit: int = Query(default=100, ge=1, le=1000),
    symbol: str = Query(default="MNQ"),
):
    """
    Get recent consensus signal history with optional outcome data.
    """
    if feedback_logger is None:
        raise HTTPException(status_code=503, detail="Feedback logger not initialized")

    try:
        df = feedback_logger.get_signal_history(limit=limit)
        stats = feedback_logger.get_feedback_stats()
        return {
            "signals": df.to_dict(orient="records"),
            "stats": stats,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/feedback/stats")
async def get_feedback_stats(symbol: str = Query(default="MNQ")):
    """
    Get feedback loop statistics: signal count, win rate, unmatched signals.
    """
    if feedback_logger is None:
        raise HTTPException(status_code=503, detail="Feedback logger not initialized")

    try:
        stats = feedback_logger.get_feedback_stats(symbol=symbol)
        concept = drift_monitor.concept_drift.detect() if drift_monitor else {}
        return {
            "signal_stats": stats,
            "concept_drift": concept,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feedback/process-trades")
async def process_trades(symbol: str = Query(default="MNQ")):
    """
    Process all closed trades and match them to consensus signals.

    Finds unmatched closed trades, links them to the nearest prior signal,
    computes correct/incorrect, and feeds the ConceptDriftDetector.

    Called by the Airflow DAG every week.
    """
    if trade_processor is None or drift_monitor is None:
        raise HTTPException(status_code=503, detail="Trade processor not initialized")

    try:
        result = trade_processor.process_all(
            drift_monitor=drift_monitor,
            symbol=symbol,
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feedback/retrain")
async def trigger_retrain(
    request: FeedbackRetrainRequest,
):
    """
    Trigger the closed-loop retrain pipeline.

    Triggers:
      - manual: User-initiated retrain (always runs if rate limit allows)
      - drift: Auto-triggered on drift detection (requires confirmed drift)
      - scheduled: Airflow weekly trigger (always runs if rate limit allows)

    Safety guards:
      - Max 2 retrains per day
      - Min 20 new trades since last training
      - Drift must be confirmed for auto-retrain
    """
    if retrain_pipeline is None:
        raise HTTPException(status_code=503, detail="Retrain pipeline not initialized")

    try:
        # Override training mode from request
        original_mode = retrain_pipeline.config.training_mode
        retrain_pipeline.config.training_mode = request.training_mode
        retrain_pipeline.config.symbol = request.symbol
        retrain_pipeline.config.auto_retrain_on_drift = request.auto_retrain_on_drift

        report = retrain_pipeline.run(
            trigger=request.trigger,
            verbose=True,
        )

        # Restore
        retrain_pipeline.config.training_mode = original_mode

        return {
            "triggered": report.triggered,
            "reason": report.reason,
            "should_retrain": report.drift_status.get("should_retrain", False),
            "overall_drift_status": report.drift_status.get("overall_status", "unknown"),
            "training_result": (
                report.training_result.get("models", {})
                if report.training_result else None
            ),
            "error": report.error,
            "duration_sec": round(report.duration_sec, 2),
            "timestamp": report.timestamp,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/feedback/retrain-status")
async def get_retrain_status():
    """
    Get current retrain pipeline status: last training, drift status, feedback stats.
    """
    if db is None or drift_monitor is None or feedback_logger is None:
        raise HTTPException(status_code=503, detail="Components not initialized")

    try:
        last_train = db.get_last_training("direction_ensemble")
        stats = feedback_logger.get_feedback_stats()
        concept = drift_monitor.concept_drift.detect()

        return {
            "last_training": last_train,
            "feedback_stats": stats,
            "concept_drift": concept,
            "pipeline_ready": retrain_pipeline is not None,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------------------
# Triton / vLLM Inference Serving
# -------------------------------------------------------------------------

class TritonInferenceRequest(BaseModel):
    features: list[list[float]] | list[dict]
    model_name: str = Field(default="lightgbm_direction")
    symbol: str = Field(default="MNQ")


@app.post("/inference/predict")
async def triton_predict(request: TritonInferenceRequest):
    """
    Run inference via Triton (GPU) or local ONNX Runtime fallback.

    Priority: Triton gRPC → ONNX Runtime local → sklearn joblib fallback.

    Target: < 50ms p99 latency.

    Request body:
      features: list of feature vectors (flat list[float] or dict with named features)
      model_name: Triton model name (default: lightgbm_direction)
    """
    t0 = time.time()

    client = triton_client or get_inference_client()
    result = client.predict(features=request.features, model_name=request.model_name)

    result["latency_ms"] = round((time.time() - t0) * 1000, 2)
    result["symbol"] = request.symbol

    return result


@app.get("/inference/status")
async def triton_status():
    """
    Get Triton server status and available models.
    """
    client = triton_client or get_inference_client()
    status = client.get_server_status()
    onnx_models = list_onnx_models()

    return {
        "triton": status,
        "onnx_exported": onnx_models,
        "onnx_dir": str(ONNX_DIR),
        "triton_repo": str(TRITON_REPO),
    }


@app.post("/inference/export")
async def export_onnx(model_name: str | None = None):
    """
    Export trained models to ONNX format for Triton serving.

    POST /inference/export?model_name=lightgbm_direction
    POST /inference/export   (exports all models)
    """
    try:
        if model_name:
            path = export_model(model_name)
            return {"ok": True, "exported": str(path)}
        else:
            paths = export_all_models()
            return {"ok": True, "exported": [str(p) for p in paths]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/inference/setup")
async def triton_setup():
    """
    Set up Triton model repository from exported ONNX models.
    Copies ONNX files into the Triton model directory structure
    and generates config.pbtxt files.
    """
    from inference.triton_server import setup_model_repository
    setup_model_repository()
    return {
        "ok": True,
        "message": "Triton model repository ready",
        "repo": str(TRITON_REPO),
    }


@app.post("/inference/benchmark")
async def triton_benchmark(n_samples: int = 1000, batch_size: int = 32):
    """
    Benchmark inference latency.

    Returns p50, p95, p99 latency in ms.
    """
    client = triton_client or get_inference_client()
    result = client.benchmark(n_samples=n_samples, batch_size=batch_size)
    return result


@app.post("/mamba/vllm")
async def mamba_vllm_predict(candles: list[dict]):
    """
    Run Mamba via vLLM for sequence feature extraction.

    Converts candle sequence to natural language narrative,
    sends to vLLM server, parses structured features.
    """
    from inference.vllm_server import call_vllm, extract_sequence_features

    # Build narrative from candles
    if not candles:
        return {"error": "No candles provided"}

    recent = candles[-20:] if len(candles) >= 20 else candles
    last = recent[-1]

    narrative_parts = []
    if len(recent) >= 2:
        prev_close = recent[-2].get("close", 0)
        curr_close = last.get("close", 0)
        change = curr_close - prev_close
        direction = "up" if change > 0 else "down"
        narrative_parts.append(f"Candle closed {direction} {abs(change):.1f} ticks")

    # Add AMD phase if available
    if "amd_phase" in last:
        narrative_parts.append(f"AMD phase: {last['amd_phase']}")

    # Add regime
    if "vr_regime" in last:
        narrative_parts.append(f"Volatility regime: {last['vr_regime']}")

    narrative = ". ".join(narrative_parts) if narrative_parts else "Market in transition."

    t0 = time.time()
    result = call_vllm(narrative)
    result["latency_ms"] = round((time.time() - t0) * 1000, 2)
    result["narrative"] = narrative

    return result
