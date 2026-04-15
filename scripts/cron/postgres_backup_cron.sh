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

python3 "${ROOT_DIR}/scripts/backup_postgres.py" --backup-dir "${BACKUP_DIR}"
