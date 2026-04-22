"""
ML Engine Configuration — All hyperparameters in one place.
"""
import os
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
SCHEMA_PATH = DATA_DIR / "schema.sql"

DEFAULT_DB_PATH = str(DATA_DIR / "trading_data.db")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip() or None
DB_PATH = os.getenv("DB_PATH", DEFAULT_DB_PATH)
# ── Model store path ─────────────────────────────────────────────────────────
# Local dev:   ml-engine/models/store (default)
# Kubernetes:  /models/store (PVC mount, set via MODEL_STORE_PVC_MOUNT)
# When MODEL_STORE_PVC_MOUNT is set, MODEL_STORE uses that path instead.
# All pods sharing the same PVC see the same model artifacts.
MODEL_STORE_PVC_MOUNT = os.getenv("MODEL_STORE_PVC_MOUNT", "")
MODEL_STORE = os.getenv("MODEL_STORE") or MODEL_STORE_PVC_MOUNT or str(MODELS_DIR / "store")
MODEL_STORE_READ_ONLY = os.getenv("MODEL_STORE_READ_ONLY", "false").lower() in ("true", "1", "yes")
SCHEMA_PATH_STR = str(SCHEMA_PATH)

# ── MLflow Model Registry (stateless horizontal scaling) ─────────────────────
# When MLFLOW_USE_REGISTRY=true, ModelStore.load() queries MLflow for the
# production model version and downloads from S3/MinIO if newer than local.
# All pods converge to the same MLflow production model — the single source of truth.
MLFLOW_USE_REGISTRY = os.getenv("MLFLOW_USE_REGISTRY", "false").lower() in ("true", "1", "yes")
MLFLOW_REGISTRY_CHECK_INTERVAL = int(os.getenv("MLFLOW_REGISTRY_CHECK_INTERVAL", "60"))  # seconds

# Model registry sidecar / client configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_URL = os.getenv("REDIS_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}/0")
MODEL_REGISTRY_MODE = os.getenv("MODEL_REGISTRY_MODE", "direct").strip().lower()
MODEL_REGISTRY_URL = os.getenv("MODEL_REGISTRY_URL", "http://127.0.0.1:8010")
MODEL_REGISTRY_PORT = int(os.getenv("MODEL_REGISTRY_PORT", "8010"))
MODEL_REGISTRY_TIMEOUT_SECONDS = float(os.getenv("MODEL_REGISTRY_TIMEOUT_SECONDS", "10"))
MODEL_REGISTRY_WARMUP = os.getenv("MODEL_REGISTRY_WARMUP", "true").lower() in ("true", "1", "yes")
MODEL_REGISTRY_MAX_CACHED_INSTANCES = int(os.getenv("MODEL_REGISTRY_MAX_CACHED_INSTANCES", "4"))
MODEL_REGISTRY_CACHE_PREFIX = os.getenv("MODEL_REGISTRY_CACHE_PREFIX", "tradersapp:model_registry")

# Session definitions (Eastern Time)
SESSION_ID_TO_NAME = {
    0: "pre_market",
    1: "main_trading",
    2: "post_market",
}
SESSION_NAME_TO_ID = {name: sid for sid, name in SESSION_ID_TO_NAME.items()}
SESSION_LABELS = {
    0: "Pre",
    1: "Main",
    2: "Post",
}
SESSION_TYPES = tuple(SESSION_ID_TO_NAME.values())

# ── Session definitions (NSE India — loaded from YAML) ─────────────────────
# This replaces hardcoded Eastern Time sessions above for NSE-specific usage.
# The SESSION_CONFIG dict above is kept for backward compatibility with any
# code that depends on numeric keys 0/1/2.
_CANONICAL_SESSION_FALLBACK = {
    "pre_market": {
        "name": "Pre-Market Session",
        "start": "09:00",
        "end": "09:15",
        "timezone": "Asia/Kolkata",
        "type": "pre_market",
    },
    "main_trading": {
        "name": "Regular Session",
        "start": "09:15",
        "end": "15:30",
        "timezone": "Asia/Kolkata",
        "type": "regular",
    },
    "post_market": {
        "name": "Post-Market Session",
        "start": "15:30",
        "end": "16:00",
        "timezone": "Asia/Kolkata",
        "type": "post_market",
    },
}

_LEGACY_US_SESSION_DEFS = {
    "pre_market": {
        "name": "Pre-Market Session",
        "start": "04:00",
        "end": "09:15",
        "timezone": "America/New_York",
        "type": "pre_market",
    },
    "main_trading": {
        "name": "Main Trading Session",
        "start": "09:30",
        "end": "16:00",
        "timezone": "America/New_York",
        "type": "main_trading",
    },
    "post_market": {
        "name": "Post-Market Session",
        "start": "16:01",
        "end": "20:00",
        "timezone": "America/New_York",
        "type": "post_market",
    },
}


def _copy_session_context(session_context: dict[str, Any]) -> dict[str, Any]:
    return {
        "by_id": {sid: dict(cfg) for sid, cfg in session_context["by_id"].items()},
        "by_name": {name: dict(cfg) for name, cfg in session_context["by_name"].items()},
        "default_timezone": session_context["default_timezone"],
        "source": session_context["source"],
    }


def _normalize_session_entry(
    session_id: int,
    session_name: str,
    raw_session: dict[str, Any],
    default_timezone: str,
) -> dict[str, Any]:
    start = raw_session.get("start")
    end = raw_session.get("end")
    timezone = raw_session.get("timezone", default_timezone)
    return {
        "id": session_id,
        "name": session_name,
        "label": SESSION_LABELS.get(session_id, session_name.replace("_", " ").title()),
        "display_name": raw_session.get("name", session_name.replace("_", " ").title()),
        "start": start,
        "end": end,
        "start_local": start,
        "end_local": end,
        "start_et": start,
        "end_et": end,
        "timezone": timezone,
        "type": session_name,
        "yaml_type": raw_session.get("type", session_name),
    }


def _build_session_context(
    named_sessions: dict[str, dict[str, Any]],
    *,
    default_timezone: str,
    source: str,
) -> dict[str, Any]:
    by_id: dict[int, dict[str, Any]] = {}
    by_name: dict[str, dict[str, Any]] = {}
    for session_id, session_name in SESSION_ID_TO_NAME.items():
        raw_session = named_sessions.get(session_name)
        if raw_session is None and session_name == "main_trading":
            raw_session = named_sessions.get("regular")
        if raw_session is None:
            raise KeyError(f"Missing session definition for {session_name}")
        normalized = _normalize_session_entry(session_id, session_name, raw_session, default_timezone)
        by_id[session_id] = normalized
        by_name[session_name] = dict(normalized)
    return {
        "by_id": by_id,
        "by_name": by_name,
        "default_timezone": default_timezone,
        "source": source,
    }


def _load_session_context() -> dict[str, Any]:
    try:
        from infrastructure.session_loader import SessionLoader

        loader = SessionLoader()
        raw_sessions = {
            session_name: loader.get_session(session_name)
            for session_name in SESSION_TYPES
        }
        default_timezone = next(
            (
                session.get("timezone")
                for session in raw_sessions.values()
                if session and session.get("timezone")
            ),
            "Asia/Kolkata",
        )
        return _build_session_context(
            raw_sessions,
            default_timezone=default_timezone,
            source="session_loader",
        )
    except Exception:
        return _build_session_context(
            _CANONICAL_SESSION_FALLBACK,
            default_timezone="Asia/Kolkata",
            source="fallback",
        )


SESSION_CONTEXT = _load_session_context()
LEGACY_US_SESSION_CONTEXT = _build_session_context(
    _LEGACY_US_SESSION_DEFS,
    default_timezone="America/New_York",
    source="legacy_us",
)
DEFAULT_SESSION_TIMEZONE = SESSION_CONTEXT["default_timezone"]


def get_session_context(*, use_legacy_us: bool = False) -> dict[str, Any]:
    return _copy_session_context(LEGACY_US_SESSION_CONTEXT if use_legacy_us else SESSION_CONTEXT)


SESSION_CONFIG = {
    session_id: dict(session_cfg)
    for session_id, session_cfg in SESSION_CONTEXT["by_id"].items()
}
LEGACY_US_SESSION_CONFIG = {
    session_id: dict(session_cfg)
    for session_id, session_cfg in LEGACY_US_SESSION_CONTEXT["by_id"].items()
}
NSE_SESSION_CONFIG = {
    session_name: dict(session_cfg)
    for session_name, session_cfg in SESSION_CONTEXT["by_name"].items()
}
NSE_SESSION_CONFIG["default_timezone"] = DEFAULT_SESSION_TIMEZONE

# AMD Phase encoding
AMD_PHASES = ["ACCUMULATION", "MANIPULATION", "DISTRIBUTION", "TRANSITION", "UNCLEAR"]

# Volatility regime encoding
VR_COMPRESSION = 0    # VR < 0.85
VR_NORMAL      = 1    # 0.85 <= VR < 1.15
VR_EXPANSION   = 2    # VR >= 1.15

# RRR grid search
RRR_GRID = list(range(50, 401, 25))   # 0.5 to 4.0 in 0.25 steps (multiplied by 2)
RRR_RANGE = (0.5, 4.0)
RRR_STEP = 0.25

# Stop loss grid (ticks)
SL_GRID = [10, 15, 20, 25, 30, 35, 40, 50]

# TP grid (ticks)
TP_GRID = [5, 10, 15, 20, 25, 30, 35, 40, 50]

# Partial close percentages
PCT_GRID = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50]

# Trailing stop grid
TRAIL_GRID = [4, 6, 8, 10, 12, 15, 20]

# Max hold grid (minutes)
HOLD_GRID = [30, 45, 60, 90, 120, 180]

# LightGBM direction model
LGBM_DIRECTION = {
    "n_estimators": 500,
    "max_depth": 6,
    "learning_rate": 0.03,
    "num_leaves": 31,
    "min_child_samples": 50,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.1,
    "reg_lambda": 0.1,
    "is_unbalance": True,
    "random_state": 42,
    "n_jobs": -1,
    "verbose": -1,
}

# XGBoost
XGB_DIRECTION = {
    "n_estimators": 400,
    "max_depth": 5,
    "learning_rate": 0.03,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "scale_pos_weight": 1,
    "random_state": 42,
    "n_jobs": -1,
    "verbosity": 0,
}

# Random Forest
RF_DIRECTION = {
    "n_estimators": 300,
    "max_depth": 8,
    "min_samples_leaf": 30,
    "min_samples_split": 10,
    "random_state": 42,
    "n_jobs": -1,
}

# Magnitude quantile regressor
LGBM_QUANTILE = {
    "n_estimators": 300,
    "max_depth": 5,
    "learning_rate": 0.05,
    "num_leaves": 20,
    "min_child_samples": 80,
    "subsample": 0.7,
    "colsample_bytree": 0.7,
    "random_state": 42,
    "n_jobs": -1,
    "verbose": -1,
}

# Session probability model
LGBM_SESSION = {
    "n_estimators": 300,
    "max_depth": 4,
    "learning_rate": 0.05,
    "num_leaves": 15,
    "min_child_samples": 60,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "random_state": 42,
    "n_jobs": -1,
    "verbose": -1,
}

# Alpha model
LGBM_ALPHA = {
    "n_estimators": 300,
    "max_depth": 5,
    "learning_rate": 0.05,
    "num_leaves": 20,
    "min_child_samples": 60,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "random_state": 42,
    "n_jobs": -1,
    "verbose": -1,
}

# Exit strategy model
LGBM_EXIT = {
    "n_estimators": 500,
    "max_depth": 6,
    "learning_rate": 0.03,
    "num_leaves": 31,
    "min_child_samples": 50,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.1,
    "reg_lambda": 0.1,
    "random_state": 42,
    "n_jobs": -1,
    "verbose": -1,
}

# Position sizing model
LGBM_POSITION = {
    "n_estimators": 200,
    "max_depth": 4,
    "learning_rate": 0.05,
    "num_leaves": 15,
    "min_child_samples": 80,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "random_state": 42,
    "n_jobs": -1,
    "verbose": -1,
}

# Time series cross-validation
TSCV_N_SPLITS = 5
TSCV_GAP = 10   # 10 candles = 50 minutes buffer

# Risk management defaults
DEFAULT_SL_TICKS = 20
MIN_ACCEPTABLE_RR = 1.5
FIRM_MAX_RISK_PCT = 0.003   # 0.3% of account per trade
FIRM_MAX_CONTRACTS = 4
TICK_VALUE = 2.0            # MNQ: $2/tick
KELLY_FRACTION = 0.5        # Half-Kelly safety margin

# Feature columns for ML models (canonical list)
FEATURE_COLS = [
    "open", "high", "low", "close", "volume",
    "tr", "atr", "log_return", "intrabar_momentum",
    "range", "range_pct", "upper_wick_pct", "lower_wick_pct",
    "atr_pct", "volume_ratio_5",
    "rolling_std_10", "rolling_std_20", "realized_vol",
    "momentum_3bar", "momentum_5bar",
    "hour_of_day", "day_of_week", "session_pct",
    "minutes_into_session", "session_id",
    "is_first_30min", "is_last_30min", "is_lunch_hour",
    "price_to_pdh", "price_to_pdl", "near_level",
    "adx", "ci", "vwap", "vwap_slope_entry",
    "vr", "sweep_prob", "volatility_regime",
    "amd_ACCUMULATION", "amd_MANIPULATION", "amd_DISTRIBUTION",
    "amd_TRANSITION", "amd_UNCLEAR",
    "vr_regime",
    "win_rate_20", "win_rate_50", "expectancy_20", "profit_factor_20",
    "gap_pct", "range_vs_atr", "daily_range_used_pct",
]
