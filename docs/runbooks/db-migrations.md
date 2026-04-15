# DB Migrations Runbook (Alembic)

**Service:** ML Engine  
**Tooling:** Alembic + SQLAlchemy  
**Last Updated:** 2026-04-15

## Environment

Set one of:

- `ALEMBIC_DATABASE_URL`
- `DATABASE_URL`

Example:

```bash
export DATABASE_URL="postgresql://traders:traders123@localhost:5432/mlflow"
```

## Common Commands

```bash
python ml-engine/scripts/alembic_manage.py upgrade head
python ml-engine/scripts/alembic_manage.py downgrade -1
python ml-engine/scripts/alembic_manage.py history
python ml-engine/scripts/alembic_manage.py current
python ml-engine/scripts/alembic_manage.py revision -m "describe change"
```

## Baseline Existing Databases

If schema already exists and should be marked as baseline without changes:

```bash
python ml-engine/scripts/alembic_manage.py stamp 20260415_000001
```

## Safety Rules

- Run migrations against staging before production.
- Always take a backup before `upgrade` or `downgrade`.
- Do not hand-edit applied migration files.
