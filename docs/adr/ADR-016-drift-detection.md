# ADR-016: Unified Drift Detection with PSI, Win Rate, and HMM Regime Tracking

**Status:** Accepted
**Date:** 2026-04-03
**Author:** FXGUNIT

## Context

The ML Engine trains models on historical data — but markets evolve. A model trained on 6 months of data may become stale as:
1. **Feature distributions change** — e.g., volatility regime shifts, volume patterns evolve
2. **Concept relationships shift** — e.g., what "bullish" means changes as market microstructure evolves
3. **Market regimes change** — e.g., transition from trending to mean-reversion conditions

Without drift detection, a degraded model silently produces bad signals. The system needs to:
- Detect when feature distributions have shifted (PSI)
- Detect when prediction accuracy has dropped (rolling win rate)
- Detect when market regime has structurally changed (HMM posterior persistence)
- Trigger retraining when drift exceeds thresholds

## Decision

Use a **three-detector unified approach** with a `DriftMonitor` orchestration class:

**Architecture:**

```
DriftMonitor
  ├─ FeatureDriftDetector   → PSI on rolling feature windows
  ├─ ConceptDriftDetector    → Rolling win rate vs training baseline
  └─ RegimeDriftDetector     → HMM posterior consistency tracking

+ GET  /drift/status          → Current status of all 3 detectors
+ POST /drift/detect         → Run full drift detection on demand
+ POST /drift/record-prediction → Record trade result for concept drift
+ POST /drift/baseline       → Refresh baselines (after training)
+ GET  /drift/thresholds      → Current threshold values
```

**Feature Drift (PSI):**
- PSI < 0.1 → No significant change
- PSI 0.1–0.2 → Moderate shift — warning
- PSI 0.2–0.25 → Significant shift — alert
- PSI > 0.25 → Major shift — critical, immediate retrain
- Formula: `PSI = Σ [(Actual% - Expected%) × ln(Actual% / Expected%)]`

**Concept Drift (Accuracy):**
- Rolling win rate tracked vs training-time baseline
- Warning: accuracy drop > 3%
- Alert: accuracy drop > 5%
- Minimum 20 predictions before computing

**Regime Drift (HMM):**
- HMM posterior tracked over rolling window
- Regime shift confirmed when same regime persists for N consecutive bars
- Triggers retraining recommendation on sustained regime change

**Integration:**
- After each training run → `DriftMonitor.feature_drift.update_baseline()` + `set_baseline()`
- After each trade resolves → `DriftMonitor.concept_drift.record_prediction(correct, confidence)`
- After each `/predict` call with known regime → `RegimeDriftDetector.update(regime, confidence)`
- Trainer integrates: baselines refreshed automatically after successful training

**Thresholds (DriftThresholds dataclass):**
```python
psi_feature_warning: 0.1    # PSI > 0.1 → warning
psi_feature_alert: 0.2     # PSI > 0.2 → retrain
psi_feature_critical: 0.25  # PSI > 0.25 → immediate retrain
accuracy_drop_warning: 0.03  # Drop > 3% → warning
accuracy_drop_alert: 0.05     # Drop > 5% → retrain
regime_change_threshold: 0.7  # Posterior change > 70% → regime shift
min_baseline_trades: 50
min_current_trades: 20
```

**Why PSI over alternatives:**
- **KL Divergence:** Asymmetric, undefined when bins are empty
- **Jensen-Shannon:** Symmetric but harder to interpret thresholds
- **PSI:** Industry standard in credit scoring and ML model monitoring; symmetric, interpretable, and works with binning

## Consequences

### Positive
- Three complementary views of model health: input features, prediction accuracy, market regime
- Automatic baseline refresh after training — no manual reset needed
- Thresholds are configurable via `DriftThresholds` dataclass
- Unified `should_retrain()` method — any detector can trigger retraining
- Trainer integrates drift baseline refresh transparently

### Negative
- Requires at least 50 historical trades before baselines can be established
- Concept drift detector needs actual trade outcomes — not useful for live paper trading until trades close
- PSI thresholds are generic — may need tuning per market/asset

### Neutral
- The `evaluation.py` `DriftDetector` (Z-score + KS test) is a simpler alternative for single-feature tracking; this `drift_detector.py` `DriftMonitor` supersedes it for production use
- Both can coexist — evaluation.py for quick checks, drift_detector.py for comprehensive monitoring
