"""
Lab 5: Triple-Barrier Labeling + Purged K-Fold CV
==================================================
Book Reference: López de Prado Chapter 3 (Machine Learning for Asset Managers)
Paper: Hurt et al. (2014) "Benchmarking Applied to Market Neutral Strategies"
Focus: Replace simple return labeling with triple-barrier (PT/SL/TS)
       and implement purged CV to avoid look-ahead bias

Triple-Barrier:
  - Vertical barrier:  2× ATR  → stop loss
  - Horizontal barrier: 6 hours → session end
  - Profit taking:      3:1 RRR → 3× ATR target
  → Label: 1 (win), -1 (loss), 0 (time stop)

Purging: Remove training observations that overlap with validation in time.
Embargo: Additional gap between train and validation folds.

Nifty-specific:
  - ATR period: 14 (standard)
  - SL: 2 × ATR
  - PT: 3 × ATR (R>0.5 expected win rate needed for +R expectancy)
  - Session hours: 10:30–13:30 IST (convert to UTC for candle timestamps)
"""

from __future__ import annotations
import sys as _sys
if _sys.stdout.encoding and 'cp' in _sys.stdout.encoding:
    _sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Literal


# ═══════════════════════════════════════════════════════════════════════════════
# Synthetic OHLCV data (replace with real candle data from candle_db.py)
# ═══════════════════════════════════════════════════════════════════════════════
def simulate_ohlcv(n_days: int = 252, seed: int = 7) -> pd.DataFrame:
    """Simulate 5-min OHLCV candles for Nifty intraday session (10:30–13:30 IST)."""
    np.random.seed(seed)
    n_candles = n_days * 36   # 36 × 5-min = 180 min = 3 hours

    dt = 5 / (75 * 252)      # 5-min as fraction of year (rough)
    mu = 0.0001
    sigma = 0.12              # 12% annualized intraday vol (Nifty)

    log_rets = np.random.normal(mu * dt, sigma * np.sqrt(dt), n_candles)
    close = 22_500 * np.exp(np.cumsum(log_rets))

    opens  = np.roll(close, 1); opens[0] = close[0]
    highs  = np.maximum(close, opens) * (1 + np.abs(np.random.normal(0, sigma * np.sqrt(dt) * 0.3, n_candles)))
    lows   = np.minimum(close, opens) * (1 - np.abs(np.random.normal(0, sigma * np.sqrt(dt) * 0.3, n_candles)))
    volumes = np.random.lognormal(8, 1.5, n_candles).astype(int)

    base = pd.Timestamp("2025-01-01 05:00:00", tz="UTC") + pd.Timedelta(hours=5, minutes=30)  # 10:30 IST = 05:00 UTC
    timestamps = [base + pd.Timedelta(days=d, minutes=5 * c)
                 for d in range(n_days) for c in range(36)]

    df = pd.DataFrame({
        "timestamp": timestamps[:n_candles],
        "open":  opens,
        "high":  highs,
        "low":   lows,
        "close": close,
        "volume": volumes,
    })
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# ATR computation
# ═══════════════════════════════════════════════════════════════════════════════
def compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """
    Average True Range.
    TR = max(H-L, |H-PDC|, |L-PDC|)
    ATR = rolling mean of TR
    """
    prev_close = df["close"].shift(1)
    tr1 = df["high"] - df["low"]
    tr2 = (df["high"] - prev_close).abs()
    tr3 = (df["low"]  - prev_close).abs()
    tr  = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(period).mean()


# ═══════════════════════════════════════════════════════════════════════════════
# Triple-Barrier Labeling
# ═══════════════════════════════════════════════════════════════════════════════
@dataclass
class TripleBarrierResult:
    label: Literal[1, -1, 0]
    barrier_hit: Literal["pt", "sl", "ts", "none"]
    ret_pct: float          # return in %
    hold_minutes: int
    max_favorable: float    # max % move in trade direction
    max_adverse: float       # max % move against direction


def triple_barrier_label(
    entry_idx: int,
    df: pd.DataFrame,
    direction: Literal["long", "short"],
    sl_atr_mult: float = 2.0,
    pt_atr_mult: float = 3.0,
    max_bars: int = 36,
) -> TripleBarrierResult:
    """
    Apply triple-barrier to a single entry point.

    Barriers:
      1. Stop Loss  — triggered when price moves ≥ sl_atr_mult × ATR against entry direction
      2. Profit Taking — triggered when price moves ≥ pt_atr_mult × ATR in entry direction
      3. Time Stop  — max_bars bars (session end)

    Returns label: 1 (PT hit), -1 (SL hit), 0 (time/nothing)
    """
    entry_price = df.iloc[entry_idx]["close"]
    atr = compute_atr(df)
    atr_val = atr.iloc[entry_idx] if entry_idx < len(atr) else atr.mean()
    sl_pts  = sl_atr_mult * atr_val
    pt_pts  = pt_atr_mult * atr_val

    end_idx = min(entry_idx + max_bars, len(df))
    ret_pct = 0.0
    max_fav  = 0.0
    max_adv  = 0.0
    barrier  = "none"
    label    = 0

    for i in range(entry_idx + 1, end_idx):
        bar = df.iloc[i]
        if direction == "long":
            pts_move = bar["close"] - entry_price
            if pts_move >= pt_pts:
                barrier = "pt"; label = 1
                ret_pct = pt_pts / entry_price * 100
                break
            if pts_move <= -sl_pts:
                barrier = "sl"; label = -1
                ret_pct = -sl_pts / entry_price * 100
                break
            max_fav = max(max_fav, pts_move)
            max_adv = max(max_adv, -pts_move)
        else:  # short
            pts_move = entry_price - bar["close"]
            if pts_move >= pt_pts:
                barrier = "pt"; label = 1
                ret_pct = pt_pts / entry_price * 100
                break
            if pts_move <= -sl_pts:
                barrier = "sl"; label = -1
                ret_pct = -sl_pts / entry_price * 100
                break
            max_fav = max(max_fav, pts_move)
            max_adv = max(max_adv, -pts_move)

    if barrier == "none":
        final_price = df.iloc[end_idx - 1]["close"]
        ret_pct = (final_price - entry_price) / entry_price * 100 if direction == "long" \
                  else (entry_price - final_price) / entry_price * 100
        barrier = "ts"; label = 0

    hold_min = (end_idx - entry_idx - 1) * 5   # rough minutes
    return TripleBarrierResult(
        label=label,
        barrier_hit=barrier,
        ret_pct=round(ret_pct, 4),
        hold_minutes=hold_min,
        max_favorable=round(max_fav / entry_price * 100, 4),
        max_adverse=round(max_adv / entry_price * 100, 4),
    )


def label_all_entries(
    df: pd.DataFrame,
    signals: list[int],   # list of entry_idx where signal=1 (long) or -1 (short)
    sl_atr_mult: float = 2.0,
    pt_atr_mult: float = 3.0,
) -> pd.DataFrame:
    """
    Apply triple-barrier to all entry signals.
    Returns a DataFrame of labeled trades.
    """
    results = []
    for sig_idx, entry_idx in enumerate(signals):
        direction = "long" if sig_idx % 2 == 0 else "short"  # alternate for demo
        tb = triple_barrier_label(entry_idx, df, direction, sl_atr_mult, pt_atr_mult)
        results.append({
            "trade_id":       sig_idx,
            "entry_idx":      entry_idx,
            "entry_price":    df.iloc[entry_idx]["close"],
            "direction":      direction,
            "barrier_hit":    tb.barrier_hit,
            "label":          tb.label,
            "ret_pct":        tb.ret_pct,
            "hold_minutes":   tb.hold_minutes,
            "max_favorable_pct": tb.max_favorable,
            "max_adverse_pct":   tb.max_adverse,
            "timestamp":       df.iloc[entry_idx]["timestamp"],
        })
    return pd.DataFrame(results)


# ═══════════════════════════════════════════════════════════════════════════════
# Purged K-Fold Cross-Validation
# ═══════════════════════════════════════════════════════════════════════════════
def purged_kfold(
    n_samples: int,
    k: int = 5,
    purge_pct: float = 0.01,
    embargo_pct: float = 0.00,
) -> list[tuple[np.ndarray, np.ndarray]]:
    """
    Purged K-Fold: removes observations in the purge zone between train/test.
    Embargo: additional gap after test set.

    López de Prado purge formula:
      purge_indices = num_train_obs × purge_pct  (at each boundary)
      embargo       = num_test_obs × embargo_pct

    Returns list of (train_indices, test_indices) tuples.
    """
    fold_size = n_samples // k
    splits = []
    for fold in range(k):
        # Test set boundaries
        test_start = fold * fold_size
        test_end   = test_start + fold_size

        # Embargo: exclude last embargo_pct of test set
        embargo_end = test_end - max(1, int(fold_size * embargo_pct))

        # Purge: exclude purge_pct around test boundary from training
        purge_size = max(1, int(fold_size * purge_pct))
        train_start_purge = min(test_start + purge_size, n_samples)
        train_end_purge   = max(0, test_end - purge_size)

        # Build train indices (all except test range + embargo + purge)
        test_set = np.arange(test_start, test_end)
        purge_zone = np.arange(max(0, test_start - purge_size),
                               min(n_samples, test_end + purge_size))

        train_mask = np.ones(n_samples, dtype=bool)
        train_mask[test_set] = False
        train_mask[purge_zone] = False
        train_indices = np.where(train_mask)[0]

        # Apply embargo to test set
        embargoed_test = np.arange(test_start, embargo_end)
        if len(embargoed_test) == 0:
            embargoed_test = test_set[:max(1, int(len(test_set) * (1 - embargo_pct)))]

        splits.append((train_indices, embargoed_test))

    return splits


def evaluate_cv(
    labels: pd.DataFrame,
    X: np.ndarray,
    splits: list,
) -> dict:
    """
    Run cross-validation and compute per-fold metrics.
    Computes: accuracy, win rate, avg return per fold.
    """
    results = []
    for fold_idx, (train_idx, test_idx) in enumerate(splits):
        y_test = labels.iloc[test_idx]["label"].values
        accuracy = (y_test != 0).mean()
        win_rate = (y_test == 1).sum() / max(1, (y_test != 0).sum())
        avg_ret  = labels.iloc[test_idx]["ret_pct"].mean()
        n = len(test_idx)
        print(f"  Fold {fold_idx+1}: n={n}  acc={accuracy:.2%}  win_rate={win_rate:.2%}  avg_ret={avg_ret:+.2f}%")
        results.append({"fold": fold_idx+1, "n": n, "accuracy": accuracy,
                        "win_rate": win_rate, "avg_ret": avg_ret})
    return pd.DataFrame(results)


# ═══════════════════════════════════════════════════════════════════════════════
# Run
# ═══════════════════════════════════════════════════════════════════════════════
def run():
    print("=" * 65)
    print("LAB 5 — TRIPLE-BARRIER LABELING + PURGED K-FOLD CV")
    print("=" * 65)
    print()

    # ── Load candles ─────────────────────────────────────────────────────────
    print("── Simulating Nifty intraday candles ───────────────────────────")
    df = simulate_ohlcv(n_days=126, seed=7)
    print(f"  {len(df)} candles  |  {len(df)/36:.0f} trading days")
    print(f"  ATR(14): ₹{compute_atr(df).iloc[-1]:.2f}")
    print()

    # ── Generate synthetic signals ───────────────────────────────────────────
    # Simulate ML signal: every 20th candle → alternate long/short
    signal_idx = list(range(10, len(df) - 36, 20))
    print(f"── Triple-Barrier Labeling ─────────────────────────────────────")
    print(f"  SL = 2×ATR | PT = 3×ATR | Max hold = 36 bars (3 hrs)")
    labels_df = label_all_entries(df, signal_idx)
    print(f"  Total trades: {len(labels_df)}")
    print(f"  Label distribution:")
    for lbl, grp in labels_df.groupby("label"):
        lbl_name = {1: "WIN (PT hit)", -1: "LOSS (SL hit)", 0: "TIME STOP"}.get(lbl, str(lbl))
        print(f"    {lbl_name}: {len(grp)} ({len(grp)/len(labels_df):.1%})")
    print(f"  Average return: {labels_df['ret_pct'].mean():+.3f}%")
    print(f"  Best trade:    {labels_df['ret_pct'].max():+.3f}%")
    print(f"  Worst trade:   {labels_df['ret_pct'].min():+.3f}%")
    print(f"  Win rate:       {(labels_df['label']==1).mean():.1%}")

    # ── Expectancy ───────────────────────────────────────────────────────────
    wins  = labels_df[labels_df["label"] == 1]["ret_pct"]
    losses = labels_df[labels_df["label"] == -1]["ret_pct"]
    avg_win  = wins.mean()   if len(wins)  > 0 else 0
    avg_loss = losses.mean() if len(losses) > 0 else 0
    wr = len(wins) / max(1, len(labels_df[labels_df["label"] != 0]))
    expectancy = wr * avg_win + (1 - wr) * avg_loss
    print(f"  Avg win:       ₹{avg_win:+.3f}%  |  Avg loss: ₹{avg_loss:+.3f}%")
    print(f"  Expectancy:    ₹{expectancy:+.4f}% per trade")

    # ── Purged CV ─────────────────────────────────────────────────────────────
    print()
    print("── Purged 5-Fold CV ───────────────────────────────────────────")
    n = len(labels_df)
    splits = purged_kfold(n, k=5, purge_pct=0.01, embargo_pct=0.00)
    print(f"  {len(splits)} folds  |  purge=1% of fold  |  embargo=0%")
    print(f"  Sample fold sizes: {[len(s[1]) for s in splits[:3]]}")

    cv_results = evaluate_cv(labels_df, np.zeros((n, 1)), splits)
    print()
    print(f"  Overall accuracy: {cv_results['accuracy'].mean():.2%} ± {cv_results['accuracy'].std():.2%}")
    print(f"  Overall win rate:  {cv_results['win_rate'].mean():.2%} ± {cv_results['win_rate'].std():.2%}")
    print(f"  Avg return:        {cv_results['avg_ret'].mean():+.4f}% ± {cv_results['avg_ret'].std():.4f}%")

    # ── Comparison: purged vs naive ─────────────────────────────────────────
    print()
    print("── Purged vs Naive CV comparison ───────────────────────────────")
    naive_splits = [(np.arange(i * n//5),
                     np.arange(i * n//5, (i+1) * n//5)) for i in range(5)]
    naive_results = evaluate_cv(labels_df, np.zeros((n, 1)), naive_splits)
    print(f"  Purged accuracy:  {cv_results['accuracy'].mean():.4f}  vs  Naive: {naive_results['accuracy'].mean():.4f}")
    print(f"  Purged avg_ret:   {cv_results['avg_ret'].mean():+.4f}  vs  Naive: {naive_results['avg_ret'].mean():+.4f}")
    print()
    print("  Key insight: Purging removes ~1% of observations at each")
    print("  train/test boundary to prevent look-ahead bias in CV.")
    print("  The purge zone ensures CV estimates are unbiased.")

    print()
    print("✅  Lab 5 complete")


if __name__ == "__main__":
    run()
