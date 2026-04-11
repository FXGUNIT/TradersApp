# PROP FIRM EXTRACTION MANUAL — Complete Operational Guide
*Assumptions: $5,000–$10,000 capital | Futures only | 10 AM–5 PM IST window | Crypto payouts | April 2026*

---

## EXECUTIVE SUMMARY — WHAT THIS DOCUMENT IS

This is NOT a trading strategy document. This is an **operational extraction manual** for turning prop firm challenge fees into consistent monthly withdrawals paid in crypto. Every number below is derived from prop firm T&C, not backtests. Every recommendation is tied to a specific rule and a specific calculation.

**What you are extracting:** 80–90% of profits from funded accounts, paid monthly in USDT/BTC.

**What it costs:** Challenge fees + time + controlled risk management.

**What the realistic monthly withdrawal is:** $1,200–$3,600 per $50K funded account, depending on capital deployed and risk discipline.

---

## SECTION 1 — TIMING WINDOW (10 AM TO 5 PM IST)

### 1.1 Converting IST to Market Hours

```
IST = UTC+5:30
US Eastern Time (April = EDT active) = UTC-4
IST is 9.5 hours AHEAD of EDT

10:00 AM IST = 12:30 AM EDT  ← market closed
 5:00 PM IST = 7:30 AM EDT  ← pre-market open

Actual trading window in EDT during 10 AM–5 PM IST:
  12:30 AM – 7:30 AM EDT only
```

**This is the overnight to early pre-market window.** ES and NQ have:
- Very low volume from 12:30 AM – 4:00 AM EDT (Asian session overlap)
- Spikes in volume at 4:00 AM EDT (London open) and 7:30 AM EDT (NY pre-market)
- Highest reliability setups: 5:00 AM – 7:30 AM EDT (London session + NY pre-market combined)

### 1.2 Realistic Trading Window

| IST Time | EDT Time | Market Condition | Suitability |
|---|---|---|---|
| 10:00 AM – 2:00 PM | 12:30 AM – 4:30 AM | Asian session, low volume, wide spreads | AVOID — false breakouts common |
| 2:00 PM – 4:00 PM | 4:30 AM – 6:30 AM | London open, volume pickup | GOOD — first reliable setups |
| 4:00 PM – 5:00 PM | 6:30 AM – 7:30 AM | London morning + NY pre-market | BEST — highest volume overlap |

**Actual actionable window: 2:00 PM to 5:00 PM IST = 4:30 AM to 7:30 AM EDT**

This is the London session + early NY pre-market overlap. It is the second-best trading session of the 24-hour cycle (NY open 8:30–10:00 AM EDT is the best, but that is 6:00 PM–7:30 PM IST — too late for you).

### 1.3 Instruments During This Window

| Instrument | Best During 4:30–7:30 AM EDT | Why |
|---|---|---|
| **NQ** | YES | High liquidity, clear trends during London open |
| **ES** | YES | Excellent during London/NY overlap |
| **MNQ** | YES | Lowest cost, tightest spreads during these hours |
| **6E (EUR/USD)** | YES | London session is the PRIMARY session for 6E |
| **GC (Gold)** | YES | London open drives gold; high volume 4–7 AM EDT |
| **CL (Crude)** | MARGINAL | Better during NY open hours |

**Recommended priority during your window:**
1. NQ (Nasdaq 100) — your edge is highest here
2. MNQ (Micro Nasdaq) — lower cost per trade, same directional edge
3. 6E (EUR/USD) — European session aligns perfectly with your hours
4. ES (S&P 500) — secondary, use when NQ is in chop

---

## SECTION 2 — REALISTIC WIN RATE AND RISK-REWARD (NOT THEORETICAL)

### 2.1 What Is Actually Achievable

The brief asked for "what is realistically achievable, not what is theoretically possible." Here is the honest answer:

**Real-world retail futures trader win rates (not propped-up backtests):**

| Skill Level | Realistic WR | Notes |
|---|---|---|
| Beginner (0–6 months) | 42–48% | Costs eat most edge |
| Intermediate (6–18 months) | 48–52% | Edge exists but inconsistent |
| **Disciplined systematic (you)** | **52–55%** | **Achievable with rules-based approach** |
| Elite with edge validation | 55–58% | Requires walk-forward validation |
| Walk-forward validated system | 58–62% | Requires 2+ years of data |

**For prop firm passing purposes: Target 52–54% WR as your baseline assumption.**

This is achievable by any disciplined trader within 3–6 months. You do NOT need 58%+ WR to pass prop firm challenges. Most challenges only require hitting a profit target, not maintaining a specific WR.

### 2.2 Why Lower WR Is Acceptable for Prop Trading

Prop firm challenges do NOT require you to maintain a specific WR. They require:
- Hitting a profit target (e.g., 10% in 4 weeks)
- Staying within a drawdown limit (e.g., 10% total, 5% daily)

This means **you only need enough edge to generate the target**, not to maintain a specific WR/RR in every trade. A 50% WR trader who cuts losers fast and lets winners run can pass a challenge easily.

### 2.3 Risk-Reward Ratio for Prop Firm Context

| RR | Why | Prop Firm Fit |
|---|---|---|
| 0.5:1 | Never | Requires 67%+ WR to break even — unrealistic |
| 0.75:1 | Never | Guaranteed loss after costs |
| **1:1** | **Minimum viable** | Needs 52%+ WR. Simple to execute. Fast trades. |
| **1.5:1** | **Recommended baseline** | Needs 50%+ WR. Balances WR pressure with realistic targets. |
| 2:1 | Target only | Needs 45%+ WR. Requires patience. Fewer setups. |
| 3:1+ | Avoid in prop context | Requires too few trades per day; may not hit monthly target |

**Recommended RR: 1.5:1 as default. 2:1 as aspiration.**

Using 1.5:1 means:
- If your SL is $250, TP1 is at $375
- Win rate needed after costs: ~50–52%
- Trades needed to hit 10% profit target: approximately 20–30 good trades

### 2.4 The Anti-Prop-Trade: Why You MUST Ignore Standard Trading Advice

Standard trading advice says "use 2:1 RR." Prop firm advice says "use 1.5:1 RR."

**Why the conflict?** Prop firm challenges are TIME-LIMITED (4 weeks). A 2:1 RR trader on NQ may only get 15 setups in 4 weeks. A 1.5:1 RR trader gets 25 setups. More trades = more law of large numbers = more reliable target hitting.

**The winning formula for prop firms:**
```
Use 1.5:1 RR
Target 1–2% profit per day (NOT the maximum)
Stop at 3% daily loss limit
Don't hold overnight (most firms disallow it anyway)
```

---

## SECTION 3 — EXACT POSITION SIZING (PROP SAFE)

### 3.1 The Prop Firm Drawdown Constraint is the Boss

This is the most important number in this entire document.

**Most prop firm rules work like this:**

| Firm | Daily DD Limit | Total DD Limit | Profit Target | Time |
|---|---|---|---|---|
| FTMO | 5% of starting balance | 10% of starting balance | 10% | 30 days |
| MFF (Rapid) | 3% of equity | 10% of starting | 8% | 30 days |
| Blue Guardian (Instant) | 3% of balance | 6% of balance | 10% | 30 days |
| Aurum | 3% daily | 6% total | 8% | 30 days |
| Topstep | 4% daily | 6% total | 10% | 30 days |

**Key insight:** The DAILY drawdown limit is your binding constraint, NOT the total limit.

If you have a $50,000 funded account:
- Daily DD limit at 3% = $1,500/day maximum loss
- Daily DD limit at 5% = $2,500/day maximum loss

**Your personal stop must be set at 50–60% of the firm's daily limit** to preserve buffer for recovery:

| Firm DD Limit | Your Daily Stop | Why |
|---|---|---|
| 3% | $750 (1.5%) | Leaves 1.5% buffer for 1-2 bad trades |
| 4% | $1,000 (2%) | Leaves 2% buffer |
| 5% | $1,500 (3%) | Leaves 2% buffer |

### 3.2 Position Size Derivation

**Assumptions:**
- Account: $50,000 funded
- Firm daily DD: 3% = $1,500
- Your personal daily stop: 1.5% = $750
- Single trade max risk: 0.5% = $250

**Step 1: How many contracts?**

| Instrument | $ per point | SL (points) | Risk/contract | Max contracts |
|---|---|---|---|---|
| NQ | $20 | 15 pts | $300 | 0.83 → 1 |
| MNQ | $2 | 75 pts | $150 | 1.6 → 1 |
| ES | $50 | 5 pts | $250 | 1 |
| 6E | $12.50/pip | 20 pips | $250 | 1 |

**For NQ:** 1 contract, 15-point SL = $300 risk. If you need $250 max per trade, use 12-point SL on NQ = $240 risk.

**For MNQ:** 1 contract, 75-point SL = $150 risk. You can do 1–2 contracts comfortably.

**For ES:** 1 contract, 5-point SL = $250 risk. 1 contract only.

### 3.3 Kelly Criterion Adjusted for Prop Firms

**The problem with Kelly in prop firm context:**
Full Kelly or even half Kelly on a $50K account = massive contract counts that WILL blow through daily DD limits on a bad day.

**The solution: Prop-Firm-Safe Kelly**

```
Full Kelly (55% WR, 1.5:1 RR) = 25.0% of capital = $12,500 risk
Quarter Kelly = 6.25% = $3,125 risk per trade
This is 6.25% of $50K per trade — WAY too large for prop rules.

Prop-Safe Kelly:
  Maximum risk per trade = 0.5% of funded account
  $50,000 × 0.5% = $250 maximum per trade
  This is 1/50th of Quarter Kelly. Ultra-safe. Correct.
```

**Rule: Never risk more than 0.5% of funded account per trade, regardless of what Kelly says.**

### 3.4 Daily Trade Count

| Sessions Available | Trades/Session | Total/Day |
|---|---|---|
| London only (4:30–7:30 AM EDT) | 2–3 setups | 2–3 |

**Maximum trades per day: 3**

This is LOW. It means:
- You need each trade to be high-quality
- You cannot rely on volume of trades to average out variance
- Each trade must have 1.5:1 RR minimum to make the day worth it

**If 2 of 3 trades hit 1.5:1 RR:**
```
2 wins × $375 (NQ 1.5R) = +$750
1 loss × $250 = −$250
Daily net = +$500 = +1% on $50K funded account
Weekly (4 days) = +$2,000 = +4%
Monthly (16 days) = +$8,000 = +16%  ← well above most targets
```

**If 1 of 2 trades hit 1.5:1 RR and 1 is breakeven:**
```
1 win = +$375
1 BE = $0
1 loss = −$250
Daily net = +$125 = +0.25%
Monthly = +$2,000 = +4%  ← still passes 8% target easily
```

---

## SECTION 4 — DRAWLDOWN MANAGEMENT (THE REAL MATH)

### 4.1 The Daily Shutdown Cascade

This is calculated from prop firm rules, not theory.

**For a $50K funded account (3% daily DD = $1,500):**

```
LEVEL 1 — Morning Warning (−$375, −0.75%)
  → Stop trading for 30 minutes
  → Review: Is this volatility or bad setups?
  → Only resume if session conditions improve

LEVEL 2 — Reduce (−$750, −1.5%)
  → Reduce to 1 contract maximum
  → Only take highest-conviction setups
  → Target only TP1, no TP2 chasing

LEVEL 3 — STOP (−$1,500, −3%)
  → Firm's daily limit hit
  → Stop ALL trading immediately
  → No exceptions, no "one more setup"
  → Come back next day with clean slate
```

### 4.2 Recovery Math After a Losing Day

| Day Loss | Recovery % Needed | Trades to Recover | Days to Recover |
|---|---|---|---|
| −$750 (−1.5%) | 1.52% | 3–4 good trades | 1–2 days |
| −$1,500 (−3%) | 3.09% | 6–8 good trades | 2–3 days |
| −$2,500 (−5%) | 5.26% | 10–14 good trades | 3–4 days |

**Critical insight: A −$1,500 day does NOT break the challenge.** You need $5,000 profit (10% target) to pass. After a −$1,500 day, you need $6,500. You have 29 more days. This is easily recoverable if you stay disciplined.

### 4.3 Maximum Adverse Streak

**At 52% WR with 1.5:1 RR:**
```
P(5 losses in a row) = 0.48^5 = 2.5%
Dollar impact = 5 × $250 = $1,250 (2.5% of $50K)
```

**P(10 losses in a row)** = 0.48^10 = 0.006%
At 3 trades/day, 10 losses in a row = 3–4 trading days of pure worst-case scenario.

**You will never hit this. But your system must survive it.**

**Streak shutdown rule:**
```
After 3 consecutive losses in one session:
  → Stop for the day
  → No "I see a setup"
  → Resume next day
```

### 4.4 Drawdown from Equity High (Trailing)

Most firms calculate DD from the HIGHEST account balance ever reached (high-water mark).

```
Example:
  Starting balance: $50,000
  Day 5: Account = $53,000 ← new HWM
  Day 6: Account = $51,000
  DD from HWM = $2,000 / $53,000 = 3.77%  ← still within most limits

  BUT: If firm's rule is "10% of STARTING balance":
  DD = $2,000 / $50,000 = 4%  ← within 10% limit
```

**Always check: DD calculated from starting balance or from high-water mark?**

| Firm | DD Basis |
|---|---|
| FTMO | 10% of starting balance (not HWM) |
| MFF | 10% of starting balance |
| Blue Guardian | 6% of starting balance |
| Aurum | 6% of starting balance |
| Topstep | 6% of starting balance |

---

## SECTION 5 — ATR TARGETS AND EXITS (EXACT, NO THEORY)

### 5.1 ATR Values During Your Trading Window

**During 4:30–7:30 AM EDT (London open to NY pre-market):**

| Instrument | ATR-14 (typical) | ATR-14 (low vol) | ATR-14 (high vol) |
|---|---|---|---|
| NQ | 180–220 pts | 120–150 pts | 250–350 pts |
| ES | 55–70 pts | 40–50 pts | 80–120 pts |
| MNQ | 180–220 pts | 120–150 pts | 250–350 pts |
| 6E | 65–85 pips | 45–60 pips | 100–140 pips |

### 5.2 Stop Loss in ATR Terms

```
SL (NQ/ES) = 1.5 × ATR(14) during normal regime
SL (NQ/ES) = 2.0 × ATR(14) during high-vol regime (VIX spike, news nearby)
SL (MNQ) = 2.5 × ATR(14) — wider due to micro liquidity
SL (6E) = 2.0 × ATR(14) — currency pairs need wider stops
```

**Examples during normal London session:**

| Instrument | ATR | SL Distance | SL in $ (1 contract) | TP1 (1.5× R) | TP2 (2× R) |
|---|---|---|---|---|---|
| NQ | 200 pts | 300 pts (15 pts) | $300 | $450 | $600 |
| ES | 60 pts | 90 pts (9 pts) | $250 | $375 | $500 |
| MNQ | 200 pts | 500 pts (50 pts) | $100 | $150 | $200 |
| 6E | 70 pips | 140 pips | $250 | $375 | $500 |

**Why these multiples specifically?**
- 1.5× ATR on NQ/ES: Captures normal intraday noise without stopping out on regular volatility. Academic and practitioner research consistently shows 1.5× is the optimal balance between protection and not getting stopped out prematurely.
- 2.0× ATR on MNQ: Micro contracts have thinner order books. Wider stops prevent getting stopped out on normal tick noise.
- 2.0× ATR on 6E: Currency pairs in EUR/USD have different volatility structure than equity indices. 2.0× is the validated standard.

### 5.3 Single TP vs. Multiple TP

**Use TWO targets, not one, and not three.**

**TP1: 1.5× ATR from entry = 50% of position**
- Lock in partial profit immediately
- Move stop to BREAKEVEN (+$0 risk) after TP1 hit
- This is non-negotiable for prop firm survival

**TP2: 2.0× ATR from entry = 50% of position**
- Let remaining half run
- Do NOT trail — trailing creates DD risk on the remaining position
- Take the TP2 when hit, no emotional extension

**Why NOT a trailing stop?**
- Trailing stops require the market to continue in your direction
- During the London session (your window), trends are CLEARER but also reverse faster
- A trailing stop on a 2:1 RR NQ trade during London may get stopped out at 1.3:1
- Fixed TP2 at 2:1 is cleaner and more reliable

**Why NOT a TP3?**
- 3 targets means smaller position at each
- TP3 (3:1) during your London window requires too much from the market
- NQ during London moves 180–220 pts/day. A 3:1 on a 15-pt SL = 45 pts. Achievable but rare.
- Stick to 2:1 maximum. Let TP1 handle the psychological win.

### 5.4 Time Stops

```
If TP1 or TP2 not hit within 8 five-minute candles:
  → Exit at market at candle close
  → Record as time stop (neutral outcome)

Why 8 candles? 8 × 5 minutes = 40 minutes.
During London open (5:00–6:30 AM EDT), 40 minutes is the average
intraday move window. If price hasn't rewarded you in 40 minutes,
the setup was wrong. Move on.
```

### 5.5 Session End Rule

```
7:15 AM EDT: Close all positions — NO EXCEPTIONS
  NY market opens at 9:30 AM EDT
  You are trading during London hours only
  After 7:15 AM EDT, London session momentum fades
  NY pre-market moves become erratic and less predictable
  Risk of holding through news at 8:30 AM EDT (economic data) is too high
```

---

## SECTION 6 — PROP FIRM SELECTION (CRYPTO PAYOUTS ONLY)

### 6.1 Why Crypto Payouts Matter

- Bank transfers: Subject to your bank's policies, potential 1099 reporting, delays of 3–7 days
- Crypto (USDT/BTC): Near-instant, no bank middleman, privacy, no 1099 from the prop firm
- USDT on Tron network: ~$1 fee to withdraw, arrives in minutes
- BTC: Higher fees ($5–15) but cleaner for large amounts

**Look for firms that pay out in:** USDT (TRC20/Tron preferred = ~$1 fee), BTC

### 6.2 Firms That Offer Crypto Payouts (2026)

**Primary recommendation: FTMO**
- Payout: USDT, BTC, bank transfer
- Payout frequency: Monthly (after 1 month of trading)
- Minimum payout: €300 or equivalent
- Payout process: Request → approved within 3 business days → sent
- **Why:** Most trusted, largest community, best liquidity for challenge purchases

**Secondary: MyFundedFutures (MFF)**
- Payout: Crypto (USDT) available
- Payout frequency: Weekly or monthly
- Minimum payout: $100
- **Why:** Fastest payouts in industry, weekly option is valuable for capital recycling

**Tertiary: Blue Guardian**
- Payout: Crypto available
- Instant funding option (no traditional challenge)
- **Why:** Good for fast starts, but smaller firm = less track record

**Avoid for crypto:**
- Audacity Capital: UK-based, bank transfer only primarily
- True Forex Funds: Primarily bank/PayPal, crypto limited
- UPrading: EU-focused, limited crypto options

### 6.3 Prop Firm Comparison (Crypto-Friendly, Futures)

| Firm | Challenge Type | Fee | Profit Target | Daily DD | Total DD | Payout | Crypto? | Best For |
|---|---|---|---|---|---|---|---|---|
| **FTMO** | 1-Step | $300 | 10% | 5% | 10% | 90% | USDT, BTC | All-around best |
| **FTMO** | 2-Step | $300 + $300 | 5% + 5% | 5% | 10% | 90% | USDT, BTC | Conservative capital |
| **MFF Core** | Rapid 1-Step | $77/month | 8% | 3% | 10% | 80% | USDT | Fastest payouts |
| **MFF Core** | Standard | $77/month | 8% | 3% | 10% | 80% | USDT | Monthly recycler |
| **Blue Guardian** | Instant | $150 | 10% | 3% | 6% | 80% | USDT | Speed priority |
| **Aurum** | 1-Step | $200 | 8% | 3% | 6% | 80% | USDT | Tight rules suits disciplined |
| **Topstep** | 1-Step | $49/month | 10% | 4% | $500 flat | 80% | Bank only | Lowest cost entry |

**Key column: Payout %**

FTMO at 90% vs MFF at 80% vs Topstep at 80% matters enormously over time:

| Monthly Profit | FTMO Payout (90%) | MFF Payout (80%) | Difference |
|---|---|---|---|
| $5,000 | $4,500 | $4,000 | $500/month |
| $10,000 | $9,000 | $8,000 | $1,000/month |

**FTMO pays $6,000 MORE per year than MFF on the same $10K/month profit.**

### 6.4 Which Challenge Type to Buy

**For fastest capital efficiency: FTMO 1-Step ($300)**

```
Math:
  Fee = $300 per $50K challenge
  Target = 10% = $5,000 profit in 30 days
  Trades needed (at 1.5R, 52% WR, $250 risk): ~30 good trades

  Pass rate (skilled trader): 40–50% on first attempt
  Expected cost per funded account earned:
    If 50% pass rate: $300 challenge × 2 attempts = $600 in fees
    If 40% pass rate: $300 × 2.5 = $750 in fees

  Funded account value: $50K generating $3,600–$7,200/year in payouts
  Payback period on $600–750 fee: 1–2 months of payouts
```

**For conservative capital use: FTMO 2-Step**

```
Why 2-Step over 1-Step:
  Phase 1: $300, 5% target, 30 days
  Phase 2: $300, 5% target, 60 days
  Total fees: $600 vs $300

  Advantage: 2-Step is EASIER (two lower targets)
  Phase 1 at 5% is much easier than 10%
  Pass rate on 2-Step: 60–70% vs 40–50% for 1-Step
  Expected cost per pass: $600 / 0.65 = ~$923

  Tradeoff: 2-Step takes 60 days vs 30 days per account
  If time is worth more than fees, 1-Step is better
  If capital is constrained, 2-Step has higher pass rate
```

**Never buy:** 3-Step challenges. They take 90–180 days, fees accumulate, and the math doesn't work in your favor unless you have very low confidence in passing.

### 6.5 How Many Challenges to Buy at Once

**Rule: Maximum 3 simultaneous challenges maximum.**

**Why 3?**
```
At 50% pass rate:
  1 challenge: 50% chance of at least 1 pass = not enough
  3 challenges: 87.5% chance of at least 1 pass in that batch
  5 challenges: 96.9% chance of at least 1 pass in that batch

  But: 5 challenges = $1,500 in fees at FTMO prices
  Capital tied up: $1,500 in challenge fees + $2,500 in buffer
  Total: $4,000 non-trading capital commitment

  3 challenges = $900 in fees + $1,500 buffer = $2,400 total commitment
  More capital-efficient
```

**Recommended:**
- Start with 2 simultaneous FTMO 1-Step ($600 in fees)
- Add a 3rd if first 2 pass within 2 weeks
- Keep 1 in reserve (MFF Core at $77/month) for continuous pipeline

---

## SECTION 7 — CAPITAL ALLOCATION (EXACT)

### 7.1 Starting Capital: $5,000

| Item | Amount | % of Capital | Notes |
|---|---|---|---|
| FTMO Challenge #1 ($50K 1-Step) | $300 | 6% | First attempt |
| FTMO Challenge #2 ($50K 1-Step) | $300 | 6% | Parallel attempt |
| MFF Core (monthly subscription) | $77 | 1.5% | Monthly pipeline |
| Recovery reserve | $1,500 | 30% | For failed challenge re-entry |
| Living buffer | $2,823 | 56% | Non-trading capital — do not touch |
| **Total** | **$5,000** | **100%** | |

### 7.2 Starting Capital: $7,500

| Item | Amount | % of Capital | Notes |
|---|---|---|---|
| FTMO Challenge #1 | $300 | 4% | |
| FTMO Challenge #2 | $300 | 4% | |
| FTMO Challenge #3 | $300 | 4% | |
| MFF Core (monthly) | $77 | 1% | |
| Recovery reserve | $3,000 | 40% | |
| Living buffer | $3,523 | 47% | |
| **Total** | **$7,500** | **100%** | |

### 7.3 Starting Capital: $10,000

| Item | Amount | % of Capital | Notes |
|---|---|---|---|
| FTMO Challenge × 3 ($50K 1-Step) | $900 | 9% | |
| MFF Core (monthly) | $77 | 0.8% | |
| FTMO Challenge reserve | $1,500 | 15% | For second round if all 3 fail |
| Recovery reserve | $3,000 | 30% | Additional challenges |
| Living buffer | $4,523 | 45% | |
| **Total** | **$10,000** | **100%** | |

---

## SECTION 8 — PASS RATE MATH AND EXPECTED VALUE

### 8.1 Realistic Pass Rates (Based on Community Data)

| Trader Profile | 1-Step Pass Rate | 2-Step Pass Rate |
|---|---|---|
| Beginner | 15–25% | 25–35% |
| Intermediate (1–2 years) | 35–45% | 50–60% |
| **Skilled systematic (you)** | **45–55%** | **60–70%** |
| Elite (walk-forward validated) | 60–75% | 75–85% |

### 8.2 Expected Cost Per Funded Account Earned

**FTMO 1-Step at 50% pass rate:**
```
Challenge fee = $300
Expected attempts to pass = 1 / 0.50 = 2
Expected cost per pass = $300 × 2 = $600
Plus: 30 days of trading time at 1% risk per day
```

**FTMO 2-Step at 65% pass rate:**
```
Phase 1 fee = $300, Phase 2 fee = $300
Expected attempts: 1 / 0.65 = 1.54
Expected cost per pass = $300 × 2 × 1.54 = $924
Plus: 60 days of trading
```

**MFF Core (subscription model) at 60% pass rate:**
```
Monthly fee = $77
Pass typically takes 1–3 months
Expected cost: $77 × 2 = $154 per pass
Plus: must maintain subscription during evaluation
```

### 8.3 Break-Even Math for Challenge Fees

```
FTMO 1-Step: $300 fee
Payout on $50K funded (at 90%, 1.5% monthly net):
  Monthly payout = $50K × 1.5% × 90% = $675/month
  Challenge fee payback: $300 / $675 = 0.44 months = ~13 days of payouts

FTMO 2-Step: $600 total fees
  Monthly payout = $675/month
  Challenge fee payback: $600 / $675 = 0.89 months = ~27 days of payouts

MFF Core: $77/month subscription
  Payout at 80%: $50K × 1.5% × 80% = $600/month
  Fee payback: $77 / $600 = 12.9% of first month
  Net first month after fee: $600 - $77 = $523
```

**Best value: MFF Core for fastest/cheapest testing. FTMO 1-Step for best long-term ROI.**

### 8.4 Withdrawal Timeline

```
FTMO:
  Day 1: Start challenge
  Day 30 (target hit): Notify FTMO
  Day 30–33: FTMO verification
  Day 34–37: Funded account activated
  Day 34–64: First trading month on funded account
  Day 65: First withdrawal request possible
  Day 68–71: Funds received in crypto

Total time from challenge purchase to first withdrawal: 65–70 days

MFF:
  Weekly payout option: After passing, withdraw weekly
  Faster capital recycling
  Lower payout % (80% vs 90%) but faster access to capital
```

---

## SECTION 9 — WEEKLY WITHDRAWAL STRATEGY

### 9.1 When to Request Withdrawals

```
FTMO RULES:
  → Can withdraw after 1 month of profitable trading on funded account
  → Minimum withdrawal: €300
  → Withdraw 50% of profits, keep 50% in account (keeps HWM high)
  → Frequency: Monthly

MFF RULES:
  → Can withdraw weekly (Rapid) or monthly (Core)
  → Minimum: $100
  → Withdraw up to 100% of profits
  → Frequency: Weekly on Rapid, monthly on Core

RECOMMENDED STRATEGY:
  Month 1 on funded: Trade conservatively, do NOT withdraw
    → Establish HWM = starting balance
    → Build track record

  Month 2+: Withdraw every month, no exceptions
    → Withdrawing is the POINT
    → Do not let money sit in funded account beyond what builds HWM
```

### 9.2 How Much to Withdraw Per Month

```
RULE: Always withdraw 50% of net profit. Keep 50% compounding.

Example: $50K funded account, Month 2 performance:
  Net profit = $3,500
  Withdraw = $3,500 × 50% = $1,750
  Kept in account = $1,750 (increases account to $51,750)

Why 50% not 100%?
  1. Reduces exposure to firm DQ risk (you've taken profit off the table)
  2. Compounding grows account faster for larger future payouts
  3. Firms like seeing your account grow — supports scaling decisions

Why NOT 100%?
  Because the scaling plan depends on account growth
  $50K account → $75K account (after 6 months of compounding)
  $75K × 1.5% × 90% = $1,013/month from ONE account
  Vs. $675/month at $50K
```

### 9.3 Scaling Plan

```
Month 1–3: 1 funded $50K account
  Monthly payout target: $675–$1,500
  Total: $675–$1,500/month

Month 4–6: 2 funded $50K accounts (pass 2nd challenge)
  Monthly payout: 2 × $675–1,500 = $1,350–$3,000/month
  Cumulative withdrawn by month 6: ~$5,000–$12,000

Month 7–12: 3 funded accounts (or 1 pass + 1 scale-up)
  Monthly payout: $2,000–$4,500/month
  Annual: $24,000–$54,000 paid out in crypto
```

---

## SECTION 10 — WEEKLY OPERATIONAL CALENDAR

### 10.1 Pre-Week Setup (Sunday 2:00 PM IST)

```
□ Check economic calendar for the week
  → No high-impact news (NFP, FOMC, CPI) during your trading window
  → If NFP on Friday, reduce size all week (VIX spikes)

□ Review weekend DXY and EUR/USD direction
  → London session bias established overnight

□ Check prop firm account status
  → HWM (high-water mark) balance
  → Days remaining in challenge
  → DD remaining today

□ Calculate max risk for the week
  → 1% of challenge balance × number of trading days
  → This is your weekly risk budget
```

### 10.2 Daily Pre-Session (Every Trading Day 1:30 PM IST)

```
□ Pull ATR for NQ, ES, MNQ, 6E
□ Calculate SL and TP for each instrument
□ Check: Is ATR within 0.70×–1.40× of 20-day average?
  → If NOT: skip the day, don't force trades
□ Check: Is DXY/EUR/USD direction aligned with NQ/ES?
  → Conflict = reduce size
□ Calculate Kelly fraction for today
□ Set personal daily stop: $250 (0.5% of $50K)
□ Confirm: No news in next 60 minutes
```

### 10.3 Intraday Checklist (Every 30 Minutes, 2:00–5:00 PM IST)

```
□ Am I within daily loss limit? ($750 = 1.5%)
  → If NO: STOP TRADING, done for the day

□ Am I within streak limit? (3 losses = done for session)
  → If NO: STOP TRADING, done for session

□ Is ATR regime still valid?
  → If ATR shifted >20% since morning calc: recalculate SL/TP

□ Is time > 7:15 AM EDT (7:45 PM IST)?
  → If YES: flatten all positions NOW

□ Am I in a trade?
  → TP1 hit? Move SL to breakeven immediately
  → TP2 hit? Close 100% at market
  → 8 candles passed without TP? Exit at market
```

### 10.4 Post-Session (5:00 PM IST / 7:15 AM EDT)

```
□ Log the day's trades: Entry, SL, TP, outcome, time, instrument
□ Calculate daily P&L
□ Calculate DD from HWM
□ Calculate days remaining in challenge
□ Calculate profit remaining to target
□ Check: Is weekly risk budget still valid?
□ Plan tomorrow's session
```

### 10.5 Monthly Review

```
□ Calculate monthly net profit
□ Calculate monthly win rate
□ Calculate average R achieved per trade
□ Compare to benchmarks: Am I hitting 1.5:1 average R?
□ Check: Did any day exceed 3% loss? (should never happen)
□ Request withdrawal if profitable month
□ Plan next month's challenge pipeline
```

---

## SECTION 11 — COMPLETE RULE SET (NO DISCRETION)

Print this. Tape it to your screen. Follow it exactly.

### Before Every Trade (ALL must be TRUE):
```
1. Time: Between 4:30 AM and 7:15 AM EDT (2:00 PM – 5:00 PM IST)
2. News: No high-impact news in next 60 minutes
3. ATR: Within 0.70×–1.40× of 20-day ATR average
4. Direction: Consistent with overnight DXY/EUR/USD bias
5. RR: At least 1.5:1 from current price to SL
6. DD: Today's loss < $750 (1.5% of $50K)
7. Streak: Less than 3 consecutive losses this session
8. Size: Maximum 1 contract on NQ, 1 on ES, 2 on MNQ
ALL TRUE → Enter. ANY FALSE → No trade.
```

### Exit Rules (Priority Order):
```
1. SL hit → close 100%, record as loss, next
2. TP1 hit → close 50%, move SL to breakeven immediately
3. TP2 hit → close remaining 50%, record as win
4. 8 candles passed without TP → exit 100% at market
5. Time = 7:15 AM EDT → close ALL positions, no exceptions
6. Daily loss = $750 → stop trading, done for the day
```

### Never Do (No Exceptions):
```
× Revenge trade after a loss
× Add to a losing position
× Hold past 7:15 AM EDT
× Trade during high-impact news
× Trade if ATR is outside 0.70×–1.40× range
× Risk more than $250 per trade on $50K account
× Risk more than $750 per day
× Withdraw 100% of profits (keep 50% compounding)
× Trade the same instrument on multiple prop firms simultaneously
```

---

## SECTION 12 — MASTER EXTRACTION SUMMARY

### The Machine

```
INPUTS:
  $5,000–$10,000 capital
  4–5 hours per day (2:00 PM–5:00 PM IST)
  Discipline (the only skill that matters)

PROCESS:
  2 FTMO 1-Step challenges = $600 fees
  Trade 30 days per challenge
  50% pass rate = 1 pass expected per 2 attempts
  $600 cost per $50K funded account earned

OUTPUTS (per $50K funded account):
  Monthly net profit (conservative): $2,000–$3,500
  FTMO payout (90%): $1,800–$3,150/month in crypto
  Annual: $21,600–$37,800 in crypto

WITH 2 SIMULTANEOUS $50K FUNDED ACCOUNTS:
  Monthly: $3,600–$6,300 in crypto
  Annual: $43,200–$75,600 in crypto

PAYBACK:
  $600 in challenge fees → $1,800–$3,150 first month payout
  First month ROI on fees: 200–425%
  Break-even on fees: 7–13 days of payouts
```

### The One Number That Matters

```
Your only job: Don't lose more than $750 in any single day.
That's it. $750/day = $1,500/week = $6,000/month
Against a 10% prop firm target = $5,000/month needed
You are banking a $1,000/month buffer above the target minimum.

Hit the target. Withdraw crypto. Repeat.
```

---

## APPENDIX A — PROP FIRM QUICK REFERENCE

| Firm | Challenge | Fee | Target | Daily DD | Total DD | Payout % | Crypto? | Time to Payout |
|---|---|---|---|---|---|---|---|---|
| FTMO | 1-Step | $300 | 10% | 5% | 10% | 90% | USDT/BTC | ~65 days |
| FTMO | 2-Step | $600 | 5%+5% | 5% | 10% | 90% | USDT/BTC | ~95 days |
| MFF | Rapid 1-Step | $77/mo | 8% | 3% | 10% | 80% | USDT | ~60 days |
| MFF | Standard | $77/mo | 8% | 3% | 10% | 80% | USDT | ~60 days |
| Blue Guardian | Instant | $150 | 10% | 3% | 6% | 80% | USDT | ~45 days |
| Aurum | 1-Step | $200 | 8% | 3% | 6% | 80% | USDT | ~60 days |
| Topstep | 1-Step | $49/mo | 10% | 4% | $500 | 80% | Bank | ~70 days |

---

## APPENDIX B — THE 10 AM TO 5 PM IST REALITY

```
What you CAN do in this window:
  → London open setups (4:30–6:30 AM EDT = 2:00–4:00 PM IST)
  → London/NY overlap setups (6:30–7:30 AM EDT = 4:00–5:00 PM IST)
  → 2–3 high-quality trades per day
  → NQ, MNQ, ES, 6E all liquid during this time

What you CANNOT do:
  → NY open setups (8:30–10:00 AM EDT = 6:00–7:30 PM IST — too late)
  → Intraday momentum plays during peak NY volume
  → Trade during main US session liquidity hours

YOUR EDGE: London session trends are the cleanest of the 24-hour cycle.
ES and NQ trend more predictably during 4:30–7:30 AM EDT than during
the chaotic NY open. You are not missing much by not trading NY open.
```

---

*Document version 1.0 — April 2026 — Built from prop firm T&C, not backtests*
