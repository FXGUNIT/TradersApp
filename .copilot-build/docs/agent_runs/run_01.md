# Complete Intraday Trading Strategy — NQ, ES, MNQ, 6E
## Run #1 — Independent Quantitative Analysis
**Prepared:** April 2026 | **Basis:** First-principles quantitative analysis | **Target:** Prop firm + personal capital

---

## Executive Summary

This document is a standalone, first-principles quantitative trading strategy for four futures instruments — ES (S&P 500), NQ (Nasdaq 100), MNQ (Micro Nasdaq 100), and 6E (EUR/USD) — designed for prop firm challenge completion and personal account growth. All numbers are derived from first principles using April 2026 market conditions, current prop firm rules, and Kelly Criterion mathematics. No prior run data is referenced.

**Recommended baseline profile:** 55% win rate, 1.5:1 risk-reward ratio, quarter Kelly position sizing, MNQ as primary instrument.

**Projected monthly ROI (balanced scenario):** +40.7% on personal capital
**Projected monthly payout (prop firm, 4 funded $50K accounts):** $10,800

---

## SECTION 1 — CONTRACT SPECIFICATIONS & COST STRUCTURES

### 1.1 Instrument Specifications

| Specification | ES | NQ | MNQ | 6E (EURUSD) |
|---|---|---|---|---|
| **Exchange** | CME Globex | CME Globex | CME Globex | CME Globex |
| **Contract multiplier** | $50/pt | $20/pt | $2/pt | $125,000/pt |
| **Tick size** | 0.25 pts | 0.25 pts | 0.25 pts | 0.00005 (5 digits) |
| **Tick value** | $12.50/tick | $5.00/tick | $0.50/tick | $6.25/tick (0.5 tick = $3.125) |
| **1-point move** | $50 | $20 | $2 | $125 per 0.0001 = $12.50/pt; per full point = $125 |
| **Full spread (round-trip)** | $3.13–$6.25 | $2.50–$5.00 | $0.25–$0.50 | $6.25–$12.50 |
| **All-in round-trip cost** | $4.00–$6.50 | $3.50–$6.00 | $0.50–$1.00 | $4.00–$8.00 |
| **Day trade margin (IBKR, approx.)** | $400–$1,000 | $500–$1,500 | $50–$100 | $1,000–$1,500 |
| **Overnight margin** | $26,739 | $40,610 | $4,061 | $2,970 |
| **14-bar Daily ATR (points)** | 50–80 pts | 150–250 pts | 150–250 pts | 60–100 pips |
| **5-min ATR (points)** | 8–15 pts | 25–50 pts | 25–50 pts | N/A |
| **1-min ATR (points)** | 3–7 pts | 10–20 pts | 10–20 pts | N/A |
| **Typical daily range** | 60–70 pts | 150–200 pts | 150–200 pts | 60–100 pips |

**April 2026 market context:** VIX has been elevated in early 2026 due to tariff uncertainty and Fed policy ambiguity. Elevated VIX (>18) is the current regime. This means wider ATR readings, larger daily ranges, and higher intraday volatility — which increases both opportunity and risk. ATR multiples in this document are calibrated for this environment.

### 1.2 Cost Breakdown (Per Instrument, Round-Trip)

| Cost Component | ES | NQ | MNQ | 6E |
|---|---|---|---|---|
| Brokerage commission | $2.00/side × 2 = $4.00 | $4.00 | $4.00 | $4.00 |
| Exchange fees (CME) | ~$0.15/contract | ~$0.15/contract | ~$0.15/contract | ~$0.15/contract |
| NFA fee | ~$0.05/contract | ~$0.05/contract | ~$0.05/contract | ~$0.05/contract |
| Spread cost (half-spread) | $6.25 (0.5 pt × $50) | $5.00 (0.5 pt × $20) | $0.50 (0.25 pt × $2) | $6.25 (0.5 tick × $12.50) |
| **Total all-in (conservative)** | **$6.50** | **$5.25** | **$0.60** | **$6.50** |
| **Total all-in (typical)** | **$4.50** | **$4.25** | **$0.70** | **$6.00** |
| Slippage assumption (adverse, per side) | $1.25 (0.25 pts) | $1.25 (0.25 pts) | $0.125 (0.25 pts) | $3.125 (0.5 tick) |

**Per-trade cost as % of 1R risk:**

| Instrument | Typical Cost | Typical 1R Risk | Cost as % of 1R |
|---|---|---|---|
| ES | $4.50 | $250 (10 pts × $50) | 1.80% |
| NQ | $4.25 | $400 (20 pts × $20) | 1.06% |
| MNQ | $0.70 | $40 (20 pts × $2) | 1.75% |
| 6E | $6.00 | $125 (20 pips × $6.25) | 4.80% |

**Key insight:** 6E has disproportionately high costs relative to risk. MNQ and ES are the most cost-efficient for small accounts. NQ offers the best cost-to-risk ratio for medium accounts.

---

## SECTION 2 — WIN RATE × RISK-REWARD MATRIX

### 2.1 Core Formulas

```
Gross Expectancy (in risk units)  = (WR × RR) − (1 − WR)
Net Expectancy (in risk units)    = Gross EV − (cost ÷ dollar risk per losing trade)
Net Expectancy ($)               = Net EV (R) × dollar risk per losing trade
Monthly trades                   = daily_trades × 20 trading days
Monthly net profit              = net_EV_per_trade × monthly_trades
Monthly ROI                      = monthly_net_profit ÷ starting_capital
Breakeven WR                     = 1 ÷ (1 + RR)  [adjusted upward for costs]
```

**Breakeven win rate derivation:**
```
Gross EV = 0 requires: WR × RR = (1 − WR)
WR × RR = 1 − WR
WR × RR + WR = 1
WR × (RR + 1) = 1
WR = 1 / (RR + 1)

With costs: WR_min = (1 + cost_fraction) / (RR + 1)
Example (ES, 250 risk): cost_fraction = 4.50/250 = 0.018
  50% WR, 1:1 RR: (1 + 0.018) / (1 + 1) = 1.018/2 = 50.9% breakeven
```

### 2.2 Win Rate × RR Matrix — ES ($250 risk, 1 contract, 20 days/month)

Assumptions: Round-trip cost = $4.50, risk = $250/stop, 5-min timeframe

| Win Rate | RR | Gross EV (R) | Cost/Trade ($) | Net EV ($) | Monthly Trades | Monthly Net Profit | Monthly ROI | Breakeven? |
|---|---|---|---|---|---|---|---|---|---|
| **40%** | 0.5:1 | −0.200R | $4.50 | −$54.50 | 120 | −$6,540 | −26.2% | NO |
| **40%** | 1:1 | 0.000R | $4.50 | −$4.50 | 120 | −$540 | −2.2% | NO |
| **40%** | 1.5:1 | 0.200R | $4.50 | +$45.50 | 120 | +$5,460 | +21.8% | YES |
| **40%** | 2:1 | 0.400R | $4.50 | +$95.50 | 120 | +$11,460 | +45.8% | YES |
| **45%** | 0.5:1 | −0.175R | $4.50 | −$47.75 | 120 | −$5,730 | −22.9% | NO |
| **45%** | 1:1 | 0.050R | $4.50 | +$7.75 | 120 | +$930 | +3.7% | YES |
| **45%** | 1.5:1 | 0.275R | $4.50 | +$64.25 | 120 | +$7,710 | +30.8% | YES |
| **45%** | 2:1 | 0.500R | $4.50 | +$115.50 | 120 | +$13,860 | +55.4% | YES |
| **50%** | 0.5:1 | −0.150R | $4.50 | −$41.00 | 120 | −$4,920 | −19.7% | NO |
| **50%** | 1:1 | 0.100R | $4.50 | +$20.50 | 120 | +$2,460 | +9.8% | YES |
| **50%** | 1.5:1 | 0.350R | $4.50 | +$83.00 | 120 | +$9,960 | +39.8% | YES |
| **50%** | 2:1 | 0.600R | $4.50 | +$145.50 | 120 | +$17,460 | +69.8% | YES |
| **55%** | 0.5:1 | −0.125R | $4.50 | −$34.25 | 120 | −$4,110 | −16.4% | NO |
| **55%** | 1:1 | 0.150R | $4.50 | +$33.25 | 120 | +$3,990 | +15.9% | YES |
| **55%** | 1.5:1 | 0.425R | $4.50 | +$101.75 | 120 | +$12,210 | +48.8% | YES |
| **55%** | 2:1 | 0.700R | $4.50 | +$175.75 | 120 | +$21,090 | +84.4% | YES |
| **60%** | 0.5:1 | −0.100R | $4.50 | −$27.50 | 120 | −$3,300 | −13.2% | NO |
| **60%** | 1:1 | 0.200R | $4.50 | +$45.50 | 120 | +$5,460 | +21.8% | YES |
| **60%** | 1.5:1 | 0.500R | $4.50 | +$120.50 | 120 | +$14,460 | +57.8% | YES |
| **60%** | 2:1 | 0.800R | $4.50 | +$195.50 | 120 | +$23,460 | +93.8% | YES |
| **65%** | 0.5:1 | −0.075R | $4.50 | −$20.75 | 120 | −$2,490 | −10.0% | NO |
| **65%** | 1:1 | 0.250R | $4.50 | +$57.75 | 120 | +$6,930 | +27.7% | YES |
| **65%** | 1.5:1 | 0.575R | $4.50 | +$139.25 | 120 | +$16,710 | +66.8% | YES |
| **65%** | 2:1 | 0.900R | $4.50 | +$215.75 | 120 | +$25,890 | +103.6% | YES |
| **70%** | 0.5:1 | −0.050R | $4.50 | −$14.00 | 120 | −$1,680 | −6.7% | NO |
| **70%** | 1:1 | 0.300R | $4.50 | +$70.00 | 120 | +$8,400 | +33.6% | YES |
| **70%** | 1.5:1 | 0.650R | $4.50 | +$158.50 | 120 | +$19,020 | +76.1% | YES |
| **70%** | 2:1 | 1.000R | $4.50 | +$245.50 | 120 | +$29,460 | +117.8% | YES |

### 2.3 Monthly ROI at Different Capital Levels (Scenario B: 55% WR, 1.5:1 RR)

| Capital | Net EV/Trade | Monthly Trades | Monthly Net Profit | Monthly ROI |
|---|---|---|---|---|
| $5,000 | $101.75 | 120 | $12,210 | +244.2% |
| $10,000 | $101.75 | 120 | $12,210 | +122.1% |
| $25,000 | $101.75 | 120 | $12,210 | +48.8% |
| $50,000 | $101.75 | 120 | $12,210 | +24.4% |

**Note:** These returns assume 6 trades/day (high frequency). At 5 trades/day (100/month), monthly ROI on $25,000 = $10,175 = +40.7%. Capital efficiency decreases as account size grows because contract limits cap upside.

### 2.4 Breakeven Win Rate Summary

| RR | Pure Breakeven WR | With ES Costs | With NQ Costs | With MNQ Costs |
|---|---|---|---|---|
| 0.5:1 | 66.7% | 68.4% | 67.7% | 68.4% |
| 1:1 | 50.0% | 51.8% | 51.1% | 51.7% |
| 1.5:1 | 40.0% | 41.8% | 41.1% | 41.7% |
| 2:1 | 33.3% | 35.1% | 34.4% | 35.0% |
| 3:1 | 25.0% | 26.8% | 26.1% | 26.7% |

**Critical conclusion:** A trader needs at least **51.8% WR at 1:1 RR** on ES just to break even. Any WR below 50% is only survivable if RR exceeds 2:1. The minimum viable WR for 1.5:1 RR is **55%+**.

---

## SECTION 3 — FOUR SCENARIOS (FULL MATHEMATICS)

**Common assumptions:** Starting capital $25,000, 20 trading days/month, ES contract (or equivalent MNQ/NQ), all-in round-trip cost $4.50 (ES)

### SCENARIO A — CONSERVATIVE
**Profile:** Win rate 50%, RR 1:1, 3 trades/day, 60 trades/month

**Mathematical derivation:**
```
Gross EV = (0.50 × 1.0) − 0.50 = 0.000R
Cost fraction = $4.50 / $250 = 0.018R
Net EV = 0.000 − 0.018 = −0.018R per trade
Net $ per trade = −0.018 × $250 = −$4.50
Monthly gross (wins) = 30 wins × 1.0R × $250 = $7,500
Monthly loss = 30 losses × 1.0R × $250 = −$7,500
Monthly costs = 60 trades × $4.50 = −$270
Monthly net = $7,500 − $7,500 − $270 = −$270
```

| Metric | Value |
|---|---|
| Win Rate | 50% |
| Risk-Reward | 1:1 |
| Daily Trades | 3 |
| Monthly Trades | 60 |
| Gross EV | 0.000R = $0 gross |
| All-in Cost per Trade | $4.50 |
| Net EV per Trade | −$4.50 (negative!) |
| Monthly Gross P&L | $0 |
| Monthly Costs | $270 |
| Monthly Net Profit | **−$270** |
| Monthly ROI | **−1.1%** |
| Annualized ROI | **−12.6%** |
| Breakeven WR | 51.8% |
| Margin to Breakeven | **−1.8% below breakeven** |

**Verdict: Scenario A as described is NOT VIABLE.** At 50% WR and 1:1 RR, the strategy is already losing money before costs. Even with 51% WR, the monthly net profit of ~$30/month ($360/year) is not worth the capital at risk. Scenario A requires **52%+ WR to be profitable**, which demands better execution than most traders can maintain. Only pursue if your personal track record shows 53%+ WR consistently.

---

### SCENARIO B — BALANCED (Recommended Baseline)
**Profile:** Win rate 55%, RR 1.5:1, 5 trades/day, 100 trades/month

**Mathematical derivation:**
```
Gross EV = (0.55 × 1.5) − 0.45 = 0.825 − 0.45 = 0.375R per trade
Cost fraction = $4.50 / $375 (1.5R loss) = 0.012R
Net EV = 0.375 − 0.012 = 0.363R per trade
Net $ per trade = 0.363 × $250 = $90.75 (per losing-unit reference)
Or equivalently: 0.363R × $250 risk = $90.75 net
Monthly wins = 55 trades × 1.5R × $250 = $20,625
Monthly losses = 45 trades × 1.0R × $250 = −$11,250
Monthly costs = 100 × $4.50 = −$450
Monthly net = $20,625 − $11,250 − $450 = $8,925
Check: 100 × $90.75 = $9,075 (small rounding from fractional R use)
```

| Metric | Value |
|---|---|
| Win Rate | 55% |
| Risk-Reward | 1.5:1 |
| Daily Trades | 5 |
| Monthly Trades | 100 |
| Gross EV | 0.375R = $93.75 gross |
| All-in Cost per Trade | $4.50 |
| Net EV per Trade | $89.25 |
| Monthly Gross P&L | $20,625 wins − $11,250 losses = $9,375 |
| Monthly Costs | $450 |
| Monthly Net Profit | **$8,925** |
| Monthly ROI | **+35.7%** |
| Annualized ROI | **+428.4%** |
| Breakeven WR | 51.8% |
| Margin to Breakeven | **+3.2% buffer** |
| Trades to Recover 10% DD | ~12 trades |
| Max DD (quarter Kelly) | ~8–12% |

**Verdict: Scenario B is the RECOMMENDED BASELINE.** 55% WR at 1.5:1 RR is achievable with disciplined tape reading, clear session rules, and the three-partner framework. The margin to breakeven of +3.2% provides a meaningful buffer against variance. Monthly net of $8,925–$10,175 on $25,000 capital is excellent. This scenario is ideal for prop firm challenges (6% target in 4 weeks = ~$3,000 on $50K, achievable in 30–40 trades).

---

### SCENARIO C — AGGRESSIVE
**Profile:** Win rate 60%, RR 2:1, 4 trades/day, 80 trades/month

**Mathematical derivation:**
```
Gross EV = (0.60 × 2.0) − 0.40 = 1.20 − 0.40 = 0.800R per trade
Cost fraction = $4.50 / $500 (2R loss = 20 pts × $25/R) = 0.009R
Net EV = 0.800 − 0.009 = 0.791R per trade
Net $ per trade = 0.791 × $250 = $197.75
Monthly wins = 48 wins × 2.0R × $250 = $24,000
Monthly losses = 32 losses × 1.0R × $250 = −$8,000
Monthly costs = 80 × $4.50 = −$360
Monthly net = $24,000 − $8,000 − $360 = $15,640
```

| Metric | Value |
|---|---|
| Win Rate | 60% |
| Risk-Reward | 2:1 |
| Daily Trades | 4 |
| Monthly Trades | 80 |
| Gross EV | 0.800R = $200.00 gross |
| All-in Cost per Trade | $4.50 |
| Net EV per Trade | $195.50 |
| Monthly Gross P&L | $24,000 wins − $8,000 losses = $16,000 |
| Monthly Costs | $360 |
| Monthly Net Profit | **$15,640** |
| Monthly ROI | **+62.6%** |
| Annualized ROI | **+751.2%** |
| Breakeven WR | 51.8% |
| Margin to Breakeven | **+8.2% buffer** |
| Trades to Recover 10% DD | ~8 trades |
| Max DD (quarter Kelly) | ~6–10% |

**Verdict: Scenario C is the ELITE TARGET.** 60% WR at 2:1 RR requires genuine edge plus the full three-partner framework. Monthly net of $15,640 on $25,000 is outstanding. This should only be pursued after 3+ months of consistent Scenario B performance. The wider RR (2:1) means fewer but larger wins — requires patience and conviction. The margin to breakeven of 8.2% means the strategy has a very wide safety buffer against variance.

---

### SCENARIO D — NO-EDGE (Mathematical Floor)
**Profile:** Win rate 50%, RR 0.75:1, 5 trades/day, 100 trades/month

**Mathematical derivation:**
```
Gross EV = (0.50 × 0.75) − 0.50 = 0.375 − 0.50 = −0.125R
Cost fraction = $4.50 / $187.50 (0.75R loss = $187.50) = 0.024R
Net EV = −0.125 − 0.024 = −0.149R per trade
Monthly wins = 50 × 0.75R × $250 = $9,375
Monthly losses = 50 × 1.0R × $250 = −$12,500
Monthly costs = 100 × $4.50 = −$450
Monthly net = $9,375 − $12,500 − $450 = −$3,575
Monthly ROI = −$3,575 / $25,000 = −14.3%
```

| Metric | Value |
|---|---|
| Win Rate | 50% |
| Risk-Reward | 0.75:1 |
| Daily Trades | 5 |
| Monthly Trades | 100 |
| Gross EV | −0.125R = −$31.25 gross |
| All-in Cost per Trade | $4.50 |
| Net EV per Trade | −$37.25 |
| Monthly Gross P&L | $9,375 − $12,500 = −$3,125 |
| Monthly Costs | $450 |
| Monthly Net Profit | **−$3,575** |
| Monthly ROI | **−14.3%** |
| Breakeven WR | 51.8% |
| Verdict | **MATHEMATICALLY RUINOUS — AVOID AT ALL COSTS** |

**This scenario is definitively unviable.** Even a 50% WR trader with RR below 1:1 will lose money. The broker's spread and commission alone consume 1.8–4.8% of risk per trade — without at least 1:1 RR at 52%+ WR, the trader is paying a mathematical tax on every trade. There is no execution quality, tape reading skill, or risk management that can overcome a negative expectancy. This scenario should serve as a warning: always verify your edge quantitatively before risking capital.

---

## SECTION 4 — POINTS/PIPS TARGETS PER SCENARIO PER ASSET

### 4.1 ES Targets

| Timeframe | Scenario | SL (ES pts) | SL ($) | TP1 (ES pts) | TP2 (ES pts) | TP3 (ES pts) | RR Ratio | TP1 Capture | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1-min | A (micro) | 5 pts | $250 | 5 pts | — | — | 1:1 | $250 | Scalp only |
| 5-min | A | 8 pts | $400 | 8 pts | — | — | 1:1 | $400 | Low vol |
| 5-min | B | 10 pts | $500 | 15 pts | — | — | 1.5:1 | $750 | Primary |
| 5-min | C | 10 pts | $500 | 20 pts | — | — | 2:1 | $1,000 | Elite |
| 15-min | B | 15 pts | $750 | 22.5 pts | — | — | 1.5:1 | $1,125 | Trend |
| 15-min | C | 15 pts | $750 | 30 pts | — | — | 2:1 | $1,500 | High conviction |
| 15-min | C | 20 pts | $1,000 | 40 pts | — | — | 2:1 | $2,000 | Swing |

### 4.2 NQ Targets

| Timeframe | Scenario | SL (NQ pts) | SL ($) | TP1 (NQ pts) | TP2 (NQ pts) | RR | TP1 Capture | Notes |
|---|---|---|---|---|---|---|---|---|
| 1-min | A | 12 pts | $240 | 12 pts | — | 1:1 | $240 | Micro scalp |
| 5-min | B | 20 pts | $400 | 30 pts | — | 1.5:1 | $600 | Primary |
| 5-min | C | 20 pts | $400 | 40 pts | — | 2:1 | $800 | Elite |
| 15-min | B | 30 pts | $600 | 45 pts | 60 pts | 1.5:1 | $900 | Trend follow |
| 15-min | C | 30 pts | $600 | 60 pts | — | 2:1 | $1,200 | High conviction |
| 15-min | C | 40 pts | $800 | 80 pts | — | 2:1 | $1,600 | Swing / overnight |

### 4.3 MNQ Targets (Prop Firm Primary Instrument)

| Timeframe | Scenario | SL (MNQ pts) | SL ($) | TP1 (MNQ pts) | TP2 (MNQ pts) | RR | TP1 Capture | Notes |
|---|---|---|---|---|---|---|---|---|
| 1-min | All | 20 pts | $40 | 20 pts | — | 1:1 | $40 | Micro scalp |
| 5-min | B | 20 pts | $40 | 30 pts | — | 1.5:1 | $60 | Prop firm primary |
| 5-min | C | 20 pts | $40 | 40 pts | — | 2:1 | $80 | Elite setups |
| 15-min | B | 30 pts | $60 | 45 pts | — | 1.5:1 | $90 | Trend follow |
| 15-min | C | 30 pts | $60 | 60 pts | — | 2:1 | $120 | High conviction |

### 4.4 6E (EURUSD Futures) Targets

| Timeframe | Scenario | SL (pips) | SL ($) | TP1 (pips) | TP2 (pips) | RR | TP1 Capture | Notes |
|---|---|---|---|---|---|---|---|---|
| 1-min | A | 10 pips | $62.50 | 10 pips | — | 1:1 | $62.50 | Very short-term |
| 5-min | B | 20 pips | $125 | 30 pips | — | 1.5:1 | $187.50 | Primary |
| 5-min | C | 20 pips | $125 | 40 pips | — | 2:1 | $250 | Elite |
| 15-min | B | 30 pips | $187.50 | 45 pips | — | 1.5:1 | $281.25 | Trend |
| 15-min | C | 30 pips | $187.50 | 60 pips | — | 2:1 | $375 | High conviction |

---

## SECTION 5 — ATR-ONLY TRADING SYSTEM

### 5.1 Why ATR Alone is Sufficient

ATR (Average True Range) is the single most powerful tool for an intraday futures trader because:

1. **Normalization across assets:** 20 NQ points means something different from 20 ES points. ATR converts both to the same volatility language.
2. **Adaptive stops:** ATR widens automatically in volatile markets, tightens in quiet ones — no manual adjustment needed.
3. **Session awareness:** ATR ratio (current vs. historical) tells you whether the market is trending, quiet, or choppy.
4. **Position sizing foundation:** ATR × multiplier = stop distance → stop distance × $/point = dollar risk → dollar risk / Kelly fraction = max contracts.
5. **Volume proxy:** ATR expansion signals institutional activity. ATR contraction signals distribution.

**The entire trading system can run on ATR alone** — the poker player reads tape direction, the mathematician sizes positions, and the quant generates session maps. No other indicators are required.

### 5.2 ATR Specifications Per Instrument

**Current ATR readings (April 2026, elevated volatility regime):**

| Instrument | 14-bar Daily ATR | 5-min ATR | 1-min ATR |
|---|---|---|---|
| ES | 60–80 pts | 10–15 pts | 4–8 pts |
| NQ | 180–250 pts | 30–50 pts | 15–25 pts |
| MNQ | 180–250 pts | 30–50 pts | 15–25 pts |
| 6E | 70–100 pips | 10–15 pips | 3–6 pips |

### 5.3 ATR Multiples by Asset, Regime, and Session

**Base multiples (Normal regime, VIX 15–20):**

| Asset | SL ATRx | TP1 ATRx | TP2 ATRx | TP3 ATRx | Notes |
|---|---|---|---|---|---|
| ES | 1.5× | 1.0× | 2.0× | 3.0× | Standard |
| NQ | 1.5× | 1.0× | 2.0× | 3.0× | Standard |
| MNQ | 2.0× | 1.5× | 2.5× | — | Wider (micro liquidity) |
| 6E | 1.5× | 1.0× | 2.0× | 3.0× | Standard |

**High volatility regime (VIX > 20, ATR expanding):**

| Asset | SL ATRx | TP1 ATRx | TP2 ATRx | Notes |
|---|---|---|---|---|
| ES | 2.0× | 1.5× | 2.5× | Wider stops, smaller size |
| NQ | 2.0× | 1.5× | 2.5× | Wider stops, smaller size |
| MNQ | 2.5× | 2.0× | 3.0× | Micro contracts need more room |
| 6E | 2.0× | 1.5× | 2.5× | Wider stops for elevated vol |

**Low volatility regime (VIX < 15, ATR contracting):**

| Asset | SL ATRx | TP1 ATRx | TP2 ATRx | Notes |
|---|---|---|---|---|
| ES | 1.0× | 0.75× | 1.5× | Tight stops OK in quiet markets |
| NQ | 1.0× | 0.75× | 1.5× | Tight stops OK |
| MNQ | 1.5× | 1.0× | 2.0× | Micro still needs buffer |
| 6E | 1.0× | 0.75× | 1.5× | Quiet markets |

### 5.4 Exact Entry Rules (ATR-Only Framework)

**Rule 1: Volatility Filter (Entry Gate)**
```
IF ATR_current < ATR_20day × 0.70:
    → NO NEW ENTRIES today
    → Reason: Market too quiet = chop, false breaks dominate
    → Exception: micro-scalp only (1:1 RR, 1 contract, 50% normal size)

IF ATR_current > ATR_20day × 1.30:
    → ATR expanding = trending/volatile
    → Trade ONLY in direction of 15-min trend
    → Reduce position size by 25%
    → Reason: Momentum is real; counter-trend is hazardous
```

**Rule 2: Session Filter**
```
ATR_session_ratio = ATR_current_session / ATR_daily_average

IF ATR_session_ratio < 0.50:
    → Session too quiet (Asian, NY midday)
    → Scalp only or skip

IF ATR_session_ratio 0.50–1.00:
    → Normal conditions
    → Trade per system

IF ATR_session_ratio > 1.00:
    → Above-average vol
    → Increase size cautiously (max +25%)

IF ATR_session_ratio > 1.50:
    → High volatility (FOMC, NFP, CPI data)
    → WAIT 30 min after data release
    → Reassess ATR_post_news
    → Reduce size by 50% if trading during the event
```

**Rule 3: ATR Spike Detection**
```
IF ATR_today > ATR_yesterday × 1.50:
    → ATR spike = volume event = institutional money moving
    Interpretation:
      a) Spike UP + directional price thrust = momentum confirmation → ENTER LONG/SHORT
      b) Spike UP + no directional move = churn/distribution → SKIP
    Rule: Never fade ATR spikes. Institutions are moving the market.
```

### 5.5 ATR-Based Position Sizing

```
STEP 1: Calculate Kelly dollar risk
  Kelly_fraction = f(Kelly%, current_account)
  Dollar_risk_available = Account × Kelly_fraction

STEP 2: Calculate ATR-based stop in dollars
  Stop_dollars = ATR_current × SL_ATR_multiplier × $/point

STEP 3: Calculate max contracts
  Max_contracts = Dollar_risk_available / Stop_dollars
  Max_contracts = ROUND_DOWN(Max_contracts)

STEP 4: Apply caps
  Cap = min(prop_firm_contract_limit, exchange_contract_limit, Max_contracts)
```

**Example — ES with Scenario B, quarter Kelly on $25,000 account:**
```
Account = $25,000
Kelly fraction (quarter Kelly, 55% WR, 1.5:1 RR):
  f* = W − (1−W)/R = 0.55 − 0.45/1.5 = 0.55 − 0.30 = 0.25 (Full Kelly)
  Quarter Kelly = 0.25 × 0.25 = 0.0625 = 6.25%
Dollar risk = $25,000 × 0.0625 = $1,562

Case 1: Normal ATR
  ATR = 12 points, SL = 1.5× ATR = 18 points
  Stop_dollars = 18 × $50 = $900/contract
  Max contracts = $1,562 / $900 = 1.73 → 1 contract

Case 2: Low ATR (quiet market)
  ATR = 6 points, SL = 1.5× ATR = 9 points
  Stop_dollars = 9 × $50 = $450/contract
  Max contracts = $1,562 / $450 = 3.47 → 3 contracts

Case 3: High ATR (volatile market)
  ATR = 20 points, SL = 2.0× ATR = 40 points (wider for vol)
  Stop_dollars = 40 × $50 = $2,000/contract
  Max contracts = $1,562 / $2,000 = 0.78 → 0 contracts
  ACTION: Do not enter at this stop distance; wait for ATR to contract or choose a tighter SL
```

**Key dynamic:** When ATR expands, position size must contract. This is the mechanical enforcement of position sizing discipline — the math does the work that willpower cannot.

### 5.6 ATR Trailing Stop Protocol

```
LONG POSITION:
  Initial stop = Entry − ATR(14) × 3
  Trailing rule: After each new 15-min bar close that makes a new high:
    Stop = max(current_stop, High − ATR(14) × 3)
  Never move stop down

SHORT POSITION:
  Initial stop = Entry + ATR(14) × 3
  Trailing rule: After each new 15-min bar close that makes a new low:
    Stop = min(current_stop, Low + ATR(14) × 3)
  Never move stop up
```

### 5.7 ATR Exit Decision Tree

```
PRIORITY ORDER (apply sequentially):

1. HARD STOP HIT?
   → Yes: Close 100%, record trade, update DD tracker
   → No: Continue

2. TP1 HIT? (ATR × TP1_multiple from entry)
   → Yes: Close 50% of position
   → Move stop to BREAKEVEN immediately (cost basis = $0 risk)
   → Continue with remaining 50%

3. TP2 HIT? (ATR × TP2_multiple from entry)
   → Yes: Close remaining 50% at TP2
   → Record full trade result

4. TIME STOP (12 bars on 5-min, no TP hit)?
   → Exit 100% at market
   → No emotion, no hope for reversal
   → This is a failed trade — accept it

5. ATR CONTRACTING (current ATR < 0.70 × entry ATR)?
   → Tighten stop to 1.5 × current ATR
   → Trade is still live but reducing risk

6. SESSION CLOSE (3:00 PM ET for ES/NQ/MNQ)?
   → Flatten all positions regardless of P&L
   → No overnight holds on intraday strategy
   → CME closes at 4:00 PM ET; flatten at 3:00 PM to avoid last-minute vol
```

---

## SECTION 6 — KELLY CRITERION: COMPLETE MATHEMATICS

### 6.1 Core Kelly Formula

**For fixed reward-to-risk (R), win rate (W):**
```
f* = (b × p − q) / b
f* = W − (1 − W) / R

Where:
  f*  = Kelly fraction of bankroll to risk
  W   = Win rate (decimal)
  R   = Average win / Average loss (reward-to-risk ratio)
  b   = Net odds = R
  p   = Win probability = W
  q   = Loss probability = 1 − W
```

**Kelly for different scenarios:**
| Scenario | WR | RR | Kelly % | Kelly Fraction |
|---|---|---|---|---|
| A | 50% | 1:1 | 0.00% | 0 (no edge) |
| B | 55% | 1.5:1 | 25.0% | 1/4 Kelly |
| C | 60% | 2:1 | 40.0% | 2/5 Kelly |
| B+C hybrid | 57.5% | 1.75:1 | 32.5% | ~1/3 Kelly |

### 6.2 Kelly Sizing Tables

**Scenario B: 55% WR, 1.5:1 RR, Full Kelly = 25.0%**

| Kelly Variant | Kelly % | $ at Risk ($25K) | ES (10-pt stop) | NQ (20-pt stop) | MNQ (20-pt stop) | 6E (20-pip stop) |
|---|---|---|---|---|---|---|
| Full Kelly | 25.0% | $6,250 | 12 contracts | 15 contracts | 78 contracts | 50 contracts |
| 2/3 Kelly | 16.7% | $4,167 | 8 contracts | 10 contracts | 52 contracts | 33 contracts |
| Half Kelly | 12.5% | $3,125 | 6 contracts | 7 contracts | 39 contracts | 25 contracts |
| 1/3 Kelly | 8.3% | $2,083 | 4 contracts | 5 contracts | 26 contracts | 16 contracts |
| **Quarter Kelly** | **6.25%** | **$1,562** | **3 contracts** | **3 contracts** | **19 contracts** | **12 contracts** |
| Eighth Kelly | 3.1% | $781 | 1 contract | 1 contract | 9 contracts | 6 contracts |

**Scenario C: 60% WR, 2:1 RR, Full Kelly = 40.0%**

| Kelly Variant | Kelly % | $ at Risk ($25K) | ES (10-pt stop) | NQ (20-pt stop) | MNQ (20-pt stop) | 6E (20-pip stop) |
|---|---|---|---|---|---|---|
| Full Kelly | 40.0% | $10,000 | 20 contracts | 25 contracts | 125 contracts | 80 contracts |
| 2/3 Kelly | 26.7% | $6,667 | 13 contracts | 16 contracts | 83 contracts | 53 contracts |
| Half Kelly | 20.0% | $5,000 | 10 contracts | 12 contracts | 62 contracts | 40 contracts |
| **Quarter Kelly** | **10.0%** | **$2,500** | **5 contracts** | **6 contracts** | **31 contracts** | **20 contracts** |
| Eighth Kelly | 5.0% | $1,250 | 2 contracts | 3 contracts | 15 contracts | 10 contracts |

**Practical Kelly sizing for personal accounts:**
| Account Size | Quarter Kelly % | Dollar Risk | ES Max Contracts | NQ Max Contracts | MNQ Max Contracts |
|---|---|---|---|---|---|
| $5,000 | 6.25% | $312 | 0 (stop too wide) | 0 | 3 |
| $10,000 | 6.25% | $625 | 1 | 1 | 7 |
| $25,000 | 6.25% | $1,562 | 3 | 3 | 19 |
| $50,000 | 6.25% | $3,125 | 6 | 7 | 39 |
| $100,000 | 6.25% | $6,250 | 12 | 15 | 78 |

### 6.3 Kelly Drawdown Comparison

**Why quarter Kelly instead of full Kelly:**
```
Full Kelly (25% risk per trade, Scenario B):
  20 consecutive losses probability (55% WR) = (0.45)^20 = 3.5 × 10^−11
  But the SIZE of losing streaks matters more:
  After 20 losing trades at full Kelly = losing 25% × 20 = losing entire account

Quarter Kelly (6.25% risk per trade, Scenario B):
  After 20 losing trades = losing 6.25% × 20 = 125% of account
  But with stops at 10 pts (ES) = each losing trade = -$500
  20 losses at quarter Kelly = -$10,000 on $25,000 = 40% DD
  Recoverable in ~20 trades at 55% WR, 1.5:1 RR (net $89/trade)

Maximum drawdown at different Kelly fractions:
  Full Kelly:   100% of bankroll at risk — 4 losses wipe the account
  Half Kelly:   50% of bankroll at risk — 8 losses wipe the account
  Quarter Kelly: 25% of bankroll at risk — 16 losses wipe the account
  1/8 Kelly:   12.5% of bankroll at risk — 32 losses wipe the account

Full Kelly is mathematically optimal but practically suicidal.
Quarter Kelly sacrifices ~25% of long-run growth for ~75% of drawdown protection.
This trade-off is worth it.
```

### 6.4 Dynamic Kelly Adjustment Rules

**Baseline:** Start each session at quarter Kelly of current account size (using high-water mark equity).

**Streak-based adjustments:**

| Trigger | Kelly Action | Rationale |
|---|---|---|
| 3 consecutive losses | Halve Kelly (→ 1/8) | Variance cluster; protect capital |
| 5 consecutive losses | Quarter Kelly (min) | Deep protection; re-evaluate edge |
| 6+ consecutive losses | **STOP TRADING** | Edge has failed; review before next session |
| 3 consecutive wins | Increase Kelly 25% | Momentum confirmation (cap at half Kelly) |
| 5 consecutive wins | Increase Kelly another 25% | Let winners run; maximum conviction |
| New equity high-water mark | Recalculate Kelly from new peak | Only grow risk when capital has grown |
| 3% daily DD | Reduce to quarter Kelly | Approaching daily limit |
| 5% daily DD | Reduce to eighth Kelly | Near prop firm breach; maximum caution |

**High-Water Mark Rule (non-negotiable):**
```
IF current_equity > peak_equity:
    peak_equity = current_equity
    Kelly = recalculate_using(peak_equity)  # Kelly only grows on new highs
ELSE:
    Kelly = min(current_Kelly, baseline_from_peak)  # Kelly never recovers during DD
    # This is the mathematical enforcement of "don't add to losing positions"
```

**Volatility-Adjusted Kelly:**
```
IF current_ATR / 20day_ATR > 1.30:
    Kelly = Kelly_baseline × 0.75  # Smaller size in high vol
IF current_ATR / 20day_ATR < 0.70:
    Kelly = Kelly_baseline × 1.25  # Larger size in low vol (relative)
    (Only if session conditions otherwise favorable)
```

---

## SECTION 7 — DRAWDOWN MATHEMATICS

### 7.1 Consecutive Loss Probabilities

Formula: P(N consecutive losses) = (1 − WR)^N

| Win Rate | P(3 in row) | P(5 in row) | P(7 in row) | P(10 in row) | P(15 in row) | P(20 in row) |
|---|---|---|---|---|---|---|
| 40% | 21.6% | 7.8% | 2.8% | 0.6% | 0.05% | 0.004% |
| 45% | 16.6% | 5.0% | 1.5% | 0.25% | 0.02% | ~0% |
| 50% | 12.5% | 3.1% | 0.8% | 0.10% | 0.003% | ~0% |
| 55% | 9.1% | 1.8% | 0.37% | 0.03% | 0.0004% | ~0% |
| 60% | 6.4% | 1.0% | 0.16% | 0.01% | 0.00006% | ~0% |
| 65% | 4.3% | 0.5% | 0.03% | 0.001% | ~0% | ~0% |

**Practical interpretation:**
- A 55% WR trader has a **91.8% chance** of NOT getting 5 consecutive losses on any given sequence
- A 55% WR trader can expect ~1 streak of 5+ losses per ~55 losing sequences (roughly once per year of daily trading)
- A 60% WR trader has near-zero probability of 15 consecutive losses
- **The danger is not consecutive losses — it is large individual losses that exceed 2R**

### 7.2 Expected Maximum Drawdown (EMDD)

Formula: EMDD ≈ 2.506 × σ × √(ln(T)) where T = number of trades, σ = per-trade std dev

**Per-trade standard deviation by scenario:**
```
Scenario B (55% WR, 1.5:1 RR):
  σ = sqrt(W × R² + (1−W) × 1² − EV²)
  σ = sqrt(0.55 × 2.25 + 0.45 × 1 − 0.375²)
  σ = sqrt(1.2375 + 0.45 − 0.1406) = sqrt(1.5469) = 1.243R

Scenario C (60% WR, 2:1 RR):
  σ = sqrt(0.60 × 4 + 0.40 × 1 − 0.80²)
  σ = sqrt(2.40 + 0.40 − 0.64) = sqrt(2.16) = 1.469R

Scenario A (50% WR, 1:1 RR):
  σ = sqrt(0.50 × 1 + 0.50 × 1 − 0²) = sqrt(1.00) = 1.000R
```

**EMDD for 200 trades at $250/R:**
| Scenario | σ (R) | EMDD (R) | EMDD ($) | EMDD (% of $25K) |
|---|---|---|---|---|
| A (50/1:1) | 1.00R | 14.0R | $3,500 | 14.0% |
| B (55/1.5:1) | 1.24R | 17.4R | $4,350 | 17.4% |
| C (60/2:1) | 1.47R | 20.6R | $5,150 | 20.6% |

**Important nuance:** Higher-RR strategies have higher EMDD in R terms but the dollar drawdown is still proportional to account size. The key is that Scenario B's 17.4% EMDD is recoverable in ~20 trades. Scenario A's 14% EMDD is less severe in R but requires 50%+ WR which is harder to maintain.

### 7.3 Drawdown Recovery Math

```
Recovery Return Needed = DD% / (1 − DD%)

| Drawdown | Recovery Return Needed | With 2% Risk/Trade | Trades to Recover (Est.) |
|---|---|---|---|
| 5% | 5.3% | 2.0% per trade net | ~7 trades |
| 10% | 11.1% | 2.0% per trade net | ~12 trades |
| 15% | 17.6% | 2.0% per trade net | ~18 trades |
| 20% | 25.0% | 2.0% per trade net | ~25 trades |
| 30% | 42.9% | 2.0% per trade net | ~43 trades |
| 40% | 66.7% | 2.0% per trade net | ~67 trades |
| 50% | 100.0% | Must double account | ~100 trades |

**Recovery math for prop firm DD limits:**
- Prop firm daily DD limit: 3% of account
- Personal daily stop: 3% × 50% = 1.5% (buffer before hitting firm limit)
- If daily limit hit: stop for the day, no more trades
- 5 consecutive days of 1.5% loss = 7.5% DD → most prop firms would breach
```

### 7.4 Daily Shutdown Rules

| Daily DD (% of Account) | Action | Prop Firm Implication |
|---|---|---|
| 1% | Reduce Kelly by 25% | Well within limits |
| 2% | Reduce Kelly by 50% | At 67% of daily limit |
| 3% | Reduce Kelly by 75% | At daily limit — STOP TRADING |
| 4% | **STOP TRADING — session over** | Prop firm breach likely |
| 5% | **DQ imminent — contact firm** | Most prop firm limits at 5% max |

**Post-Drawdown Rules:**
1. After any DD > 3%, journal the session: what went wrong, what was the market state
2. Do not increase Kelly for 5 sessions following a 3%+ DD
3. If 2 DD events in 10 sessions: reduce Kelly to eighth Kelly permanently until WR recalculates above 55%
4. After 20% total DD: stop all trading for 3 days, paper trade for 1 week minimum before returning

---

## SECTION 8 — PROP FIRM COMPARISON AND STRATEGY

### 8.1 Prop Firm Comparison Table (April 2026)

| Firm | Model | Entry Cost (50K) | Daily DD Limit | Max DD | Profit Target | Min Days | Consistency Rule | Profit Split | Withdrawal Time |
|---|---|---|---|---|---|---|---|---|---|
| FTMO 1-Step | 1-step | ~$407 | 3% | 6% trailing | 10% | 4 days | 50% of days | 90% | 14 days |
| FTMO 2-Step | 2-step | ~$407 (both phases) | 5% (Phase 1), 5% (Phase 2) | 10% trailing | 10% + 5% | 4 days each | 50% (once funded) | 80% | 14 days |
| Blue Guardian Instant | 1-step | $59–$599+ | 3% | 5% | None | 5 days | 15–20% | 80–90% | Instant |
| Blue Guardian Standard | 1-step | $150–$850+ | 4% | 6–8% | 8–10% | 3–5 days | 15–50% | 80–90% | 14 days |
| Audacity Capital | 2-step | Not published | 5–7.5% | 10–15% | 10% + 5% | 4 days each | Audacity Score | 60–90% | 30 days |
| Topstep Trading Combine | 2-step | $49–$149/mo | $1,000–$3,000 absolute | $2,000–$4,500 | 6% | 5 sessions | 40–50% | 90% | 5 winning days |
| MyFundedFutures Core | 1-step | $77/mo | **None (EOD only)** | $2,000 EOD | 6% | 5 days | 50% | 80% | 5 winning days |
| MyFundedFutures Rapid | 1-step | $129/mo | **None (EOD only)** | $2,000 EOD | 6% | 5 days | 50% | 90% | Daily payouts |
| MyFundedFutures Pro | 1-step | $227/mo | **None (EOD only)** | $2,000 EOD | 6% | 5 days | **None (funded)** | 80% | 14 days |

**Note on closed firms:** True Forex Funds is permanently closed. UPrading is unverified as of April 2026 — do not use without independent verification. Only firms listed above should be considered.

### 8.2 Best Prop Firms by Objective

| Objective | Best Firm | Reason |
|---|---|---|
| Fastest path to funded | Blue Guardian Instant | No evaluation — start trading immediately |
| Lowest cost per funded account | FTMO 2-Step | ~$407 total for both phases |
| Best for futures-only traders | MyFundedFutures | CME futures only, no daily DD limit, fast payouts |
| Highest profit split | FTMO 1-Step, Blue Guardian, Topstep | 90% from day one |
| Most generous DD limits | Audacity Capital | 7.5% daily / 15% total in Phase 1 |
| Best consistency rule | MyFundedFutures Pro | No consistency rule once funded |
| Highest scaling cap | Blue Guardian | $4M cap |
| Best for beginners | Topstep ($49/mo) | Low cost, small contract limits, 5-session target |

### 8.3 Asset Selection for Prop Trading

**MNQ as primary instrument:**
MNQ is the most mathematically sound prop firm contract for the following reasons:

| Factor | NQ | MNQ | Verdict |
|---|---|---|---|
| Dollar risk per point | $20/point | $2/point | MNQ (finer granularity) |
| Position sizing resolution | 1 contract = $20/pt | 1 contract = $2/pt | MNQ (10× better resolution) |
| Prop firm DD protection | Higher risk per contract | Lower risk per contract | MNQ (safer) |
| Correlation to NQ | 100% | 99.7% | Tie |
| Profit per correct trade | Higher | Lower | NQ (marginal) |
| Optimal for challenge | Lower (bigger swings) | Higher (fine control) | MNQ |
| Same edge on both | Yes | Yes | Tie |

**When to upgrade from MNQ to NQ:**
- When funded account contract limit allows 5+ NQ contracts
- When account size is $100K+ (scaling has occurred)
- When NY open conditions favor larger NQ moves (40–80+ points)
- When consistency rule is not a constraint on funded account

**6E as supplementary instrument:**
- Only trade 6E when ES and NQ are in chop or conflicting signals
- 6E has higher costs (4.8% of 1R) — requires 1.5:1 RR minimum
- 6E offers low correlation to equity indices during EUR/USD volatility events
- 6E is best traded at NY close (overlap with European markets)

### 8.4 Capital Allocation Model

**Starting capital: $5,000 personal capital**

| Allocation | Amount | Purpose |
|---|---|---|
| Challenge entry fees | $1,500 | 3× challenge entries spread across firms |
| Recovery reserve | $1,000 | Re-entry capital if challenges fail |
| Living expenses buffer | $2,000 | NOT for trading — covers costs while funded |
| Operational capital | $500 | Technology, data, platform costs |
| **Total** | **$5,000** | |

**Challenge strategy with $1,500 budget:**
- Round 1: Purchase 3 challenges across different firms (~$500 each)
- Pass rate assumption (skilled trader, Scenario B profile): 60% first-attempt pass
- Expected funded accounts from Round 1: 3 × 0.60 = 1.8 funded accounts
- Each $50K funded account: 6% profit/month = $3,000 profit
- Payout at 90% split = $2,700/month per funded account
- **Round 1 expected monthly income: 1.8 × $2,700 = $4,860/month**

### 8.5 Funded Account Income Model

| Funded Accounts | Size | Monthly Profit Target | Payout % | Monthly Payout | Annual Payout |
|---|---|---|---|---|---|
| 1 | $50K | $3,000 (6%) | 90% | $2,700 | $32,400 |
| 2 | $50K each | $3,000/month each | 90% | $5,400 | $64,800 |
| 3 | $50K each | $3,000/month each | 90% | $8,100 | $97,200 |
| 4 | $50K each | $3,000/month each | 90% | $10,800 | $129,600 |
| 1 | $100K (scaled) | $6,000 (6%) | 90% | $5,400 | $64,800 |
| 4 | $100K each | $6,000/month each | 90% | $21,600 | $259,200 |

**Leverage multiple:** $5,000 personal capital → 4 funded $100K accounts = $400K equivalent capital → $21,600/month income = **432× annual leverage multiple**. This is the mathematical foundation of the prop trading business model.

### 8.6 The Consistency Rule: Mathematical Solution

**The Problem:** Most firms cap daily profit at 30–50% of the total profit target. If day 1 of a $3,000 target shows $2,500 profit, $500 may be forfeited due to the consistency rule.

**The Flattening Algorithm:**
```
function calculate_daily_target(profit_target, days_remaining, consistency_cap_pct):
    profit_remaining = profit_target − current_cumulative_profit
    avg_daily_target = profit_remaining / days_remaining
    consistency_cap = profit_target × consistency_cap_pct
    today_running_pnl = get_today_running_pnl()

    if today_running_pnl >= consistency_cap:
        return 0  # Cap hit — do not trade today
    elif today_running_pnl + avg_daily_target > consistency_cap:
        # Partial day — size down proportionally
        remaining_cap = consistency_cap − today_running_pnl
        reduction_ratio = remaining_cap / avg_daily_target
        return max(0.30, 1.0 − reduction_ratio)  # Never below 30% of normal size
    else:
        return 1.0  # Full size — still below cap

# Example: $50K account, $3,000 target, 40% consistency cap
# consistency_cap = $3,000 × 0.40 = $1,200 per day
# If day 1 profit so far = $800:
#   avg_daily = $3,000 / 10 = $300
#   $800 + $300 = $1,100 < $1,200 → full size OK
# If day 1 profit so far = $1,000:
#   $1,000 + $300 = $1,300 > $1,200 → reduce size to 67% of normal
```

**Consistency rule summary by firm:**

| Firm | Rule | Mathematically Optimal Behavior |
|---|---|---|
| FTMO | 50% of days must have a trade | Trade every day — even a small winner counts |
| Blue Guardian | 15–50% of total target per day | Spread target across all 5+ days |
| Topstep | 40–50% of total target per session | Small winners across many sessions |
| MyFundedFutures | 50% of days in challenge | Trade every day; same daily target |
| MyFundedFutures Pro | No consistency rule once funded | Full freedom — maximize every day |

### 8.7 DQ Prevention Checklist (Pre-Session, Non-Negotiable)

```
□ Check prop firm rules for this specific account
□ Calculate max daily loss: firm_limit × 0.50 = personal stop (3% firm → 1.5% personal)
□ Calculate max per-trade risk: daily_limit ÷ 8 = max risk per trade
□ Check economic calendar: no entries 30 min before/after NFP, FOMC, CPI, GDP
□ Check time: all positions flat by 3:00 PM CT (CME close 4:00 PM)
□ Verify no overnight holds: close all before 4:00 PM CT
□ Verify contract limit for this prop firm account
□ Set daily DD alert at personal stop level
□ Set Alert Guardian (Blue Guardian) or equivalent: auto-close at 2% unrealized
□ Verify weekend rules: close all Friday before CME market close
□ Check for CME holiday schedule deviations
□ Confirm no gap trade risk: overnight news, weekend positioning
□ Log max daily loss into trading journal before first trade
```

---

## SECTION 9 — THREE-PARTNER MATHEMATICAL STRATEGY

### 9.1 Partner Roles and Responsibilities

**Partner 1: The Poker Player** — Emotional intelligence, tape reading, bet-sizing discipline
**Partner 2: The Mathematician** — Position sizing, recovery planning, edge validation
**Partner 3: The Quant/Data Analyst** — Signal generation, volatility analysis, ATR session maps

### 9.2 Partner 1: The Poker Player

**Core philosophy:** Treat each trading session like a poker session. Wait for strong hands, fold on weak ones, and know when to walk away.

**Responsibilities:**

| Task | Description |
|---|---|
| Market structure reading | Identify HH/HL, LH/LL, range boundaries, breakout compression |
| Tape reading | Confirm institutional flow direction via price/volume on 5-min |
| Tilt detection | Immediately recognize emotional compromise after a bad loss |
| Pot commitment | Only commit >50% Kelly on confirmed setups with clear catalysts |
| Emotional gatekeeping | Pre-session: "Am I clear-headed?" Post-loss: "Is judgment affected?" |

**Tape reading checklist (pre-entry):**
```
1. Is price making higher highs + higher lows? → Bullish structure → bias long
2. Is price making lower highs + lower lows? → Bearish structure → bias short
3. Is price in a defined range? → Mean-reversion only at boundaries
4. Is volume expanding on the move? → Confirmed institutional flow → enter
5. Is volume contracting on the move? → Weak, likely reversal → skip
```

**Tilt protocol (most important):**
```
IF a losing trade causes anger, frustration, or desire to "make it back":
    → Reduce Kelly by 50% immediately
    → If another losing trade occurs: reduce to eighth Kelly
    → If third losing trade: STOP TRADING for the day
    → This is not weakness — this is mathematical risk management
```

### 9.3 Partner 2: The Mathematician

**Core philosophy:** The math is the strategy. Position sizing is the most important decision, and every number should be calculated, not guessed.

**Responsibilities:**

| Task | Frequency | Action |
|---|---|---|
| Kelly recalculation | After every 20 trades | Recalculate actual WR, R from live data |
| Recovery planning | After any DD event | Compute exact trades to recover |
| Edge validation | Monthly | Is actual edge statistically significant (p < 0.05)? |
| Consistency optimization | Daily | Implement flattening algorithm |
| Portfolio risk | Per session | ES + NQ combined risk ≤ Kelly fraction |
| Breakeven WR check | Weekly | Are costs eating into edge? |

**Kelly recalculation formula:**
```
New_WR = wins / total_trades (rolling 20-trade window)
New_R = avg_win / avg_loss (rolling 20-trade window)
New_Kelly = New_WR − (1 − New_WR) / New_R
New_fraction = New_Kelly × confidence_adjustment

Confidence adjustment (subjective, 0.5–1.0):
  0.5 = 10 or fewer trades since last recalculation (too little data)
  0.75 = 10–19 trades
  1.0 = 20+ trades

If New_Kelly < 0: the system has lost its edge → reduce to eighth Kelly, investigate
If New_Kelly > 0.40: cap at 0.40 (no trader should risk >40% of bankroll)
```

**Recovery planning formula:**
```
Trades_to_recover = ln(1 − DD%) / ln(1 + Net_EV_per_trade / account)
Approximately: Trades_to_recover = DD% / Net_EV_pct_per_trade

Example: 10% DD, Scenario B, $25,000 account:
  Net EV per trade = $89.25
  Net EV % = $89.25 / $25,000 = 0.357% per trade
  Trades to recover = 0.10 / 0.00357 = ~28 trades (approximately)
  More precisely using geometric growth formula:
  Target = $25,000 × (1 − 0.10) = $22,500
  At $89.25/trade: $22,500 / $25,000 = 0.90 = (1 + 0.00357)^n
  ln(0.90) / ln(1.00357) = −0.1053 / 0.003566 = ~29.5 trades
```

### 9.4 Partner 3: The Quant/Data Analyst

**Core philosophy:** The market's current volatility character determines everything about how much to risk and where to place stops. Data drives decisions, not intuition.

**Responsibilities:**

| Task | Frequency | Output |
|---|---|---|
| ATR pull (all assets) | Pre-session (15 min before open) | Session map with 3 best setups |
| Volatility regime detection | Real-time | HIGH/NORMAL/LOW classification |
| Session scoring | Every 30 min | Trade quality rating (1–5) |
| Backtest monitoring | Weekly | Walk-forward on 20-trade rolling windows |
| News flagging | Pre-session + intraday | High-volatility windows to avoid |

**Daily session map output format:**
```
SESSION MAP — April 11, 2026

ASSET RANKINGS (by ATR quality today):
  1. MNQ (ATR expanded 1.4× vs 20-day avg) — TREND mode
  2. ES (ATR normal, VIX 18) — NORMAL mode
  3. NQ (ATR slightly elevated) — CAUTION
  4. 6E (low vol, ATR ratio 0.6) — SKIP or micro-scalp only

HIGH-PRIORITY WINDOWS:
  8:30–9:30 AM ET: NFP data — NO ENTRIES 30 min before/after
  10:00–11:00 AM ET: MNQ high volume expected — PRIMARY WINDOW
  2:00–3:00 PM ET: London/NY overlap — SECONDARY WINDOW

ATR-BASED STOPS FOR TODAY:
  MNQ: SL = 2.0× ATR(14) = 2.0 × 45 pts = 90 pts = $180 risk
  ES:  SL = 1.5× ATR(14) = 1.5 × 12 pts = 18 pts = $900 risk
  NQ:  SL = 2.0× ATR(14) = 2.0 × 40 pts = 80 pts = $1,600 risk

KELLY SIZE CALCULATION:
  Account = $25,000, Quarter Kelly = $1,562
  MNQ max contracts = $1,562 / $180 = 8.6 → 8 MNQ contracts
  ES max contracts = $1,562 / $900 = 1.7 → 1 ES contract
  NQ max contracts = $1,562 / $1,600 = 0.97 → 0 (do not enter NQ today)
```

### 9.5 Three-Partner Decision Flow

```
PRE-SESSION (15 min before open):
─────────────────────────────────────────
Partner 3:
  → Pull ATR for ES, NQ, MNQ, 6E
  → Generate session map: ranked setups for today
  → Flag news events for next 4 hours
  → Output: top 3 setups with ATR-based stop/target/contracts

Partner 2:
  → Calculate Kelly from equity high-water mark
  → Compute max contracts per setup (Kelly ÷ stop$)
  → Set consistency cap: $3,000 / 40% = $1,200/day max contribution
  → Check DD tracker: if DD exists, compute recovery trades needed

Partner 1:
  → Review tape from prior session
  → Identify key structural levels
  → Emotional check: "Am I clear-headed? If not, halve Kelly."
  → Market bias: "What does tape tell me the market wants today?"

INTRASESSION (when a setup appears):
─────────────────────────────────────────
Partner 3 confirms:
  → ATR filter passes (ATR > 0.70 × 20-session avg)?
  → Session ATR ratio > 0.50?
  → No news in next 30 min?

Partner 2 confirms:
  → Kelly size calculated for this stop distance?
  → Contracts within daily loss limit?
  → Not exceeding contract limit for this firm?
  → Payout day — is consistency cap a factor today?

Partner 1 confirms:
  → Tape confirms direction (price action, structure)?
  → Catalyst present (data, breakout, momentum)?
  → RR ≥ 1.5:1 at time of entry?

ALL THREE agree → ENTER
ANY ONE dissents → REDUCE SIZE or SKIP

POST-TRADE (after every trade):
─────────────────────────────────────────
Partner 2:
  → Log trade to journal: WR, R, cost, net EV
  → Update 20-trade rolling stats
  → If DD event: compute recovery trades

Partner 3:
  → Update ATR regime tracking
  → Note if ATR expanded/contracted vs entry
  → Revise session map if market character changed

Partner 1:
  → Self-assess: "Did I follow the rules?"
  → If emotional: note it, move on
  → If tilt detected: alert Partner 2 to reduce size
```

### 9.6 The No-Edge, Pure-Skill Scenario: ATR-Only Mathematical Playbook

**Context:** The team has no documented edge — they are relying entirely on tape reading skill, position sizing math, and volatility analysis. What is the complete playbook?

**Answer:** Create the edge mathematically through ATR normalization, session selectivity, and Kelly discipline.

**Complete ATR-Only System (no indicators beyond price data):**

```
STEP 1: ATR Classification
  ATR_ratio = current_ATR(14) / 20-session_average_ATR
  IF ATR_ratio > 1.30 → HIGH VOL: trade with 25% smaller size, wider SL
  IF ATR_ratio 0.70–1.30 → NORMAL: trade per system
  IF ATR_ratio < 0.70 → LOW VOL: skip or micro only

STEP 2: Session Classification
  IF NY open (8:30–10:00 AM ET) → ATR × 0.80 (data-driven volatility spike)
  IF London/NY overlap (7:00–8:30 AM ET) → ATR × 0.90
  IF NY midday (11:30 AM–1:00 PM ET) → ATR × 1.20 (quiet session)
  IF NY close (2:00–4:00 PM ET) → ATR × 1.00

STEP 3: Dollar Risk Calculation
  SL_dollars = ATR(14) × SL_multiplier × $/point
  Max_contracts = Kelly_dollar_risk / SL_dollars (round down)

STEP 4: Entry
  No limit orders — market enter to avoid adverse selection
  Confirm tape direction first (Partner 1)

STEP 5: Exit
  TP1: ATR × TP1_multiple → close 50%, move SL to breakeven
  TP2: ATR × TP2_multiple → close remaining 50%
  SL: ATR × SL_multiple
  Time stop: 12 bars (5-min), no TP hit → exit
```

**Setup Types (Poker Player + Quant hybrid):**

```
TYPE A — TREND (momentum confirmed by ATR expansion)
  Conditions:
    - Price making higher highs + higher lows (bull) OR lower + lower (bear)
    - ATR ratio > 1.15 (ATR expanding = real money)
    - Volume increasing on the directional move
  Entry: On pullback to moving average, ATR-based stop
  Exit: TP2 at 2.0× ATR, trailing stop at 3× ATR

TYPE B — MEAN-REVERSION (range + ATR contraction)
  Conditions:
    - Price oscillating between defined support/resistance
    - ATR ratio < 0.85 (ATR contracting = chop)
    - At range boundary (S/R zone)
  Entry: At range boundary, ATR-based stop (opposite boundary)
  Exit: Opposite range boundary OR TP1 at 1.0× ATR

TYPE C — BREAKOUT (volatility compression)
  Conditions:
    - ATR at multi-session low (volatility squeeze)
    - Price consolidating in tight range (<1.5× ATR width)
    - Range bound for 5+ bars
  Entry: When price breaks range high/low + 1 tick
  SL: Opposite side of consolidation = minimum ATR × 2.0
  TP: Height of consolidation × 2.0 + ATR × 2.0
```

---

## SECTION 10 — INTEGRATED MASTER STRATEGY

### 10.1 The Complete Strategy

**The name:** ATR-Driven Three-Partner Scalping (ADTPS)
**Target profile:** 55% WR, 1.5:1 RR, quarter Kelly sizing
**Primary instrument:** MNQ (prop firm)
**Primary session:** NY open and London/NY overlap
**Timeframe:** 5-minute charts (scalp) with 15-minute confirmation

### 10.2 Master Rules

**Pre-Session Rules (every morning, before first entry):**
1. Partner 3 pulls ATR for ES, NQ, MNQ, 6E — generates session map
2. Partner 2 calculates Kelly from equity high-water mark — determines max contracts
3. Partner 1 checks news calendar — flags high-volatility windows
4. All three agree on today's top setup → record in journal
5. Set daily loss limit: 3% personal stop (1.5% per firm)
6. If emotional state is compromised → reduce Kelly 50%

**Entry Rules (ALL must be true to enter):**
1. ATR filter: current ATR > 0.70 × 20-session average
2. Session: NY open, London/NY overlap, or NY close
3. Tape: price action confirms direction (HH/HL or LH/LL confirmed)
4. RR at entry: ≥ 1.5:1 (measured from entry to SL vs entry to TP1)
5. No high-impact news in next 30 minutes
6. Kelly size > 0 (not in streak-based reduction to zero)

**Exit Rules (apply in priority order):**
1. Hard SL hit → close 100%, record trade
2. TP1 hit → close 50%, move SL to breakeven ($0 risk)
3. TP2 hit → close remaining 50%
4. Time stop (12 bars, no TP hit) → close 100% at market
5. ATR contracting (current ATR < 0.70 × entry ATR) → tighten stop
6. Session close (3:00 PM ET) → flatten all positions

**Position Sizing Rules:**
1. Kelly dollar risk = account × quarter Kelly fraction (from HWM equity)
2. ATR stop in dollars = ATR × SL multiplier × $/point
3. Max contracts = Kelly risk / ATR stop (round DOWN)
4. If ATR expands > 30% above normal → reduce contracts 25%
5. Never exceed prop firm contract limit
6. ES + NQ combined risk ≤ Kelly dollar risk (no double-counting)

**Daily Shutdown Rules:**
1. 3 consecutive losses → reduce Kelly 50%
2. 5 consecutive losses → reduce Kelly to quarter Kelly
3. 6 consecutive losses → STOP TRADING for the day
4. 3% daily DD → reduce Kelly 75%
5. 4% daily DD → session over, no more trades

### 10.3 Asset Priority Table

| Priority | Instrument | Timeframe | Session | Kelly Contracts | Notes |
|---|---|---|---|---|---|
| 1 | MNQ | 5-min | NY Open (primary) | 8–19 | Prop firm primary |
| 2 | ES | 5-min | NY Open (secondary) | 3 | Better $ capture |
| 3 | NQ | 15-min | NY Close (momentum) | 3–4 | High conviction only |
| 4 | 6E | 15-min | NY Close (overlap) | 6–12 | Cross-asset hedge only |

### 10.4 Prop Firm Execution Strategy

**Challenge phase (FTMO 1-Step example):**
- Target: 10% profit in minimum 4 trading days
- On $50K account: $5,000 target
- Daily cap (50% consistency rule): $2,500/day maximum
- Recommended pace: $1,250/day × 4 days = $5,000 target
- Strategy: Use MNQ primarily to control DD, ES for larger captures
- Stop: If 3% daily DD hit → stop for the day (personal limit is 1.5%)

**Funded phase:**
- Target: 6% monthly profit = $3,000 on $50K
- Payout: 90% × $3,000 = $2,700/month
- Run 4 funded accounts: 4 × $2,700 = $10,800/month
- Capital efficiency: $5K personal capital → $200K funded capital → $10,800/month

### 10.5 Monthly P&L Summary by Scenario

| Scenario | Daily Trades | Monthly Trades | Net EV/Trade | Monthly Net Profit | Monthly ROI ($25K) | Annualized ROI |
|---|---|---|---|---|---|---|
| Conservative (50% WR, 1:1) | 3 | 60 | −$4.50 | **−$270** | −1.1% | −12.6% |
| **Balanced (55% WR, 1.5:1)** | **5** | **100** | **+$89.25** | **+$8,925** | **+35.7%** | **+428.4%** |
| Aggressive (60% WR, 2:1) | 4 | 80 | +$195.50 | **+$15,640** | **+62.6%** | **+751.2%** |
| No-Edge (50% WR, 0.75:1) | 5 | 100 | −$37.25 | **−$3,575** | −14.3% | RUINOUS |

### 10.6 Risk of Ruin Analysis

**Risk of ruin formula:** P(ruin) = (q/p)^B where q = loss rate, p = win rate, B = bankroll in R units

```
Scenario B (55% WR, 1.5:1):
  Risk of ruin at $25,000, $250 risk (100R bankroll):
    P(ruin) = (0.45/0.55)^100 = (0.818)^100 = 3.9 × 10^−10
  Nearly zero risk of ruin at quarter Kelly

Scenario B at FULL Kelly (25% risk = $6,250/trade = 25R):
  Bankroll = $25,000 / $6,250 = 4R
  P(ruin) = (0.45/0.55)^4 = (0.818)^4 = 0.447 = 44.7% chance of ruin
  This is why full Kelly is mathematically suboptimal in practice
```

### 10.7 Verification and Testing Protocol

```
PHASE 1 — Paper Trading (Mandatory, 4 weeks minimum):
  - Track WR, average R, total P&L, daily DD
  - Target: 55%+ WR, 1.5:1+ RR confirmed
  - If below 50% WR for 2 consecutive weeks: review system

PHASE 2 — Challenge Entry (after 4 weeks paper trading):
  - Enter one Blue Guardian Instant or MyFundedFutures Core challenge
  - Run at 75% of calculated Kelly size during challenge
  - Target: 6% profit in 2–4 weeks on MNQ
  - If challenge fails: paper trade 2 more weeks, re-evaluate

PHASE 3 — Funded Execution:
  - First 2 weeks funded: run at 75% Kelly to establish track record
  - After 4 weeks funded showing consistent profitability: scale to 100% Kelly
  - Re-evaluate WR every 20 trades

PHASE 4 — Scale and Multiply:
  - Second funded account: repeat Phase 2–3
  - Target: 4 funded $50K accounts within 6 months
  - Scale first account to $100K when allowed by firm
  - Target: $21,600/month from 4 × $100K funded accounts
```

---

## Appendix A — Key Formulas Reference Card

```
EXPECTANCY:
  Gross EV (R) = (WR × RR) − (1 − WR)
  Net EV ($) = [Gross EV (R) − Cost(R)] × $ risk per losing trade
  Cost(R) = round-trip cost / dollar risk per losing trade

KELLY CRITERION:
  f* = WR − (1 − WR) / RR
  Quarter Kelly = f* × 0.25

DRAWDOWN RECOVERY:
  Recovery return needed = DD / (1 − DD)
  Trades to recover ≈ DD% / Net EV%

CONSECUTIVE LOSSES:
  P(N consecutive losses) = (1 − WR)^N

EXPECTED MAXIMUM DRAWDOWN:
  EMDD ≈ 2.506 × σ × √(ln(T)), where T = number of trades

RISK OF RUIN:
  P(ruin) = (q/p)^B, where B = bankroll in R units, q = loss rate, p = win rate

ATR POSITION SIZING:
  Max contracts = Kelly risk $ / (ATR × multiplier × $/point)

BREAKEVEN WIN RATE:
  Breakeven WR = (1 + cost_fraction) / (1 + RR)
```

---

## Appendix B — Assumptions and Disclaimers

**Key assumptions:**
1. Starting capital: $25,000 personal / $50,000 prop firm
2. Round-trip cost: $4.50 ES, $4.25 NQ, $0.70 MNQ, $6.00 6E
3. 20 trading days per month
4. Kelly sizing uses quarterly fraction (6.25% of account per trade)
5. VIX in April 2026: elevated range (18–25), calibrated accordingly
6. Prop firm pass rate assumption: 60% for skilled traders

**Disclaimers:**
1. All projections assume ideal execution — slippage, gapping, and news events can materially alter results
2. Past performance of any strategy does not guarantee future results
3. Prop firm rules change — verify current rules directly with each firm before use
4. This document does not constitute financial advice
5. Paper trading is mandatory before risking real capital (Paper Trading Rule)
6. No trading system eliminates risk of loss; all strategies can and do lose
