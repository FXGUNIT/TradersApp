# TradersApp — Code Review & Development Process

**Owner:** All contributors
**Last Updated:** 2026-04-02

---

## Branch Strategy

```
main          ← production-ready, always deployable
staging       ← integration testing
feature/X     ← work-in-progress per feature
```

**Rules:**
- Never push directly to `main` or `staging`
- Feature branches from `main`, merge back via PR
- Branch naming: `feature/dvc-setup`, `fix/telegram-reconnect`, `docs/adr-mlflow`

---

## Per-Task Workflow

For every task in the 20-step plan:

### 1. Create Feature Branch
```bash
git checkout main
git pull
git checkout -b feature/task-name
```

### 2. Write the Code
- Follow [CLAUDE.md](../CLAUDE.md) architectural rules
- Every new feature gets its own directory
- File size limits: Python ≤ 600 lines, JS/TS ≤ 500 lines, React ≤ 300 lines

### 3. Write or Update Tests
- Add to `ml-engine/tests/test_*.py` or `tests/unit/`
- Run: `pytest ml-engine/tests/ -v` (must pass before commit)
- Coverage target: critical paths ≥ 80%

### 4. Update PROGRESS.md
- Mark task status: `IN PROGRESS`
- Document files created/modified
- Record verification checklist items

### 5. Write or Update ADRs
- Any architectural decision requires an ADR in `docs/adr/`
- Format: [TEMPLATE.md](adr/TEMPLATE.md)
- Update [INDEX](adr/README.md)

### 6. Run Pre-Commit Hook
```bash
git add .
git commit  # pre-commit hook runs auto_backup.py
```
The pre-commit hook:
- Auto-creates a backup tag: `backup/YYYYMMDD-HHMMSS`
- Runs Trivy scan (Phase 5, after implemented)
- Runs linting (if configured)

### 7. Create PR for Self-Review
```bash
git push -u origin feature/task-name
gh pr create --title "feat: Add Redis caching layer" --body "$(cat <<'EOF'
## Summary
- Add Redis caching to ML Engine /predict endpoint
- BFF circuit breaker for ML Engine calls
- SLA monitoring endpoints

## Test plan
- [ ] pytest passes: pytest ml-engine/tests/ -v
- [ ] Redis cache hit rate > 0% (first run shows 0, next identical request shows hit)
- [ ] Circuit breaker opens after 5 simulated failures
EOF
)"
```
Even as a solo developer: **review your own diff** before merging.

### 8. Merge (after self-review)
```bash
gh pr merge --admin --squash
```

---

## Pre-Commit Checklist (Before Every Commit)

- [ ] Code builds / runs without errors
- [ ] Tests pass (`pytest ml-engine/tests/ -v`)
- [ ] No secrets committed (run `trivy fs .` if available)
- [ ] New ADR written (if architectural change)
- [ ] PROGRESS.md updated
- [ ] Backup tag created (pre-commit hook handles this)

---

## Deployment Checklist

Before any push to `main`:

- [ ] All Phase 1 tests pass
- [ ] DVC pipeline: `dvc repro` succeeds
- [ ] Secrets in Infisical (not Git)
- [ ] GitHub Actions CI is green
- [ ] Manual smoke test: frontend loads, ML consensus returns valid signal

---

## Git Commit Message Format

```
type: Short description (≤72 chars)

Detailed explanation if needed (wrap at 72 chars).
What was changed and why.

Refs: #task-number
```

**Types:**
- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — code restructure without behavior change
- `perf:` — performance improvement
- `test:` — adding or updating tests
- `chore:` — build system, dependencies, tooling

**Examples:**
```
feat: Add Redis caching to ML Engine /predict endpoint
fix: Circuit breaker incorrectly recording success on 500 errors
docs: Add ADR-002 for Redis caching decision
refactor: Split collectiveConsciousness into consensus sub-components
perf: Add request coalescing to prevent cache stampede
test: Add circuit breaker state machine tests
```

---

## Rollback Procedure

If a deployment causes issues:

```bash
# Find the last good commit
git log --oneline

# Revert the bad commit
gh pr create --revert HEAD

# Or: rollback Railway deployment
gh run list --workflow=ci.yml | head -5
gh run cancel <run-id>
```

**DVC rollback:**
```bash
git checkout <previous-commit>  # restores dvc.yaml + params.yaml
dvc repro                       # regenerates features from source data
```

---

## Key Files

| File | Purpose |
|------|---------|
| `PROGRESS.md` | Task tracking, what done/left |
| `CLAUDE.md` | Architectural rules and patterns |
| `SPEC.md` | Functional requirements and constraints |
| `EDGE-CASES.md` | Trading edge cases and handling |
| `DOMAIN-RULES.md` | Trading rules and formulas |
| `docs/adr/` | Architecture decision records |
| `.github/workflows/ci.yml` | CI/CD pipeline |

---

## Contacts

| Area | Contact |
|------|---------|
| ML Engine | FXGUNIT |
| BFF / Frontend | FXGUNIT |
| Infrastructure (k3s, Kafka) | FXGUNIT |
| Secrets (Infisical) | FXGUNIT |
| GitHub | FXGUNIT |
