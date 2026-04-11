# CI Workflow Cleanup Report

**Generated:** 2026-04-12
**File:** `.github/workflows/ci.yml`

---

## validate-adrs job

**Status:** FIXED

- **Before:** 60-line inline bash script with grep/sed checks across 6 metadata fields
- **After:** Single step calling `python scripts/validate_adrs.py`
- **Redundant step removed:** `Find changed ADR files` — its `${{ steps.changed.outputs.adr_files }}` output was no longer consumed after switching to the Python script

`scripts/validate_adrs.py` validates all 18 ADRs in `docs/adr/` and was confirmed working:
```
[OK] docs\adr\ADR-001-dvc-data-versioning.md
...
[OK] docs\adr\ADR-018-ddd-microservices-grpc.md
[PASS] All ADR files validated successfully.
```

---

## Bandit job naming

**Status:** WORKS

- Job ID: `security-bandit` (defined at line 82)
- Job display name: `Security Scan — Bandit`
- All `needs:` references use `security-bandit` — consistent
- No `bandit` bare-name reference found anywhere in the workflow

---

## unit-tests / integration-tests naming

**Status:** WORKS

| Job ID | Display Name | Line | Referenced as |
|--------|-------------|------|---------------|
| `unit-tests` | Unit Tests | 227 | `unit-tests` in all `needs:` |
| `integration-tests` | Integration Tests | 292 | `integration-tests` in all `needs:` |

No bare `test` or `unit-test` references found.

---

## load-test-slo job and parse_k6_results.py

**Status:** WORKS

- Job ID: `load-test-slo` (defined at line 398)
- Calls: `python scripts/ci/parse_k6_results.py` (line ~431)
- Script path: `scripts/ci/parse_k6_results.py` — **FOUND**, 197 lines, well-structured
- Script validates k6 summary JSON against SLA thresholds (p95 < 200ms, p99 < 500ms, fail < 1%)
- Gracefully skips (exit 0) if no k6 artifacts present — correct CI behaviour

---

## Job dependency graph (all 13 jobs)

```
validate-adrs
security-bandit
type-check
file-size-gate
architecture-contracts
unit-tests ──> integration-tests ──> load-tests
                                               │
load-test-slo  (if: pull_request)             v
dockerfile-lint                           load-tests
frontend ──────────────────────────────────────────┐
ml-engine ──> deploy-staging ──> deploy-production│
bff ───────────────────────────────────────────────┘
```

**All `needs:` references resolve to defined job IDs.** No broken dependency chains.

---

## Recommendations

1. **No further action needed** on job naming — all IDs are internally consistent
2. Consider adding `actionlint` to CI to catch `needs:` mismatches pre-commit
3. The `validate-adrs` change reduced the job from 63 lines to 7 lines (88% reduction)

---

## Verification commands

```bash
# Validate all ADRs locally
python scripts/validate_adrs.py

# Check GitHub Actions syntax
npm install -g actionlint && actionlint

# Dry-run CI locally
act -l  # list all jobs
```
