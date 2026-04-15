# Runbook: Data Recovery

**Severity:** P1 — data loss or corruption
**Detection:** Empty responses, missing data, SQLite corruption

---

## Scope

| Data Store | Backup Location | Recovery |
|-----------|----------------|---------|
| Redis session data | `docker exec traders-redis redis-cli SAVE` | Auto-restored on restart |
| ML Engine SQLite | `ml-engine/scripts/backup_sqlite.py` | Restore from backup |
| PostgreSQL (MLflow) | `scripts/backup_postgres.py` | Restore from backup |
| BFF JSON domain files | Git (committed state) | Restore from git history |
| ML Models | GitHub Releases | See model-rollback.md |

---

## Redis Recovery

Redis snapshots to disk automatically (AOF or RDB).
```bash
# Force snapshot
docker exec traders-redis redis-cli BGSAVE
# Check: docker exec traders-redis redis-cli LASTSAVE

# Restore from dump file
docker compose -f docker-compose.yml stop redis
cp redis-data/dump.rdb redis-data/dump.rdb.bak
# Copy backup dump.rdb into redis-data/
docker compose -f docker-compose.yml up -d redis
```

---

## SQLite Recovery

```bash
# Run backup script
python ml-engine/scripts/backup_sqlite.py --backup-dir /backups

# Restore from backup
python ml-engine/scripts/backup_sqlite.py --restore /backups/trading_data_YYYYMMDD.db

# Verify
python ml-engine/scripts/backup_sqlite.py --verify /backups/trading_data_latest.db
```

---

## PostgreSQL Recovery (MLflow metadata)

```bash
# Run backup
python scripts/backup_postgres.py --backup-dir /backups

# Restore (requires downtime)
docker compose -f docker-compose.yml stop postgres
pg_restore --dbname=mlflow --clean /backups/mlflow_latest.dump
docker compose -f docker-compose.yml up -d postgres
```

---

## BFF JSON State Recovery

```bash
# List git history for the domain file
git log --oneline --follow bff/data/identity-domain.json | head -10

# Restore specific version
git checkout <commit-hash> -- bff/data/identity-domain.json

# Restart BFF to reload
railway restart --service traders-bff
# or
docker restart traders-bff
```

---

## No backup available?

If no backup exists:
1. Note the incident time
2. File GitHub issue with data-loss label
3. Work with data sources to reconstruct (e.g., re-import NinjaTrader CSV for candle data)
