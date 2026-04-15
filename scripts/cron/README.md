# Backup Cron Scripts

This folder contains cron-safe wrappers for scheduled backups.

## Required environment variables

- `BACKUP_ROOT` (optional, default: `/var/backups/tradersapp`)
- `REDIS_CONTAINER` (optional, default: `traders-redis`)
- `PG_CONTAINER` (optional, default: `traders-postgres`)
- `POSTGRES_USER` (optional, default: `traders`)
- `POSTGRES_DB` (optional, default: `mlflow`)
- `DB_PATH` (optional, default: `ml-engine/data/trading_data.db`)

## Example crontab

```cron
0 2 * * * /bin/bash /app/scripts/cron/redis_backup_cron.sh >> /var/log/tradersapp-backups.log 2>&1
15 2 * * * /bin/bash /app/scripts/cron/ml_engine_sqlite_backup_cron.sh >> /var/log/tradersapp-backups.log 2>&1
30 2 * * * /bin/bash /app/scripts/cron/postgres_backup_cron.sh >> /var/log/tradersapp-backups.log 2>&1
```
