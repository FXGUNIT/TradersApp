"""Fix schemas.py — add schema_version and max_length constraints"""
import re

with open('e:/TradersApp/ml-engine/schemas.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Literal import
if 'from typing import Optional' in content and 'Literal' not in content:
    content = content.replace(
        'from typing import Optional',
        'from typing import Optional, Literal'
    )

# 2. Add schema_version + max_length to each model
replacements = [
    # TrainRequest
    (
        'class TrainRequest(BaseModel):\n    mode:',
        'class TrainRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    mode:'
    ),
    # PredictRequest + max_length
    (
        'class PredictRequest(BaseModel):\n    symbol:',
        'class PredictRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    symbol:'
    ),
    (
        '    candles: list[dict] = Field(default_factory=list)\n    trades: list[dict] = Field(default_factory=list)',
        '    candles: list[dict] = Field(default_factory=list, max_length=5000)\n    trades: list[dict] = Field(default_factory=list, max_length=5000)'
    ),
    # UploadCandlesRequest
    (
        'class UploadCandlesRequest(BaseModel):\n    symbol:',
        'class UploadCandlesRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    symbol:'
    ),
    (
        '    candles: list[CandleInput]\n\n\nclass UploadTradesRequest',
        '    candles: list[CandleInput] = Field(max_length=10000)\n\n\nclass UploadTradesRequest'
    ),
    # UploadTradesRequest
    (
        'class UploadTradesRequest(BaseModel):\n    symbol:',
        'class UploadTradesRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    symbol:'
    ),
    (
        '    trades: list[TradeInput]\n    source_uid:',
        '    trades: list[TradeInput] = Field(max_length=10000)\n    source_uid:'
    ),
    # PBOBacktestRequest
    (
        'class PBOBacktestRequest(BaseModel):\n    strategy_name:',
        'class PBOBacktestRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    strategy_name:'
    ),
    (
        '    lookback: list[int] = Field(default_factory=lambda: [5, 10, 20, 30, 50])',
        '    lookback: list[int] = Field(default_factory=lambda: [5, 10, 20, 30, 50], max_length=50)'
    ),
    (
        '    threshold: list[float] = Field(default_factory=lambda: [0.005, 0.01, 0.015, 0.02])',
        '    threshold: list[float] = Field(default_factory=lambda: [0.005, 0.01, 0.015, 0.02], max_length=50)'
    ),
    # MCBacktestRequest
    (
        'class MCBacktestRequest(BaseModel):\n    strategy_name:',
        'class MCBacktestRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    strategy_name:'
    ),
    # FullPBOBacktestRequest
    (
        'class FullPBOBacktestRequest(BaseModel):\n    strategy_name:',
        'class FullPBOBacktestRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    strategy_name:'
    ),
    # AutotuneRequest
    (
        'class AutotuneRequest(BaseModel):\n    strategy_name:',
        'class AutotuneRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    strategy_name:'
    ),
    # BacktestTradesRequest
    (
        'class BacktestTradesRequest(BaseModel):\n    symbol:',
        'class BacktestTradesRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    symbol:'
    ),
    (
        '    returns_override: list[float] | None = Field(default=None)\n\n\n# ── Drift',
        '    returns_override: list[float] | None = Field(default=None, max_length=5000)\n\n\n# ── Drift'
    ),
    # DriftDetectRequest
    (
        'class DriftDetectRequest(BaseModel):\n    symbol:',
        'class DriftDetectRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    symbol:'
    ),
    (
        '    candles: list[dict] = Field(default_factory=list)\n    trades: list[dict] = Field(default_factory=list)\n    current_regime:',
        '    candles: list[dict] = Field(default_factory=list, max_length=5000)\n    trades: list[dict] = Field(default_factory=list, max_length=5000)\n    current_regime:'
    ),
    # RegimeRequest
    (
        'class RegimeRequest(BaseModel):\n    symbol:',
        'class RegimeRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    symbol:'
    ),
    (
        '    candles: list[dict] = Field(default_factory=list)\n\n\n# ── Mamba',
        '    candles: list[dict] = Field(default_factory=list, max_length=5000)\n\n\n# ── Mamba'
    ),
    # MambaRequest
    (
        'class MambaRequest(BaseModel):\n    symbol:',
        'class MambaRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    symbol:'
    ),
    (
        '    candles: list[dict] = Field(default_factory=list)\n    model_size:',
        '    candles: list[dict] = Field(default_factory=list, max_length=5000)\n    model_size:'
    ),
    # PSORequest
    (
        'class PSORequest(BaseModel):\n    symbol:',
        'class PSORequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    symbol:'
    ),
    (
        '    candles: list[dict] = Field(default_factory=list)\n    n_particles:',
        '    candles: list[dict] = Field(default_factory=list, max_length=5000)\n    n_particles:'
    ),
    # FeedbackSignalRequest
    (
        'class FeedbackSignalRequest(BaseModel):\n    signal:',
        'class FeedbackSignalRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    signal:'
    ),
    # FeedbackRetrainRequest
    (
        'class FeedbackRetrainRequest(BaseModel):\n    trigger:',
        'class FeedbackRetrainRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    trigger:'
    ),
    # TritonInferenceRequest
    (
        'class TritonInferenceRequest(BaseModel):\n    features:',
        'class TritonInferenceRequest(BaseModel):\n    schema_version: Literal["1.0"] = "1.0"\n    features:'
    ),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        print(f"  Applied: {old[:60]!r}")
    else:
        print(f"  MISSING: {old[:60]!r}")

with open('e:/TradersApp/ml-engine/schemas.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nVerification:")
with open('e:/TradersApp/ml-engine/schemas.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines):
    if 'schema_version' in l or 'max_length' in l:
        print(f"  {i+1}: {l.rstrip()}")
