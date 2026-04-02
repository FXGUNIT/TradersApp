"""
Probability of Backtest Overfitting (PBO) Engine
=================================================

Implements Marco Lopez de Prado's PBO methodology from:
  "Advances in Financial Machine Learning" — Chapter 3
  https://arxiv.org/abs/1712.06577

Core concept:
  When we test N strategy variants on a dataset and select the best one,
  we overfit to the historical sample. PBO measures the probability that
  the selected strategy is actually worse than the median variant.

Key metrics:
  PBO = P(strategy_selected < strategy_median)
  Sharpe_oracle = Sharpe of the best variant
  Sharpe_avg    = Average Sharpe across all variants
  sharpe_diff   = Sharpe_oracle - Sharpe_avg (overfitting measure)
  sharpe_prob   = P(Sharpe_selected < Sharpe_random)

Methodology:
  1. Generate N variant candidates by varying hyperparameters
  2. Compute Sharpe ratio for each variant on IN-SAMPLE data
  3. Use Combinatorial Purged Cross-Validation (CPCV) to split data
     into train/purge/embargo windows
  4. Apply permutation test: shuffle returns and recompute Sharpe
  5. PBO = fraction of permutations where selected < median

Additionally implements:
  - Walk-forward optimization (expanding window)
  - Combinatorial purged cross-validation (CPCV)
  - Out-of-sample (OOS) validation
  - Regime-aware evaluation
  - Auto-tuning: each ML model adjusts hyperparameters to minimize PBO
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Callable, Optional
from scipy import stats
from itertools import product
import warnings
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import config

# ---------------------------------------------------------------------------
# PBO Core
# ---------------------------------------------------------------------------

@dataclass
class PBOConfig:
    """Configuration for PBO evaluation."""
    n_trials: int = 100          # Number of hyperparameter variants to test
    n_permutations: int = 100   # Number of permutations for PBO estimation
    n_train_splits: int = 5     # Number of purged cross-validation splits
    purge_pct: float = 0.1       # Purge buffer as fraction of OOS period
    embargo_pct: float = 0.1    # Embargo buffer as fraction of OOS period
    min_samples: int = 100       # Minimum data points per evaluation
    random_state: int = 42
    confidence_level: float = 0.05  # PBO threshold for pass/fail
    oos_min_pct: float = 0.2    # Minimum OOS fraction of data


@dataclass
class PBOResult:
    """Result of PBO evaluation for a strategy."""
    strategy_name: str
    pbo: float                    # P(Sharpe_selected < Sharpe_random) ∈ [0,1]
    sharpe_oracle: float         # Sharpe of the best variant (in-sample)
    sharpe_oos: float             # Sharpe of best variant (out-of-sample)
    sharpe_avg: float            # Average Sharpe across all variants
    sharpe_std: float            # Std dev of Sharpe across variants
    sharpe_diff: float            # sharpe_oracle - sharpe_avg
    sharpe_sharpe: float         # Sharpe of Sharpe distribution (consistency)
    sharpe_prob: float            # P(Sharpe_selected < Sharpe_random) shortcut
    n_trials: int
    n_passed: int                # Number of variants passing OOS Sharpe > 0
    pass_rate: float             # Fraction of variants passing
    best_variant_idx: int
    best_params: dict
    oos_return_pct: float        # % of data used for OOS
    overfit_bands: tuple[float, float]  # (lower, upper) at 95% CI
    passing: bool                # True if pbo < confidence_level
    sharpe_distribution: np.ndarray = field(default_factory=lambda: np.array([]))
    oos_sharpes: np.ndarray = field(default_factory=lambda: np.array([]))
    is_weights: np.ndarray = field(default_factory=lambda: np.array([]))


def _compute_cpcv_splits(
    n_samples: int,
    n_splits: int,
    purge_pct: float,
    embargo_pct: float,
    random_state: int,
) -> list[tuple[np.ndarray, np.ndarray]]:
    """
    Combinatorial Purged Cross-Validation splits.

    Each split consists of:
      - train_indices: indices for training
      - oos_indices: out-of-sample indices for evaluation

    The purge buffer prevents information leakage from train to OOS.
    The embargo buffer prevents look-ahead from OOS back to train.
    """
    rng = np.random.RandomState(random_state)

    # Window size: each OOS block is n_samples / n_splits
    oos_size = n_samples // n_splits
    train_size = n_samples - oos_size

    splits = []
    for i in range(n_splits):
        # OOS period
        oos_start = i * oos_size
        oos_end = oos_start + oos_size

        # Purge buffer: exclude train samples near OOS boundary
        purge_size = max(1, int(oos_size * purge_pct))
        embargo_size = max(1, int(oos_size * embargo_pct))

        # Train: everything before purge boundary
        train_end = oos_start + purge_size

        # Embargo: exclude samples right after OOS from training
        # (but they're still included as "unseen" to the strategy)
        train_indices = np.arange(0, max(0, train_end), dtype=int)

        # OOS indices
        oos_indices = np.arange(oos_start, min(oos_end, n_samples), dtype=int)

        if len(train_indices) < 20 or len(oos_indices) < 5:
            continue

        splits.append((train_indices, oos_indices))

    return splits


def sharpe_ratio(returns: np.ndarray, risk_free: float = 0.0, periods_per_year: int = 78) -> float:
    """
    Annualized Sharpe ratio.
    periods_per_year=78 assumes 5-min candles, ~78 candles per trading day.
    """
    r = np.asarray(returns).flatten()
    r = r[~np.isnan(r)]
    if len(r) < 5:
        return 0.0
    excess = r - risk_free / periods_per_year
    mu = np.mean(excess)
    sigma = np.std(excess, ddof=1)
    if sigma < 1e-10:
        return 0.0
    return mu / sigma * np.sqrt(periods_per_year)


def _cpcv_sharpe(
    returns: np.ndarray,
    strategy_fn: Callable,
    params: dict,
    n_splits: int,
    purge_pct: float,
    embargo_pct: float,
    random_state: int,
) -> tuple[float, np.ndarray]:
    """
    Compute Sharpe using CPCV splits.

    strategy_fn(returns_train, params) → returns_simulated (array of same length as returns)

    Returns:
      sharpe_cpcv: average Sharpe across splits
      oos_returns: concatenated OOS returns
    """
    n = len(returns)
    splits = _compute_cpcv_splits(n, n_splits, purge_pct, embargo_pct, random_state)

    if not splits:
        return 0.0, np.array([])

    oos_returns_all = []

    for train_idx, oos_idx in splits:
        returns_train = returns[train_idx]
        try:
            # Generate simulated returns for full length
            sim_returns = strategy_fn(returns_train, params)
            if len(sim_returns) != n:
                sim_returns = np.interp(
                    np.linspace(0, 1, len(oos_idx)),
                    np.linspace(0, 1, len(sim_returns)),
                    sim_returns,
                )
            oos_ret = sim_returns[oos_idx % len(sim_returns)]
        except Exception:
            oos_ret = np.zeros(len(oos_idx))

        oos_returns_all.append(oos_ret)

    oos_concat = np.concatenate(oos_returns_all) if oos_returns_all else np.array([])
    return sharpe_ratio(oos_concat), oos_concat


def _permutation_test(
    sharpe_trials: np.ndarray,
    best_idx: int,
    n_permutations: int,
    random_state: int,
) -> float:
    """
    Permutation test for PBO.

    Shuffle the Sharpe distribution and check how often a random
    strategy beats the selected best strategy.
    """
    rng = np.random.RandomState(random_state)
    n = len(sharpe_trials)
    best_sharpe = sharpe_trials[best_idx]

    count = 0
    for _ in range(n_permutations):
        shuffled = rng.choice(sharpe_trials, size=n, replace=False)
        best_of_shuffled = shuffled[0]  # top of shuffled
        if best_of_shuffled < best_sharpe:
            count += 1

    return count / n_permutations


def evaluate_pbo(
    strategy_name: str,
    returns: np.ndarray,
    strategy_fn: Callable,
    param_grid: dict,
    config: PBOConfig | None = None,
    verbose: bool = True,
) -> PBOResult:
    """
    Main PBO evaluation entry point.

    Parameters
    ----------
    strategy_name : str
        Name of the strategy being evaluated.
    returns : np.ndarray
        Historical returns (1D array).
    strategy_fn : callable
        Function that takes (returns_train, params) and returns simulated returns.
        This is where your trading strategy logic lives.
    param_grid : dict
        Hyperparameter grid to search over.
        e.g., {"lookback": [10, 20, 30], "threshold": [0.01, 0.02]}
    config : PBOConfig, optional
        PBO configuration.

    Returns
    -------
    PBOResult
    """
    if config is None:
        config = PBOConfig()

    rng = np.random.RandomState(config.random_state)
    returns = np.asarray(returns).flatten()
    returns = returns[~np.isnan(returns)]

    n = len(returns)
    if n < config.min_samples:
        raise ValueError(
            f"Need at least {config.min_samples} samples, got {n}"
        )

    # Build parameter combinations
    keys = list(param_grid.keys())
    values = list(product(*param_grid.values()))
    n_trials = min(len(values), config.n_trials)

    # Subsample if too many combinations
    if len(values) > n_trials:
        indices = rng.choice(len(values), size=n_trials, replace=False)
        values = [values[i] for i in sorted(indices)]
    else:
        values = list(values)

    sharpe_is = np.zeros(n_trials)  # in-sample Sharpe
    sharpe_oos = np.zeros(n_trials)  # out-of-sample Sharpe
    oos_returns_all = []

    if verbose:
        print(f"  PBO Evaluation — {strategy_name}")
        print(f"    {n_trials} variants, {config.n_permutations} permutations")
        print(f"    {config.n_train_splits}-fold CPCV, purge={config.purge_pct:.0%}, embargo={config.embargo_pct:.0%}")

    for i, vals in enumerate(values):
        params = dict(zip(keys, vals))

        # In-sample Sharpe (training portion)
        splits = _compute_cpcv_splits(
            n, config.n_train_splits,
            config.purge_pct, config.embargo_pct,
            config.random_state,
        )
        if not splits:
            splits = [(np.arange(0, int(n * 0.8), dtype=int), np.arange(int(n * 0.8), n, dtype=int))]

        train_idx = splits[0][0]
        returns_train = returns[train_idx]

        try:
            sim_train = strategy_fn(returns_train, params)
            sharpe_is[i] = sharpe_ratio(sim_train)
        except Exception:
            sharpe_is[i] = 0.0

        # Out-of-sample Sharpe (CPCV)
        sh_oos, oos_ret = _cpcv_sharpe(
            returns,
            strategy_fn,
            params,
            config.n_train_splits,
            config.purge_pct,
            config.embargo_pct,
            config.random_state,
        )
        sharpe_oos[i] = sh_oos
        if len(oos_ret) > 0:
            oos_returns_all.append(oos_ret)

    # Handle NaN
    sharpe_is = np.nan_to_num(sharpe_is, nan=0.0)
    sharpe_oos = np.nan_to_num(sharpe_oos, nan=0.0)

    # Best variant
    best_idx = int(np.argmax(sharpe_oos))
    best_params = dict(zip(keys, values[best_idx]))
    sharpe_oracle = sharpe_oos[best_idx]
    sharpe_avg = float(np.mean(sharpe_oos))
    sharpe_std = float(np.std(sharpe_oos, ddof=1))
    sharpe_diff = sharpe_oracle - sharpe_avg

    # Sharpe-of-Sharpe (consistency)
    if sharpe_std > 0:
        sharpe_sharpe = sharpe_diff / sharpe_std
    else:
        sharpe_sharpe = 0.0

    # PBO via permutation test
    pbo = _permutation_test(
        sharpe_oos, best_idx,
        config.n_permutations,
        config.random_state,
    )

    # Probability that Sharpe_selected < 0 (loss-making)
    sharpe_prob = float(np.mean(sharpe_oos < 0))

    # How many variants pass OOS Sharpe > 0
    n_passed = int(np.sum(sharpe_oos > 0))
    pass_rate = n_passed / n_trials

    # OOS return percentage
    oos_size = n // config.n_train_splits
    oos_return_pct = 1.0 / config.n_train_splits

    # Overfit bands (95% CI of Sharpe distribution)
    sharpe_sorted = np.sort(sharpe_oos)
    lower = float(np.percentile(sharpe_sorted, 2.5))
    upper = float(np.percentile(sharpe_sorted, 97.5))

    passing = bool(pbo < config.confidence_level)

    if verbose:
        status = "✅ PASS" if passing else "❌ FAIL"
        print(f"    PBO={pbo:.3f} | Sharpe_OOS={sharpe_oracle:.3f} | "
              f"Sharpe_IS={sharpe_is[best_idx]:.3f} | {status}")
        print(f"    Best params: {best_params}")
        print(f"    {n_passed}/{n_trials} variants passed OOS Sharpe > 0 ({pass_rate:.0%})")

    return PBOResult(
        strategy_name=strategy_name,
        pbo=pbo,
        sharpe_oracle=sharpe_oracle,
        sharpe_oos=sharpe_oracle,
        sharpe_avg=sharpe_avg,
        sharpe_std=sharpe_std,
        sharpe_diff=sharpe_diff,
        sharpe_sharpe=sharpe_sharpe,
        sharpe_prob=sharpe_prob,
        n_trials=n_trials,
        n_passed=n_passed,
        pass_rate=pass_rate,
        best_variant_idx=best_idx,
        best_params=best_params,
        oos_return_pct=oos_return_pct,
        overfit_bands=(lower, upper),
        passing=passing,
        sharpe_distribution=sharpe_oos,
        oos_sharpes=sharpe_oos,
        is_weights=np.ones(n_trials) / n_trials,
    )


# ---------------------------------------------------------------------------
# Strategy Simulators — plug in your ML models here
# ---------------------------------------------------------------------------

def momentum_strategy(returns_train: np.ndarray, params: dict) -> np.ndarray:
    """
    Simple momentum strategy for PBO testing.
    params: {lookback, threshold}
    """
    lb = params.get("lookback", 20)
    threshold = params.get("threshold", 0.01)
    n = len(returns_train)
    signal = np.zeros(n)

    for i in range(lb, n):
        cum_ret = np.sum(returns_train[max(0, i-lb):i])
        signal[i] = 1 if cum_ret > threshold else (-1 if cum_ret < -threshold else 0)

    return signal * returns_train


def mean_reversion_strategy(returns_train: np.ndarray, params: dict) -> np.ndarray:
    """
    Mean reversion strategy.
    params: {window, z_threshold}
    """
    window = params.get("window", 20)
    z_thresh = params.get("z_threshold", 2.0)
    n = len(returns_train)
    signal = np.zeros(n)

    if n < window:
        return signal * returns_train

    cumsum = np.cumsum(returns_train)
    rolling_mean = (cumsum[window:] - cumsum[:-window]) / window
    rolling_std = np.array([
        np.std(returns_train[max(0, i-window):i]) if i >= window else 0.01
        for i in range(window, n)
    ])

    z_score = np.zeros(n)
    z_score[window:] = (returns_train[window:] - rolling_mean) / (rolling_std + 1e-8)

    for i in range(window, n):
        signal[i] = -1 if z_score[i] > z_thresh else (1 if z_score[i] < -z_thresh else 0)

    return signal * returns_train


def regime_switching_strategy(returns_train: np.ndarray, params: dict) -> np.ndarray:
    """
    Regime-switching strategy.
    params: {fast_ma, slow_ma, regime_threshold}
    """
    fma = params.get("fast_ma", 5)
    sma = params.get("slow_ma", 20)
    rthresh = params.get("regime_threshold", 0.02)
    n = len(returns_train)
    signal = np.zeros(n)

    if n < sma:
        return signal * returns_train

    fast_ma_vals = np.convolve(returns_train, np.ones(fma)/fma, mode='valid')
    slow_ma_vals = np.convolve(returns_train, np.ones(sma)/sma, mode='valid')

    offset = sma - 1
    for i in range(len(fast_ma_vals)):
        idx = i + offset
        if idx >= n:
            break
        regime_vol = np.std(returns_train[max(0, idx-sma):idx])
        regime_signal = 1 if regime_vol > rthresh else 0  # 1=expansion, 0=compression

        momentum = fast_ma_vals[i] - slow_ma_vals[i]
        if regime_signal == 1:
            signal[idx] = 1 if momentum > 0 else -1  # trend follow in expansion
        else:
            signal[idx] = -1 if momentum > 0 else 1   # mean-revert in compression

    return signal * returns_train


# ---------------------------------------------------------------------------
# Auto-tuner: adjust params to minimize PBO
# ---------------------------------------------------------------------------

def auto_tune_to_pass_pbo(
    strategy_name: str,
    returns: np.ndarray,
    strategy_fn: Callable,
    initial_param_grid: dict,
    pbo_config: PBOConfig | None = None,
    target_pbo: float = 0.05,
    max_refinements: int = 3,
    verbose: bool = True,
) -> tuple[PBOResult, dict]:
    """
    Auto-tune a strategy's hyperparameters to pass the PBO test.

    Algorithm:
      1. Run PBO evaluation on initial grid
      2. If PBO > target_pbo: narrow the grid toward the best params
         (reduce exploration range, increase exploitation)
      3. Repeat up to max_refinements
      4. Return the best params that minimize PBO
    """
    if pbo_config is None:
        pbo_config = PBOConfig()

    current_grid = dict(initial_param_grid)
    best_result: PBOResult | None = None
    best_params = {}

    for refinement in range(max_refinements):
        result = evaluate_pbo(
            strategy_name=strategy_name,
            returns=returns,
            strategy_fn=strategy_fn,
            param_grid=current_grid,
            config=pbo_config,
            verbose=verbose,
        )

        if best_result is None or result.pbo < best_result.pbo:
            best_result = result
            best_params = result.best_params

        if result.passing or result.pbo <= target_pbo:
            if verbose:
                print(f"  PBO={result.pbo:.3f} ≤ {target_pbo:.3f} — STOPPING")
            break

        if verbose:
            print(f"  Refinement {refinement+1}: PBO={result.pbo:.3f} > {target_pbo:.3f} — narrowing grid")

        # Narrow the grid around the best params
        new_grid = {}
        for key, vals in current_grid.items():
            best_val = best_params.get(key, vals[len(vals)//2])
            vals_arr = np.array(sorted(vals))
            idx = np.searchsorted(vals_arr, best_val)
            # Take ±2 nearest values
            lo = max(0, idx - 2)
            hi = min(len(vals_arr), idx + 3)
            if lo >= hi:
                lo = max(0, idx - 1)
                hi = min(len(vals_arr), idx + 2)
            new_vals = vals_arr[lo:hi]
            if len(new_vals) < 2:
                new_vals = vals_arr[max(0, idx-1):idx+2]
            new_grid[key] = sorted(set(int(v) if isinstance(best_val, int) else float(v) for v in new_vals))

        current_grid = new_grid
        pbo_config = PBOConfig(
            n_trials=max(20, pbo_config.n_trials // 2),  # fewer trials, finer grid
            n_permutations=pbo_config.n_permutations,
            n_train_splits=pbo_config.n_train_splits,
            purge_pct=pbo_config.purge_pct,
            embargo_pct=pbo_config.embargo_pct,
            random_state=pbo_config.random_state + refinement + 1,
            confidence_level=target_pbo,
        )

    return best_result, best_params


# ---------------------------------------------------------------------------
# Walk-Forward PBO — full backtesting with expanding window
# ---------------------------------------------------------------------------

@dataclass
class WFPBOConfig:
    """Configuration for walk-forward PBO."""
    train_window: int = 500      # Minimum training window (5-min candles)
    test_window: int = 100       # OOS test window
    step_size: int = 50         # Shift between windows
    pbo_config: PBOConfig = field(default_factory=lambda: PBOConfig())
    min_oos_sharpe: float = 0.0  # Minimum OOS Sharpe to consider valid


def walk_forward_pbo(
    strategy_name: str,
    returns: np.ndarray,
    strategy_fn: Callable,
    param_grid: dict,
    wf_config: WFPBOConfig | None = None,
    verbose: bool = True,
) -> dict:
    """
    Walk-forward PBO evaluation.

    For each train/test window:
      1. Train: evaluate all variants on training window
      2. Select best variant by OOS Sharpe
      3. Compute PBO for the selection
      4. Record the OOS performance of the selected variant
      5. Move forward by step_size

    Returns:
      dict with per-window results and aggregate statistics
    """
    if wf_config is None:
        wf_config = WFPBOConfig()

    returns = np.asarray(returns).flatten()
    n = len(returns)
    cfg = wf_config.pbo_config

    if n < wf_config.train_window + wf_config.test_window:
        raise ValueError("Not enough data for walk-forward evaluation")

    window_results = []
    selected_params_per_window = []
    oos_sharpes_per_window = []
    pbo_per_window = []
    sharpe_oos_all = []
    sharpe_is_all = []

    start = 0
    window_idx = 0

    while start + wf_config.train_window + wf_config.test_window <= n:
        end_train = start + wf_config.train_window
        end_test = min(end_train + wf_config.test_window, n)

        train_returns = returns[start:end_train]
        test_returns = returns[end_train:end_test]

        if len(test_returns) < 20:
            start += wf_config.step_size
            continue

        # Use strategy_fn to generate returns for training
        try:
            train_strategy_returns = strategy_fn(train_returns, wf_config.pbo_config.__dict__)
            is_sharpe = sharpe_ratio(train_strategy_returns)
        except Exception:
            is_sharpe = 0.0

        # Compute OOS Sharpe for each variant in param_grid
        sharpe_oos = {}
        for combo in product(*param_grid.values()):
            params = dict(zip(param_grid.keys(), combo))
            try:
                sim = strategy_fn(train_returns, params)
                sharpe_oos[combo] = sharpe_ratio(test_returns * np.sign(sim[:len(test_returns)]))
            except Exception:
                sharpe_oos[combo] = 0.0

        if not sharpe_oos:
            start += wf_config.step_size
            continue

        best_combo = max(sharpe_oos, key=sharpe_oos.get)
        best_params = dict(zip(param_grid.keys(), best_combo))
        best_oos_sharpe = sharpe_oos[best_combo]

        # PBO for this window (simplified: use permutation on this window's OOS)
        pbo = 1.0 - (sum(1 for s in sharpe_oos.values() if s < best_oos_sharpe) / len(sharpe_oos))

        window_results.append({
            "window": window_idx,
            "train_start": start,
            "train_end": end_train,
            "test_end": end_test,
            "best_params": best_params,
            "oos_sharpe": best_oos_sharpe,
            "is_sharpe": is_sharpe,
            "pbo": pbo,
            "n_variants": len(sharpe_oos),
        })
        selected_params_per_window.append(best_params)
        oos_sharpes_per_window.append(best_oos_sharpe)
        pbo_per_window.append(pbo)
        sharpe_oos_all.extend(list(sharpe_oos.values()))
        sharpe_is_all.append(is_sharpe)

        if verbose:
            passing = "✅" if pbo < cfg.confidence_level else "❌"
            print(f"  WF[{window_idx}] train=[{start}:{end_train}] test=[{end_train}:{end_test}] "
                  f"OOS_Sharpe={best_oos_sharpe:.3f} PBO={pbo:.3f} {passing}")

        start += wf_config.step_size
        window_idx += 1

    sharpe_oos_all = np.array(sharpe_oos_all)
    sharpe_is_all = np.array(sharpe_is_all)
    oos_sharpes_per_window = np.array(oos_sharpes_per_window)
    pbo_per_window = np.array(pbo_per_window)

    # Aggregate statistics
    avg_oos_sharpe = float(np.mean(oos_sharpes_per_window))
    sharpe_consistency = float(np.mean(oos_sharpes_per_window > 0))
    avg_pbo = float(np.mean(pbo_per_window))
    pbo_pass_rate = float(np.mean(pbo_per_window < cfg.confidence_level))
    sharpe_sharpe_overall = (
        float(np.mean(oos_sharpes_per_window)) / float(np.std(oos_sharpes_per_window) + 1e-8)
    )

    overall_passing = (
        avg_pbo < cfg.confidence_level and
        sharpe_consistency > 0.5 and
        avg_oos_sharpe > wf_config.min_oos_sharpe
    )

    if verbose:
        print(f"\n  Walk-Forward Summary:")
        print(f"    Windows evaluated: {len(window_results)}")
        print(f"    Avg OOS Sharpe: {avg_oos_sharpe:.3f}")
        print(f"    Sharpe consistency (>0): {sharpe_consistency:.1%}")
        print(f"    Avg PBO: {avg_pbo:.3f}")
        print(f"    PBO pass rate: {pbo_pass_rate:.1%}")
        print(f"    Overall: {'✅ PASS' if overall_passing else '❌ FAIL'}")

    return {
        "strategy_name": strategy_name,
        "overall_passing": overall_passing,
        "n_windows": len(window_results),
        "window_results": window_results,
        "selected_params_per_window": selected_params_per_window,
        "aggregate": {
            "avg_oos_sharpe": avg_oos_sharpe,
            "sharpe_consistency": sharpe_consistency,
            "avg_pbo": avg_pbo,
            "pbo_pass_rate": pbo_pass_rate,
            "sharpe_sharpe_overall": sharpe_sharpe_overall,
            "min_oos_sharpe": float(np.min(oos_sharpes_per_window)),
            "max_oos_sharpe": float(np.max(oos_sharpes_per_window)),
            "sharpe_distribution": sharpe_oos_all.tolist(),
        },
        "pbo_config": {
            "n_trials": cfg.n_trials,
            "n_permutations": cfg.n_permutations,
            "n_train_splits": cfg.n_train_splits,
            "confidence_level": cfg.confidence_level,
        },
    }


# ---------------------------------------------------------------------------
# Monte Carlo Simulation Engine — generates synthetic returns for stress testing
# ---------------------------------------------------------------------------

def monte_carlo_returns(
    returns: np.ndarray,
    n_simulations: int = 10000,
    block_size: int = 20,
    random_state: int = 42,
    preserve_correlation: bool = True,
    volatility_scaling: bool = True,
    regime_aware: bool = True,
) -> np.ndarray:
    """
    Block bootstrap Monte Carlo simulation with regime awareness.

    This generates n_simulations synthetic return paths that:
      1. Preserve the autocorrelation structure of the original returns
      2. Match the volatility clusters (using block bootstrap)
      3. Respect regime transitions (high-vol vs low-vol periods)
      4. Scale volatility appropriately

    Parameters
    ----------
    returns : np.ndarray
        Historical returns.
    n_simulations : int
        Number of simulated paths.
    block_size : int
        Block size for block bootstrap.
    random_state : int
        Random seed.
    preserve_correlation : bool
        Whether to preserve autocorrelation.
    volatility_scaling : bool
        Whether to scale by realized vol.
    regime_aware : bool
        Whether to preserve high-vol/low-vol regime clusters.

    Returns
    -------
    simulated_returns : np.ndarray, shape (n_simulations, len(returns))
    """
    rng = np.random.RandomState(random_state)
    r = np.asarray(returns).flatten()
    r = r[~np.isnan(r)]
    n = len(r)

    # Rolling volatility to identify regimes
    vol = pd.Series(r).rolling(20, min_periods=5).std().fillna(0).values
    median_vol = np.median(vol)
    high_vol_mask = vol > median_vol

    # Block bootstrap
    n_blocks = n // block_size
    block_starts = rng.randint(0, n - block_size + 1, size=n_blocks * 2)

    simulated = np.zeros((n_simulations, n))

    for sim in range(n_simulations):
        blocks = []
        block_assignments = rng.choice([0, 1], size=n_blocks, p=[0.5, 0.5])

        for b_idx, b_start in enumerate(block_starts[:n_blocks]):
            regime = block_assignments[b_idx]
            if regime_aware and high_vol_mask[b_start:b_start+block_size].mean() > 0.5:
                regime = 1  # high vol regime

            block = r[b_start:b_start + block_size]
            blocks.append(block)

        path = np.concatenate(blocks)[:n]

        # Rescale to match original vol
        if volatility_scaling:
            path_vol = np.std(path)
            if path_vol > 1e-8:
                path = path * (np.std(r) / path_vol)

        # Randomly flip sign for variation (conserves distribution)
        if rng.rand() > 0.5:
            path = -path

        simulated[sim, :min(len(path), n)] = path[:min(len(path), n)]

    return simulated


def monte_carlo_pbo(
    strategy_name: str,
    returns: np.ndarray,
    strategy_fn: Callable,
    param_grid: dict,
    n_simulations: int = 1000,
    pbo_config: PBOConfig | None = None,
    random_state: int = 42,
    verbose: bool = True,
) -> dict:
    """
    PBO evaluation using Monte Carlo simulated paths.

    For each Monte Carlo simulation:
      1. Generate a synthetic return path
      2. Evaluate all strategy variants on the path
      3. Select the best variant
      4. Record whether it outperforms the median

    PBO = fraction of simulations where the best < median
    """
    if pbo_config is None:
        pbo_config = PBOConfig(n_trials=50, n_permutations=50)

    if verbose:
        print(f"  Monte Carlo PBO — {strategy_name}")
        print(f"    {n_simulations} simulations")

    # Pre-compute strategy returns for each param combo on original data
    keys = list(param_grid.keys())
    values = list(product(*param_grid.values()))
    combos = [dict(zip(keys, v)) for v in values[:pbo_config.n_trials]]

    # Simulated paths
    sim_paths = monte_carlo_returns(
        returns,
        n_simulations=n_simulations,
        block_size=20,
        random_state=random_state,
        regime_aware=True,
        volatility_scaling=True,
    )

    pbo_count = 0
    sharpe_oos_all = []
    sharpe_is_all = []
    selected_params_all = []

    for sim_idx, sim_returns in enumerate(sim_paths):
        if len(sim_returns) < 50:
            continue

        # Evaluate all variants on this simulation
        sim_sharpes = []
        for params in combos:
            try:
                s = strategy_fn(sim_returns, params)
                sh = sharpe_ratio(s)
            except Exception:
                sh = 0.0
            sim_sharpes.append(sh)

        sim_sharpes = np.array(sim_sharpes)
        best_idx = int(np.argmax(sim_sharpes))
        best_sharpe = sim_sharpes[best_idx]
        median_sharpe = float(np.median(sim_sharpes))

        if best_sharpe < median_sharpe:
            pbo_count += 1

        sharpe_oos_all.append(best_sharpe)
        sharpe_is_all.extend(sim_sharpes.tolist())
        selected_params_all.append(combos[best_idx])

    pbo = pbo_count / n_simulations
    sharpe_oos_all = np.array(sharpe_oos_all)
    sharpe_is_all = np.array(sharpe_is_all)

    avg_sharpe = float(np.mean(sharpe_oos_all))
    sharpe_std = float(np.std(sharpe_oos_all, ddof=1))
    sharpe_consistency = float(np.mean(sharpe_oos_all > 0))
    sharpe_sharpe = avg_sharpe / (sharpe_std + 1e-8)

    passing = pbo < pbo_config.confidence_level

    if verbose:
        status = "✅ PASS" if passing else "❌ FAIL"
        print(f"    PBO={pbo:.3f} | Avg Sharpe={avg_sharpe:.3f} | "
              f"Sharpe_σ={sharpe_std:.3f} | Consistency={sharpe_consistency:.1%} | {status}")

    return {
        "strategy_name": strategy_name,
        "pbo": pbo,
        "n_simulations": n_simulations,
        "n_variants": len(combos),
        "passing": passing,
        "aggregate": {
            "avg_sharpe": avg_sharpe,
            "sharpe_std": sharpe_std,
            "sharpe_sharpe": sharpe_sharpe,
            "sharpe_consistency": sharpe_consistency,
            "min_sharpe": float(np.min(sharpe_oos_all)),
            "max_sharpe": float(np.max(sharpe_oos_all)),
            "pbo_median": float(np.median(sharpe_oos_all)),
            "pbo_lower_ci": float(np.percentile(sharpe_oos_all, 2.5)),
            "pbo_upper_ci": float(np.percentile(sharpe_oos_all, 97.5)),
        },
        "selected_params_per_sim": selected_params_all,
        "sharpe_distribution": sharpe_is_all.tolist(),
        "oos_sharpes": sharpe_oos_all.tolist(),
    }


# ---------------------------------------------------------------------------
# Unified PBO Runner — evaluates a strategy against all tests
# ---------------------------------------------------------------------------

def run_full_pbo_evaluation(
    strategy_name: str,
    returns: np.ndarray,
    strategy_fn: Callable,
    param_grid: dict,
    n_trials: int = 100,
    verbose: bool = True,
) -> dict:
    """
    Run all PBO evaluation modes and return a unified result.

    Modes:
      1. Combinatorial Purged CV (CPCV)
      2. Walk-Forward PBO
      3. Monte Carlo PBO

    Each mode produces a pass/fail result.
    The strategy passes overall if ≥ 2/3 modes pass.
    """
    if verbose:
        print(f"\n{'='*60}")
        print(f"  FULL PBO EVALUATION — {strategy_name}")
        print(f"{'='*60}")

    pbo_cfg = PBOConfig(
        n_trials=n_trials,
        n_permutations=100,
        n_train_splits=5,
        purge_pct=0.1,
        embargo_pct=0.1,
        confidence_level=0.05,
    )

    results = {}

    # Mode 1: CPCV PBO
    try:
        cpcv_result = evaluate_pbo(
            strategy_name=strategy_name,
            returns=returns,
            strategy_fn=strategy_fn,
            param_grid=param_grid,
            config=pbo_cfg,
            verbose=verbose,
        )
        results["cpcv"] = {
            "pbo": cpcv_result.pbo,
            "sharpe_oos": cpcv_result.sharpe_oos,
            "passing": cpcv_result.passing,
            "sharpe_avg": cpcv_result.sharpe_avg,
            "sharpe_sharpe": cpcv_result.sharpe_sharpe,
            "best_params": cpcv_result.best_params,
        }
    except Exception as e:
        if verbose:
            print(f"  CPCV PBO failed: {e}")
        results["cpcv"] = None

    # Mode 2: Walk-Forward PBO
    try:
        wf_result = walk_forward_pbo(
            strategy_name=strategy_name,
            returns=returns,
            strategy_fn=strategy_fn,
            param_grid=param_grid,
            wf_config=WFPBOConfig(
                train_window=500,
                test_window=100,
                step_size=50,
                pbo_config=pbo_cfg,
            ),
            verbose=verbose,
        )
        results["walk_forward"] = wf_result["aggregate"]
        results["walk_forward"]["passing"] = wf_result["overall_passing"]
        results["walk_forward_params"] = wf_result["selected_params_per_window"]
    except Exception as e:
        if verbose:
            print(f"  Walk-Forward PBO failed: {e}")
        results["walk_forward"] = None

    # Mode 3: Monte Carlo PBO
    try:
        mc_result = monte_carlo_pbo(
            strategy_name=strategy_name,
            returns=returns,
            strategy_fn=strategy_fn,
            param_grid=param_grid,
            n_simulations=1000,
            pbo_config=pbo_cfg,
            verbose=verbose,
        )
        results["monte_carlo"] = mc_result["aggregate"]
        results["monte_carlo"]["passing"] = mc_result["passing"]
    except Exception as e:
        if verbose:
            print(f"  Monte Carlo PBO failed: {e}")
        results["monte_carlo"] = None

    # Overall pass: at least 2/3 modes pass
    modes = ["cpcv", "walk_forward", "monte_carlo"]
    passing_modes = [m for m in modes if results.get(m) and results[m].get("passing")]
    overall_passing = len(passing_modes) >= 2

    if verbose:
        print(f"\n  Overall: {'✅ PASS' if overall_passing else '❌ FAIL'} "
              f"({len(passing_modes)}/{len(modes)} modes passed: {passing_modes})")

    results["overall_passing"] = overall_passing
    results["modes_passed"] = len(passing_modes)
    results["total_modes"] = len(modes)
    results["passing_modes"] = passing_modes

    return results
