# TradersApp Quantitative Trading Strategy — Run #6
*Assumptions: $15,000 starting capital | MNQ primary | 1 contract | 20 trading days/month | Tradovate fees | April 2026*

---

## Executive Summary

**Profile:** Small account ($15K) trader using MNQ micro futures as primary instrument. This is the optimal setup for prop firm beginners: MNQ's $2/point allows 1-contract trading with $15-$40 risk per trade, staying well within prop firm DD limits. No margin calls, no overnight exposure.

**Key finding:** MNQ at 55% WR, 1.5:1 RR generates +$520/month net profit (+3.5% ROI). While lower in absolute terms, this is achieved with ~$0.78 round-trip costs (Tradovate's micro pricing) and near-zero DD risk. Scale to ES/NQ once funded.

---

## SECTION 1 — CONTRACT SPECIFICATIONS & ALL-IN COSTS

### 1.1 Instrument Reference

| Instrument | $/Point | $/Tick | Tick Size | Day Margin | ATR-14 |
|---|---|---|---|---|---|
| **MNQ** | $2.00 | $0.50 | 0.25 pts | $40 | 160–240 pts |
| **ES** | $50.00 | $12.50 | 0.25 pts | $400 | 55–80 pts |
| **NQ** | $20.00 | $5.00 | 0.25 pts | $500 | 160–250 pts |
| **6E** | $12.50/pip | $6.25 | 0.00005 | $1,500 | 65–100 pips |

### 1.2 All-In Round-Trip Cost (Tradovate)

| Instrument | Half-Spread | Commission | Exchange | Slippage | **Total RT** |
|---|---|---|---|---|---|
| MNQ | $0.25 | **$0** (free RT) | $0.10 | $0.13 | **$0.48** |
| ES | $1.25 | $1.00 | $0.25 | $1.25 | **$3.75** |
| NQ | $2.50 | $1.00 | $0.30 | $1.25 | **$5.05** |
| 6E | $3.13 | $1.50 | $0.50 | $1.56 | **$7.69** |

**MNQ at $0.48 RT is the cheapest trade in US futures. This is the primary advantage for small accounts.**

### 1.3 Per-Trade Cost as % of Risk

| Instrument | Typical Risk | Cost | Cost % |
|---|---|---|---|
| MNQ | $40 (20 pts × $2) | $0.48 | 1.20% |
| ES | $250 (10 pts × $50) | $3.75 | 1.50% |
| NQ | $200 (10 pts × $20) | $5.05 | 2.53% |
| 6E | $125 (20 pips × $6.25) | $7.69 | 6.15% |

---

## SECTION 2 — WIN RATE × RISK-REWARD MATRIX

**Baseline:** $40 risk/trade (MNQ 20-pt SL). 20 days/month. 5 trades/day = 100 trades/month.

### 2.1 MNQ Matrix ($40 risk, $0.48 cost)

```
Net EV = [WR × RR − (1−WR)] × $40 − $0.48
```

| WR \ RR | 0.5:1 | 1:1 | 1.5:1 | 2:1 | 2.5:1 |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **40%** | −$10.48 | −$3.48 | +$3.52 | +$10.52 | +$17.52 |
| **45%** | −$7.48 | −$0.48 | +$6.52 | +$13.52 | +$20.52 |
| **50%** | −$4.48 | +$2.52 | +$9.52 | +$16.52 | +$23.52 |
| **55%** | −$1.48 | +$5.52 | +$12.52 | +$19.52 | +$26.52 |
| **60%** | +$1.52 | +$8.52 | +$15.52 | +$22.52 | +$29.52 |
| **65%** | +$4.52 | +$11.52 | +$18.52 | +$25.52 | +$32.52 |

### 2.2 Monthly ROI on $15,000 Account (MNQ, $40 risk)

| WR \ RR | 1:1 | 1.5:1 | 2:1 |
|:---:|:---:|:---:|:---:|
| **50%** | +1.7% | +6.3% | +11.0% |
| **55%** | +3.7% | +8.3% | +13.0% |
| **60%** | +5.7% | +10.3% | +15.0% |
| **65%** | +7.7% | +12.3% | +17.0% |

**Small account ROI is inherently lower because 1 contract cannot compound faster. The goal is consistency and DD avoidance, not maximum ROI.**

### 2.3 ES/NQ Comparison at $15K Scale

| Instrument | Risk/Trade | Monthly Net (55% WR, 1.5:1) | Monthly ROI |
|---|---|---|---|
| MNQ | $40 | +$1,252 | +8.3% |
| ES | $200 | +$1,252 | +8.3% |
| NQ | $200 | +$1,147 | +7.6% |

**Same $ risk generates same dollar return. MNQ wins on cost efficiency.**

---

## SECTION 3 — FOUR SCENARIOS

**Assumptions:** $15,000 account. 5 trades/day. 20 days = 100 trades/month. MNQ primary.

### Scenario A — Conservative (51% WR, 1:1 RR)
```
EV = [0.51 × 1.0 − 0.49] × $40 − $0.48 = $0.80 − $0.48 = $0.32
Monthly = 100 × $0.32 = $32 → ROI = +0.2%/month
```
**Verdict:** Effectively breakeven. Requires 52%+ WR. Marginal.

### Scenario B — Balanced (55% WR, 1.5:1 RR)
```
EV = [0.55 × 1.5 − 0.45] × $40 − $0.48 = $12 − $0.48 = $11.52
Monthly = 100 × $11.52 = $1,152 → ROI = +7.7%/month
```
**Verdict:** Viable professional baseline. Strong consistency, minimal DD.

### Scenario C — Aggressive (60% WR, 2:1 RR)
```
EV = [0.60 × 2.0 − 0.40] × $40 − $0.48 = $16 − $0.48 = $15.52
Monthly = 100 × $15.52 = $1,552 → ROI = +10.3%/month
```
**Verdict:** Excellent. Target after consistent Scenario B performance.

### Scenario D — No-Edge (50% WR, 0.75:1 RR)
```
EV = [0.50 × 0.75 − 0.50] × $40 − $0.48 = −$10 − $0.48 = −$10.48
Monthly = 100 × (−$10.48) = −$1,048 → ROI = −7.0%/month
```
**Verdict:** Loses money. Never do this.**

---

## SECTION 4 — POINTS/PIPS TARGETS

### MNQ Targets ($2/pt)

| TF | Strategy | SL (pts) | SL ($) | TP1 (pts) | TP2 (pts) | RR | $/win |
|---|---|---|---|---|---|---|---|
| 1-min | Micro | 15 | $30 | 15 | — | 1:1 | $30 |
| 5-min | Primary | 20 | $40 | 30 | 40 | 1.5–2:1 | $40 |
| 15-min | Momentum | 30 | $60 | 45 | 60 | 1.5–2:1 | $60 |

### ES Targets ($50/pt)

| TF | Strategy | SL (pts) | SL ($) | TP1 (pts) | $/win |
|---|---|---|---|---|---|
| 5-min | Primary | 5 | $250 | 7.5 | $375 |
| 15-min | Momentum | 10 | $500 | 20 | $1,000 |

---

## SECTION 5 — ATR-ONLY TRADING SYSTEM

### 5.1 ATR Multiples

| Instrument | SL ATR | TP1 ATR | TP2 ATR | Notes |
|---|---|---|---|---|
| MNQ | 2.0× | 1.5× | 3.0× | Wider for micro liquidity |
| ES | 1.5× | 1.0× | 2.5× | Standard |
| NQ | 1.5× | 1.0× | 2.5× | Standard |

### 5.2 MNQ ATR Lookup

| TF | ATR-14 | SL Distance | TP1 | TP2 | $ Risk |
|---|---|---|---|---|---|
| 1-min | 15 pts | 30 pts | 22 pts | 45 pts | $60 |
| 5-min | 25 pts | 50 pts | 37 pts | 75 pts | $100 |
| 15-min | 40 pts | 80 pts | 60 pts | 120 pts | $160 |

### 5.3 Volatility Filter
```
IF ATR > 1.40× ATR_20SMA: high vol → SL 2.5× ATR, size −40%
IF ATR < 0.70× ATR_20SMA: low vol → skip or micro-scalp only
IF ATR spike > 1.65× yesterday: widen SL, TP1 only
```

### 5.4 Position Sizing
```
For $15K, MNQ at $40 risk/contract:
  Kelly fraction (55% WR, 1.5:1 RR, Full Kelly = 25%):
  Quarter Kelly = 6.25% × $15,000 = $938 risk max
  MNQ: $40 risk/contract → max 23 MNQ contracts
  (But min notional: $40 × 23 = $920 ≈ within Kelly)
  
  Practical: 1-5 MNQ contracts depending on ATR
  If ATR wide (40 pts): SL = $80 → max 11 contracts
  If ATR normal (25 pts): SL = $50 → max 18 contracts
  Minimum Kelly: 1 contract always (never zero risk of opportunity)
```

---

## SECTION 6 — KELLY CRITERION MATH

### 6.1 Kelly Values ($15,000 Account)

| Scenario | WR | RR | Kelly % | $ Risk | MNQ Contracts | ES Contracts |
|---|---|---|---|---|---|---|
| A | 51% | 1.0 | 2.0% | $300 | 7 | 1 |
| B | 55% | 1.5 | 25.0% | $3,750 | 93 | 15 |
| C | 60% | 2.0 | 40.0% | $6,000 | 150 | 24 |
| D | 50% | 0.75 | NEGATIVE | — | — | — |

**Operating at $40 risk (1 MNQ contract) is approximately 1/50th Kelly. Ultra-safe but slow growth. Correct for small accounts.**

### 6.2 Dynamic Kelly Rules

```
Ultra-conservative mode ($15K account):
  Start: $40 risk (1 MNQ contract)
  3 losses in row → skip
  3 wins in row → 2 MNQ contracts
  5 wins in row → 3 MNQ contracts
  HWM breach → +1 contract on next trade
  Daily DD > $150 (1%) → reduce to 1 contract
  Daily DD > $300 (2%) → STOP
```

---

## SECTION 7 — DRAWDOWN MATHEMATICS

### 7.1 P(Streak) — MNQ at $40 Risk

| WR | P(3 in row) | P(5 in row) | Dollar Impact (3) | Dollar Impact (5) |
|---|---|---|---|---|
| 50% | 12.5% | 3.1% | −$120 | −$200 |
| 55% | 9.1% | 1.8% | −$120 | −$200 |
| 60% | 6.4% | 1.0% | −$120 | −$200 |

### 7.2 Recovery Math

```
Recovery = DD / (1 − DD)

| DD | Recovery % | Scenario B EV ($11.52) | Trades to Recover |
|---|---|---|---|
| 5% ($750) | 5.3% | $11.52 | ~65 trades |
| 10% ($1,500) | 11.1% | $11.52 | ~144 trades |
```

### 7.3 Daily Shutdown

| Daily DD | Action |
|---|---|
| −$75 (0.5%) | Reduce to 1 contract |
| −$150 (1%) | STOP TRADING |
| −$300 (2%) | Prop firm DQ imminent |

---

## SECTION 8 — PROP FIRM COMPARISON

### 8.1 Best for Small Accounts

| Firm | Model | Why Best for $15K Trader |
|---|---|---|
| **MyFundedFutures Core** | $77/mo | No daily DD during eval, MNQ allowed |
| **Topstep** | $49/mo | Lowest entry cost, 5-contract limit fits small accounts |
| **Blue Guardian Standard** | $150 | No profit target (some plans), instant payout |

### 8.2 Capital Allocation ($3,000 Personal)

| Item | Amount |
|---|---|
| MFF Core × 2 | $154 |
| Topstep × 2 | $98 |
| Recovery reserve | $1,000 |
| Platform/data | $500 |
| Living buffer | $1,248 |
| **Total** | **$3,000** |

### 8.3 Income Model

| Setup | Monthly Payout | Annual |
|---|---|---|
| 2 × $30K funded (MFF) | $1,728 | $20,736 |
| 4 × $30K funded | $3,456 | $41,472 |
| Scale to 2 × $100K | $7,200 | $86,400 |

---

## SECTION 9 — THREE-PARTNER MATHEMATICAL STRATEGY

### Ultra-Conservative Small Account Version

**Partner 1 (Poker Pro):** Tape reading + emotional control. Max size is 5 MNQ contracts regardless of confidence.

**Partner 2 (Mathematician):** Kelly at $15K with 1 MNQ = ~1/50th Kelly. Math ensures position never threatens account survival.

**Partner 3 (Quant):** ATR session maps. MNQ only. No complex instruments.

### Entry (ALL 5):
```
1. ATR within 0.70×–1.40× range
2. Session: NY open (8:30–10AM ET)
3. Tape confirms direction
4. RR ≥ 1.5:1
5. Daily DD < $75
```

### Exit:
```
1. SL → close 100%
2. TP1 → close 50%, SL to breakeven
3. TP2 → close remaining 50%
4. 10 bars no TP → exit
5. 3PM ET → flatten all
```

---

## SECTION 10 — INTEGRATED MASTER STRATEGY

### Profile
| Item | Value |
|---|---|
| Capital | $15,000 |
| Primary | MNQ (1-5 contracts) |
| Kelly | Ultra-quarter Kelly = $40 risk (1 MNQ) |
| Target | 55% WR, 1.5:1 RR |
| Monthly target | +$1,152 (+7.7% ROI) |

### Monthly P&L Summary

| Scenario | Monthly Net | ROI | Annual |
|---|---|---|---|
| A (51%, 1:1) | +$32 | +0.2% | +2.4% |
| **B (55%, 1.5:1)** | **+$1,152** | **+7.7%** | **+92%** |
| C (60%, 2:1) | +$1,552 | +10.3% | +124% |
| D (50%, 0.75:1) | −$1,048 | −7.0% | LOSS |

**Small account strategy prioritizes survival and consistency over maximum ROI. Goal: build track record → earn funded accounts → scale income.**

### Verification Path
```
Month 1-3: Paper trade MNQ. Target: 55%+ WR confirmed.
Month 4: Enter MFF Core ($77). 6% target = $1,800 on $30K.
Month 5: Funded. $1,440/month payout (80%). Save for next challenge.
Month 9: Second funded account.
Month 12: 2 funded accounts → $2,880/month. Scale to $50K+.
```
