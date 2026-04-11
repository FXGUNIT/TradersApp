# TradersApp Quantitative Trading Strategy — Run #7
*Assumptions: $35,000 account | 6E EURUSD primary | 1-3 contracts | 21 trading days/month | April 2026*

---

## Executive Summary

**Profile:** EUR/USD futures specialist. Primary instrument: 6E (Euro FX). This run is unique: 6E trades differently from equity futures — it follows macro themes, has distinct session patterns (European dominance), and lower correlation to S&P products. Best used as portfolio diversifier alongside ES/NQ.

**Key finding:** 6E at 56% WR, 2:1 RR generates $2,842/month (+8.1% ROI). But 6E requires wider stops (higher pip cost per point) making it more capital-intensive. MNQ/ES remain more efficient per dollar risk.

---

## SECTION 1 — CONTRACT SPECIFICATIONS & ALL-IN COSTS

### 1.1 Instrument Reference

| Instrument | $/Point | $/Tick | Tick Size | Day Margin | ATR-14 |
|---|---|---|---|---|---|
| **6E** | $12.50/pip | $6.25 | 0.00005 | $2,000 | 70–100 pips |
| **ES** | $50.00 | $12.50 | 0.25 pts | $500 | 55–80 pts |
| **NQ** | $20.00 | $5.00 | 0.25 pts | $500 | 160–250 pts |
| **MNQ** | $2.00 | $0.50 | 0.25 pts | $50 | 160–250 pts |

### 1.2 All-In Round-Trip Cost (6E-Specific)

| Component | Cost |
|---|---|
| Spread (0.5 tick) | $3.125 |
| Commission (Tradaeus) | $2.00/side |
| Exchange (CME) | $0.50 |
| NFA | $0.08 |
| Slippage (0.5 tick adverse) | $3.125 |
| **Total RT** | **$8.88** |

### 1.3 6E Cost as % of 1R Risk

| 6E SL | 1R Risk | Total RT | Cost % |
|---|---|---|---|
| 20 pips | $125.00 | $8.88 | 7.1% |
| 30 pips | $187.50 | $8.88 | 4.7% |
| 40 pips | $250.00 | $8.88 | 3.6% |
| 50 pips | $312.50 | $8.88 | 2.8% |

**6E requires 2:1+ RR to offset its higher relative costs.**

---

## SECTION 2 — WIN RATE × RISK-REWARD MATRIX

**Baseline:** $250 risk/trade (40-pip SL on 6E). 21 days/month. 3 trades/day = 63 trades/month.

### 2.1 6E Matrix ($250 risk, 40-pip SL, $8.88 cost)

```
Net EV = [WR × RR − (1−WR)] × $250 − $8.88
```

| WR \ RR | 1:1 | 1.5:1 | 2:1 | 2.5:1 | 3:1 |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **45%** | −$8.88 | +$54.62 | +$118.12 | +$181.62 | +$245.12 |
| **50%** | +$16.12 | +$79.62 | +$143.12 | +$206.62 | +$270.12 |
| **55%** | +$41.12 | +$104.62 | +$168.12 | +$231.62 | +$295.12 |
| **58%** | +$56.12 | +$119.62 | +$183.12 | +$246.62 | +$310.12 |
| **60%** | +$66.12 | +$129.62 | +$193.12 | +$256.62 | +$320.12 |
| **65%** | +$91.12 | +$154.62 | +$218.12 | +$281.62 | +$345.12 |

### 2.2 Monthly ROI on $35,000 Account (6E, 40-pip SL)

| WR \ RR | 1:1 | 1.5:1 | 2:1 |
|:---:|:---:|:---:|:---:|
| **50%** | +2.9% | +14.3% | +25.8% |
| **55%** | +7.4% | +18.8% | +30.3% |
| **58%** | +10.1% | +21.5% | +33.0% |
| **60%** | +11.9% | +23.3% | +34.8% |
| **65%** | +16.4% | +27.8% | +39.3% |

### 2.3 Breakeven WR — 6E

```
BE_WR = (Cost/250 + 1) / (RR + 1)

| SL | Cost | 1:1 | 1.5:1 | 2:1 |
|---|---|---|---|---|
| 20 pips | $8.88 | 53.6% | 44.4% | 38.8% |
| 40 pips | $8.88 | 51.8% | 42.6% | 37.0% |
| 60 pips | $8.88 | 51.2% | 42.0% | 36.5% |

Minimum viable on 6E: 52% WR at 1:1, 43% WR at 2:1.
```

---

## SECTION 3 — FOUR SCENARIOS

**Assumptions:** $35,000 account. 3 trades/day. 21 days = 63 trades/month.

### Scenario A — Conservative (52% WR, 1:1 RR, 6E)
```
EV = [0.52 × 1.0 − 0.48] × $250 − $8.88 = $10 − $8.88 = $1.12
Monthly = 63 × $1.12 = $71 → ROI = +0.2%/month
```
**Verdict:** Effectively zero profit. 6E at 1:1 is not viable. Skip.

### Scenario B — Balanced (56% WR, 1.5:1 RR, 6E)
```
EV = [0.56 × 1.5 − 0.44] × $250 − $8.88 = $98 − $8.88 = $89.12
Monthly = 63 × $89.12 = $5,615 → ROI = +16.0%/month
```
**Verdict:** Viable. 6E works best at 1.5:1+ RR.

### Scenario C — Aggressive (60% WR, 2:1 RR, 6E)
```
EV = [0.60 × 2.0 − 0.40] × $250 − $8.88 = $200 − $8.88 = $191.12
Monthly = 63 × $191.12 = $12,041 → ROI = +34.4%/month
```
**Verdict:** Strong performance. 6E is efficient at 2:1 RR.

### Scenario D — No-Edge (50% WR, 0.75:1 RR, 6E)
```
EV = [0.50 × 0.75 − 0.50] × $250 − $8.88 = −$62.50 − $8.88 = −$71.38
Monthly = 63 × (−$71.38) = −$4,497 → ROI = −12.9%/month
```
**Verdict:** Guaranteed loss. Avoid.

---

## SECTION 4 — POINTS/PIPS TARGETS (6E-FOCUSED)

### 6E Targets ($12.50/pip)

| TF | Strategy | SL (pips) | SL ($) | TP1 (pips) | TP2 (pips) | RR | $/win |
|---|---|---|---|---|---|---|---|
| 1-min | Scalp | 20 | $125 | 20 | — | 1:1 | $125 |
| 5-min | Primary | 40 | $250 | 60 | 80 | 1.5–2:1 | $375 |
| 15-min | Momentum | 60 | $375 | 120 | 180 | 2–3:1 | $750 |
| 1-hour | Swing | 80 | $500 | 160 | 240 | 2–3:1 | $1,000 |

### ES Targets (when combined with 6E)

| TF | Strategy | SL (pts) | TP1 (pts) | RR | $/win |
|---|---|---|---|---|---|
| 5-min | Primary | 10 | 15 | 1.5:1 | $250 |
| 15-min | Momentum | 15 | 30 | 2:1 | $500 |

---

## SECTION 5 — ATR-ONLY TRADING SYSTEM (6E-FOCUSED)

### 5.1 6E ATR Multiples

| Regime | SL ATR | TP1 ATR | TP2 ATR | Notes |
|---|---|---|---|---|
| Normal | 2.0× | 1.5× | 3.0× | Standard 6E |
| High vol (news) | 2.5× | 2.0× | 4.0× | Wider for volatility |
| Low vol | 1.5× | 1.0× | 2.0× | Tighter in quiet markets |

### 5.2 6E ATR Lookup

| TF | ATR-14 (pips) | SL (pips) | TP1 (pips) | TP2 (pips) | $ Risk |
|---|---|---|---|---|---|
| 1-min | 10 pips | 20 | 15 | 30 | $250 |
| 5-min | 20 pips | 40 | 30 | 60 | $500 |
| 15-min | 35 pips | 70 | 52 | 105 | $875 |
| 1-hour | 50 pips | 100 | 75 | 150 | $1,250 |

### 5.3 6E Session Rules

```
LONDON SESSION (2:00–5:00 ET): Best 6E session
  → European markets driving EUR/USD
  → Full ATR multiples apply
  → Volume highest for 6E during London

NY OPEN (7:00–10:00 ET): Second-best 6E session
  → USD drivers dominate (US data, Fed speakers)
  → ATR × 0.90 during data-heavy windows

NY MIDDAY (11:00–14:00 ET): Avoid 6E
  → Low volume, range-bound chop
  → High false breakout rate

LONDON OPEN (2:00–5:00 ET) + NY CLOSE (14:00–17:00 ET):
  → Best correlation plays: 6E long + ES short (USD correlation)
  → Trade simultaneously for portfolio balance
```

### 5.4 Position Sizing

```
For $35K, 6E at $250 risk (40-pip SL):
  Kelly (56% WR, 1.5:1 RR, Full = 25.3%):
  Quarter Kelly = 6.3% × $35,000 = $2,205 risk max
  6E: $250 risk/contract → max 8 contracts
  
  Practical: 1–4 contracts
  ATR = 20 pips: SL = $500 → max 4 contracts
  ATR = 40 pips: SL = $500 → max 4 contracts
```

---

## SECTION 6 — KELLY CRITERION MATH

### 6.1 Kelly Values ($35,000 Account)

| Scenario | WR | RR | Kelly % | $ Risk | 6E Contracts | ES Contracts |
|---|---|---|---|---|---|---|
| A | 52% | 1.0 | 4.0% | $1,400 | 5 | 2 |
| B | 56% | 1.5 | 25.3% | $8,855 | 35 | 17 |
| C | 60% | 2.0 | 40.0% | $14,000 | 56 | 28 |
| D | 50% | 0.75 | NEGATIVE | — | — | — |

**Operating at $250 risk (1-4 contracts) is 1/8th to 1/30th Kelly. Ultra-safe. Correct for 6E's wider pip movements.**

---

## SECTION 7 — DRAWDOWN MATHEMATICS

### 7.1 P(Streak) — 6E at $250 Risk

| WR | P(3 in row) | P(5 in row) | Impact (3 losses) | Impact (5 losses) |
|---|---|---|---|---|
| 50% | 12.5% | 3.1% | −$750 | −$1,250 |
| 56% | 8.5% | 1.5% | −$750 | −$1,250 |
| 60% | 6.4% | 1.0% | −$750 | −$1,250 |

### 7.2 Recovery

| DD | Recovery % | Scenario B EV ($89) | Trades to Recover |
|---|---|---|---|
| 5% ($1,750) | 5.3% | $89 | ~20 trades |
| 10% ($3,500) | 11.1% | $89 | ~39 trades |

---

## SECTION 8 — PROP FIRM COMPARISON

### 8.1 6E-Friendly Firms

Most US prop firms allow 6E futures. Best options:

| Firm | 6E Available | Split | Notes |
|---|---|---|---|
| FTMO | Yes | 80–90% | Best overall |
| MyFundedFutures | Yes | 80–90% | Fast payouts |
| Blue Guardian | Yes | 80–90% | Instant option |

### 8.2 Capital Allocation ($5,000 Personal)

| Item | Amount |
|---|---|
| FTMO 1-Step × 2 | $800 |
| MFF Core × 1 | $77 |
| Recovery reserve | $1,500 |
| Living buffer | $2,623 |
| **Total** | **$5,000** |

---

## SECTION 9 — THREE-PARTNER MATHEMATICAL STRATEGY (6E FOCUS)

**Partner 1 (Poker Pro):** Reads macro sentiment for EUR/USD. Identifies ECB vs. Fed divergence plays. Currency-specific tape reading (M5/M15 candle analysis for 6E).

**Partner 2 (Mathematician):** Computes exact pip-equivalent position sizing for 6E. Cross-asset correlation math: 6E + ES simultaneous positions.

**Partner 3 (Quant):** Monitors EUR-specific volatility. 6E ATR follows different patterns than equity indices (driven by macro, not market hours).

### Entry Criteria (ALL 5):
```
1. Session: London (2–5ET) or NY open (7–10ET)
2. ATR: 0.70×–1.40× of 20-day average
3. Macro catalyst: no major ECB/Fed event in next 30 min
4. Tape: directional candle confirmation on M5
5. RR: ≥ 1.5:1 at entry
```

### Exit:
```
1. SL (2.0× ATR) → close 100%
2. TP1 (1.5× ATR) → close 50%, SL to breakeven
3. TP2 (3.0× ATR) → close remaining 50%
4. 12 bars no TP → market exit
5. Session close → flatten
```

---

## SECTION 10 — INTEGRATED MASTER STRATEGY

### Profile
| Item | Value |
|---|---|
| Capital | $35,000 |
| Primary | 6E (EUR/USD futures) |
| Secondary | ES (portfolio hedge) |
| Kelly | Quarter Kelly = $2,205 risk max |
| Target | 56% WR, 1.5:1 RR |
| Monthly target | +$5,615 (+16.0%) |

### Monthly P&L Summary

| Scenario | Monthly Net | ROI | Annual |
|---|---|---|---|
| A (52%, 1:1) | +$71 | +0.2% | +2.4% |
| **B (56%, 1.5:1)** | **+$5,615** | **+16.0%** | **+192%** |
| C (60%, 2:1) | +$12,041 | +34.4% | +413% |
| D (50%, 0.75:1) | −$4,497 | −12.9% | LOSS |
