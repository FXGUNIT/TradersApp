"""
RRR Optimization Engine.
Grid search: which R:R ratio maximizes expectancy per trade?
NOT: which has highest win rate. NOT: which has highest profit factor.
ONLY: which maximizes expectancy per trade.
"""
import numpy as np
import pandas as pd
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


def expectancy(win_rate: float, avg_win: float, avg_loss: float) -> float:
    """
    Expectancy = (WR × Avg Win) − ((1 − WR) × Avg Loss)
    Everything in trading boils down to this single number.
    """
    if avg_loss == 0:
        return 0.0
    return (win_rate * avg_win) - ((1 - win_rate) * avg_loss)


def find_optimal_rrr(
    trade_log_df: pd.DataFrame,
    base_sl_ticks: float = 20.0,
    rr_range: tuple = (0.5, 4.0),
    step: float = 0.25,
    min_trades: int = 20,
) -> dict:
    """
    Grid search over R:R ratios to find the one that maximizes expectancy.

    Parameters
    ----------
    trade_log_df : DataFrame with pnl_ticks column
    base_sl_ticks : stop loss in ticks (default 20)
    rr_range : (min, max) R:R ratio
    step : grid step size
    min_trades : minimum trades required for valid analysis

    Returns
    -------
    dict with optimal R:R + per-session breakdown + reasoning
    """
    if trade_log_df.empty or len(trade_log_df) < min_trades:
        return _default_rrr(base_sl_ticks)

    pnl = trade_log_df["pnl_ticks"].dropna()
    if len(pnl) < min_trades:
        return _default_rrr(base_sl_ticks)

    wins = pnl[pnl > 0]
    losses = pnl[pnl < 0]

    results = []
    for rr in np.arange(rr_range[0], rr_range[1] + step, step):
        rr = round(rr, 3)
        tp_ticks = base_sl_ticks * rr

        # Simulate: win if pnl >= tp_ticks
        wr = (pnl >= tp_ticks).mean()
        aw = wins[wins >= tp_ticks].mean() if len(wins[wins >= tp_ticks]) > 0 else tp_ticks
        al = losses.abs().mean() if len(losses) > 0 else base_sl_ticks

        # Expectancy at this R:R
        exp = expectancy(wr, aw, al)

        # Win rate without any TP filter
        raw_wr = (pnl > 0).mean()
        raw_aw = wins.mean() if len(wins) > 0 else tp_ticks
        raw_al = losses.abs().mean() if len(losses) > 0 else base_sl_ticks
        raw_exp = expectancy(raw_wr, raw_aw, raw_al)

        # Profit factor at this R:R
        tp_wins = pnl[pnl >= tp_ticks]
        tp_losses = pnl[pnl < 0]
        pf = (tp_wins.sum() / tp_losses.abs().sum()) if len(tp_losses) > 0 and tp_losses.abs().sum() > 0 else 1.0

        results.append({
            "rr": rr,
            "tp_ticks": round(tp_ticks, 1),
            "win_rate": round(wr, 4),
            "avg_win_ticks": round(aw, 2) if not np.isnan(aw) else 0.0,
            "avg_loss_ticks": round(al, 2) if not np.isnan(al) else base_sl_ticks,
            "expectancy": round(exp, 4),
            "profit_factor": round(pf, 3),
            "trades_analysed": len(pnl),
        })

    df = pd.DataFrame(results)
    if df.empty:
        return _default_rrr(base_sl_ticks)

    # Optimal: max expectancy
    df_sorted = df.sort_values("expectancy", ascending=False)
    optimal = df_sorted.iloc[0]

    # Clamp to minimum acceptable R:R
    if optimal["rr"] < config.MIN_ACCEPTABLE_RR:
        above_min = df[df["rr"] >= config.MIN_ACCEPTABLE_RR]
        if len(above_min) > 0:
            optimal = above_min.sort_values("expectancy", ascending=False).iloc[0]
        else:
            optimal = df_sorted.iloc[0]

    # Also find by session
    by_session = {}
    for sid in [0, 1, 2]:
        sub = trade_log_df[trade_log_df.get("session_id", pd.Series([1]*len(trade_log_df))) == sid]
        if len(sub) >= min_trades:
            pnl_s = sub["pnl_ticks"].dropna()
            wins_s = pnl_s[pnl_s > 0]
            losses_s = pnl_s[pnl_s < 0]

            session_results = []
            for rr in np.arange(rr_range[0], rr_range[1] + step, step):
                rr = round(rr, 3)
                tp = base_sl_ticks * rr
                wr_s = (pnl_s >= tp).mean()
                aw_s = wins_s[wins_s >= tp].mean() if len(wins_s[wins_s >= tp]) > 0 else tp
                al_s = losses_s.abs().mean() if len(losses_s) > 0 else base_sl_ticks
                exp_s = expectancy(wr_s, aw_s, al_s)
                session_results.append({"rr": rr, "expectancy": exp_s, "win_rate": wr_s})

            sess_df = pd.DataFrame(session_results)
            if not sess_df.empty:
                best = sess_df.sort_values("expectancy", ascending=False).iloc[0]
                session_name = config.SESSION_CONFIG.get(sid, {}).get("name", f"session_{sid}")
                by_session[session_name] = {
                    "rr": round(float(best["rr"]), 2),
                    "expectancy": round(float(best["expectancy"]), 4),
                    "win_rate": round(float(best["win_rate"]), 3),
                }

    # Why this R:R?
    next_best = df_sorted.iloc[1] if len(df_sorted) > 1 else optimal
    why = (
        f"1:{optimal['rr']:.1f} maximizes expectancy at {optimal['expectancy']:.4f} ticks/trade. "
        f"Expected win rate: {optimal['win_rate']:.0%}. "
        f"Profit factor: {optimal['profit_factor']:.2f}. "
        f"Compared to 1:{next_best['rr']:.1f} (exp={next_best['expectancy']:.4f}), "
        f"this R:R generates {((optimal['expectancy'] - next_best['expectancy']) / max(0.0001, abs(next_best['expectancy'])) * 100):.0f}% higher expectancy."
    )

    return {
        "recommended_rr": round(float(optimal["rr"]), 2),
        "min_acceptable_rr": config.MIN_ACCEPTABLE_RR,
        "expected_expectancy": round(float(optimal["expectancy"]), 4),
        "expected_win_rate": round(float(optimal["win_rate"]), 4),
        "profit_factor": round(float(optimal["profit_factor"]), 3),
        "tp_ticks": round(float(optimal["tp_ticks"]), 1),
        "sample_size": len(pnl),
        "confidence": min(1.0, len(pnl) / 500),  # More trades = higher confidence
        "why_this_rr": why,
        "session_specific": by_session,
        "full_grid": df_sorted.head(10).to_dict(orient="records"),
    }


def _default_rrr(base_sl: float) -> dict:
    return {
        "recommended_rr": 2.0,
        "min_acceptable_rr": config.MIN_ACCEPTABLE_RR,
        "expected_expectancy": 0.0,
        "expected_win_rate": 0.5,
        "profit_factor": 1.0,
        "tp_ticks": base_sl * 2,
        "sample_size": 0,
        "confidence": 0.0,
        "why_this_rr": "Insufficient data for RRR optimization. Using default 1:2.0.",
        "session_specific": {},
        "full_grid": [],
        "note": "Need more than 20 completed trades to optimize R:R",
    }
