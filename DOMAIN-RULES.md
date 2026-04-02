# TradersApp — Domain Rules (Trading-Specific)

**Last Updated:** 2026-04-02
**Owner:** Human Trader (you)
**Purpose:** Claude Code / OpenClaw NEVER decides domain logic. It ONLY implements what's explicitly written here.

---

## 1. CORE TRADING BELIEFS (Human-Defined — Do Not Change Without Human Approval)

### Position Management
- Maximum risk per trade: **1% of account equity** (hard cap, no override)
- Maximum positions open simultaneously: **3** (no more)
- Never average down on a losing position
- Breakeven move: only after price moves 1.5x ATR in favor
- Trail stop only after 2x ATR profit buffer

### Session Rules
- Best sessions: **London (07:00-09:00 UTC), New York (13:30-16:00 UTC)**
- Avoid trading: first 15 min of RTH open (high noise), last 30 min of RTH close (chop)
- Friday afternoon: reduce size by 50% (weekend gap risk)
- Holiday sessions: reduce size by 50% (thin liquidity)

### Regime Rules
- Trending regime: use trailing stops, wider targets,跟着趋势
- Ranging regime: mean-reversion, tight stops, bounded targets
- High vol regime: reduce size 50%, prefer shorter timeframes
- Low vol regime: expect breakout — position size normal but widen stops

---

## 2. RISK CALCULATIONS (Explicit Formulas)

### Position Size
```
Risk Amount ($) = Account Equity × 0.01
Stop Loss (ticks) = ATR(14) × 2
Position Size (contracts) = Risk Amount ($) / (Stop Loss (ticks) × Tick Value)
```

### Session Edge
```
Session Edge = Historical Win Rate in Session × Avg R:M Ratio in Session
Only trade if Session Edge > 1.2 AND Session Probability > 0.55
```

### RRR (Reward:Risk Ratio)
```
Minimum RRR = 2.0 (do not enter if RRR < 2.0)
Ideal RRR = 3.0+
RRR = (Target - Entry) / (Entry - Stop)
```

### Consensus Confidence Adjustments
```
Base Confidence = weighted_average_of_model_confidences
Session Adjusted = Base × (1 if session_favorable else 0.7)
Regime Adjusted = Session Adjusted × (0.8 if regime_is_changing else 1.0)
Final Confidence = min(Regime Adjusted, 0.95)
```

---

## 3. COMPLIANCE & REGULATORY (Human-Approved Rules)

### What This Platform Does NOT Do
- [x] NO real order execution — analysis only
- [x] NO market manipulation — no spoofing, layering, or front-running patterns
- [x] NO advice to others — signals are personal, not distributed as investment advice
- [x] NO pre-arranged trading — all signals are generated algorithmically, not coordinated

### Data Integrity
- All historical data must be from official sources (NinjaTrader, broker API)
- No use of non-public information (INSIDER TRADING — absolute prohibition)
- News sources must be publicly available

### Record Keeping
- Every consensus signal logged with timestamp, regime, and confidence
- Trade log must be maintained for every signal (taken or skipped)
- Monthly performance review required before continuing

---

## 4. MARKET HOURS REFERENCE (UTC)

| Session | Open (UTC) | Close (UTC) | Notes |
|---------|-----------|-------------|-------|
| Sydney | 21:00 | 06:00 | Low vol, choppy |
| Tokyo | 00:00 | 09:00 | Moderate vol |
| London | 07:00 | 16:00 | High vol (overlap with NY) |
| New York (RTH) | 13:30 | 20:00 | Highest vol |
| GLOBEX (ETH) | 20:00 | 14:30 | Pre/post market |
| GLOBEX full | 00:30 | 14:30 | Sunday open |

**Key overlaps:**
- London + NY: 13:30-16:00 UTC = peak volume
- London only: 07:00-13:30 UTC = good for EUR pairs
- NY only: 16:00-20:00 UTC = USD pairs, late trends

---

## 5. INSTRUMENT-SPECIFIC RULES

### Futures (ES, NQ, RTY, CL, GC)
- Use RTH hours only for session probability
- ATR multipliers: ES/NQ = 4pt, RTY = 2pt, CL = 0.30, GC = 4.0
- Point values: ES=$50/point, NQ=$20/point, RTY=$5/point, CL=$10/point, GC=$10/point

### Forex (future expansion)
- Best sessions: London + NY overlap
- Use daily ATR for stop, not intraday
- No weekend holds (gap risk)

---

## 6. WHAT HUMANS DECIDE — AI NEVER DECIDES

The following decisions are EXPLICITLY reserved for the human trader. Claude/OpenClaw only assists with calculation and implementation:

1. ✅ Whether to take a signal (human decides, AI suggests)
2. ✅ Position size adjustment beyond 1% rule
3. ✅ News sentiment override (human interpretation)
4. ✅ Whether to skip a signal (risk-off environment)
5. ✅ Multi-timeframe confirmation (human reads the chart)
6. ✅ Broker/fees calculation (human verifies)
7. ✅ Margin requirement checks (human verifies)
8. ✅ Weekend/gap positioning decision

**AI role:** Calculate, analyze, suggest. **Human role:** Decide, approve, execute.

---

## 7. ERROR MARGINS & APPROXIMATIONS

- ATR: Use 14-period, standard settings
- Session probability: Require minimum 20 historical trades in session for valid calculation
- Model confidence: Always round to 2 decimal places
- Consensus: Weight by inverse of model age (newer models get higher weight)
