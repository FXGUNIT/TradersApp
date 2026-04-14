"""
ML Engine — PSO Alpha + Mamba SSM + Inference + Feedback Routes
Extracted from main.py (Rule #3 hard limit: Python ≤600 lines)
"""
import hashlib
import json
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, Query, Request as FastAPIRequest, Response
from fastapi.responses import JSONResponse

from _lifespan import db, drift_monitor, feedback_logger, trade_processor, retrain_pipeline, triton_client

from _infrastructure import (
    get_cache,
    get_sla_monitor,
    PROMETHEUS_AVAILABLE,
    record_prometheus_cache,
    get_request_id,
    _claim_idempotency,
    _store_idempotent_response,
    _release_idempotency_claim,
)
from training.training_eligibility import summarize_training_eligibility_batch
from schemas import FeedbackSignalRequest, MambaRequest, PSORequest, TritonInferenceRequest


# ── PSO Alpha Discovery ─────────────────────────────────────────────────────────

try:
    from optimization.pso_optimizer import PSOOptimizer, NichingPSO, run_alpha_discovery
    PSO_AVAILABLE = True
except ImportError:
    PSO_AVAILABLE = False
    PSOOptimizer = None
    NichingPSO = None
    run_alpha_discovery = None


def pso_discover(
    request: PSORequest,
    raw_request: FastAPIRequest = None,
    response: Response = None,
):
    """Run Particle Swarm Optimization for alpha discovery per regime."""
    from features.feature_pipeline import engineer_features

    if not PSO_AVAILABLE:
        return {"ok": False, "error": "PSO optimizer not available. Install: pip install pyswarms"}

    # Idempotency claim before any expensive computation
    claim = None
    payload = request.model_dump(mode="json")
    try:
        claim, replay = _claim_idempotency(
            raw_request, response, "pso_discover", payload,
            allow_body_fallback=True, wait_timeout_seconds=0.5, lock_ttl_seconds=600,
        )
        if replay is not None:
            return replay
    except HTTPException:
        raise
    except Exception:
        pass  # Proceed without idempotency if service unavailable

    monitor = get_sla_monitor()
    start = time.time()
    cache = get_cache()

    if request.candles:
        df = pd.DataFrame([c.model_dump() for c in request.candles])
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        candle_hash = hashlib.sha256(
            json.dumps(request.candles[-20:], sort_keys=True, default=str).encode()
        ).hexdigest()[:16]
    else:
        df = db.get_latest_candles(request.symbol, n=2000)
        candle_hash = "from_db"

    if df.empty:
        _release_idempotency_claim(claim)
        monitor.record("/pso/discover", (time.time() - start) * 1000, 400)
        raise HTTPException(status_code=400, detail="No candles available. Upload historical data first.")

    cache_key = f"pso:discover:{request.symbol}:{request.regime}:{request.n_particles}:{request.max_iterations}:{candle_hash}"
    cached = cache.get(cache_key)
    if cached is not None:
        if PROMETHEUS_AVAILABLE:
            record_prometheus_cache(hit=True)
        cached["_cached"] = True
        cached["_cache_age_ms"] = round((time.time() - start) * 1000, 1)
        monitor.record("/pso/discover", (time.time() - start) * 1000, 200)
        _store_idempotent_response(claim, cached, ttl_seconds=300)
        _release_idempotency_claim(claim)
        return cached

    try:
        trade_df = db.get_trade_log(limit=5000)
        feat_df = engineer_features(df, trade_df, None, {}, {})

        if request.regime != "ALL":
            niche_config = NichingPSO.REGIME_NICHES.get(request.regime.upper()) if NichingPSO else None
            if not niche_config:
                _release_idempotency_claim(claim)
                monitor.record("/pso/discover", (time.time() - start) * 1000, 400)
                raise HTTPException(status_code=400, detail=f"Unknown regime: {request.regime}")
            pso = PSOOptimizer(n_particles=request.n_particles, max_iterations=request.max_iterations)
            result = pso.optimize(df, trade_df, feat_df, regime=request.regime.upper())
            output = {
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
            result = run_alpha_discovery(df, trade_df, n_particles=request.n_particles, max_iterations=request.max_iterations)
            output = result

        cache.set(cache_key, output, ttl=300)
        latency_ms = (time.time() - start) * 1000
        monitor.record("/pso/discover", latency_ms, 200)
        if PROMETHEUS_AVAILABLE:
            record_prometheus_cache(hit=False)
        _store_idempotent_response(claim, output, ttl_seconds=300)
        return output
    except HTTPException:
        _release_idempotency_claim(claim)
        raise
    except Exception as exc:
        _release_idempotency_claim(claim)
        raise HTTPException(status_code=500, detail="Training optimization service unavailable.")
    finally:
        _release_idempotency_claim(claim)


# ── Mamba SSM Routes ────────────────────────────────────────────────────────────

try:
    from models.mamba.mamba_sequence_model import (
        get_mamba_prediction,
        MambaTradingModel,
        MAMBA_AVAILABLE,
        MODEL_SIZES,
    )
except ImportError:
    MAMBA_AVAILABLE = False
    MODEL_SIZES = {}
    get_mamba_prediction = None
    MambaTradingModel = None


def mamba_predict(request: MambaRequest):
    """Run Mamba SSM on candle sequence for direction/regime/pattern prediction."""
    if not MAMBA_AVAILABLE:
        return {
            "ok": False, "available": False,
            "error": "Mamba not available. Install: pip install torch transformers",
            "model_sizes": list(MODEL_SIZES.keys()),
            "recommendation": "For CPU: use mamba-130m or mamba-370m",
        }
    if request.model_size not in MODEL_SIZES:
        return {"ok": False, "error": f"Unknown model: {request.model_size}. Available: {list(MODEL_SIZES.keys())}"}

    monitor = get_sla_monitor()
    start = time.time()
    df_candles = request.candles if request.candles else db.get_latest_candles(request.symbol, n=200).to_dict("records")
    if not df_candles:
        monitor.record("/mamba/predict", (time.time() - start) * 1000, 400)
        raise HTTPException(status_code=400, detail="No candles available")

    cache = get_cache()
    candle_hash = hashlib.sha256(json.dumps(df_candles[-20:], sort_keys=True, default=str).encode()).hexdigest()[:16]
    cache_key = f"mamba:{request.symbol}:{request.model_size}:{request.task}:{candle_hash}"
    cached = cache.get(cache_key)
    if cached is not None:
        if PROMETHEUS_AVAILABLE:
            record_prometheus_cache(hit=True)
        cached["_cached"] = True
        cached["_cache_age_ms"] = round((time.time() - start) * 1000, 1)
        monitor.record("/mamba/predict", (time.time() - start) * 1000, 200)
        return cached

    result = get_mamba_prediction(df_candles, request.model_size, request.task)
    result["model_info"] = MODEL_SIZES.get(request.model_size, {})
    cache.set(cache_key, result, ttl=30)
    latency_ms = (time.time() - start) * 1000
    monitor.record("/mamba/predict", latency_ms, 200)
    if PROMETHEUS_AVAILABLE:
        record_prometheus_cache(hit=False)
    return result


def mamba_status():
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


def mamba_finetune(request: MambaRequest):
    """Fine-tune Mamba on trading data with Elastic Weight Consolidation."""
    if not MAMBA_AVAILABLE:
        raise HTTPException(status_code=503, detail="Mamba not available")
    df_candles = request.candles if request.candles else db.get_latest_candles(request.symbol, n=2000).to_dict("records")
    if len(df_candles) < 50:
        raise HTTPException(status_code=400, detail="Need at least 50 candles")
    labels = [1 if df_candles[i + 1].get("close", 0) > df_candles[i].get("close", 0) else 0
              for i in range(len(df_candles) - 1)]
    model = MambaTradingModel.get_instance(request.model_size)
    if not model._loaded:
        model.load()
    model.fine_tune_with_continual_learning(candles=df_candles, labels=labels, epochs=3, ewc_lambda=100)
    return {
        "ok": True,
        "message": "Mamba fine-tuned with EWC protection",
        "candles_used": len(df_candles),
        "labels_used": len(labels),
        "ewc_lambda": 100,
        "continual_learning": True,
        "catastrophic_forgetting": "PREVENTED via Elastic Weight Consolidation",
    }


def mamba_vllm_predict(candles: list[dict]):
    """Run Mamba via vLLM for sequence feature extraction."""
    try:
        from inference.vllm_server import call_vllm
    except ImportError:
        return {"error": "vLLM server not available"}
    if not candles:
        return {"error": "No candles provided"}
    recent = candles[-20:] if len(candles) >= 20 else candles
    last = recent[-1]
    narrative_parts = []
    if len(recent) >= 2:
        prev_close = recent[-2].get("close", 0)
        curr_close = last.get("close", 0)
        change = curr_close - prev_close
        narrative_parts.append(f"Candle closed {'up' if change > 0 else 'down'} {abs(change):.1f} ticks")
    if "amd_phase" in last:
        narrative_parts.append(f"AMD phase: {last['amd_phase']}")
    if "vr_regime" in last:
        narrative_parts.append(f"Volatility regime: {last['vr_regime']}")
    narrative = ". ".join(narrative_parts) if narrative_parts else "Market in transition."
    t0 = time.time()
    try:
        result = call_vllm(narrative)
        result["latency_ms"] = round((time.time() - t0) * 1000, 2)
        result["narrative"] = narrative
        return result
    except Exception as e:
        return {"error": "Narrative generation service unavailable.", "narrative": narrative}


# ── Inference Routes (Triton/ONNX) ─────────────────────────────────────────────

try:
    from inference.triton_client import get_inference_client
    from inference.onnx_exporter import export_model, export_all as export_all_models, list_onnx_models, get_onnx_output_dir
    from inference.triton_server import TRITON_REPO
    INFERENCE_AVAILABLE = True
    ONNX_DIR = get_onnx_output_dir()
except ImportError:
    INFERENCE_AVAILABLE = False
    get_inference_client = None
    export_model = None
    export_all_models = None
    list_onnx_models = None
    TRITON_REPO = Path(".")
    ONNX_DIR = Path(".")


def inference_predict(request: TritonInferenceRequest):
    """Run inference via Triton (GPU) or local ONNX Runtime fallback."""
    if not INFERENCE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Inference client not available")

    t0 = time.time()
    monitor = get_sla_monitor()
    cache = get_cache()
    features_str = json.dumps(request.features, sort_keys=True, default=str)
    features_hash = hashlib.sha256(features_str.encode()).hexdigest()[:16]
    cache_key = f"inference:{request.symbol}:{request.model_name}:{features_hash}"

    cached = cache.get(cache_key)
    if cached is not None:
        if PROMETHEUS_AVAILABLE:
            record_prometheus_cache(hit=True)
        cached["_cached"] = True
        cached["_cache_age_ms"] = round((time.time() - t0) * 1000, 1)
        monitor.record("/inference/predict", (time.time() - t0) * 1000, 200)
        return cached

    client = triton_client or get_inference_client()
    result = client.predict(features=request.features, model_name=request.model_name)
    result["latency_ms"] = round((time.time() - t0) * 1000, 2)
    result["symbol"] = request.symbol
    cache.set(cache_key, result, ttl=10)
    latency_ms = (time.time() - t0) * 1000
    monitor.record("/inference/predict", latency_ms, 200)
    if PROMETHEUS_AVAILABLE:
        record_prometheus_cache(hit=False)
    return result


def inference_status():
    """Get Triton server status and available ONNX models."""
    if not INFERENCE_AVAILABLE:
        return {"error": "Inference not available"}
    client = triton_client or get_inference_client()
    status = client.get_server_status()
    onnx_models = list_onnx_models() if list_onnx_models else []
    return {
        "triton": status,
        "onnx_exported": onnx_models,
        "onnx_dir": str(ONNX_DIR),
        "triton_repo": str(TRITON_REPO),
    }


def inference_export(model_name: str | None = None):
    """Export trained models to ONNX format for Triton serving."""
    if not INFERENCE_AVAILABLE:
        raise HTTPException(status_code=503, detail="ONNX exporter not available")
    try:
        if model_name:
            path = export_model(model_name)
            return {"ok": True, "exported": str(path)}
        paths = export_all_models()
        return {"ok": True, "exported": [str(p) for p in paths]}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


def inference_setup():
    """Set up Triton model repository from exported ONNX models."""
    try:
        from inference.triton_server import setup_model_repository
    except ImportError:
        raise HTTPException(status_code=503, detail="Triton server setup not available")
    setup_model_repository()
    return {"ok": True, "message": "Triton model repository ready", "repo": str(TRITON_REPO)}


def inference_benchmark(n_samples: int = 1000, batch_size: int = 32):
    """Benchmark inference latency."""
    if not INFERENCE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Inference client not available")
    client = triton_client or get_inference_client()
    return client.benchmark(n_samples=n_samples, batch_size=batch_size)


# ── Feedback Loop Routes ────────────────────────────────────────────────────────

def log_signal(request: FeedbackSignalRequest, raw_request, response):
    """Log a consensus signal for outcome tracking."""
    if feedback_logger is None:
        raise HTTPException(status_code=503, detail="Feedback logger not initialized")
    payload = request.model_dump(mode="json")
    claim, replay = _claim_idempotency(
        raw_request, response, "feedback_signal", payload,
        allow_body_fallback=True, wait_timeout_seconds=1.5, lock_ttl_seconds=30,
    )
    if replay is not None:
        return replay
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
        response_payload = {"ok": True, "signal_id": signal_id, "request_id": request.request_id or get_request_id()}
        _store_idempotent_response(claim, response_payload, ttl_seconds=300)
        return response_payload
    except Exception as e:
        _release_idempotency_claim(claim)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


def record_outcome(
    signal_id: int, trade_id: int, result: str, correct: bool,
    pnl_ticks: float | None = None, pnl_dollars: float | None = None,
    actual_move_ticks: float | None = None, expected_move_ticks: float | None = None,
):
    """Record the outcome of a matched trade for a previously logged signal."""
    if feedback_logger is None or trade_processor is None:
        raise HTTPException(status_code=503, detail="Feedback components not initialized")
    try:
        feedback_logger.record_outcome(
            signal_id=signal_id, trade_id=trade_id, result=result, correct=correct,
            pnl_ticks=pnl_ticks, pnl_dollars=pnl_dollars,
            actual_move_ticks=actual_move_ticks, expected_move_ticks=expected_move_ticks,
        )
        if drift_monitor is not None:
            with db.conn() as c:
                row = c.execute(
                    "SELECT signal, confidence FROM signal_log WHERE id = ?", (signal_id,),
                ).fetchone()
            if row:
                correct_val = 1 if correct else 0
                drift_monitor.concept_drift.record_prediction(
                    correct=bool(correct_val), confidence=float(row[1]) if row[1] else 0.5,
                )
        return {"ok": True, "signal_id": signal_id, "trade_id": trade_id, "correct": correct}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


def get_signals(limit: int = 100, symbol: str = "MNQ"):
    """Get recent consensus signal history with optional outcome data."""
    if feedback_logger is None:
        raise HTTPException(status_code=503, detail="Feedback logger not initialized")
    try:
        df = feedback_logger.get_signal_history(limit=limit)
        stats = feedback_logger.get_feedback_stats()
        return {"signals": df.to_dict(orient="records"), "stats": stats}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


def get_feedback_stats(symbol: str = "MNQ"):
    """Get feedback loop statistics: signal count, win rate, unmatched signals."""
    if feedback_logger is None:
        raise HTTPException(status_code=503, detail="Feedback logger not initialized")
    try:
        stats = feedback_logger.get_feedback_stats(symbol=symbol)
        concept = drift_monitor.concept_drift.detect() if drift_monitor else {}
        return {"signal_stats": stats, "concept_drift": concept}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


def process_trades(symbol: str = "MNQ"):
    """Process all closed trades and match them to consensus signals."""
    if trade_processor is None or drift_monitor is None:
        raise HTTPException(status_code=503, detail="Trade processor not initialized")
    try:
        result = trade_processor.process_all(drift_monitor=drift_monitor, symbol=symbol)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


def trigger_retrain(request: "FeedbackRetrainRequest"):
    """Trigger the closed-loop retrain pipeline."""
    if retrain_pipeline is None:
        raise HTTPException(status_code=503, detail="Retrain pipeline not initialized")
    try:
        original_mode = retrain_pipeline.config.training_mode
        retrain_pipeline.config.training_mode = request.training_mode
        retrain_pipeline.config.symbol = request.symbol
        retrain_pipeline.config.auto_retrain_on_drift = request.auto_retrain_on_drift
        report = retrain_pipeline.run(trigger=request.trigger, verbose=True)
        retrain_pipeline.config.training_mode = original_mode
        return {
            "triggered": report.triggered,
            "reason": report.reason,
            "should_retrain": report.drift_status.get("should_retrain", False),
            "overall_drift_status": report.drift_status.get("overall_status", "unknown"),
            "training_result": report.training_result.get("models", {}) if report.training_result else None,
            "error": report.error,
            "duration_sec": round(report.duration_sec, 2),
            "timestamp": report.timestamp,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


def prepare_training_batch(symbol: str = "MNQ", batch_type: str = "nightly_eligibility"):
    """Prepare and persist the current eligible training batch snapshot."""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not initialized")

    try:
        previous_batch = db.get_latest_training_batch_run(batch_type=batch_type, symbol=symbol)
        trade_log = db.get_trade_log(limit=10000, symbol=symbol)
        summary = summarize_training_eligibility_batch(
            trade_log,
            symbol=symbol,
            batch_type=batch_type,
            previous_batch=previous_batch,
        )
        batch_id = db.record_training_batch_run(summary)
        return {
            "ok": True,
            "batch_id": batch_id,
            **summary,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


def get_retrain_status():
    """Get current retrain pipeline status: last training, drift status, feedback stats."""
    if db is None or drift_monitor is None or feedback_logger is None:
        raise HTTPException(status_code=503, detail="Components not initialized")
    try:
        last_train = db.get_last_training("direction_ensemble")
        last_training_batch = db.get_latest_training_batch_run()
        stats = feedback_logger.get_feedback_stats()
        concept = drift_monitor.concept_drift.detect()
        return {
            "last_training": last_train,
            "last_training_batch": last_training_batch,
            "feedback_stats": stats,
            "concept_drift": concept,
            "pipeline_ready": retrain_pipeline is not None,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


# ── Global exception handler ───────────────────────────────────────────────────

def global_exception_handler(request, exc):
    """Catch-all exception handler for unhandled errors."""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal service error",
            "type": type(exc).__name__,
            "request_id": get_request_id(),
        },
    )
