from __future__ import annotations

from typing import Any

import pandas as pd

ELIGIBILITY_DAY_THRESHOLD = 10
ALWAYS_ELIGIBLE_ROLES = {"admin", "system", "service"}


def normalize_source_role(source_role: str | None) -> str | None:
    normalized = str(source_role or "").strip().lower()
    return normalized or None


def _coerce_bool(value: Any) -> bool | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(int(value))

    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "t", "yes", "y"}:
        return True
    if normalized in {"0", "false", "f", "no", "n"}:
        return False
    return None


def _normalize_days_used(source_days_used: Any) -> int | None:
    if source_days_used is None or pd.isna(source_days_used):
        return None

    try:
        parsed = int(source_days_used)
    except (TypeError, ValueError):
        return None

    return max(parsed, 0)


def resolve_trade_training_eligibility(
    source_role: str | None,
    source_days_used: Any,
    is_training_eligible: Any,
) -> bool:
    normalized_role = normalize_source_role(source_role)
    normalized_days_used = _normalize_days_used(source_days_used)
    explicit_eligibility = _coerce_bool(is_training_eligible)

    if normalized_role in ALWAYS_ELIGIBLE_ROLES:
      return True

    if normalized_role == "user":
      threshold_eligible = (
          normalized_days_used is not None
          and normalized_days_used >= ELIGIBILITY_DAY_THRESHOLD
      )
      if explicit_eligibility is None:
        return bool(threshold_eligible)
      return bool(explicit_eligibility or threshold_eligible)

    if explicit_eligibility is not None:
      return explicit_eligibility

    return True


def build_trade_training_metadata(
    source_uid: str | None = None,
    source_role: str | None = None,
    source_days_used: Any = None,
    is_training_eligible: Any = None,
) -> dict[str, Any]:
    normalized_role = normalize_source_role(source_role)
    normalized_days_used = _normalize_days_used(source_days_used)
    resolved_eligibility = resolve_trade_training_eligibility(
        source_role=normalized_role,
        source_days_used=normalized_days_used,
        is_training_eligible=is_training_eligible,
    )

    return {
        "source_uid": str(source_uid).strip() or None if source_uid is not None else None,
        "source_role": normalized_role,
        "source_days_used": normalized_days_used,
        "is_training_eligible": resolved_eligibility,
    }


def filter_training_eligible_trades(trade_log: pd.DataFrame) -> pd.DataFrame:
    if trade_log.empty:
        return trade_log.copy()

    eligibility_mask = trade_log.apply(
        lambda row: resolve_trade_training_eligibility(
            source_role=row.get("source_role"),
            source_days_used=row.get("source_days_used"),
            is_training_eligible=row.get("is_training_eligible"),
        ),
        axis=1,
    )
    return trade_log.loc[eligibility_mask].copy()


    def summarize_training_eligibility_batch(
      trade_log: pd.DataFrame,
      *,
      symbol: str = "MNQ",
      batch_type: str = "nightly_eligibility",
      batch_date: str | None = None,
      previous_batch: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
      filtered = filter_training_eligible_trades(trade_log)
      source_role_series = filtered.get("source_role")
      source_uid_series = filtered.get("source_uid")

      eligible_user_count = 0
      admin_trade_count = 0

      if source_role_series is not None:
        normalized_roles = source_role_series.fillna("").astype(str).str.lower()
        admin_trade_count = int((normalized_roles == "admin").sum())
        if source_uid_series is not None:
          eligible_user_count = int(
            source_uid_series.loc[normalized_roles == "user"].dropna().astype(str).nunique()
          )

      previous_eligible_trade_count = int(
        (previous_batch or {}).get("eligible_trade_count", 0) or 0
      )

      return {
        "batch_date": batch_date or pd.Timestamp.utcnow().strftime("%Y-%m-%d"),
        "batch_type": batch_type,
        "symbol": symbol,
        "total_trade_count": int(len(trade_log)),
        "eligible_trade_count": int(len(filtered)),
        "ineligible_trade_count": int(max(len(trade_log) - len(filtered), 0)),
        "eligible_user_count": eligible_user_count,
        "admin_trade_count": admin_trade_count,
        "newly_eligible_trade_count": int(
          max(len(filtered) - previous_eligible_trade_count, 0)
        ),
      }