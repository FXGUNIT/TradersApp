#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/tradersapp}"
BACKUP_DIR="${BACKUP_ROOT}/sqlite"

mkdir -p "${BACKUP_DIR}"

export DB_PATH="${DB_PATH:-${ROOT_DIR}/ml-engine/data/trading_data.db}"
export BACKUP_DIR

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "[ml_engine_sqlite_backup_cron] python interpreter not found (python3/python)" >&2
  exit 127
fi

"${PYTHON_BIN}" "${ROOT_DIR}/ml-engine/scripts/backup_sqlite.py" --backup-dir "${BACKUP_DIR}"
