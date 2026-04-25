#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/tradersapp}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/tradersapp}"
BACKUP_TOOLS="${BACKUP_TOOLS:-${APP_ROOT}/backup-tools}"
COMMAND="${1:-all}"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "[contabo-backup] python interpreter not found (python3/python)" >&2
  exit 127
fi

mkdir -p \
  "${BACKUP_ROOT}/redis" \
  "${BACKUP_ROOT}/sqlite" \
  "${BACKUP_ROOT}/postgres" \
  "${BACKUP_ROOT}/logs"

docker_container_running() {
  local name="$1"
  docker ps --format '{{.Names}}' | grep -Fxq "${name}"
}

run_redis_backup() {
  if ! docker_container_running traders-redis; then
    echo "[contabo-backup] skip redis: traders-redis is not running"
    return 0
  fi

  echo "[contabo-backup] backing up redis"
  REDIS_CONTAINER="${REDIS_CONTAINER:-traders-redis}" \
  BACKUP_DIR="${BACKUP_ROOT}/redis" \
    "${PYTHON_BIN}" "${BACKUP_TOOLS}/scripts/backup_redis.py" \
      --backup-dir "${BACKUP_ROOT}/redis"
}

run_sqlite_backup() {
  local db_path
  db_path="${DB_PATH:-/var/lib/docker/volumes/tradersapp_ml_data/_data/trading_data.db}"

  if [ ! -f "${db_path}" ]; then
    echo "[contabo-backup] skip sqlite: DB not found at ${db_path}"
    return 0
  fi

  echo "[contabo-backup] backing up sqlite from ${db_path}"
  DB_PATH="${db_path}" \
  BACKUP_DIR="${BACKUP_ROOT}/sqlite" \
    "${PYTHON_BIN}" "${BACKUP_TOOLS}/ml-engine/scripts/backup_sqlite.py" \
      --backup-dir "${BACKUP_ROOT}/sqlite"
}

run_postgres_backup() {
  if ! docker_container_running traders-postgres; then
    echo "[contabo-backup] skip postgres: traders-postgres is not running"
    return 0
  fi

  echo "[contabo-backup] backing up postgres"
  PG_CONTAINER="${PG_CONTAINER:-traders-postgres}" \
  POSTGRES_USER="${POSTGRES_USER:-tradersapp}" \
  POSTGRES_DB="${POSTGRES_DB:-tradersapp}" \
  BACKUP_DIR="${BACKUP_ROOT}/postgres" \
    "${PYTHON_BIN}" "${BACKUP_TOOLS}/scripts/backup_postgres.py" \
      --backup-dir "${BACKUP_ROOT}/postgres"
}

case "${COMMAND}" in
  all)
    run_redis_backup
    run_sqlite_backup
    run_postgres_backup
    ;;
  redis)
    run_redis_backup
    ;;
  sqlite)
    run_sqlite_backup
    ;;
  postgres)
    run_postgres_backup
    ;;
  *)
    echo "Usage: run-backups.sh [all|redis|sqlite|postgres]" >&2
    exit 2
    ;;
esac
