"""
ML Engine — Data Upload/Query Routes + Model Status
Extracted from main.py (Rule #3 hard limit: Python ≤600 lines)
"""
import io
import time
import traceback

import pandas as pd
from fastapi import HTTPException, Query

from _lifespan import db, store
from training.training_eligibility import build_trade_training_metadata

from _infrastructure import (
    get_cache,
    get_sla_monitor,
    get_model_registry_status,
    _claim_idempotency,
    _store_idempotent_response,
    _release_idempotency_claim,
)

try:
    from infrastructure.quality_gate import validate_incoming_dataset
    QUALITY_GATE_AVAILABLE = True
except ImportError:
    QUALITY_GATE_AVAILABLE = False
    validate_incoming_dataset = lambda **kw: {"passed": True, "critical_failures": 0, "warning_failures": 0}


# ── /model-status ───────────────────────────────────────────────────────────────

def model_status():
    """Get status of all trained models."""
    monitor = get_sla_monitor()
    start = time.time()
    try:
        registry_status = get_model_registry_status()
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
        result = {
            "models": status,
            "predictor_ready": registry_status.get("predictor", {}).get("ready", False),
            "model_registry": registry_status,
        }
        monitor.record("/model-status", (time.time() - start) * 1000, 200)
        return result
    except Exception as e:
        monitor.record("/model-status", (time.time() - start) * 1000, 500)
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


# ── /candles/upload ─────────────────────────────────────────────────────────────

def upload_candles(request: "UploadCandlesRequest"):
    """Bulk upload candles from NinjaTrader CSV."""
    try:
        if not request.candles:
            raise HTTPException(status_code=400, detail="No candles provided")
        rows = [c.model_dump() for c in request.candles]
        df = pd.DataFrame(rows)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        dq_report = validate_incoming_dataset(
            df=df, dataset_type="candles", source="api:/candles/upload",
            block=True, persist_rejected=True,
        ) if QUALITY_GATE_AVAILABLE else {"passed": True, "critical_failures": 0, "warning_failures": 0}
        inserted = db.insert_candles(df)
        return {
            "status": "success",
            "candles_inserted": inserted,
            "total_candles": db.get_candle_count(request.symbol),
            "dq": {
                "passed": bool(dq_report.get("passed", False)),
                "critical_failures": int(dq_report.get("critical_failures", 0)),
                "warning_failures": int(dq_report.get("warning_failures", 0)),
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail="Invalid request parameters.")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


# ── /trades/upload ─────────────────────────────────────────────────────────────

def upload_trades(request: "UploadTradesRequest"):
    """Bulk upload trade journal entries."""
    try:
        if not request.trades:
            raise HTTPException(status_code=400, detail="No trades provided")
        training_metadata = build_trade_training_metadata(
            source_uid=request.source_uid,
            source_role=request.source_role,
            source_days_used=(
                request.days_used
                if request.days_used is not None
                else request.source_days_used
            ),
            is_training_eligible=request.is_training_eligible,
        )
        rows = []
        for t in request.trades:
            row = t.model_dump()
            row["symbol"] = request.symbol
            row.update(training_metadata)
            rows.append(row)
        trade_df = pd.DataFrame(rows)
        dq_report = validate_incoming_dataset(
            df=trade_df, dataset_type="trades", source="api:/trades/upload",
            block=True, persist_rejected=True,
        ) if QUALITY_GATE_AVAILABLE else {"passed": True, "critical_failures": 0, "warning_failures": 0}
        for row in rows:
            db.upsert_trade(row)
        total = db.get_trade_count(request.symbol)
        return {
            "status": "success",
            "trades_uploaded": len(request.trades),
            "training_eligible_uploaded": sum(
                1 for row in rows if row.get("is_training_eligible")
            ),
            "total_trades": total,
            "min_for_training": 100,
            "ready": total >= 100,
            "dq": {
                "passed": bool(dq_report.get("passed", False)),
                "critical_failures": int(dq_report.get("critical_failures", 0)),
                "warning_failures": int(dq_report.get("warning_failures", 0)),
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail="Invalid request parameters.")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


# ── /candles/parse-csv ─────────────────────────────────────────────────────────

def parse_csv_candles(file_content: str):
    """Parse raw NinjaTrader CSV content without persisting."""
    try:
        lines = file_content.strip().split("\n")
        if not lines:
            raise HTTPException(status_code=400, detail="Empty CSV content")

        header = [h.strip().strip('"').lower() for h in lines[0].split(",")]
        data_lines = lines[1:]

        if "date" in header and "time" in header:
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
                "open": opens, "high": highs, "low": lows, "close": closes, "volume": volumes,
            })
        else:
            reader = pd.read_csv(io.StringIO(file_content))
            reader.columns = [c.lower().strip() for c in reader.columns]
            df = reader.copy()
            ts_cols = [c for c in df.columns if "date" in c or "time" in c or "timestamp" in c]
            if ts_cols:
                df["timestamp"] = pd.to_datetime(df[ts_cols[0]])
            elif "open" in df.columns:
                df = df.rename(columns={df.columns[0]: "timestamp"})
            for col in ["open", "high", "low", "close", "volume"]:
                if col not in df.columns:
                    raise HTTPException(status_code=400, detail=f"Missing required column: {col}")
            df = df[["timestamp", "open", "high", "low", "close", "volume"]]

        from features.feature_pipeline import assign_session_ids
        df = assign_session_ids(df)
        dq_report = validate_incoming_dataset(
            df=df, dataset_type="candles", source="api:/candles/parse-csv",
            block=True, persist_rejected=True,
        ) if QUALITY_GATE_AVAILABLE else {"passed": True, "critical_failures": 0, "warning_failures": 0}
        inserted = db.insert_candles(df)
        return {
            "status": "success",
            "rows_parsed": len(df),
            "candles_inserted": inserted,
            "date_range": {"start": str(df["timestamp"].min()), "end": str(df["timestamp"].max())},
            "session_breakdown": {
                "pre": int((df["session_id"] == 0).sum()),
                "main": int((df["session_id"] == 1).sum()),
                "post": int((df["session_id"] == 2).sum()),
            },
            "dq": {
                "passed": bool(dq_report.get("passed", False)),
                "critical_failures": int(dq_report.get("critical_failures", 0)),
                "warning_failures": int(dq_report.get("warning_failures", 0)),
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail="Invalid request parameters.")
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


# ── /candles, /trades, /stats ───────────────────────────────────────────────────

def get_candles(symbol: str = "MNQ", start: str = "", end: str = "", session_id: int | None = None, limit: int = 1000):
    """Query candle data."""
    try:
        if start and end:
            df = db.get_candles(start, end, symbol, session_id, limit)
        else:
            df = db.get_latest_candles(symbol, min(limit, 5000))
            if session_id is not None:
                df = df[df["session_id"] == session_id]
        return {"count": len(df), "candles": df.to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


def get_trades(symbol: str = "MNQ", limit: int = 500):
    """Query trade log."""
    try:
        df = db.get_trade_log(limit, symbol)
        return {"count": len(df), "trades": df.to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")


def get_stats():
    """Get database statistics."""
    try:
        return db.get_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Service temporarily unavailable.")
