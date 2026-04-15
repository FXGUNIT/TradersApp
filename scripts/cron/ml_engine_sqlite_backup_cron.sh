#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/tradersapp}"
BACKUP_DIR="${BACKUP_ROOT}/sqlite"

mkdir -p "${BACKUP_DIR}"

export DB_PATH="${DB_PATH:-${ROOT_DIR}/ml-engine/data/trading_data.db}"
export BACKUP_DIR

python3 "${ROOT_DIR}/ml-engine/scripts/backup_sqlite.py" --backup-dir "${BACKUP_DIR}"
