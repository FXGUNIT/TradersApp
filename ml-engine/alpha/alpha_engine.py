"""
Alpha Discovery Engine.
Quantifies edge: alpha = E[Actual Move] - E[Expected Move].
Expected Move = ATR * sqrt(holding_minutes / daily_minutes).
Alpha > 0: edge exists | Alpha < 0: negative edge | Alpha ≈ 0: neutral.
"""
import numpy as np
import pandas as pd
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


def calculate_alpha_metrics(trade_log_df: pd.DataFrame) -> dict:
    """
    Full alpha analysis from trade log.
    Decomposes alpha by session, time bucket, and rolling windows.
    """
    if trade_log_df.empty:
        return _empty_alpha()

    wins = trade_log_df[trade_log_df["result"] == "win"]
    losses = trade_log_df[trade_log_df["result"] == "loss"]

    # Core alpha
    alpha_raw = trade_log_df.get("alpha_raw", pd.Series(dtype=float))
    mean_alpha = alpha_raw.mean() if len(alpha_raw) > 0 else 0.0
    alpha_std = alpha_raw.std() if len(alpha_raw) > 0 else 0.0

    # Directional
    pnl_ticks = trade_log_df.get("pnl_ticks", pd.Series(dtype=float))
    directional_accuracy = (pnl_ticks > 0).mean() if len(pnl_ticks) > 0 else 0.5
    directional_alpha = directional_accuracy - 0.5

    # Expectancy
    avg_win = wins["pnl_dollars"].mean() if len(wins) > 0 else 0.0
    avg_loss = losses["pnl_dollars"].abs().mean() if len(losses) > 0 else 0.0
    expectancy = (
        (wins["pnl_dollars"].sum() - losses["pnl_dollars"].abs().sum()) / max(1, len(trade_log_df))
        if len(trade_log_df) > 0 else 0.0
    )

    # By session
    alpha_by_session = {}
    for sid in [0, 1, 2]:
        sub = trade_log_df[trade_log_df.get("session_id", pd.Series([1]*len(trade_log_df))) == sid]
        if len(sub) > 0:
            ar = sub.get("alpha_raw", pd.Series([0.0]*len(sub)))
            alpha_by_session[config.SESSION_CONFIG[sid]["name"]] = {
                "alpha": round(float(ar.mean()), 2) if len(ar) > 0 else 0.0,
                "std": round(float(ar.std()), 2) if len(ar) > 0 else 0.0,
                "trades": len(sub),
                "win_rate": round(float((sub["result"] == "win").mean()), 3) if "result" in sub.columns else 0.5,
            }

    # By time bucket (30-min buckets)
    alpha_by_time = {}
    if "entry_time" in trade_log_df.columns:
        times = pd.to_datetime(trade_log_df["entry_time"])
        hour = times.dt.hour
        minute = times.dt.minute
        bucket_key = ((hour * 60 + minute) // 30) * 30
        trade_log_df = trade_log_df.copy()
        trade_log_df["time_bucket"] = bucket_key

        for bucket, grp in trade_log_df.groupby("time_bucket"):
            h = bucket // 60
            m = bucket % 60
            label = f"{h:02d}:{m:02d}-{(h*60+m+30)//60:02d}:{(h*60+m+30)%60:02d}"
            ar = grp.get("alpha_raw", pd.Series([0.0]*len(grp)))
            alpha_by_time[label] = {
                "alpha": round(float(ar.mean()), 2) if len(ar) > 0 else 0.0,
                "win_rate": round(float((grp["result"] == "win").mean()), 3) if "result" in grp.columns else 0.5,
                "trades": len(grp),
            }

        # Find best window
        if alpha_by_time:
            best_window = max(alpha_by_time.items(), key=lambda x: x[1]["alpha"])
        else:
            best_window = ("N/A", {"alpha": 0.0})
    else:
        best_window = ("N/A", {"alpha": 0.0})

    # Alpha stability: % of rolling 50-trade windows with positive alpha
    if len(alpha_raw) >= 50:
        rolling_positive = (
            alpha_raw.rolling(50, min_periods=30).mean().dropna() > 0
        ).mean()
    else:
        rolling_positive = float(mean_alpha > 0)

    return {
        "mean_alpha": round(float(mean_alpha), 4),
        "alpha_std": round(float(alpha_std), 4),
        "alpha_per_trade": round(float(mean_alpha / max(0.001, alpha_std)), 4) if alpha_std > 0 else 0.0,
        "directional_accuracy": round(float(directional_accuracy), 4),
        "directional_alpha": round(float(directional_alpha), 4),
        "expectancy": round(float(expectancy), 4),
        "win_rate": round(float(len(wins) / max(1, len(trade_log_df))), 4),
        "avg_win_dollars": round(float(avg_win), 2),
        "avg_loss_dollars": round(float(avg_loss), 2),
        "profit_factor": round(float(wins["pnl_dollars"].sum() / max(1, losses["pnl_dollars"].abs().sum())), 3),
        "alpha_by_session": alpha_by_session,
        "alpha_by_time": alpha_by_time,
        "best_alpha_window": best_window[0],
        "best_alpha_value": best_window[1]["alpha"],
        "alpha_stability": round(float(rolling_positive), 4),
        "total_trades": len(trade_log_df),
    }


def _empty_alpha() -> dict:
    return {
        "mean_alpha": 0.0,
        "alpha_std": 0.0,
        "alpha_per_trade": 0.0,
        "directional_accuracy": 0.5,
        "directional_alpha": 0.0,
        "expectancy": 0.0,
        "win_rate": 0.0,
        "avg_win_dollars": 0.0,
        "avg_loss_dollars": 0.0,
        "profit_factor": 1.0,
        "alpha_by_session": {},
        "alpha_by_time": {},
        "best_alpha_window": "N/A",
        "best_alpha_value": 0.0,
        "alpha_stability": 0.0,
        "total_trades": 0,
        "note": "No trade data available",
    }


def compute_expected_move(atr: float, holding_minutes: float = 5.0) -> float:
    """
    Compute expected move based on ATR and holding time.
    Uses the square-root-of-time scaling:
    Expected Move = ATR × sqrt(holding_minutes / daily_minutes)
    Daily minutes ≈ 390 (6.5 hours of main session)
    """
    if atr <= 0 or holding_minutes <= 0:
        return 0.0
    daily_minutes = 390.0  # main trading session
    return atr * np.sqrt(holding_minutes / daily_minutes)


def compute_trade_alpha(
    entry_price: float,
    exit_price: float,
    atr: float,
    direction: int,
    holding_minutes: float = 5.0,
) -> dict:
    """
    Compute alpha for a single trade.
    Returns: {expected_move, actual_move, alpha_raw, alpha_ticks}
    """
    actual_move_ticks = direction * (exit_price - entry_price)
    expected_move_ticks = compute_expected_move(atr, holding_minutes)
    alpha_raw = actual_move_ticks - expected_move_ticks

    return {
        "expected_move_ticks": round(float(expected_move_ticks), 4),
        "actual_move_ticks": round(float(actual_move_ticks), 4),
        "alpha_raw": round(float(alpha_raw), 4),
        "edge_exists": alpha_raw > 0,
        "edge_direction": "LONG" if direction > 0 else "SHORT",
    }
