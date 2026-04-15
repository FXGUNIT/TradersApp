from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
JOURNAL_METRICS_MODULE = (REPO_ROOT / "src" / "features" / "terminal" / "journalMetrics.js").resolve()


def _run_node_metrics(journal: list[dict]) -> dict:
    if shutil.which("node") is None:
        pytest.skip("Node.js is required for cross-layer numerical fixture checks.")

    script = f"""
import {{ computeJournalMetrics }} from {json.dumps(JOURNAL_METRICS_MODULE.as_uri())};
const journal = {json.dumps(journal)};
const metrics = computeJournalMetrics(journal);
const payload = {{
  pnlTotal: metrics.pnlTotal,
  netPnlTotal: metrics.netPnlTotal,
  totalCommission: metrics.totalCommission,
  wr: metrics.wr,
  avgWin: metrics.avgWin,
  avgLoss: metrics.avgLoss,
  pf: Number.isFinite(metrics.pf) ? metrics.pf : "Infinity",
  bestAmdPhase: metrics.bestAmdPhase ? metrics.bestAmdPhase.phase : null,
  equityLast: metrics.equityCurve[metrics.equityCurve.length - 1],
  hourly9: metrics.hourlyProfitMap[9],
  hourly10: metrics.hourlyProfitMap[10],
}};
console.log(JSON.stringify(payload));
"""

    completed = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(completed.stdout.strip())


def test_journal_metrics_fixture_gross_net_and_pf_contract():
    journal = [
        {
            "date": "2026-04-14",
            "time": "09:35",
            "instrument": "MNQ",
            "result": "win",
            "contracts": "1",
            "pnl": "100",
            "amdPhase": "ACCUMULATION",
        },
        {
            "date": "2026-04-14",
            "time": "10:05",
            "instrument": "MNQ",
            "result": "loss",
            "contracts": "1",
            "pnl": "-50",
            "amdPhase": "MANIPULATION",
        },
        {
            "date": "2026-04-14",
            "time": "10:35",
            "instrument": "MES",
            "result": "win",
            "contracts": "2",
            "pnl": "80",
            "amdPhase": "ACCUMULATION",
        },
    ]

    metrics = _run_node_metrics(journal)

    assert metrics["pnlTotal"] == pytest.approx(130.0, abs=1e-9)
    assert metrics["totalCommission"] == pytest.approx(2.92, abs=1e-9)
    assert metrics["netPnlTotal"] == pytest.approx(127.08, abs=1e-9)
    assert metrics["wr"] == pytest.approx(66.6666667, rel=1e-5)
    assert metrics["avgWin"] == pytest.approx(90.0, abs=1e-9)
    assert metrics["avgLoss"] == pytest.approx(50.0, abs=1e-9)
    assert metrics["pf"] == pytest.approx(3.6, abs=1e-9)
    assert metrics["bestAmdPhase"] == "ACCUMULATION"
    assert metrics["equityLast"]["cumulativeNetPnl"] == pytest.approx(127.08, abs=1e-9)


def test_journal_metrics_fixture_handles_all_win_infinity_pf():
    journal = [
        {
            "date": "2026-04-14",
            "time": "09:45",
            "instrument": "MNQ",
            "result": "win",
            "contracts": "1",
            "pnl": "40",
            "amdPhase": "ACCUMULATION",
        },
        {
            "date": "2026-04-14",
            "time": "10:15",
            "instrument": "MNQ",
            "result": "win",
            "contracts": "1",
            "pnl": "60",
            "amdPhase": "DISTRIBUTION",
        },
    ]

    metrics = _run_node_metrics(journal)

    assert metrics["pf"] == "Infinity"
    assert metrics["hourly9"]["count"] == 1
    assert metrics["hourly10"]["count"] == 1
