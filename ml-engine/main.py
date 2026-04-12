"""
ML Engine — FastAPI Application (Orchestration Only)
All business logic moved to split modules (Rule #3 hard limit: Python ≤600 lines)
Port 8001 — handles training, prediction, consensus, health
"""
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Add ml-engine to path
sys.path.insert(0, str(Path(__file__).parent))

import config
from _lifespan import lifespan
from _middleware import configure_middleware

# Import route modules
from _routes_workflow import (
    train_endpoint,
    train_sync_endpoint,
    predict_endpoint,
    regime_endpoint,
)
from _routes_news import (
    feedback_signal_news_trigger,
    news_reaction_endpoint,
    get_news_reactions,
)
from _routes_features import (
    features_online,
    features_info,
    feature_lineage,
    feature_lineage_single,
    materialization_history,
    trigger_warmup,
    mlflow_status,
    mlflow_experiments,
    mlflow_models,
    mlflow_promote,
    drift_status,
    drift_detect,
    drift_record_prediction,
    drift_set_baseline,
    drift_thresholds,
    monitoring_status,
    monitoring_config,
)
from _routes_backtest import (
    run_pbo_backtest,
    run_mc_backtest,
    run_full_pbo,
    autotune_pbo,
    compute_returns,
)
from _routes_data import (
    model_status,
    upload_candles,
    upload_trades,
    parse_csv_candles,
    get_candles,
    get_trades,
    get_stats,
)
from _routes_pso import (
    pso_discover,
    mamba_predict,
    mamba_status,
    mamba_finetune,
    mamba_vllm_predict,
    inference_predict,
    inference_status,
    inference_export,
    inference_setup,
    inference_benchmark,
    log_signal,
    record_outcome,
    get_signals,
    get_feedback_stats,
    process_trades,
    prepare_training_batch,
    trigger_retrain,
    get_retrain_status,
    global_exception_handler,
)
from _health import (
    live,
    ready,
    health,
    metrics_endpoint,
    get_sla_report,
    get_cache_stats,
)
from _infrastructure import get_cache, get_sla_monitor

# Pydantic models
from schemas import (
    TrainRequest, PredictRequest, RegimeRequest,
    PBOBacktestRequest, MCBacktestRequest, FullPBOBacktestRequest,
    AutotuneRequest, BacktestTradesRequest,
    DriftDetectRequest, RecordPredictionRequest,
    BreakingNewsRequest, NewsReactionRequest,
    MambaRequest, FeedbackSignalRequest, FeedbackRetrainRequest,
    TritonInferenceRequest,
    UploadCandlesRequest, UploadTradesRequest,
    CacheInvalidateRequest,
)

# Import request models needed for PSO
from schemas import PSORequest

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query, Request as FastAPIRequest
from fastapi.responses import JSONResponse


# ── App factory ────────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="TradersApp ML Engine",
        version="1.0.0",
        lifespan=lifespan,
    )
    configure_middleware(app)
    _register_routes(app)
    return app


def _register_routes(app: FastAPI) -> None:
    """Register all route handlers on the FastAPI app."""

    # ── Health & Observability ──────────────────────────────────────────────
    app.add_api_route("/live", live, methods=["GET"], include_in_schema=False)
    app.add_api_route("/ready", ready, methods=["GET"], include_in_schema=False)
    app.add_api_route("/health", health, methods=["GET"], tags=["health"])
    app.add_api_route("/metrics", metrics_endpoint, methods=["GET"], include_in_schema=False)
    app.add_api_route("/sla", sla_report, methods=["GET"], tags=["sla"])
    app.add_api_route("/cache/stats", get_cache_stats, methods=["GET"], tags=["cache"])
    app.add_api_route("/cache/invalidate", _cache_invalidate, methods=["POST"], tags=["cache"])

    # ── Feature Store ────────────────────────────────────────────────────────
    app.add_api_route("/features/online", features_online, methods=["GET"], tags=["features"])
    app.add_api_route("/features/info", features_info, methods=["GET"], tags=["features"])
    app.add_api_route("/features/lineage", feature_lineage, methods=["GET"], tags=["features"])
    app.add_api_route("/features/lineage/{feature_name}", feature_lineage_single, methods=["GET"], tags=["features"])
    app.add_api_route("/features/materialization-history", materialization_history, methods=["GET"], tags=["features"])
    app.add_api_route("/features/warmup", trigger_warmup, methods=["POST"], tags=["features"])

    # ── MLflow ────────────────────────────────────────────────────────────────
    app.add_api_route("/mlflow/status", mlflow_status, methods=["GET"], tags=["mlflow"])
    app.add_api_route("/mlflow/experiments", mlflow_experiments, methods=["GET"], tags=["mlflow"])
    app.add_api_route("/mlflow/models", mlflow_models, methods=["GET"], tags=["mlflow"])
    app.add_api_route("/mlflow/promote", mlflow_promote, methods=["POST"], tags=["mlflow"])

    # ── Drift Detection ──────────────────────────────────────────────────────
    app.add_api_route("/drift/status", drift_status, methods=["GET"], tags=["drift"])
    app.add_api_route("/drift/detect", drift_detect, methods=["POST"], tags=["drift"])
    app.add_api_route("/drift/record-prediction", drift_record_prediction, methods=["POST"], tags=["drift"])
    app.add_api_route("/drift/baseline", drift_set_baseline, methods=["POST"], tags=["drift"])
    app.add_api_route("/drift/thresholds", drift_thresholds, methods=["GET"], tags=["drift"])

    # ── Monitoring ───────────────────────────────────────────────────────────
    app.add_api_route("/monitoring/status", monitoring_status, methods=["GET"], tags=["monitoring"])
    app.add_api_route("/monitoring/config", monitoring_config, methods=["GET"], tags=["monitoring"])

    # ── Training & Prediction ────────────────────────────────────────────────
    app.add_api_route("/train", train_endpoint, methods=["POST"], tags=["training"])
    app.add_api_route("/train-sync", train_sync_endpoint, methods=["POST"], tags=["training"])
    app.add_api_route("/predict", predict_endpoint, methods=["POST"], tags=["prediction"])
    app.add_api_route("/regime", regime_endpoint, methods=["POST"], tags=["regime"])
    app.add_api_route("/news-trigger", feedback_signal_news_trigger, methods=["POST"], tags=["news"])
    app.add_api_route("/news/reaction", news_reaction_endpoint, methods=["POST"], tags=["news"])
    app.add_api_route("/news/reactions", get_news_reactions, methods=["GET"], tags=["news"])

    # ── Backtest / PBO ──────────────────────────────────────────────────────
    app.add_api_route("/backtest/pbo", run_pbo_backtest, methods=["POST"], tags=["backtest"])
    app.add_api_route("/backtest/mc", run_mc_backtest, methods=["POST"], tags=["backtest"])
    app.add_api_route("/backtest/full", run_full_pbo, methods=["POST"], tags=["backtest"])
    app.add_api_route("/backtest/autotune", autotune_pbo, methods=["POST"], tags=["backtest"])
    app.add_api_route("/backtest/returns", compute_returns, methods=["POST"], tags=["backtest"])

    # ── Data Upload / Query ──────────────────────────────────────────────────
    app.add_api_route("/model-status", model_status, methods=["GET"], tags=["models"])
    app.add_api_route("/candles/upload", upload_candles, methods=["POST"], tags=["data"])
    app.add_api_route("/trades/upload", upload_trades, methods=["POST"], tags=["data"])
    app.add_api_route("/candles/parse-csv", _parse_csv_wrapper, methods=["POST"], tags=["data"])
    app.add_api_route("/candles", get_candles, methods=["GET"], tags=["data"])
    app.add_api_route("/trades", get_trades, methods=["GET"], tags=["data"])
    app.add_api_route("/stats", get_stats, methods=["GET"], tags=["data"])

    # ── PSO Alpha Discovery ─────────────────────────────────────────────────
    app.add_api_route("/pso/discover", pso_discover, methods=["POST"], tags=["pso"])

    # ── Mamba SSM ────────────────────────────────────────────────────────────
    app.add_api_route("/mamba/predict", mamba_predict, methods=["POST"], tags=["mamba"])
    app.add_api_route("/mamba/status", mamba_status, methods=["GET"], tags=["mamba"])
    app.add_api_route("/mamba/finetune", mamba_finetune, methods=["POST"], tags=["mamba"])
    app.add_api_route("/mamba/vllm", mamba_vllm_predict, methods=["POST"], tags=["mamba"])

    # ── Inference (Triton/ONNX) ─────────────────────────────────────────────
    app.add_api_route("/inference/predict", inference_predict, methods=["POST"], tags=["inference"])
    app.add_api_route("/inference/status", inference_status, methods=["GET"], tags=["inference"])
    app.add_api_route("/inference/export", inference_export, methods=["POST"], tags=["inference"])
    app.add_api_route("/inference/setup", inference_setup, methods=["POST"], tags=["inference"])
    app.add_api_route("/inference/benchmark", _benchmark_wrapper, methods=["POST"], tags=["inference"])

    # ── Feedback Loop ───────────────────────────────────────────────────────
    app.add_api_route("/feedback/signal", _feedback_signal_wrapper, methods=["POST"], tags=["feedback"])
    app.add_api_route("/feedback/record-outcome", record_outcome, methods=["POST"], tags=["feedback"])
    app.add_api_route("/feedback/signals", get_signals, methods=["GET"], tags=["feedback"])
    app.add_api_route("/feedback/stats", get_feedback_stats, methods=["GET"], tags=["feedback"])
    app.add_api_route("/feedback/process-trades", process_trades, methods=["POST"], tags=["feedback"])
    app.add_api_route("/feedback/prepare-training-batch", prepare_training_batch, methods=["POST"], tags=["feedback"])
    app.add_api_route("/feedback/retrain", trigger_retrain, methods=["POST"], tags=["feedback"])
    app.add_api_route("/feedback/retrain-status", get_retrain_status, methods=["GET"], tags=["feedback"])

    # ── Global Exception Handler ─────────────────────────────────────────────
    app.add_exception_handler(Exception, global_exception_handler)


# ── Thin request wrappers (needed for route functions with FastAPI-specific params) ──

def _cache_invalidate(request: CacheInvalidateRequest):
    """Invalidate cache entries matching pattern or endpoint."""
    cache = get_cache()
    if request.pattern:
        cache.delete_pattern(request.pattern)
    if request.endpoint:
        cache.delete(f"cache:{request.endpoint}")
    return {"ok": True, "pattern": request.pattern, "endpoint": request.endpoint}


def _parse_csv_wrapper(file_content: str = Query(...)):
    return parse_csv_candles(file_content)


def _benchmark_wrapper(n_samples: int = Query(default=1000, ge=1, le=100000),
                       batch_size: int = Query(default=32, ge=1, le=256)):
    return inference_benchmark(n_samples=n_samples, batch_size=batch_size)


def _feedback_signal_wrapper(request: FeedbackSignalRequest,
                              raw_request: FastAPIRequest = None,
                              response=None):
    return log_signal(request, raw_request, response)


# ── SLA report endpoint (query param) ─────────────────────────────────────────

def sla_report(endpoint: str | None = None):
    return get_sla_report(endpoint or "ALL")


# ── App instance ──────────────────────────────────────────────────────────────

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=False)
