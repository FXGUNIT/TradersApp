# Backup and Restore Runbook

**Scope:** Redis, ML Engine SQLite, PostgreSQL (MLflow metadata)  
**Owner:** Platform + Data Engineering  
**Last Updated:** 2026-04-26

## Active Contabo Backup Contract

The active Contabo deploy installs scheduled backups on the VPS during every deploy.

Installed paths:

| Item | Path |
|---|---|
| Backup tools | `/opt/tradersapp/backup-tools` |
| Cron file | `/etc/cron.d/tradersapp-backups` |
| Backup root | `/var/backups/tradersapp` |
| Redis backups | `/var/backups/tradersapp/redis` |
| SQLite backups | `/var/backups/tradersapp/sqlite` |
| PostgreSQL backups | `/var/backups/tradersapp/postgres` |
| Deployed source snapshots | `/var/backups/tradersapp/source` |
| Backup logs | `/var/backups/tradersapp/logs` |

Contabo schedule:

| Time | Job |
|---|---|
| 02:00 daily | `run-backups.sh all` with `flock` to prevent overlap |
| 02:45 daily | `verify-backups.sh` |

The source snapshot is a `git archive` of the exact deployed GitHub commit. It is copied to:

```text
/var/backups/tradersapp/source/source-<sha>.tgz
/var/backups/tradersapp/source/source_latest.tgz
```

Manual Contabo verification:

```bash
sudo APP_ROOT=/opt/tradersapp BACKUP_ROOT=/var/backups/tradersapp \
  /opt/tradersapp/backup-tools/scripts/contabo/verify-backups.sh
```

Manual Contabo backup:

```bash
sudo APP_ROOT=/opt/tradersapp BACKUP_ROOT=/var/backups/tradersapp \
  /opt/tradersapp/backup-tools/scripts/contabo/run-backups.sh all
```

Important rule:

- Uncommitted local files are only on the local machine. To make files exist on GitHub and Contabo, commit and push to GitHub, then deploy that commit to Contabo.

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
