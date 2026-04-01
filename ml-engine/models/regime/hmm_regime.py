"""
HMM Regime Detector — Hidden Markov Model for market regime classification.
Uses Gaussian HMM to detect COMPRESSION / NORMAL / EXPANSION states
from Volatility Ratio (VR) and ADX time series.

Learns regimes directly from data rather than using hardcoded thresholds.
Train on historical VR + ADX series; predict current regime on new data.
"""
import numpy as np
import pandas as pd
import sys, os
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config


class HMMRegimeDetector:
    """
    Gaussian HMM regime detector.
    States: 0=COMPRESSION, 1=NORMAL, 2=EXPANSION (ordered by VR mean)
    Features: [VR, ADX, ATR_pct] — normalized
    """

    name = "hmm_regime"
    model_type = "regime"
    state_names = ["COMPRESSION", "NORMAL", "EXPANSION"]

    def __init__(self, n_states: int = 3, random_state: int = 42):
        self.n_states = n_states
        self.random_state = random_state
        self._is_trained = False
        self._model = None
        self._vr_means: np.ndarray = np.array([])
        self._state_order: list[int] = []  # sorted by VR mean → [compression, normal, expansion]

    def _build_features(self, df: pd.DataFrame) -> np.ndarray:
        """Build feature matrix from DataFrame for HMM training/prediction."""
        vr = df["vr"].values if "vr" in df.columns else np.full(len(df), 1.0)
        adx = df["adx"].values if "adx" in df.columns else np.full(len(df), 25.0)
        atr_pct = df["atr_pct"].values if "atr_pct" in df.columns else np.full(len(df), 0.01)

        X = np.column_stack([vr, adx, atr_pct]).astype(float)

        # Replace NaN/inf with column means
        for col in range(X.shape[1]):
            mask = ~np.isfinite(X[:, col])
            if mask.any():
                X[mask, col] = np.nanmean(X[:, col])

        return X

    def _normalize_features(self, X: np.ndarray) -> np.ndarray:
        """Z-score normalize each column."""
        X_norm = X.copy()
        for col in range(X_norm.shape[1]):
            mean = X_norm[:, col].mean()
            std = X_norm[:, col].std()
            if std > 1e-8:
                X_norm[:, col] = (X_norm[:, col] - mean) / std
        return X_norm

    def train(self, df: pd.DataFrame, verbose: bool = True) -> dict:
        """
        Train Gaussian HMM on VR + ADX time series.
        Fit with 3 states, then remap states by VR mean (compression=low VR, expansion=high VR).
        """
        if len(df) < 100:
            raise ValueError(f"Need at least 100 samples for HMM, got {len(df)}")

        from hmmlearn.hmm import GaussianHMM

        X_raw = self._build_features(df)
        X = self._normalize_features(X_raw)

        # Gaussian HMM with 3 states
        model = GaussianHMM(
            n_components=self.n_states,
            covariance_type="full",
            n_iter=200,
            random_state=self.random_state,
            tol=1e-4,
        )

        try:
            model.fit(X)
        except Exception as e:
            if verbose:
                print(f"  HMM fit warning: {e}. Retrying with diag covariance...")
            # Fallback: diagonal covariance
            model = GaussianHMM(
                n_components=self.n_states,
                covariance_type="diag",
                n_iter=100,
                random_state=self.random_state,
                tol=1e-3,
            )
            model.fit(X)

        self._model = model
        self._is_trained = True

        # Determine which state is which based on VR column (index 0) mean in each state
        vr_col = X_raw[:, 0]
        state_vr_means = []
        for s in range(self.n_states):
            state_mask = model.predict(X) == s
            if state_mask.any():
                state_vr_means.append(vr_col[state_mask].mean())
            else:
                state_vr_means.append(1.0)

        # Sort states by VR mean: 0=lowest VR (compression), 2=highest VR (expansion)
        self._state_order = sorted(range(self.n_states), key=lambda s: state_vr_means[s])
        self._vr_means = np.array(state_vr_means)

        # Remap predictions: sort state indices so that sorted by VR mean
        # e.g., if state indices are [2, 0, 1] by VR, map original→canonical
        self._state_map = {orig: new for new, orig in enumerate(self._state_order)}

        if verbose:
            print(f"  HMM Regime Detector trained on {len(df)} samples")
            for s in range(self.n_states):
                orig_state = self._state_order[s]
                vr_m = state_vr_means[orig_state]
                print(f"    State {s} ({self.state_names[s]}): VR_mean={vr_m:.3f}")

        # Decode all observations to get state sequence
        hidden_states = self._remap_states(model.predict(X))

        # Compute transition matrix stats
        transmat = model.transmat_
        stationary = self._stationary_distribution(transmat)

        # Per-state statistics
        state_stats = {}
        for s in range(self.n_states):
            mask = hidden_states == s
            if mask.sum() > 0:
                vr_vals = X_raw[mask, 0]
                state_stats[self.state_names[s]] = {
                    "count": int(mask.sum()),
                    "vr_mean": round(float(vr_vals.mean()), 4),
                    "vr_std": round(float(vr_vals.std()), 4),
                    "adx_mean": round(float(X_raw[mask, 1].mean()), 2),
                    "duration_mean": self._avg_duration(hidden_states, s),
                    "stationary_prob": round(float(stationary[s]), 4),
                }

        # Compute log-likelihood as model score
        ll = model.score(X)

        result = {
            "model": self.name,
            "n_states": self.n_states,
            "n_samples": len(df),
            "log_likelihood": round(float(ll), 4),
            "bic": round(float(self._bic(model, X)), 4),
            "aic": round(float(self._aic(model, X)), 4),
            "transition_matrix": transmat.tolist(),
            "state_order": [self.state_names[i] for i in self._state_order],
            "state_map": {str(k): v for k, v in self._state_map.items()},
            "state_stats": state_stats,
        }

        if verbose:
            print(f"  HMM Log-Likelihood: {ll:.2f}  BIC: {result['bic']:.2f}")

        return result

    def _remap_states(self, states: np.ndarray) -> np.ndarray:
        """Remap raw HMM state indices to canonical (compression=0, normal=1, expansion=2)."""
        if not hasattr(self, "_state_map"):
            return states
        return np.array([self._state_map.get(int(s), int(s)) for s in states])

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict hidden states for feature matrix X. Returns canonical state indices."""
        if not self._is_trained or self._model is None:
            return np.full(X.shape[0], 1)  # Default to NORMAL
        raw_states = self._model.predict(X)
        return self._remap_states(raw_states)

    def predict_current(self, df: pd.DataFrame) -> dict:
        """
        Predict current regime from latest row of a DataFrame.
        Returns: {regime, confidence, transition_matrix, explanation}
        """
        if not self._is_trained or len(df) < 1:
            return self._default_regime()

        X_raw = self._build_features(df.tail(20))  # last 20 rows for context
        X = self._normalize_features(X_raw)

        current_state = int(self.predict(X)[-1])
        current_vr = df["vr"].iloc[-1] if "vr" in df.columns else 1.0
        current_adx = df["adx"].iloc[-1] if "adx" in df.columns else 25.0

        # Compute confidence from state probability
        posterior = self._model.predict_proba(X)[-1]
        # Remap posterior to canonical ordering
        canonical_posterior = np.zeros(self.n_states)
        for orig_s, can_s in self._state_map.items():
            canonical_posterior[can_s] = posterior[int(orig_s)]

        confidence = float(canonical_posterior[current_state])

        # Transition info: probability of staying vs changing
        prev_state = int(self.predict(X)[-2]) if len(X) > 1 else current_state
        transmat = self._model.transmat_
        stay_prob = float(transmat[prev_state, current_state])

        # Regime explanation
        regime_names = self.state_names
        explanations = {
            "COMPRESSION": f"Volatility compressing (VR={current_vr:.2f}). ATR narrowing, price consolidating. Reduce size, tighter stops.",
            "NORMAL": f"Normal market (VR={current_vr:.2f}). ADX={current_adx:.0f}. Standard parameters apply.",
            "EXPANSION": f"Volatility expanding (VR={current_vr:.2f}). ATR widening, trending moves. Widen stops, let winners run.",
        }

        return {
            "regime": regime_names[current_state],
            "regime_id": current_state,
            "confidence": round(confidence, 4),
            "current_vr": round(float(current_vr), 4),
            "current_adx": round(float(current_adx), 2),
            "previous_regime": regime_names[prev_state] if prev_state != current_state else None,
            "transition_prob": round(stay_prob, 4),
            "regime_change": current_state != prev_state,
            "posterior_probs": {
                regime_names[i]: round(float(canonical_posterior[i]), 4)
                for i in range(self.n_states)
            },
            "explanation": explanations[regime_names[current_state]],
            "transition_matrix": self._model.transmat_.tolist(),
        }

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Return probability distribution over states."""
        if not self._is_trained or self._model is None:
            return np.array([[0.33, 0.34, 0.33]] * len(X))
        raw_posterior = self._model.predict_proba(X)
        # Remap to canonical ordering
        canonical = np.zeros_like(raw_posterior)
        for orig_s, can_s in self._state_map.items():
            canonical[:, can_s] = raw_posterior[:, int(orig_s)]
        return canonical

    def _stationary_distribution(self, transmat: np.ndarray) -> np.ndarray:
        """Compute stationary distribution of a Markov chain."""
        eigvals, eigvecs = np.linalg.eig(transmat.T)
        stationary_idx = np.argmin(np.abs(eigvals - 1.0))
        stationary = np.real(eigvecs[:, stationary_idx])
        return np.abs(stationary) / np.abs(stationary).sum()

    def _bic(self, model, X: np.ndarray) -> float:
        """Bayesian Information Criterion."""
        n_params = self._count_params(model)
        n_samples = X.shape[0]
        ll = model.score(X)
        return -2 * ll * n_samples + n_params * np.log(n_samples)

    def _aic(self, model, X: np.ndarray) -> float:
        """Akaike Information Criterion."""
        n_params = self._count_params(model)
        ll = model.score(X)
        return -2 * ll + 2 * n_params

    def _count_params(self, model) -> int:
        """Count free parameters in Gaussian HMM."""
        n_states = self.n_states
        n_features = getattr(model, "n_features_in_", None) or getattr(model, "n_features", 3)
        # Means: n_states * n_features
        # Covariances: n_states * n_features (diag) or full matrix
        # Transitions: n_states * n_states
        # Start probs: n_states - 1
        if model.covariance_type == "diag":
            cov_params = n_states * n_features
        else:
            cov_params = n_states * n_features * n_features
        return n_states * n_features + cov_params + n_states * n_states + (n_states - 1)

    def _avg_duration(self, states: np.ndarray, target_state: int) -> float:
        """Average number of consecutive steps in target_state."""
        durations = []
        current_run = 0
        for s in states:
            if s == target_state:
                current_run += 1
            elif current_run > 0:
                durations.append(current_run)
                current_run = 0
        if current_run > 0:
            durations.append(current_run)
        return round(float(np.mean(durations) if durations else 0), 2)

    def _default_regime(self) -> dict:
        return {
            "regime": "NORMAL",
            "regime_id": 1,
            "confidence": 0.0,
            "current_vr": 1.0,
            "current_adx": 25.0,
            "previous_regime": None,
            "transition_prob": 0.0,
            "regime_change": False,
            "posterior_probs": {"COMPRESSION": 0.33, "NORMAL": 0.34, "EXPANSION": 0.33},
            "explanation": "Model not trained. Defaulting to NORMAL regime.",
            "transition_matrix": [[0.6, 0.3, 0.1], [0.2, 0.6, 0.2], [0.1, 0.3, 0.6]],
        }

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    def get_metrics(self) -> dict:
        if not self._is_trained:
            return {"trained": False, "regime": "NORMAL"}
        return {
            "trained": True,
            "n_states": self.n_states,
            "state_order": [self.state_names[i] for i in self._state_order],
            "vr_means": self._vr_means.tolist(),
        }
