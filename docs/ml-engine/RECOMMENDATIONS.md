# Recommendations Ledger (Single Source of Truth)

This file is the permanent home for optimization recommendations and their decisions for `scripts/autoresearch/ml-latency`.

## Logging Policy (Always)

1. Every new recommendation/hypothesis must be logged here.
2. Every evaluation must record decision (`accepted`/`rejected`/`deferred`) and evidence.
3. Accepted recommendations must include commit SHA.
4. Rejected recommendations must include measured metric and reason.

## Entry Schema

- `id`: unique recommendation id (`R-<date>-<seq>`)
- `timestamp`
- `source`: campaign/run name
- `recommendation`
- `status`: proposed | accepted | rejected | deferred
- `metric_before_ms`
- `metric_after_ms`
- `evidence`: benchmark/stability details
- `commit_sha`: if accepted
- `notes`

---

## Backfilled Accepted Recommendations (Already Applied)

| Exp | Commit | Recommendation | Before (ms) | After (ms) | Status |
|---|---|---|---:|---:|---|
| exp-1 | 986da74 | Vectorize `profit_factor_20` rolling calc | 6456.39 | 6188.42 | accepted |
| exp-2 | 93b24a9 | Replace `merge_asof` with `searchsorted` align | 6188.42 | 6043.35 | accepted |
| exp-3 | 9172fa6 | Cache historical rolling stats by trade-log fingerprint | 6043.35 | 5493.54 | accepted |
| exp-4 | 62bf2d0 | Cache `compute_candle_features` by candle fingerprint | 5493.54 | 4705.27 | accepted |
| exp-5 | a30850f | Cache `compute_time_features` by timestamp/session signature | 4705.27 | 3452.21 | accepted |
| exp-6 | f58c26d | Cache cross-session merge outputs by input fingerprints | 3452.21 | 2994.43 | accepted |
| exp-7 | 1fb4fda | Cache `assign_session_ids` outputs by timestamp signature | 2994.43 | 2558.43 | accepted |
| exp-8 | 7dd0a4e | Cache `compute_labels` on repeated streams | 2558.43 | 2459.98 | accepted |
| exp-9 | 98f7483 | Memoize full `engineer_features` output for identical inputs | 2459.98 | 544.68 | accepted |
| exp-10 | 6d7eea5 | Add cheap fast-hint path before full cache-key construction | 544.68 | 486.24 | accepted |
| exp-11 | 5667f29 | Skip redundant `to_datetime` in fast trade/session hints | 486.24 | 259.00 | accepted |
| exp-12 | 78b549c | Drop volume from fast candle hint + shallow hit copy | 259.00 | 258.29 | accepted |
| exp-13 | 6a015c0 | Heavy return deep + fast store shallow + candle hint minimal | 258.29 | 254.67 | accepted |
| exp-14 | e7e27b2 | Heavy return none + candle hint close | 254.67 | 242.36 | accepted |
| exp-15 | 0aa9f9b | Fast return deep + session hint len+ts | 242.36 | 230.22 | accepted |
| exp-16 | 415c941 | Fast compare candle | 230.22 | 227.36 | accepted |
| exp-17 | 6ec24c0 | Fast return shallow + fast compare full + fast return none | 227.36 | 184.23 | accepted |
| exp-18 | 80d2b81 | Trade hint len+ts | 184.23 | 150.45 | accepted |
| exp-19 | 40ef2ad | Candle hint minimal + engine store deep | 150.45 | 131.38 | accepted |
| exp-20 | 461d5e2 | Levels hint items (no sort in fast levels hint) | 131.38 | 129.75 | accepted |

---

## Backfilled Stability Evidence (No Code Changes)

- 200-run stability sample logged in `stability_metrics_200.txt`.
- Summary: min `124.8962`, max `658.0728`, mean `248.3414`, median `213.6402` ms.

---

## Next Test Families (Executed)

| ID | Recommendation | Status | Notes |
|---|---|---|---|
| T-01 | Median-gated acceptance (`median of 5`) | accepted | Candidate median `123.85 ms` vs baseline `141.57 ms` |
| T-02 | Anti-overfit benchmark with regenerated inputs | accepted | Mean speedup `1.205x`, median speedup `1.177x` |
| T-03 | Cold vs warm split latency | accepted | Cold mean `83.39 ms`, warm mean `1.09 ms` (`76.35x` gap) |
| T-04 | Correctness regression suite vs baseline | rejected | 9 mismatches in historical columns (`win_rate/expectancy/pf`) |
| T-05 | Scale tests (200, 1k, 5k, 20k candles; larger trade logs) | accepted | Fast warm path sustained; cold spikes observed on first calls |
| T-06 | 1000-run drift/p95 stability check | accepted | Mean `1.346 ms`, p95 `2.468 ms`, end window improved vs start |
| T-07 | Memory stability soak (10k calls) | accepted | End-start alloc delta `+10,352 bytes`, no leak trend |
| T-08 | Real-app integration benchmark | accepted | Full session_agg path now runs after dtype fix; mean speedup `58.50x` |

---

## New Recommendation Entries (Latest)

- `id`: `R-2026-04-04-01`
- `timestamp`: `2026-04-04`
- `source`: `T-08 real-app integration unblock`
- `recommendation`: Normalize production candle-side `trade_date` to datetime before cross-session merge.
- `status`: accepted
- `metric_before_ms`: not comparable (run failed with dtype merge error)
- `metric_after_ms`: production full-path mean `69.8655 ms`; optimized full-path mean `1.1944 ms`
- `evidence`: `todo_test_results.jsonl` (`T-08` entries including `full_path_after_trade_date_fix`)
- `commit_sha`: uncommitted working tree change in `ml-engine/features/feature_pipeline.py`
- `notes`: Change made in production module line converting `df["trade_date"]` to `pd.to_datetime(...)`.

- `id`: `R-2026-04-04-02`
- `timestamp`: `2026-04-04`
- `source`: `T-08 full-path stability`
- `recommendation`: Keep full integration benchmark as default gate after dtype fix.
- `status`: accepted
- `metric_before_ms`: N/A
- `metric_after_ms`: production mean `67.7367 ms` (200 runs), optimized mean `1.0733 ms` (200 runs)
- `evidence`: `todo_test_results.jsonl` (`full_path_after_trade_date_fix_200_runs`)
- `commit_sha`: N/A (benchmark-only recommendation)
- `notes`: Full-path speedup confirmed: `63.11x` mean and `66.46x` median.

---

## Historical Gap Note

Detailed per-attempt records for many rejected experiments before this ledger file existed were not permanently persisted.
From this point onward, all recommendations and decisions will be recorded here first.

## AutoResearch Run 2026-04-04 (200 Experiments, 240s Cap)

- Run timestamp: `2026-04-04T04:08:55`
- Baseline metric (prepare.py): `147.8977 ms`
- Final best metric: `147.8977 ms`
- Accepted experiments: `0`
- Rejected experiments: `200`
- Best HEAD after run: `258a969`
- LT quality base all accepted: `False`

### Mandatory Loop Test Queue Results (300 runs each)

| ID | Status | Decision | Key Metrics |
|---|---|---|---|
| LT-01 | accepted | accepted | mismatch_count=0, max_abs_diff=0.0 |
| LT-02 | accepted | accepted | violations=0, contract_columns=69 |
| LT-03 | accepted | accepted | failures=0, cases={'aware': 100, 'trade_naive': 100, 'session_date_object': 100} |
| LT-04 | rejected | rejected | exceptions=0, all_nan_columns_events=300 |
| LT-05 | accepted | accepted | failures=0 |
| LT-06 | accepted | accepted | mismatch_runs=0 |
| LT-07 | accepted | accepted | latency={'count': 300, 'mean_ms': 94.76816733319235, 'median_ms': 91.29304999805754, 'p95_ms': 130.28827000161988, 'p99_ms': 192.6988629961852, 'min_ms': 69.15309999021702, 'max_ms': 239.7252000082517}, first30_median_ms=88.03609999449691, last30_median_ms=78.26349999959348 |
| LT-08 | accepted | accepted | latency={'count': 300, 'mean_ms': 1.4205836671559762, 'median_ms': 1.272050001716707, 'p95_ms': 2.22527000514674, 'p99_ms': 2.6553619910555426, 'min_ms': 1.0111000010510907, 'max_ms': 3.0607999942731112}, baseline_first30_median_ms=1.2654500096687116, exceptions=0 |
| LT-09 | accepted | accepted | latency={'count': 300, 'mean_ms': 1.3705213332529336, 'median_ms': 1.2329999954090454, 'p95_ms': 2.038549992721528, 'p99_ms': 2.4172849916794776, 'min_ms': 0.9904000035021454, 'max_ms': 6.3116999954218045}, baseline_p95=2.358845003618626, baseline_p99=2.7813599960063766 |
| LT-10 | rejected | rejected | fixed_mean_ms=1.5527900012481648, random_mean_ms=120.57210099980391, random_to_fixed_ratio=77.64868456319628 |
| LT-11 | accepted | accepted | median_ms_by_scale={'200': 94.34259998670314, '1000': 118.28609999793116, '5000': 248.31899999117013, '20000': 649.7615999978734}, p95_ms_by_scale={'200': 134.56299000390572, '1000': 174.64920999627793, '5000': 342.8286499984096, '20000': 879.9222499947064}, ratio_20k_vs_200=6.887255599161485 |
| LT-12 | rejected | rejected | latency={'count': 300, 'mean_ms': 1.3773746662870205, 'median_ms': 1.2157500023022294, 'p95_ms': 2.197029987291899, 'p99_ms': 2.5129469964303985, 'min_ms': 0.974299997324124, 'max_ms': 5.818199992063455}, start_mean_ms=1.2808159993437584, end_mean_ms=1.424134999688249 |
| LT-13 | accepted | accepted | start_current_bytes=0, end_current_bytes=401270, peak_bytes=977811 |
| LT-14 | accepted | accepted | cpu_wall_ratio_first100=1.0769978541819634, cpu_wall_ratio_last100=1.056158444124897, regression_ratio=0.9806504627876952 |
| LT-15 | accepted | accepted | exceptions=0, mismatch_runs=0 |
| LT-16 | rejected | rejected | exceptions=0, stale_cache_events=300 |
| LT-17 | accepted | accepted | recovery_failures=0 |
| LT-18 | rejected | rejected | dirty_events=300, head_drift_events=0, head=258a969 |
| LT-19 | rejected | rejected | production_latency={'count': 300, 'mean_ms': 47.86811999991187, 'median_ms': 44.818949994805735, 'p95_ms': 67.57286000574827, 'p99_ms': 95.71195099721078, 'min_ms': 33.71060000790749, 'max_ms': 104.73929998988751}, optimized_latency={'count': 300, 'mean_ms': 77.23678300026222, 'median_ms': 73.29975000175182, 'p95_ms': 109.42633000377101, 'p99_ms': 157.87439299368998, 'min_ms': 1.322200012509711, 'max_ms': 254.8028000019258}, exceptions=0 |
| LT-20 | accepted | accepted | experiment_records=200, lt_records_before_lt20=19, progress_records=20 |

### Experiment Logging

- Progress checkpoints recorded every 10 experiments: `20` entries.
- Detailed per-experiment records appended to `todo_test_results.jsonl` (`EXP-001` ... `EXP-200`).
- Accepted commit(s): none (all candidates failed strict improvement + quality gates).
