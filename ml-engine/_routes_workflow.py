"""
ML Engine — Training and Prediction Routes
Extracted from main.py (Rule #3 hard limit: Python ≤600 lines)

Holds: /train, /train-sync, /predict, /regime, and all per-route helper functions.
"""
import hashlib
import json
import time
import traceback

import numpy as np
import pandas as pd
from fastapi import BackgroundTasks, HTTPException, Query, Request as FastAPIRequest, Response
from fastapi.responses import JSONResponse

from _infrastructure import (
    PROMETHEUS_AVAILABLE,
    get_sla_monitor,
    ensure_training_enabled,
    get_model_registry_client,
    get_model_registry_status,
    sync_model_registry_metrics,
    record_prometheus_prediction,
    record_prometheus_cache,
    record_prometheus_retrain,
    get_request_id,
    _claim_idempotency,
    _store_idempotent_response,
    _release_idempotency_claim,
)

# Import models from _models.py
from schemas import (
    TrainRequest,
    PredictRequest,
    RegimeRequest,
    FeedbackSignalRequest,
)

# Re-expose globals
from _lifespan import db, trainer, consensus_agg, store, drift_monitor, retrain_pipeline
from _lifespan import kafka_producer, feast_warmed, lineage_registry

# Lazy imports (may not be installed)
try:
    from infrastructure.performance import get_cache
except ImportError:
    get_cache = lambda: type("_", (), {"get": lambda s, k: None, "set": lambda s, k, v, **kw: None, "invalidate": lambda s, k: None, "invalidate_all": lambda s: None})()
try:
    from infrastructure.model_monitor import build_monitoring_snapshot
except Exception:
    build_monitoring_snapshot = None

try:
    from features.feature_pipeline import engineer_features, get_feature_vector
except Exception:
    engineer_features = lambda *a, **k: pd.DataFrame()
    get_feature_vector = lambda *a: pd.DataFrame()

try:
    from features.feast_client import get_all_features as feast_get_all_features
except Exception:
    feast_get_all_features = lambda **kw: {}

try:
    from models.mamba.mamba_sequence_model import get_mamba_prediction, MAMBA_AVAILABLE, MODEL_SIZES
except ImportError:
    get_mamba_prediction = None
    MAMBA_AVAILABLE = False
    MODEL_SIZES = {}

KAFKA_AVAILABLE = False
try:
    from _kafka import publish_consensus_to_kafka
    KAFKA_AVAILABLE = True
except Exception:
    publish_consensus_to_kafka = lambda *a, **k: None

# ── /train ─────────────────────────────────────────────────────────────────────

def train_endpoint(
    request: TrainRequest,
    background: BackgroundTasks,
    raw_request: FastAPIRequest,
    response: Response,
):
    """Trigger background model training. Returns immediately."""
    ensure_training_enabled()
    payload = request.model_dump(mode="json")
    claim, replay = _claim_idempotency(
        raw_request, response, "train", payload,
        allow_body_fallback=True, wait_timeout_seconds=0.25, lock_ttl_seconds=3600,
    )
    if replay is not None:
        return replay

    def _do_train():
        try:
            result = trainer.train_direction_models(
                mode=request.mode, symbol=request.symbol,
                min_trades=request.min_trades, verbose=True,
            )
            registry_client = get_model_registry_client()
            registry_client.invalidate(["predictor"])
            sync_model_registry_metrics(registry_client.warm_models(["predictor"]))
            return result
        except Exception as e:
            return {"error": str(e), "traceback": traceback.format_exc()}
        finally:
            if PROMETHEUS_AVAILABLE and record_prometheus_retrain:
                record_prometheus_retrain(triggered=False, in_progress=False)

    if PROMETHEUS_AVAILABLE and record_prometheus_retrain:
        record_prometheus_retrain(triggered=True, in_progress=True)
    background.add_task(_do_train)

    accepted_response = {
        "status": "training_started", "mode": request.mode,
        "symbol": request.symbol,
        "message": "Training running in background. Poll /model-status for results.",
    }
    _store_idempotent_response(claim, accepted_response, ttl_seconds=3600)
    return accepted_response


def train_sync_endpoint(request: TrainRequest, raw_request: FastAPIRequest, response: Response):
    """Synchronous training — waits for completion."""
    ensure_training_enabled()
    payload = request.model_dump(mode="json")
    claim = None
    try:
        claim, replay = _claim_idempotency(
            raw_request, response, "train_sync", payload,
            allow_body_fallback=True, wait_timeout_seconds=2.0, lock_ttl_seconds=3600,
        )
        if replay is not None:
            return replay
        if PROMETHEUS_AVAILABLE and record_prometheus_retrain:
            record_prometheus_retrain(triggered=True, in_progress=True)
        result = trainer.train_direction_models(
            mode=request.mode, symbol=request.symbol,
            min_trades=request.min_trades, verbose=True,
        )
        registry_client = get_model_registry_client()
        registry_client.invalidate(["predictor"])
        sync_model_registry_metrics(registry_client.warm_models(["predictor"]))
        _store_idempotent_response(claim, result, ttl_seconds=3600)
        return result
    except HTTPException:
        _release_idempotency_claim(claim)
        raise
    except Exception as e:
        _release_idempotency_claim(claim)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if PROMETHEUS_AVAILABLE and record_prometheus_retrain:
            record_prometheus_retrain(triggered=False, in_progress=False)


# ── /predict ──────────────────────────────────────────────────────────────────

def predict_endpoint(request: PredictRequest, raw_request: FastAPIRequest, response: Response):
    """Run all models on current market state. Cached 10s in Redis."""
    monitor = get_sla_monitor()
    start = time.time()
    payload = request.model_dump(mode="json")
    claim = None
    try:
        claim, replay = _claim_idempotency(
            raw_request, response, "predict", payload,
            allow_body_fallback=True, wait_timeout_seconds=0.5, lock_ttl_seconds=60,
        )
        if replay is not None:
            return replay

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
                record_prometheus_prediction(latency_seconds=latency_ms / 1000,
                                             confidence=float(cached.get("confidence") or 0.0),
                                             symbol=request.symbol)
            _store_idempotent_response(claim, cached, ttl_seconds=60)
            return cached
        elif PROMETHEUS_AVAILABLE and record_prometheus_cache:
            record_prometheus_cache(hit=False)

        # Build DataFrames
        df = pd.DataFrame([c.model_dump() for c in request.candles]) if request.candles else pd.DataFrame()
        if not df.empty:
            df["timestamp"] = pd.to_datetime(df["timestamp"])
        else:
            df = db.get_latest_candles(request.symbol, n=100)
            if df.empty:
                raise HTTPException(status_code=400, detail="No candles available. Upload data first.")

        trade_df = pd.DataFrame([t.model_dump() for t in request.trades]) if request.trades else None
        me = request.math_engine_snapshot or {}

        # Validate
        if request.candles:
            try:
                from data_quality.validation_pipeline import validate_incoming_dataset
                validate_incoming_dataset(df=df, dataset_type="candles",
                                         source="api:/predict:candles", block=True, persist_rejected=True)
            except Exception:
                pass  # Never block prediction for DQ failures

        # Get model votes via registry
        votes_result = get_model_registry_client().predict(
            candles_df=df, trade_log_df=trade_df,
            math_engine_snapshot=me, key_levels=request.key_levels,
        )
        votes = votes_result.get("votes", {})
        consensus = votes_result.get("consensus", {})

        # Build features
        if not df.empty:
            feat_df = engineer_features(df, trade_df, None, me, request.key_levels)
            feat_vec = get_feature_vector(feat_df)
            feat_dict = feat_vec.iloc[-1].to_dict() if not feat_vec.empty else {}
            feat_dict["session_id"] = request.session_id
        else:
            feat_dict = {}

        # Supplement with Feast features
        try:
            feast_feats = feast_get_all_features(symbol=request.symbol,
                                                  timestamp=pd.Timestamp.utcnow().isoformat())
            for k, v in feast_feats.items():
                if k not in feat_dict or feat_dict.get(k) == 0:
                    feat_dict[k] = v
        except Exception:
            pass

        # Aggregate
        model_metas = {}
        for name in votes.keys():
            try:
                model_metas[name] = store.load_meta(name, "latest")
            except Exception:
                pass

        output = consensus_agg.aggregate(
            votes=votes, consensus=consensus, model_metas=model_metas,
            feature_dict=feat_dict, session_id=request.session_id,
            math_engine_snapshot=me,
        )

        # Physics regime
        try:
            if not df.empty:
                feat_for_regime = engineer_features(df)
                for col in ["vr", "adx", "atr", "ci", "vwap",
                            "amd_ACCUMULATION", "amd_MANIPULATION", "amd_DISTRIBUTION",
                            "amd_TRANSITION", "amd_UNCLEAR"]:
                    if col not in feat_for_regime.columns:
                        feat_for_regime[col] = 0.0
                regime_result = get_model_registry_client().advance_regime(feat_for_regime)
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

        # Mamba SSM vote
        try:
            if request.candles or not df.empty:
                candle_list = request.candles if request.candles else df.to_dict("records")
                if candle_list and MAMBA_AVAILABLE:
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

        # Kafka publish
        publish_consensus_to_kafka(
            symbol=request.symbol,
            signal={
                "signal": output.get("signal", "NEUTRAL"),
                "confidence": output.get("confidence", 0.0),
                "long_score": output.get("long_score", 0),
                "short_score": output.get("short_score", 0),
                "votes": output.get("votes", {}),
            },
            regime=output.get("physics_regime", {}).get("regime"),
        )

        # Cache
        cache.set(cache_key, output, ttl=10)

        latency_ms = (time.time() - start) * 1000
        monitor.record("/predict", latency_ms, 200)
        if PROMETHEUS_AVAILABLE and record_prometheus_prediction:
            record_prometheus_prediction(latency_seconds=latency_ms / 1000,
                                         confidence=float(output.get("confidence") or 0.0),
                                         symbol=request.symbol)
        output["request_id"] = get_request_id()
        output["_latency_ms"] = round(latency_ms, 1)
        _store_idempotent_response(claim, output, ttl_seconds=60)
        return output
    finally:
        _release_idempotency_claim(claim)


# ── /regime ─────────────────────────────────────────────────────────────────────

def regime_endpoint(request: RegimeRequest):
    """Physics-based regime analysis: HMM + FP-FK + Anomalous Diffusion. Cached 60s."""
    from _lifespan import start_time as _start_time
    start = time.time()
    cache = get_cache()
    monitor = get_sla_monitor()

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

    if request.candles:
        df = pd.DataFrame([c for c in request.candles])
        df["timestamp"] = pd.to_datetime(df["timestamp"])
    else:
        df = db.get_latest_candles(request.symbol, n=200)
        if df.empty:
            raise HTTPException(status_code=400, detail="No candles available.")

    if len(df) < 50:
        raise HTTPException(status_code=400, detail="Need at least 50 candles for regime analysis.")

    feat_df = engineer_features(df)
    for col in ["vr", "adx", "atr", "ci", "vwap",
                "amd_ACCUMULATION", "amd_MANIPULATION", "amd_DISTRIBUTION",
                "amd_TRANSITION", "amd_UNCLEAR"]:
        if col not in feat_df.columns:
            feat_df[col] = 0.0

    regime_result = get_model_registry_client().advance_regime(feat_df)

    output = {
        "ok": True,
        "regime": regime_result["regime"],
        "regime_id": regime_result["regime_id"],
        "confidence": regime_result["regime_confidence"],
        "posteriors": regime_result["regime_posteriors"],
        "model_weights": regime_result["model_weights"],
        "hmm_agreement": regime_result["model_weights"]["hmm"] == regime_result["model_weights"]["fp_fk"],
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
        "hmm": {
            "regime": regime_result["hmm"]["regime"],
            "confidence": regime_result["hmm"]["confidence"],
            "previous_regime": regime_result["hmm"]["previous_regime"],
            "regime_change": regime_result["hmm"]["regime_change"],
            "transition_prob": regime_result["hmm"]["transition_prob"],
        },
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
        "deleverage_signal": regime_result["deleverage_signal"],
        "deleverage_reason": regime_result["deleverage_reason"],
        "signal_adjustment": regime_result["signal_adjustment"],
        "stop_multiplier": regime_result["stop_multiplier"],
        "position_adjustment": regime_result["position_adjustment"],
        "physics_explanation": regime_result["explanation"],
        "n_candles": len(df),
        "timestamp": pd.Timestamp.utcnow().isoformat(),
    }

    cache.set(cache_key, output, ttl=60)
    latency_ms = (time.time() - start) * 1000
    monitor.record("/regime", latency_ms, 200)
    output["_latency_ms"] = round(latency_ms, 1)
    return output


# ── Feedback loop ─────────────────────────────────────────────────────────────

def feedback_signal_endpoint(request: FeedbackSignalRequest):
    """Log a consensus signal for outcome tracking."""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not initialized")
    try:
        from feedback.feedback_logger import FeedbackLogger
        from _lifespan import feedback_logger
        if feedback_logger is not None:
            feedback_logger.log_signal(
                signal=request.signal,
                confidence=request.confidence,
                votes=request.votes,
                regime=request.regime,
            )
        return {"ok": True, "logged": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
