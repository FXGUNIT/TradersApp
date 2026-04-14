"""
ML Engine — News / Breaking Events Routes
Extracted from main.py (Rule #3 hard limit: Python ≤600 lines)
"""
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path as _Path

from fastapi import HTTPException

# In-memory news reaction log (persisted to CSV in production)
_NEWS_LOG_PATH: _Path = _Path(__file__).parent / "data" / "news_reactions.csv"
_NEWS_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
_news_reaction_log: list = []

import pandas as pd

from schemas import BreakingNewsRequest, NewsReactionRequest


def _persist_news_reaction(entry: dict) -> None:
    """Append news reaction to CSV log for ML training."""
    try:
        df = pd.DataFrame([entry])
        if _NEWS_LOG_PATH.exists():
            df.to_csv(_NEWS_LOG_PATH, mode="a", header=False, index=False)
        else:
            df.to_csv(_NEWS_LOG_PATH, mode="w", header=True, index=False)
    except Exception:
        pass  # Non-fatal


def _classify_news_impact(news: dict) -> dict:
    """Classify news impact on MNQ/ES trading."""
    title = news.get("title", "").lower()
    desc = news.get("description", "").lower()
    sentiment = news.get("sentiment", "neutral")
    keywords = news.get("keywords", [])
    text = f"{title} {desc}"
    sentiment_to_direction = {
        "bullish": ("up", 0.65),
        "bearish": ("down", 0.65),
        "neutral": ("flat", 0.5),
    }
    direction, base_conf = sentiment_to_direction.get(sentiment, ("flat", 0.5))
    confidence_boost = 0
    if any(k in text for k in ["fed", "rate", "inflation", "cpi"]):
        confidence_boost += 0.15
    if any(k in text for k in ["jobs", "nfp", "employment", "gdp"]):
        confidence_boost += 0.10
    if any(k in text for k in ["earnings", "apple", "nvidia", "meta", "amazon", "google"]):
        confidence_boost += 0.08
    if any(k in text for k in ["crisis", "recession", "crash", "war"]):
        confidence_boost += 0.12
    confidence = min(0.95, base_conf + confidence_boost)
    high_impact = any(k in text for k in [
        "fed", "rate hike", "rate cut", "inflation", "cpi", "jobs report",
        "nonfarm", "gdp", "earnings surprise", "profit warning",
        "recession", "crisis", "trade war", "bankruptcy",
    ])
    expected_move_ticks = 20.0 if high_impact else 8.0
    expected_move_dollars = expected_move_ticks * 0.25
    return {
        "expected_direction": direction,
        "expected_move_ticks": expected_move_ticks,
        "expected_move_dollars": expected_move_dollars,
        "impact_confidence": confidence,
        "is_high_impact": high_impact,
        "news_keywords": keywords,
        "trigger_type": news.get("trigger_type", "breaking_news"),
        "ml_note": (
            f"{sentiment.upper()} news on {keywords[0] if keywords else 'general'}. "
            f"Expected {direction} move of ~{expected_move_ticks:.0f} ticks. "
            f"Confidence: {confidence:.0%}. "
            f"Record market reaction at 5/15/30/60 min to validate this signal."
        ),
    }


def feedback_signal_news_trigger(request: BreakingNewsRequest):
    """
    Called by BFF when HIGH impact breaking news arrives.
    Actions: classify impact, log, optionally trigger retrain.
    """
    news = request.news
    news_id = news.get("id", f"manual_{int(time.time())}")
    classification = _classify_news_impact(news)
    entry = {
        "news_id": news_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "title": news.get("title", ""),
        "source": news.get("source", ""),
        "sentiment": news.get("sentiment", "neutral"),
        "impact": news.get("impact", "UNKNOWN"),
        "keywords": ",".join(news.get("keywords", [])),
        "trigger_type": request.trigger_type,
        "expected_direction": classification["expected_direction"],
        "expected_move_ticks": classification["expected_move_ticks"],
        "expected_move_dollars": classification["expected_move_dollars"],
        "impact_confidence": classification["impact_confidence"],
        "reaction_5m": None, "reaction_15m": None,
        "reaction_30m": None, "reaction_60m": None,
        "actual_direction": None, "actual_move_ticks": None,
        "alpha_ticks": None, "validated": False,
    }
    _persist_news_reaction(entry)
    _news_reaction_log.append(entry)
    if len(_news_reaction_log) > 1000:
        _news_reaction_log[:] = _news_reaction_log[-1000:]
    return {
        "ok": True,
        "news_id": news_id,
        "classification": classification,
        "ml_note": classification["ml_note"],
        "retrain_scheduled": classification["is_high_impact"],
        "logged_at": entry["timestamp"],
        "total_news_logged": len(_news_reaction_log),
    }


def news_reaction_endpoint(request: NewsReactionRequest):
    """Log actual market reaction to a previously triggered news item."""
    news_id = request.news_id
    entry_idx = None
    for i, e in enumerate(reversed(_news_reaction_log)):
        if e["news_id"] == news_id:
            entry_idx = len(_news_reaction_log) - 1 - i
            break
    if entry_idx is None:
        return {"ok": False, "error": "news_id not found in log"}
    entry = _news_reaction_log[entry_idx]
    if request.reaction_5m is not None:
        entry["reaction_5m"] = request.reaction_5m
    if request.reaction_15m is not None:
        entry["reaction_15m"] = request.reaction_15m
    if request.reaction_30m is not None:
        entry["reaction_30m"] = request.reaction_30m
    if request.reaction_60m is not None:
        entry["reaction_60m"] = request.reaction_60m
    if request.direction is not None:
        entry["actual_direction"] = request.direction
    if request.magnitude is not None:
        entry["actual_move_ticks"] = request.magnitude
    actual_moves = [v for v in [entry["reaction_5m"], entry["reaction_15m"],
                                  entry["reaction_30m"], entry["reaction_60m"]] if v is not None]
    if actual_moves and entry["expected_move_ticks"]:
        avg_actual = sum(actual_moves) / len(actual_moves)
        entry["alpha_ticks"] = avg_actual - entry["expected_move_ticks"]
        if entry["actual_direction"] == entry["expected_direction"]:
            entry["validated"] = True
        _persist_news_reaction(entry)
    _news_reaction_log[entry_idx] = entry
    return {
        "ok": True,
        "news_id": news_id,
        "entry": {k: v for k, v in entry.items() if k != "title"},
        "alpha_ticks": entry.get("alpha_ticks"),
        "validated": entry.get("validated", False),
    }


def get_news_reactions(limit: int = 50, minutes: int = 0):
    """Get recent news reaction log for ML training analysis."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes) if minutes > 0 else None
    entries = _news_reaction_log[-limit:]
    if cutoff:
        entries = [e for e in entries if datetime.fromisoformat(e["timestamp"]) > cutoff]
    return {"reactions": entries, "count": len(entries)}
