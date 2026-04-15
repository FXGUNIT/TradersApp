# Backup and Restore Runbook

**Scope:** Redis, ML Engine SQLite, PostgreSQL (MLflow metadata)  
**Owner:** Platform + Data Engineering  
**Last Updated:** 2026-04-15

## Backup Schedule (Cron)

| Store | Script | Suggested Schedule |
|---|---|---|
| Redis | `scripts/cron/redis_backup_cron.sh` | `0 2 * * *` |
| SQLite | `scripts/cron/ml_engine_sqlite_backup_cron.sh` | `15 2 * * *` |
| PostgreSQL | `scripts/cron/postgres_backup_cron.sh` | `30 2 * * *` |

## Manual Backup

```bash
python scripts/backup_redis.py --backup-dir /var/backups/tradersapp/redis
python ml-engine/scripts/backup_sqlite.py --backup-dir /var/backups/tradersapp/sqlite
python scripts/backup_postgres.py --backup-dir /var/backups/tradersapp/postgres
```

## Manual Restore

```bash
python scripts/backup_redis.py --restore /var/backups/tradersapp/redis/redis_latest.tar.gz
python ml-engine/scripts/backup_sqlite.py --restore /var/backups/tradersapp/sqlite/trading_data_latest.db
python scripts/backup_postgres.py --restore /var/backups/tradersapp/postgres/mlflow_latest.dump
```

## Validation

```bash
python scripts/backup_redis.py --verify /var/backups/tradersapp/redis/redis_latest.tar.gz
python ml-engine/scripts/backup_sqlite.py --verify /var/backups/tradersapp/sqlite/trading_data_latest.db
python scripts/backup_postgres.py --verify /var/backups/tradersapp/postgres/mlflow_latest.dump
```

## Recovery Acceptance Criteria

- Redis: `docker exec traders-redis redis-cli ping` returns `PONG`.
- SQLite: integrity check returns `ok`.
- PostgreSQL: `pg_isready` healthy and MLflow metadata query succeeds.
- BFF + ML Engine health endpoints return 200.
