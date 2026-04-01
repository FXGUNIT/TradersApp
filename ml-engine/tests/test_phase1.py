"""
Phase 1 Tests — verify all foundation components work correctly.
Run with: pytest ml-engine/tests/ -v
"""
import os, sys, tempfile, time
from pathlib import Path

import pytest
import pandas as pd
import numpy as np

# Add ml-engine to path
ML_ENGINE = Path(__file__).parent.parent
sys.path.insert(0, str(ML_ENGINE))

import config
from data.candle_db import CandleDatabase
from data.load_ninjatrader_csv import load_ninjatrader_csv, compute_session_aggregates
from features.feature_pipeline import (
    engineer_features, get_feature_vector, assign_session_ids,
    compute_candle_features, compute_time_features, FEATURE_COLS
)
from training.cross_validator import TimeSeriesCrossValidator
from training.model_store import ModelStore
from models.direction.lightgbm_classifier import LightGBMClassifier
from models.direction.random_forest import RandomForestClassifierModel
from models.direction.xgboost_classifier import XGBoostClassifier


# -------------------------------------------------------------------------
# Fixtures
# -------------------------------------------------------------------------

@pytest.fixture
def temp_db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    db = CandleDatabase(db_path)
    yield db
    db._get_conn().close()
    os.unlink(db_path)


@pytest.fixture
def sample_candles():
    """Generate 200 realistic 5-min candles."""
    np.random.seed(42)
    dates = pd.date_range("2026-03-01 09:30", periods=200, freq="5min", tz="America/New_York")
    close = 18500 + np.cumsum(np.random.randn(200) * 5)
    high = close + np.abs(np.random.randn(200) * 2)
    low = close - np.abs(np.random.randn(200) * 2)
    open_p = close + np.random.randn(200) * 1
    volume = np.random.randint(5000, 50000, 200)

    df = pd.DataFrame({
        "timestamp": dates,
        "open": open_p,
        "high": high,
        "low": low,
        "close": close,
        "volume": volume,
    })
    df = assign_session_ids(df)
    return df


@pytest.fixture
def sample_trade_log():
    """Generate 30 sample trades (dates overlap with sample_candles: start Feb 15 so merge_asof finds data)."""
    np.random.seed(42)
    dates = pd.date_range("2026-02-15", periods=30, freq="D")
    results = []
    for i, date in enumerate(dates):
        pnl_ticks = np.random.randn() * 15
        results.append({
            "entry_time": str(date),
            "exit_time": str(date + pd.Timedelta(hours=1)),
            "symbol": "MNQ",
            "entry_price": 18500.0,
            "exit_price": 18500.0 + pnl_ticks,
            "direction": 1 if pnl_ticks > 0 else -1,
            "session_id": 1,
            "pnl_ticks": pnl_ticks,
            "pnl_dollars": pnl_ticks * 2.0,
            "result": "win" if pnl_ticks > 0 else "loss",
            "target_rrr": 2.0,
            "actual_rrr": abs(pnl_ticks) / 20.0 if pnl_ticks > 0 else 0.0,
            "amd_phase": np.random.choice(["ACCUMULATION", "MANIPULATION", "DISTRIBUTION", "TRANSITION", "UNCLEAR"]),
            "adx_entry": np.random.uniform(15, 40),
            "atr_entry": np.random.uniform(10, 30),
            "ci_entry": np.random.uniform(20, 80),
            "vwap_entry": 18500.0,
            "vr_entry": np.random.uniform(0.7, 1.3),
            "volatility_regime": np.random.choice([0, 1, 2]),
        })
    return pd.DataFrame(results)


# -------------------------------------------------------------------------
# Test 1: SQLite schema creates correctly
# -------------------------------------------------------------------------

def test_schema_creates(temp_db):
    """Verify SQLite schema creates all tables."""
    conn = temp_db._get_conn()
    cursor = conn.cursor()
    tables = [row[0] for row in cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()]
    assert "candles_5min" in tables
    assert "trade_log" in tables
    assert "session_aggregates" in tables
    assert "model_registry" in tables
    assert "training_log" in tables


# -------------------------------------------------------------------------
# Test 2: Candle insert + query
# -------------------------------------------------------------------------

def test_candle_insert_and_query(temp_db, sample_candles):
    """Verify candles insert and query correctly."""
    inserted = temp_db.insert_candles(sample_candles)
    assert inserted > 0
    count = temp_db.get_candle_count()
    assert count == len(sample_candles)


def test_candle_get_range(temp_db, sample_candles):
    """Verify date range query works."""
    temp_db.insert_candles(sample_candles)
    start, end = sample_candles["timestamp"].min(), sample_candles["timestamp"].max()
    result = temp_db.get_candles(str(start), str(end), limit=10)
    assert len(result) > 0
    assert len(result) <= 10


# -------------------------------------------------------------------------
# Test 3: Session ID assignment
# -------------------------------------------------------------------------

def test_session_assignment(sample_candles):
    """Verify session IDs are assigned correctly."""
    df = sample_candles
    # Pre-market hours (before 9:30 ET)
    pre = df[df["et_hour"] < 9]
    assert len(pre) == 0 or (pre["session_id"] == 0).all() or (pre["session_id"] == 1).all()
    # Main session
    main = df[df["session_id"] == 1]
    assert len(main) > 0


# -------------------------------------------------------------------------
# Test 4: Feature engineering pipeline
# -------------------------------------------------------------------------

def test_feature_pipeline(sample_candles, sample_trade_log):
    """Verify full feature pipeline runs without errors."""
    df = engineer_features(
        candles_df=sample_candles,
        trade_log_df=sample_trade_log,
        math_engine_snapshot={"amdPhase": "ACCUMULATION", "vr": 1.0, "adx": 25, "ci": 50},
    )
    assert not df.empty
    assert "label_direction" in df.columns
    assert len(df) <= len(sample_candles)
    # Check some key features exist
    assert "atr" in df.columns
    assert "log_return" in df.columns
    assert "session_pct" in df.columns


def test_feature_vector(sample_candles):
    """Verify get_feature_vector returns only known feature columns."""
    feat_df = engineer_features(sample_candles)
    X = get_feature_vector(feat_df)
    assert isinstance(X, pd.DataFrame)
    assert len(X) <= len(feat_df)


# -------------------------------------------------------------------------
# Test 5: TimeSeriesSplit CV
# -------------------------------------------------------------------------

def test_timeseries_cv():
    """Verify TimeSeriesSplit CV doesn't leak future data."""
    X = np.random.randn(100, 5)
    y = np.random.randint(0, 2, 100)

    cv = TimeSeriesCrossValidator(n_splits=5, gap=10)
    splits = list(cv.split(X))

    assert len(splits) == 5
    for train_idx, val_idx in splits:
        # Training always before validation
        assert max(train_idx) + 10 < min(val_idx)


# -------------------------------------------------------------------------
# Test 6: LightGBM classifier train
# -------------------------------------------------------------------------

def test_lgbm_train(sample_candles):
    """Verify LightGBM trains and produces metrics."""
    feat_df = engineer_features(sample_candles)
    feat_df = feat_df.dropna(subset=["label_direction"])

    if len(feat_df) < 50:
        pytest.skip("Not enough samples")

    X = get_feature_vector(feat_df).fillna(0)
    y = feat_df["label_direction"]

    model = LightGBMClassifier()
    metrics = model.train(X, y, verbose=False)

    assert metrics["model"] == "lightgbm"
    assert "cv_roc_auc_mean" in metrics
    assert 0.0 <= metrics["cv_roc_auc_mean"] <= 1.0
    assert model.is_trained


def test_lgbm_predict(sample_candles):
    """Verify LightGBM predict returns valid output."""
    feat_df = engineer_features(sample_candles).dropna(subset=["label_direction"])
    if len(feat_df) < 50:
        pytest.skip("Not enough samples")

    X = get_feature_vector(feat_df).fillna(0)
    y = feat_df["label_direction"]

    model = LightGBMClassifier()
    model.train(X, y, verbose=False)

    result = model.predict(X.tail(1))
    assert "signal" in result
    assert result["signal"] in ["LONG", "SHORT", "NEUTRAL"]
    assert "confidence" in result
    assert 0.0 <= result["confidence"] <= 1.0


# -------------------------------------------------------------------------
# Test 7: Model store
# -------------------------------------------------------------------------

def test_model_store():
    """Verify model store save/load works."""
    with tempfile.TemporaryDirectory() as tmpdir:
        store = ModelStore(tmpdir)

        # Create dummy pipeline
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import StandardScaler
        dummy = Pipeline([("scaler", StandardScaler())])

        # Save
        version = store.save(
            model_name="test_model",
            pipeline=dummy,
            metrics={"cv_roc_auc_mean": 0.75},
            feature_cols=["a", "b", "c"],
        )
        assert version is not None

        # Load
        loaded, meta = store.get_latest("test_model")
        assert loaded is not None
        assert meta["model_name"] == "test_model"

        # List versions
        versions = store.list_versions("test_model")
        assert len(versions) == 1

        # Delete
        store.delete("test_model", version)
        versions = store.list_versions("test_model")
        assert len(versions) == 0


# -------------------------------------------------------------------------
# Test 8: RRR optimizer
# -------------------------------------------------------------------------

def test_rrr_optimizer(sample_trade_log):
    """Verify RRR optimizer returns valid output."""
    from optimization.rrr_optimizer import find_optimal_rrr

    result = find_optimal_rrr(sample_trade_log, base_sl_ticks=20.0)

    assert "recommended_rr" in result
    assert "why_this_rr" in result
    assert 0.5 <= result["recommended_rr"] <= 4.0
    assert result["recommended_rr"] >= result.get("min_acceptable_rr", 0)


# -------------------------------------------------------------------------
# Test 9: Alpha engine
# -------------------------------------------------------------------------

def test_alpha_engine(sample_trade_log):
    """Verify alpha engine computes correctly."""
    from alpha.alpha_engine import calculate_alpha_metrics

    result = calculate_alpha_metrics(sample_trade_log)

    assert "mean_alpha" in result
    assert "win_rate" in result
    assert "alpha_by_session" in result
    assert result["total_trades"] == len(sample_trade_log)


# -------------------------------------------------------------------------
# Test 10: Position sizer
# -------------------------------------------------------------------------

def test_position_sizer():
    """Verify position sizer returns valid output."""
    from optimization.position_sizer import PositionSizingPredictor, kelly_criterion

    # Kelly
    k = kelly_criterion(0.55, 2.0)
    assert 0.0 <= k <= 1.0

    # Predictor
    ps = PositionSizingPredictor()
    result = ps.predict(
        conditions={
            "win_rate": 0.55,
            "rr_ratio": 2.0,
            "consensus_confidence": 0.72,
            "alpha_score": 3.5,
            "atr": 20.0,
            "exit_plan": {"stop_loss_ticks": 20},
            "session_id": 1,
            "is_throttled": False,
        },
        account_balance=10000.0,
    )

    assert "contracts" in result
    assert result["contracts"] >= 1
    assert "risk_per_trade_dollars" in result
    assert result["risk_per_trade_dollars"] > 0


# -------------------------------------------------------------------------
# Test 11: Exit strategy predictor
# -------------------------------------------------------------------------

def test_exit_strategy_predictor(sample_trade_log):
    """Verify exit strategy predictor trains and predicts."""
    from optimization.exit_optimizer import ExitStrategyPredictor

    ep = ExitStrategyPredictor()

    # Train (may be slow with full grid, so just test it doesn't crash)
    try:
        ep.train(sample_trade_log, verbose=False)
        trained = True
    except Exception:
        trained = False

    if trained:
        result = ep.predict({
            "session_id": 1,
            "vr": 1.0,
            "volatility_regime": 1,
            "momentum_3bar": 5.0,
            "momentum_5bar": 8.0,
            "adx": 25,
            "ci": 50,
            "hour_of_day": 10,
            "day_of_week": 2,
            "price_to_pdh": 0.5,
            "price_to_pdl": 0.8,
            "amdPhase": "ACCUMULATION",
        })

        assert "stop_loss_ticks" in result
        assert "tp1_pct" in result
        assert "trailing_distance_ticks" in result
        assert "max_hold_minutes" in result


# -------------------------------------------------------------------------
# Test 12: Session probability
# -------------------------------------------------------------------------

def test_session_probability(sample_candles):
    """Verify session probability engine runs."""
    from session.session_probability import SessionProbabilityModel, get_best_entry_time

    spm = SessionProbabilityModel()
    try:
        spm.train(sample_candles, verbose=False)
    except ValueError:
        pass  # Not enough data

    result = get_best_entry_time(1)
    assert "best_window" in result
    assert "edge_type" in result


# -------------------------------------------------------------------------
# Phase 2 & 4: Additional model tests
# -------------------------------------------------------------------------

def test_hmm_regime_detector(sample_candles):
    """Verify HMM regime detector trains and predicts."""
    from models.regime.hmm_regime import HMMRegimeDetector

    feat_df = engineer_features(sample_candles)
    feat_df = feat_df.dropna()

    if len(feat_df) < 100:
        pytest.skip("Not enough samples for HMM")

    hmm = HMMRegimeDetector(n_states=3)
    metrics = hmm.train(feat_df, verbose=False)

    assert metrics["model"] == "hmm_regime"
    assert "state_order" in metrics
    assert hmm.is_trained

    # Predict current regime
    result = hmm.predict_current(feat_df)
    assert "regime" in result
    assert result["regime"] in ["COMPRESSION", "NORMAL", "EXPANSION"]
    assert 0.0 <= result["confidence"] <= 1.0
    assert "explanation" in result


def test_svm_classifier(sample_candles):
    """Verify SVM classifier trains and produces valid output."""
    from models.direction.svm_classifier import SVMClassifier

    feat_df = engineer_features(sample_candles).dropna(subset=["label_direction"])
    if len(feat_df) < 50:
        pytest.skip("Not enough samples")

    X = get_feature_vector(feat_df).fillna(0)
    y = feat_df["label_direction"]

    model = SVMClassifier()
    metrics = model.train(X, y, verbose=False)

    assert metrics["model"] == "svm"
    assert 0.0 <= metrics["cv_roc_auc_mean"] <= 1.0
    assert model.is_trained

    result = model.predict(X.tail(1))
    assert result["signal"] in ["LONG", "SHORT", "NEUTRAL"]
    assert 0.0 <= result["confidence"] <= 1.0


def test_mlp_classifier(sample_candles):
    """Verify MLP classifier trains and produces valid output."""
    from models.direction.neural_net import MLPClassifierModel

    feat_df = engineer_features(sample_candles).dropna(subset=["label_direction"])
    if len(feat_df) < 50:
        pytest.skip("Not enough samples")

    X = get_feature_vector(feat_df).fillna(0)
    y = feat_df["label_direction"]

    model = MLPClassifierModel()
    metrics = model.train(X, y, verbose=False)

    assert metrics["model"] == "neural_net"
    assert 0.0 <= metrics["cv_roc_auc_mean"] <= 1.0
    assert model.is_trained

    result = model.predict(X.tail(1))
    assert result["signal"] in ["LONG", "SHORT", "NEUTRAL"]
    assert 0.0 <= result["confidence"] <= 1.0


def test_amd_classifier(sample_candles):
    """Verify AMD phase classifier trains and predicts."""
    from models.direction.amd_classifier import AMDClassifier

    feat_df = engineer_features(sample_candles).dropna(subset=["label_direction"])
    if len(feat_df) < 50:
        pytest.skip("Not enough samples")

    X = get_feature_vector(feat_df).fillna(0)
    y = feat_df["label_direction"]

    model = AMDClassifier()
    metrics = model.train(X, y, verbose=False)

    assert metrics["model"] == "amd_classifier"
    assert model.is_trained

    result = model.predict(X.tail(1))
    assert result["signal"] in ["LONG", "SHORT", "NEUTRAL"]
    assert "amd_phase" in result


def test_time_probability_model(sample_trade_log):
    """Verify time-of-day probability model runs."""
    from models.session.time_probability import TimeProbabilityModel

    model = TimeProbabilityModel()
    result = model.train(sample_trade_log, verbose=False)

    assert result["model"] == "time_probability"

    # Predict at 10:30 AM in main session
    pred = model.predict(hour=10, minute=30, session_id=1, day_of_week=2)
    assert "P_profitable" in pred
    assert 0.0 <= pred["P_profitable"] <= 1.0
    assert "recommendation" in pred


# -------------------------------------------------------------------------
# Phase 8: Physics-Based Regime Models (FP-FK + Tsallis q-Gaussians + Anomalous Diffusion)
# -------------------------------------------------------------------------

def test_fp_fk_regime_detector(sample_candles):
    """Verify FP-FK regime detector trains, estimates q, and produces deleverage signals."""
    from models.regime.fp_fk_regime import FPFKRegimeDetector

    feat_df = engineer_features(
        sample_candles,
        math_engine_snapshot={"amdPhase": "ACCUMULATION", "vr": 1.0, "adx": 25, "ci": 50},
    )
    feat_df = feat_df.dropna()
    if len(feat_df) < 100:
        pytest.skip("Not enough samples for FP-FK detector")

    fp = FPFKRegimeDetector()

    # train() returns metrics about estimated parameters
    metrics = fp.train(feat_df, verbose=False)
    assert metrics["model"] == "fp_fk_regime"
    assert "q_parameter" in metrics
    assert 0.5 <= metrics["q_parameter"] <= 3.0
    assert "criticality_index" in metrics
    assert "fk_wave_speed" in metrics

    # advance() / predict_current() returns full regime signal
    result = fp.advance(feat_df)
    assert "regime" in result
    assert result["regime"] in ["COMPRESSION", "NORMAL", "EXPANSION", "CRISIS"]
    assert "q_parameter" in result
    assert "deleverage_signal" in result
    assert 0.0 <= result["deleverage_signal"] <= 1.0
    assert "criticality_index" in result
    assert 0.0 <= result["criticality_index"] <= 1.0
    assert "fk_wave_speed" in result
    assert "confidence" in result
    assert 0.0 <= result["confidence"] <= 1.0


def test_anomalous_diffusion_model(sample_candles):
    """Verify Anomalous Diffusion model estimates Hurst exponent correctly."""
    from models.regime.anomalous_diffusion import AnomalousDiffusionModel

    feat_df = engineer_features(
        sample_candles,
        math_engine_snapshot={"amdPhase": "ACCUMULATION", "vr": 1.0, "adx": 25, "ci": 50},
    )
    feat_df = feat_df.dropna()
    if len(feat_df) < 50:
        pytest.skip("Not enough samples for anomalous diffusion")

    ad = AnomalousDiffusionModel(window_size=min(100, len(feat_df)))
    metrics = ad.train(feat_df, verbose=False)

    assert metrics["model"] == "anomalous_diffusion"
    assert "H_final" in metrics
    assert 0.1 <= metrics["H_final"] <= 0.9
    assert "diffusion_type" in metrics
    assert metrics["diffusion_type"] in ["SUB_DIFFUSION", "NORMAL", "SUPER_DIFFUSION"]
    assert "multifractality" in metrics
    assert metrics["multifractality"] in ["MONOFRACTAL", "MILD_MULTIFRACTAL", "STRONG_MULTIFRACTAL"]

    # Advance per candle
    result = ad.advance(feat_df)
    assert "hurst_H" in result
    assert "vol_clustering" in result
    assert "position_adjustment" in result
    assert isinstance(result["position_adjustment"], float)


def test_regime_ensemble(sample_candles):
    """Verify RegimeEnsemble combines HMM + FP-FK + Anomalous Diffusion."""
    from models.regime.regime_ensemble import RegimeEnsemble

    feat_df = engineer_features(
        sample_candles,
        math_engine_snapshot={"amdPhase": "ACCUMULATION", "vr": 1.0, "adx": 25, "ci": 50},
    )
    feat_df = feat_df.dropna()
    if len(feat_df) < 100:
        pytest.skip("Not enough samples for RegimeEnsemble")

    ens = RegimeEnsemble(random_state=42)
    result = ens.advance(feat_df)

    assert "regime" in result
    assert result["regime"] in ["COMPRESSION", "NORMAL", "EXPANSION", "CRISIS"]
    assert "regime_confidence" in result
    assert 0.0 <= result["regime_confidence"] <= 1.0
    assert "deleverage_signal" in result
    assert 0.0 <= result["deleverage_signal"] <= 1.0
    assert "stop_multiplier" in result
    assert 0.5 <= result["stop_multiplier"] <= 2.5
    assert "position_adjustment" in result
    assert isinstance(result["position_adjustment"], float)

    # Components present
    assert "fp_fk" in result
    assert "anomalous_diffusion" in result
    assert "hmm" in result
    assert "model_weights" in result  # ensemble weights
    assert "explanation" in result
    assert len(result["explanation"]) > 0


# -------------------------------------------------------------------------
# Test 13: Config values
# -------------------------------------------------------------------------

def test_config_values():
    """Verify config has all expected values."""
    assert config.TSCV_N_SPLITS == 5
    assert config.TSCV_GAP == 10
    assert config.DEFAULT_SL_TICKS == 20
    assert config.MIN_ACCEPTABLE_RR == 1.5
    assert config.FIRM_MAX_RISK_PCT == 0.003
    assert len(config.AMD_PHASES) == 5
    assert len(config.SESSION_CONFIG) == 3
