"""
Anomalous Diffusion Model — Captures non-Brownian stochastic processes in
market returns using fractional calculus and power-law return distributions.

While the FP-FK model solves the PDE for regime probability evolution, this
model focuses on the stochastic process itself: modeling returns as:

  dX(t) = μ·dt + σ·dH_α(t)

where dH_α is a fractional Brownian motion (fBm) increment with Hurst exponent H,
related to the anomalous diffusion exponent via:

  ⟨|X(t+τ) - X(t)|²⟩ ∝ τ^(2H)
  For fBm: H ∈ (0,1)
    H > ½  → persistent (trending, momentum)
    H < ½  → antipersistent (mean-reverting, mean-reversion)
    H = ½  → standard Brownian motion

The fractional Riemann-Liouville integral gives:
  X(t) = (1/Γ(H+½)) · ∫₀ᵗ (t-s)^(H-½) dW(s)

 Hurst exponent is estimated via:
  - Detrended Fluctuation Analysis (DFA) — most robust for non-stationary data
  - Variance ratio test — links H to the variance of k-period returns
  - Generalized Hurst Exponent (GHE) — directly measures ⟨|ΔX|^q⟩ ∝ τ^(q·H(q))

References:
  - Mandelbrot & Van Ness (1968). SIAM Rev. 10, 422.
  - Bouchaud & Georges (1990). Phys. Rep. 195, 127.
  - Di Matteo (2007). Physica A 379, 59.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
import sys, os
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def detrended_fluctuation_analysis(x: np.ndarray,
                                   min_window: int = 4,
                                   max_window: int | None = None) -> tuple[float, np.ndarray, np.ndarray]:
    """
    Detrended Fluctuation Analysis (DFA) — estimate Hurst exponent H.

    Steps:
      1. Compute cumulative sum y(k) = Σ[i=1..k] (x[i] - mean(x))
      2. Divide into windows of size n
      3. Fit linear trend to each window, compute variance of residuals
      4. F(n) = sqrt(1/N · Σ residual²)
      5. Fit log F(n) = H · log n + const
      6. H is the slope (Hurst exponent)

    Parameters
    ----------
    x : array-like
        Time series (e.g., log returns).
    min_window : int
        Minimum window size.
    max_window : int
        Maximum window size (default: N/4).

    Returns
    -------
    H : float
        Hurst exponent ∈ (0, 1).
        H < 0.5  → antipersistent (mean-reversion)
        H = 0.5  → standard Brownian motion
        H > 0.5  → persistent (momentum/trending)
    F_n : ndarray
        Fluctuation function at each window size.
    window_sizes : ndarray
        The window sizes used.
    """
    x = np.asarray(x).flatten()
    x = x[~np.isnan(x)]
    N = len(x)

    if N < 20:
        return 0.5, np.array([]), np.array([])

    if max_window is None:
        max_window = N // 4

    max_window = min(max_window, N // 2)
    window_sizes = np.unique(np.logspace(
        np.log10(min_window),
        np.log10(max_window),
        num=min(20, N // 5),
        dtype=int
    )).astype(int)

    # Cumulative sum (profile)
    y = np.cumsum(x - np.mean(x))

    F_n = np.zeros(len(window_sizes))

    for i, n in enumerate(window_sizes):
        if n < 2:
            continue
        # Number of complete windows
        n_windows = N // n
        if n_windows < 2:
            continue

        variance_sum = 0.0
        count = 0

        for j in range(n_windows):
            segment = y[j * n:(j + 1) * n]
            # Fit linear trend
            t = np.arange(n)
            if np.var(t) < 1e-10:
                continue
            # Linear regression: y = a·t + b
            t_mean = np.mean(t)
            y_mean = np.mean(segment)
            a = np.sum((t - t_mean) * (segment - y_mean)) / np.sum((t - t_mean) ** 2 + 1e-10)
            b = y_mean - a * t_mean
            # Residuals
            trend = a * t + b
            residuals = segment - trend
            variance_sum += np.sum(residuals ** 2)
            count += 1

        if count > 0:
            F_n[i] = np.sqrt(variance_sum / N)

    # Remove zeros
    valid = F_n > 0
    if valid.sum() < 2:
        return 0.5, F_n, window_sizes

    log_F = np.log(F_n[valid])
    log_n = np.log(window_sizes[valid])

    # Linear regression: log F = H · log n + c
    H, intercept = np.polyfit(log_n, log_F, 1)

    # Clip to [0.1, 0.9] — financial data rarely reaches extremes
    H = float(np.clip(H, 0.1, 0.9))

    return H, F_n, window_sizes


def generalized_hurst_exponent(x: np.ndarray,
                               q_values: list[int] | None = None) -> dict:
    """
    Generalized Hurst Exponent (GHE) — Di Matteo et al. (2007).

    Measures ⟨|ΔX|^q⟩ ∝ τ^(q·H(q))

    For q=2: reduces to standard second-moment Hurst exponent.
    The q-dependence of H(q) reveals the nature of correlations:
      H(q) decreases with q → multifractal / heavy tails
      H(q) ≈ constant → monofractal

    Returns
    -------
    H_q : dict
        Mapping from q to H(q).
    hurst_slope : float
        dH/dq — measures multifractality. High |slope| → strong multifractality.
    interpretation : str
        MONOFRACTAL, MILD_MULTIFRACTAL, or STRONG_MULTIFRACTAL.
    """
    if q_values is None:
        q_values = [1, 2, 3, 4, 5]

    x = np.asarray(x).flatten()
    x = x[~np.isnan(x)]

    if len(x) < 50:
        return {"H_1": 0.5, "H_2": 0.5}, 0.0, "INSUFFICIENT_DATA"

    N = len(x)
    tau_max = min(N // 4, 100)
    taus = np.unique(np.linspace(2, tau_max, min(30, tau_max // 2)).astype(int))

    H_q = {}
    for q in q_values:
        if q == 0:
            continue
        k_q = []
        for tau in taus:
            if tau >= N:
                continue
            # |ΔX(t,τ)|^q
            diffs = np.abs(x[tau:] - x[:-tau])
            if len(diffs) == 0:
                continue
            mean_q = np.mean(diffs ** q)
            if mean_q > 0:
                k_q.append(mean_q ** (1 / q))

        if len(k_q) >= 3:
            log_taus = np.log(taus[:len(k_q)])
            log_k = np.log(k_q)
            H_q[f"H_{q}"] = float(np.polyfit(log_taus, log_k, 1)[0])
        else:
            H_q[f"H_{q}"] = 0.5

    # Hurst slope (multifractality measure)
    H_values = [H_q[k] for k in sorted(H_q.keys()) if H_q[k] != 0.5]
    if len(H_values) >= 2:
        slope = np.polyfit(range(len(H_values)), H_values, 1)[0]
    else:
        slope = 0.0

    abs_slope = abs(slope)
    if abs_slope < 0.02:
        interpretation = "MONOFRACTAL"
    elif abs_slope < 0.05:
        interpretation = "MILD_MULTIFRACTAL"
    else:
        interpretation = "STRONG_MULTIFRACTAL"

    return H_q, float(slope), interpretation


def variance_ratio_test(returns: np.ndarray,
                        max_k: int = 20) -> float:
    """
    Variance Ratio test for Hurst exponent.

    Var[X(t+k)] / (k·Var[X(t)]) → 1 for Brownian motion (H=0.5)
    > 1  → persistent (H > 0.5, trending)
    < 1  → antipersistent (H < 0.5, mean-reverting)

    Variance ratio: VR(k) = (1/k) · Var[Σᵢ X(t+i)] / Var[X(t)]
    Related to Hurst: H ≈ 0.5 + 0.5 · log₂(VR(2))

    Returns
    -------
    H_vr : float
        Hurst exponent estimated from variance ratio.
    """
    r = np.asarray(returns).flatten()
    r = r[~np.isnan(r)]

    if len(r) < max_k * 2:
        return 0.5

    var_1 = np.var(r)
    if var_1 < 1e-15:
        return 0.5

    # Average VR over multiple k
    H_estimates = []
    for k in range(2, max_k + 1):
        if k >= len(r):
            continue
        # k-period return
        r_k = r[k:] - r[:-k]
        var_k = np.var(r_k)
        vr = var_k / (k * var_1)
        # Map to H: VR(k) → H
        if vr > 0:
            H_k = 0.5 + 0.5 * (np.log(vr) / np.log(k / 1))
            H_k = np.clip(H_k, 0.1, 0.9)
            H_estimates.append(H_k)

    if not H_estimates:
        return 0.5

    return float(np.median(H_estimates))


class AnomalousDiffusionModel:
    """
    Anomalous Diffusion Detector — estimates Hurst exponent and diffusion type.

    Combines three estimators:
      1. DFA (most robust for non-stationary financial data)
      2. Variance Ratio (classical, fast)
      3. GHE (multifractality)

    Uses weighted average as the final H estimate.
    """

    name = "anomalous_diffusion"
    model_type = "regime"

    def __init__(self, window_size: int = 100, random_state: int = 42):
        self.window_size = window_size
        self.random_state = random_state
        self._is_trained = False
        self._H_dfa: float = 0.5
        self._H_vr: float = 0.5
        self._H_ghe: float = 0.5
        self._H_final: float = 0.5
        self._multifractality: str = "MONOFRACTAL"
        self._diffusion_type: str = "NORMAL"
        self._recent_returns: list[float] = []
        self._hurst_history: list[float] = []
        self._H_slope: float = 0.0

    def train(self, df: pd.DataFrame, verbose: bool = True) -> dict:
        """
        Estimate Hurst exponent from the return series.
        """
        returns = df["log_return"].dropna().tail(self.window_size).values

        if len(returns) < 20:
            raise ValueError(f"Need at least 20 returns for diffusion analysis, got {len(returns)}")

        # Rolling window update
        self._recent_returns.extend(returns.tolist())
        if len(self._recent_returns) > self.window_size * 2:
            self._recent_returns = self._recent_returns[-self.window_size:]

        r = np.array(self._recent_returns[-self.window_size:])

        # Three estimators
        H_dfa, _, _ = detrended_fluctuation_analysis(r, min_window=4)
        H_vr = variance_ratio_test(r, max_k=min(20, len(r) // 4))
        H_ghe_dict, H_slope, multifract = generalized_hurst_exponent(r)
        H_ghe = H_ghe_dict.get("H_2", 0.5)

        # Weighted average (DFA most reliable for financial data)
        w_dfa, w_vr, w_ghe = 0.5, 0.3, 0.2
        H_final = w_dfa * H_dfa + w_vr * H_vr + w_ghe * H_ghe
        H_final = float(np.clip(H_final, 0.1, 0.9))

        self._H_dfa = H_dfa
        self._H_vr = H_vr
        self._H_ghe = H_ghe
        self._H_final = H_final
        self._multifractality = multifract
        self._H_slope = H_slope

        # Store history for trend detection
        self._hurst_history.append(H_final)
        if len(self._hurst_history) > 50:
            self._hurst_history.pop(0)

        # Diffusion type
        if H_final < 0.45:
            diffusion_type = "SUB_DIFFUSION"  # Mean-reversion dominant
        elif H_final > 0.55:
            diffusion_type = "SUPER_DIFFUSION"  # Momentum/trending
        else:
            diffusion_type = "NORMAL"  # Standard Brownian

        self._diffusion_type = diffusion_type
        self._is_trained = True

        if verbose:
            print(f"  Anomalous Diffusion Model:")
            print(f"    H_DFA={H_dfa:.3f}  H_VR={H_vr:.3f}  H_GHE={H_ghe:.3f}")
            print(f"    H_final={H_final:.3f} ({diffusion_type})")
            print(f"    Multifractality: {multifract} (slope={H_slope:.4f})")

        return {
            "model": self.name,
            "H_dfa": round(H_dfa, 4),
            "H_vr": round(H_vr, 4),
            "H_ghe": round(H_ghe, 4),
            "H_final": round(H_final, 4),
            "diffusion_type": diffusion_type,
            "multifractality": multifract,
            "H_slope": round(H_slope, 4),
            "n_returns": len(r),
        }

    def predict_current(self, df: pd.DataFrame) -> dict:
        """
        Return anomalous diffusion analysis for the current candle window.
        """
        if not self._is_trained:
            self.train(df, verbose=False)

        # Trend of H over time
        if len(self._hurst_history) >= 5:
            recent_H = np.array(self._hurst_history[-10:])
            H_trend = np.polyfit(range(len(recent_H)), recent_H, 1)[0]
            H_trend_str = "RISING" if H_trend > 0.01 else ("FALLING" if H_trend < -0.01 else "STABLE")
        else:
            H_trend_str = "STABLE"
            H_trend = 0.0

        # Volatility clustering indicator (from H)
        # High H + high H_trend → strong momentum, reduce on reversal
        vol_clustering = "STRONG" if self._H_final > 0.6 and H_trend > 0.01 else "MODERATE" if self._H_final > 0.55 else "WEAK"

        # Regime implications
        implications = {
            "SUB_DIFFUSION": "H < 0.5 → antipersistent returns → mean-reversion effective → use RBR/SRS setups",
            "NORMAL": "H ≈ 0.5 → standard diffusion → Brownian motion → balanced approach",
            "SUPER_DIFFUSION": "H > 0.5 → persistent returns → momentum strategies → let winners run, wider stops",
        }

        # Position adjustment from H
        # H significantly different from 0.5 → adjust position sizing
        H_deviation = abs(self._H_final - 0.5)
        position_adjustment = -0.15 * H_deviation / 0.4  # Reduce by up to 15% when H is extreme

        explanation = (
            f"Hurst H={self._H_final:.3f} ({self._diffusion_type}), "
            f"multifractality {self._multifractality.lower()}, "
            f"vol_clustering={vol_clustering.lower()}, "
            f"H_trend={H_trend_str.lower()}. "
            f"{implications.get(self._diffusion_type, '')} "
            f"Position adjustment: {position_adjustment:+.1%}"
        )

        return {
            "hurst_H": round(self._H_final, 4),
            "H_dfa": round(self._H_dfa, 4),
            "H_vr": round(self._H_vr, 4),
            "H_ghe": round(self._H_ghe, 4),
            "diffusion_type": self._diffusion_type,
            "multifractality": self._multifractality,
            "H_slope": round(self._H_slope, 4),
            "H_trend": H_trend_str,
            "vol_clustering": vol_clustering,
            "position_adjustment": round(position_adjustment, 4),
            "implication": implications.get(self._diffusion_type, ""),
            "explanation": explanation,
        }

    def predict(self, X: np.ndarray) -> dict:
        """Interface compatible with model pipeline."""
        if hasattr(self, "_last_df"):
            return self.predict_current(self._last_df)
        return self.predict_current(pd.DataFrame())

    def advance(self, df: pd.DataFrame) -> dict:
        """Called per new candle — update and return."""
        self._last_df = df
        # Incrementally update with new returns
        new_returns = df["log_return"].dropna().tail(1).values
        if len(new_returns) > 0:
            self._recent_returns.append(float(new_returns[0]))
            if len(self._recent_returns) > self.window_size:
                self._recent_returns.pop(0)
        return self.predict_current(df)

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    def get_metrics(self) -> dict:
        return {
            "model": self.name,
            "H_final": round(self._H_final, 4),
            "diffusion_type": self._diffusion_type,
            "trained": self._is_trained,
        }
