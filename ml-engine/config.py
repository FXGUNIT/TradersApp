"""
ML Engine Configuration — All hyperparameters in one place.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
SCHEMA_PATH = DATA_DIR / "schema.sql"

DB_PATH = str(DATA_DIR / "trading_data.db")
# ── Model store path ─────────────────────────────────────────────────────────
# Local dev:   ml-engine/models/store (default)
# Kubernetes:  /models/store (PVC mount, set via MODEL_STORE_PVC_MOUNT)
# When MODEL_STORE_PVC_MOUNT is set, MODEL_STORE uses that path instead.
# All pods sharing the same PVC see the same model artifacts.
MODEL_STORE_PVC_MOUNT = os.getenv("MODEL_STORE_PVC_MOUNT", "")
MODEL_STORE = MODEL_STORE_PVC_MOUNT or str(MODELS_DIR / "store")
SCHEMA_PATH_STR = str(SCHEMA_PATH)

# ── MLflow Model Registry (stateless horizontal scaling) ─────────────────────
# When MLFLOW_USE_REGISTRY=true, ModelStore.load() queries MLflow for the
# production model version and downloads from S3/MinIO if newer than local.
# All pods converge to the same MLflow production model — the single source of truth.
MLFLOW_USE_REGISTRY = os.getenv("MLFLOW_USE_REGISTRY", "false").lower() in ("true", "1", "yes")
MLFLOW_REGISTRY_CHECK_INTERVAL = int(os.getenv("MLFLOW_REGISTRY_CHECK_INTERVAL", "60"))  # seconds

# Session definitions (Eastern Time)
SESSION_CONFIG = {
    0: {"name": "pre_market",  "start_et": "04:00", "end_et": "09:15", "label": "Pre"},
    1: {"name": "main_trading", "start_et": "09:30", "end_et": "16:00", "label": "Main"},
    2: {"name": "post_market", "start_et": "16:01", "end_et": "20:00", "label": "Post"},
}

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
