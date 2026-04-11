"""
Move Magnitude Quantile Model.
Predicts expected move in ticks at multiple horizons: 1, 3, 5, 10 candles.
Returns: conservative (25th), expected (50th), aggressive (75th) percentile moves.
Used for: setting take profit, position sizing, uncertainty bounds.
"""
import numpy as np
import pandas as pd
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config
from features.feature_pipeline import engineer_features, get_feature_vector, FEATURE_COLS
from training.cross_validator import TimeSeriesCrossValidator


class MoveMagnitudeModel:
    """
    Quantile regression: predicts move magnitude at 25th, 50th, 75th percentiles.
    This gives uncertainty bounds — critical for setting take profits.
    """

    name = "move_magnitude"
    model_type = "magnitude"

    def __init__(self, horizons: list[int] = [1, 3, 5, 10]):
        self.horizons = horizons  # candle counts ahead
        self.quantiles = [0.25, 0.50, 0.75]
        self.models: dict[int, dict[float, any]] = {}  # horizon -> quantile -> model
        self._is_trained = False
        self._feature_cols: list[str] = []

    def _compute_labels(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute future move labels for each horizon.
        """
        df = df.sort_values("timestamp").reset_index(drop=True)
        close = df["close"]

        for h in self.horizons:
            future_close = close.shift(-h)
            df[f"label_move_{h}"] = future_close - close

        df["label_max_move"] = df[[f"label_move_{h}" for h in self.horizons]].max(axis=1)
        df["label_min_move"] = df[[f"label_move_{h}" for h in self.horizons]].min(axis=1)

        return df.dropna(subset=[f"label_move_{h}" for h in self.horizons])

    def train(
        self,
        X: pd.DataFrame,
        candles_df: pd.DataFrame,
        feature_cols: list[str] | None = None,
        verbose: bool = True,
    ) -> dict:
        """Train quantile regressors for each horizon."""
        self._feature_cols = feature_cols or [c for c in X.columns]

        # Compute labels
        feat_df = self._compute_labels(candles_df)

        # Filter
        mask = feat_df.notna().all(axis=1)
        feat_df = feat_df[mask]

        if len(feat_df) < 100:
            raise ValueError(f"Need at least 100 samples, got {len(feat_df)}")

        import lightgbm as lgb

        results = {}
        for h in self.horizons:
            target_col = f"label_move_{h}"
            y = feat_df[target_col]

            horizon_models = {}
            for q in self.quantiles:
                model = lgb.LGBMRegressor(
                    n_estimators=300,
                    max_depth=5,
                    learning_rate=0.05,
                    num_leaves=20,
                    min_child_samples=80,
                    subsample=0.7,
                    colsample_bytree=0.7,
                    objective="quantile",
                    alpha=q,
                    random_state=42,
                    n_jobs=-1,
                    verbose=-1,
                )
                model.fit(X[self._feature_cols].fillna(0), y.fillna(0))
                horizon_models[q] = model

            self.models[h] = horizon_models
            results[h] = {"status": "trained", "samples": len(y)}

        self._is_trained = True

        if verbose:
            print(f"  Move Magnitude: trained for horizons {self.horizons}")

        return {
            "model": self.name,
            "horizons": self.horizons,
            "quantiles": self.quantiles,
            "samples": len(feat_df),
            "feature_count": len(self._feature_cols),
        }

    def predict(self, X: pd.DataFrame) -> dict:
        """
        Predict move magnitude for each horizon and quantile.
        """
        if not self._is_trained:
            return self._empty_prediction()

        X_use = X[self._feature_cols].fillna(0).replace([np.inf, -np.inf], 0)

        predictions = {}
        for h in self.horizons:
            horizon_preds = {}
            for q, model in self.models[h].items():
                horizon_preds[f"q{int(q*100)}"] = round(float(model.predict(X_use)[0]), 4)

            # Q25 = conservative (likely to achieve), Q75 = optimistic
            conservative = horizon_preds.get("q25", 0)
            expected = horizon_preds.get("q50", 0)
            aggressive = horizon_preds.get("q75", 0)

            predictions[f"horizon_{h}_candles"] = {
                "conservative_ticks": conservative,
                "expected_ticks": expected,
                "aggressive_ticks": aggressive,
                "uncertainty_band": round(aggressive - conservative, 4),
            }

        # Summary across horizons
        # Use 5-candle horizon as the main TP reference
        main = predictions.get(f"horizon_{self.horizons[2]}_candles", {}) if len(self.horizons) > 2 else {}

        return {
            "horizons": predictions,
            "tp1_ticks": round(abs(main.get("conservative_ticks", 0)), 0),
            "tp2_ticks": round(abs(main.get("expected_ticks", 0)), 0),
            "tp3_ticks": round(abs(main.get("aggressive_ticks", 0)), 0),
            "uncertainty_band": main.get("uncertainty_band", 0),
        }

    def _empty_prediction(self) -> dict:
        return {
            "horizons": {},
            "tp1_ticks": 10,
            "tp2_ticks": 20,
            "tp3_ticks": 30,
            "uncertainty_band": 20,
            "note": "Model not trained — using defaults",
        }
