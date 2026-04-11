# CI Workflow Cleanup

**Status:** Stub — needs implementation

## Purpose

Audit, clean up, and document all CI/CD workflows across Gitea/Woodpecker and GitHub Actions.

## Workflow Inventory

| Workflow | Trigger | Services Affected | Status |
|----------|---------|-------------------|--------|
| `ci-build.yml` | Every PR | BFF, ML Engine | Active |
| `ci-test.yml` | Every PR + push | All | Active |
| `ci-deploy-staging.yml` | Push to `staging` | BFF, ML Engine | Active |
| `ci-deploy-prod.yml` | Manual | All | Active |
| `ci-ml-train.yml` | Schedule (weekly) | ML Engine | Needs review |
| `ci-dvc-push.yml` | Push to `main` | DVC storage | Needs review |

## Cleanup Tasks

### High Priority
- [ ] Remove duplicate or deprecated workflows
- [ ] Enforce `no-wal` mode in Woodpecker (all pipelines)
- [ ] Consolidate overlapping matrix strategies
- [ ] Add required status checks for PR merge gate

### Medium Priority
- [ ] Standardize artifact retention (7 days for builds, 30 days for ML models)
- [ ] Add Slack notification on deploy failure
- [ ] Remove hardcoded credentials from workflow env
- [ ] Audit timeout values — kill workflows exceeding 30 minutes

### Low Priority
- [ ] Add workflow annotations (description, owner)
- [ ] Document workflow dependencies as a DAG diagram
- [ ] Create `CONTRIBUTING.md` section for adding new workflows

## Validation

```bash
# Check Woodpecker pipeline syntax
woodpecker-cli pipeline validate .woodpecker.yml

# Check GitHub Actions syntax
act --list  # requires act tool
# Or: npm install -g actionlint && actionlint

# Dry-run deploy workflow
act -j deploy-prod --dry-run
```

## See Also

- `docs/CICD_GITEA_WOODPECKER.md`
- `docs/DEPLOYMENT.md`
- `.github/workflows/` — GitHub Actions definitions
- `.woodpecker.yml` — Woodpecker CI definitions
