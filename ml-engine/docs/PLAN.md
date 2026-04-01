# Multi-Model Self-Training Session-Based Trading Intelligence System

## Context
Build the most accurate, robust, and fast trading intelligence system ever made.

1. **Python + ML core** — sklearn, LightGBM, XGBoost, hmmlearn, numpy, pandas, SHAP
2. **Session-based probability** — Pre-market, trading session, post-market each analyzed separately
3. **Alpha discovery** — Quantify edge: E[Actual Move] - E[Expected Move], per session, per time
4. **Trade timing** — 5-minute candles, always from candle close, best entry time recommendation
5. **RRR optimization** — Find best reward-to-risk ratio per session for maximum expectancy
6. **Exit strategy** — ML-driven: SL ticks, TP% per level, trailing distance, max hold time
7. **Position sizing** — ML-driven: Kelly criterion + confidence adjustment
8. **Uses EXISTING app features** — AMD, ADX, ATR, CI, VWAP, VWAP Bands, VR, Liquidity Sweep, Key Levels
9. **No external market data** — All features from MathEngine.js + NinjaTrader CSV + journal history
10. **Bulletproof architecture** — SQLite WAL → PostgreSQL/TimescaleDB

## Feature Inventory (EXISTING vs MISSING)
- ✅ EXISTS: AMD Phase, ADX, ATR, CI, VWAP, VWAP Slope, VWAP SD1/SD2 Bands, VR, Volatility Regime, Liquidity Sweep, Key Levels (PDH/PDL/PWH/PWL), Drawdown Throttle, Journal entries
- ❌ MISSING: Major Trend, Minor Trend, Regime (separate from AMD), Market Profile, Major Levels, Catalyst, Inventory — add later

## Architecture
```
React Frontend → BFF (port 8788) → ML Engine (port 8001)
                              ↓
                    Session Probability Engine
                    Alpha Discovery Engine
                    Exit Strategy Optimizer
                    RRR Optimizer
                    12 Specialized ML Models
```

## Data Sources
- NinjaTrader CSV (5-min candles) → CSV Worker → Feature Pipeline → SQLite WAL
- App Journal entries (trade_log table)
- MathEngine.js snapshots (live session)

## Session Definitions (Eastern Time)
- Pre-Market: 04:00-09:15 ET (session_id=0)
- Main Trading: 09:30-16:00 ET (session_id=1)
- Post-Market: 16:01-20:00 ET (session_id=2)

## ML Models (12 Total)
- Group A: Direction (Random Forest, XGBoost, SVM, LightGBM, MLP, AMD Classifier)
- Group B: Session Probability (Session Direction, Time-of-Day, Best Entry Time)
- Group C: Magnitude & Alpha (Move Magnitude Quantile, Alpha Discovery, Volatility Forecaster)
- Group D: Regime & Risk (HMM Regime, Drawdown Risk)

## Exit Strategy (ML-Driven)
- ExitStrategyPredictor: grid search over all exit combos per historical trade → ML model predicts optimal exits
- Every parameter: SL ticks, TP1/2/3 %, trailing distance, max hold time — ALL ML-determined

## Position Sizing (ML-Driven)
- PositionSizingPredictor: Kelly criterion base + confidence adjustment + firm limits

## Alpha Definition
Alpha = E[Actual Move] - E[Expected Move]
Expected Move = ATR * sqrt(holding_hours / daily_hours)
Alpha > 0: edge exists | Alpha < 0: negative edge | Alpha ≈ 0: neutral

## Expectancy Formula
Expectancy = (WR × Avg Win) − ((1 − WR) × Avg Loss)

## News Sources
- Primary: Forex Factory scraper (3★ events, no API key)
- Backup: NewsData.io free tier
- Both combined: FF primary, NewsData.io fallback

## Security (iOS-Level)
- TLS 1.3, HSTS, Firebase Auth + MFA, App Check (reCAPTCHA v3)
- Helmet.js, RBAC (TRADER/MENTOR/ADMIN), rate limiting
- Infisical secrets, AES-256 at rest, Cloudflare WAF
- OWASP Top 10 rules, 31-item security checklist

## Deployment
- GitHub as source of truth (main + staging + dev branches)
- Vercel (React CDN) + Railway (BFF + ML Engine) + Neon PostgreSQL
- GitHub Actions CI/CD: lint → test → build → deploy

## Performance Targets
| Operation | Target | Max |
|---|---|---|
| Feature engineering (100K candles) | 2-5 sec | 10 sec |
| Single prediction (all models) | 50-200 ms | 500 ms |
| Full retraining (100K rows) | 90-150 sec | 300 sec |
| Database query (1 year) | 100-500 ms | 2 sec |

## Implementation Phases
1. **Phase 1**: Database + Feature Pipeline + 4 Core Direction Models + trainer
2. **Phase 2**: Session Engine + Alpha + Magnitude + HMM Regime
3. **Phase 3**: Exit Strategy (ML) + RRR Optimizer + Position Sizing (ML)
4. **Phase 4**: News Intelligence + Timing + Remaining Models
5. **Phase 5**: Polish + Production + Docker
6. **Phase 6**: Deployment + Security Hardening
7. **Phase 7**: Go Live

## Open Source Integrations
- kernc/backtesting.py (8.1k stars) — production backtesting
- Sakeeb91/market-regime-detection (MIT) — walk-forward validation
- tubakahxn/Market-Regime-Detection-System (MIT) — feature engineering

## Why This System?
- Most accurate: 12 specialized models, majority vote consensus
- Most robust: TimeSeriesSplit CV with gap, no look-ahead bias
- Fastest: LightGBM primary, SQLite WAL, memory-mapped I/O
- Self-training: CSV upload → feature engineering → retrain automatically
- ML-driven: No hardcoded rules — every parameter learned from historical data
- Session-aware: Each session analyzed separately with its own optimal parameters
