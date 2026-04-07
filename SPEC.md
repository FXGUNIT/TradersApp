# TradersApp — Requirements & Specifications

**Last Updated:** 2026-04-02
**Status:** ACTIVE DEVELOPMENT

---

## 1. SYSTEM OVERVIEW

### What This Platform Does
A real-time quantitative trading intelligence platform that:
- Aggregates multi-timeframe candlestick data (NinjaTrader CSV)
- Runs ML ensemble models (HMM, FP-FK, Anomalous Diffusion, Mamba SSM, LightGBM)
- Computes consensus signals across 6 model families
- Delivers trading intelligence via React frontend + Telegram bot

### Core Users
- Quantitative trader (you — the human with domain expertise)
- AI agents (Claude Code, OpenClaw) executing tasks under human approval

### Non-Negotiable Rules
1. **Never send real orders** — this is analysis only, no broker connectivity
2. **All code is reviewed** by human before any live use
3. **Paper trade for 1 full trading week** before any live deployment
4. **Secrets never in Git** — always via Infisical

---

## 2. FUNCTIONAL REQUIREMENTS

### 2.1 Data Pipeline
- [x] Load NinjaTrader CSV exports
- [x] Store candles in SQLite with schema
- [x] Support multiple timeframes (1m, 5m, 15m, 1h, 4h, daily)
- [x] Session-aware data windows (RTH, ETH, GLOBEX)
- [ ] Real-time data feed integration (future)

### 2.2 ML Engine
- [x] Regime Detection (HMM + FP-FK + Anomalous Diffusion ensemble)
- [x] Direction Model (LightGBM classifier)
- [x] Session Probability Engine (contextual session edge)
- [x] Alpha Engine (raw alpha score decomposition)
- [x] Mamba SSM Sequence Model
- [x] PSO Exit/RRR Optimizer
- [x] Position Sizer
- [x] Consensus Aggregator (weighted voting across all models)
- [ ] Backtesting engine (kernc-backtesting)
- [ ] Walk-forward validation

### 2.3 BFF (Backend-for-Frontend)
- [x] `/ml/consensus` — main consensus signal endpoint
- [x] `/ml/regime` — regime detection endpoint
- [x] `/ml/health` — health check
- [ ] `/ml/backtest` — backtest runner
- [ ] `/ml/optimize` — parameter optimization

### 2.4 Frontend
- [x] CollectiveConsciousness page — consensus dashboard
- [x] Sub-components: SessionProbability, AlphaDisplay, ExitStrategy, RRR, PositionSizing, ModelVotes
- [ ] Real-time candlestick chart (lightweight-charts)
- [ ] Trade log input panel
- [ ] Backtest results display

### 2.5 Telegram Bridge
- [x] AI conversation via Groq/Llama
- [ ] Command: `/signal` — returns current consensus
- [ ] Command: `/regime` — returns current regime
- [ ] Command: `/news` — returns breaking news
- [ ] Broadcast alerts to admin

### 2.6 External Integrations (pending credentials)
- [ ] Finnhub news API
- [ ] NewsData.io API
- [ ] Telegram Bot (needs bot token + chat ID)

---

## 3. PERFORMANCE REQUIREMENTS

| Metric | Target | Critical |
|--------|--------|----------|
| ML Consensus latency | < 200ms | Yes |
| BFF → ML Engine timeout | 5s max | Yes |
| BFF → News timeout | 3s max | Yes |
| Candle load (10k rows) | < 500ms | No |
| Circuit breaker open | After 5 failures in 30s | Yes |

---

## 4. CONFIGURATION CONTRACT

All magic numbers live here or in `ml-engine/config.py`:

```
MAX_CANDLE_AGE_HOURS = 24
CIRCUIT_BREAKER_FAILURES = 5
CIRCUIT_BREAKER_WINDOW_SEC = 30
CONSENSUS_WEIGHTS = {direction: 0.3, regime: 0.2, session: 0.2, alpha: 0.15, magnitude: 0.1, timing: 0.05}
POSITION_SIZE_RISK_PCT = 1.0  # 1% risk per trade
MIN_SESSION_PROBABILITY = 0.55
```

---

## 5. CURRENT BLOCKERS

1. **Telegram Bot** — needs bot token + chat ID (user action required)
2. **Breaking News** — needs Finnhub + NewsData.io API keys (user action required)
3. **ML Engine URL** — needs Railway deployment URL (user action required)
4. **Backtesting** — not yet implemented (future)
5. **GitHub auth** — `gh` CLI not authenticated (user action required)

---

## 6. DECISIONS LOG (DO NOT REVERT)

| Date | Decision | Reason |
|------|----------|--------|
| 2026-04-02 | SQLite over PostgreSQL for candles | Simplicity, embedded use case |
| 2026-04-02 | BFF → ML Engine (not reverse) | ML Engine is the brain, BFF is dumb proxy |
| 2026-04-02 | Consensus weighted average, not majority vote | Weights reflect model confidence |
| 2026-04-02 | Groq as primary free model | No API key needed, fast, generous free tier |
| 2026-04-02 | Infisical for secrets | Multi-platform sync, zero-trust |
