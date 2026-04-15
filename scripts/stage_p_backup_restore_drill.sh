#!/usr/bin/env bash
# =============================================================================
# stage_p_backup_restore_drill.sh
# Stage P (P12) Disaster Recovery Drill Script
#
# Simulates a full backup → corrupt → restore drill cycle for production-like
# data. Tracks RTO (Recovery Time Objective) and RPO (Recovery Point Objective).
#
# Usage:
#   ./stage_p_backup_restore_drill.sh                     # full drill
#   ./stage_p_backup_restore_drill.sh --dry-run           # show steps, no changes
#   ./stage_p_backup_restore_drill.sh --verify           # verify backups exist only
#   BACKUP_DIR=/custom/path ./stage_p_backup_restore_drill.sh  # custom dir
# =============================================================================

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKUP_DIR="${BACKUP_DIR:-/backups/stage_p}"
REDIS_CONTAINER="${REDIS_CONTAINER:-traders-redis}"
REDIS_DATA_DIR="${REDIS_DATA_DIR:-/data}"
SQLITE_DB="${SQLITE_DB:-${PROJECT_ROOT}/ml-engine/data/trading_data.db}"
DRILL_TAG_FILE="${BACKUP_DIR}/.drill_tag"

# Feature flags
DRY_RUN="${DRY_RUN:-0}"
VERIFY_ONLY="${VERIFY_ONLY:-0}"

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[0;33m'
BLU='\033[0;34m'; GRY='\033[0;90m'; NC='\033[0m'

info()    { echo -e "${BLU}[INFO]${NC}  $*"; }
ok()      { echo -e "${GRN}[ OK ]${NC}  $*"; }
warn()    { echo -e "${YEL}[WARN]${NC}  $*"; }
err()     { echo -e "${RED}[ERR ]${NC}  $*" >&2; }
step()    { echo -e "\n${GRY}── $* ─────────────────────────────────────────────────────${NC}"; }

# ── Arg parsing ───────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --dry-run       Show planned actions without executing them
  --verify        Only verify that backups exist and are valid (no restore)
  --help          Show this help message

Environment variables:
  BACKUP_DIR       Backup root directory  (default: /backups/stage_p)
  REDIS_CONTAINER  Docker container name  (default: traders-redis)
  REDIS_DATA_DIR   Redis data dir in container (default: /data)
  SQLITE_DB        Path to SQLite DB file (auto-detected)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --verify)  VERIFY_ONLY=1; shift ;;
    --help)   usage; exit 0 ;;
    *)        err "Unknown option: $1"; usage; exit 1 ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo -e "${GRY}[DRY]${NC} $*"
  else
    "$@"
  fi
}

timestamp() { date +"%Y-%m-%dT%H:%M:%S%z"; }

log() { echo "[$(timestamp)] $*"; }

die() {
  err "$*"
  exit 1
}

require_cmd() {
  command -v "$1" &>/dev/null && return 0
  die "Required command not found: $1"
}

require_docker() {
  if ! docker info &>/dev/null; then
    die "Docker is not running or not accessible."
  fi
}

# ── Pre-flight checks ─────────────────────────────────────────────────────────
preflight() {
  step "Pre-flight checks"
  require_cmd sqlite3
  require_cmd md5sum || require_cmd md5

  if [[ "${VERIFY_ONLY}" != "1" ]]; then
    require_docker
  fi

  if [[ ! -d "${BACKUP_DIR}" ]]; then
    if [[ "${DRY_RUN}" != "1" ]]; then
      run mkdir -p "${BACKUP_DIR}"
    fi
    info "Created backup directory: ${BACKUP_DIR}"
  fi

  if [[ ! -f "${SQLITE_DB}" ]]; then
    warn "SQLite DB not found at: ${SQLITE_DB}"
    info "Will attempt ml-engine/trading_data.db as fallback"
    if [[ -f "${PROJECT_ROOT}/ml-engine/trading_data.db" ]]; then
      SQLITE_DB="${PROJECT_ROOT}/ml-engine/trading_data.db"
      ok "Found SQLite DB at fallback path"
    else
      err "No SQLite DB found in expected locations."
      die "Cannot proceed without a source database."
    fi
  else
    ok "Found SQLite DB: ${SQLITE_DB}"
  fi
}

# ── Step 0: Tag generation ────────────────────────────────────────────────────
tag_now() { date +"%Y%m%d_%H%M%S"; }

generate_drill_tag() {
  DRILL_TAG="drill_$(tag_now)"
  info "Drill session tag: ${DRILL_TAG}"
  echo "${DRILL_TAG}" > "${DRILL_TAG_FILE}"
  echo "${DRILL_TAG}"
}

# ── Step 1: Backup ───────────────────────────────────────────────────────────
backup_redis() {
  step "Step 1 — Redis Backup"
  local redis_backup="${BACKUP_DIR}/redis_${DRILL_TAG}.tar.gz"
  local redis_latest="${BACKUP_DIR}/redis_latest.tar.gz"
  local dump_src="${REDIS_DATA_DIR}/dump.rdb"

  info "Container: ${REDIS_CONTAINER}"
  info "Source RDB: ${dump_src}"

  # Trigger BGSAVE and capture last-save timestamp BEFORE the save
  run docker exec "${REDIS_CONTAINER}" redis-cli BGSAVE 2>/dev/null || true

  # Poll until BGSAVE completes (max 30 s)
  local tries=0
  while true; do
    local lastsave
    lastsave=$(run docker exec "${REDIS_CONTAINER}" redis-cli LASTSAVE 2>/dev/null || echo "0")
    # lastsave is an integer epoch; after BGSAVE it increments
    sleep 2
    ((tries++)) || true
    if [[ ${tries} -ge 15 ]]; then
      warn "BGSAVE did not complete within 30 s — proceeding with existing dump.rdb"
      break
    fi
    # Quick check: run LASTSAVE again to see if it changed
    local new_lastsave
    new_lastsave=$(run docker exec "${REDIS_CONTAINER}" redis-cli LASTSAVE 2>/dev/null || echo "0")
    if [[ "${new_lastsave}" != "${lastsave}" ]]; then
      ok "BGSAVE completed. LASTSAVE=${new_lastsave}"
      break
    fi
  done

  # Copy dump.rdb out of container via tmp file
  local tmp_rdb
  tmp_rdb=$(run mktemp)   # suppress temp file leak in dry-run
  if [[ "${DRY_RUN}" != "1" ]]; then
    tmp_rdb=$(mktemp)
  fi

  run docker cp "${REDIS_CONTAINER}:${dump_src}" "${tmp_rdb}" 2>/dev/null || {
    err "Failed to copy dump.rdb — is Redis running?"
    return 1
  }

  # Compress
  run tar -czf "${redis_backup}" -C "$(dirname "${tmp_rdb}")" "$(basename "${tmp_rdb}")"
  if [[ "${DRY_RUN}" != "1" && -f "${tmp_rdb}" ]]; then rm -f "${tmp_rdb}"; fi

  # Latest symlink (cross-platform)
  run ln -sf "$(basename "${redis_backup}")" "${redis_latest}" 2>/dev/null || \
    run cp "${redis_backup}" "${redis_latest}"

  local size
  size=$(run du -h "${redis_backup}" 2>/dev/null | cut -f1 || echo "?")
  ok "Redis backup: ${redis_backup} (${size})"

  # Compute checksum
  if [[ "${DRY_RUN}" != "1" && -f "${redis_backup}" ]]; then
    local checksum
    checksum=$(md5sum "${redis_backup}" 2>/dev/null | cut -d' ' -f1 || md5 -q "${redis_backup}" | cut -d' ' -f1)
    echo "${checksum}" > "${redis_backup}.md5"
    ok "Checksum: ${checksum}"
  fi

  echo "${redis_backup}"
}

backup_sqlite() {
  step "Step 1 — SQLite Backup"
  local sqlite_backup="${BACKUP_DIR}/sqlite_${DRILL_TAG}.db"
  local sqlite_latest="${BACKUP_DIR}/sqlite_latest.db"

  info "Source DB: ${SQLITE_DB}"

  # Snapshot row counts before backup (for RPO verification later)
  local candles_before
  candles_before=$(run sqlite3 "${SQLITE_DB}" "SELECT COUNT(*) FROM candles_5min;" 2>/dev/null || echo "0")
  local agg_before
  agg_before=$(run sqlite3 "${SQLITE_DB}" "SELECT COUNT(*) FROM session_aggregates;" 2>/dev/null || echo "0")

  info "Rows before backup — candles_5min: ${candles_before}, session_aggregates: ${agg_before}"

  # WAL-mode checkpoint to ensure consistent snapshot
  run sqlite3 "${SQLITE_DB}" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true

  # Online backup via `.backup` command
  if [[ "${DRY_RUN}" != "1" ]]; then
    local tmp_backup
    tmp_backup=$(mktemp)
    if ! sqlite3 "${SQLITE_DB}" ".backup '${tmp_backup}'" 2>/dev/null; then
      err "SQLite .backup failed — is the DB accessible?"
      return 1
    fi
    mv "${tmp_backup}" "${sqlite_backup}"
  else
    echo "[DRY] sqlite3 ${SQLITE_DB} '.backup ${sqlite_backup}'"
  fi

  # Store metadata alongside the backup
  if [[ "${DRY_RUN}" != "1" ]]; then
    cat > "${sqlite_backup}.meta" <<EOF
DRILL_TAG=${DRILL_TAG}
TIMESTAMP=$(timestamp)
CANDLES_BEFORE=${candles_before}
AGG_BEFORE=${agg_before}
SOURCE=${SQLITE_DB}
EOF
  fi

  # Latest symlink
  run ln -sf "$(basename "${sqlite_backup}")" "${sqlite_latest}" 2>/dev/null || \
    run cp "${sqlite_backup}" "${sqlite_latest}"

  local size
  size=$(run du -h "${sqlite_backup}" 2>/dev/null | cut -f1 || echo "?")
  ok "SQLite backup: ${sqlite_backup} (${size})"

  # Integrity check on the backup
  if [[ "${DRY_RUN}" != "1" && -f "${sqlite_backup}" ]]; then
    local integrity
    integrity=$(sqlite3 "${sqlite_backup}" "PRAGMA integrity_check;" 2>/dev/null || echo "unknown")
    ok "Integrity check: ${integrate:-OK}"
    if [[ "${integrity}" != "ok" ]]; then
      err "Integrity check failed: ${integrity}"
      return 1
    fi
    # Compute checksum
    local checksum
    checksum=$(md5sum "${sqlite_backup}" 2>/dev/null | cut -d' ' -f1 || md5 -q "${sqlite_backup}" | cut -d' ' -f1)
    echo "${checksum}" > "${sqlite_backup}.md5"
    ok "Checksum: ${checksum}"
  fi

  echo "${sqlite_backup}"
}

# ── Step 2: Corrupt (drill simulation only) ───────────────────────────────────
simulate_corruption() {
  step "Step 2 — Simulate Corruption (drill mode)"

  # Keep a clean copy before corrupting — this is the "pre-disaster snapshot"
  local corruption_marker="${BACKUP_DIR}/.pre_corruption_${DRILL_TAG}"
  local pre_corruption_sqlite="${BACKUP_DIR}/pre_corruption_${DRILL_TAG}.db"
  local pre_corruption_redis="${BACKUP_DIR}/pre_corruption_${DRILL_TAG}.rdb.tar.gz"

  # Copy the backup we just made (the clean reference point)
  run cp "${SQLITE_BACKUP}" "${pre_corruption_sqlite}" 2>/dev/null || true
  run cp "${REDIS_BACKUP}" "${pre_corruption_redis}" 2>/dev/null || true

  # Mark pre-corruption in the drill log
  {
    echo "PRE_CORRUPTION_TAG=${DRILL_TAG}"
    echo "PRE_CORRUPTION_TIME=$(timestamp)"
    echo "PRE_CORRUPTION_SQLITE=${pre_corruption_sqlite}"
    echo "PRE_CORRUPTION_REDIS=${pre_corruption_redis}"
  } >> "${corruption_marker}"

  # Simulate DB corruption: flip a byte in the data table
  info "Injecting simulated corruption into SQLite DB copy..."
  if [[ "${DRY_RUN}" != "1" ]]; then
    # Create a working copy to corrupt (never touch the real backup)
    local corrupt_target="${BACKUP_DIR}/.corruption_target_${DRILL_TAG}.db"
    run cp "${SQLITE_DB}" "${corrupt_target}"

    # Flip byte at offset 4096 (in the first page — file header area)
    # This is a harmless corruption that SQLite integrity_check WILL detect
    local file_size
    file_size=$(stat -c%s "${corrupt_target}" 2>/dev/null || stat -f%z "${corrupt_target}" 2>/dev/null || echo "0")
    if [[ "${file_size}" -gt 8192 ]]; then
      printf '\xFF' | dd of="${corrupt_target}" bs=1 seek=4096 count=1 conv=notrunc 2>/dev/null
      ok "Injected byte-flip corruption at offset 4096"
      # Record the corrupted copy path for the restore verification step
      echo "CORRUPTED_COPY=${corrupt_target}" >> "${corruption_marker}"
    else
      warn "DB file too small to inject realistic offset corruption — skipping"
    fi

    # Verify the corruption is detectable
    local check_result
    check_result=$(sqlite3 "${corrupt_target}" "PRAGMA integrity_check;" 2>/dev/null || echo "unknown")
    info "Corrupted copy integrity: ${check_result}"
    echo "CORRUPT_INTEGRITY=${check_result}" >> "${corruption_marker}"
  else
    echo "[DRY] Simulate byte-flip corruption at offset 4096 of working copy"
  fi

  ok "Corruption step complete — system is in drill failure state"
  log "DRILL: Corruption simulated at $(timestamp)"
}

# ── Step 3: Restore ───────────────────────────────────────────────────────────
restore_redis() {
  step "Step 3 — Redis Restore"
  local restore_src="${BACKUP_DIR}/redis_latest.tar.gz"

  if [[ ! -f "${restore_src}" ]]; then
    err "Redis backup not found: ${restore_src}"
    return 1
  fi

  # Extract to a temp directory
  local tmp_restore_dir
  tmp_restore_dir=$(run mktemp -d)
  if [[ "${DRY_RUN}" != "1" ]]; then
    tmp_restore_dir=$(mktemp -d)
  fi

  run tar -xzf "${restore_src}" -C "${tmp_restore_dir}"
  local extracted_rdb="${tmp_restore_dir}/dump.rdb"

  if [[ ! -f "${extracted_rdb}" ]]; then
    err "dump.rdb not found in archive"
    return 1
  fi

  # Stop Redis
  info "Stopping Redis container: ${REDIS_CONTAINER}"
  run docker stop "${REDIS_CONTAINER}" 2>/dev/null || true

  # Replace dump.rdb inside container
  run docker cp "${extracted_rdb}" "${REDIS_CONTAINER}:${REDIS_DATA_DIR}/dump.rdb"

  # Restart Redis
  info "Restarting Redis container: ${REDIS_CONTAINER}"
  run docker start "${REDIS_CONTAINER}"

  # Wait for Redis to be ready
  local retries=10
  while [[ ${retries} -gt 0 ]]; do
    local pong
    pong=$(run docker exec "${REDIS_CONTAINER}" redis-cli PING 2>/dev/null || echo "DOWN")
    if [[ "${pong}" == "PONG" ]]; then
      ok "Redis responding to PING"
      break
    fi
    sleep 1
    ((retries--)) || true
  done

  if [[ "${pong}" != "PONG" ]]; then
    err "Redis did not come back online after restore"
    return 1
  fi

  ok "Redis restore complete"
}

restore_sqlite() {
  step "Step 3 — SQLite Restore"
  local restore_src="${BACKUP_DIR}/sqlite_latest.db"

  if [[ ! -f "${restore_src}" ]]; then
    err "SQLite backup not found: ${restore_src}"
    return 1
  fi

  # Verify backup integrity before restoring
  local integrity
  integrity=$(run sqlite3 "${restore_src}" "PRAGMA integrity_check;" 2>/dev/null || echo "unknown")
  if [[ "${integrity}" != "ok" ]]; then
    err "Backup integrity check failed: ${integrity} — aborting restore"
    return 1
  fi
  ok "Backup integrity verified: ${integrity}"

  # Read pre-restore row counts from meta file
  local meta_file="${restore_src}.meta"
  local candles_expected="unknown"
  local agg_expected="unknown"
  if [[ -f "${meta_file}" && "${DRY_RUN}" != "1" ]]; then
    candles_expected=$(grep "^CANDLES_BEFORE=" "${meta_file}" 2>/dev/null | cut -d= -f2 || echo "unknown")
    agg_expected=$(grep "^AGG_BEFORE=" "${meta_file}" 2>/dev/null | cut -d= -f2 || echo "unknown")
    info "Expected row counts — candles: ${candles_expected}, aggregates: ${agg_expected}"
  fi

  # Stop ML Engine (prevent writes during restore)
  info "Stopping ML Engine service..."
  run docker compose -f "${PROJECT_ROOT}/docker-compose.yml" stop ml-engine 2>/dev/null || \
    run docker compose -f "${PROJECT_ROOT}/ml-engine/docker-compose.yml" stop 2>/dev/null || \
    true

  # Restore: copy backup over live DB
  info "Restoring: ${restore_src} → ${SQLITE_DB}"
  if [[ "${DRY_RUN}" != "1" ]]; then
    # WAL checkpoint first
    sqlite3 "${SQLITE_DB}" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
    # Overwrite with backup
    run cp "${restore_src}" "${SQLITE_DB}"
    # Verify post-restore
    local candles_after
    local agg_after
    candles_after=$(sqlite3 "${SQLITE_DB}" "SELECT COUNT(*) FROM candles_5min;" 2>/dev/null || echo "0")
    agg_after=$(sqlite3 "${SQLITE_DB}" "SELECT COUNT(*) FROM session_aggregates;" 2>/dev/null || echo "0")
    ok "Post-restore row counts — candles: ${candles_after}, aggregates: ${agg_after}"
    if [[ "${candles_expected}" != "unknown" && "${candles_expected}" != "${candles_after}" ]]; then
      warn "Row count mismatch — candles: expected ${candles_expected}, got ${candles_after}"
    fi
  fi

  # Post-restore integrity check on live DB
  local post_integrity
  post_integrity=$(run sqlite3 "${SQLITE_DB}" "PRAGMA integrity_check;" 2>/dev/null || echo "unknown")
  if [[ "${post_integrity}" != "ok" ]]; then
    err "Post-restore integrity check failed: ${post_integrity}"
    return 1
  fi
  ok "Post-restore integrity: ${post_integrity}"

  # Restart ML Engine
  info "Restarting ML Engine service..."
  run docker compose -f "${PROJECT_ROOT}/docker-compose.yml" up -d ml-engine 2>/dev/null || \
    run docker compose -f "${PROJECT_ROOT}/ml-engine/docker-compose.yml" up -d 2>/dev/null || \
    true

  ok "SQLite restore complete"
}

# ── Step 4: Report ────────────────────────────────────────────────────────────
generate_report() {
  step "Step 4 — Drill Report"

  local report_file="${BACKUP_DIR}/drill_report_${DRILL_TAG}.log"
  local rto_seconds=0
  local rpo_seconds=0

  if [[ -f "${DRILL_TAG_FILE}" ]]; then
    # Calculate time window from pre-corruption marker
    local marker_file="${BACKUP_DIR}/.pre_corruption_${DRILL_TAG}"
    if [[ -f "${marker_file}" ]]; then
      local pre_time
      pre_time=$(grep "^PRE_CORRUPTION_TIME=" "${marker_file}" 2>/dev/null | cut -d= -f2 || echo "")
      if [[ -n "${pre_time}" ]]; then
        # RPO: time between backup completion and corruption event
        # We approximate this from the drill timestamps
        info "Pre-corruption time recorded: ${pre_time}"
      fi
    fi
  fi

  local redis_backup_file="${BACKUP_DIR}/redis_${DRILL_TAG}.tar.gz"
  local sqlite_backup_file="${BACKUP_DIR}/sqlite_${DRILL_TAG}.db"

  local redis_size="N/A"
  local sqlite_size="N/A"
  local redis_checksum="N/A"
  local sqlite_checksum="N/A"
  local redis_integrity="N/A"
  local sqlite_integrity="N/A"
  local candles_count="N/A"
  local agg_count="N/A"

  if [[ -f "${redis_backup_file}" ]]; then
    redis_size=$(du -h "${redis_backup_file}" 2>/dev/null | cut -f1 || echo "N/A")
    redis_checksum=$(cat "${redis_backup_file}.md5" 2>/dev/null || echo "N/A")
    if [[ -f "${redis_backup_file}" && "${DRY_RUN}" != "1" ]]; then
      redis_integrity=$(tar -tzf "${redis_backup_file}" &>/dev/null && echo "valid" || echo "corrupt")
    fi
  fi

  if [[ -f "${sqlite_backup_file}" ]]; then
    sqlite_size=$(du -h "${sqlite_backup_file}" 2>/dev/null | cut -f1 || echo "N/A")
    sqlite_checksum=$(cat "${sqlite_backup_file}.md5" 2>/dev/null || echo "N/A")
    if [[ "${DRY_RUN}" != "1" ]]; then
      sqlite_integrity=$(sqlite3 "${sqlite_backup_file}" "PRAGMA integrity_check;" 2>/dev/null || echo "unknown")
      candles_count=$(sqlite3 "${sqlite_backup_file}" "SELECT COUNT(*) FROM candles_5min;" 2>/dev/null || echo "0")
      agg_count=$(sqlite3 "${sqlite_backup_file}" "SELECT COUNT(*) FROM session_aggregates;" 2>/dev/null || echo "0")
    fi
  fi

  {
    echo "============================================================"
    echo "  Stage P — Disaster Recovery Drill Report"
    echo "  Tag:     ${DRILL_TAG}"
    echo "  Time:    $(timestamp)"
    echo "============================================================"
    echo ""
    echo "--- Backup Summary ---"
    echo "  Redis backup : ${redis_backup_file}"
    echo "    Size       : ${redis_size}"
    echo "    Checksum   : ${redis_checksum}"
    echo "    Integrity  : ${redis_integrity}"
    echo ""
    echo "  SQLite backup: ${sqlite_backup_file}"
    echo "    Size       : ${sqlite_size}"
    echo "    Checksum   : ${sqlite_checksum}"
    echo "    Integrity  : ${sqlite_integrity}"
    echo "    Candle rows: ${candles_count}"
    echo "    Agg rows    : ${agg_count}"
    echo ""
    echo "--- Recovery Metrics ---"
    echo "  RPO (Recovery Point Objective): ~$(date +%s) — measures max acceptable data loss window"
    echo "  RTO (Recovery Time Objective) : drill completed in ~${rto_seconds}s estimated"
    echo ""
    echo "--- Targets (Stage P Contract) ---"
    echo "  RTO target : ≤ 300 seconds (5 minutes)"
    echo "  RPO target : ≤ 60 seconds  (1 minute)"
    echo ""
    echo "--- Next Steps ---"
    echo "  1. Review this report and attach to post-mortem documentation"
    echo "  2. If RTO/RPO exceeded, update runbook and re-test"
    echo "  3. Rotate --dry-run monthly, --full-drill quarterly"
    echo ""
    echo "============================================================"
  } > "${report_file}"

  cat "${report_file}"

  ok "Report written to: ${report_file}"

  # If RTO exceeded, warn prominently
  if [[ "${rto_seconds}" -gt 300 && "${DRY_RUN}" != "1" ]]; then
    err ""
    err "⚠  RTO exceeded: ${rto_seconds}s > 300s target"
    err "   Update runbook and escalate to SRE on-call"
  fi
}

# ── Verify-only mode ──────────────────────────────────────────────────────────
verify_backups() {
  step "Verify Only Mode"
  local all_ok=0

  # Redis
  local redis_latest="${BACKUP_DIR}/redis_latest.tar.gz"
  if [[ -f "${redis_latest}" ]]; then
    ok "Redis backup exists: ${redis_latest}"
    if tar -tzf "${redis_latest}" &>/dev/null; then
      ok "  Archive is valid"
    else
      err "  Archive is corrupt"
      all_ok=1
    fi
    if [[ -f "${redis_latest}.md5" ]]; then
      local expected
      expected=$(cat "${redis_latest}.md5")
      local actual
      actual=$(md5sum "${redis_latest}" 2>/dev/null | cut -d' ' -f1 || md5 -q "${redis_latest}" | cut -d' ' -f1)
      if [[ "${expected}" == "${actual}" ]]; then
        ok "  Checksum matches: ${expected}"
      else
        err "  Checksum mismatch — expected ${expected}, got ${actual}"
        all_ok=1
      fi
    fi
  else
    warn "No Redis backup found: ${redis_latest}"
    all_ok=1
  fi

  # SQLite
  local sqlite_latest="${BACKUP_DIR}/sqlite_latest.db"
  if [[ -f "${sqlite_latest}" ]]; then
    ok "SQLite backup exists: ${sqlite_latest}"
    if [[ "${DRY_RUN}" != "1" ]]; then
      local integrity
      integrity=$(sqlite3 "${sqlite_latest}" "PRAGMA integrity_check;" 2>/dev/null || echo "unknown")
      if [[ "${integrity}" == "ok" ]]; then
        ok "  Integrity check: OK"
      else
        err "  Integrity check: ${integrity}"
        all_ok=1
      fi
      local candles
      candles=$(sqlite3 "${sqlite_latest}" "SELECT COUNT(*) FROM candles_5min;" 2>/dev/null || echo "0")
      ok "  Candle rows: ${candles}"
    fi
    if [[ -f "${sqlite_latest}.md5" ]]; then
      local expected
      expected=$(cat "${sqlite_latest}.md5")
      local actual
      actual=$(md5sum "${sqlite_latest}" 2>/dev/null | cut -d' ' -f1 || md5 -q "${sqlite_latest}" | cut -d' ' -f1)
      if [[ "${expected}" == "${actual}" ]]; then
        ok "  Checksum matches: ${expected}"
      else
        err "  Checksum mismatch"
        all_ok=1
      fi
    fi
  else
    warn "No SQLite backup found: ${sqlite_latest}"
    all_ok=1
  fi

  if [[ "${all_ok}" == "0" ]]; then
    ok "All backups verified successfully."
  else
    err "One or more backup verification checks failed."
  fi

  return "${all_ok}"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "╔═══════════════════════════════════════════════════════════════╗"
  echo "║   Stage P — Backup & Restore Drill  (Disaster Recovery)     ║"
  echo "╚═══════════════════════════════════════════════════════════════╝"
  echo ""

  if [[ "${DRY_RUN}" == "1" ]]; then
    warn "DRY RUN — no changes will be made"
    echo ""
  fi

  preflight

  if [[ "${VERIFY_ONLY}" == "1" ]]; then
    verify_backups
    exit $?
  fi

  # --- Full drill ---
  DRILL_TAG=$(generate_drill_tag)
  log "DRILL STARTED: tag=${DRILL_TAG}"

  # Record start time for RTO calculation
  DRILL_START=$(date +%s)

  # Step 1 — Backup
  info "===== BACKUP STEP ====="
  REDIS_BACKUP=$(backup_redis) || die "Redis backup failed"
  SQLITE_BACKUP=$(backup_sqlite) || die "SQLite backup failed"
  BACKUP_END=$(date +%s)
  info "Backup phase complete."

  # Step 2 — Corrupt (drill only)
  info "===== CORRUPT STEP ====="
  simulate_corruption || die "Corruption step failed"
  CORRUPT_END=$(date +%s)

  # Step 3 — Restore
  info "===== RESTORE STEP ====="
  RESTORE_START=$(date +%s)
  restore_redis  || die "Redis restore failed"
  restore_sqlite || die "SQLite restore failed"
  RESTORE_END=$(date +%s)

  # Step 4 — Report
  info "===== REPORT STEP ====="
  RTO_SECONDS=$((RESTORE_END - DRILL_START))
  RPO_SECONDS=$((BACKUP_END - DRILL_START))
  export RTO_SECONDS RPO_SECONDS

  generate_report

  echo ""
  log "DRILL COMPLETED: tag=${DRILL_TAG}"
  log "RTO: ${RTO_SECONDS}s  |  RPO: ${RPO_SECONDS}s  |  Target RTO ≤ 300s  |  Target RPO ≤ 60s"
  echo ""

  if [[ "${DRY_RUN}" == "1" ]]; then
    warn "DRY RUN — no actual changes were made"
  fi

  ok "Drill completed successfully."
  exit 0
}

main "$@"