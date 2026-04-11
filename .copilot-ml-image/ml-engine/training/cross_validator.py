"""
TimeSeriesCrossValidator — Time-series correct cross-validation.
CRITICAL: Never use random splits for time-series data.
Uses TimeSeriesSplit with gap to prevent look-ahead bias.
A gap of N means there are N-1 rows between train and validation sets.
This prevents information from the training period from "leaking" into validation.
"""
from typing import Iterator
import numpy as np
from sklearn.model_selection import TimeSeriesSplit


class TimeSeriesCrossValidator:
    """
    Wrapper around sklearn TimeSeriesSplit with gap support.
    Ensures no look-ahead bias in time-series ML.

    Parameters
    ----------
    n_splits : int
        Number of folds (default 5)
    gap : int
        Number of rows to skip between train and validation (default 10 = 50 min buffer for 5-min candles)
    test_size : int | None
        Minimum validation size per fold. If None, uses TimeSeriesSplit default.
    """

    def __init__(self, n_splits: int = 5, gap: int = 10, test_size: int | None = None):
        self.n_splits = n_splits
        self.gap = gap
        self.test_size = test_size

    def split(self, X) -> Iterator[tuple[np.ndarray, np.ndarray]]:
        """
        Generate (train_indices, val_indices) pairs.
        Each validation set is strictly AFTER the corresponding training set.
        A gap of `self.gap` candles between train and val prevents look-ahead.
        """
        tscv = TimeSeriesSplit(
            n_splits=self.n_splits,
            gap=self.gap,
            test_size=self.test_size,
        )
        return tscv.split(X)

    def get_n_splits(self, X=None, y=None, groups=None) -> int:
        return self.n_splits

    def __repr__(self) -> str:
        return (
            f"TimeSeriesCrossValidator(n_splits={self.n_splits}, "
            f"gap={self.gap} candles ({self.gap * 5} min))"
        )
