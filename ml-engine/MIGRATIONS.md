# Alembic Migrations

This project uses Alembic for database schema versioning in `ml-engine`.

## Prerequisites

1. Install dependencies:
   ```bash
   pip install -r ml-engine/requirements.txt
   ```
2. Set a database URL:
   ```bash
   export DATABASE_URL="postgresql://traders:traders123@localhost:5432/mlflow"
   ```
   On PowerShell:
   ```powershell
   $env:DATABASE_URL="postgresql://traders:traders123@localhost:5432/mlflow"
   ```

## Quick Commands

From repo root:

```bash
npm run db:migrate
npm run db:migrate:current
npm run db:migrate:history
```

Or run raw Alembic passthrough:

```bash
npm run db:migrate:alembic -- revision -m "add new table"
npm run db:migrate:alembic -- upgrade head
```

## Existing Databases

For an already-provisioned DB that should be marked as baseline:

```bash
npm run db:migrate:baseline
```
