# ADR-001: DVC for Data Versioning

**Status:** Accepted
**Date:** 2026-04-02
**Author:** FXGUNIT

## Context

The ML Engine trains on historical NinjaTrader CSV data stored in SQLite. As the trading system evolves:
- New features require recomputing the entire feature pipeline
- Model weights change after each retraining
- We need reproducibility: "what data produced this model?"
- Git can't handle large binary files (db files, model pickles)

Without data versioning, reverting to a previous model version means also reverting the data that produced it.

## Decision

Use **DVC (Data Version Control)** to version-control datasets and model files alongside code.

Implementation:
- `dvc.yaml` defines a 5-stage pipeline: load_candles → features → train_regime → train_direction → evaluate
- `params.yaml` stores all hyperparameters (not hardcoded)
- `dvc.lock` records the exact inputs/outputs of each stage
- `.dvc/` stores the DVC metadata
- `ml-engine/dvc-storage/` is the local remote storage (upgradeable to S3/MinIO)

**Why DVC over alternatives:**
- Git-native: same workflow as code (add, commit, push, pull)
- GitHub-compatible: `.dvc` files (not actual data) are committed to Git
- Pipeline reproducibility: `dvc repro` regenerates exact feature set from source data
- Works with existing Python/pandas stack

**Alternatives considered:**
- **Git LFS:** Not practical — large binary blobs in Git destroy clone performance
- **MLflow artifacts:** Good for model storage, but doesn't track data lineage
- **Delta Lake / Iceberg:** Overkill for a single-developer trading app

## Consequences

### Positive
- Full reproducibility: `dvc repro` + `git checkout` restores exact feature set + code
- Model audit trail: which data version produced which model version
- Pipeline caching: only recompute changed stages
- GitHub Actions can pull data artifacts as part of CI

### Negative
- Adds `dvc` CLI dependency for ML Engine contributors
- Pipeline stages must be defined upfront (additional upfront cost)
- Local remote storage (`dvc-storage/`) must be backed up separately

### Neutral
- SQLite db not tracked directly (avoids process lock issues) — pipeline regenerates from CSV
- S3/MinIO upgrade requires one command when needed
