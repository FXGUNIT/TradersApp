"""
Lab 2: Nifty Volatility Surface — Build, Price, and Extract Surface Features
=============================================================================
Book Reference: John Hull Chapter 19 (Volatility Surfaces) + Gatheral Chapter 1-3
Focus: IV surface for Nifty weekly options, risk-reversal, butterfly, skew

Nifty-specific:
  - ATM: round(spot / 50) * 50
  - Strike interval: 50 points
  - Strike range: spot ± 400 points (9 strikes each side)
  - Expiries: 7DTE, 14DTE, 30DTE (near-term weeklies)
  - IV assumptions: realistic Nifty vol surface (IV rises for OTM puts, high near expiry)

Surface Features:
  - ATM IV (vIX proxy)
  - Skew: (IV_90% - IV_110%) / ATM_IV  [Nifty downside skew]
  - Risk Reversal: (RR_25D - PF_25D) at 25-delta equivalent strikes
  - Butterfly: (IV_90% + IV_110% - 2*IV_100%) / ATM_IV  [vol convexity]
  - Term Structure: ATM_IV(7D) vs ATM_IV(30D)
"""

from __future__ import annotations
import sys as _sys
if _sys.stdout.encoding and 'cp' in _sys.stdout.encoding:
    _sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import warnings
warnings.filterwarnings("ignore")

import numpy as np
from scipy.stats import norm
from scipy.interpolate import interp1d
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors


# ── Nifty parameters ──────────────────────────────────────────────────────────
SPOT = 22_500.0
RATE = 0.065
LOT  = 25

# ── Realistic Nifty vol surface (based on typical market conditions)
# ── Format: iv_surface[expiry_label][ moneyness_ratio ]
# moneyness = K / ATM_spot  (1.0 = ATM, 0.96 = 4% OTM put, 1.04 = 4% OTM call)
#
# Nifty vol surface characteristics (confirmed empirically):
#   - High near-expiry (uncertainty about Thursday settlement)
#   - Downside skew: OTM puts more expensive (IV higher) than OTM calls
#   - Term structure: short-dated vol > long-dated in calm markets (inverted)
#   - Vol-of-vol: ~8-12 vol points across strikes

_EXPIRY_DAYS = [7, 14, 30]  # DTE terms

# Realistic Nifty vol surface (vol in decimal, e.g. 0.16 = 16%)
# Skew: OTM puts trade at premium to OTM calls (inverse skew)
# Moneyness ratios: 0.91, 0.93, 0.96, 0.98, 1.00, 1.02, 1.04, 1.07, 1.09
_MONEYNESS = [0.91, 0.93, 0.96, 0.98, 1.00, 1.02, 1.04, 1.07, 1.09]
_STRIKE_LABELS = ['9% OTM-P', '7% OTM-P', '4% OTM-P', '2% OTM-P',
                   'ATM', '2% OTM-C', '4% OTM-C', '7% OTM-C', '9% OTM-C']

# Realistic Nifty IV surface
# For DTE=7:  ATM=17%, skew toward puts, high near-expiry
# For DTE=14: ATM=16%, flattens slightly
# For DTE=30: ATM=15%, term structure normalizes
_IV_7D  = [0.21, 0.20, 0.185, 0.175, 0.170, 0.165, 0.158, 0.152, 0.150]  # 7 DTE
_IV_14D = [0.20, 0.19, 0.178, 0.168, 0.162, 0.158, 0.152, 0.148, 0.145]  # 14 DTE
_IV_30D = [0.19, 0.18, 0.170, 0.162, 0.155, 0.152, 0.146, 0.142, 0.140]  # 30 DTE
_IV_SURFACE = {"7D": _IV_7D, "14D": _IV_14D, "30D": _IV_30D}

# ── BSM price helper ────────────────────────────────────────────────────────
def bsm_price(spot, strike, rate, vol, days, flag='c'):
    T = days / 365.0
    d1 = (np.log(spot / strike) + (rate + 0.5 * vol**2) * T) / (vol * np.sqrt(T))
    d2 = d1 - vol * np.sqrt(T)
    rt = np.exp(-rate * T)
    if flag == 'c':
        return spot * norm.cdf(d1) - strike * rt * norm.cdf(d2)
    return strike * rt * norm.cdf(-d2) - spot * norm.cdf(-d1)


def bsm_delta(spot, strike, rate, vol, days, flag='c'):
    T = days / 365.0
    d1 = (np.log(spot / strike) + (rate + 0.5 * vol**2) * T) / (vol * np.sqrt(T))
    if flag == 'c':
        return norm.cdf(d1)
    return norm.cdf(d1) - 1


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION A — Build the surface
# ═══════════════════════════════════════════════════════════════════════════════
def build_nifty_surface(spot=SPOT, rate=RATE):
    """
    Build full IV surface as a dict keyed by (expiry_label, strike).
    Also computes BSM prices for each strike/term.
    """
    atm = round(spot / 50) * 50
    surface = {}

    print("── IV Surface — Nifty Weekly Options ─────────────────────────────")
    header = f"  {'Strike':>8} {'Moneyness':>10} {'7D IV':>8} {'14D IV':>8} {'30D IV':>8}"
    print(header)
    print("  " + "─" * 60)

    for mn, label in zip(_MONEYNESS, _STRIKE_LABELS):
        strike = round(spot * mn / 50) * 50
        row = {"strike": strike, "moneyness": label}
        for exp, ivs_key in zip(["7D", "14D", "30D"], [_IV_7D, _IV_14D, _IV_30D]):
            idx = _MONEYNESS.index(mn)
            vol = ivs_key[idx]
            row[f"iv_{exp}"] = vol
            row[f"call_{exp}"] = bsm_price(spot, strike, rate, vol, int(exp[:-1]), 'c')
            row[f"put_{exp}"]  = bsm_price(spot, strike, rate, vol, int(exp[:-1]), 'p')
            # Delta for strike
            row[f"delta_call_{exp}"] = bsm_delta(spot, strike, rate, vol, int(exp[:-1]), 'c')
            row[f"delta_put_{exp}"]  = bsm_delta(spot, strike, rate, vol, int(exp[:-1]), 'p')
        surface[strike] = row
        mn_pct = (strike / spot - 1) * 100
        print(f"  {strike:>8,.0f} {label:>10} "
              f"{row['iv_7D']:>7.1%} {row['iv_14D']:>7.1%} {row['iv_30D']:>7.1%}")

    return surface, atm


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION B — Surface features
# ═══════════════════════════════════════════════════════════════════════════════
def extract_surface_features(surface, atm_spot=SPOT):
    """
    Extract key vol surface features used as ML features.
    All skew/RR/BF measures are in vol-points (not %).
    """
    strikes = sorted(surface.keys())
    atm_strike = round(atm_spot / 50) * 50
    features = {}

    print()
    print("── Surface Features ─────────────────────────────────────────────")

    for exp in ["7D", "14D", "30D"]:
        days = int(exp[:-1])
        iv_col = f"iv_{exp}"

        # ATM IV
        atm_vol = surface[atm_strike][iv_col]
        features[f"atm_vol_{exp}"] = atm_vol

        # Downside skew (OTM put 4% vs ATM)
        k_put4  = round(atm_spot * 0.96 / 50) * 50
        k_put2  = round(atm_spot * 0.98 / 50) * 50
        k_call2 = round(atm_spot * 1.02 / 50) * 50
        k_call4 = round(atm_spot * 1.04 / 50) * 50

        iv_put4  = surface[k_put4][iv_col]
        iv_put2  = surface[k_put2][iv_col]
        iv_call2 = surface[k_call2][iv_col]
        iv_call4 = surface[k_call4][iv_col]

        # Skew: IV(OTM-P 4%) - IV(ATM)  [downside premium over ATM]
        skew_4  = iv_put4  - atm_vol          # vol points
        skew_2  = iv_put2  - atm_vol          # vol points
        # Call skew: ATM - IV(OTM-C 4%)
        call_skew_4 = atm_vol - iv_call4      # vol points

        # Risk Reversal 25-delta equivalent (4% OTM)
        rr_4  = iv_put4 - iv_call4            # vol points (RR > 0 = skew toward puts)
        rr_2  = iv_put2 - iv_call2            # vol points

        # Butterfly (vol convexity) at 4% OTM
        bf_4  = (iv_put4 + iv_call4 - 2 * atm_vol) / atm_vol  # normalized

        # ATM vs 2% OTM spread
        otm_spread = iv_put2 - iv_call2       # vol points

        # Term structure (ATM)
        iv_7d  = surface[atm_strike][f"iv_7D"]
        iv_14d = surface[atm_strike][f"iv_14D"]
        iv_30d = surface[atm_strike][f"iv_30D"]

        print(f"  {exp}:")
        print(f"    ATM IV:          {atm_vol:.1%}  ({atm_vol*100:.1f} vol points)")
        print(f"    Downside skew:   {skew_4:.1%} ({skew_4*100:.1f} vp) vs ATM  [4% OTM-P]")
        print(f"    Call skew:       {call_skew_4:.1%} ({call_skew_4*100:.1f} vp) vs ATM  [4% OTM-C]")
        print(f"    Risk Reversal:   {rr_4:.1%} ({rr_4*100:.1f} vp)  [4% OTM-P - 4% OTM-C]")
        print(f"    Butterfly:       {bf_4:.4f}  [convexity: >0 = smile, <0 = skew]")
        print(f"    ATM term struct:  {iv_7d:.1%} (7D) → {iv_14d:.1%} (14D) → {iv_30d:.1%} (30D)")

        # Store all
        features.update({
            f"skew_put4_{exp}":   round(skew_4,   6),
            f"skew_put2_{exp}":   round(skew_2,   6),
            f"call_skew4_{exp}":  round(call_skew_4, 6),
            f"rr_4_{exp}":        round(rr_4,     6),
            f"rr_2_{exp}":        round(rr_2,     6),
            f"butterfly4_{exp}":  round(bf_4,     6),
            f"otm_spread_{exp}":  round(otm_spread, 6),
        })

    print()
    print("── IV Surface Features (ML-ready) ───────────────────────────────")
    ml_keys = sorted(k for k in features if not k.startswith("iv_7D") and not k.startswith("iv_14D"))
    for k in sorted(features.keys()):
        print(f"  {k:>25s}: {features[k]:>10.6f}")

    return features


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION C — Interpolated IV for arbitrary strike / expiry
# ═══════════════════════════════════════════════════════════════════════════════
def interpolate_iv(spot, strike, surface, exp_days, rate=RATE):
    """
    Bilinear interpolation of IV at arbitrary (strike, expiry).
    1. Interpolate in strike dimension at the two nearest expiry nodes
    2. Interpolate in time dimension between expiry nodes
    """
    expiry_keys = [7, 14, 30]
    expiry_labels = {7: "7D", 14: "14D", 30: "30D"}

    # Find nearest expiry nodes
    lower_exp = next((e for e in expiry_keys if e <= exp_days), expiry_keys[0])
    upper_exp = next((e for e in expiry_keys if e >= exp_days), expiry_keys[-1])

    strikes_in_surface = sorted(surface.keys())
    iv_interp_lower = interp1d(
        strikes_in_surface,
        [surface[k][f"iv_{expiry_labels[lower_exp]}"] for k in strikes_in_surface],
        kind="linear", fill_value="extrapolate"
    )
    iv_interp_upper = interp1d(
        strikes_in_surface,
        [surface[k][f"iv_{expiry_labels[upper_exp]}"] for k in strikes_in_surface],
        kind="linear", fill_value="extrapolate"
    )

    iv_lower = float(iv_interp_lower(strike))
    iv_upper = float(iv_interp_upper(strike))

    if lower_exp == upper_exp:
        return iv_lower

    frac = (exp_days - lower_exp) / (upper_exp - lower_exp)
    return iv_lower + frac * (iv_upper - iv_lower)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION D — Plot vol surface
# ═══════════════════════════════════════════════════════════════════════════════
def plot_vol_surface(surface, atm_spot=SPOT, out_path=None):
    """Plot 2D cross-sections: ATM term structure and skew per expiry."""
    if out_path is None:
        out_path = "ml-engine/research/labs/vol_surface.png"

    strikes = sorted(surface.keys())
    atm_strike = round(atm_spot / 50) * 50
    mn_labels = [surface[k]["moneyness"] for k in strikes]

    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    fig.suptitle(f"Nifty IV Surface  |  Spot={atm_spot:,.0f}", fontsize=13, fontweight='bold')

    # Panel 1: IV vs Strike per expiry
    ax = axes[0]
    colors = {"7D": "#E94057", "14D": "#F7B731", "30D": "#4ECDC4"}
    for exp in ["7D", "14D", "30D"]:
        ivs = [surface[k][f"iv_{exp}"] for k in strikes]
        ax.plot(strikes, [v*100 for v in ivs], marker='o', ms=4,
                label=f"{exp} ({int(exp[:-1])}D)", color=colors[exp], lw=2)
    ax.axvline(atm_strike, color='gray', ls='--', lw=1, alpha=0.6)
    ax.set_xlabel("Strike (INR)")
    ax.set_ylabel("Implied Volatility (%)")
    ax.set_title("IV vs Strike (Term Structure)")
    ax.legend()
    ax.grid(True, alpha=0.3)
    ax.set_xlim(strikes[0]-50, strikes[-1]+50)

    # Panel 2: ATM IV term structure
    ax2 = axes[1]
    dtEs = [7, 14, 30]
    atm_ivs = [surface[atm_strike][f"iv_{e}D"] * 100 for e in dtEs]
    ax2.plot(dtEs, atm_ivs, marker='s', ms=7, color="#4ECDC4", lw=2.5)
    for x, y in zip(dtEs, atm_ivs):
        ax2.annotate(f"{y:.1f}%", (x, y), textcoords="offset points", xytext=(6,4), fontsize=9)
    ax2.set_xlabel("Days to Expiry")
    ax2.set_ylabel("ATM IV (%)")
    ax2.set_title("ATM IV Term Structure\n(vIX proxy)")
    ax2.grid(True, alpha=0.3)
    ax2.set_ylim(min(atm_ivs)*0.9, max(atm_ivs)*1.1)

    # Panel 3: Skew cross-section (7D)
    ax3 = axes[2]
    k_mns = [(k, surface[k]["moneyness"]) for k in strikes]
    skeus = [(surface[k]["iv_7D"] - surface[atm_strike]["iv_7D"]) * 100 for k in strikes]
    colors_sk = ["#E94057" if "Put" in m else "#4ECDC4" if "Call" in m else "#F7B731"
                 for _, m in k_mns]
    ax3.bar([str(k) for k in strikes], skeus, color=colors_sk, alpha=0.8)
    ax3.axhline(0, color='black', lw=1)
    ax3.set_xlabel("Strike")
    ax3.set_ylabel("Skew vs ATM (vol %)")
    ax3.set_title("7D Skew vs ATM\n(red=OTM-P, teal=OTM-C)")
    ax3.tick_params(axis='x', rotation=45)
    ax3.grid(True, alpha=0.3, axis='y')

    plt.tight_layout()
    plt.savefig(out_path, dpi=150, bbox_inches='tight')
    print(f"  [Saved: {out_path}]")
    plt.close()


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION E — vIX approximation
# ═══════════════════════════════════════════════════════════════════════════════
def compute_vix_proxy(surface, atm_spot=SPOT):
    """
    Approximate India VIX from ATM near-term IV term structure.
    Method: Cubic spline interpolation between 7D and 30D ATM IV nodes,
    evaluated at 30-day horizon. (Simplified — real vIX uses OTM options
    weighted by 1/K² F² K² / K² formula from Britten-Jones & Neuberger.)
    """
    atm_strike = round(atm_spot / 50) * 50
    from scipy.interpolate import interp1d

    dtEs = [7, 14, 30]
    atm_ivs = [surface[atm_strike][f"iv_{e}D"] for e in dtEs]

    # Weighted average: proxy vIX ≈ ATM near-term weighted by days remaining
    # Real vIX: weighting based on days to expiry and next expiry
    near_t = dtEs[0]
    next_t  = dtEs[1]
    w = (next_t - 30) / (next_t - near_t)   # weight for near-term
    w = max(0, min(1, w))

    vix_proxy = w * atm_ivs[0] + (1 - w) * atm_ivs[1]  # linear interpolate to 30D
    print()
    print("── vIX Approximation ───────────────────────────────────────────")
    print(f"  ATM IV 7D:   {atm_ivs[0]:.2%}")
    print(f"  ATM IV 14D:  {atm_ivs[1]:.2%}")
    print(f"  ATM IV 30D:  {atm_ivs[2]:.2%}")
    print(f"  vIX proxy:   {vix_proxy:.2%}  (30-day interpolated ATM)")
    print(f"  [Real vIX uses OTM-weighted formula — this is a simplified proxy]")
    return vix_proxy


# ═══════════════════════════════════════════════════════════════════════════════
# Run
# ═══════════════════════════════════════════════════════════════════════════════
def run():
    print("=" * 65)
    print("LAB 2 — NIFTY VOLATILITY SURFACE")
    print("=" * 65)
    print()

    surface, atm = build_nifty_surface(SPOT, RATE)
    features = extract_surface_features(surface, SPOT)
    vix = compute_vix_proxy(surface, SPOT)

    # ── Arbitrary strike interpolation ─────────────────────────────────
    print()
    print("── Interpolated IV check ───────────────────────────────────────")
    # At 7DTE, ATM+100 pts (spot move scenarios)
    for offset in [-200, -100, 0, 100, 200]:
        k = round((SPOT + offset) / 50) * 50
        for days in [5, 10, 21]:
            iv = interpolate_iv(SPOT, k, surface, days)
            p  = bsm_price(SPOT, k, RATE, iv, days, 'p')
            c  = bsm_price(SPOT, k, RATE, iv, days, 'c')
            delta_c = bsm_delta(SPOT, k, RATE, iv, days, 'c')
            delta_p = bsm_delta(SPOT, k, RATE, iv, days, 'p')
            print(f"  K={k:>6,.0f} {days:>3}D: IV={iv:.2%}  "
                  f"CE=₹{c:>7.2f}  PE=₹{p:>7.2f}  "
                  f"ΔC={delta_c:>+.4f}  ΔP={delta_p:>+.4f}")

    # ── Plot ──────────────────────────────────────────────────────────
    print()
    print("── Plotting vol surface...")
    plot_vol_surface(surface, SPOT)

    print()
    print("✅  Lab 2 complete")


if __name__ == "__main__":
    run()
