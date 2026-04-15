#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/tradersapp}"
BACKUP_DIR="${BACKUP_ROOT}/postgres"

mkdir -p "${BACKUP_DIR}"

export PG_CONTAINER="${PG_CONTAINER:-traders-postgres}"
export POSTGRES_USER="${POSTGRES_USER:-traders}"
export POSTGRES_DB="${POSTGRES_DB:-mlflow}"
export BACKUP_DIR

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "[postgres_backup_cron] python interpreter not found (python3/python)" >&2
  exit 127
fi

"${PYTHON_BIN}" "${ROOT_DIR}/scripts/backup_postgres.py" --backup-dir "${BACKUP_DIR}"
