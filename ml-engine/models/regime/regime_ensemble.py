"""
Regime Ensemble — Combines HMM, FP-FK, and Anomalous Diffusion models
into a unified regime signal with deleverage trigger.

This is the regime model used by the consensus aggregator and exit optimizer.
It runs all three physics-based models and returns a weighted consensus.
"""
import numpy as np
import pandas as pd
import sys, os
from typing import Optional

<<<<<<< HEAD
# ml-engine/ is already on sys.path via conftest.py; avoid inserting TradersApp/
# which would create a conflicting models/ namespace lookup.

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
=======
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
import config
from models.regime.hmm_regime import HMMRegimeDetector
from models.regime.fp_fk_regime import FPFKRegimeDetector, q_to_regime
from models.regime.anomalous_diffusion import AnomalousDiffusionModel


class RegimeEnsemble:
    """
    Physics-based regime ensemble combining:
      1. HMM — Gaussian HMM, 3 states (COMPRESSION/NORMAL/EXPANSION)
      2. FP-FK — Fokker-Planck + Fisher-KPP PDE with Tsallis q-Gaussians
      3. Anomalous Diffusion — Hurst exponent via DFA + GHE

    The FP-FK model provides:
      - Tsallis q-parameter (fat-tail measure)
      - Fisher-KPP wave speed (regime transition velocity)
      - Criticality index κ (deleverage trigger)
      - Entropy rate (rate of regime change)

    The Anomalous Diffusion model provides:
      - Hurst exponent H (momentum vs mean-reversion)
      - Multifractality (complexity of return dynamics)
      - Diffusion type (SUB/NORMAL/SUPER)
      - Volatility clustering intensity

    Weights are adaptive based on each model's confidence.
    """

    name = "regime_ensemble"
    model_type = "regime"

    # Map from regime names to canonical IDs
    REGIME_IDS = {
        "COMPRESSION": 0,
        "NORMAL": 1,
        "EXPANSION": 2,
        "CRISIS": 3,
    }

    def __init__(self, random_state: int = 42):
        self._hmm = HMMRegimeDetector(n_states=3, random_state=random_state)
        self._fp_fk = FPFKRegimeDetector(n_states=4, random_state=random_state)
        self._anom = AnomalousDiffusionModel(window_size=100, random_state=random_state)
        self._is_trained = False
        self._last_df: Optional[pd.DataFrame] = None

    def train(self, df: pd.DataFrame, verbose: bool = True) -> dict:
        """
        Train all three models on historical candle data.
        FP-FK and Anomalous Diffusion are online — trained incrementally.
        HMM requires batch training.
        """
        if len(df) < 50:
            raise ValueError(f"Need at least 50 candles, got {len(df)}")

        results = {}

        # 1. HMM — batch train
        if verbose:
            print("  [RegimeEnsemble] Training HMM...")
        try:
            hmm_metrics = self._hmm.train(df, verbose=verbose)
            results["hmm"] = hmm_metrics
        except Exception as e:
            if verbose:
                print(f"  HMM training failed: {e}")

        # 2. FP-FK — advance the PDE to current state
        if verbose:
            print("  [RegimeEnsemble] Advancing FP-FK PDE...")
        try:
            fp_fk_metrics = self._fp_fk.train(df, verbose=verbose)
            results["fp_fk"] = fp_fk_metrics
        except Exception as e:
            if verbose:
                print(f"  FP-FK training failed: {e}")

        # 3. Anomalous Diffusion — estimate Hurst exponent
        if verbose:
            print("  [RegimeEnsemble] Computing anomalous diffusion...")
        try:
            anom_metrics = self._anom.train(df, verbose=verbose)
            results["anomalous_diffusion"] = anom_metrics
        except Exception as e:
            if verbose:
                print(f"  Anomalous diffusion failed: {e}")

        self._is_trained = True
        self._last_df = df.copy()

        return results

    def advance(self, df: pd.DataFrame) -> dict:
        """
        Advance all online models (FP-FK + Anomalous Diffusion) by one candle.
        Returns the unified regime signal with deleverage.
        """
        self._last_df = df.copy()

        # Get individual model outputs
        hmm_result = self._get_hmm(df)
        fp_fk_result = self._get_fp_fk(df)
        anom_result = self._get_anom(df)

        # Weighted consensus on regime
        regime_probs = self._ensemble_regime(hmm_result, fp_fk_result)

        # Combine deleverage signals
        deleverage_prob, deleverage_reason = self._combine_deleverage(
            fp_fk_result, anom_result, regime_probs
        )

        # Diff-adjusted signal
        if anom_result.get("diffusion_type") == "SUB_DIFFUSION":
            signal_adjustment = "LONG_FAVORED"
        elif anom_result.get("diffusion_type") == "SUPER_DIFFUSION":
            signal_adjustment = "SHORT_FAVORED"
        else:
            signal_adjustment = "BALANCED"

        # Volatility-adjusted stop multiplier
        stop_mult = self._get_stop_multiplier(fp_fk_result, anom_result)

        # Assemble explanation
        explanations = self._build_explanation(
            hmm_result, fp_fk_result, anom_result,
            regime_probs, deleverage_prob, signal_adjustment
        )

        return {
            # Ensemble consensus
            "regime": regime_probs["ensemble_regime"],
            "regime_id": self.REGIME_IDS.get(regime_probs["ensemble_regime"], 1),
            "regime_confidence": round(regime_probs["ensemble_confidence"], 4),
            "regime_posteriors": regime_probs["posteriors"],
            "model_weights": regime_probs["weights"],

            # FP-FK specific
            "fp_fk": fp_fk_result,
            "q_parameter": fp_fk_result.get("q_parameter", 1.5),
            "fk_wave_speed": fp_fk_result.get("fk_wave_speed", 0.0),
            "fk_wave_acceleration": fp_fk_result.get("fk_wave_acceleration", 0.0),
            "criticality_index": fp_fk_result.get("criticality_index", 0.0),
            "front_direction": fp_fk_result.get("front_direction", "STABLE"),
            "reaction_rate": fp_fk_result.get("reaction_rate", 0.02),
            "diffusion_coeff": fp_fk_result.get("diffusion_coeff", 0.05),

            # HMM
            "hmm": hmm_result,

            # Anomalous Diffusion
            "anomalous_diffusion": anom_result,
            "hurst_H": anom_result.get("hurst_H", 0.5),
            "diffusion_type": anom_result.get("diffusion_type", "NORMAL"),
            "vol_clustering": anom_result.get("vol_clustering", "MODERATE"),
            "multifractality": anom_result.get("multifractality", "MONOFRACTAL"),
            "position_adjustment": anom_result.get("position_adjustment", 0.0),

            # Deleverage
            "deleverage_signal": round(deleverage_prob, 4),
            "deleverage_reason": deleverage_reason,

            # Adjustments
            "signal_adjustment": signal_adjustment,
            "stop_multiplier": round(stop_mult, 3),
            "explanation": explanations,
        }

    def predict_current(self, df: pd.DataFrame) -> dict:
        return self.advance(df)

    def _get_hmm(self, df: pd.DataFrame) -> dict:
        try:
            return self._hmm.predict_current(df)
        except Exception:
            return self._hmm._default_regime()

    def _get_fp_fk(self, df: pd.DataFrame) -> dict:
        try:
            if not self._fp_fk.is_trained:
                self._fp_fk.train(df, verbose=False)
            else:
                self._fp_fk._estimate_parameters(df)
                self._fp_fk._f_current, _, _ = self._fp_fk.solve_fp_fk_pde(
                    f0=self._fp_fk._f_current,
                    A_vr=self._fp_fk._build_drift_field()[0],
                    A_adx=self._fp_fk._build_drift_field()[1],
                    D_q=float(self._fp_fk._build_diffusion_field().mean()),
                    r_rate=self._fp_fk._get_reaction_rate(df),
                    F_q=self._fp_fk._build_equilibrium(),
                    dt=0.1,
                    n_steps=3,
                    dx=self._fp_fk._dvr,
                    dy=self._fp_fk._dadx,
                )
            return self._fp_fk.predict_current(df)
        except Exception:
            return self._fp_fk._default_output()

    def _get_anom(self, df: pd.DataFrame) -> dict:
        try:
            new_returns = df["log_return"].dropna().tail(1).values
            if len(new_returns) > 0 and hasattr(self._anom, "_recent_returns"):
                self._anom._recent_returns.append(float(new_returns[0]))
                if len(self._anom._recent_returns) > self._anom.window_size:
                    self._anom._recent_returns.pop(0)
            return self._anom.predict_current(df)
        except Exception:
            return {
                "hurst_H": 0.5,
                "diffusion_type": "NORMAL",
                "vol_clustering": "MODERATE",
                "multifractality": "MONOFRACTAL",
                "position_adjustment": 0.0,
            }

    def _ensemble_regime(self, hmm_result: dict, fp_fk_result: dict) -> dict:
        """
        Combine HMM and FP-FK regime probabilities.
        FP-FK has 4 states, HMM has 3 — map to canonical.
        """
        # HMM posteriors
        hmm_posteriors = hmm_result.get("posterior_probs", {
            "COMPRESSION": 0.33, "NORMAL": 0.34, "EXPANSION": 0.33
        })
        hmm_conf = hmm_result.get("confidence", 0.33)

        # FP-FK posteriors (4 states)
        fp_posteriors = fp_fk_result.get("posterior_probs", {
            "COMPRESSION": 0.25, "NORMAL": 0.5, "EXPANSION": 0.15, "CRISIS": 0.1
        })
        fp_conf = fp_fk_result.get("confidence", 0.25)

        # Map FP-FK crisis into expansion if no crisis detected
        crisis_mass = fp_posteriors.get("CRISIS", 0.0)
        fp_posteriors_expanded = {
            "COMPRESSION": fp_posteriors.get("COMPRESSION", 0.0),
            "NORMAL": fp_posteriors.get("NORMAL", 0.0) + crisis_mass * 0.5,  # crisis → expand
            "EXPANSION": fp_posteriors.get("EXPANSION", 0.0) + crisis_mass * 0.5,
        }

        # Normalize
        total = sum(fp_posteriors_expanded.values())
        if total > 0:
            fp_posteriors_expanded = {k: v / total for k, v in fp_posteriors_expanded.items()}

        # Adaptive weights: FP-FK gets higher weight when q ≠ 1 (non-Gaussian)
        q = fp_fk_result.get("q_parameter", 1.5)
        q_deviation = abs(q - 1.0)
        w_fp = 0.4 + 0.3 * q_deviation  # [0.4, 0.7] depending on q
        w_hmm = 1.0 - w_fp
        w_hmm = max(0.2, min(0.6, w_hmm))

        # Weighted ensemble posteriors
        ensemble_posteriors = {}
        for regime in ["COMPRESSION", "NORMAL", "EXPANSION"]:
            ensemble_posteriors[regime] = (
                w_fp * fp_posteriors_expanded.get(regime, 0.0) +
                w_hmm * hmm_posteriors.get(regime, 0.0)
            )

        # Normalize
        P_total = sum(ensemble_posteriors.values())
        if P_total > 0:
            ensemble_posteriors = {k: v / P_total for k, v in ensemble_posteriors.items()}

        # Ensemble regime = argmax posterior
        ensemble_regime = max(ensemble_posteriors, key=ensemble_posteriors.get)
        ensemble_conf = ensemble_posteriors[ensemble_regime]

        # Boost confidence if both models agree
        hmm_regime = hmm_result.get("regime", "NORMAL")
        fp_regime = fp_fk_result.get("regime", "NORMAL")
        if hmm_regime == fp_regime or hmm_regime in fp_posteriors_expanded:
            if abs(ensemble_posteriors.get(hmm_regime, 0) - ensemble_conf) < 0.1:
                ensemble_conf = min(1.0, ensemble_conf + 0.1)

        return {
            "ensemble_regime": ensemble_regime,
            "ensemble_confidence": ensemble_conf,
            "posteriors": {k: round(v, 4) for k, v in ensemble_posteriors.items()},
            "weights": {"fp_fk": round(w_fp, 3), "hmm": round(w_hmm, 3)},
            "hmm_agreement": hmm_regime == fp_regime,
        }

    def _combine_deleverage(self,
                          fp_fk: dict,
                          anom: dict,
                          regime_probs: dict) -> tuple[float, str]:
        """
        Combine deleverage signals from FP-FK and Anomalous Diffusion.

        Triggers:
          1. FP-FK criticality spike
          2. FP-FK wave front acceleration
          3. Crisis regime
          4. Hurst approaching 0.3 (strong mean-reversion → bottom)
          5. Multiple signals combined
        """
        signals = []
        weights = []

        # FP-FK deleverage
        fp_del = fp_fk.get("deleverage_signal", 0.0)
        fp_reason = fp_fk.get("deleverage_reason", "")
        fp_kappa = fp_fk.get("criticality_index", 0.0)

        if fp_del > 0.3:
            signals.append(f"FP-FK κ={fp_kappa:.3f} → deleverage {fp_del:.0%}")
            weights.append(fp_del)

        # Crisis regime
        regime = fp_fk.get("regime", "NORMAL")
        if regime == "CRISIS":
            signals.append("CRISIS regime detected → FULL DELIVERAGE")
            weights.append(1.0)
        elif regime == "COMPRESSION":
            # Check for squeeze
            vr = fp_fk.get("current_vr", 1.0)
            if vr < 0.75:
                signals.append(f"Deep compression (VR={vr:.2f}) → partial deleverage")
                weights.append(0.6)

        # Anomalous diffusion deleverage
        H = anom.get("hurst_H", 0.5)
        if H < 0.35:
            signals.append(f"Hurst H={H:.3f} (strong mean-reversion) → bottom imminent → deleverage")
            weights.append(0.8 * (0.35 - H) / 0.35)
        elif H > 0.75:
            signals.append(f"Hurst H={H:.3f} (strong momentum) → risk ON but trailing stops")
            weights.append(-0.2)  # Negative weight → increase position

        # Wave acceleration
        wave_acc = fp_fk.get("fk_wave_acceleration", 0.0)
        if wave_acc < -0.1:
            signals.append(f"FK wave decelerating (acc={wave_acc:.3f}) → regime transition ending")
            weights.append(0.5)
        elif wave_acc > 0.15:
            signals.append(f"FK wave ACCELERATING (acc={wave_acc:.3f}) → rapid regime shift → deleverage")
            weights.append(0.7)

        # Multiple signal agreement
        if len(signals) >= 3:
            signals.append("MULTIPLE signals agreeing → STRONG deleverage")
            weights.append(0.3)

        if not weights:
            return 0.0, "No deleverage signals — market in normal regime."

        # Combine: weighted average of positive signals
        positive_signals = [w for w in weights if w > 0]
        if positive_signals:
            combined = np.mean(positive_signals)
        else:
            combined = 0.0

        # Also incorporate crisis directly
        if regime == "CRISIS":
            combined = max(combined, 0.95)

        combined = float(np.clip(combined, 0.0, 1.0))
        reason = " | ".join(signals[:4])

        return combined, reason

    def _get_stop_multiplier(self, fp_fk: dict, anom: dict) -> float:
        """
        Adjust stop loss multiplier based on FP-FK and diffusion physics.

        In compression: tighter stops
        In expansion: wider stops
        In superdiffusion: let winners run
        In subdiffusion: scalper stops
        """
        base = 1.0

        # FP-FK: reaction rate and diffusion coefficient
        D_q = fp_fk.get("diffusion_coeff", 0.05)
        r = fp_fk.get("reaction_rate", 0.02)
        regime = fp_fk.get("regime", "NORMAL")

        if regime == "COMPRESSION":
            base *= 0.7  # Tighter stops in compression
        elif regime == "EXPANSION":
            base *= 1.5  # Wider stops in expansion
        elif regime == "CRISIS":
            base *= 0.5  # Much tighter in crisis

        # Anomalous diffusion adjustment
        H = anom.get("hurst_H", 0.5)
        if H > 0.6:
            base *= 1.3  # Momentum → wider stops
        elif H < 0.4:
            base *= 0.8  # Mean-reversion → tighter

        return float(np.clip(base, 0.3, 3.0))

    def _build_explanation(self,
                          hmm: dict,
                          fp_fk: dict,
                          anom: dict,
                          regime_probs: dict,
                          deleverage_prob: float,
                          signal_adj: str) -> str:
        """Generate human-readable explanation combining all physics models."""

        q = fp_fk.get("q_parameter", 1.5)
        regime = regime_probs["ensemble_regime"]
        H = anom.get("hurst_H", 0.5)
        kappa = fp_fk.get("criticality_index", 0.0)
        wave_speed = fp_fk.get("fk_wave_speed", 0.0)
        diffusion_type = anom.get("diffusion_type", "NORMAL")

        # Interpret q
        if q > 1.9:
            q_interp = "CRISIS-fat-tails (q>1.9)"
        elif q > 1.3:
            q_interp = "fat-tailed expansion (q>1.3)"
        elif q < 0.9:
            q_interp = "sub-Gaussian compression (q<0.9)"
        else:
            q_interp = f"near-Gaussian (q={q:.2f})"

        # Interpret wave speed
        if abs(wave_speed) < 0.01:
            wave_interp = "wave STALLED"
        elif wave_speed > 0:
            wave_interp = f"wave advancing (c={wave_speed:.4f})"
        else:
            wave_interp = f"wave retreating (c={wave_speed:.4f})"

        # Consensus statement
        agree = "✓" if regime_probs["hmm_agreement"] else "✗"

        parts = [
            f"[{agree}] Regime: {regime} (conf={regime_probs['ensemble_confidence']:.0%})",
            f"FP-FK: q={q:.2f} ({q_interp}), κ={kappa:.3f}, {wave_interp}",
            f"q-diffusion α={fp_fk.get('diffusion_exponent', '?'):.2f}",
            f"fBm: H={H:.3f} ({diffusion_type}), {anom.get('multifractality', '')}",
            f"Signal: {signal_adj}",
        ]

        if deleverage_prob > 0.5:
            parts.append(f"⚠️ DELIVERAGE {deleverage_prob:.0%}")

        return " | ".join(parts)

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    def get_metrics(self) -> dict:
        return {
            "model": self.name,
            "trained": self._is_trained,
            "hmm": self._hmm.get_metrics(),
            "fp_fk": self._fp_fk.get_metrics(),
            "anomalous_diffusion": self._anom.get_metrics(),
        }
