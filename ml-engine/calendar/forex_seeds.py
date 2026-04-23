"""Seed data for scheduled macro-event filtering and scoring."""

from __future__ import annotations

from typing import Final

RELEVANT_FOREX_CURRENCIES: Final[tuple[str, ...]] = (
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "CAD",
    "AUD",
    "NZD",
    "CNH",
    "CHF",
    "MXN",
    "ZAR",
)

FOREX_FACTORY_IMPACT_LABELS: Final[dict[int, str]] = {
    1: "LOW",
    2: "MEDIUM",
    3: "HIGH",
}

HIGH_IMPACT_EVENT_KEYWORDS: Final[tuple[str, ...]] = (
    "cpi",
    "pce",
    "ppi",
    "non-farm",
    "payroll",
    "fomc",
    "rate",
    "inflation",
    "gdp",
    "employment",
    "jobless",
)

EVENT_WEIGHT_HINTS: Final[dict[str, float]] = {
    "fomc": 1.0,
    "rate": 1.0,
    "cpi": 0.95,
    "pce": 0.9,
    "gdp": 0.85,
    "employment": 0.85,
    "payroll": 0.85,
    "ppi": 0.7,
}


def is_relevant_currency(currency: str | None) -> bool:
    """Return True when the event currency should affect the macro dashboard."""
    normalized = str(currency or "").strip().upper()
    return normalized in RELEVANT_FOREX_CURRENCIES


def impact_label(stars: int) -> str:
    """Map Forex Factory star counts to the shared LOW/MEDIUM/HIGH labels."""
    return FOREX_FACTORY_IMPACT_LABELS.get(int(stars), "LOW")
