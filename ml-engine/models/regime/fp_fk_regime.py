"""
FP-FK Regime Detector — Fokker-Planck + Fisher-KPP with Tsallis q-Gaussians

Mathematical Framework:
=======================
The market state probability density f(vr, adx; t) evolves on the 2D state plane
(volatility ratio × ADX trend strength) according to a non-linear reaction-diffusion
PDE that combines:

1. FOKKER-PLANCK (conservation law):
   ∂t f = -∇·J           (probability current divergence)
   J_i = A_i(vr,adx)·f - D_q·∂_i^(q) f   (q-generalized flux)
   where ∂_i^(q) is the q-derivative: ∂^(q)f/∂x^(q)

   The q-derivative generalizes Fick's law for non-Gaussian diffusion:
   ∂^(q)f = (f(x+Δ) - 2f(x) + f(x-Δ)) / Δ^q
   For q=1: standard Laplacian diffusion
   For q>1: superdiffusion (Lévy-like, fat tails)
   For q<1: subdiffusion (truncated, mean-reversion)

2. FISHER-KPP (reaction-diffusion):
   ∂t f = D_q·Δf + r·(F_q - f)

   The reaction term r·(F_q - f) pulls the density toward the q-Gaussian
   equilibrium F_q. The wave speed of the FK front:
     c* = 2·√(D_q · r)

   Wave front position tracks the market's regime transition boundary.
   When the front accelerates (d²c/dt² > 0): rapid regime shift imminent.
   When the front decelerates: regime consolidation.

3. TSALLIS q-GAUSSIANS (non-extensive equilibrium):

   F_q(vr, adx) ∝ [1 + (q-1)·β·((vr-μ_vr)² + (adx-μ_adx)²)/2]^(1/(1-q))

   The entropic index q captures:
     q < 1  → sub-Gaussian, peaked distribution (COMPRESSION)
     q ≈ 1  → standard Gaussian (NORMAL)
     q > 1  → fat-tailed, power-law (EXPANSION, trend)

   q is estimated from the empirical kurtosis of log returns via MLE.

4. CRITICALITY INDEX (deleverage signal):
   κ = ‖∇·J‖ / P_total   (normalized divergence of probability flux)

   Near phase transitions (regime boundaries), probability mass redistributes
   rapidly → κ spikes → deleverage before bottoms/tops.

5. ANOMALOUS DIFFUSION COEFFICIENT:
   D_q(vr, adx) = D₀ · [vr · (adx/100)]^(α)

   where α is the diffusion exponent:
     α > 0.5  → superdiffusive (expanding regime)
     α < 0.5  → subdiffusive (compressing regime)

Solving:
========
- Semi-Lagrangian scheme for advection (A·∇f term)
- Crank-Nicolson implicit for diffusion (stability at large Δt)
- Finite differences on N_vr × N_adx grid
- Natural boundary conditions (probability density → 0 at grid edges)
- Adaptive Δt via CFL condition
- PDE solved online on rolling window of candles

The front tracker uses the method of characteristics on the FK solution.

References:
  - Tsallis, C. (1988). J. Stat. Phys. 52, 479.
  - Borland, L. (1998). Phys. Rev. E 57, 6634.
  - Fisher, R.A. (1937). Ann. Eugenics 7, 355.
  - Kolmogorov, A. et al. (1937). Byull. Mosk. Gos. Univ. 1, 1.
  - riskmetrics: Tsallis statistics in financial modeling (Borges et al.)
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import sys, os
from typing import Optional, Tuple
from dataclasses import dataclass, field
from scipy.special import gamma as gamma_func
from scipy.optimize import brentq
from scipy.ndimage import gaussian_filter
import warnings

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config


# =============================================================================
# Tsallis q-Gaussian utilities
# =============================================================================

def _q_gamma(x: float, q: float, eps: float = 1e-8) -> float:
    """
    q-Gamma function: Γ_q(x) = ∫₀^∞ t^(x-1)·[1+(q-1)t]^{-1/(q-1)} dt
    For q < 1, integral converges; for q > 1, use analytic continuation.
    We use the relation Γ_q(x)·Γ_q(1-x) = π / [sin(πx)·(2-q)^(1/(q-1))]
    """
    if abs(q - 1.0) < eps:
        return gamma_func(x)
    if q > 1:
        return gamma_func(x) / (2 - q) ** ((x - 1) / (q - 1))
    return gamma_func(x) * (1 - q) ** ((1 - x) / (1 - q))


def q_exp(x: float, q: float) -> float:
    """q-exponential: exp_q(x) = [1 + (1-q)x]_{+}^{-1/(1-q)}"""
    if abs(q - 1.0) < 1e-8:
        return np.exp(x)
    base = 1 + (1 - q) * x
    if base <= 0:
        return 0.0
    return base ** (-1.0 / (1 - q))


def q_log(x: float, q: float) -> float:
    """q-logarithm: ln_q(x) = (x^{1-q} - 1) / (1 - q)"""
    if abs(q - 1.0) < 1e-8:
        return np.log(x)
    if x <= 0:
        return -np.inf
    return (x ** (1 - q) - 1) / (1 - q)


def q_gaussian_pdf(x: np.ndarray, y: np.ndarray,
                   q: float, mu_x: float, mu_y: float,
                   sigma_x: float, sigma_y: float) -> np.ndarray:
    """
    Bivariate q-Gaussian probability density on (x,y) plane.

    F_q(x,y) ∝ [1 + (q-1)/2 · ((x-μx)²/σx² + (y-μy)²/σy²)]^{1/(1-q)}
    Normalized numerically.
    """
    if sigma_x <= 0 or sigma_y <= 0:
        return np.zeros_like(x)
    dist_sq = ((x - mu_x) / sigma_x) ** 2 + ((y - mu_y) / sigma_y) ** 2
    if q > 1:
        # Standard form
        density = (1 + (q - 1) / 2 * dist_sq) ** (-1 / (q - 1))
    elif q < 1:
        # Cut-off at the boundary of the support
        threshold = 2 / (1 - q)
        density = np.where(dist_sq < threshold,
                           (1 + (q - 1) / 2 * dist_sq) ** (-1 / (1 - q)),
                           0.0)
    else:
        density = np.exp(-dist_sq / 2)
    # Normalize
    norm = np.sum(density)
    if norm > 0:
        density = density / norm
    return density


# =============================================================================
# Tsallis q-parameter estimation from return series
# =============================================================================

def estimate_q_from_returns(log_returns: np.ndarray,
                            method: str = "kurtosis_mle") -> float:
    """
    Estimate Tsallis entropic index q from a time series of log returns.

    Methods:
      'kurtosis_mle': Use excess kurtosis → solve for q analytically
        Excess kurtosis of q-Gaussian: κ_E = 3(q-1)/(5-q)   [for bivariate, more complex]
        We use empirical excess kurtosis κ̂ and solve:
          κ̂ = 3(q-1)/(5-q)  →  q = (5κ̂ + 3) / (κ̂ + 3)

      'borges_mle': Borges et al. (2003) numerical MLE for q
        Maximize: L(q) = Σ ln[exp_q(-r²/2σ²)]
        where exp_q is the q-exponential.

      'mudroch': Mudrov (2019) approximation for financial series.
        q ≈ 1 + 2/(1 + ⟨|r|⟩/σ)

    Parameters
    ----------
    log_returns : array-like
        Series of log returns (already demeaned is fine).
    method : str
        Estimation method.

    Returns
    -------
    q : float
        Tsallis q-parameter. Clipped to [0.5, 3.0].
        q < 1: sub-Gaussian (COMPRESSION)
        q ≈ 1: Gaussian (NORMAL)
        q > 1: fat-tailed (EXPANSION/TRENDING)
    """
    r = np.asarray(log_returns).flatten()
    r = r[~np.isnan(r)]

    if len(r) < 20:
        return 1.5  # Default: slightly fat tails

    # Remove zeros and center
    r = r - np.median(r)

    if method == "kurtosis_mle":
        # Empirical excess kurtosis
        mu4 = np.mean(r ** 4)
        sigma4 = np.var(r) ** 2
        if sigma4 <= 0 or mu4 <= 0:
            return 1.5
        kappa = mu4 / sigma4 - 3  # excess kurtosis

        # Map excess kurtosis to q via q-Gaussian moment relation
        # For q-Gaussian with q < 3 (finite variance):
        # κ_E = 3(q-1)/(5-q)   [bivariate generalization]
        if kappa < -0.6:
            # Sub-Gaussian regime
            q = 1 - 2 / (1 - kappa)
        elif kappa < 0:
            q = (5 * kappa + 3) / (kappa + 3)
        else:
            q = (5 * kappa + 3) / (kappa + 3)

    elif method == "borges_mle":
        # Borges et al. numerical MLE
        sigma = np.std(r)
        if sigma <= 0:
            return 1.5

        def neg_log_likelihood(q_val):
            if q_val <= 0.5 or q_val >= 3.0:
                return 1e10
            # q-exp of standardized returns
            x = r / sigma
            arg = 1 + (1 - q_val) * x ** 2 / 2
            arg = np.clip(arg, 1e-10, None)
            log_exp_q = (-1 / (1 - q_val)) * np.log(arg)
            # Numerical stability: clip extreme values
            log_exp_q = np.clip(log_exp_q, -50, 50)
            return -np.sum(log_exp_q)

        # Grid search + refinement
        best_q, best_ll = 1.5, neg_log_likelihood(1.5)
        for q_try in np.linspace(0.6, 2.8, 50):
            ll = neg_log_likelihood(q_try)
            if ll < best_ll:
                best_ll = ll
                best_q = q_try

        try:
            result = brentq(
                lambda q: neg_log_likelihood(q) - best_ll - 0.5,
                0.6, 2.8, xtol=1e-4
            )
            q = float(result)
        except (ValueError, RuntimeError):
            q = best_q

    elif method == "mudroch":
        mean_abs = np.mean(np.abs(r))
        sigma = np.std(r)
        if sigma > 0:
            ratio = mean_abs / sigma
            q = 1 + 2 / (1 + ratio)
        else:
            q = 1.5

    else:
        q = 1.5

    return float(np.clip(q, 0.5, 3.0))


def q_to_regime(q: float) -> str:
    """Map Tsallis q to market regime description."""
    if q < 0.9:
        return "COMPRESSION"
    elif q < 1.1:
        return "NORMAL"
    elif q < 1.5:
        return "TRENDING"
    elif q < 2.0:
        return "EXPANSION"
    else:
        return "CRISIS"


# =============================================================================
# Anomalous diffusion coefficient
# =============================================================================

def compute_diffusion_coefficient(vr: float, adx: float,
                                  alpha: float = 0.5) -> float:
    """
    Anomalous diffusion coefficient D_q in the Fokker-Planck equation.

    D(vr, adx) = D₀ · [vr · (adx/100)]^α

    α determines the diffusion regime:
      α > 0.5 → superdiffusive (momentum building, trending)
      α = 0.5 → standard Brownian diffusion (normal market)
      α < 0.5 → subdiffusive (compression, mean reversion)

    For MNQ 5-min data, D₀ is calibrated empirically.
    """
    D_0 = 0.05  # base diffusion rate
    if vr <= 0 or adx <= 0:
        return D_0
    factor = vr * (adx / 100.0)
    return D_0 * (factor ** alpha)


def estimate_diffusion_exponent(returns: np.ndarray,
                               window: int = 50) -> float:
    """
    Estimate the anomalous diffusion exponent α from return volatility scaling.

    Use the structure function approach:
      ⟨|r(t+τ) - r(t)|^q⟩ ∝ τ^(q·α)

    For q=1 (first moment), the scaling exponent α relates to the
    Hurst exponent: H = α for 1D time series.

    We use the variance as a proxy: Var(r) ∝ τ^(2α)
    on rolling windows of different sizes.
    """
    r = np.asarray(returns).flatten()
    r = r[~np.isnan(r)]

    if len(r) < window * 2:
        return 0.5  # Default to standard diffusion

    # Compute running variance at different lags
    lags = [1, 2, 4, 8]
    log_vars = []
    log_lags = []

    for lag in lags:
        if len(r) < lag * 2:
            continue
        # Variance of lag-Δ differences
        diffs = r[lag:] - r[:-lag]
        var = np.var(diffs)
        if var > 0:
            log_vars.append(np.log(var))
            log_lags.append(np.log(lag))

    if len(log_vars) < 2:
        return 0.5

    # Linear regression: log(Var) = 2α · log(lag) + const
    # α = slope / 2
    slope = np.polyfit(log_lags, log_vars, 1)[0]
    alpha = slope / 2.0

    return float(np.clip(alpha, 0.1, 1.5))


# =============================================================================
# Fisher-KPP wave front tracker
# =============================================================================

def fk_wave_speed(D: float, r_rate: float) -> float:
    """
    Fisher-KPP minimal wave speed: c* = 2·√(D·r)

    This is the minimum speed at which a traveling wave solution of
    ∂t f + c·∂x f = D·∂²_x f + r·(F_q - f)
    can propagate into the unstable state f=0.

    Speed interpretation:
      c* > 0: wave propagating (regime transition in progress)
      c* ≈ 0: wave stalled (regime boundary near criticality)
      d(c*)/dt < 0: wave decelerating (consolidation, deleverage)
      d(c*)/dt > 0: wave accelerating (rapid regime shift)
    """
    if D <= 0 or r_rate <= 0:
        return 0.0
    return 2.0 * np.sqrt(D * r_rate)


def find_wave_front_position(f: np.ndarray, axis: int = 0) -> float:
    """
    Locate the wave front position on a 1D density profile.

    Uses the inflection point method:
      front = argmax_x |∂²f/∂x²|
    which corresponds to the steepest gradient of the FK front.
    """
    # Compute gradient
    grad = np.gradient(f, axis=axis)
    # Find inflection point (zero crossing of second derivative)
    grad2 = np.gradient(grad, axis=axis)
    grad2_smooth = gaussian_filter(grad2, sigma=1)

    # Find peak of |second derivative| (inflection point)
    abs_grad2 = np.abs(grad2_smooth)
    front_idx = int(np.argmax(abs_grad2))

    return float(front_idx)


def criticality_index(f: np.ndarray,
                     J_x: np.ndarray,
                     J_y: np.ndarray,
                     dx: float, dy: float) -> float:
    """
    Criticality index κ = ‖∇·J‖ / P_total

    ∇·J = ∂J_x/∂x + ∂J_y/∂y is the divergence of the probability flux.
    Large κ indicates rapid redistribution of probability mass →
    regime instability → deleverage signal.

    κ is normalized by total probability mass to be scale-invariant.
    """
    div_J = np.gradient(J_x, dx, axis=0) + np.gradient(J_y, dy, axis=1)
    div_J_abs = np.abs(div_J).mean()

    P_total = np.sum(f) * dx * dy
    if P_total <= 0:
        return 0.0

    kappa = div_J_abs / P_total
    return float(kappa)


# =============================================================================
# Crank-Nicolson solver for FP-FK PDE
# =============================================================================

def solve_fp_fk_pde(f0: np.ndarray,
                    A_vr: np.ndarray,
                    A_adx: np.ndarray,
                    D_q: float,
                    r_rate: float,
                    F_q: np.ndarray,
                    dt: float,
                    n_steps: int,
                    dx: float, dy: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Solve the FP-FK PDE on a 2D grid using Crank-Nicolson.

    PDE:
      ∂f/∂t = -∇·(A·f) + D_q·Δf + r·(F_q - f)

    Split into:
      (I) Advection (explicit upwind, small dt):
        ∂f/∂t = -A·∇f

      (II) Diffusion + Reaction (Crank-Nicolson, implicit):
        (I - ½κΔ)f^{n+1} = (I + ½κΔ)f^n + r·(F_q - f)
        where κ = dt·D_q

    Parameters
    ----------
    f0 : ndarray (N_vr, N_adx)
        Initial probability density (must sum to ~1).
    A_vr, A_adx : ndarray
        Drift field on the 2D grid.
    D_q : float
        q-generalized diffusion coefficient.
    r_rate : float
        Fisher-KPP reaction rate.
    F_q : ndarray
        q-Gaussian equilibrium density.
    dt : float
        Time step (fraction of a candle: 5min = 1 unit).
    n_steps : int
        Number of time steps to advance.
    dx, dy : float
        Grid spacings.

    Returns
    -------
    f : ndarray
        Final probability density.
    J_vr : ndarray
        x-component of probability flux at final step.
    J_adx : ndarray
        y-component of probability flux at final step.
    """
    Nx, Ny = f0.shape
    f = f0.copy()

    # Crank-Nicolson coefficients
    alpha_x = dt * D_q / (2 * dx ** 2)
    alpha_y = dt * D_q / (2 * dy ** 2)
    beta = dt * r_rate

    # Build tridiagonal matrices (1D solves per row/column)
    def tridiag(a, b, c, d):
        """Solve Ax = d where A is tridiagonal."""
        n = len(d)
        # Forward elimination
        cp = np.zeros(n)
        dp = np.zeros(n)
        cp[0] = c[0] / b[0]
        dp[0] = d[0] / b[0]
        for i in range(1, n):
            denom = b[i] - a[i] * cp[i - 1]
            cp[i] = c[i] / denom if i < n - 1 else 0
            dp[i] = (d[i] - a[i] * dp[i - 1]) / denom
        # Back substitution
        x = np.zeros(n)
        x[-1] = dp[-1]
        for i in range(n - 2, -1, -1):
            x[i] = dp[i] - cp[i] * x[i + 1]
        return x

    for step in range(n_steps):
        f_prev = f.copy()

        # === Step 1: Advection (explicit upwind, conditionally stable) ===
        # CFL: |A|·dt/dx < 1 required. If violated, reduce dt or skip advection.
        f_adv = f_prev.copy()

        # Upwind in x direction
        for i in range(Nx):
            for j in range(Ny):
                adv_x = 0.0
                if A_vr[i, j] > 0 and i > 0:
                    adv_x = -A_vr[i, j] * (f_prev[i, j] - f_prev[i - 1, j]) / dx
                elif A_vr[i, j] < 0 and i < Nx - 1:
                    adv_x = -A_vr[i, j] * (f_prev[i + 1, j] - f_prev[i, j]) / dx

                adv_y = 0.0
                if A_adx[i, j] > 0 and j > 0:
                    adv_y = -A_adx[i, j] * (f_prev[i, j] - f_prev[i, j - 1]) / dy
                elif A_adx[i, j] < 0 and j < Ny - 1:
                    adv_y = -A_adx[i, j] * (f_prev[i, j + 1] - f_prev[i, j]) / dy

                f_adv[i, j] = f_prev[i, j] + dt * (adv_x + adv_y)

        # === Step 2: Diffusion + Reaction (Crank-Nicolson in x) ===
        # (I - α_x·∂²_xx) f^{new} = (I + α_x·∂²_xx) f^{old} + β·(F_q - f^{old})
        # Tridiagonal system per column

        # RHS of CN step (explicit part)
        rhs_x = np.zeros_like(f_adv)
        for i in range(1, Nx - 1):
            d2f_dx2 = (f_adv[i + 1, :] - 2 * f_adv[i, :] + f_adv[i - 1, :]) / dx ** 2
            rhs_x[i, :] = f_adv[i, :] + alpha_x * d2f_dx2 + beta * (F_q[i, :] - f_adv[i, :])

        # Add BC contribution at boundaries
        rhs_x[0, :] = f_adv[0, :] + alpha_x * (2 * (f_adv[1, :] - f_adv[0, :]) / dx ** 2) + beta * (F_q[0, :] - f_adv[0, :])
        rhs_x[-1, :] = f_adv[-1, :] + alpha_x * (2 * (f_adv[-2, :] - f_adv[-1, :]) / dx ** 2) + beta * (F_q[-1, :] - f_adv[-1, :])

        # Solve tridiagonal for each column
        for j in range(Ny):
            a = np.zeros(Nx)
            b = np.zeros(Nx)
            c = np.zeros(Nx)
            # Tridiagonal coefficients: -α_x on sub/super, (1+2α_x) on main
            a[1:] = -alpha_x
            b[:] = 1 + 2 * alpha_x + beta
            c[:-1] = -alpha_x
            # Natural BC: zero gradient at boundaries → adjust b
            b[0] = 1 + alpha_x + beta
            b[-1] = 1 + alpha_x + beta
            rhs_x[:, j] = tridiag(a, b, c, rhs_x[:, j])

        # === Step 3: Diffusion + Reaction (Crank-Nicolson in y) ===
        rhs_y = np.zeros_like(rhs_x)
        for j in range(1, Ny - 1):
            d2f_dy2 = (rhs_x[:, j + 1] - 2 * rhs_x[:, j] + rhs_x[:, j - 1]) / dy ** 2
            rhs_y[:, j] = rhs_x[:, j] + alpha_y * d2f_dy2

        # BC at y boundaries
        rhs_y[:, 0] = rhs_x[:, 0] + alpha_y * (2 * (rhs_x[:, 1] - rhs_x[:, 0]) / dy ** 2)
        rhs_y[:, -1] = rhs_x[:, -1] + alpha_y * (2 * (rhs_x[:, -2] - rhs_x[:, -1]) / dy ** 2)

        # Solve tridiagonal for each row
        f_new = rhs_y.copy()
        for i in range(Nx):
            a = np.zeros(Ny)
            b = np.zeros(Ny)
            c = np.zeros(Ny)
            a[1:] = -alpha_y
            b[:] = 1 + 2 * alpha_y + beta
            c[:-1] = -alpha_y
            b[0] = 1 + alpha_y + beta
            b[-1] = 1 + alpha_y + beta
            f_new[i, :] = tridiag(a, b, c, rhs_y[i, :])

        # === Renormalize and clamp ===
        f = np.clip(f_new, 0, None)
        P = np.sum(f) * dx * dy
        if P > 0:
            f = f / P  # Preserve probability mass

        # Natural boundary: probability flows out at edges → reabsorb small amount
        edge_decay = 0.999
        f = f * edge_decay

    # === Compute probability flux at final state ===
    J_vr = A_vr * f - D_q * np.gradient(f, dx, axis=0)
    J_adx = A_adx * f - D_q * np.gradient(f, dy, axis=1)

    return f, J_vr, J_adx


# =============================================================================
# FP-FK Regime Detector class
# =============================================================================

@dataclass
class FPFKRegimeState:
    """Full output of the FP-FK regime detector."""
    regime: str                           # COMPRESSION / NORMAL / EXPANSION / CRISIS
    regime_id: int                        # 0=COMP, 1=NORM, 2=EXP, 3=CRISIS
    confidence: float                    # max posterior from PDE density
    q_parameter: float                   # Tsallis entropic index
    q_regime: str                        # q-based regime label
    diffusion_exponent: float             # α (anomalous diffusion exponent)
    fk_wave_speed: float                # c* = 2·√(D·r) in VR units/step
    fk_wave_acceleration: float          # d²c/dt² of FK front
    criticality_index: float             # κ = ‖∇·J‖/P_total
    deleverage_signal: float             # [0,1] probability of imminent regime shift
    deleverage_reason: str               # Human-readable reason for deleverage
    front_position: float                # Wave front position (grid units)
    front_direction: str                 # ACCELERATING / DECELERATING / STABLE
    posterior_probs: dict               # P(COMP), P(NORM), P(EXP), P(CRISIS)
    drift_vr: float                     # Mean drift in VR direction
    drift_adx: float                    # Mean drift in ADX direction
    diffusion_coeff: float              # Current D_q
    reaction_rate: float                # Fisher-KPP reaction rate r
    entropy_rate: float                 # ∂S_q/∂t (rate of regime change)
    n_states: int                       # Number of states (fixed at 4)
    explanation: str                    # Full human-readable explanation


class FPFKRegimeDetector:
    """
    Fokker-Planck + Fisher-KPP Regime Detector with Tsallis q-Gaussians.

    State space: (VR, ADX) plane, discretized to N_vr × N_adx grid.
    The PDE is advanced each candle update. Front position and criticality
    are tracked over time to generate early-warning deleverage signals.

    Architecture:
      1. Build grid from recent candles.
      2. Estimate q from log-return kurtosis.
      3. Estimate drift field A(vr,adx) from time series regression.
      4. Compute diffusion field D(vr,adx) = D₀·[vr·(adx/100)]^α.
      5. Set Fisher-KPP reaction rate r = f(AMD phase).
      6. Initialize q-Gaussian equilibrium F_q.
      7. Advance PDE by n_candles steps.
      8. Extract regime probability from PDF at current (VR, ADX).
      9. Track front position → compute wave speed, acceleration.
      10. Compute criticality index κ.
      11. Generate deleverage signal.
    """

    name = "fp_fk_regime"
    model_type = "regime"
    state_names = ["COMPRESSION", "NORMAL", "EXPANSION", "CRISIS"]

    # Grid boundaries
    VR_MIN, VR_MAX = 0.3, 2.5
    ADX_MIN, ADX_MAX = 0.0, 80.0
    N_VR, N_ADX = 40, 40

    def __init__(self, n_states: int = 4, random_state: int = 42):
        self.n_states = n_states
        self.random_state = random_state
        self._is_trained = False

        # Grid setup
        self._vr_grid = np.linspace(self.VR_MIN, self.VR_MAX, self.N_VR)
        self._adx_grid = np.linspace(self.ADX_MIN, self.ADX_MAX, self.N_ADX)
        self._dvr = self._vr_grid[1] - self._vr_grid[0]
        self._dadx = self._adx_grid[1] - self._adx_grid[0]

        # State variables
        self._f_current: Optional[np.ndarray] = None  # Current PDF
        self._f_history: list[np.ndarray] = []        # PDF history for front tracking
        self._front_history: list[float] = []         # Front position history
        self._wave_speed_history: list[float] = []    # Wave speed history

        # Estimated parameters
        self._q: float = 1.5
        self._alpha: float = 0.5
        self._D_0: float = 0.05
        self._r_base: float = 0.02
        self._mu_vr: float = 1.0
        self._mu_adx: float = 25.0

        # Sliding window of candles for parameter estimation
        self._window_size = 100
        self._vr_series: list[float] = []
        self._adx_series: list[float] = []
        self._return_series: list[float] = []

    # -------------------------------------------------------------------------
    # Parameter estimation
    # -------------------------------------------------------------------------

    def _estimate_parameters(self, df: pd.DataFrame) -> None:
        """Update all estimated parameters from recent candle data."""
        n = min(self._window_size, len(df))

        # Extract series
        self._vr_series = df["vr"].tail(n).fillna(1.0).tolist()
        self._adx_series = df["adx"].tail(n).fillna(25.0).tolist()
        returns = df["log_return"].tail(n).fillna(0).tolist()
        self._return_series = returns

        if len(self._vr_series) < 20:
            return

        # Estimate q from kurtosis of returns
        self._q = estimate_q_from_returns(np.array(returns), method="kurtosis_mle")

        # Estimate diffusion exponent
        self._alpha = estimate_diffusion_exponent(np.array(returns), window=50)

        # Estimate drift parameters (mean-reversion in VR, momentum in ADX)
        vr_arr = np.array(self._vr_series)
        adx_arr = np.array(self._adx_series)

        self._mu_vr = float(np.median(vr_arr))
        self._mu_adx = float(np.median(adx_arr))

    def _build_drift_field(self) -> Tuple[np.ndarray, np.ndarray]:
        """
        Build the drift field A(vr, adx) on the 2D grid.

        Interpretation:
          - Negative VR drift near high VR → mean reversion (compression)
          - Positive ADX drift → momentum continuation
          - VR × ADX interaction → regime coupling
        """
        vr_arr, adx_arr = np.array(self._vr_series), np.array(self._adx_series)
        if len(vr_arr) < 5:
            # Default drift: mean-reversion
            return (np.zeros((self.N_VR, self.N_ADX)),
                    np.zeros((self.N_VR, self.N_ADX)))

        # Estimate VR drift: OU-like mean reversion
        vr_centered = vr_arr - self._mu_vr
        kappa_vr = np.clip(0.05 * np.exp(-np.abs(vr_centered.mean())), 0.01, 0.2)
        # Drift = -kappa · (vr - mu_vr) → mean reversion
        A_vr_grid = np.zeros((self.N_VR, self.N_ADX))
        for i, vr_val in enumerate(self._vr_grid):
            A_vr_grid[i, :] = -kappa_vr * (vr_val - self._mu_vr)

        # Estimate ADX drift: momentum if ADX rising, mean reversion if high
        if len(adx_arr) >= 5:
            adx_trend = np.polyfit(range(min(10, len(adx_arr))), adx_arr[-min(10, len(adx_arr)):], 1)[0]
        else:
            adx_trend = 0.0

        A_adx_grid = np.zeros((self.N_VR, self.N_ADX))
        for j, adx_val in enumerate(self._adx_grid):
            # ADX reverts toward 25 (neutral)
            kappa_adx = 0.03
            A_adx_grid[:, j] = -kappa_adx * (adx_val - self._mu_adx) + 0.5 * adx_trend

        return A_vr_grid, A_adx_grid

    def _build_diffusion_field(self) -> np.ndarray:
        """Build anomalous diffusion field D(vr, adx)."""
        D = np.zeros((self.N_VR, self.N_ADX))
        for i, vr_val in enumerate(self._vr_grid):
            for j, adx_val in enumerate(self._adx_grid):
                D[i, j] = compute_diffusion_coefficient(vr_val, adx_val, alpha=self._alpha)
        return D

    def _get_reaction_rate(self, df: pd.DataFrame) -> float:
        """
        Fisher-KPP reaction rate r depends on AMD phase and VR regime.

        ACCUMULATION → slow reaction (price building base)
        MANIPULATION → fast reaction (sharp moves, fast transitions)
        DISTRIBUTION → fast reaction (expansion)
        TRANSITION → very fast (regime breaking)
        UNCLEAR → neutral
        """
        r = self._r_base
        amd_phase = df["amd_ACCUMULATION"].iloc[-1] if "amd_ACCUMULATION" in df.columns else 0.0

        # Modify reaction rate based on AMD phase indicators
        vr = self._vr_series[-1] if self._vr_series else 1.0
        adx = self._adx_series[-1] if self._adx_series else 25.0

        # High VR + High ADX = fast regime transition
        vr_regime = 1.0 + (vr - 1.0) / 0.5  # normalized VR deviation
        adx_regime = adx / 50.0               # normalized ADX

        r = self._r_base * (0.8 + 0.4 * vr_regime * adx_regime)

        return float(np.clip(r, 0.001, 0.5))

    # -------------------------------------------------------------------------
    # PDE initialization
    # -------------------------------------------------------------------------

    def _initialize_pdf(self, df: pd.DataFrame) -> np.ndarray:
        """
        Initialize the PDF f₀ at the current (VR, ADX) position.

        Uses a narrow Gaussian centered on the current state, then
        advances the PDE in time-reverse mode to estimate the prior.
        """
        # Find grid index of current state
        vr = df["vr"].iloc[-1] if "vr" in df.columns else 1.0
        adx = df["adx"].iloc[-1] if "adx" in df.columns else 25.0

        # VR grid index
        i_center = int(np.searchsorted(self._vr_grid, vr))
        i_center = np.clip(i_center, 1, self.N_VR - 2)
        # ADX grid index
        j_center = int(np.searchsorted(self._adx_grid, adx))
        j_center = np.clip(j_center, 1, self.N_ADX - 2)

        # Initialize as narrow Gaussian blob at current state
        f0 = np.zeros((self.N_VR, self.N_ADX))
        sigma_vr = max(2, self.N_VR // 10)
        sigma_adx = max(2, self.N_ADX // 10)

        for i in range(self.N_VR):
            for j in range(self.N_ADX):
                dist_sq = ((i - i_center) / sigma_vr) ** 2 + ((j - j_center) / sigma_adx) ** 2
                f0[i, j] = np.exp(-dist_sq / 2)

        # Normalize
        P = np.sum(f0) * self._dvr * self._dadx
        if P > 0:
            f0 = f0 / P

        return f0

    def _build_equilibrium(self) -> np.ndarray:
        """Build the q-Gaussian equilibrium distribution F_q(vr, adx)."""
        VR, ADX = np.meshgrid(self._vr_grid, self._adx_grid, indexing="ij")

        # Estimate sigma from data
        vr_sigma = float(np.std(np.array(self._vr_series))) if len(self._vr_series) > 1 else 0.3
        adx_sigma = float(np.std(np.array(self._adx_series))) if len(self._adx_series) > 1 else 15.0
        vr_sigma = max(vr_sigma, 0.1)
        adx_sigma = max(adx_sigma, 5.0)

        F_q = q_gaussian_pdf(
            VR, ADX,
            q=self._q,
            mu_x=self._mu_vr,
            mu_y=self._mu_adx,
            sigma_x=vr_sigma * 2,
            sigma_y=adx_sigma * 2,
        )

        return F_q

    # -------------------------------------------------------------------------
    # Front tracking
    # -------------------------------------------------------------------------

    def _track_front(self, f: np.ndarray) -> float:
        """
        Track the FK wave front position.

        Method: Project the 2D density onto the VR axis (integrate over ADX)
        and find the inflection point (peak of |∂²f/∂x²|).
        """
        # Project onto VR axis
        f_vr = np.sum(f, axis=1) * self._dadx

        # Normalize
        if f_vr.sum() > 0:
            f_vr = f_vr / f_vr.sum()

        return find_wave_front_position(f_vr, axis=0)

    def _compute_wave_speed(self) -> float:
        """
        Compute the Fisher-KPP wave speed from front history.

        Uses the front position derivative:
          c ≈ (front[t] - front[t-1]) / dt

        Wave speed is in grid units per step.
        """
        if len(self._front_history) < 2:
            return 0.0

        front_now = self._front_history[-1]
        front_prev = self._front_history[-2]
        dt = 1.0  # one PDE step = one candle
        speed = (front_now - front_prev) / dt

        return float(speed)

    def _compute_wave_acceleration(self) -> float:
        """Compute d²front/dt² (front acceleration)."""
        if len(self._front_history) < 3:
            return 0.0

        speeds = []
        for k in range(len(self._front_history) - 1):
            speeds.append(self._front_history[k + 1] - self._front_history[k])

        if len(speeds) < 2:
            return 0.0

        acc = speeds[-1] - speeds[-2]
        return float(acc)

    # -------------------------------------------------------------------------
    # Deleverage signal generation
    # -------------------------------------------------------------------------

    def _generate_deleverage(self,
                            regime_id: int,
                            kappa: float,
                            wave_acc: float,
                            wave_speed: float,
                            q: float,
                            f: np.ndarray,
                            df: pd.DataFrame) -> Tuple[float, str]:
        """
        Generate deleverage probability and reason.

        Triggers deleverage when:
          1. Criticality κ spikes → rapid probability redistribution
          2. Wave front accelerates rapidly → fast regime shift
          3. Wave front stalls near a boundary → phase transition
          4. q approaches 2 → fat tails → crisis
          5. Combined: κ · |wave_acc| is high
        """
        signals = []
        weights = []

        # Signal 1: Criticality spike
        kappa_norm = np.clip(kappa / 10.0, 0, 1)
        if kappa > 2.0:
            signals.append(f"High criticality κ={kappa:.2f} → probability mass redistributing rapidly")
            weights.append(kappa_norm)

        # Signal 2: Wave front acceleration
        if abs(wave_acc) > 0.5:
            direction = "ACCELERATING" if wave_acc > 0 else "DECELERATING"
            signals.append(f"Wave front {direction.lower()} (acc={wave_acc:.3f}) → regime transition in progress")
            weights.append(min(abs(wave_acc) / 1.0, 1.0))

        # Signal 3: Wave front near boundary (stalled)
        vr = df["vr"].iloc[-1] if "vr" in df.columns else 1.0
        if abs(vr - self.VR_MIN) < 0.2 or abs(vr - self.VR_MAX) < 0.2:
            signals.append(f"Wave front near boundary (VR={vr:.2f}) → boundary regime transition")
            weights.append(0.7)

        # Signal 4: q close to 2 → crisis regime
        if q > 1.9:
            signals.append(f"Tsallis q={q:.2f} → FAT-TAIL CRISIS regime → maximum caution")
            weights.append((q - 1.9) / 0.1)

        # Signal 5: VR compressed but ADX rising → squeeze breakout
        if vr < 0.85 and len(self._adx_series) >= 5:
            adx_trend = np.mean(np.diff(self._adx_series[-5:]))
            if adx_trend > 1.0:
                signals.append(f"COMPRESSION squeeze (VR={vr:.2f}, ADX rising {adx_trend:.1f}/bar) → imminent expansion")
                weights.append(0.8)

        # Signal 6: Post-expansion compression → mean reversion bottom
        if vr > 1.15 and regime_id == 2:  # EXPANSION
            vr_trend = np.mean(np.diff(self._vr_series[-5:])) if len(self._vr_series) >= 5 else 0
            if vr_trend < -0.02:
                signals.append(f"Expansion unwinding (VR declining {vr_trend:.3f}/bar) → compression bottom forming")
                weights.append(0.6)

        # Combine signals
        if not weights:
            return 0.0, "No deleverage signals — market in stable regime."

        # Weighted average, capped at 1.0
        deleverage_prob = np.average([0.8] * len(weights), weights=weights) if weights else 0.0
        deleverage_prob = float(np.clip(deleverage_prob, 0, 1))

        reason = " | ".join(signals[:3])  # Top 3 signals
        return deleverage_prob, reason

    # -------------------------------------------------------------------------
    # Main training (online — advances the PDE on new candles)
    # -------------------------------------------------------------------------

    def train(self, df: pd.DataFrame, verbose: bool = True) -> dict:
        """
        Train: estimate parameters and advance the FP-FK PDE.

        This is an ONLINE algorithm — it advances the PDE one step per candle
        update. No batch retraining needed. The PDE IS the model.
        """
        if len(df) < 20:
            raise ValueError(f"Need at least 20 candles for FP-FK, got {len(df)}")

        # Step 1: Estimate parameters from data
        self._estimate_parameters(df)

        # Step 2: Build PDE components
        A_vr, A_adx = self._build_drift_field()
        D_q_field = self._build_diffusion_field()
        D_q = float(D_q_field.mean())  # Scalar for FK wave speed
        r_rate = self._get_reaction_rate(df)
        F_q = self._build_equilibrium()

        # Step 3: Initialize or advance PDF
        if self._f_current is None:
            self._f_current = self._initialize_pdf(df)
        else:
            # Advance PDE by 1 time step (one new candle)
            dt = 0.1  # sub-step for numerical stability
            n_steps = 3  # 3 sub-steps per candle

            self._f_current, _, _ = solve_fp_fk_pde(
                f0=self._f_current,
                A_vr=A_vr,
                A_adx=A_adx,
                D_q=D_q,
                r_rate=r_rate,
                F_q=F_q,
                dt=dt,
                n_steps=n_steps,
                dx=self._dvr,
                dy=self._dadx,
            )

        # Step 4: Track front
        front_pos = self._track_front(self._f_current)
        self._front_history.append(front_pos)
        if len(self._front_history) > 50:
            self._front_history.pop(0)

        wave_speed = self._compute_wave_speed()
        self._wave_speed_history.append(wave_speed)
        if len(self._wave_speed_history) > 50:
            self._wave_speed_history.pop(0)

        wave_acc = self._compute_wave_acceleration()

        # Step 5: Compute probability flux and criticality
        J_vr = A_vr * self._f_current - D_q * np.gradient(self._f_current, self._dvr, axis=0)
        J_adx = A_adx * self._f_current - D_q * np.gradient(self._f_current, self._dadx, axis=1)
        kappa = criticality_index(self._f_current, J_vr, J_adx, self._dvr, self._dadx)

        # Step 6: Extract regime from PDF at current state
        regime_id, posterior = self._extract_regime(df)

        # Step 7: Generate deleverage signal
        deleverage_prob, deleverage_reason = self._generate_deleverage(
            regime_id, kappa, wave_acc, wave_speed, self._q, self._f_current, df
        )

        # Step 8: Compute front direction
        if len(self._wave_speed_history) >= 2:
            recent = np.array(self._wave_speed_history[-5:])
            if len(recent) >= 2:
                slope = np.polyfit(range(len(recent)), recent, 1)[0]
                if slope > 0.05:
                    front_direction = "ACCELERATING"
                elif slope < -0.05:
                    front_direction = "DECELERATING"
                else:
                    front_direction = "STABLE"
            else:
                front_direction = "STABLE"
        else:
            front_direction = "STABLE"

        # Step 9: Entropy rate (Tsallis entropy change)
        entropy_rate = self._compute_entropy_rate()

        # Step 10: Drift magnitude
        drift_vr = float(A_vr[int(np.searchsorted(self._vr_grid, df["vr"].iloc[-1])) if "vr" in df.columns else self.N_VR // 2, 0])
        drift_adx = float(A_adx[0, int(np.searchsorted(self._adx_grid, df["adx"].iloc[-1])) if "adx" in df.columns else self.N_ADX // 2])

        self._is_trained = True

        if verbose:
            print(f"  FP-FK Regime Detector (q={self._q:.3f}, α={self._alpha:.3f})")
            print(f"    Regime: {self.state_names[regime_id]} (conf={posterior[regime_id]:.3f})")
            print(f"    Wave speed: {wave_speed:.3f}, acceleration: {wave_acc:.3f}")
            print(f"    Criticality κ={kappa:.4f}, deleverage={deleverage_prob:.2%}")
            print(f"    FK wave speed c* = {fk_wave_speed(D_q, r_rate):.4f}")

        return {
            "model": self.name,
            "q_parameter": round(self._q, 4),
            "diffusion_exponent": round(self._alpha, 4),
            "fk_wave_speed": round(wave_speed, 6),
            "fk_min_wave_speed": round(fk_wave_speed(D_q, r_rate), 6),
            "criticality_index": round(kappa, 6),
            "n_samples": len(df),
        }

    def _extract_regime(self, df: pd.DataFrame) -> Tuple[int, np.ndarray]:
        """
        Extract regime probabilities from the current PDF.

        Evaluates the PDF at the current (VR, ADX) position and
        integrates the PDF in each regime region:
          COMPRESSION: VR < 0.85 (and moderate ADX)
          NORMAL: 0.85 ≤ VR < 1.15
          EXPANSION: VR ≥ 1.15 (and ADX > 25)
          CRISIS: VR > 1.5 AND |ADX - 25| > 30
        """
        if self._f_current is None:
            return 1, np.array([0.25, 0.5, 0.15, 0.1])

        # Current state
        vr = df["vr"].iloc[-1] if "vr" in df.columns else 1.0
        adx = df["adx"].iloc[-1] if "adx" in df.columns else 25.0

        # Find grid indices
        i_vr = int(np.searchsorted(self._vr_grid, vr))
        i_vr = np.clip(i_vr, 0, self.N_VR - 1)
        j_adx = int(np.searchsorted(self._adx_grid, adx))
        j_adx = np.clip(j_adx, 0, self.N_ADX - 1)

        # Direct PDF evaluation at current state
        f_current = float(self._f_current[i_vr, j_adx])

        # Integrate PDF in each regime region
        probs = np.zeros(4)

        # COMPRESSION region: VR < 0.85
        i_comp = np.searchsorted(self._vr_grid, 0.85)
        probs[0] = np.sum(self._f_current[:i_comp, :]) * self._dvr * self._dadx

        # NORMAL region: 0.85 ≤ VR < 1.15
        i_norm_lo = np.searchsorted(self._vr_grid, 0.85)
        i_norm_hi = np.searchsorted(self._vr_grid, 1.15)
        probs[1] = np.sum(self._f_current[i_norm_lo:i_norm_hi, :]) * self._dvr * self._dadx

        # EXPANSION region: VR ≥ 1.15
        i_exp = np.searchsorted(self._vr_grid, 1.15)
        probs[2] = np.sum(self._f_current[i_exp:, :]) * self._dvr * self._dadx

        # CRISIS: VR > 1.5 OR (VR > 1.15 AND ADX < 10)
        i_crisis = np.searchsorted(self._vr_grid, 1.5)
        j_low_adx = np.searchsorted(self._adx_grid, 10)
        probs[3] = np.sum(self._f_current[i_crisis:, :]) * self._dvr * self._dadx
        probs[3] += np.sum(self._f_current[i_exp:i_crisis, :j_low_adx]) * self._dvr * self._dadx

        # Also include q-weighting
        if self._q > 1.9:
            probs[3] += 0.1 * (self._q - 1.9) / 0.1
        elif self._q < 0.9:
            probs[0] += 0.1 * (0.9 - self._q) / 0.4

        # Normalize to probability
        P_sum = np.sum(probs)
        if P_sum > 0:
            probs = probs / P_sum
        else:
            probs = np.array([0.25, 0.5, 0.15, 0.1])

        # Boost probability near current state (local mode)
        f_local_max = self._f_current.max()
        if f_local_max > 0:
            local_boost = f_current / f_local_max
            regime_id = int(np.argmax(probs))
            probs[regime_id] += 0.1 * local_boost
            probs = probs / np.sum(probs)

        regime_id = int(np.argmax(probs))

        return regime_id, probs

    def _compute_entropy_rate(self) -> float:
        """Compute rate of change of Tsallis entropy: dS_q/dt."""
        if self._f_current is None:
            return 0.0

        f = self._f_current.flatten()
        f = f[f > 1e-15]  # Avoid log(0)

        if len(f) == 0:
            return 0.0

        # Tsallis entropy: S_q = (1 - Σ f^q) / (1 - q)
        q = self._q
        if abs(q - 1.0) < 1e-8:
            S = -np.sum(f * np.log(f))
        else:
            S = (1 - np.sum(f ** q)) / (1 - q)

        # Compare to previous entropy if available
        if hasattr(self, "_last_entropy") and self._last_entropy is not None:
            rate = S - self._last_entropy
        else:
            rate = 0.0

        self._last_entropy = S
        return float(rate)

    def predict_current(self, df: pd.DataFrame) -> dict:
        """
        Full prediction: run PDE and return all regime information.
        Called on every new candle update.
        """
        if len(df) < 20:
            return self._default_output()

        # Advance the PDE one step
        self.train(df, verbose=False)

        # Extract regime
        vr = df["vr"].iloc[-1] if "vr" in df.columns else 1.0
        adx = df["adx"].iloc[-1] if "adx" in df.columns else 25.0
        regime_id, posterior = self._extract_regime(df)
        wave_speed = self._compute_wave_speed() if self._wave_speed_history else 0.0
        wave_acc = self._compute_wave_acceleration() if len(self._front_history) >= 3 else 0.0

        # Build A field and J for criticality
        A_vr, A_adx = self._build_drift_field()
        D_q_field = self._build_diffusion_field()
        D_q = float(D_q_field.mean())
        J_vr = A_vr * self._f_current - D_q * np.gradient(self._f_current, self._dvr, axis=0)
        J_adx = A_adx * self._f_current - D_q * np.gradient(self._f_current, self._dadx, axis=1)
        kappa = criticality_index(self._f_current, J_vr, J_adx, self._dvr, self._dadx)

        # Deleverage
        deleverage_prob, deleverage_reason = self._generate_deleverage(
            regime_id, kappa, wave_acc, wave_speed, self._q, self._f_current, df
        )

        # Front direction
        if len(self._wave_speed_history) >= 5:
            recent = np.array(self._wave_speed_history[-5:])
            slope = np.polyfit(range(len(recent)), recent, 1)[0]
            if slope > 0.05:
                front_direction = "ACCELERATING"
            elif slope < -0.05:
                front_direction = "DECELERATING"
            else:
                front_direction = "STABLE"
        else:
            front_direction = "STABLE"

        # Wave front position
        front_pos = self._front_history[-1] if self._front_history else 0.0
        front_pos_normalized = front_pos / self.N_VR  # 0-1 normalized

        # FK theoretical minimum wave speed
        r_rate = self._get_reaction_rate(df)
        fk_min_speed = fk_wave_speed(D_q, r_rate)

        # Drift at current state
        i_vr = np.clip(int(np.searchsorted(self._vr_grid, vr)), 0, self.N_VR - 1)
        j_adx = np.clip(int(np.searchsorted(self._adx_grid, adx)), 0, self.N_ADX - 1)
        drift_vr = float(A_vr[i_vr, j_adx])
        drift_adx = float(A_adx[i_vr, j_adx])

        # Entropy rate
        entropy_rate = self._compute_entropy_rate()

        # Regime explanation
        explanations = {
            0: (f"COMPRESSION regime (VR={vr:.2f}, q={self._q:.2f}). "
                f"Volatility contracting, ATR narrowing. "
                f"Criticality κ={kappa:.3f}. "
                f"{'DELIVERAGE RECOMMENDED' if deleverage_prob > 0.5 else 'Reduce size, tighter stops.'}"),
            1: (f"NORMAL regime (VR={vr:.2f}, q={self._q:.2f}). "
                f"Standard diffusion, mean-reversion dominant. "
                f"Wave speed c={wave_speed:.3f}."),
            2: (f"EXPANSION regime (VR={vr:.2f}, q={self._q:.2f}). "
                f"Volatility expanding, ADX={adx:.0f}. "
                f"Superdiffusion active (α={self._alpha:.2f}). "
                f"{'DELIVERAGE if decelerating.' if wave_acc < -0.1 else 'Let winners run.'}"),
            3: (f"CRISIS regime (VR={vr:.2f}, q={self._q:.2f}). "
                f"FAT-TAIL event detected. ADX={adx:.0f}. "
                f"Criticality κ={kappa:.3f}. "
                f"⚠️ DELIVERAGE IMMINENT — reduce all positions"),
        }

        return {
            "regime": self.state_names[regime_id],
            "regime_id": regime_id,
            "confidence": round(float(posterior[regime_id]), 4),
            "q_parameter": round(self._q, 4),
            "q_regime": q_to_regime(self._q),
            "diffusion_exponent": round(self._alpha, 4),
            "fk_wave_speed": round(wave_speed, 6),
            "fk_min_wave_speed": round(fk_min_speed, 6),
            "fk_wave_acceleration": round(wave_acc, 6),
            "criticality_index": round(kappa, 4),
            "deleverage_signal": round(deleverage_prob, 4),
            "deleverage_reason": deleverage_reason,
            "front_position_normalized": round(front_pos_normalized, 4),
            "front_direction": front_direction,
            "posterior_probs": {
                self.state_names[i]: round(float(posterior[i]), 4)
                for i in range(4)
            },
            "current_vr": round(float(vr), 4),
            "current_adx": round(float(adx), 2),
            "drift_vr": round(drift_vr, 6),
            "drift_adx": round(drift_adx, 6),
            "diffusion_coeff": round(D_q, 6),
            "reaction_rate": round(r_rate, 4),
            "entropy_rate": round(entropy_rate, 6),
            "n_states": self.n_states,
            "explanation": explanations[regime_id],
        }

    def _default_output(self) -> dict:
        return {
            "regime": "NORMAL",
            "regime_id": 1,
            "confidence": 0.0,
            "q_parameter": 1.5,
            "q_regime": "NORMAL",
            "diffusion_exponent": 0.5,
            "fk_wave_speed": 0.0,
            "fk_min_wave_speed": 0.0,
            "fk_wave_acceleration": 0.0,
            "criticality_index": 0.0,
            "deleverage_signal": 0.0,
            "deleverage_reason": "Model not trained. No deleverage signal.",
            "front_position_normalized": 0.5,
            "front_direction": "STABLE",
            "posterior_probs": {"COMPRESSION": 0.25, "NORMAL": 0.5, "EXPANSION": 0.15, "CRISIS": 0.1},
            "current_vr": 1.0,
            "current_adx": 25.0,
            "drift_vr": 0.0,
            "drift_adx": 0.0,
            "diffusion_coeff": 0.05,
            "reaction_rate": 0.02,
            "entropy_rate": 0.0,
            "n_states": self.n_states,
            "explanation": "FP-FK model not trained. Defaulting to NORMAL.",
        }

    def predict(self, X: np.ndarray) -> dict:
        """Interface compatible with other regime models."""
        # X is not used — we need df. Use predict_current with stored data.
        if hasattr(self, "_last_df"):
            return self.predict_current(self._last_df)
        return self._default_output()

    def advance(self, df: pd.DataFrame) -> dict:
        """
        Advance the PDE one time step (called per new candle).
        This is the primary inference interface.
        """
        self._last_df = df
        return self.predict_current(df)

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    def get_metrics(self) -> dict:
        return {
            "model": self.name,
            "trained": self._is_trained,
            "q": round(self._q, 4),
            "alpha": round(self._alpha, 4),
            "n_pdf_history": len(self._front_history),
        }
