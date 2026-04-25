#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/tradersapp}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/tradersapp}"
BACKUP_TOOLS="${BACKUP_TOOLS:-${APP_ROOT}/backup-tools}"
CRON_FILE="${CRON_FILE:-/etc/cron.d/tradersapp-backups}"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "[contabo-backup-verify] python interpreter not found (python3/python)" >&2
  exit 127
fi

status=0

check_file() {
  local label="$1"
  local path="$2"
  if [ -e "${path}" ]; then
    echo "[contabo-backup-verify] OK ${label}: ${path}"
  else
    echo "[contabo-backup-verify] MISSING ${label}: ${path}" >&2
    status=1
  fi
}

verify_optional() {
  local label="$1"
  local path="$2"
  shift 2

  if [ ! -e "${path}" ]; then
    echo "[contabo-backup-verify] pending ${label}: no latest backup at ${path}"
    return 0
  fi

  echo "[contabo-backup-verify] verifying ${label}: ${path}"
  "$@" "${path}" || status=1
}

check_file "cron" "${CRON_FILE}"
check_file "source snapshot" "${BACKUP_ROOT}/source/source_latest.tgz"

if [ -e "${BACKUP_ROOT}/source/source_latest.tgz" ]; then
  tar -tzf "${BACKUP_ROOT}/source/source_latest.tgz" >/dev/null || status=1
fi

verify_optional "redis" "${BACKUP_ROOT}/redis/redis_latest.tar.gz" \
  "${PYTHON_BIN}" "${BACKUP_TOOLS}/scripts/backup_redis.py" --verify

verify_optional "sqlite" "${BACKUP_ROOT}/sqlite/trading_data_latest.db" \
  "${PYTHON_BIN}" "${BACKUP_TOOLS}/ml-engine/scripts/backup_sqlite.py" --verify

verify_optional "postgres" "${BACKUP_ROOT}/postgres/mlflow_latest.dump" \
  "${PYTHON_BIN}" "${BACKUP_TOOLS}/scripts/backup_postgres.py" --verify

exit "${status}"
