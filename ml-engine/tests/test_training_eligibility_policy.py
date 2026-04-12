import pandas as pd

from training.training_eligibility import (
    ELIGIBILITY_DAY_THRESHOLD,
    build_trade_training_metadata,
    filter_training_eligible_trades,
    resolve_trade_training_eligibility,
    summarize_training_eligibility_batch,
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


def test_filter_training_eligible_trades_accepts_days_used_alias():
    trade_log = pd.DataFrame(
        [
            {"id": 1, "source_role": "user", "days_used": ELIGIBILITY_DAY_THRESHOLD - 1},
            {"id": 2, "source_role": "user", "days_used": ELIGIBILITY_DAY_THRESHOLD},
        ]
    )

    filtered = filter_training_eligible_trades(trade_log)

    assert filtered["id"].tolist() == [2]


def test_build_trade_training_metadata_persists_days_used_and_alias():
    metadata = build_trade_training_metadata(
        source_uid="user-42",
        source_role="user",
        source_days_used=ELIGIBILITY_DAY_THRESHOLD,
        is_training_eligible=None,
    )

    assert metadata["source_uid"] == "user-42"
    assert metadata["source_role"] == "user"
    assert metadata["days_used"] == ELIGIBILITY_DAY_THRESHOLD
    assert metadata["source_days_used"] == ELIGIBILITY_DAY_THRESHOLD
    assert metadata["is_training_eligible"] is True


def test_summarize_training_eligibility_batch_counts_exact_policy_groups():
    trade_log = pd.DataFrame(
        [
            {"id": 1, "is_training_eligible": True, "source_role": "admin", "source_uid": "admin-1"},
            {"id": 2, "is_training_eligible": False, "source_role": "user", "source_uid": "user-1"},
            {"id": 3, "is_training_eligible": True, "source_role": "user", "source_uid": "user-2"},
            {"id": 4, "is_training_eligible": None, "source_role": "system", "source_uid": None},
        ]
    )

    summary = summarize_training_eligibility_batch(
        trade_log,
        symbol="MNQ",
        batch_type="nightly_eligibility",
        previous_batch={"eligible_trade_count": 2},
        batch_date="2026-04-12",
    )

    assert summary["batch_date"] == "2026-04-12"
    assert summary["eligible_trade_count"] == 3
    assert summary["ineligible_trade_count"] == 1
    assert summary["eligible_user_count"] == 1
    assert summary["eligible_user_uids"] == ["user-2"]
    assert summary["admin_trade_count"] == 1
    assert summary["newly_eligible_trade_count"] == 1
