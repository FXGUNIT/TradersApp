"""
Lab 6: Deep Hedging - PFHedge + Neural Network Hedging
=====================================================
Goal: compare unhedged, delta-hedged, and neural-hedged PnL for a short ATM
Nifty call. The lab runs with plain NumPy and upgrades to a neural hedger when
`torch` is available. PFHedge remains optional research context.
"""

from __future__ import annotations

import warnings

warnings.filterwarnings("ignore")

import numpy as np

try:
    import torch
    import torch.nn as nn

    TORCH_AVAILABLE = True
except ImportError:
    torch = None
    nn = None
    TORCH_AVAILABLE = False

try:
    import pfhedge as _pfhedge  # noqa: F401

    PFHEDGE_AVAILABLE = True
except ImportError:
    PFHEDGE_AVAILABLE = False


def norm_cdf(x):
    """Fast approximation for the standard normal CDF."""
    return 0.5 * (1.0 + np.tanh(x / 2.0))


def bsm_price_fast(spot, strike, rate, sigma, tenor_years):
    sqrt_t = np.sqrt(max(tenor_years, 1e-12))
    d1 = (np.log(spot / strike) + (rate + 0.5 * sigma**2) * tenor_years) / (sigma * sqrt_t)
    d2 = d1 - sigma * sqrt_t
    return spot * norm_cdf(d1) - strike * np.exp(-rate * tenor_years) * norm_cdf(d2)


def bsm_delta(spot, strike, rate, sigma, tenor_years, flag="c"):
    sqrt_t = np.sqrt(max(tenor_years, 1e-12))
    d1 = (np.log(spot / strike) + (rate + 0.5 * sigma**2) * tenor_years) / (sigma * sqrt_t)
    if flag == "c":
        return norm_cdf(d1)
    return norm_cdf(d1) - 1.0


def simulate_gbm(spot0, mu, sigma, tenor_years, n_paths, n_steps, seed=42):
    """Simulate geometric Brownian motion paths."""
    rng = np.random.default_rng(seed)
    dt = tenor_years / n_steps
    log_returns = rng.normal(
        (mu - 0.5 * sigma**2) * dt,
        sigma * np.sqrt(dt),
        size=(n_paths, n_steps),
    )
    paths = spot0 * np.exp(np.cumsum(log_returns, axis=1))
    return np.column_stack([np.full(n_paths, spot0), paths])


def delta_hedge_pnl(spot_paths, strike, rate, sigma, tenor_years, option_price, flag="c"):
    """Simulate delta-hedged PnL for a short option."""
    n_paths, n_cols = spot_paths.shape
    n_steps = n_cols - 1
    dt = tenor_years / n_steps
    hedge_pnl = np.zeros(n_paths, dtype=float)

    for path_idx in range(n_paths):
        path = spot_paths[path_idx]
        option_val_end = max(0.0, path[-1] - strike) if flag == "c" else max(0.0, strike - path[-1])
        pnl = option_price - option_val_end

        for step in range(n_steps):
            spot_t = path[step]
            tenor_remaining = max(tenor_years - step * dt, 1e-12)
            delta = bsm_delta(spot_t, strike, rate, sigma, tenor_remaining, flag)
            hedge_pnl[path_idx] += delta * (path[step + 1] - spot_t)

        hedge_pnl[path_idx] += pnl

    return hedge_pnl


if TORCH_AVAILABLE:
    class SimpleMLPHedger(nn.Module):
        """Small MLP that predicts a hedge ratio from the current state."""

        def __init__(self, hidden_dim=32):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(4, hidden_dim),
                nn.Tanh(),
                nn.Linear(hidden_dim, hidden_dim),
                nn.Tanh(),
                nn.Linear(hidden_dim, 1),
                nn.Tanh(),
            )

        def forward(self, x):
            return self.net(x).squeeze(-1)


    def train_deep_hedger(
        spot0,
        strike,
        tenor_years,
        rate,
        sigma,
        n_paths=500,
        n_steps=30,
        lr=0.02,
        epochs=20,
    ):
        """Train a simple neural hedger by minimizing hedged PnL variance."""
        device = torch.device("cpu")
        paths_np = simulate_gbm(spot0, rate, sigma, tenor_years, n_paths, n_steps, seed=42).astype(np.float32)
        paths_t = torch.tensor(paths_np, dtype=torch.float32, device=device)
        payoff_t = torch.tensor(np.maximum(paths_np[:, -1] - strike, 0.0), dtype=torch.float32, device=device)
        premium = bsm_price_fast(spot0, strike, rate, sigma, tenor_years)

        spot0_t = torch.tensor(float(spot0), dtype=torch.float32, device=device)
        strike_t = torch.tensor(float(strike), dtype=torch.float32, device=device)

        model = SimpleMLPHedger(hidden_dim=32).to(device)
        optimizer = torch.optim.Adam(model.parameters(), lr=lr)
        losses = []

        for epoch in range(epochs):
            hedged_pnl = torch.zeros(n_paths, dtype=torch.float32, device=device)

            for step in range(n_steps):
                spot_t = paths_t[:, step]
                tenor_remaining = tenor_years - step * tenor_years / n_steps
                norm_spot = (spot_t / spot0_t - 1.0).unsqueeze(1)
                norm_tenor = torch.full((n_paths, 1), tenor_remaining / tenor_years, dtype=torch.float32, device=device)
                moneyness = ((spot_t - strike_t) / strike_t).unsqueeze(1)
                state = torch.cat(
                    [norm_spot, norm_tenor, torch.zeros(n_paths, 1, device=device), moneyness],
                    dim=1,
                )
                hedge_ratio = model(state)
                stock_return = (paths_t[:, step + 1] - spot_t) / spot_t
                hedged_pnl = hedged_pnl + hedge_ratio * stock_return

            net_pnl = hedged_pnl + (premium - payoff_t)
            loss = net_pnl.var()
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            losses.append(loss.item())

            if (epoch + 1) % 5 == 0:
                sharpe = net_pnl.mean().item() / max(net_pnl.std().item(), 1e-8)
                print(
                    f"  Epoch {epoch + 1:02d}/{epochs}: "
                    f"loss={loss.item():.4f} pnl_std={net_pnl.std().item():.4f} sharpe={sharpe:.3f}"
                )

        return {
            "loss": losses,
            "pnl_mean": net_pnl.detach().mean().item(),
            "pnl_std": net_pnl.detach().std().item(),
            "pnl_min": net_pnl.detach().min().item(),
            "pnl_max": net_pnl.detach().max().item(),
            "sharpe": net_pnl.detach().mean().item() / max(net_pnl.detach().std().item(), 1e-8),
            "win_rate": (net_pnl.detach() > 0).float().mean().item(),
        }
else:
    def train_deep_hedger(*_args, **_kwargs):
        raise RuntimeError("Torch is required for neural deep hedging.")


def summarize_strategy(name, pnl):
    pnl = np.asarray(pnl, dtype=float)
    sharpe = pnl.mean() / max(pnl.std(), 1e-8)
    return {
        "name": name,
        "mean": float(pnl.mean()),
        "std": float(pnl.std()),
        "min": float(pnl.min()),
        "max": float(pnl.max()),
        "win_rate": float((pnl > 0).mean()),
        "sharpe": float(sharpe),
    }


def print_summary_row(summary, sharpe_override=None):
    sharpe_text = "-" if sharpe_override is None else f"{sharpe_override:.3f}"
    print(
        f"  {summary['name']:<20} "
        f"{summary['mean']:>12.2f} "
        f"{summary['std']:>10.2f} "
        f"{sharpe_text:>8} "
        f"{summary['win_rate']:>8.0%}"
    )


def run():
    print("=" * 65)
    print("LAB 6 - DEEP HEDGING")
    print("=" * 65)
    print()

    spot0 = 22_500.0
    strike = 22_500.0
    rate = 0.065
    sigma = 0.15
    tenor_years = 5 / 365
    lot = 25

    premium = bsm_price_fast(spot0, strike, rate, sigma, tenor_years)
    premium_lot = premium * lot

    print("Setup")
    print(f"  Spot:            INR {spot0:,.0f}")
    print(f"  Strike:          INR {strike:,.0f}")
    print(f"  Implied vol:     {sigma:.1%}")
    print(f"  Tenor:           {tenor_years * 365:.0f} days")
    print(f"  Premium:         INR {premium:.2f}/share | INR {premium_lot:,.2f}/lot")
    print(f"  Delta at t=0:    {bsm_delta(spot0, strike, rate, sigma, tenor_years):.4f}")
    print(f"  PFHedge present: {'yes' if PFHEDGE_AVAILABLE else 'no'}")
    print(f"  Torch present:   {'yes' if TORCH_AVAILABLE else 'no'}")
    print()

    n_paths = 2000
    n_steps = 50
    paths = simulate_gbm(spot0, rate, sigma, tenor_years, n_paths, n_steps, seed=42)
    print("Simulation")
    print(f"  Paths:           {n_paths:,}")
    print(f"  Steps/path:      {n_steps}")
    print(f"  Spot range:      INR {paths.min():,.0f} to INR {paths.max():,.0f}")
    print()

    delta_pnl = delta_hedge_pnl(paths, strike, rate, sigma, tenor_years, premium, flag="c")
    delta_summary = summarize_strategy("Delta Hedge", delta_pnl)
    print("Delta hedge baseline")
    print(f"  Mean PnL:        INR {delta_summary['mean']:+.2f}")
    print(f"  Std PnL:         INR {delta_summary['std']:.2f}")
    print(f"  Sharpe:          {delta_summary['sharpe']:.3f}")
    print(f"  Win rate:        {delta_summary['win_rate']:.1%}")
    print()

    neural_result = None
    if TORCH_AVAILABLE:
        print("Neural hedger training")
        neural_result = train_deep_hedger(
            spot0,
            strike,
            tenor_years,
            rate,
            sigma,
            n_paths=n_paths,
            n_steps=n_steps,
            lr=0.02,
            epochs=30,
        )
        print()
    else:
        print("Neural hedger training")
        print("  Torch not installed - skipping neural training.")
        print("  The delta and unhedged baselines still run for research comparison.")
        print()

    unhedged_payoff = np.maximum(paths[:, -1] - strike, 0.0)
    unhedged_pnl = premium - unhedged_payoff
    unhedged_summary = summarize_strategy("Unhedged", unhedged_pnl)

    print("Unhedged baseline")
    print(f"  Mean PnL:        INR {unhedged_summary['mean']:+.2f}")
    print(f"  Std PnL:         INR {unhedged_summary['std']:.2f}")
    print(f"  Win rate:        {unhedged_summary['win_rate']:.1%}")
    print()

    print("Summary")
    print(f"  {'Strategy':<20} {'Mean PnL':>12} {'Std PnL':>10} {'Sharpe':>8} {'WinRate':>8}")
    print(f"  {'-' * 66}")
    print_summary_row(unhedged_summary)
    print_summary_row(delta_summary, delta_summary["sharpe"])

    if neural_result is not None:
        neural_summary = {
            "name": "Deep Hedge",
            "mean": neural_result["pnl_mean"],
            "std": neural_result["pnl_std"],
            "min": neural_result["pnl_min"],
            "max": neural_result["pnl_max"],
            "win_rate": neural_result["win_rate"],
            "sharpe": neural_result["sharpe"],
        }
        print_summary_row(neural_summary, neural_summary["sharpe"])
        print()
        print(
            f"  Std reduction vs delta hedge: "
            f"{(1 - neural_summary['std'] / max(delta_summary['std'], 1e-8)) * 100:.1f}%"
        )
        print(
            f"  Sharpe improvement vs delta hedge: "
            f"{neural_summary['sharpe'] - delta_summary['sharpe']:+.3f}"
        )
    else:
        print()
        print("  Deep-hedge metrics unavailable without torch.")

    print()
    print("Notes")
    print("  - PFHedge adds richer neural hedgers and instrument abstractions when installed.")
    print("  - Torch is required to train the neural hedge in this lab.")
    print()
    print("Lab 6 complete")


if __name__ == "__main__":
    run()
