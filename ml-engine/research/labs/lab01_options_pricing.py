"""
Lab 1: Options Pricing + Greeks with QuantLib + py_vollib
========================================================
Book Reference: John Hull — Options, Futures, and Other Derivatives
Focus: Black-Scholes pricing, all Greeks, Nifty-specific parameters

Two pricing engines:
  1. Manual BSM  — equity Black-Scholes (correct for Nifty options)
  2. py_vollib   — Black-76 (futures model, LetsBeRational backend, very fast)
  3. QuantLib    — production-grade term-structure engine

Nifty-specific:
  - Lot size: 25 shares
  - Strike interval: 50 points
  - Weekly expiry: Thursday
  - Spot: ~22,500 (update with live data from Dhan API)
"""

from __future__ import annotations

import sys
if sys.stdout.encoding and 'cp' in sys.stdout.encoding:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import warnings
warnings.filterwarnings("ignore")

import numpy as np
from scipy.stats import norm

# ── QuantLib ──────────────────────────────────────────────────────────────
import QuantLib as ql

# ── py_vollib ─────────────────────────────────────────────────────────────
# py_vollib.black.black(flag, F, K, t, r, sigma)
#   flag: 'c' or 'p'
#   F:    futures price (= spot for no-dividend equity)
#   K:    strike
#   t:    time to expiry in years
#   r:    risk-free rate
#   sigma: volatility
# NOTE: py_vollib implements Black-76 (futures options), not equity BS.
#       For ATM options on no-dividend equities, difference is small at short expiries.
import py_vollib.black as black76
import py_vollib.black.implied_volatility as iv76
import py_vollib.black.greeks.analytical as greeks76


# ── Nifty baseline parameters ─────────────────────────────────────────────
SPOT     = 22_500.0   # Nifty spot — replace with live data
STRIKE   = 22_500.0   # ATM strike
RATE     = 0.065      # ~6.5% risk-free rate (RBI reference)
DIV_YIELD = 0.0       # Nifty doesn't pay discrete dividends
VOL      = 0.15       # 15% IV — replace with live ATM IV from Dhan API
DAYS     = 5          # Calendar days to Thursday expiry
LOT_SIZE = 25         # Nifty lot = 25 shares


# ═══════════════════════════════════════════════════════════════════════════
# METHOD 1 — Manual Black-Scholes (equity model, Hull eq 17.3 / 17.7)
# ═══════════════════════════════════════════════════════════════════════════
def bsm_price(spot: float, strike: float, rate: float, vol: float,
              days: int, flag: str = "c") -> float:
    """
    Black-Scholes closed-form price (Hull, Chapter 17).
    flag: 'c' = call, 'p' = put.
    """
    T = days / 365.0
    sqrtT = np.sqrt(T)
    d1 = (np.log(spot / strike) + (rate + 0.5 * vol**2) * T) / (vol * sqrtT)
    d2 = d1 - vol * sqrtT
    rt = np.exp(-rate * T)
    if flag == "c":
        return spot * norm.cdf(d1) - strike * rt * norm.cdf(d2)
    return strike * rt * norm.cdf(-d2) - spot * norm.cdf(-d1)


def bsm_greeks(spot: float, strike: float, rate: float, vol: float,
               days: int, flag: str = "c") -> dict:
    """
    All first and second order Greeks (Hull Chapter 19).
    Returns per-share values in INR.
    """
    T = days / 365.0
    sqrtT = np.sqrt(T)
    d1 = (np.log(spot / strike) + (rate + 0.5 * vol**2) * T) / (vol * sqrtT)
    d2 = d1 - vol * sqrtT
    phi = norm.pdf(d1)
    rt = np.exp(-rate * T)

    if flag == "c":
        delta = norm.cdf(d1)
        theta = (-spot * phi * vol / (2 * sqrtT) - rate * strike * rt * norm.cdf(d2)) / 365
        rho   = strike * T * rt * norm.cdf(d2) / 100
    else:
        delta = norm.cdf(d1) - 1
        theta = (-spot * phi * vol / (2 * sqrtT) + rate * strike * rt * norm.cdf(-d2)) / 365
        rho   = -strike * T * rt * norm.cdf(-d2) / 100

    gamma = phi / (spot * vol * sqrtT)
    vega  = spot * phi * sqrtT / 100   # per 1% vol change (÷100 converts from per-unit to per-1%)

    return {
        "delta":   round(delta,  4),
        "gamma":   round(gamma,  6),
        "theta":   round(theta,  4),   # INR / day
        "vega":    round(vega,   4),   # INR per 1% vol
        "rho":     round(rho,    4),   # INR per 1% rate
        "d1":      round(d1,     4),
        "d2":      round(d2,     4),
    }


# ═══════════════════════════════════════════════════════════════════════════
# METHOD 2 — py_vollib Black-76 (LetsBeRational backend, very fast)
# ═══════════════════════════════════════════════════════════════════════════
def bv_price(spot: float, strike: float, rate: float, vol: float,
             days: int, flag: str = "c") -> float:
    """
    Black-76 price via py_vollib.
    Signature: black76.black(flag, F, K, t, r, sigma)
    NOTE: Black-76 ≠ equity Black-Scholes. For ATM with no dividends the
          difference is small at short expiries but grows with T.
    """
    T = days / 365.0
    return black76.black(flag, spot, strike, T, rate, vol)


def bv_greeks(spot: float, strike: float, rate: float, vol: float,
              days: int, flag: str = "c") -> dict:
    """
    Black-76 Greeks via py_vollib analytical formulas.
    All Greeks are in discounted (futures-model) terms.
    """
    T = days / 365.0
    d1 = greeks76.d1(spot, strike, T, rate, vol)
    d2 = greeks76.d2(spot, strike, T, rate, vol)
    phi = norm.pdf(d1)

    delta = greeks76.delta(flag, spot, strike, T, rate, vol)
    gamma = greeks76.gamma(flag, spot, strike, T, rate, vol)
    vega  = greeks76.vega(flag,  spot, strike, T, rate, vol)   # per 1% vol (÷100)
    theta = greeks76.theta(flag, spot, strike, T, rate, vol)   # per day (÷365)
    rho   = greeks76.rho(flag,   spot, strike, T, rate, vol)   # per 1% rate (÷100)

    return {
        "delta": round(delta, 4),
        "gamma": round(gamma, 6),
        "theta": round(theta / 365, 4),
        "vega":  round(vega  / 100, 4),
        "rho":   round(rho   / 100, 4),
        "d1":    round(d1,   4),
        "d2":    round(d2,   4),
    }


def bv_implied_vol(market_price: float, spot: float, strike: float,
                   rate: float, days: int, flag: str = "c") -> float:
    """
    Newton-Raphson IV solver via py_vollib.
    Signature: iv76.implied_volatility(discounted_price, F, K, r, t, flag)
    NOTE: r comes BEFORE t in this function's signature (different from black()).
    """
    T = days / 365.0
    # implied_volatility expects the already-discounted market price
    return iv76.implied_volatility(market_price, spot, strike, rate, T, flag)


# ═══════════════════════════════════════════════════════════════════════════
# METHOD 3 — QuantLib production engine
# ═══════════════════════════════════════════════════════════════════════════
def ql_price_and_greeks(spot: float, strike: float, rate: float,
                        vol: float, days: int, flag: str = "c") -> dict:
    """
    QuantLib European option pricing with full term structure support.
    Uses ql.AnalyticEuropeanEngine (C++ compiled, fastest).

    QuantLib Python API notes:
      - ql.Settings.instance().evaluationDate sets the reference date
      - ql.QuoteHandle(ql.SimpleQuote(spot)) wraps the spot price
      - ql.FlatForward with Actual365Fixed day-count
      - ql.BlackScholesProcess (no dividend handle needed for Nifty)
      - ql.Option.Call / ql.Option.Put for flag
      - ql.VanillaOption NPV() returns the price
    """
    ql_flag = ql.Option.Call if flag == "c" else ql.Option.Put

    # Evaluation date
    ql.Settings.instance().evaluationDate = ql.Date(17, 4, 2026)

    # Yield curve (flat forward rate)
    dc = ql.Actual365Fixed()
    r_h = ql.YieldTermStructureHandle(ql.FlatForward(0, ql.NullCalendar(), rate, dc))

    # Volatility term structure (flat vol for now; term vol in Lab 2)
    vol_ts = ql.BlackVolTermStructureHandle(
        ql.BlackConstantVol(0, ql.NullCalendar(), vol, dc)
    )

    # Spot handle
    u_h = ql.QuoteHandle(ql.SimpleQuote(spot))

    # Black-Scholes process (no dividend for Nifty)
    process = ql.BlackScholesProcess(u_h, r_h, vol_ts)

    # Expiry = today + days
    expiry_date = ql.Date(17, 4, 2026) + days
    exercise = ql.EuropeanExercise(expiry_date)
    payoff = ql.PlainVanillaPayoff(ql_flag, strike)

    option = ql.VanillaOption(payoff, exercise)
    option.setPricingEngine(ql.AnalyticEuropeanEngine(process))

    price = option.NPV()

    # Greeks from QuantLib
    delta = option.delta()
    gamma = option.gamma()
    vega  = option.vega() / 100   # per 1% vol
    theta = option.theta() / 365   # per day
    rho   = option.rho() / 100     # per 1% rate

    return {
        "price": round(price,  4),
        "delta": round(delta,  4),
        "gamma": round(gamma,  6),
        "theta": round(theta,  4),
        "vega":  round(vega,   4),
        "rho":   round(rho,    4),
    }


# ═══════════════════════════════════════════════════════════════════════════
# Nifty options helpers
# ═══════════════════════════════════════════════════════════════════════════
def premium_inr(bsm_price_rs: float, lot_size: int = LOT_SIZE) -> float:
    """Convert BSM price (per share) to total premium in INR."""
    return bsm_price_rs * lot_size


def short_put_signal(spot=SPOT, strike=STRIKE, vol=VOL, days=DAYS):
    """
    Greeks for short naked PUT — Nifty morning session primary strategy.
    Returns per-lot values in INR.
    """
    g = bsm_greeks(spot, strike, RATE, vol, days, flag="p")
    p = bsm_price(spot, strike, RATE, vol, days, flag="p")
    return {
        **g,
        "premium_per_lot_rs":  round(premium_inr(p), 2),
        "position":            "SHORT PUT",
        "delta_hedge_shares":  round(abs(g["delta"]) * LOT_SIZE, 0),
        "theta_daily_rs":      round(g["theta"] * LOT_SIZE, 2),
        "vega_per_1pct_rs":    round(g["vega"] * LOT_SIZE, 2),
    }


def short_call_signal(spot=SPOT, strike=STRIKE, vol=VOL, days=DAYS):
    """Greeks for short naked CALL."""
    g = bsm_greeks(spot, strike, RATE, vol, days, flag="c")
    p = bsm_price(spot, strike, RATE, vol, days, flag="c")
    return {
        **g,
        "premium_per_lot_rs":  round(premium_inr(p), 2),
        "position":            "SHORT CALL",
        "delta_hedge_shares":  round(abs(g["delta"]) * LOT_SIZE, 0),
        "theta_daily_rs":      round(g["theta"] * LOT_SIZE, 2),
        "vega_per_1pct_rs":    round(g["vega"] * LOT_SIZE, 2),
    }


def delta_hedge_shares(delta: float, lot_size: int = LOT_SIZE) -> int:
    """How many shares to buy/sell to delta-hedge a 1-lot short option."""
    return int(round(abs(delta) * lot_size))


def lot_count(account_rs: float, risk_pct: float, premium_rs: float,
              lot_size: int = LOT_SIZE) -> int:
    """
    Max lots given account size and risk %.
    e.g. account=100_000, risk_pct=0.01 (1%), premium=200/lot → 5 lots max
    """
    max_risk_rs = account_rs * risk_pct
    return max(1, int(max_risk_rs // premium_rs))


# ═══════════════════════════════════════════════════════════════════════════
# Run
# ═══════════════════════════════════════════════════════════════════════════
def run():
    T = DAYS / 365.0
    print("=" * 65)
    print("LAB 1 — OPTIONS PRICING + GREEKS")
    print("=" * 65)
    print(f"Spot:  ₹{SPOT:,.0f}  |  Strike: ₹{STRIKE:,.0f}  (ATM)")
    print(f"IV:    {VOL:.0%}  |  Rate: {RATE:.1%}  |  Days to expiry: {DAYS}")
    print(f"Lot:   {LOT_SIZE} shares  |  T = {T:.6f} years")
    print()

    # ── Method comparison ───────────────────────────────────────────────
    print("── Method comparison (per share) ─────────────────────────────")
    print(f"{'':12} {'BSM (equity)':>14} {'Black-76':>12} {'QuantLib':>12}")
    print(f"{'':12} {'INR':>14} {'(py_vollib)':>12} {'INR':>12}")

    for flag, label in [("c", "CALL"), ("p", "PUT")]:
        p_bsm   = bsm_price(SPOT, STRIKE, RATE, VOL, DAYS, flag)
        p_bv    = bv_price(SPOT, STRIKE, RATE, VOL, DAYS, flag)
        p_ql    = ql_price_and_greeks(SPOT, STRIKE, RATE, VOL, DAYS, flag)["price"]
        print(f"  {label} price:   ₹{p_bsm:>12.4f}  ₹{p_bv:>10.4f}  ₹{p_ql:>10.4f}")

    print()
    print("── BSM Greeks (equity Black-Scholes, per share) ──────────────")
    for flag, label in [("c", "CALL"), ("p", "PUT")]:
        g = bsm_greeks(SPOT, STRIKE, RATE, VOL, DAYS, flag)
        p = bsm_price(SPOT, STRIKE, RATE, VOL, DAYS, flag)
        print(f"  {label} @ ATM:")
        print(f"    Price:    ₹{p:>10.4f}  |  per lot: ₹{p*LOT_SIZE:>10.2f}")
        print(f"    Delta:    {g['delta']:>+10.4f}  → hedge: {delta_hedge_shares(g['delta'])} shares")
        print(f"    Gamma:    {g['gamma']:>+10.6f}  (per ₹1 move)")
        print(f"    Theta:    ₹{g['theta']:>+10.4f}/day  |  ₹{g['theta']*LOT_SIZE:>+8.2f}/day per lot")
        print(f"    Vega:     ₹{g['vega']:>+10.4f} per 1% vol  |  ₹{g['vega']*LOT_SIZE:>+8.2f} per lot")
        print(f"    Rho:      ₹{g['rho']:>+10.4f} per 1% rate")
        print(f"    d1/d2:    {g['d1']:>+.4f} / {g['d2']:>+.4f}")
        print()

    # ── py_vollib Greeks ────────────────────────────────────────────────
    print("── py_vollib Greeks (Black-76, per share) ─────────────────────")
    for flag, label in [("c", "CALL"), ("p", "PUT")]:
        g = bv_greeks(SPOT, STRIKE, RATE, VOL, DAYS, flag)
        p = bv_price(SPOT, STRIKE, RATE, VOL, DAYS, flag)
        print(f"  {label}: price=₹{p:.4f}  δ={g['delta']:+.4f}  Γ={g['gamma']:.6f}  Θ=₹{g['theta']:+.4f}/day  ν=₹{g['vega']:+.4f}/vol%")

    # ── QuantLib Greeks ────────────────────────────────────────────────
    print()
    print("── QuantLib Greeks (per share) ───────────────────────────────")
    for flag, label in [("c", "CALL"), ("p", "PUT")]:
        result = ql_price_and_greeks(SPOT, STRIKE, RATE, VOL, DAYS, flag)
        print(f"  {label}: price=₹{result['price']:.4f}  δ={result['delta']:+.4f}  Γ={result['gamma']:.6f}  Θ=₹{result['theta']:+.4f}/day  ν=₹{result['vega']:+.4f}/vol%")

    # ── IV solver ─────────────────────────────────────────────────────
    print()
    print("── IV Solver (Newton-Raphson via py_vollib) ──────────────────")
    synthetic = bv_price(SPOT, STRIKE, RATE, 0.18, DAYS, "p")
    recovered = bv_implied_vol(synthetic, SPOT, STRIKE, RATE, DAYS, "p")
    print(f"  Given market price ₹{synthetic:.4f} (18% vol)  →  recovered IV: {recovered:.2%}")

    # ── Short PUT signal (primary strategy) ────────────────────────────
    print()
    print("── Short PUT Signal (primary Nifty morning strategy) ──────────")
    sig = short_put_signal()
    print(f"  Premium/lot:   ₹{sig['premium_per_lot_rs']:,.2f}")
    print(f"  Delta:         {sig['delta']:+.4f}  → delta-hedge with {sig['delta_hedge_shares']:.0f} shares")
    print(f"  Theta:         ₹{sig['theta_daily_rs']:+.2f}/day (time decay you collect)")
    print(f"  Vega:          ₹{sig['vega_per_1pct_rs']:+.2f} per +1% vol increase")
    print(f"  Gamma:         {sig['gamma']:.6f}  (short gamma risk)")
    print()
    print(f"  Position:      {sig['position']}")
    print(f"  Max loss:      unlimited (or 2× premium = ₹{sig['premium_per_lot_rs']*2:,.2f} per lot stop)")

    # ── ATM strike ladder ─────────────────────────────────────────────
    print()
    print("── ATM/OTM/ITM strike ladder (BSM) ───────────────────────────")
    print(f"  {'Strike':>8} {'Moneyness':>10} {'Call':>10} {'Put':>10} {'Delta-C':>9} {'Delta-P':>9}")
    for offset in [-200, -100, -50, 0, 50, 100, 200]:
        k = STRIKE + offset
        mn = "ITM" if offset < 0 else ("OTM" if offset > 0 else "ATM")
        c = bsm_price(SPOT, k, RATE, VOL, DAYS, "c")
        p = bsm_price(SPOT, k, RATE, VOL, DAYS, "p")
        dc = bsm_greeks(SPOT, k, RATE, VOL, DAYS, "c")["delta"]
        dp = bsm_greeks(SPOT, k, RATE, VOL, DAYS, "p")["delta"]
        print(f"  {k:>8,.0f} {mn:>10} ₹{c:>9.2f} ₹{p:>9.2f} {dc:>+9.4f} {dp:>+9.4f}")

    print()
    print("✅  Lab 1 complete")


if __name__ == "__main__":
    run()
