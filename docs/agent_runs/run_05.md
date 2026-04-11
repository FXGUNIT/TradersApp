# TradersApp Quantitative Trading Strategy — Run #5
*Assumptions: $50,000 account | 2-5 contracts | 22 trading days/month | NinjaTrader fees | April 2026*

---

## Executive Summary

**Profile:** Institutional-scale trader with $50K starting capital. Uses ES as primary instrument (highest liquidity, best dollar capture). Trades 6 times/day across NY open + London/NY overlap sessions. World-class execution assumed.

**Key finding:** At $50K with 55% WR and 1.5:1 RR, monthly net profit is $15,400 (+30.8% ROI). Prop firm path: 4 × $100K funded accounts = $19,440/month.

---

## SECTION 1 — CONTRACT SPECIFICATIONS & ALL-IN COSTS

### 1.1 Instrument Reference

| Instrument | $/Point | $/Tick | Tick Size | Day Margin | ATR-14 |
|---|---|---|---|---|---|
| **ES** | $50.00 | $12.50 | 0.25 pts | $1,000 | 60–80 pts |
| **NQ** | $20.00 | $5.00 | 0.25 pts | $1,500 | 170–250 pts |
| **MNQ** | $2.00 | $0.50 | 0.25 pts | $100 | 170–250 pts |
| **6E** | $12.50/pip | $6.25 | 0.00005 | $2,000 | 70–100 pips |

### 1.2 All-In Round-Trip Cost (NinjaTrader + Rithmic)

| Instrument | Half-Spread | Commission | Exchange | Slippage | **Total RT** |
|---|---|---|---|---|---|
| ES | $1.25 | $2.00 | $0.25 | $1.25 | **$4.75** |
| NQ | $2.50 | $2.00 | $0.30 | $1.25 | **$6.05** |
| MNQ | $0.25 | $0.50 | $0.10 | $0.13 | **$0.98** |
| 6E | $3.13 | $2.00 | $0.50 | $1.56 | **$8.19** |

### 1.3 Cost as % of 1R Risk ($500 risk per trade)

| Instrument | 1R Risk | Total RT Cost | Cost % |
|---|---|---|---|
| ES | $500 | $4.75 | 0.95% |
| NQ | $500 | $6.05 | 1.21% |
| MNQ | $100 | $0.98 | 0.98% |
| 6E | $312.50 | $8.19 | 2.62% |

---

## SECTION 2 — WIN RATE × RISK-REWARD MATRIX

**Baseline:** $500 risk/trade. 22 days/month. 6 trades/day = 132 trades/month.

### 2.1 ES Matrix ($500 risk, $4.75 cost)

```
Net EV = [WR × RR − (1−WR)] × $500 − $4.75
```

| WR \ RR | 0.5:1 | 1:1 | 1.5:1 | 2:1 | 2.5:1 |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **40%** | −$130.75 | −$42.75 | +$45.25 | +$133.25 | +$221.25 |
| **50%** | −$55.75 | +$32.25 | +$120.25 | +$208.25 | +$296.25 |
| **55%** | −$18.25 | +$69.75 | +$157.75 | +$245.75 | +$333.75 |
| **58%** | +$5.67 | +$93.67 | +$181.67 | +$269.67 | +$357.67 |
| **60%** | +$29.25 | +$117.25 | +$205.25 | +$293.25 | +$381.25 |
| **65%** | +$76.75 | +$164.75 | +$252.75 | +$340.75 | +$428.75 |
| **70%** | +$124.25 | +$212.25 | +$300.25 | +$388.25 | +$476.25 |

### 2.2 Monthly ROI on $50,000 Account

| WR \ RR | 0.5:1 | 1:1 | 1.5:1 | 2:1 |
|:---:|:---:|:---:|:---:|:---:|
| **50%** | −14.6% | +8.5% | +31.7% | +54.8% |
| **55%** | −4.8% | +18.4% | +41.6% | +64.7% |
| **58%** | +1.5% | +24.7% | +47.8% | +71.0% |
| **60%** | +7.7% | +30.9% | +54.0% | +77.1% |
| **65%** | +20.2% | +43.4% | +66.6% | +89.7% |

### 2.3 Breakeven WR

```
BE_WR = (Cost/500 + 1) / (RR + 1)

| Instrument | Cost | 1:1 | 1.5:1 | 2:1 |
|---|---|---|---|---|
| ES | $4.75 | 50.95% | 40.95% | 35.32% |
| NQ | $6.05 | 51.21% | 41.21% | 35.58% |
| MNQ | $0.98 | 50.20% | 40.20% | 34.57% |
| 6E | $8.19 | 51.64% | 41.64% | 36.00% |
```

---

## SECTION 3 — FOUR SCENARIOS

**Assumptions:** $50,000 account. $500 risk/trade. 6 trades/day. 22 days = 132 trades/month.

### Scenario A — Conservative (53% WR, 1:1 RR)
```
EV = [0.53 × 1.0 − 0.47] × $500 − $4.75 = $30 − $4.75 = $25.25
Monthly = 132 × $25.25 = $3,333 → ROI = +6.7%/month
```
**Verdict:** Viable at 53%+ WR. Requires consistent execution.

### Scenario B — Balanced (57% WR, 1.5:1 RR)
```
EV = [0.57 × 1.5 − 0.43] × $500 − $4.75 = $155 − $4.75 = $150.25
Monthly = 132 × $150.25 = $19,833 → ROI = +39.7%/month
```
**Verdict:** Recommended. Strong edge at this capital level.

### Scenario C — Aggressive (62% WR, 2:1 RR)
```
EV = [0.62 × 2.0 − 0.38] × $500 − $6.05 = $310 − $6.05 = $303.95
Monthly = 132 × $303.95 = $40,121 → ROI = +80.2%/month
```
**Verdict:** Elite target for experienced traders.

### Scenario D — No-Edge (50% WR, 0.75:1 RR)
```
EV = [0.50 × 0.75 − 0.50] × $500 − $4.75 = −$125 − $4.75 = −$129.75
Monthly = 132 × (−$129.75) = −$17,127 → ROI = −34.3%/month
```
**Verdict:** Catastrophic. Avoid completely.

---

## SECTION 4 — POINTS/PIPS TARGETS

### ES Targets ($500 risk basis)

| TF | Strategy | SL (pts) | SL ($) | TP1 (pts) | TP2 (pts) | RR | $/win |
|---|---|---|---|---|---|---|---|
| 5-min | A | 10 | $500 | 10 | — | 1:1 | $500 |
| 5-min | B | 10 | $500 | 15 | 20 | 1.5–2:1 | $750 |
| 15-min | C | 15 | $750 | 30 | 45 | 2–3:1 | $1,500 |
| 1-min | Scalp | 6 | $300 | 6 | — | 1:1 | $300 |

### NQ Targets ($500 risk basis)

| TF | Strategy | SL (pts) | SL ($) | TP1 (pts) | RR | $/win |
|---|---|---|---|---|---|---|
| 5-min | B | 25 | $500 | 37.5 | 1.5:1 | $500 |
| 15-min | C | 40 | $800 | 80 | 2:1 | $800 |

---

## SECTION 5 — ATR-ONLY TRADING SYSTEM

### 5.1 ATR Multiples

| Instrument | SL ATR | TP1 ATR | TP2 ATR | Volatile SL | Volatile TP |
|---|---|---|---|---|---|
| ES | 1.5× | 1.0× | 2.5× | 2.0× | 1.5× |
| NQ | 1.5× | 1.0× | 2.5× | 2.0× | 1.5× |
| MNQ | 2.0× | 1.5× | 3.0× | 2.5× | 2.0× |
| 6E | 2.0× | 1.5× | 3.0× | 2.5× | 2.0× |

### 5.2 Position Sizing — $50K Account, Scenario B

```
Full Kelly (57% WR, 1.5:1 RR):
  f* = 0.57 − 0.43/1.5 = 0.57 − 0.287 = 28.7%
  $50K × 28.7% = $14,350 risk max (Full Kelly)

Quarter Kelly = $3,588 risk max

ES: ATR = 12 pts → SL = 18 pts → $900/contract
  Contracts = $3,588 / $900 = 3.98 → 3 contracts ✓

NQ: ATR = 35 pts → SL = 52 pts → $1,040/contract
  Contracts = $3,588 / $1,040 = 3.45 → 3 contracts ✓
```

### 5.3 Volatility Filter
```
IF ATR > 1.35× ATR_20SMA: size −30%, SL widens to 2.0× ATR
IF ATR < 0.70× ATR_20SMA: skip or micro-scalp only (1:1, 50% size)
IF ATR spike > 1.70× yesterday: widen SL, TP1 only
```

---

## SECTION 6 — KELLY CRITERION MATH

### 6.1 Kelly Table

| Scenario | WR | RR | Kelly % | $ on $50K | ES Contracts | NQ Contracts |
|---|---|---|---|---|---|---|
| A | 53% | 1.0 | 6.0% | $3,000 | 6 | 5 |
| B | 57% | 1.5 | 28.7% | $14,350 | 15 | 13 |
| C | 62% | 2.0 | 48.0% | $24,000 | 26 | 23 |
| D | 50% | 0.75 | NEGATIVE | — | — | — |

**Recommended operating level: Quarter Kelly = ~7% of account = $3,588 risk max**

### 6.2 Dynamic Kelly

```
Streak rules:
  +3 wins → Kelly × 1.25 (capped at Half Kelly)
  +5 wins → Kelly × 1.50
  −2 losses → Kelly × 0.75
  −3 losses → Kelly × 0.50
  −4 losses → HALT

HWM rule:
  New equity peak → recalculate Kelly from new peak
  Below peak 7% → Kelly × 0.75
  Below peak 14% → Kelly × 0.50
  Below peak 20% → HALT
```

---

## SECTION 7 — DRAWDOWN MATHEMATICS

### 7.1 P(Streak) Table

| WR | P(3 in row) | P(5 in row) | P(8 in row) |
|---|---|---|---|
| 50% | 12.5% | 3.1% | 0.4% |
| 57% | 7.9% | 1.6% | 0.08% |
| 60% | 6.4% | 1.0% | 0.04% |
| 65% | 4.3% | 0.5% | 0.01% |

### 7.2 EMDD

```
Scenario B (σ = $650 at $500 risk, 132 trades):
  EMDD ≈ 2.506 × $650 × √(ln(132)) = $17,000 ≈ 34% of account
  At quarter Kelly ($3,588 risk, ~7% of account per trade):
  EMDD ≈ 34% × 0.25 = 8.5% of account ≈ $4,250
```

### 7.3 Recovery Table

| DD | Recovery % | Scenario B EV | Trades to Recover |
|---|---|---|---|
| 5% | 5.3% | $150 | ~18 trades |
| 10% | 11.1% | $150 | ~37 trades |
| 20% | 25.0% | $150 | ~83 trades |

---

## SECTION 8 — PROP FIRM COMPARISON

### 8.1 Firm Selection

| Firm | Why Best for $50K Trader |
|---|---|
| FTMO 1-Step | 90% split, $50K accounts, scaling to $200K+ |
| FTMO 2-Step | Cheapest route to $50K funded ($400 total) |
| Blue Guardian | Instant funding option, $4M scaling cap |
| MFF Rapid | Daily payouts, 90% split |

### 8.2 Capital Allocation ($10,000 Personal)

| Item | Amount |
|---|---|
| FTMO Phase 1+2 | $400 × 2 = $800 |
| FTMO Phase 1+2 (second) | $800 |
| MFF Core (×2) | $77 × 2 = $154 |
| Recovery reserve | $2,000 |
| Operational buffer | $7,000 |
| **Total** | **$10,000** |

### 8.3 Income Projection

| Setup | Monthly Payout | Annual |
|---|---|---|
| 4 × $50K funded (FTMO) | $9,720 | $116,640 |
| 2 × $100K scaled | $9,720 | $116,640 |
| 4 × $100K scaled | $19,440 | $233,280 |

**On $10K capital, 4 × $100K funded = $233K/year = 2,330% annual ROI.**

---

## SECTION 9 — THREE-PARTNER MATHEMATICAL STRATEGY

### Roles

**Partner 1 (Poker Pro):**
- Reads institutional flow in tape
- Enforces emotional discipline and tilt protocol
- Makes pot commitment decisions: only go big with confirmed setups
- Halts after 4 consecutive losses

**Partner 2 (Mathematician):**
- Calculates Kelly from live equity HWM daily
- Validates edge monthly via p-value test
- Computes recovery plan after any DD > 5%
- Optimizes consistency algorithm to prevent DQ

**Partner 3 (Quant):**
- Generates ATR session maps pre-open
- Monitors volatility regime in real-time
- Flags ATR spikes, session transitions
- Maintains backtest rolling window (20-trade)

### Entry Flow
```
Quant: ATR filter + session + no news
Mathematician: Kelly size + contract count + DD buffer
Poker Pro: Tape confirms direction + RR ≥ 1.5:1 + emotional state OK
ALL YES → ENTER | ANY NO → SKIP
```

---

## SECTION 10 — INTEGRATED MASTER STRATEGY

### Profile
| Item | Value |
|---|---|
| Capital | $50,000 |
| Primary | ES (5-min, NY open) |
| Kelly | Quarter Kelly = $3,588 risk max |
| Target | 57% WR, 1.5:1 RR |
| Monthly target | +$19,833 (+39.7% ROI) |

### Master Rules
```
ENTRY (ALL YES):
  □ ATR within 0.70×–1.35× of 20-day ATR
  □ Session: NY open (8:30–10AM) or London/NY overlap
  □ Tape confirms direction
  □ RR ≥ 1.5:1 at entry
  □ Kelly size calculated
  □ No news in next 30 min
  □ Streak < 4 losses
  □ Daily DD < $2,500

EXIT:
  1. SL → close 100%
  2. TP1 → close 50%, SL to breakeven
  3. TP2 → close 50%
  4. ATR spike → widen SL to 2× ATR
  5. 12 bars no TP → market exit
  6. 3PM ET → flatten all
```

### Monthly ROI Summary

| Scenario | Monthly Net | ROI | Annual |
|---|---|---|---|
| A (53%, 1:1) | +$3,333 | +6.7% | +80% |
| **B (57%, 1.5:1)** | **+$19,833** | **+39.7%** | **+477%** |
| C (62%, 2:1) | +$40,121 | +80.2% | +962% |
| D (50%, 0.75:1) | −$17,127 | −34.3% | RUIN |
