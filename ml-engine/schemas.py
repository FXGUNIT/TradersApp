"""
ML Engine — Pydantic Request/Response Models
Extracted from main.py (Rule #3 hard limit: Python ≤600 lines)
"""
from pydantic import BaseModel, Field
from typing import Optional


class TrainRequest(BaseModel):
    mode: str = Field(default="full", pattern="^(full|incremental)$")
    symbol: str = Field(default="MNQ")
    min_trades: int = Field(default=100, ge=50, le=10000)


class PredictRequest(BaseModel):
    symbol: str = Field(default="MNQ")
    session_id: int = Field(default=1, ge=0, le=2)
    math_engine_snapshot: Optional[dict] = Field(default=None)
    key_levels: Optional[dict] = Field(default=None)
    candles: list[dict] = Field(default_factory=list)
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
    source_uid: Optional[str] = Field(default=None)
    source_role: Optional[str] = Field(default=None)
    days_used: Optional[int] = Field(default=None, ge=0)
    source_days_used: Optional[int] = Field(default=None, ge=0)
    is_training_eligible: Optional[bool] = Field(default=None)


# ── Backtest / PBO ────────────────────────────────────────────────────────────

class PBOBacktestRequest(BaseModel):
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
    strategy_name: str = Field(default="momentum")
    symbol: str = Field(default="MNQ")
    strategy_type: str = Field(default="momentum", pattern="^(momentum|mean_reversion|regime_switching)$")
    n_simulations: int = Field(default=1000, ge=100, le=5000)
    n_trials: int = Field(default=50, ge=10, le=200)
    block_size: int = Field(default=20, ge=5, le=100)
    min_trades: int = Field(default=100, ge=20)


class FullPBOBacktestRequest(BaseModel):
    strategy_name: str = Field(default="momentum")
    symbol: str = Field(default="MNQ")
    strategy_type: str = Field(default="momentum", pattern="^(momentum|mean_reversion|regime_switching)$")
    lookback: list[int] = Field(default_factory=lambda: [5, 10, 20, 30, 50])
    threshold: list[float] = Field(default_factory=lambda: [0.005, 0.01, 0.015, 0.02])
    n_trials: int = Field(default=100, ge=20, le=500)
    n_simulations: int = Field(default=1000, ge=100, le=5000)
    min_trades: int = Field(default=100, ge=20)


class AutotuneRequest(BaseModel):
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
    symbol: str = Field(default="MNQ")
    trades: list[TradeInput]
    returns_override: list[float] | None = Field(default=None)


# ── Drift detection ──────────────────────────────────────────────────────────

class RecordPredictionRequest(BaseModel):
    correct: bool
    confidence: float = Field(ge=0.0, le=1.0)
    model_name: str = Field(default="ensemble")


class DriftDetectRequest(BaseModel):
    symbol: str = Field(default="MNQ")
    candles: list[dict] = Field(default_factory=list)
    trades: list[dict] = Field(default_factory=list)
    current_regime: str | None = Field(default=None)
    regime_confidence: float = Field(default=1.0, ge=0.0, le=1.0)


# ── News / breaking events ─────────────────────────────────────────────────────

class BreakingNewsRequest(BaseModel):
    news: dict = Field(...)
    trigger_type: str = Field(default="breaking_news_high_impact")
    candle_snapshot: Optional[dict] = Field(default=None)


class NewsReactionRequest(BaseModel):
    news_id: str
    reaction_5m: Optional[float] = None
    reaction_15m: Optional[float] = None
    reaction_30m: Optional[float] = None
    reaction_60m: Optional[float] = None
    direction: Optional[str] = None
    magnitude: Optional[float] = None


# ── Regime / physics ──────────────────────────────────────────────────────────

class RegimeRequest(BaseModel):
    symbol: str = Field(default="MNQ")
    candles: list[dict] = Field(default_factory=list)


# ── Mamba SSM ─────────────────────────────────────────────────────────────────

class MambaRequest(BaseModel):
    symbol: str = Field(default="MNQ")
    candles: list[dict] = Field(default_factory=list)
    model_size: str = Field(default="mamba-790m")
    task: str = Field(default="full")


# ── PSO Alpha Discovery ──────────────────────────────────────────────────────

class PSORequest(BaseModel):
    symbol: str = Field(default="MNQ")
    candles: list[dict] = Field(default_factory=list)
    n_particles: int = Field(default=40, ge=10, le=200)
    max_iterations: int = Field(default=150, ge=10, le=500)
    regime: str = Field(default="ALL")


# ── Feedback loop ────────────────────────────────────────────────────────────

class FeedbackSignalRequest(BaseModel):
    signal: str = Field(...)
    confidence: float = Field(..., ge=0.0, le=1.0)
    votes: dict = Field(default_factory=dict)
    consensus: dict = Field(default_factory=dict)
    regime: str | None = None
    regime_confidence: float | None = None
    market_regime: str | None = None
    session_phase: str | None = None
    symbol: str = Field(default="MNQ")
    session_id: int = Field(default=1)
    request_id: str | None = None


class FeedbackRetrainRequest(BaseModel):
    trigger: str = Field(default="manual")
    symbol: str = Field(default="MNQ")
    training_mode: str = Field(default="incremental")
    auto_retrain_on_drift: bool = Field(default=True)


# ── Inference (Triton/ONNX) ──────────────────────────────────────────────────

class TritonInferenceRequest(BaseModel):
    features: list[list[float]] | list[dict]
    model_name: str = Field(default="lightgbm_direction")
    symbol: str = Field(default="MNQ")


# ── Cache ─────────────────────────────────────────────────────────────────────

class CacheInvalidateRequest(BaseModel):
    pattern: str | None = Field(default=None)
    endpoint: str | None = Field(default=None)
