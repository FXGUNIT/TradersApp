"""
ML Engine — FastAPI Application
Port 8001 — handles training, prediction, consensus, health
"""
import os
import sys
import time
import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional

# Add ml-engine to path
sys.path.insert(0, str(Path(__file__).parent))

import config
from data.candle_db import CandleDatabase
from features.feature_pipeline import engineer_features, get_feature_vector
from training.trainer import Trainer
from training.model_store import ModelStore
from inference.predictor import Predictor
from inference.consensus_aggregator import ConsensusAggregator
from models.regime.regime_ensemble import RegimeEnsemble


# -------------------------------------------------------------------------
# Lifespan
# -------------------------------------------------------------------------

db: CandleDatabase | None = None
trainer: Trainer | None = None
predictor: Predictor | None = None
consensus_agg: ConsensusAggregator | None = None
store: ModelStore | None = None
regime_ensemble: RegimeEnsemble | None = None
start_time: float = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db, trainer, predictor, consensus_agg, store, regime_ensemble
    db = CandleDatabase(config.DB_PATH)
    trainer = Trainer(db_path=config.DB_PATH, store_dir=config.MODEL_STORE)
    predictor = Predictor(store_dir=config.MODEL_STORE)
    consensus_agg = ConsensusAggregator()
    store = ModelStore(config.MODEL_STORE)
    regime_ensemble = RegimeEnsemble(random_state=42)

    # Load models on startup
    try:
        predictor.load_all_models()
        print(f"Loaded {len(predictor._models)} models on startup")
    except Exception as e:
        print(f"Warning: could not load models on startup: {e}")

    yield

    # Cleanup
    print("ML Engine shutting down...")


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
            return result
        except Exception as e:
            return {"error": str(e), "traceback": traceback.format_exc()}

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
        result = trainer.train_direction_models(
            mode=request.mode,
            symbol=request.symbol,
            min_trades=request.min_trades,
            verbose=True,
        )
        predictor.load_all_models()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------------------
# Prediction / Consensus
# -------------------------------------------------------------------------

@app.post("/predict")
async def predict(request: PredictRequest):
    """
    Run all loaded models on current market state.
    Returns per-model votes + consensus signal.
    """
    try:
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

        return output

    except HTTPException:
        raise
    except Exception as e:
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
    """
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

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
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
