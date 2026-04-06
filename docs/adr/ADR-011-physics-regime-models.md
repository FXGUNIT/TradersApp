# ADR-011: Physics-Based Regime Detection (FP-FK + Anomalous Diffusion)

**ADR ID:** ADR-011
**Title:** Physics-Based Regime Detection (FP-FK + Anomalous Diffusion)
**Status:** Accepted
**Date:** 2026-04-02
**Author:** FXGUNIT

## Context

Traditional statistical regime detection (HMM) assumes:
- Market regimes follow Markov transitions
- Regime transitions are instantaneous
- Return distributions are stationary within regimes

These assumptions break down in:
- Flash crash scenarios (instantaneous transitions)
- Slow drift periods (non-stationary)
- Cross-asset correlations during stress

Physics-based models can capture:
- Memory effects (anomalous diffusion)
- Power-law scaling (fat tails)
- Mean-reversion vs trending dynamics

## Decision

Use a **multi-model regime detection ensemble** combining physics-inspired models:

### Model 1: Fractional Polynomials Kinetics (FP-FK)

Captures non-linear mean reversion with memory:

```python
class FPKineticsRegimeDetector:
    """
    Uses fractional derivatives to model anomalous diffusion.
    FP-Kinetic equation: D^α_t p(x,t) = L p(x,t)
    where D^α is the Caputo fractional derivative.
    """

    def predict(self, returns: np.ndarray) -> dict:
        # Estimate fractional order α
        alpha = self._estimate_fractional_order(returns)

        # Compute effective diffusion coefficient
        D_eff = self._estimate_diffusion(returns)

        # Classify regime
        if alpha < 0.5:
            return "MEAN_REVERTING"  # Subdiffusion
        elif alpha > 0.7:
            return "TRENDING"        # Superdiffusion
        else:
            return "RANDOM_WALK"      # Normal diffusion
```

### Model 2: Anomalous Diffusion Classifier

Captures power-law scaling of return distributions:

```python
class AnomalousDiffusionDetector:
    """
    Detects anomalous diffusion via scaling analysis.
    MSD(t) ~ t^α where α ≠ 1 indicates anomalous diffusion.
    """

    def predict(self, prices: np.ndarray) -> dict:
        # Compute Mean Squared Displacement
        msd = self._compute_msd(prices)

        # Fit scaling exponent
        alpha, intercept = np.polyfit(
            np.log(self.time_lags),
            np.log(msd),
            1
        )

        # α < 1: Subdiffusion (trending)
        # α = 1: Normal diffusion
        # α > 1: Superdiffusion (mean-reverting)
        regime = self._classify_regime(alpha)
```

### Model 3: HMM (Traditional Baseline)

Gaussian HMM for comparison and ensemble voting:

```python
class HMMRegimeDetector:
    """
    Standard 2-3 state Gaussian HMM.
    States: Bull, Bear, Sideways
    """
    pass
```

### Ensemble Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Regime Ensemble                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐                │
│   │   FP-FK  │   │ Anomalous│   │   HMM   │                │
│   │  α = 0.4 │   │  α = 1.3 │   │ Bull    │                │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘                │
│        │               │               │                     │
│        └───────────────┼───────────────┘                     │
│                        ▼                                     │
│              ┌─────────────────┐                            │
│              │   Weighted Vote  │                            │
│              │  (Confidence)   │                            │
│              └────────┬────────┘                            │
│                       │                                     │
│                       ▼                                     │
│              ┌─────────────────┐                          │
│              │  Final Regime   │                           │
│              │ TRENDING (0.73) │                           │
│              └─────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### API Integration

```python
# regimeEnsemble.py
class RegimeEnsemble:
    def __init__(self):
        self.hmm = HMMRegimeDetector()
        self.fpk = FPKineticsRegimeDetector()
        self.anom = AnomalousDiffusionDetector()
        self.weights = {'hmm': 0.3, 'fpk': 0.4, 'anom': 0.3}

    def predict(self, candles) -> dict:
        hmm_regime = self.hmm.predict(candles)
        fpk_regime = self.fpk.predict(candles)
        anom_regime = self.anom.predict(candles)

        # Weighted voting
        votes = self._aggregate_votes(hmm_regime, fpk_regime, anom_regime)

        return {
            'regime': votes.winning_regime,
            'confidence': votes.confidence,
            'components': {
                'hmm': hmm_regime,
                'fpk': fpk_regime,
                'anom': anom_regime,
            }
        }
```

## Consequences

### Positive
- **Physics-informed:** Captures memory effects traditional models miss
- **Interpretable:** Fractional order α has physical meaning
- **Robust:** Ensemble reduces false regime signals
- **Adaptive:** Different models weight differently across regimes

### Negative
- **Computational cost:** Three models instead of one
- **Parameter sensitivity:** Fractional order estimation requires sufficient data
- **Validation complexity:** Harder to validate against traditional benchmarks

### Neutral
- HMM remains as baseline for comparison
- Ensemble can be extended with additional physics models
- Regime confidence affects consensus weight

## Alternatives Considered

### Standard HMM Only
- **Pros:** Simple, fast, interpretable
- **Cons:** Doesn't capture anomalous diffusion
- **Why rejected:** Missing physics-based dynamics

### GARCH Models
- **Pros:** Captures volatility clustering
- **Cons:** Assumes normal diffusion, less interpretable
- **Why rejected:** Doesn't capture memory effects

### Deep Learning (LSTM)
- **Pros:** Can learn complex patterns
- **Cons:** Black box, needs lots of data, prone to overfitting
- **Why rejected:** Interpretability critical for trading signals

### Regime Switching Regression
- **Pros:** Direct regime-based forecasting
- **Cons:** Requires knowing regime a priori
- **Why rejected:** Same issue as HMM

## References

- [Metzler et al. - Anomalous diffusion models](https://arxiv.org/abs/1401.4734)
- [Scalas et al. - Fractional calculus in finance](https://arxiv.org/abs/0912.3294)
- [Bacry & Muzy - Hawkes processes for finance](https://arxiv.org/abs/2203.04165)
- Related ADRs: [ADR-016 Drift Detection](ADR-016-drift-detection.md) (regime changes trigger retraining)
