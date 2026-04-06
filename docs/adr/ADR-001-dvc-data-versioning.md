# ADR-001: DVC for Data Versioning

**ADR ID:** ADR-001
**Title:** DVC for Data Versioning
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

**Implementation:**
- `dvc.yaml` defines a 5-stage pipeline: `load_candles → features → train_regime → train_direction → evaluate`
- `params.yaml` stores all hyperparameters (not hardcoded)
- `dvc.lock` records the exact inputs/outputs of each stage
- `.dvc/` stores the DVC metadata
- `ml-engine/dvc-storage/` is the local remote storage (upgradeable to S3/MinIO)

**Pipeline Stages:**
```bash
# Stage 1: Load candles from CSV
$ dvc run -n load_candles -d data/candles.csv -o data/candles.db python data/load_ninjatrader_csv.py

# Stage 2: Feature engineering
$ dvc run -n features -d data/candles.db -o data/features.parquet python features/feature_pipeline.py

# Stage 3: Train regime models
$ dvc run -n train_regime -d data/features.parquet -o models/regime/ python models/regime/train.py

# Stage 4: Train direction models
$ dvc run -n train_direction -d data/features.parquet -o models/direction/ python models/direction/train.py

# Stage 5: Evaluate models
$ dvc run -n evaluate -d models/direction/ -d data/features.parquet python evaluation/evaluate.py
```

## Consequences

### Positive
- **Full reproducibility:** `dvc repro` + `git checkout` restores exact feature set + code
- **Model audit trail:** which data version produced which model version
- **Pipeline caching:** only recompute changed stages
- **GitHub Actions integration:** CI can pull data artifacts as part of build pipeline

### Negative
- **Added dependency:** `dvc` CLI required for ML Engine contributors
- **Upfront cost:** Pipeline stages must be defined upfront
- **Backup requirement:** Local remote storage (`dvc-storage/`) must be backed up separately

### Neutral
- SQLite db not tracked directly (avoids process lock issues) — pipeline regenerates from CSV
- S3/MinIO upgrade requires one command when needed

## Alternatives Considered

### Git LFS (Large File Storage)
- **Pros:** Git-native, simple setup
- **Cons:** LFS quota limits, poor performance with large files, expensive for teams
- **Why rejected:** Large binary blobs destroy clone performance; cost prohibitive at scale

### MLflow Artifacts
- **Pros:** Integrated with experiment tracking
- **Cons:** Doesn't track data lineage, separate artifact store needed
- **Why rejected:** Good for model storage but doesn't provide reproducible data pipelines

### Delta Lake / Apache Iceberg
- **Pros:** Enterprise-grade data versioning, ACID transactions
- **Cons:** Complex setup, overkill for single-developer trading app
- **Why rejected:** Significant infrastructure overhead not justified for this scale

### Custom Versioning (Homegrown)
- **Pros:** Full control
- **Cons:** Significant development effort, no community support
- **Why rejected:** Building and maintaining version control is out of scope

## References

- [DVC Documentation](https://dvc.org/doc)
- [DVC Pipeline Tutorial](https://dvc.org/doc/start/data-management/pipelines)
- [DVC with MLflow](https://dvc.org/blog/dvc-mlflow)
- Related ADRs: [ADR-004 MLflow](ADR-004-mlflow-choice.md) (uses DVC commit hash for lineage), [ADR-007 Feast](ADR-007-feast-choice.md) (feast uses versioned features)
