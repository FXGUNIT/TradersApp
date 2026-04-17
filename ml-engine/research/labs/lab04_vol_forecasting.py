"""
Lab 4: Volatility Forecasting Baselines — HAR + GARCH
=====================================================
Book Reference: Corsi (2009) HAR + Bollerslev GARCH
Reference: Gatheral Chapter 2 (Volatility Forecasting)

Goal: Build two volatility forecasting baselines for Nifty returns:
  1. HAR:  rv_5 + rv_30 + jump component
  2. GARCH(1,1): standard financial GARCH
  Then evaluate with MSFE / DA-R² on synthetic + historical data.

HAR intuition (Corsi 2009):
  Traders are heterogeneous: short-term (1-day), medium-term (1-week),
  long-term (1-month). HAR aggregates these three.
  Log(RV) = α + β_1*RV_1 + β_5*RV_5 + β_22*RV_22 + ρ*J + ε

Nifty application:
  - Use 5-min candle intraday returns to compute realized variance
  - Forecast next-day RV
  - Feed forecast into options sizing (higher vol = larger premium)
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


# ═══════════════════════════════════════════════════════════════════════════════
# Synthetic intraday candle data (simulate Nifty 5-min candles)
# Real implementation: fetch from data/candle_db.py
# ═══════════════════════════════════════════════════════════════════════════════
def simulate_nifty_candles(n_days: int = 252, seed: int = 42) -> pd.DataFrame:
    """
    Simulate n_days of Nifty 5-minute candles.
    Realistically: ~75 5-min candles per trading day (9:15–15:30 IST).
    Returns DataFrame with: timestamp, open, high, low, close, volume
    """
    np.random.seed(seed)
    n_candles = n_days * 75   # 75 candles/day
    dt = 5 / (75 * 252)      # 5-min interval as fraction of year

    # Nifty drift and vol parameters (annualized)
    mu = 0.0002              # small positive drift
    sigma = 0.16             # 16% annualized vol

    # Geometric Brownian Motion
    log_returns = np.random.normal(mu * dt, sigma * np.sqrt(dt), n_candles)
    close_prices = 22_500 * np.exp(np.cumsum(log_returns))

    # Build OHLC from close
    opens  = np.roll(close_prices, 1)
    opens[0] = close_prices[0]

    # High/Low from random walk extremes
    intraday_vol = sigma * np.sqrt(dt)
    highs = np.maximum(close_prices, opens) * (1 + np.abs(np.random.normal(0, intraday_vol * 0.5, n_candles)))
    lows  = np.minimum(close_prices, opens) * (1 - np.abs(np.random.normal(0, intraday_vol * 0.5, n_candles)))

    # Timestamp: 9:15 IST = 3:45 UTC per day
    base_ts = pd.Timestamp("2025-01-01 03:45:00", tz="UTC")
    timestamps = [base_ts + pd.Timedelta(minutes=5 * i) for i in range(n_candles)]
    # Remove non-trading hours roughly (weekends skip handled by index)

    df = pd.DataFrame({
        "timestamp": timestamps,
        "open":  opens,
        "high":  highs,
        "low":   lows,
        "close": close_prices,
        "volume": np.random.lognormal(8, 1.5, n_candles).astype(int),
    })
    return df


def realized_variance(candles: pd.DataFrame, freq: str = "1H") -> pd.DataFrame:
    """
    Compute Realized Variance (RV) at specified frequency.
    RV = Σ r²  (sum of squared intrabar returns)
    For 1H: sum of 5-min returns in each hour.
    """
    df = candles.copy()
    df["log_ret"] = np.log(df["close"] / df["open"])

    # Resample to hourly
    df.set_index("timestamp", inplace=True)
    hourly_rv = (df["log_ret"] ** 2).resample(freq).sum().dropna()
    return hourly_rv


def daily_rv(candles: pd.DataFrame) -> pd.DataFrame:
    """
    Compute daily realized variance from intraday 5-min candles.
    Each trading day = ~75 5-min candles.
    """
    df = candles.copy()
    df["log_ret"] = np.log(df["close"] / df["open"])
    df["day"] = df["timestamp"].dt.date
    daily_rv = df.groupby("day")["log_ret"].apply(lambda x: (x ** 2).sum())
    return daily_rv


# ═══════════════════════════════════════════════════════════════════════════════
# HAR Model (Heterogeneous Autoregressive)
# ═══════════════════════════════════════════════════════════════════════════════
@dataclass
class HARResult:
    alpha: float
    beta_1: float   # 1-day RV coefficient
    beta_5: float   # 5-day (weekly) RV coefficient
    beta_22: float  # 22-day (monthly) RV coefficient
    jump_component: float
    r_squared: float


class HARModel:
    """
    HAR: log(RV_{t+1}) = α + β_1*log(RV_t) + β_5*log(RV_t^{(5)})
                                     + β_22*log(RV_t^{(22)}) + ρ*J_t + ε
    Where RV^{(k)} = average of k 5-min RV samples.
    """
    def __init__(self):
        self.params: HARResult | None = None

    def fit(self, rv_series: pd.Series) -> HARResult:
        """Fit HAR via OLS on log RV."""
        df = pd.DataFrame({"rv": rv_series.values})
        df["log_rv"] = np.log(df["rv"].clip(lower=1e-10))

        # Lag features
        df["rv_1"]  = df["rv"].shift(1)
        df["rv_5"]  = df["rv"].shift(1).rolling(5).mean()
        df["rv_22"] = df["rv"].shift(1).rolling(22).mean()

        # Jump component: |r| > 2 * σ  (Barndorff-Nielsen sharp variation)
        # Simplified: days where daily log_ret > 2 * sqrt(rv)
        daily_rets = np.diff(np.log(rv_series.values.cumprod().reshape(-1)))
        # Just use squared jump indicator
        df["jump"] = (df["rv"] > 2 * df["rv"].shift(1)).astype(float).shift(1)

        df.dropna(inplace=True)

        # OLS via normal equations (no sklearn dependency for clarity)
        X = np.column_stack([np.ones(len(df)), df["log_rv"].values,
                             df["rv_5"].values, df["rv_22"].values, df["jump"].values])
        y = df["log_rv"].values

        beta = np.linalg.lstsq(X, y, rcond=None)[0]
        residuals = y - X @ beta
        ss_res = (residuals ** 2).sum()
        ss_tot = ((y - y.mean()) ** 2).sum()
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0

        self.params = HARResult(
            alpha=round(beta[0], 6),
            beta_1=round(beta[1], 4),
            beta_5=round(beta[2], 4),
            beta_22=round(beta[3], 4),
            jump_component=round(beta[4], 4),
            r_squared=round(r2, 4),
        )
        return self.params

    def predict(self, rv_series: pd.Series) -> np.ndarray:
        """One-step-ahead HAR forecast."""
        if self.params is None:
            raise ValueError("Model not fitted")
        p = self.params
        preds = []
        for i in range(1, len(rv_series)):
            rv_t    = rv_series.iloc[max(0, i-1)]
            rv_5    = rv_series.iloc[max(0, i-5):i].mean() if i >= 5 else rv_series.iloc[:i].mean()
            rv_22   = rv_series.iloc[max(0, i-22):i].mean() if i >= 22 else rv_series.iloc[:i].mean()
            jump    = 1.0 if rv_t > 2 * rv_series.iloc[max(0, i-2)] else 0.0
            log_rv_fcast = p.alpha + p.beta_1 * np.log(rv_t + 1e-10) + \
                           p.beta_5 * np.log(rv_5 + 1e-10) + \
                           p.beta_22 * np.log(rv_22 + 1e-10) + \
                           p.jump_component * jump
            preds.append(np.exp(log_rv_fcast))
        return np.array(preds)


# ═══════════════════════════════════════════════════════════════════════════════
# GARCH(1,1) Model
# ═══════════════════════════════════════════════════════════════════════════════
def fit_garch11(returns: np.ndarray) -> dict:
    """
    Fit GARCH(1,1) via maximum likelihood using scipy bounded optimizer.
    h_t = ω + α * r_{t-1}² + β * h_{t-1}
    Annualized vol: σ_annual = sqrt(h_t * 252)
    """
    from scipy.optimize import minimize

    T = len(returns)
    r2 = returns ** 2

    def neg_ll(params):
        o, a, b = params
        h = np.zeros(T)
        h[0] = r2[0] if r2[0] > 0 else 1e-8
        for t in range(1, T):
            h[t] = o + a * r2[t-1] + b * h[t-1]
        h = np.clip(h, 1e-10, None)
        ll = -0.5 * (np.log(2 * np.pi) + np.log(h) + r2 / h)
        return -ll.sum()

    # Constraints: omega > 0, alpha > 0, beta > 0, alpha + beta < 1
    constraints = {"type": "ineq", "fun": lambda p: 1 - p[1] - p[2]}
    bounds = [(1e-8, 1.0), (1e-5, 0.3), (0.5, 0.9999)]
    # Initial: omega ~ long-run variance, alpha=0.08, beta=0.90
    var_daily = returns.var()
    x0 = [var_daily * 0.1, 0.08, 0.90]

    result = minimize(neg_ll, x0, method="SLSQP",
                      bounds=bounds, constraints=constraints,
                      options={"maxiter": 500})
    omega, alpha, beta_g = result.x
    persistence = alpha + beta_g

    # Compute conditional variances
    h = np.zeros(T)
    h[0] = r2[0] if r2[0] > 0 else var_daily
    for t in range(1, T):
        h[t] = omega + alpha * r2[t-1] + beta_g * h[t-1]
    h_forecast = omega + (alpha + beta_g) * h[-1]

    vol_fcast_annual = np.sqrt(h_forecast * 252)

    return {
        "omega":         round(float(omega), 8),
        "alpha":         round(float(alpha), 4),
        "beta":          round(float(beta_g), 4),
        "half_life":     round(float(np.log(0.5) / np.log(max(persistence, 1e-6)) if persistence < 1 else 10), 1),
        "persistence":   round(float(persistence), 4),
        "vol_fcast_annual": round(float(vol_fcast_annual), 4),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Evaluation
# ═══════════════════════════════════════════════════════════════════════════════
def msfe(actual: np.ndarray, forecast: np.ndarray) -> float:
    """Mean Squared Forecast Error."""
    return float(np.mean((actual - forecast) ** 2))


def da_r2(actual: np.ndarray, forecast: np.ndarray, benchmark: np.ndarray) -> float:
    """
    Diebold-Mariano/DA-R²: improvement in MSFE vs naive persistence forecast.
    R²_DA = 1 - MSFE(model) / MSFE(persistence)
    Positive = model beats naive.
    """
    msfe_model  = msfe(actual, forecast)
    msfe_naive  = msfe(actual, benchmark)
    return round(1 - msfe_model / msfe_naive, 4) if msfe_naive > 0 else 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# Run
# ═══════════════════════════════════════════════════════════════════════════════
def run():
    print("=" * 65)
    print("LAB 4 — VOLATILITY FORECASTING BASELINES")
    print("=" * 65)
    print()

    # ── Generate synthetic candles ─────────────────────────────────────────
    print("── Simulating 252 days of Nifty 5-min candles ─────────────────")
    candles = simulate_nifty_candles(n_days=252, seed=42)
    print(f"  {len(candles):,} candles  |  spot range: {candles['close'].min():.0f} – {candles['close'].max():.0f}")
    print(f"  Sample: {candles.iloc[0]['close']:.2f} → {candles.iloc[74]['close']:.2f} (first day close)")
    print()

    # ── Daily RV ───────────────────────────────────────────────────────────
    print("── Realized Variance Series ─────────────────────────────────────")
    drv = daily_rv(candles)
    print(f"  {len(drv)} trading days of RV")
    print(f"  Mean RV:     {drv.mean():.8f}  ({np.sqrt(drv.mean()*252):.2%} annualized)")
    print(f"  Median RV:   {drv.median():.8f}  ({np.sqrt(drv.median()*252):.2%} annualized)")
    print(f"  Max RV:      {drv.max():.8f}  ({np.sqrt(drv.max()*252):.2%} annualized)")
    print(f"  Min RV:      {drv.min():.8f}  ({np.sqrt(drv.min()*252):.2%} annualized)")

    # ── HAR Fit ─────────────────────────────────────────────────────────────
    print()
    print("── HAR(1,5,22) Fit ─────────────────────────────────────────────")
    har = HARModel()
    drv_clean = drv[drv > 0].dropna()
    har_params = har.fit(drv_clean)
    print(f"  α (intercept):   {har_params.alpha}")
    print(f"  β_1 (1-day):      {har_params.beta_1}")
    print(f"  β_5 (weekly):     {har_params.beta_5}")
    print(f"  β_22 (monthly):   {har_params.beta_22}")
    print(f"  ρ (jump):         {har_params.jump_component}")
    print(f"  R² (in-sample):   {har_params.r_squared}")
    print(f"  Interpretation:   ", end="")
    if har_params.beta_5 > har_params.beta_1:
        print(f"Medium-term RV drives forecasts (contango in vol-of-vol)")
    else:
        print(f"Short-term RV dominates (mean-reversion in vol)")

    # ── HAR Forecast evaluation ─────────────────────────────────────────────
    print()
    print("── HAR Forecast Evaluation (rolling 1-step) ───────────────────")
    rv_arr = drv_clean.values
    har_preds = har.predict(drv_clean)
    # Naive: persistence (lag-1 RV)
    naive_preds = np.roll(rv_arr, 1)
    naive_preds[0] = rv_arr[0]

    msfe_har   = msfe(rv_arr[1:], har_preds)
    msfe_naive = msfe(rv_arr[1:], naive_preds[1:])
    da2_har    = da_r2(rv_arr[1:], har_preds, naive_preds[1:])
    print(f"  MSFE HAR:     {msfe_har:.8f}")
    print(f"  MSFE naive:   {msfe_naive:.8f}")
    print(f"  DA-R² HAR:     {da2_har:+.4f}  ({'beats naive' if da2_har > 0 else 'naive wins'})")

    # ── GARCH Fit ───────────────────────────────────────────────────────────
    print()
    print("── GARCH(1,1) Fit ──────────────────────────────────────────────")
    log_rets = np.diff(np.log(candles.groupby(candles['timestamp'].dt.date)['close'].last().values))
    garch = fit_garch11(log_rets)
    print(f"  ω (omega):           {garch['omega']:.2e}")
    print(f"  α (ARCH):            {garch['alpha']:.4f}")
    print(f"  β (GARCH):           {garch['beta']:.4f}")
    print(f"  Persistence (α+β):   {garch['persistence']:.4f}")
    print(f"  Half-life:           {garch['half_life']} days")
    print(f"  Vol forecast:        {garch['vol_fcast_annual']:.2%}  (annualized)")
    print(f"  Interpretation:      ", end="")
    if garch['persistence'] > 0.95:
        print(f"High persistence → vol clustering strong")
    elif garch['persistence'] > 0.85:
        print(f"Moderate persistence → typical for equity index")
    else:
        print(f"Low persistence → mean-reverting vol")

    # ── Options sizing implication ───────────────────────────────────────────
    print()
    print("── Options Sizing Implication ───────────────────────────────────")
    har_vol = np.sqrt(har_preds[-1] * 252) if len(har_preds) > 0 else 0.16
    garch_vol = garch['vol_fcast_annual']
    avg_vol = (har_vol + garch_vol) / 2
    print(f"  HAR 1-day fcast vol:  {har_vol:.2%}")
    print(f"  GARCH fcast vol:       {garch_vol:.2%}")
    print(f"  Average:               {avg_vol:.2%}")
    print(f"  Conservative estimate: {max(har_vol, garch_vol):.2%}")
    print()
    print(f"  If using 1% risk on ₹1L account = ₹1,000 max loss per trade")
    print(f"  ATM 5DTE premium at {avg_vol:.1%} IV: ~₹{(avg_vol*22500*np.sqrt(5/365)*0.5):.0f}/lot")
    lots_avg = max(1, int(1000 / (avg_vol * 22500 * np.sqrt(5/365) * 0.5 * 25)))
    lots_16  = max(1, int(1000 / (0.16 * 22500 * np.sqrt(5/365) * 0.5 * 25)))
    print(f"  Max lots: {lots_avg}  (vs {lots_16} at 16% IV)")

    print()
    print("✅  Lab 4 complete")


if __name__ == "__main__":
    run()
