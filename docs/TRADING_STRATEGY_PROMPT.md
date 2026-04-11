# Complete Intraday Trading Strategy — NQ, ES, EURUSD
## Win Rates, Risk-Reward, Drawdowns, ROI, ATR Systems, Kelly Sizing, and Prop Firm Optimization

---

# PART 1 — CONTRACT SPECIFICATIONS & COST STRUCTURES

## 1.1 Instrument Specifications

| Specification | ES | NQ | MNQ | 6E (EURUSD) |
|---|---|---|---|---|
| **Tick size** | 0.25 pts | 0.25 pts | 0.25 pts | 0.00005 |
| **Point value** | $50/pt | $20/pt | $2/pt | $125,000/pt |
| **Tick value** | $12.50/tick | $5.00/tick | $0.50/tick | $6.25/tick |
| **1-point move** | $50 | $20 | $2 | $125 |
| **Typical spread (round-trip)** | $3.13–$6.25 | $2.50–$5.00 | $0.25–$0.50 | $6.25–$12.50 |
| **All-in round-trip cost** | $4.00–$6.50 | $3.50–$6.00 | $0.50–$1.00 | $4.00–$8.00 |
| **Day trade margin (approx.)** | $400–$1,000 | $500–$1,500 | $50–$100 | $1,000–$1,500 |
| **Overnight margin** | $26,739 | $40,610 | $4,061 | $2,970 |
| **14-bar Daily ATR (points)** | 50–80 pts | 150–250 pts | 150–250 pts | 60–100 pips |
| **5-min ATR (points)** | 8–15 pts | 25–50 pts | 25–50 pts | — |
| **1-min ATR (points)** | 3–7 pts | 10–20 pts | 10–20 pts | — |
| **Typical daily range** | 60–70 pts | 150–200 pts | 150–200 pts | 60–100 pips |

### Key Broker Cost Assumptions Used Throughout This Document

| Instrument | Round-Trip Cost | Slippage Assumption |
|---|---|---|
| ES | $4.50 | $1.25/side (0.25 pts) |
| NQ | $4.25 | $1.25/side (0.25 pts) |
| MNQ | $0.70 | $0.125/side (0.25 pts) |
| 6E | $6.00 | $3.125/side (0.5 tick) |
| **Brokerage/commission** | $2.00/side (IBKR) | included in all-in |
| **NFA + exchange fees** | ~$0.10–$0.15/contract | negligible |

---

# PART 2 — WIN RATE × RISK-REWARD MATRIX

## 2.1 Core Formula

```
EV per trade (in risk units) = (WR × RR) − (1 − WR)
Cost per trade (in risk units) = Total round-trip cost ÷ dollar risk per losing trade
Net expectancy = EV − cost per trade
```

**Example:** 55% WR, 1.5:1 RR on ES, risking $250/stop
- Gross EV = (0.55 × 1.5) − (0.45) = 0.825 − 0.45 = **0.375 risk units per trade**
- Cost per trade = $4.50 ÷ $250 = **0.018 risk units**
- Net EV = 0.375 − 0.018 = **0.357 risk units = $89.25 net per trade**

## 2.2 Win Rate × RR Matrix — ES ($250 risk, 5-min scalp, 1 contract)

| Win Rate | RR | Gross EV (R) | Cost/Trade ($) | Net EV ($) | Monthly Trades (6/day × 20) | Monthly Net Profit | Monthly ROI | Breakeven WR |
|---|---|---|---|---|---|---|---|---|
| **40%** | 0.5:1 | −0.200 | $4.50 | −$54.50 | −$6,540 | **−27.6%** | 50.8% |
| **40%** | 1:1 | 0.000 | $4.50 | −$4.50 | −$540 | **−2.3%** | 50.8% |
| **40%** | 1.5:1 | 0.200 | $4.50 | $45.50 | $5,460 | **+22.9%** | 50.8% |
| **40%** | 2:1 | 0.400 | $4.50 | $95.50 | $11,460 | **+47.9%** | 50.8% |
| **45%** | 0.5:1 | −0.175 | $4.50 | −$47.75 | −$5,730 | **−24.2%** | 50.8% |
| **45%** | 1:1 | 0.050 | $4.50 | $7.75 | $930 | **+3.9%** | 50.8% |
| **45%** | 1.5:1 | 0.275 | $4.50 | $64.25 | $7,710 | **+32.3%** | 50.8% |
| **45%** | 2:1 | 0.500 | $4.50 | $115.50 | $13,860 | **+57.9%** | 50.8% |
| **50%** | 0.5:1 | −0.150 | $4.50 | −$41.00 | −$4,920 | **−20.8%** | 50.8% |
| **50%** | 1:1 | 0.100 | $4.50 | $20.50 | $2,460 | **+10.3%** | 50.8% |
| **50%** | 1.5:1 | 0.350 | $4.50 | $83.00 | $9,960 | **+41.7%** | 50.8% |
| **50%** | 2:1 | 0.600 | $4.50 | $145.50 | $17,460 | **+73.1%** | 50.8% |
| **55%** | 0.5:1 | −0.125 | $4.50 | −$34.25 | −$4,110 | **−17.4%** | 50.8% |
| **55%** | 1:1 | 0.150 | $4.50 | $33.25 | $3,990 | **+16.7%** | 50.8% |
| **55%** | 1.5:1 | 0.425 | $4.50 | $101.75 | $12,210 | **+51.1%** | 50.8% |
| **55%** | 2:1 | 0.700 | $4.50 | $175.75 | $21,090 | **+88.3%** | 50.8% |
| **60%** | 0.5:1 | −0.100 | $4.50 | −$27.50 | −$3,300 | **−13.9%** | 50.8% |
| **60%** | 1:1 | 0.200 | $4.50 | $45.50 | $5,460 | **+22.9%** | 50.8% |
| **60%** | 1.5:1 | 0.500 | $4.50 | $120.50 | $14,460 | **+60.6%** | 50.8% |
| **60%** | 2:1 | 0.800 | $4.50 | $195.50 | $23,460 | **+98.3%** | 50.8% |
| **65%** | 0.5:1 | −0.075 | $4.50 | −$20.75 | −$2,490 | **−10.5%** | 50.8% |
| **65%** | 1:1 | 0.250 | $4.50 | $57.75 | $6,930 | **+29.0%** | 50.8% |
| **65%** | 1.5:1 | 0.575 | $4.50 | $139.25 | $16,710 | **+70.0%** | 50.8% |
| **65%** | 2:1 | 0.900 | $4.50 | $215.75 | $25,890 | **+108.5%** | 50.8% |
| **70%** | 0.5:1 | −0.050 | $4.50 | −$14.00 | −$1,680 | **−7.1%** | 50.8% |
| **70%** | 1:1 | 0.300 | $4.50 | $70.00 | $8,400 | **+35.2%** | 50.8% |
| **70%** | 1.5:1 | 0.650 | $4.50 | $158.50 | $19,020 | **+79.7%** | 50.8% |
| **70%** | 2:1 | 1.000 | $4.50 | $245.50 | $29,460 | **+123.5%** | 50.8% |

**Key takeaways from the matrix:**
- **Breakeven win rate (ES): ~50.8%** at any RR — commissions and spread shift the baseline slightly up
- **Below 50% WR, no RR combination is profitable** — the red cells above are mathematically loss-making scenarios
- **0.5:1 RR is nearly untradeable** — requires 65%+ WR just to be barely profitable after costs
- **1:1 RR at 55% WR is the entry point for sustainable profitability** (+$3,990/month = +16.7%)
- **2:1 RR at 55% WR is exceptional** (+$21,090/month = +88.3%)
- **The jump from 50% to 55% WR at 1.5:1 RR is the most impactful** — it nearly triples monthly net profit from $9,960 to $12,210

## 2.3 Drawdown Probability Matrix

> Using: P(N consecutive losses) = (1 − p)^N. EMDD ≈ 2.5 × σ × √(2 × ln(T)) for 200 trades.

| Win Rate | RR | σ per trade | EMDD (200 trades) | P(5 losses in row) | P(10 losses in row) | Survives 20-loss streak? |
|---|---|---|---|---|---|---|
| 40% | 1:1 | 1.00R | ~18% | 7.8% | 0.1% | Clustered losses over weeks create 15–20R DD — devastating |
| 50% | 1:1 | 1.00R | ~18% | 3.1% | 0.1% | 15-loss streak = 15R = 15% DD at 1R risk — survivable |
| 50% | 1.5:1 | 1.22R | ~22% | 3.1% | 0.1% | 15-loss streak = 22.5R = 22.5% DD on 2% risk |
| 55% | 1.5:1 | 1.22R | ~22% | 1.8% | 0.03% | Survivable with quarter Kelly. 15-loss streak = ~18.3R |
| 60% | 2:1 | 1.41R | ~25% | 1.0% | 0.01% | Highly survivable. 20-loss streak at quarter Kelly ≈ 10% DD |
| 65% | 2:1 | 1.41R | ~25% | 0.5% | 0.001% | Very robust. Even 15 consecutive losses = ~13R ≈ 13% DD |

**The critical insight:** At 2:1 RR and 60%+ WR, the system has enough geometric growth that drawdowns are recoverable within weeks. At 1:1 RR, recovery from a 15% drawdown requires 15+ trades at 60%+ win rate.

---

# PART 3 — SCENARIO ANALYSIS: WIN RATE, RR, ROI, AND DAILY TRADES

### Assumptions for all scenarios
- Starting capital: $25,000 (scaled to prop firm context)
- 1 ES contract per trade at $250 risk (20 ES points = 5 ticks × $50)
- 20 trading days/month
- Daily trades as specified per scenario

---

### SCENARIO A — CONSERVATIVE
**Profile:** Win rate 50%, RR 1:1, low-frequency scalper

| Metric | Value |
|---|---|
| Win rate | 50% |
| Risk-reward ratio | 1:1 |
| Daily trades (low freq) | 3 trades/day |
| Monthly trades | 60 trades |
| Gross EV per trade | 0.100R = $25.00 gross |
| All-in cost per trade | $4.50 |
| Net EV per trade | $20.50 |
| Monthly gross profit | $1,500 |
| Monthly costs | $270 |
| Monthly net profit | **$1,230** |
| Monthly ROI | **+4.9%** |
| Annualized ROI | **+58.8%** |
| Breakeven win rate | 50.8% |
| Margin to breakeven | −0.8% (barely profitable — HIGH RISK) |

**Verdict: SCENARIO A IS VIABLE ONLY IF WIN RATE IS TRULY 51%+.** At exactly 50%, costs make you unprofitable. Requires flawless execution and WR monitoring. Not recommended as primary strategy.

---

### SCENARIO B — BALANCED (Recommended Baseline)
**Profile:** Win rate 55%, RR 1.5:1, medium-frequency

| Metric | Value |
|---|---|
| Win rate | 55% |
| Risk-reward ratio | 1.5:1 |
| Daily trades (medium) | 5 trades/day |
| Monthly trades | 100 trades |
| Gross EV per trade | 0.425R = $106.25 gross |
| All-in cost per trade | $4.50 |
| Net EV per trade | $101.75 |
| Monthly gross profit | $10,625 |
| Monthly costs | $450 |
| Monthly net profit | **$10,175** |
| Monthly ROI | **+40.7%** |
| Annualized ROI | **+488.4%** |
| Breakeven win rate | 50.8% |
| Margin to breakeven | +4.2% (comfortable buffer) |
| Days to 10% DD recovery | ~8 winning trades at 2% risk |
| Max drawdown (quarter Kelly) | ~8–12% (manageable) |

**Verdict: SCENARIO B IS THE RECOMMENDED PRIMARY SCENARIO.** 55% WR is achievable with disciplined execution, tape reading, and the three-partner framework. 1.5:1 RR is practical on ES/NQ in the NY morning session. Monthly ROI of 40%+ is excellent.

---

### SCENARIO C — AGGRESSIVE
**Profile:** Win rate 60%+, RR 2:1+, selective high-conviction setups

| Metric | Value |
|---|---|
| Win rate | 60% |
| Risk-reward ratio | 2:1 |
| Daily trades (selective) | 4 trades/day |
| Monthly trades | 80 trades |
| Gross EV per trade | 0.800R = $200.00 gross |
| All-in cost per trade | $4.50 |
| Net EV per trade | $195.50 |
| Monthly gross profit | $15,640 |
| Monthly costs | $360 |
| Monthly net profit | **$15,280** |
| Monthly ROI | **+61.1%** |
| Annualized ROI | **+732.4%** |
| Breakeven win rate | 50.8% |
| Margin to breakeven | +9.2% (very wide buffer) |
| Max drawdown (quarter Kelly) | ~6–10% |

**Verdict: SCENARIO C IS THE ELITE TARGET.** 60% WR + 2:1 RR requires genuine skill + edge + the poker/math/quant trio. Monthly ROI of 61%+ is exceptional. Only pursue when Scenario B is consistently achieved.

---

### SCENARIO D — NO-EDGE (Break-Even Survivor)
**Profile:** Win rate 50%, RR 0.75:1, the mathematical floor

| Metric | Value |
|---|---|
| Win rate | 50% |
| Risk-reward ratio | 0.75:1 |
| Gross EV per trade | (0.50 × 0.75) − 0.50 = **−0.125R** |
| Result | **MATHEMATICALLY NEGATIVE — THIS SCENARIO LOSES MONEY** |

**Even before costs:**
- 50 wins × 0.75R = 37.5R gain
- 50 losses × 1.0R = 50R loss
- Net = −12.5R → negative expectancy

**After costs:**
- At $4.50/trade × 100 trades = $450/month in costs alone
- Monthly net = **−$450 − (12.5 × $250 risk × $250 base)** = losing significantly

**Verdict: SCENARIO D IS NOT VIABLE.** Never attempt to trade without a true edge (at minimum 1:1 RR at 52%+ WR). This scenario definitively shows why chasing low-RR setups is ruinous.

---

## 3.1 Summary Comparison Table

| Metric | Scenario A | Scenario B | Scenario C | Scenario D |
|---|---|---|---|---|
| Win Rate | 50% | 55% | 60% | 50% |
| RR | 1:1 | 1.5:1 | 2:1 | 0.75:1 |
| Trades/Day | 3 | 5 | 4 | 5 |
| Monthly Trades | 60 | 100 | 80 | 100 |
| Monthly Net Profit | $1,230 | $10,175 | $15,280 | NEGATIVE |
| Monthly ROI | +4.9% | +40.7% | +61.1% | NOT VIABLE |
| Annualized ROI | +58.8% | +488.4% | +732.4% | — |
| Drawdown Risk | HIGH | LOW–MED | LOW | N/A |
| Prop Firm Suitability | Marginal | **EXCELLENT** | **EXCELLENT** | None |
| Recommended Kelly | 1/8 to 1/4 | 1/4 to 1/3 | 1/4 to 1/2 | N/A |

---

## 3.2 Points and Pips Targets Per Scenario

### ES Targets (primary instrument)

| Timeframe | Strategy | SL (ES pts) | SL ($) | TP1 (ES pts) | TP2 (ES pts) | RR | TP1 Capture | TP2 Capture |
|---|---|---|---|---|---|---|---|---|
| 1-min | Scenario A (scalp) | 5 pts | $250 | 5 pts | — | 1:1 | $250 | — |
| 5-min | Scenario A/B | 10 pts | $500 | 10 pts | 15 pts | 1:1–1.5:1 | $500 | $750 |
| 5-min | Scenario B (primary) | 10 pts | $500 | 15 pts | — | 1.5:1 | $750 | — |
| 5-min | Scenario C | 10 pts | $500 | 20 pts | — | 2:1 | $1,000 | — |
| 15-min | Scenario C | 15 pts | $750 | 30 pts | — | 2:1 | $1,500 | — |
| 15-min | Scenario B | 15 pts | $750 | 22.5 pts | — | 1.5:1 | $1,125 | — |

### NQ Targets (primary instrument)

| Timeframe | Strategy | SL (NQ pts) | SL ($) | TP1 (NQ pts) | RR | TP1 Capture |
|---|---|---|---|---|---|---|---|
| 1-min | All scenarios | 15 pts | $300 | 15 pts (1:1) | 1:1 | $300 |
| 5-min | Scenario B | 20 pts | $400 | 30 pts (1.5:1) | 1.5:1 | $600 |
| 5-min | Scenario C | 20 pts | $400 | 40 pts (2:1) | 2:1 | $800 |
| 15-min | Scenario B/C | 30 pts | $600 | 45 pts (1.5:1) | 1.5:1 | $900 |
| 15-min | Scenario C | 30 pts | $600 | 60 pts (2:1) | 2:1 | $1,200 |

### MNQ Targets (prop firm preferred)

| Timeframe | Strategy | SL (MNQ pts) | SL ($) | TP1 (MNQ pts) | RR | TP1 Capture |
|---|---|---|---|---|---|---|
| 1-min | All scenarios | 20 pts | $40 | 20 pts | 1:1 | $40 |
| 5-min | Scenario B | 20 pts | $40 | 30 pts | 1.5:1 | $60 |
| 5-min | Scenario C | 20 pts | $40 | 40 pts | 2:1 | $80 |
| 15-min | Scenario B/C | 30 pts | $60 | 45 pts | 1.5:1 | $90 |
| 15-min | Scenario C | 30 pts | $60 | 60 pts | 2:1 | $120 |

### 6E (EURUSD Futures) Targets

| Timeframe | Strategy | SL (pips) | SL ($) | TP1 (pips) | RR | TP1 Capture |
|---|---|---|---|---|---|---|
| 1-min | All | 15 pips | $93.75 | 15 pips | 1:1 | $93.75 |
| 5-min | Scenario B | 20 pips | $125 | 30 pips | 1.5:1 | $187.50 |
| 5-min | Scenario C | 20 pips | $125 | 40 pips | 2:1 | $250 |
| 15-min | Scenario B/C | 30 pips | $187.50 | 45 pips | 1.5:1 | $281.25 |

---

# PART 4 — ATR-ONLY TRADING SYSTEM

## 4.1 The ATR Framework: Why ATR Alone is Sufficient

ATR is the single most powerful tool for an intraday trader because it:
1. **Normalizes across assets** — 15 NQ points means something different from 15 ES points; ATR makes them comparable
2. **Adapts to volatility** — stops widen in volatile markets, tighten in quiet ones, automatically
3. **Is session-aware** — can be used to filter which sessions to trade
4. **Removes subjectivity** — no need to "guess" where the market will move; ATR defines the market's current character

## 4.2 ATR Stop and Target Multiples — Exact Specification

| Asset | ATR Period | Volatility Regime | SL ATR× | TP1 ATR× | TP2 ATR× | TP3 ATR× |
|---|---|---|---|---|---|---|
| ES | 14 | Normal | 1.5× ATR | 1.0× ATR | 2.0× ATR | 3.0× ATR |
| ES | 14 | High (VIX > 20) | 2.0× ATR | 1.5× ATR | 2.5× ATR | — |
| ES | 14 | Low (VIX < 15) | 1.0× ATR | 0.75× ATR | 1.5× ATR | 2.0× ATR |
| NQ | 14 | Normal | 1.5× ATR | 1.0× ATR | 2.0× ATR | 3.0× ATR |
| NQ | 14 | High (VIX > 20) | 2.0× ATR | 1.5× ATR | 2.5× ATR | — |
| NQ | 14 | Low (VIX < 15) | 1.0× ATR | 0.75× ATR | 1.5× ATR | 2.0× ATR |
| MNQ | 14 | Normal | 2.0× ATR | 1.5× ATR | 2.5× ATR | — |
| MNQ | 14 | High | 2.5× ATR | 2.0× ATR | 3.0× ATR | — |
| 6E | 14 | Normal | 1.5× ATR | 1.0× ATR | 2.0× ATR | 3.0× ATR |

**MNQ uses wider multiples** because micro contracts have thinner liquidity and faster false breakouts relative to their price. Wider stops reduce whipsaw.

## 4.3 ATR-Based Entry Rules (No Other Indicators Required)

### Rule 1: Volatility Filter (Must Pass Before Any Entry)

```
IF current ATR(14) < 20-day ATR(14) × 0.70:
    → No new entries today (market too quiet = chop, false breaks)
    → Exception: micro-scalp only (1:1 RR, 1 contract, 50% normal size)

IF current ATR(14) > 20-day ATR(14) × 1.30:
    → ATR is expanding = trending/volatile market
    → Trade ONLY in direction of the 15-min trend (no counter-trend)
    → Reduce position size by 25%
```

### Rule 2: Session Filter (ATR Relative to Daily Average)

```
ATR_session_ratio = current_session_ATR / daily_ATR_average

IF ATR_session_ratio < 0.50:
    → Session too quiet (typically Asian/low-volume NY midday)
    → Scalp only or skip entirely
IF ATR_session_ratio between 0.50–1.00:
    → Normal conditions — trade per system
IF ATR_session_ratio > 1.00:
    → Above-average volatility — increase size cautiously
IF ATR_session_ratio > 1.50:
    → High volatility (FOMC, NFP, major news)
    → WAIT until 30 minutes after data release
    → Reassess ATR_post_news
```

### Rule 3: ATR Spike Detection (Volume Proxy)

```
IF ATR_today > ATR_yesterday × 1.50:
    → ATR spike = volume event = institutional activity
    Two interpretations:
        a) Spike UP with price thrust = momentum confirmation → ENTER
        b) Spike UP without directional price = churn → SKIP
    → Do NOT fade ATR spikes; they indicate real money moving
```

## 4.4 Position Sizing From ATR

```
Maximum $ Risk = Account × Kelly_fraction

ATR_adjusted_contracts = Maximum_dollar_risk / (ATR × multiplier × $/point)

ES example:
  Account = $25,000
  Kelly fraction (quarter) = 25,000 × 0.0625 = $1,562 risk available
  Current ATR(14) on ES = 10 points
  SL ATR multiplier = 1.5×
  SL in dollars = 10 × 1.5 × $50 = $750/contract
  Contracts = $1,562 / $750 = 2.08 → 2 contracts (round down)

If ATR expands (ATR = 15 points):
  SL = 15 × 1.5 × $50 = $1,125/contract
  Contracts = $1,562 / $1,125 = 1.39 → 1 contract

If ATR contracts (ATR = 5 points):
  SL = 5 × 1.5 × $50 = $375/contract
  Contracts = $1,562 / $375 = 4.16 → 4 contracts
```

**Core rule: When ATR widens, position size shrinks proportionally. When ATR tightens, position size can increase.**

## 4.5 ATR Trailing Stop (Exit Management)

```
ATR Trailing Stop (Long):
  Stop = Close − ATR(14) × 3
  Move stop UP only (never down):
    After each new high: Stop = max(previous_stop, High − ATR×3)

ATR Trailing Stop (Short):
  Stop = Close + ATR(14) × 3
  Move stop DOWN only (never up):
    After each new low: Stop = min(previous_stop, Low + ATR×3)
```

## 4.6 ATR Exit Decision Tree

```
PRIORITY ORDER for exits (apply in this sequence):

1. HARD STOP HIT?
   → Yes: Close all, record trade, update DD tracker
   → No: Continue to Step 2

2. TP1 HIT?
   → Yes: Close 50% of position at TP1
   → Move stop to BREAKEVEN immediately (cost basis = 0 risk)
   → Continue with remaining 50% to TP2

3. TP2 HIT?
   → Yes: Close remaining 50% at TP2
   → Record full trade

4. TIME STOP (X bars, no TP hit)?
   → Exit 100% at market
   → No emotion, no hoping for reversal

5. ATR CONTRACTING (ATR < 0.70 × entry ATR)?
   → Tighten stop to 1.5 × new ATR
   → Give the trade room but watch closely

6. CLOSE OF SESSION (3:00 PM ET)?
   → Flatten all positions regardless of P&L
   → No overnight holds on intraday-only strategy
```

---

# PART 5 — KELLY CRITERION: COMPLETE MATHEMATICAL FRAMEWORK

## 5.1 Core Kelly Formulas

**Full Kelly (fixed R):**
```
f* = (bp − q) / b
or equivalently:
f* = W − [(1 − W) / R]

Where:
  f* = Kelly fraction (% of capital to risk)
  W = Win rate (decimal)
  R = Reward-to-risk ratio (average win / average loss)
  b = net odds = R
  p = win rate = W
  q = 1 − p
```

**Full Kelly (variable win sizes — Ralph Vince Optimal F):**
```
Optimal F = argmax over f of [ ∏(1 + f × Ri)]^(1/n) − 1
Where Ri = individual trade return in fractions of account
This must be solved numerically (brute-force search from f = 0.01 to 1.0).
```

## 5.2 Kelly Sizing Table — Full/Half/Quarter Kelly Per Scenario

### Scenario B: 55% WR, 1.5:1 RR

| Kelly Variant | Kelly % | $ at Risk ($25K) | $ Risk/Trade | Max Contracts (ES, 10-pt stop) | Max Contracts (NQ, 20-pt stop) |
|---|---|---|---|---|---|
| Full Kelly | 25.0% | $6,250 | $6,250 | 12 contracts | 15 contracts |
| 2/3 Kelly | 16.7% | $4,167 | $4,167 | 8 contracts | 10 contracts |
| Half Kelly | 12.5% | $3,125 | $3,125 | 6 contracts | 7 contracts |
| 1/3 Kelly | 8.3% | $2,083 | $2,083 | 4 contracts | 5 contracts |
| **Quarter Kelly** | **6.25%** | **$1,562** | **$1,562** | **3 contracts** | **3 contracts** |
| Eighth Kelly | 3.1% | $781 | $781 | 1 contract | 1 contract |

### Scenario C: 60% WR, 2:1 RR

| Kelly Variant | Kelly % | $ at Risk ($25K) | $ Risk/Trade | Max Contracts (ES, 10-pt stop) | Max Contracts (NQ, 20-pt stop) |
|---|---|---|---|---|---|
| Full Kelly | 40.0% | $10,000 | $10,000 | 20 contracts | 25 contracts |
| Half Kelly | 20.0% | $5,000 | $5,000 | 10 contracts | 12 contracts |
| **Quarter Kelly** | **10.0%** | **$2,500** | **$2,500** | **5 contracts** | **6 contracts** |
| Eighth Kelly | 5.0% | $1,250 | $1,250 | 2 contracts | 3 contracts |

### Scenario A: 50% WR, 1:1 RR (Marginal — use 1/8 Kelly only)

| Kelly Variant | Kelly % | $ at Risk ($25K) | Max Contracts (ES) | Max Contracts (NQ) |
|---|---|---|---|---|
| Full Kelly | 0.0% | — | 0 (EV = 0) | 0 |
| Half Kelly | 0.0% | — | 0 | 0 |
| **Quarter Kelly** | **1/8 Kelly** | **$313** | **0 contracts** | **0 contracts** |

> Note: At 50% WR, 1:1 RR, Kelly = 0 — mathematically there is no Kelly-optimal bet. Use fixed fraction (1% max) if attempting this scenario.

## 5.3 Dynamic Kelly Adjustment Rules (Three-Partner Framework)

### Baseline Rule
```
START each session at: baseline_Kelly = quarter Kelly of current account size
```

### Streak-Based Adjustments

| Condition | Kelly Multiplier | Reason |
|---|---|---|
| After 3 consecutive losses | Reduce to half Kelly | Protect capital during adverse variance |
| After 5 consecutive losses | Reduce to quarter Kelly | Deepen protection, re-evaluate edge |
| After 6+ consecutive losses | STOP TRADING — review next day | Edge has failed; do not trade emotionally |
| After 3 consecutive wins | Increase Kelly by 25% (capped at half Kelly) | Momentum confirmation |
| After 5 consecutive wins | Increase Kelly by 25% again | Let winners run, capture streak |
| After new equity high | Set new baseline Kelly | Only increase when capital has grown |
| After 3% daily DD | Reduce to quarter Kelly | Approaching daily limit |
| After 5% daily DD | REDUCE TO EIGHTH KELLY | Very close to prop firm limit |

### High-Water Mark Rule
```
current_equity = calculate_equity_now()
if current_equity > peak_equity:
    peak_equity = current_equity
    baseline_Kelly = recalculate using new peak_equity
else:
    baseline_Kelly = min(current_baseline, previous_baseline)
    (never increase Kelly during a drawdown)
```

---

# PART 6 — DRAWDOWN MANAGEMENT: THE MATHEMATICAL CORE

## 6.1 Consecutive Loss Probabilities

| Win Rate | P(3 in row) | P(5 in row) | P(7 in row) | P(10 in row) | P(15 in row) |
|---|---|---|---|---|---|
| 40% | 21.6% | 7.8% | 2.8% | 0.6% | 0.05% |
| 50% | 12.5% | 3.1% | 0.8% | 0.1% | 0.003% |
| 55% | 9.1% | 1.8% | 0.37% | 0.03% | 0.0004% |
| 60% | 6.4% | 1.0% | 0.16% | 0.01% | 0.00006% |
| 65% | 4.3% | 0.5% | 0.03% | 0.001% | ~0% |

**Practical implications:**
- A 55% WR trader will see 5 consecutive losses roughly once per year of daily trading
- A 60% WR trader rarely sees 7+ consecutive losses; if they do, the market regime has changed
- **The real danger is NOT the consecutive loss streak — it is the compounding of large losses**

## 6.2 Drawdown Recovery Math

```
Recovery requirement = Drawdown% / (1 − Drawdown%)

| Drawdown | Required Return | With 2% Risk/Trade, 55% WR, 1.5:1 R | Trades to Recover |
|---|---|---|---|
| 5% | 5.3% | 37.5% expectancy per trade | ~7 trades |
| 10% | 11.1% | 37.5% expectancy per trade | ~13 trades |
| 20% | 25.0% | 37.5% expectancy per trade | ~27 trades |
| 30% | 42.9% | 37.5% expectancy per trade | ~40 trades |
| 40% | 66.7% | 37.5% expectancy per trade | ~53 trades |
| 50% | 100.0% | Must double to recover | ~80 trades |

**Critical insight:** A 50% drawdown requires ~80 good trades to recover. This is why avoiding large losses is worth more than pursuing large wins.
```

## 6.3 Daily Loss Shutdown Rules

| DD as % of Account | Action |
|---|---|
| 1% | Reduce size by 25% |
| 2% | Reduce size by 50% |
| 3% | Reduce size by 75% |
| 4% | STOP TRADING — session over |
| 5% | Breach of prop firm daily limit — DQs often |

---

# PART 7 — PROP FIRM OPTIMIZATION: COMPREHENSIVE STRATEGY

## 7.1 Prop Firm Comparison (April 2026)

| Firm | Type | Entry Cost (50K) | Daily DD Limit | Max DD | Profit Target | Min Days | Consistency | Profit Split | Withdrawal | Scaling Cap |
|---|---|---|---|---|---|---|---|---|---|---|
| **FTMO 1-Step** | 1-step | ~$407 | 3% | 6% trailing | 10% | 4 days | 50% | 90% | 14 days | $2M |
| **FTMO 2-Step** | 2-step | ~$407 | 5% | 10% trailing | 10% + 5% | 4/phase | 50% (funded) | 80% | 14 days | $2M |
| **Blue Guardian Instant** | 1-step | $59–$599+ | 3% | 5% | None | 5 days | 15–20% | 80–90% | Instant | $4M |
| **Blue Guardian Standard** | 1-step | $150–$850+ | 4% | 6–8% | 8–10% | 3–5 days | 15–50% | 80–90% | 14 days | $4M |
| **Audacity Capital** | 2-step | Not published | 5–7.5% | 10–15% | 10% + 5% | 4/phase | Audacity Score | 60–90% | 30 days | $2M |
| **Topstep Trading Combine** | 2-step | $49–$149/mo | $1K–$3K absolute | $2K–$4.5K | 6% | 5 sessions | 40–50% | 90% | 5 winning days | Live Funded |
| **MyFundedFutures Core** | 1-step | $77/mo | **NONE** (EOD only) | $2,000 EOD | 6% | 5 days | 50% | 80% | 5 winning days | Funded only |
| **MyFundedFutures Rapid** | 1-step | $129/mo | **NONE** (EOD only) | $2,000 EOD | 6% | 5 days | 50% | 90% | Daily payouts | Funded only |
| **MyFundedFutures Pro** | 1-step | $227/mo | **NONE** (EOD only) | $2,000 EOD | 6% | 5 days | **None (funded)** | 80% | 14 days | Funded only |

**FIRM STATUS UPDATES:**
- True Forex Funds: **PERMANENTLY CLOSED** (do not consider)
- UPrading: **NOT VERIFIED** (not found in April 2026 searches — verify before use)

## 7.2 Best Prop Firms by Use Case

| Use Case | Best Firm | Why |
|---|---|---|
| **Fastest path to funded** | Blue Guardian Instant Funding | No evaluation; start trading immediately for 80–90% split |
| **Lowest cost per funded account** | FTMO 2-Step (Phase 1+2 total ~$400) | Most cost-efficient over 2-step lifecycle |
| **Best for futures-only traders** | MyFundedFutures | CME futures only, no daily DD limit, fast payouts |
| **Highest profit split** | FTMO 1-Step, Blue Guardian, Topstep | 90% from day one |
| **Most generous drawdown limits** | Audacity Capital (7.5% daily/15% total in Phase 1) | Best buffer for skill-based trading |
| **Best consistency rule** | MyFundedFutures Pro (none once funded) | Full freedom once funded |
| **Best for scaling to large accounts** | Blue Guardian ($4M cap) | Highest scaling ceiling |
| **Best for beginners/low capital** | Topstep ($49/mo, 5 contracts) | Low monthly cost, small contract limits reduce risk |

## 7.3 Asset Selection: MNQ vs NQ vs ES for Prop Trading

### MNQ: The Optimal Prop Firm Contract

| Factor | NQ | MNQ | Winner |
|---|---|---|---|
| Dollar risk per point | $20/point | $2/point | MNQ (finer sizing) |
| Position granularity | Whole contracts | Micro steps | MNQ (1 contract = $2 vs $20) |
| DD limit buffer | Smaller | Larger per contract | MNQ |
| Profit per correct trade | Higher (if correct) | Lower | NQ (marginal — more profit per trade) |
| Scalability on funded | 1–5 contracts | 1–25 contracts | MNQ |
| Same edge applicability | Yes | Yes (99.7% correlated) | Tie |
| Risk of one bad trade | Higher | Lower | MNQ |

**When to use NQ over MNQ:**
- On funded accounts of $100K+ where contract limits are high (10+ NQ contracts allowed)
- When you have demonstrated consistent profitability and want larger R per trade
- On NY open where NQ moves 40–80+ points and NQ sizing is more efficient

**ES vs NQ for prop trading:**

| Factor | ES | NQ | Winner |
|---|---|---|---|
| Spread tightness | Tighter (0.25 pt) | Moderate (0.5 pt) | ES |
| Dollar per point | $50/pt | $20/pt | ES (bigger capture) |
| Typical daily range | 60–70 pts | 150–200 pts | NQ (more opportunity) |
| Intraday volatility | Moderate | High | ES (more predictable) |
| Correlation with S&P 500 | 100% | 99.7% | Tie |
| Best for scalping | Yes | Yes | Either |
| Best for momentum | Less | More (tech-heavy) | NQ |

**Recommendation for three-partner framework:**
- **Primary scalp: MNQ** on 5-min with 1.5:1 RR (easiest DD management)
- **Secondary scalp: ES** on 5-min with 1.5–2:1 RR (better dollar capture)
- **Momentum plays: NQ** on 15-min with 2:1 RR (high conviction only)
- **6E: Hedge/correlation play** — only trade when ES and NQ are in conflict or on low-correlation days

## 7.4 How Many Prop Firms to Run Simultaneously

**Single funded account risk:**
- A single $50K funded account has gap risk (overnight news, weekend gap)
- If you have only 1 funded account and it DQs, you lose all income stream
- Single account: maximum income concentration risk

**Two funded accounts:**
- If 1 DQs: you have 1 remaining → income reduced by 50%
- Still viable if you can re-enter challenges quickly
- Minimum recommended for serious prop traders

**Three funded accounts (RECOMMENDED):**
- Spread across 2–3 different firms (different DD rule sets)
- If 1 DQs: 2 remain → income reduced by 33%
- Different contract limits across firms provide natural diversification
- Manageable at 3 accounts per trader before overhead becomes significant

**Four to six funded accounts (OPTIMAL for serious traders):**
- Maximum DD event diversification
- Multiple income streams across firms
- Can specialize: some ES-heavy, some MNQ-heavy, some multi-asset
- Overhead starts to become significant (3–4 hours/week of account management)
- 6 funded $50K accounts = $300K equivalent capital under management

**Beyond 6 funded accounts:**
- Management overhead grows faster than diversification benefit
- Better to scale up account sizes (50K → 100K → 250K) rather than add more accounts

## 7.5 Capital Allocation Model

### Starting with $5,000 Personal Capital

| Allocation | Amount | Purpose |
|---|---|---|
| Challenge slots | $1,500 | 3× $500 challenge entry fees (spread across firms) |
| Recovery reserve | $1,000 | If challenges fail, re-enter |
| Daily trading capital | $2,000 | NOT for trading — covers living costs while funded |
| Brokerage capital | $0 | Use prop firm capital for trading |
| Total | $5,000 | |

**Challenge strategy with $1,500 challenge budget:**
- Round 1: Buy 3 challenges across different firms ($500 each)
- Pass rate assumption (skilled trader): 60% pass on first attempt
- Expected funded accounts from round 1: 1.8 → assume 1.8 (1–2 funded)
- Each $50K funded account pays out: 6% profit/month × $3,000 capital × 90% = $162/month

### After First Funded Accounts

| Milestone | Action |
|---|---|
| 1 funded $50K account | Run it. Reinvest first payout into next challenge. |
| 2 funded $50K accounts | Add second challenge slot. Target 4 total funded eventually. |
| 3 funded $50K accounts | Scale one to $100K (most firms allow) or add 4th. |
| 4 funded $50K accounts | Optimal income: 4 × $162/month = $648/month from $5K capital. Annualized: $7,776 = 155% ROI on $5K. |

### Full Funded Income Model

| Funded Accounts | Size | Monthly Profit Target | Payout % | Monthly Payout | Annual Payout |
|---|---|---|---|---|---|
| 1 | $50K | $3,000 (6%) | 90% | $2,700 | $32,400 |
| 2 | $50K each | $3,000/month each | 90% | $5,400 | $64,800 |
| 3 | $50K each | $3,000/month each | 90% | $8,100 | $97,200 |
| 4 | $50K each | $3,000/month each | 90% | $10,800 | $129,600 |
| 1 | $100K (scaled) | $6,000 (6%) | 90% | $5,400 | $64,800 |
| 4 | $100K each | $6,000/month each | 90% | $21,600 | $259,200 |

**Key insight:** A trader with 4 funded $100K accounts earns $21,600/month from $5K personal capital — a 432× annual leverage multiple. This is the mathematical case for prop trading.

## 7.6 The Consistency Rule: Mathematical Solution

**Problem:** Most firms cap daily profit at 30–50% of total profit target. If you make $2,000 on day 1 of a $3,000 target challenge, you may waste $1,000 of potential.

### Mathematically Optimized Consistency Approach

Let P = profit target, C = consistency cap (decimal), N = number of trading days.

```
Daily target = (P × C) per day — 5% buffer = P × C × 0.95

Example: $50K account, 6% target ($3,000), 40% consistency cap
  Max per day = $3,000 × 0.40 = $1,200
  Target per day (with buffer) = $1,200 × 0.95 = $1,140

  Minimum days needed = P / (P × C) = 1/C = 1/0.40 = 2.5 → 3 days minimum
  Strategy: Distribute $3,000 across 3+ days, each contributing ~$1,000
```

### The Flattening Algorithm (Mathematician Partner's Role)

```
function calculate_target_size(today, days_remaining, profit_remaining):
    avg_daily_target = profit_remaining / days_remaining
    consistency_cap = P × 0.40  # 40% rule

    if today_running_PnL + avg_daily_target > consistency_cap:
        # Size down today — you are approaching the cap
        reduce_position_by = (today_running_PnL + avg_daily_target - consistency_cap) / avg_daily_target
        return max(0.3, 1.0 - reduce_position_by)  # Never less than 30% of normal size
    else:
        return 1.0  # Full size
```

This algorithm, implemented by the mathematician partner, automatically prevents "big day" violations while maximizing the probability of hitting the total target.

## 7.7 DQ Prevention Checklist (Pre-Session)

**Before every trading session, complete this checklist:**

- [ ] Check prop firm rules for this specific account (DD limit, contract limit, news rules)
- [ ] Calculate max daily loss limit: Prop firm limit × 50% = your personal stop
- [ ] Calculate max per-trade risk: Daily limit ÷ 8 = max risk per trade
- [ ] Check news calendar: No entries 30 min before/after NFP, FOMC, CPI, GDP
- [ ] Check time: All positions flat by 3:00 PM CT (or firm's close time)
- [ ] Verify no overnight holds: Close all positions before 4:00 PM CT
- [ ] Check contract limit: This firm allows N contracts max per asset
- [ ] Set daily DD tracker in platform before first trade
- [ ] Set Alert Guardian (Blue Guardian) or equivalent: Auto-close at 2% unrealized loss
- [ ] Verify weekend position rules: Close all Friday before market close (CME holiday schedule)

---

# PART 8 — THREE-PARTNER MATHEMATICAL STRATEGY

## 8.1 The Team Composition and Roles

### Partner 1: The Poker Player
**Role:** Reads flow, manages emotional risk, makes bet-sizing decisions

**Specializations:**
- **Hand reading:** Reads market structure like poker hands — identifies when institutions are "bluffing" (false breaks), when they are "value betting" (strong directional momentum)
- **Pot commitment:** Only commits significant capital when the hand is strong — waits for confirmed setups, doesn't chase
- **Bankroll management:** Treats drawdown like a bad poker session — reduces, doesn't increase bets
- **Tilt prevention:** Immediately recognizes when a bad trade has compromised judgment — stops without rationalizing

### Partner 2: The Mathematician
**Role:** Optimizes position sizing, models recovery math, validates statistical edge

**Specializations:**
- **Kelly recalculation:** After every 20 trades, recalculate actual WR and R from live data
- **Recovery planning:** After any DD, computes exact number of trades needed to recover
- **Edge validation:** Monthly: is the actual edge statistically significant (p < 0.05) or noise?
- **Consistency optimization:** Implements the flattening algorithm to prevent big-day DQs
- **Portfolio math:** If trading ES + NQ simultaneously, compute correlation-adjusted combined risk

### Partner 3: The Quant/Data Analyst
**Role:** Generates real-time edge signals, monitors volatility regime, manages ATR system

**Specializations:**
- **Volatility regime detection:** Monitors VIX level, ATR ratio, and session volume to classify market as trending, mean-reverting, or choppy
- **ATR normalization:** Computes ATR across all instruments to find the best trade RIGHT NOW
- **Session scoring:** Rates each 30-minute window for trade quality based on volume and ATR
- **Signal generation:** Produces a daily "session map" ranking which hours/asset combos have highest edge probability
- **Backtesting:** Runs walk-forward analysis on 20-trade rolling windows to detect if strategy is deteriorating

## 8.2 Decision Flow: How All Three Partners Work Together

```
PRE-SESSION (15 min before open):
───────────────────────────────────────────────────
Partner 3 (Quant):
  → Pull ATR for ES, NQ, MNQ, 6E (14-bar on 5-min and 15-min)
  → Compare to 20-session averages
  → Generate session map: Best hours and best assets for today
  → Check news calendar, flag high-volatility windows
  → Output: ranked list of top 3 setups with ATR-based stop/target

Partner 2 (Mathematician):
  → Calculate current Kelly size from equity high-water mark
  → Calculate max contracts per trade (Kelly ÷ ATR-based stop $)
  → Check if any DD exists; if yes, compute recovery trades needed
  → Set consistency cap target: $3,000 target / 40% = $1,200 max daily contribution

Partner 1 (Poker Player):
  → Review tape from previous session
  → Identify key structural levels (yesterday's high/low, week open, major zones)
  → Prepare mental model: "What does the market want today?"
  → Set emotional state check: "Am I clear-headed? If not, reduce Kelly by 50%"
  → Verify no personal DD breaches from prior session

ENTRY DECISION (when setup appears):
───────────────────────────────────────────────────
Partner 3 confirms:
  → ATR filter passes? (ATR > 0.70 × 20-session avg)
  → Session is favorable? (ATR_ratio > 0.50)
  → Volume present? (ATR spike not declining)
  → Asset is highest-ranked on today's session map?

Partner 2 confirms:
  → Kelly size calculated for this specific stop distance
  → Number of contracts within daily loss limit
  → Not exceeding contract limit for this prop firm account

Partner 1 confirms:
  → Price action confirms direction (tape reading, order flow, structure)
  → Reward-to-risk is at least 1.5:1
  → Market conditions favor this direction over the alternative

ALL THREE must agree → ENTER
ANY ONE dissents → REDUCE SIZE or SKIP
```

## 8.3 The "No-Edge, Pure Skill" Scenario: ATR-Only Mathematical Playbook

**Context:** The team has no edge in the traditional sense — but they have world-class skill in reading price action, managing math, and analyzing data. Win rate is never a problem. What do they do?

**The answer: They create their own edge mathematically, without indicators.**

### The ATR-Only Playbook (Complete, No Other Indicators)

**Principle:** ATR tells you how much the market is moving RIGHT NOW. This information, combined with session-aware price action (which the poker player reads from the tape), IS the complete system.

### Setup Identification (Poker Player reads tape):

```
A. TREND (poker player reads momentum):
   - Price making higher highs + higher lows (bullish structure)
   - OR price making lower highs + lower lows (bearish structure)
   - Volume increasing (confirmed by ATR expansion)
   - Market "telling" you direction via institutional footprints
   → ACTION: Trade in direction of trend using ATR-based stops

B. RANGE (poker player reads congestion):
   - Price oscillating between defined levels
   - ATR contracting (chop, no momentum)
   → ACTION: Only trade reversals at range boundaries
   - Entry: at support/resistance with ATR-based stop
   - Target: opposite boundary of range

C. BREAKOUT (poker player reads compression):
   - ATR at multi-session low (volatility compression)
   - Price consolidating in tight range
   → ACTION: Trade the breakout in either direction
   - Entry: when price breaks range high/low + 1 tick
   - SL: opposite side of consolidation = ATR × 1.5 minimum
   - TP: Height of consolidation + ATR × 2
```

### ATR Multiples Reference Card

| Asset | Session | SL ATR× | TP1 ATR× | TP2 ATR× | TP3 ATR× | When to Use |
|---|---|---|---|---|---|---|
| ES | NY Open | 1.5× | 1.0× | 2.0× | — | High momentum |
| ES | NY Midday | 2.0× | 1.5× | 2.5× | — | Low vol, chop |
| ES | London | 1.5× | 1.0× | 2.0× | 3.0× | Trending |
| NQ | NY Open | 1.5× | 1.0× | 2.0× | — | High momentum |
| NQ | NY Midday | 2.0× | 1.5× | 2.5× | — | Low vol, chop |
| NQ | London | 1.5× | 1.0× | 2.0× | 3.0× | Trending |
| MNQ | Any | 2.0× | 1.5× | 2.5× | — | Prop firm primary |
| 6E | Any | 1.5× | 1.0× | 2.0× | 3.0× | Cross-asset |

### ATR-Based Entry Without Price Indicators (Pure Math Framework)

```
STEP 1: Classify ATR regime
  ATR_ratio = current_ATR / 20-session_ATR_avg
  IF ATR_ratio > 1.30 → HIGH VOL (trade with 25% smaller size, wider stop)
  IF ATR_ratio 0.70–1.30 → NORMAL (trade per system)
  IF ATR_ratio < 0.70 → LOW VOL (skip, or micro-scalp only)

STEP 2: Classify session
  IF time is NY open (8:30–10:00 AM ET) → multiply ATR by 0.80 (ATR overstated during data)
  IF time is London (2:00–5:00 AM ET) → multiply ATR by 0.90
  IF time is NY midday → multiply ATR by 1.20 (ATR understates normal vol here)

STEP 3: Calculate dollar risk
  Dollar risk = ATR_adjusted × multiplier × $/point
  IF dollar risk > Kelly size → reduce contracts, round down

STEP 4: Execute
  SL = ATR_adjusted × SL_multiplier
  TP1 = ATR_adjusted × TP1_multiplier
  TP2 = ATR_adjusted × TP2_multiplier
  Entry: market order, no limit orders (avoid adverse selection)
```

---

# PART 9 — INTEGRATED RECOMMENDED STRATEGY

## 9.1 The Master Strategy

**Target Profile:** 55% WR, 1.5:1 RR (Scenario B), implemented via three-partner framework

### Asset Priority
1. **MNQ** — primary prop firm instrument. 5-min scalp. 20-pt SL (2.0× ATR), 30-pt TP (2.25× ATR)
2. **ES** — secondary instrument for NY open. 5-min. 10-pt SL, 15-pt TP (1.5:1 RR)
3. **NQ** — momentum confirmations on 15-min. High conviction only. 20-pt SL, 40-pt TP (2:1 RR)
4. **6E** — when EURUSD is volatile and ES/NQ are quiet (non-correlated regime)

### Session Priority
1. **NY Open (8:30–10:00 AM ET)** — highest volume, most opportunity, trade 2–3 setups
2. **London/NY overlap (7:00–8:30 AM ET)** — rising volume, second-best window, trade 1–2 setups
3. **NY Close (3:00–4:00 PM ET)** — institutional flow, 1–2 setups
4. **London session (2:00–5:00 AM ET)** — moderate, 1–2 setups
5. **NY midday (11:30 AM–1:00 PM ET)** — skip or micro only

### Position Sizing
- **Baseline:** Quarter Kelly on $25K account = $1,562 max risk per trade
- **On MNQ (20-pt stop):** Max 3–5 MNQ contracts (practical cap)
- **On ES (10-pt stop):** Max 3–4 contracts
- **On NQ (20-pt stop):** Max 3–4 contracts
- **Daily loss limit:** $750 personal (3% of $25K), prop firm stop at $1,250 (5%)
- **Trading day ends:** After 3 losses in a row OR 3% DD — whichever comes first

### Entry Criteria (All Must Be Present)
1. ATR filter passes (ATR > 0.70 × 20-session average)
2. Session is NY open, London overlap, or NY close
3. Price action confirms direction (HH/HL for longs, etc.)
4. Reward-to-risk ≥ 1.5:1 at time of entry
5. No high-impact news in next 30 minutes

### Exit Rules
1. Hard stop at SL
2. TP1 at 1.0× ATR — close 50%, move stop to breakeven
3. TP2 at 2.0× ATR — close remaining 50%
4. Time stop at 12 bars (no target hit)
5. Session close — flatten all

---

# PART 10 — MONTHLY ROI AND TRADE COUNT SUMMARY

| Scenario | Daily Trades | Monthly Trades | Monthly Net Profit | Monthly ROI | Sustainable? |
|---|---|---|---|---|---|
| Conservative (50% WR, 1:1 RR) | 3 | 60 | $1,230 | +4.9% | Marginal — needs 51%+ WR |
| **Balanced (55% WR, 1.5:1 RR)** | **5** | **100** | **$10,175** | **+40.7%** | **YES — recommended** |
| Aggressive (60% WR, 2:1 RR) | 4 | 80 | $15,280 | +61.1% | YES — target after consistent Scenario B |
| No-Edge (50% WR, 0.75:1 RR) | 5 | 100 | NEGATIVE | NOT VIABLE | NO — will lose money |

---

# PART 11 — VERIFICATION AND TESTING

**How to verify this strategy works end-to-end:**

1. **Paper trade first** (mandatory — Paper Trading Rule from CLAUDE.md): Run the balanced scenario for 4 weeks minimum before using real capital. Track: WR, average R, total P&L, max daily DD.
2. **Compare actual vs. expected:** Expected monthly ROI for balanced scenario is +40.7%. If actual is between +25% and +55%, the strategy is working. If below +20%, re-evaluate WR assumption.
3. **Prop firm challenge:** After 4 weeks of paper trading showing 55%+ WR, enter one Blue Guardian Instant or MyFundedFutures Core challenge.
4. **Pass criteria:** The 6% profit target is achievable in 2–4 weeks on MNQ at Scenario B stats. If taking more than 6 weeks, the WR estimate was optimistic.
5. **Funded stage:** On first funded account, run at 75% of normal Kelly size for first 2 weeks to establish track record with minimal DD risk.
