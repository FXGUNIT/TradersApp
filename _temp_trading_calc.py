import math, random

random.seed(42)
R = 250
COSTS = {'ES': 9.50, 'NQ': 9.50, 'MNQ': 3.40, '6E': 12.00}

def simulate(p, rrat, cost, n_trades=250, n_sims=10000,
            init_capital=25000, use_fixed_risk=True, risk_pct=None):
    """
    use_fixed_risk=True: risk fixed $R per trade (our strategy)
    use_fixed_risk=False: risk risk_pct of current equity per trade (Kelly)
    """
    outcomes = []
    max_dds = []

    for _ in range(n_sims):
        equity = float(init_capital)
        peak = equity
        dd_list = []

        for t in range(n_trades):
            if use_fixed_risk:
                risk_dollar = R
            else:
                risk_dollar = risk_pct * equity

            if random.random() < p:
                equity += risk_dollar * rrat - cost
            else:
                equity -= risk_dollar + cost

            if equity > peak:
                peak = equity
            dd = (peak - equity) / peak if peak > 0 else 0
            dd_list.append(dd)

        max_dds.append(max(dd_list))
        final_ret = (equity - init_capital) / init_capital
        outcomes.append(final_ret)

    outcomes.sort()
    max_dds.sort()
    n = n_sims

    return {
        'median_return': outcomes[n//2],
        'p10': outcomes[int(n*0.10)],
        'p5':  outcomes[int(n*0.05)],
        'p1':  outcomes[int(n*0.01)],
        'pct_neg':     sum(1 for x in outcomes if x < 0) / n,
        'pct_10dd':    sum(1 for x in max_dds if x >= 0.10) / n,
        'pct_20dd':    sum(1 for x in max_dds if x >= 0.20) / n,
        'pct_30dd':    sum(1 for x in max_dds if x >= 0.30) / n,
        'med_max_dd':  max_dds[n//2],
        'p95_max_dd':  max_dds[int(n*0.95)],
        'p99_max_dd':  max_dds[int(n*0.99)],
    }


scenarios = [
    ('A: 50% WR, 1:1 RR (break-even)',     0.50, 1.0),
    ('B: 55% WR, 1.5:1 RR (pro viable)',   0.55, 1.5),
    ('C: 60% WR, 2:1 RR (world-class)',     0.60, 2.0),
    ('D: 50% WR, 0.75:1 RR (amateur)',     0.50, 0.75),
]

print('='*80)
print('MONTE CARLO: 250 trades, $25K init, $250 fixed risk, $9.50 cost (ES/NQ)')
print('='*80)

print()
print('FIXED RISK MODEL: $250 per trade regardless of equity')
print('-'*80)
hdr = f"{'Scenario':<42} {'Med Ret':<10} {'P10':<10} {'P5':<10} {'Med DD':<10} {'P95 DD':<10} {'P99 DD':<10} {'P<0':<8} {'P10DD':<8} {'P20DD':<8}"
print(hdr)
for name, p, rrat in scenarios:
    res = simulate(p, rrat, 9.50, n_trades=250)
    print(f"{name:<42} {res['median_return']:>+.1%}   {res['p10']:>+.1%}   {res['p5']:>+.1%}   {res['med_max_dd']:>+.1%}   {res['p95_max_dd']:>+.1%}   {res['p99_max_dd']:>+.1%}   {res['pct_neg']:>6.1%}  {res['pct_10dd']:>6.1%}  {res['pct_20dd']:>6.1%}")

print()
print('MONTHLY PROJECTIONS (20 trading days, 3 trades/day = 60 trades/month)')
print('-'*80)
print(f"{'Scenario':<42} {'Trd/mo':<8} {'Gross/mo':<12} {'Cost/mo':<10} {'Net/mo':<12} {'ROI/mo':<10}")
for name, p, rrat in scenarios:
    cost = 9.50
    avg_trade = p*(rrat*R - cost) - (1-p)*(R + cost)
    gross = avg_trade * 60
    costs_total = cost * 60
    net = gross - costs_total
    roi = net / 25000
    print(f"{name:<42} {60:<8} ${gross:>9.1f}  ${costs_total:>8.1f}  ${net:>9.1f}  {roi:>+.1%}")

print()
print('ANNUAL PROJECTIONS (250 trades, same assumptions)')
print('-'*80)
print(f"{'Scenario':<42} {'Trd/yr':<8} {'Gross/yr':<12} {'Cost/yr':<10} {'Net/yr':<12} {'ROI/yr':<10}")
for name, p, rrat in scenarios:
    cost = 9.50
    avg_trade = p*(rrat*R - cost) - (1-p)*(R + cost)
    gross = avg_trade * 250
    costs_total = cost * 250
    net = gross - costs_total
    roi = net / 25000
    print(f"{name:<42} {250:<8} ${gross:>9.1f}  ${costs_total:>8.1f}  ${net:>9.1f}  {roi:>+.1%}")

print()
print('PROBABILITY OF HITTING DRAWDOWN (250 trades, 10K sims)')
print('-'*80)
print(f"{'Scenario':<42} {'P(10%DD)':<12} {'P(20%DD)':<12} {'P(30%DD)':<12}")
for name, p, rrat in scenarios:
    res = simulate(p, rrat, 9.50, n_trades=250)
    print(f"{name:<42} {res['pct_10dd']:>10.1%}  {res['pct_20dd']:>10.1%}  {res['pct_30dd']:>10.1%}")

print()
print('KELLY FRACTION (no-cost formula: f* = (p*(b+1)-1)/b)')
print('-'*80)
print(f"{'Scenario':<42} {'f* (full)':<12} {'HalfKelly':<12} {'QtrKelly':<12}")
for name, p, rrat in scenarios:
    b = rrat
    f_star = max(0.0, (p*(b+1) - 1) / b) if b > 0 else 0.0
    print(f"{name:<42} {f_star:>10.1%}     {f_star*0.5:>10.1%}     {f_star*0.25:>10.1%}")

print()
print('EXPECTED GEOMETRIC GROWTH (250 trades, Kelly fraction of equity)')
print('cost expressed as fraction of $25K init capital per trade')
print('-'*80)
cost_dollar = 9.50
init_cap = 25000.0
c_frac = cost_dollar / init_cap  # 0.00038 per trade

print(f"{'Scenario':<42} {'Kelly':<8} {'f':<8} {'G/trade':<12} {'Ann G(250)':<12}")
for name, p, rrat in scenarios:
    b = rrat
    f_star = max(0.0, (p*(b+1) - 1) / b) if b > 0 else 0.0
    for frac, label in [(1.0, 'Full'), (0.5, 'Half'), (0.25, 'Qtr')]:
        f = frac * f_star
        if f <= 0.0001:
            continue
        W = 1 + f*b - c_frac
        L = 1 - f - c_frac
        if W > 0 and L > 0:
            G = p*math.log(W) + (1-p)*math.log(L)
            G250 = (1+G)**250 - 1
            print(f"{name:<42} {label:<8} {f:.1%}    {G:>+.3%}     {G250:>+.1%}")
        else:
            print(f"{name:<42} {label:<8} {f:.1%}    NEGATIVE      N/A")
    print()

print()
print('MNQ ANALYSIS (cost=$3.40 RT, R=$250 fixed risk)')
print('-'*80)
print(f"{'Scenario':<42} {'Gross/yr':<12} {'Cost/yr':<10} {'Net/yr':<12} {'ROI/yr':<10}")
for name, p, rrat in scenarios:
    cost = 3.40
    avg_trade = p*(rrat*R - cost) - (1-p)*(R + cost)
    gross = avg_trade * 250
    costs_total = cost * 250
    net = gross - costs_total
    roi = net / 25000
    print(f"{name:<42} ${gross:>9.1f}  ${costs_total:>8.1f}  ${net:>9.1f}  {roi:>+.1%}")

print()
print('6E ANALYSIS (cost=$12.00 RT, R=$250 fixed risk)')
print('-'*80)
print(f"{'Scenario':<42} {'Gross/yr':<12} {'Cost/yr':<10} {'Net/yr':<12} {'ROI/yr':<10}")
for name, p, rrat in scenarios:
    cost = 12.00
    avg_trade = p*(rrat*R - cost) - (1-p)*(R + cost)
    gross = avg_trade * 250
    costs_total = cost * 250
    net = gross - costs_total
    roi = net / 25000
    print(f"{name:<42} ${gross:>9.1f}  ${costs_total:>8.1f}  ${net:>9.1f}  {roi:>+.1%}")

print()
print('DD RECOVERY: Trades needed to recover at various WR/RR')
print('-'*80)
# At recovery, cumulative P&L = DD amount
# p*n*(rrat*R - c) - (1-p)*n*(R + c) = DD_amount
# n = DD_amount / [p*(rrat*R-c) - (1-p)*(R+c)]
for dd_pct in [0.10, 0.20, 0.30, 0.40, 0.50]:
    dd_dollar = dd_pct * 25000
    print(f"  Recover from {dd_pct:.0%} DD = ${dd_dollar:,.0f}:")
    for name, p, rrat in scenarios:
        cost = 9.50
        ev_per_trade = p*(rrat*R - cost) - (1-p)*(R + cost)
        if ev_per_trade > 0:
            n = dd_dollar / ev_per_trade
            print(f"    {name}: {n:.0f} net-winning trades")
        else:
            print(f"    {name}: UNRECOVERABLE (negative EV)")
    print()

print()
print('PROBABILITY OF N CONSECUTIVE LOSSES')
print('-'*80)
print(f"{'N':<6}" + ''.join(f"  WR={wr:.0%}  " for wr in [0.40, 0.45, 0.50, 0.55, 0.60]))
for n in [5, 10, 15, 20, 25, 30]:
    row = f"{n:<6}"
    for wr in [0.40, 0.45, 0.50, 0.55, 0.60]:
        prob = (1-wr)**n
        row += f"  {prob:.5%} "
    print(row)

print()
print('SHUTDOWN THRESHOLD: how many losing days before $0?')
print('Scenario B (55% WR, 1.5:1 RR):')
# $250 risk * 3 trades/day * loss rate
p, rrat, cost = 0.55, 1.5, 9.50
loss_per_trade = R + cost
avg_loss_per_day_3trades = (1-p) * 3 * loss_per_trade
print(f"  Avg loss per losing trade: ${loss_per_trade}")
print(f"  Expected loss on losing day (3 trades): ${avg_loss_per_day_3trades:.0f}")
print(f"  Days to blow $25K at $250 risk: {25000/(loss_per_trade*3):.0f} (if every trade lost)")
print(f"  Actual expected daily loss (55% WR): {(1-p)*3*loss_per_trade - p*3*(rrat*R-cost):.1f}")
# Shutdown: stop trading for the day if risk of exceeding 4% daily DD
# 4% of $25K = $1,000
# P(3 losses in a row) = (1-p)^3 = 0.45^3 = 9.1%
# Expected loss if 3 losses = $259.50 * 3 = $778.50
# Actually let's compute daily loss threshold
daily_dd_limit = 0.04 * 25000  # $1,000 (4% daily DD)
print(f"  Daily DD limit (prop): ${daily_dd_limit}")
loss_per_trade = R + cost
n_losses_to_dd = daily_dd_limit / loss_per_trade
print(f"  Losses to hit 4% DD: {n_losses_to_dd:.1f} trades")
print(f"  P(4 consecutive losses, 3 trades/day): {(1-p)**4:.3%}")
