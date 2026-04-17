"""
Lab 3: Vol Surface Features for ML — Extract, Classify, and Store
================================================================
Book Reference: Gatheral Chapter 1-3 (Vol Surface Dynamics)
Focus: Turn the IV surface into ML-ready features for the trading model

Features extracted:
  - ATM IV (term structure per expiry)
  - Skew: IV(OTM-P delta_X) - ATM_IV (downside skew per moneyness)
  - Risk Reversal: IV(OTM-P delta_X) - IV(OTM-C delta_X)
  - Butterfly: 2*ATM_IV - IV(OTM-P) - IV(OTM-C)  [vol convexity]
  - Skew slope: rate of change of skew across strikes
  - IV regime: HIGH (>20%), ELEVATED (17-20%), NORMAL (13-17%), LOW (<13%)
  - ATM skew slope: ATM_IV(7D) - ATM_IV(30D)  [term structure]
  - Smile shape: classify smile/smirk/flat at each expiry

ML use:
  These features feed into RegimeModel + DirectionModel.
  High skew + high RR = fear in market (often bearish)
  Low skew + positive term structure = calm trending market
"""

from __future__ import annotations
import sys as _sys
if _sys.stdout.encoding and 'cp' in _sys.stdout.encoding:
    _sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import warnings
warnings.filterwarnings("ignore")

import numpy as np
from scipy.stats import norm
from dataclasses import dataclass, asdict
from typing import Literal


# ── Nifty parameters ────────────────────────────────────────────────────────
SPOT = 22_500.0
RATE = 0.065
LOT  = 25
STRIKE_INT = 50   # INR 50 between strikes

# ── IV surface (realistic, from Lab 2) ─────────────────────────────────────
_EXPIRY_DAYS = [7, 14, 30]
_MONEYNESS = [0.91, 0.93, 0.96, 0.98, 1.00, 1.02, 1.04, 1.07, 1.09]
_MONEYNESS_LABELS = ['9%OTM-P', '7%OTM-P', '4%OTM-P', '2%OTM-P',
                     'ATM', '2%OTM-C', '4%OTM-C', '7%OTM-C', '9%OTM-C']

# IV surface (decimal vol)
_IV_7D  = [0.21, 0.20, 0.185, 0.175, 0.170, 0.165, 0.158, 0.152, 0.150]
_IV_14D = [0.20, 0.19, 0.178, 0.168, 0.162, 0.158, 0.152, 0.148, 0.145]
_IV_30D = [0.19, 0.18, 0.170, 0.162, 0.155, 0.152, 0.146, 0.142, 0.140]
_IV_SURFACE = {"7D": _IV_7D, "14D": _IV_14D, "30D": _IV_30D}

# ATM deltas for each moneyness (for RR/BF at delta-equivalent strikes)
_DELTAS_7D = [0.03, 0.07, 0.14, 0.23, 0.52, 0.77, 0.86, 0.93, 0.97]


# ═══════════════════════════════════════════════════════════════════════════════
# Core feature computation
# ═══════════════════════════════════════════════════════════════════════════════
@dataclass
class SurfaceFeatures:
    """All vol surface features for one expiry."""
    expiry: str
    atm_vol: float
    skew_put4: float   # vol pts: IV(4%OTM-P) - ATM_IV
    skew_put2: float   # vol pts: IV(2%OTM-P) - ATM_IV
    call_skew4: float  # vol pts: ATM_IV - IV(4%OTM-C)
    rr_4: float       # vol pts: IV(4%OTM-P) - IV(4%OTM-C)
    rr_2: float        # vol pts: IV(2%OTM-P) - IV(2%OTM-C)
    butterfly4: float  # norm: 2*ATM_IV - IV(4%OTM-P) - IV(4%OTM-C) / ATM_IV
    butterfly2: float  # norm: 2*ATM_IV - IV(2%OTM-P) - IV(2%OTM-C) / ATM_IV
    smile_score: float  # 1 = strong smile, 0 = flat, -1 = inverted smirk


def compute_iv_regime(atm_vol: float) -> Literal["HIGH", "ELEVATED", "NORMAL", "LOW"]:
    """
    Classify IV regime from ATM vol level.
    Nifty-specific thresholds (based on historical Nifty IV distribution):
      HIGH:      > 20%  — fear spike, crash protection demanded
      ELEVATED:  17-20% — elevated uncertainty
      NORMAL:    13-17% — typical trading range
      LOW:       < 13%  — complacency, vol compression
    """
    if atm_vol > 0.20:
        return "HIGH"
    elif atm_vol >= 0.17:
        return "ELEVATED"
    elif atm_vol >= 0.13:
        return "NORMAL"
    return "LOW"


def compute_smile_score(ivs: list[float]) -> float:
    """
    Measure smile shape: +1 = symmetric U smile, 0 = flat, -1 = downward smirk.
    Uses OTM-P vol premium over OTM-C vol as the key discriminator.
    For Nifty: smirk (negative) = fear = downside demand > upside.
    """
    # At 7D surface: OTM-P premium = ivs[2] (4% OTM-P) - ivs[5] (4% OTM-C)
    otm_put_premium  = ivs[2] - ivs[4]   # 4% OTM-P vs ATM
    otm_call_premium = ivs[4] - ivs[5]   # ATM vs 4% OTM-C
    # Symmetric smile: these are equal
    # Smirk: OTM-P premium > OTM-C premium (typical for equity indices)
    asymmetry = otm_put_premium - otm_call_premium
    # Normalize to roughly [-1, +1]
    smile_score = np.clip(asymmetry / 0.02, -1, 1)  # 2 vol-pts = full scale
    return round(float(smile_score), 4)


def compute_features_for_expiry(ivs: list[float], expiry: str) -> SurfaceFeatures:
    atm_vol = ivs[4]   # moneyness[4] = 1.00 = ATM
    skew_put4 = ivs[2] - atm_vol
    skew_put2 = ivs[3] - atm_vol
    call_skew4 = atm_vol - ivs[5]
    rr_4 = ivs[2] - ivs[5]     # 4% risk reversal
    rr_2 = ivs[3] - ivs[6]     # 2% risk reversal
    butterfly4 = (2 * atm_vol - ivs[2] - ivs[5]) / atm_vol
    butterfly2 = (2 * atm_vol - ivs[3] - ivs[6]) / atm_vol
    smile = compute_smile_score(ivs)
    return SurfaceFeatures(
        expiry=expiry,
        atm_vol=round(atm_vol, 6),
        skew_put4=round(skew_put4, 6),
        skew_put2=round(skew_put2, 6),
        call_skew4=round(call_skew4, 6),
        rr_4=round(rr_4, 6),
        rr_2=round(rr_2, 6),
        butterfly4=round(butterfly4, 6),
        butterfly2=round(butterfly2, 6),
        smile_score=round(smile, 4),
    )


def compute_all_features() -> dict[str, SurfaceFeatures]:
    """Compute vol surface features for all expiry terms."""
    features = {}
    for exp, ivs in _IV_SURFACE.items():
        features[exp] = compute_features_for_expiry(ivs, exp)
    return features


# ═══════════════════════════════════════════════════════════════════════════════
# Term structure features
# ═══════════════════════════════════════════════════════════════════════════════
@dataclass
class TermStructureFeatures:
    """ATM IV term structure and skew slope features."""
    atm_7d: float
    atm_14d: float
    atm_30d: float
    term_slope_7d_30d: float       # ATM_IV(7D) - ATM_IV(30D) [in vol pts]
    term_slope_7d_14d: float        # ATM_IV(7D) - ATM_IV(14D)
    skew_slope: float               # skew_put4(7D) - skew_put4(30D)
    rr_slope: float                # rr_4(7D) - rr_4(30D)
    vix_proxy: float               # interpolated 30-day ATM vol
    term_structure_shape: Literal["INVERTED", "FLAT", "NORMAL"] = "FLAT"


def compute_term_structure(feat: dict[str, SurfaceFeatures]) -> TermStructureFeatures:
    f = feat
    atm_7d  = f["7D"].atm_vol
    atm_30d = f["30D"].atm_vol
    atm_14d = f["14D"].atm_vol
    term_slope_7d_30d = round(atm_7d - atm_30d, 6)
    term_slope_7d_14d = round(atm_7d - atm_14d, 6)
    diff = term_slope_7d_30d
    if diff > 0.005:
        shape: Literal["INVERTED", "FLAT", "NORMAL"] = "INVERTED"
    elif diff < -0.005:
        shape = "NORMAL"
    else:
        shape = "FLAT"
    return TermStructureFeatures(
        atm_7d=atm_7d,
        atm_14d=atm_14d,
        atm_30d=atm_30d,
        term_slope_7d_30d=term_slope_7d_30d,
        term_slope_7d_14d=term_slope_7d_14d,
        skew_slope=round(f["7D"].skew_put4 - f["30D"].skew_put4, 6),
        rr_slope=round(f["7D"].rr_4 - f["30D"].rr_4, 6),
        vix_proxy=round(f["7D"].atm_vol * 0.7 + f["14D"].atm_vol * 0.3, 6),
        term_structure_shape=shape,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# IV percentile vs historical
# ═══════════════════════════════════════════════════════════════════════════════
def iv_percentile(atm_vol: float, regime: str) -> float:
    """
    Map ATM vol to percentile within the current regime.
    In production: computed from rolling 252-day window of ATM IV.
    Here: uses hardcoded regime bounds for Nifty.
    """
    if regime == "HIGH":
        return np.clip((atm_vol - 0.20) / 0.10 + 0.95, 0.95, 1.0)
    elif regime == "ELEVATED":
        return np.clip((atm_vol - 0.17) / 0.03 + 0.70, 0.70, 0.95)
    elif regime == "NORMAL":
        return np.clip((atm_vol - 0.13) / 0.04 + 0.30, 0.30, 0.70)
    return np.clip((atm_vol - 0.05) / 0.08 + 0.05, 0.05, 0.30)


# ═══════════════════════════════════════════════════════════════════════════════
# Run
# ═══════════════════════════════════════════════════════════════════════════════
def run():
    print("=" * 65)
    print("LAB 3 — VOL SURFACE FEATURES FOR ML")
    print("=" * 65)
    print()

    feat = compute_all_features()
    ts   = compute_term_structure(feat)

    # ── Per-expiry features ───────────────────────────────────────────────
    print("── Per-Expiry Surface Features ────────────────────────────────")
    print(f"  {'Feature':<20} {'7D':>10} {'14D':>10} {'30D':>10}")
    print("  " + "─" * 55)
    for key in ["atm_vol", "skew_put4", "skew_put2", "call_skew4",
                "rr_4", "rr_2", "butterfly4", "butterfly2", "smile_score"]:
        vals = [getattr(feat[e], key) for e in ["7D", "14D", "30D"]]
        if key == "atm_vol":
            vals = [f"{v:.1%}" for v in vals]
        elif key in ["rr_4", "rr_2", "skew_put4", "skew_put2", "call_skew4"]:
            vals = [f"{v:+.2%}" for v in vals]
        elif key in ["butterfly4", "butterfly2", "smile_score"]:
            vals = [f"{v:+.4f}" for v in vals]
        print(f"  {key:<20} {vals[0]:>10} {vals[1]:>10} {vals[2]:>10}")

    # ── IV Regime ─────────────────────────────────────────────────────────
    print()
    print("── IV Regime Classification ───────────────────────────────────")
    for exp, f in feat.items():
        regime = compute_iv_regime(f.atm_vol)
        pct = iv_percentile(f.atm_vol, regime)
        print(f"  {exp}: ATM IV = {f.atm_vol:.2%}  →  regime = {regime}  (percentile ~{pct:.0%})")

    # ── Term structure ─────────────────────────────────────────────────────
    print()
    print("── Term Structure ─────────────────────────────────────────────")
    print(f"  ATM IV:    {ts.atm_7d:.2%} (7D)  →  {ts.atm_14d:.2%} (14D)  →  {ts.atm_30d:.2%} (30D)")
    print(f"  Shape:     {ts.term_structure_shape}")
    print(f"  7D–30D slope: {ts.term_slope_7d_30d:+.2%}  ({ts.term_slope_7d_30d*100:+.1f} vol-pts)")
    print(f"  Skew slope:   {ts.skew_slope:+.2%}  (7D vs 30D skew change)")
    print(f"  RR slope:     {ts.rr_slope:+.2%}  (7D vs 30D RR change)")
    print(f"  vIX proxy:    {ts.vix_proxy:.2%}")

    # ── Interpretation ─────────────────────────────────────────────────────
    print()
    print("── Surface Interpretation (ML signal context) ─────────────────")
    f7 = feat["7D"]
    regime = compute_iv_regime(f7.atm_vol)
    print(f"  Regime: {regime}  |  ATM vol: {f7.atm_vol:.1%}")
    print(f"  Smile score: {f7.smile_score:+.2f}  ", end="")
    if f7.smile_score > 0.3:
        print("(strong smirk → fear)")
    elif f7.smile_score < -0.3:
        print("(inverted → rare)")
    else:
        print("(moderate smirk)")

    print(f"  RR 4%: {f7.rr_4:+.2%}  ({f7.rr_4*100:+.1f} vol-pts)  ", end="")
    if f7.rr_4 > 0.03:
        print("(strong downside demand → bearish signal)")
    else:
        print("(moderate skew)")

    print(f"  Term struct: {ts.term_structure_shape}  ", end="")
    if ts.term_structure_shape == "INVERTED":
        print("(short-dated vol elevated → near-term fear)")
    elif ts.term_structure_shape == "NORMAL":
        print("(long-dated vol elevated → sustained uncertainty)")

    # ── ML feature vector ──────────────────────────────────────────────────
    print()
    print("── ML Feature Vector ──────────────────────────────────────────")
    all_features = {}
    for exp, f in feat.items():
        prefix = f"surf_{exp}"
        all_features.update({
            f"{prefix}_atm_vol":      f.atm_vol,
            f"{prefix}_skew_put4":    f.skew_put4,
            f"{prefix}_skew_put2":    f.skew_put2,
            f"{prefix}_rr_4":         f.rr_4,
            f"{prefix}_rr_2":         f.rr_2,
            f"{prefix}_butterfly4":   f.butterfly4,
            f"{prefix}_smile_score":  f.smile_score,
        })
    all_features.update({
        "term_slope_7d_30d":   ts.term_slope_7d_30d,
        "term_slope_7d_14d":    ts.term_slope_7d_14d,
        "ts_shape_encoded":     {"INVERTED": 2, "FLAT": 1, "NORMAL": 0}[ts.term_structure_shape],
        "skew_slope":           ts.skew_slope,
        "rr_slope":             ts.rr_slope,
        "vix_proxy":            ts.vix_proxy,
    })

    for k, v in all_features.items():
        print(f"  {k:>30s}: {v:>10.6f}")

    print()
    print(f"✅  Lab 3 complete — {len(all_features)} ML-ready features")


if __name__ == "__main__":
    run()
