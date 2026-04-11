# ADR-016: Unified Drift Detection with PSI, Win Rate, and HMM Regime Tracking

**ADR ID:** ADR-016
**Title:** Unified Drift Detection with PSI, Win Rate, and HMM Regime Tracking
**Status:** Accepted
**Date:** 2026-04-03
**Author:** FXGUNIT

## Context

The ML Engine trains models on historical data — but markets evolve. A model trained on 6 months of data may become stale as:
1. **Feature distributions change** — e.g., volatility regime shifts, volume patterns evolve
2. **Concept relationships shift** — e.g., what "bullish" means changes as market microstructure evolves
3. **Market regimes change** — e.g., transition from trending to mean-reversion conditions

Without drift detection, a degraded model silently produces bad signals. The system needs:
- Detection when feature distributions have shifted (PSI)
- Detection when prediction accuracy has dropped (rolling win rate)
- Detection when market regime has structurally changed (HMM posterior persistence)
- Automatic retraining triggers when drift exceeds thresholds

## Decision

Use a **three-detector unified approach** with a `DriftMonitor` orchestration class:

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DriftMonitor                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────┐                                      │
│   │ FeatureDrift   │ ──▶ PSI on rolling feature windows   │
│   │ Detector        │                                      │
│   └────────┬────────┘                                      │
│            │                                                │
│   ┌────────┴────────┐                                      │
│   │ ConceptDrift   │ ──▶ Rolling win rate vs baseline     │
│   │ Detector       │                                      │
│   └────────┬────────┘                                      │
│            │                                                │
│   ┌────────┴────────┐                                      │
│   │ RegimeDrift    │ ──▶ HMM posterior consistency        │
│   │ Detector       │                                      │
│   └────────┬────────┘                                      │
│            │                                                │
│            └──────────▶ should_retrain()                    │
└─────────────────────────────────────────────────────────────┘
```

### Feature Drift (PSI)

Population Stability Index monitors feature distribution changes:

| PSI Range | Interpretation | Action |
|-----------|---------------|--------|
| < 0.1 | No significant change | None |
| 0.1 - 0.2 | Moderate shift | Warning |
| 0.2 - 0.25 | Significant shift | Alert |
| > 0.25 | Major shift | Immediate retrain |

**Formula:**
```
PSI = Σ [(Actual% - Expected%) × ln(Actual% / Expected%)]
```

### Concept Drift (Accuracy)

Rolling win rate tracked vs training-time baseline:

| Accuracy Drop | Interpretation | Action |
|---------------|----------------|--------|
| < 3% | Normal variance | None |
| 3% - 5% | Warning | Monitor |
| > 5% | Significant degradation | Alert |

**Requirements:**
- Minimum 20 predictions before computing
- Minimum 50 baseline trades for comparison

### Regime Drift (HMM)

HMM posterior tracked over rolling window:

| Condition | Interpretation | Action |
|-----------|----------------|--------|
| Same regime N consecutive bars | Sustained regime | Check if model trained on this regime |
| Regime transition | Market structure change | Trigger regime analysis |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/drift/status` | GET | Current status of all 3 detectors |
| `/drift/detect` | POST | Run full drift detection on demand |
| `/drift/record-prediction` | POST | Record trade result for concept drift |
| `/drift/baseline` | POST | Refresh baselines after training |
| `/drift/thresholds` | GET | Current threshold values |

### Configuration

```python
@dataclass
class DriftThresholds:
    # Feature drift (PSI)
    psi_feature_warning: float = 0.1
    psi_feature_alert: float = 0.2
    psi_feature_critical: float = 0.25

    # Concept drift (accuracy)
    accuracy_drop_warning: float = 0.03
    accuracy_drop_alert: float = 0.05

    # Regime drift
    regime_change_threshold: float = 0.7

    # Minimum data requirements
    min_baseline_trades: int = 50
    min_current_trades: int = 20
```

## Consequences

### Positive
- **Three complementary views:** Features, accuracy, market regime
- **Automatic baseline refresh:** After training, baselines updated transparently
- **Configurable thresholds:** Via `DriftThresholds` dataclass
- **Unified decision:** `should_retrain()` — any detector can trigger
- **Integration:** Trainer refreshes baselines after successful training

### Negative
- **Data requirements:** 50 historical trades needed before baselines
- **Concept drift lag:** Needs actual trade outcomes — not useful until trades close
- **Threshold tuning:** Generic thresholds may need per-market adjustment

### Neutral
- `evaluation.py` `DriftDetector` (Z-score + KS test) is simpler alternative
- Both can coexist: evaluation.py for quick checks, drift_detector.py for monitoring

## Alternatives Considered

### KL Divergence
- **Pros:** Information-theoretic foundation
- **Cons:** Asymmetric, undefined when bins are empty
- **Why rejected:** PSI is symmetric and handles empty bins

### Jensen-Shannon Divergence
- **Pros:** Symmetric, bounded [0, 1]
- **Cons:** Harder to interpret thresholds
- **Why rejected:** PSI has more established industry thresholds

### Population Stability Index (PSI)
- **Pros:** Industry standard, symmetric, interpretable thresholds
- **Cons:** Requires binning (some information loss)
- **Why chosen:** Best balance of interpretability and accuracy

### Z-Score Monitoring
- **Pros:** Simple, real-time
- **Cons:** Only detects mean shifts, not distribution shape changes
- **Why rejected:** PSI captures full distribution drift

## References

- [SAS Population Stability Index](https://www.sas.com/content/dam/SAS/support/en/sas-global-forum-proceedings/2019/3056-2019.pdf)
- [Drift Detection Methods Survey](https://arxiv.org/abs/2010.13215)
- [Evidently AI Monitoring](https://github.com/evidentlyai/evidently)
- Related ADRs: [ADR-011 Physics Regime Models](ADR-011-physics-regime-models.md) (HMM for regime detection), [ADR-012 Continual Learning](ADR-012-continual-learning.md) (drift triggers retraining)
