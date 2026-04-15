#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/tradersapp}"
BACKUP_DIR="${BACKUP_ROOT}/redis"

mkdir -p "${BACKUP_DIR}"

export REDIS_CONTAINER="${REDIS_CONTAINER:-traders-redis}"
export BACKUP_DIR

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "[redis_backup_cron] python interpreter not found (python3/python)" >&2
  exit 127
fi

"${PYTHON_BIN}" "${ROOT_DIR}/scripts/backup_redis.py" --backup-dir "${BACKUP_DIR}"
