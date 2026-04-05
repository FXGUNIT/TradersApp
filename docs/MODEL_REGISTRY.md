# TradersApp Model Registry

**Last Updated:** 2026-04-06
**Owner:** ML Engine Team
**Registry Location:** `ml-engine/models/store/`
**ONNX Export Location:** `ml-engine/models/onnx/`
**Triton Model Repo:** `ml-engine/models/triton_repo/`

---

## Overview

TradersApp uses **13 model families** across 5 model tiers for consensus-driven trading signals.

| Tier | Model Family | Purpose | Serving Path |
|------|-------------|---------|-------------|
| 1 | Direction (6 models) | LONG/SHORT/NEUTRAL classification | Triton ONNX |
| 2 | Magnitude | Tick-level move size estimation | Triton Python |
| 3 | Session Probability | Time-of-day profitability scoring | Triton Python |
| 4 | Regime (3 + ensemble) | Market regime classification | Triton Python |
| 5 | Mamba SSM | Sequence-aware alpha scoring | TorchScript / vLLM |

---

## Model Catalog

### Tier 1 — Direction Models (6 models)

All direction models output: `{signal, probability_long, probability_short, confidence, reason}`

#### 1. LightGBM Direction Classifier — PRIMARY
| Property | Value |
|----------|-------|
| File | `ml-engine/models/direction/lightgbm_classifier.py` |
| Class | `LightGBMClassifier` |
| Framework | `lightgbm` + `CalibratedClassifierCV` (isotonic, cv=5) |
| Input | 44-feature DataFrame (see Feature Catalog) |
| Output | `signal` (LONG/SHORT/NEUTRAL), probabilities, confidence |
| Calibration | Isotonic regression (5-fold CV) |
| Training | TimeSeriesSplit (5 splits, gap=10) |
| **SLA** | P95 inference < 50ms |
| **Serving** | Triton ONNX (`lightgbm_direction/`) |
| ONNX Export | `ml-engine/inference/onnx_exporter.py::export_lightgbm()` |
| Quantization | FP16 (NVIDIA TensorRT), INT8 (CPU fallback) |
| Instances (GPU) | 2 (parallel batching) |
| Max Batch Size | 64 |
| Dynamic Batching | Preferred [1, 8, 16, 32, 64], max_queue_delay 5ms |

#### 2. XGBoost Direction Classifier — SECONDARY
| Property | Value |
|----------|-------|
| File | `ml-engine/models/direction/xgboost_classifier.py` |
| Class | `XGBoostClassifier` |
| Framework | `xgboost.XGBClassifier` + `CalibratedClassifierCV` (isotonic, cv=5) |
| Input | 44-feature DataFrame |
| Output | `signal`, probabilities, confidence |
| Calibration | Isotonic regression (5-fold CV) |
| Training | TimeSeriesSplit (5 splits, gap=10) |
| **SLA** | P95 inference < 50ms |
| **Serving** | Triton ONNX (`xgboost_direction/`) |
| Quantization | FP16 |

#### 3. Random Forest — ENSEMBLE MEMBER
| Property | Value |
|----------|-------|
| File | `ml-engine/models/direction/random_forest.py` |
| Class | `RandomForestClassifierModel` |
| Framework | `sklearn.ensemble.RandomForestClassifier` + `CalibratedClassifierCV` (sigmoid, cv=5) |
| Input | 44-feature DataFrame |
| **SLA** | P95 inference < 100ms |
| **Serving** | Triton ONNX (`rf_direction/`) |
| Quantization | FP16 |

#### 4. SVM Classifier — ENSEMBLE MEMBER
| Property | Value |
|----------|-------|
| File | `ml-engine/models/direction/svm_classifier.py` |
| Class | `SVMClassifier` |
| Framework | `sklearn.svm.SVC` (RBF kernel, balanced) + `CalibratedClassifierCV` (sigmoid, cv=5) |
| Input | 44-feature DataFrame |
| **SLA** | P95 inference < 100ms |
| **Serving** | Triton ONNX (`svm_direction/`) |
| Quantization | FP16 |

#### 5. MLP Neural Net — ENSEMBLE MEMBER
| Property | Value |
|----------|-------|
| File | `ml-engine/models/direction/neural_net.py` |
| Class | `MLPClassifierModel` |
| Framework | `sklearn.neural_network.MLPClassifier` (64, 32 hidden, ReLU, Adam, early_stopping) |
| Input | 44-feature DataFrame |
| **SLA** | P95 inference < 100ms |
| **Serving** | Triton ONNX (`mlp_direction/`) |
| Quantization | FP16 |

#### 6. AMD Classifier — ENSEMBLE MEMBER (Bayesian Phase Prior)
| Property | Value |
|----------|-------|
| File | `ml-engine/models/direction/amd_classifier.py` |
| Class | `AMDClassifier` |
| Framework | `sklearn.naive_bayes.GaussianNB` + `StandardScaler` |
| Input | 44-feature DataFrame + trade_log for win rate priors |
| Special | Blends GNB output (70%) with AMD historical win rate (30%) |
| Output | `{signal, probability_long, probability_short, confidence, reason, amd_phase, amd_win_rate}` |
| **SLA** | P95 inference < 30ms (simple NB model) |
| **Serving** | Triton ONNX (`amd_direction/`) — **TODO: config.pbtxt needed** |
| Quantization | FP16 |
| ONNX Export | Generic sklearn path (`onnxmltools.convert_lightgbm`) |

---

### Tier 2 — Magnitude Model

#### 7. Move Magnitude Quantile Regressor
| Property | Value |
|----------|-------|
| File | `ml-engine/models/magnitude/move_magnitude.py` |
| Class | `MoveMagnitudeModel` |
| Framework | `lightgbm.LGBMRegressor` (quantile objective) — **3 models per horizon** |
| Horizons | 1, 3, 5, 10 candles |
| Quantiles | 25th (conservative), 50th (expected), 75th (aggressive) |
| Input | Feature DataFrame + raw candle DataFrame |
| Output | `{tp1_ticks, tp2_ticks, tp3_ticks, horizons: {...conservative/expected/aggressive...}}` |
| Training | Same TimeSeriesSplit as direction models |
| **SLA** | P95 inference < 100ms |
| **Serving** | Triton Python backend (`move_magnitude/1/model.py`) |
| ONNX | Not supported (custom quantile per horizon) |

**Note:** This is 4 horizons × 3 quantiles = 12 separate models compiled into one Python backend.

---

### Tier 3 — Session Probability Model

#### 8. Time Probability Model
| Property | Value |
|----------|-------|
| File | `ml-engine/models/session/time_probability.py` |
| Class | `TimeProbabilityModel` |
| Framework | `lightgbm.LGBMClassifier` + `CalibratedClassifierCV` (isotonic, cv=5) + `StandardScaler` |
| Input | Time features only: `{hour, minute, session_id, day_of_week}` |
| Output | `{P_profitable, confidence, bucket_win_rate, session_win_rate, best_buckets, recommendation}` |
| Blending | ML (50%) + bucket WR (30%) + session WR (20%) |
| Time Features | hour, minute, 5-min bucket, 15-min bucket, day_of_week, session_id, minutes_into_session |
| **SLA** | P95 inference < 30ms (simple feature set) |
| **Serving** | Triton Python backend (`time_probability/1/model.py`) |

---

### Tier 4 — Regime Models (3 + ensemble)

#### 9. HMM Regime Detector
| Property | Value |
|----------|-------|
| File | `ml-engine/models/regime/hmm_regime.py` |
| Class | `HMMRegimeDetector` |
| Framework | `hmmlearn.hmm.GaussianHMM` (3 states) |
| Features | `[VR, ADX, ATR_pct]` |
| States | COMPRESSION (0), NORMAL (1), EXPANSION (2) — sorted by VR mean |
| Covariance | Full (or diag) — auto-selected by BIC |
| Training | Batch on full historical DataFrame |
| Inference | `predict_current(df)` → canonical state index |
| Output | `{regime, regime_id, confidence, current_vr, current_adx, previous_regime, transition_prob, posterior_probs, explanation}` |
| Metrics | Log-likelihood, BIC, AIC, transition matrix |
| **SLA** | P95 inference < 200ms (HMM is fast) |
| **Serving** | Triton Python backend (via `regime_ensemble/1/model.py`) |
| GPU Benefit | None — runs on CPU |

#### 10. FPKK Regime Detector (Fokker-Planck + Fisher-KPP PDE)
| Property | Value |
|----------|-------|
| File | `ml-engine/models/regime/fp_fk_regime.py` |
| Class | `FPFKRegimeDetector` |
| Framework | Pure `numpy` + `scipy` (Crank-Nicolson PDE solver) |
| Algorithm | 2D PDE on 40×40 VR/ADX grid with Fisher-KPP reaction-diffusion |
| Parameters | Tsallis q-parameter, diffusion exponent, drift fields |
| Training | Online (advance per candle) |
| Inference | `advance(df)` → `{regime_id, q_parameter, q_regime, diffusion_exponent, wave_speed, wave_acceleration, criticality_index, deleverage_signal, deleverage_reason}` |
| Output Fields | 18 fields including posterior_probs, drift_vr, drift_adx, diffusion_coeff, reaction_rate, entropy_rate |
| **SLA** | P95 inference < 500ms (PDE is computationally intensive) |
| **Serving** | Triton Python backend (via `regime_ensemble/1/model.py`) |
| GPU Benefit | Moderate — NumPy/GaussSeidel benefits from vectorization |

#### 11. Anomalous Diffusion Model
| Property | Value |
|----------|-------|
| File | `ml-engine/models/regime/anomalous_diffusion.py` |
| Class | `AnomalousDiffusionModel` |
| Framework | Pure `numpy` (DFA, Variance Ratio, Generalized Hurst Exponent) |
| Methods | DFA (50%), VR (30%), GHE (20%) — weighted average |
| Output | `{hurst_H, H_dfa, H_vr, H_ghe, diffusion_type, multifractality, H_slope, H_trend, vol_clustering, position_adjustment, implication}` |
| Inference | `advance(df)` → incremental return series update |
| **SLA** | P95 inference < 200ms |
| **Serving** | Triton Python backend (via `regime_ensemble/1/model.py`) |

#### 12. Regime Ensemble
| Property | Value |
|----------|-------|
| File | `ml-engine/models/regime/regime_ensemble.py` |
| Class | `RegimeEnsemble` |
| Wraps | HMMRegimeDetector + FPFKRegimeDetector + AnomalousDiffusionModel |
| Output | Unified `{regime, regime_id, regime_confidence, fp_fk, hmm, anomalous_diffusion, deleverage_signal, signal_adjustment, stop_multiplier, explanation}` |
| Deleverage Signal | Reduces position size when COMPRESSION regime detected |
| Stop Multiplier | Adjusted per regime: EXPANSION=1.5, NORMAL=1.0, COMPRESSION=0.75 |
| **SLA** | P95 inference < 1000ms (sum of all 3 models) |
| **Serving** | Triton Python backend (`regime_ensemble/1/model.py`) |

---

### Tier 5 — Mamba Sequence Model

#### 13. Mamba SSM Trading Model
| Property | Value |
|----------|-------|
| File | `ml-engine/models/mamba/mamba_sequence_model.py` |
| Class | `MambaTradingModel` |
| Framework | `torch` + `transformers` (HuggingFace `AutoModelForCausalLM`) |
| Model Sizes | `mamba-130m`, `mamba-370m`, `mamba-790m`, `mamba-1.4b`, `mamba-2.8b` |
| Input | Candle sequence (OHLCV array) + task specification |
| Output | `{signal, confidence, probability_long, expected_move_ticks, regime_probs, predicted_regime, alpha_score, pattern_type, reasoning}` |
| Fine-tuning | EWC (Elastic Weight Consolidation) + LoRA-style adaptation |
| Continual Learning | Fisher Information matrix computed per model hash |
| **SLA** | P95 inference < 5000ms (generative model — latency budget higher) |
| **Serving** | TorchScript export + Triton Python backend OR vLLM (for larger sizes) |
| ONNX Export | **TODO: TorchScript export needed** |
| Memory | ~6GB for mamba-2.8b at FP16 |

**Serving Options:**
- `mamba-130m` through `mamba-790m`: Triton Python backend with TorchScript
- `mamba-1.4b` and above: vLLM for efficient batching and KV cache

---

## Consensus Aggregation

The consensus signal is produced by `ml-engine/inference/consensus_aggregator.py`:

```
Input:  6 direction votes + magnitude + session probability + regime
Method: Confidence-weighted voting with regime-adjusted confidence
Output: {signal, confidence, votes, alpha, expected_move, rrr, exit_plan, position_sizing}
```

Consensus weights (configurable via `config.py`):
- LightGBM: 0.35 (primary)
- XGBoost: 0.25 (secondary)
- RF: 0.15
- SVM: 0.10
- MLP: 0.10
- AMD: 0.05

---

## ONNX Export Pipeline

Export all models:
```bash
python -m ml_engine.inference.onnx_exporter --all
```

Export with quantization:
```bash
python -m ml_engine.inference.onnx_exporter --model lightgbm_direction --quantize fp16
python -m ml_engine.inference.onnx_exporter --model xgboost_direction --quantize fp16
python -m ml_engine.inference.onnx_exporter --all --quantize fp16
```

List available models:
```bash
python -m ml_engine.inference.onnx_exporter --list
```

Quantization options:
- `fp16`: Half-precision float — 2x throughput, minimal accuracy loss
- `int8`: 8-bit integer — 4x throughput, needs calibration dataset
- `qdq`: Quantization-Dequantization — for ONNX Runtime auto-tuning

---

## Triton Model Repository Structure

```
ml-engine/models/triton_repo/
├── lightgbm_direction/
│   ├── config.pbtxt         # ONNX Runtime, 2 GPU instances, batch 64
│   └── 1/
│       └── model.onnx       # Exported from onnx_exporter.py
├── xgboost_direction/
│   ├── config.pbtxt
│   └── 1/model.onnx
├── rf_direction/
│   ├── config.pbtxt
│   └── 1/model.onnx
├── svm_direction/
│   ├── config.pbtxt
│   └── 1/model.onnx
├── mlp_direction/
│   ├── config.pbtxt
│   └── 1/model.onnx
├── amd_direction/           # TODO: config.pbtxt + ONNX model needed
│   └── 1/model.onnx
├── regime_ensemble/
│   ├── config.pbtxt         # Python backend, batch 32, CPU
│   └── 1/model.py           # Lazy-loads RegimeEnsemble on first request
├── time_probability/
│   ├── config.pbtxt         # Python backend, batch 64, CPU
│   └── 1/model.py
└── move_magnitude/
    ├── config.pbtxt         # Python backend, batch 64, CPU
    └── 1/model.py
```

---

## Hardware Requirements

| Model | CPU/GPU | Memory | Latency Target |
|-------|---------|--------|---------------|
| LightGBM | GPU (T4/A10) | 2GB VRAM | < 50ms P95 |
| XGBoost | GPU (T4/A10) | 2GB VRAM | < 50ms P95 |
| RandomForest | GPU (T4/A10) | 2GB VRAM | < 100ms P95 |
| SVM | GPU (T4/A10) | 2GB VRAM | < 100ms P95 |
| MLP | GPU (T4/A10) | 2GB VRAM | < 100ms P95 |
| AMD | GPU (T4/A10) | 1GB VRAM | < 30ms P95 |
| TimeProbability | CPU | 512MB | < 30ms P95 |
| RegimeEnsemble | CPU | 4GB | < 1000ms P95 |
| MoveMagnitude | CPU | 2GB | < 100ms P95 |
| Mamba-130m | GPU (T4) | 4GB VRAM | < 2000ms P95 |
| Mamba-790m | GPU (A10) | 8GB VRAM | < 3000ms P95 |
| Mamba-2.8b | GPU (A100) | 16GB VRAM | < 5000ms P95 |

---

## Versioning & Promotion

Every training run produces a new model version tagged with:
- `dvc_commit`: Git hash of the DVC-pinned data state
- `train_timestamp`: ISO8601 timestamp of training
- `cv_roc_auc`: Cross-validated ROC-AUC score
- `cv_accuracy`: Cross-validated accuracy

Promotion pipeline (via `ml-engine/infrastructure/evaluation.py`):
1. Train produces new model version in `models/store/`
2. MLflow logs all metrics and artifacts
3. `auto_register_if_passing()` → registers as **Staging** if:
   - PBO (probability of backtest overfitting) < 5%
   - Sharpe ≥ 0.5
   - Win rate ≥ 50%
4. Human review → promotes **Staging → Production**
5. `archive_stale_models()` → auto-archives Production models older than 7 days

---

## Monitoring

Key Prometheus metrics per model:

| Metric | Type | Description |
|--------|------|-------------|
| `ml_model_inference_latency_ms` | Histogram | Per-model inference latency |
| `ml_model_requests_total` | Counter | Total inference requests |
| `ml_model_errors_total` | Counter | Inference errors |
| `ml_model_predictions_total` | Counter | Predictions by signal type |
| `ml_circuit_breaker_state` | Gauge | Circuit breaker state (0=closed, 1=half-open, 2=open) |

Alert thresholds:
- P95 latency > 150ms → Warning
- P95 latency > 200ms → Critical
- Error rate > 1% → Warning
- Error rate > 5% → Critical
