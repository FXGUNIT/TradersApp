"""
ML Engine — Backtest Routes
Extracted from main.py (Rule #3 hard limit: Python ≤600 lines)
"""
import hashlib
import json
import time
import traceback
from datetime import datetime, timedelta, timezone

import numpy as np
from fastapi import HTTPException

from _lifespan import db

from _infrastructure import (
    get_cache,
    get_sla_monitor,
    PROMETHEUS_AVAILABLE,
    record_prometheus_cache,
)

# ── Backtest helpers (defined at module level to avoid route-level def) ─────────

def _build_returns(symbol: str, trades: list | None, returns_override: list | None, min_trades: int) -> np.ndarray:
    """Build returns array from trade log or precomputed returns."""
    if returns_override is not None:
        arr = np.array(returns_override, dtype=float)
        if len(arr) < min_trades:
            raise HTTPException(status_code=400, detail=f"Need {min_trades} returns, got {len(arr)}")
        return arr
    if trades:
        pnl = [t.get("pnl_ticks", 0.0) or 0.0 for t in trades]
        arr = np.array(pnl, dtype=float)
        if len(arr) < min_trades:
            raise HTTPException(status_code=400, detail=f"Need {min_trades} trades, got {len(trades)}")
        return arr
    try:
        end = datetime.now(timezone.utc).isoformat()
        start = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        df = db.get_candles(start, end, symbol, limit=10000)
        if df.empty:
            raise HTTPException(status_code=400, detail="No candle data. Upload data first.")
        returns = np.diff(df["close"].values) / df["close"].values[:-1]
        if len(returns) < min_trades:
            raise HTTPException(status_code=400, detail=f"Need {min_trades} candles, got {len(returns)}")
        return returns
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build returns: {e}")


def _get_strategy_fn(stype: str):
    """Map strategy type string to strategy function."""
    from evaluation.backtest_pbo import momentum_strategy, mean_reversion_strategy, regime_switching_strategy
    return {
        "momentum": momentum_strategy,
        "mean_reversion": mean_reversion_strategy,
        "regime_switching": regime_switching_strategy,
    }.get(stype, momentum_strategy)


def _serialize_pbo_result(result) -> dict:
    """Convert PBOResult dataclass to dict for JSON serialization."""
    return {
        "strategy_name": result.strategy_name,
        "pbo": round(result.pbo, 6),
        "sharpe_oracle": round(result.sharpe_oracle, 4),
        "sharpe_oos": round(result.sharpe_oos, 4),
        "sharpe_avg": round(result.sharpe_avg, 4),
        "sharpe_std": round(result.sharpe_std, 4),
        "sharpe_diff": round(result.sharpe_diff, 4),
        "sharpe_sharpe": round(result.sharpe_sharpe, 4),
        "sharpe_prob": round(result.sharpe_prob, 4),
        "n_trials": result.n_trials,
        "n_passed": result.n_passed,
        "pass_rate": round(result.pass_rate, 4),
        "best_variant_idx": result.best_variant_idx,
        "best_params": result.best_params,
        "oos_return_pct": round(result.oos_return_pct, 4),
        "overfit_bands": [round(x, 4) for x in result.overfit_bands],
        "passing": result.passing,
    }


# ── Route functions ─────────────────────────────────────────────────────────────

def run_pbo_backtest(request: "PBOBacktestRequest"):
    """Run CPCV PBO evaluation — Combinatorial Purged Cross-Validation."""
    from evaluation.backtest_pbo import evaluate_pbo, PBOConfig

    monitor = get_sla_monitor()
    start = time.time()

    cache = get_cache()
    lb_hash = hashlib.sha256(json.dumps(request.lookback, sort_keys=True).encode()).hexdigest()[:8]
    th_hash = hashlib.sha256(json.dumps(request.threshold, sort_keys=True).encode()).hexdigest()[:8]
    cache_key = (
        f"backtest:pbo:{request.symbol}:{request.strategy_name}:"
        f"{request.strategy_type}:{request.n_trials}:{request.n_permutations}:"
        f"{request.n_train_splits}:{request.purge_pct}:{request.embargo_pct}:"
        f"{request.confidence_level}:{request.min_trades}:{lb_hash}:{th_hash}"
    )

    cached = cache.get(cache_key)
    if cached is not None:
        if PROMETHEUS_AVAILABLE:
            record_prometheus_cache(hit=True)
        cached["_cached"] = True
        cached["_cache_age_ms"] = round((time.time() - start) * 1000, 1)
        monitor.record("/backtest/pbo", (time.time() - start) * 1000, 200)
        return cached

    returns = _build_returns(request.symbol, None, None, request.min_trades)
    param_grid = {"lookback": request.lookback, "threshold": request.threshold}
    config = PBOConfig(
        n_trials=request.n_trials,
        n_permutations=request.n_permutations,
        n_train_splits=request.n_train_splits,
        purge_pct=request.purge_pct,
        embargo_pct=request.embargo_pct,
        confidence_level=request.confidence_level,
        random_state=42,
    )
    strategy_fn = _get_strategy_fn(request.strategy_type)
    result = evaluate_pbo(
        strategy_name=request.strategy_name,
        returns=returns,
        strategy_fn=strategy_fn,
        param_grid=param_grid,
        config=config,
        verbose=True,
    )

    output = {
        "ok": True,
        "mode": "cpcv_pbo",
        "strategy_name": request.strategy_name,
        "strategy_type": request.strategy_type,
        "returns_count": int(len(returns)),
        "param_grid": param_grid,
        **_serialize_pbo_result(result),
    }
    cache.set(cache_key, output, ttl=300)
    latency_ms = (time.time() - start) * 1000
    monitor.record("/backtest/pbo", latency_ms, 200)
    if PROMETHEUS_AVAILABLE:
        record_prometheus_cache(hit=False)
    return output


def run_mc_backtest(request: "MCBacktestRequest"):
    """Run Monte Carlo PBO evaluation — block bootstrap synthetic paths."""
    from evaluation.backtest_pbo import monte_carlo_pbo, PBOConfig

    monitor = get_sla_monitor()
    start = time.time()
    cache = get_cache()
    cache_key = (
        f"backtest:mc:{request.symbol}:{request.strategy_name}:"
        f"{request.strategy_type}:{request.n_simulations}:{request.n_trials}:"
        f"{request.block_size}:{request.min_trades}"
    )

    cached = cache.get(cache_key)
    if cached is not None:
        if PROMETHEUS_AVAILABLE:
            record_prometheus_cache(hit=True)
        cached["_cached"] = True
        cached["_cache_age_ms"] = round((time.time() - start) * 1000, 1)
        monitor.record("/backtest/mc", (time.time() - start) * 1000, 200)
        return cached

    returns = _build_returns(request.symbol, None, None, request.min_trades)
    param_grid = {"lookback": [5, 10, 20, 30], "threshold": [0.005, 0.01, 0.015]}
    config = PBOConfig(n_trials=request.n_trials, n_permutations=50, random_state=42)
    strategy_fn = _get_strategy_fn(request.strategy_type)
    result = monte_carlo_pbo(
        strategy_name=request.strategy_name,
        returns=returns,
        strategy_fn=strategy_fn,
        param_grid=param_grid,
        n_simulations=request.n_simulations,
        pbo_config=config,
        random_state=42,
        verbose=True,
    )

    output = {
        "ok": True,
        "mode": "monte_carlo_pbo",
        "strategy_name": request.strategy_name,
        "strategy_type": request.strategy_type,
        "returns_count": int(len(returns)),
        "n_simulations": result["n_simulations"],
        "n_variants": result["n_variants"],
        "pbo": round(result["pbo"], 6),
        "passing": result["passing"],
        "aggregate": {k: round(v, 4) if isinstance(v, float) else v for k, v in result["aggregate"].items()},
    }
    cache.set(cache_key, output, ttl=300)
    latency_ms = (time.time() - start) * 1000
    monitor.record("/backtest/mc", latency_ms, 200)
    if PROMETHEUS_AVAILABLE:
        record_prometheus_cache(hit=False)
    return output


def run_full_pbo(request: "FullPBOBacktestRequest"):
    """Run ALL 3 PBO modes (CPCV, Walk-Forward, Monte Carlo) unified."""
    from evaluation.backtest_pbo import run_full_pbo_evaluation

    monitor = get_sla_monitor()
    start = time.time()
    cache = get_cache()
    lb_hash = hashlib.sha256(json.dumps(request.lookback, sort_keys=True).encode()).hexdigest()[:8]
    th_hash = hashlib.sha256(json.dumps(request.threshold, sort_keys=True).encode()).hexdigest()[:8]
    cache_key = (
        f"backtest:full:{request.symbol}:{request.strategy_name}:"
        f"{request.strategy_type}:{request.n_trials}:{request.n_simulations}:"
        f"{request.min_trades}:{lb_hash}:{th_hash}"
    )

    cached = cache.get(cache_key)
    if cached is not None:
        if PROMETHEUS_AVAILABLE:
            record_prometheus_cache(hit=True)
        cached["_cached"] = True
        cached["_cache_age_ms"] = round((time.time() - start) * 1000, 1)
        monitor.record("/backtest/full", (time.time() - start) * 1000, 200)
        return cached

    returns = _build_returns(request.symbol, None, None, request.min_trades)
    param_grid = {"lookback": request.lookback, "threshold": request.threshold}
    strategy_fn = _get_strategy_fn(request.strategy_type)
    results = run_full_pbo_evaluation(
        strategy_name=request.strategy_name,
        returns=returns,
        strategy_fn=strategy_fn,
        param_grid=param_grid,
        n_trials=request.n_trials,
        verbose=True,
    )

    output = {
        "ok": True,
        "mode": "full_pbo",
        "strategy_name": request.strategy_name,
        "strategy_type": request.strategy_type,
        "returns_count": int(len(returns)),
        "n_trials": request.n_trials,
        "n_simulations": request.n_simulations,
        "overall_passing": results["overall_passing"],
        "modes_passed": results["modes_passed"],
        "total_modes": results["total_modes"],
        "passing_modes": results["passing_modes"],
    }
    if results.get("cpcv"):
        cpcv = results["cpcv"]
        output["cpcv"] = {
            "pbo": round(cpcv["pbo"], 6),
            "sharpe_oos": round(cpcv["sharpe_oos"], 4),
            "sharpe_avg": round(cpcv["sharpe_avg"], 4),
            "sharpe_sharpe": round(cpcv["sharpe_sharpe"], 4),
            "passing": cpcv["passing"],
            "best_params": cpcv.get("best_params", {}),
        }
    if results.get("walk_forward"):
        wf = results["walk_forward"]
        output["walk_forward"] = {
            "n_windows": wf.get("n_windows", 0),
            "avg_oos_sharpe": round(wf["avg_oos_sharpe"], 4),
            "sharpe_consistency": round(wf["sharpe_consistency"], 4),
            "avg_pbo": round(wf["avg_pbo"], 6),
            "pbo_pass_rate": round(wf["pbo_pass_rate"], 4),
            "passing": wf["passing"],
        }
    if results.get("monte_carlo"):
        mc = results["monte_carlo"]
        output["monte_carlo"] = {
            "pbo": round(mc["pbo"], 6),
            "avg_sharpe": round(mc["avg_sharpe"], 4),
            "sharpe_sharpe": round(mc["sharpe_sharpe"], 4),
            "sharpe_consistency": round(mc["sharpe_consistency"], 4),
            "passing": mc["passing"],
        }

    cache.set(cache_key, output, ttl=300)
    latency_ms = (time.time() - start) * 1000
    monitor.record("/backtest/full", latency_ms, 200)
    if PROMETHEUS_AVAILABLE:
        record_prometheus_cache(hit=False)
    return output


def autotune_pbo(request: "AutotuneRequest"):
    """Auto-tune strategy hyperparameters to pass PBO testing."""
    from evaluation.backtest_pbo import auto_tune_to_pass_pbo, PBOConfig

    returns = _build_returns(request.symbol, None, None, request.min_trades)
    strategy_fn = _get_strategy_fn(request.strategy_type)
    config = PBOConfig(
        n_trials=max(20, request.n_trials // 2),
        n_permutations=100,
        n_train_splits=5,
        purge_pct=0.1,
        embargo_pct=0.1,
        confidence_level=request.target_pbo,
        random_state=42,
    )
    best_result, best_params = auto_tune_to_pass_pbo(
        strategy_name=request.strategy_name,
        returns=returns,
        strategy_fn=strategy_fn,
        initial_param_grid=request.initial_grid,
        pbo_config=config,
        target_pbo=request.target_pbo,
        max_refinements=request.max_refinements,
        verbose=True,
    )

    return {
        "ok": True,
        "mode": "autotune_pbo",
        "strategy_name": request.strategy_name,
        "strategy_type": request.strategy_type,
        "returns_count": int(len(returns)),
        "target_pbo": request.target_pbo,
        "max_refinements": request.max_refinements,
        "overall_passing": best_result.passing if best_result else False,
        "final_pbo": round(best_result.pbo, 6) if best_result else None,
        "best_params": best_params,
        "best_sharpe_oos": round(best_result.sharpe_oos, 4) if best_result else None,
        "best_sharpe_avg": round(best_result.sharpe_avg, 4) if best_result else None,
        "sharpe_sharpe": round(best_result.sharpe_sharpe, 4) if best_result else None,
        "passing": best_result.passing if best_result else False,
        "recommendation": (
            f"Use params {best_params} for {request.strategy_name}. "
            f"PBO={round(best_result.pbo, 4) if best_result else 'N/A'} "
            f"({'PASS' if best_result and best_result.passing else 'FAIL'} at "
            f"target {request.target_pbo:.2%})"
        ) if best_result else "Could not find passing parameters",
    }


def compute_returns(request: "BacktestTradesRequest"):
    """Convert trades into returns array and compute stats."""
    from fastapi import HTTPException as HTTPExc

    monitor = get_sla_monitor()
    start = time.time()
    if not request.trades:
        monitor.record("/backtest/returns", (time.time() - start) * 1000, 400)
        raise HTTPExc(status_code=400, detail="No trades provided")

    cache = get_cache()
    pnl_vals = [t.get("pnl_ticks", 0.0) or 0.0 for t in request.trades]
    pnl_hash = hashlib.sha256(json.dumps(pnl_vals, sort_keys=True).encode()).hexdigest()[:16]
    override_hash = hashlib.sha256(json.dumps(request.returns_override or [], sort_keys=True).encode()).hexdigest()[:8]
    cache_key = f"backtest:returns:{pnl_hash}:{override_hash}"

    cached = cache.get(cache_key)
    if cached is not None:
        if PROMETHEUS_AVAILABLE:
            record_prometheus_cache(hit=True)
        cached["_cached"] = True
        cached["_cache_age_ms"] = round((time.time() - start) * 1000, 1)
        monitor.record("/backtest/returns", (time.time() - start) * 1000, 200)
        return cached

    returns_arr = _build_returns(
        request.symbol, request.trades, request.returns_override, request.min_trades
    )
    output = {
        "ok": True,
        "returns_count": int(len(returns_arr)),
        "returns": [round(float(r), 6) for r in returns_arr],
        "summary": {
            "total_pnl_ticks": round(float(np.sum(returns_arr)), 4),
            "mean_ticks": round(float(np.mean(returns_arr)), 4),
            "std_ticks": round(float(np.std(returns_arr)), 4),
            "win_rate": round(float(np.sum(returns_arr > 0) / len(returns_arr)), 4) if len(returns_arr) > 0 else 0,
            "max_drawdown": round(float(np.min(np.maximum.accumulate(returns_arr) - np.maximum.accumulate(returns_arr).cumsum())), 4),
            "profit_factor": round(
                float(np.sum(returns_arr[returns_arr > 0]) / abs(np.sum(returns_arr[returns_arr < 0]))), 4
            ) if np.sum(returns_arr[returns_arr < 0]) != 0 else 0.0,
        },
    }
    cache.set(cache_key, output, ttl=300)
    latency_ms = (time.time() - start) * 1000
    monitor.record("/backtest/returns", latency_ms, 200)
    if PROMETHEUS_AVAILABLE:
        record_prometheus_cache(hit=False)
    return output
