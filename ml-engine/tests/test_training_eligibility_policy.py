import pandas as pd

from training.training_eligibility import (
    ELIGIBILITY_DAY_THRESHOLD,
    filter_training_eligible_trades,
    resolve_trade_training_eligibility,
)


def test_resolve_trade_training_eligibility_admin_always_allowed():
    assert resolve_trade_training_eligibility(
        source_role="admin",
        source_days_used=0,
        is_training_eligible=False,
    ) is True


def test_resolve_trade_training_eligibility_user_requires_threshold_when_not_explicit():
    assert resolve_trade_training_eligibility(
        source_role="user",
        source_days_used=ELIGIBILITY_DAY_THRESHOLD - 1,
        is_training_eligible=None,
    ) is False
    assert resolve_trade_training_eligibility(
        source_role="user",
        source_days_used=ELIGIBILITY_DAY_THRESHOLD,
        is_training_eligible=None,
    ) is True


def test_resolve_trade_training_eligibility_legacy_system_rows_remain_allowed():
    assert resolve_trade_training_eligibility(
        source_role="system",
        source_days_used=None,
        is_training_eligible=None,
    ) is True


def test_filter_training_eligible_trades_keeps_eligible_and_legacy_rows_only():
    trade_log = pd.DataFrame(
        [
            {"id": 1, "is_training_eligible": True, "source_role": "user"},
            {"id": 2, "is_training_eligible": False, "source_role": "user"},
            {"id": 3, "is_training_eligible": None, "source_role": "system"},
        ]
    )

    filtered = filter_training_eligible_trades(trade_log)

    assert filtered["id"].tolist() == [1, 3]