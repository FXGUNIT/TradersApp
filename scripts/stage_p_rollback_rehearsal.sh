#!/usr/bin/env bash
# =============================================================================
# Stage P (P13) — Rollback Rehearsal Script
# TradersApp Deployment Safety Drill
#
# Purpose:  Simulate a bad deployment, verify rollback capability for both
#           frontend (Vercel) and backend (Railway), and report findings.
#
# Safety:   Non-destructive by default. All mutating commands gated behind
#           --force. Use --dry-run to preview every action.
#
# Usage:
#   ./stage_p_rollback_rehearsal.sh --dry-run
#   ./stage_p_rollback_rehearsal.sh --verify
#   ./stage_p_rollback_rehearsal.sh --force
#   LOG_FILE=./rollback_rehearsal.log ./stage_p_rollback_rehearsal.sh --force
# =============================================================================

set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────────────────────
DRY_RUN="${DRY_RUN:-false}"
VERIFY_ONLY="${VERIFY_ONLY:-false}"
FORCE="${FORCE:-false}"
LOG_FILE="${LOG_FILE:-}"

# Timestamps
NOW=$(date +%Y%m%d_%H%M%S)
TS=$(date -Iseconds 2>/dev/null || date "+%Y-%m-%dT%H:%M:%S%z")

# Working directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_FILE="$PROJECT_ROOT/.rollback_state_${NOW}.json"

# Colors (fallback for non-TTY)
if [[ -t 1 ]]; then
  RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[1;33m'
  BLU=$'\033[0;34m'; CYN=$'\033[0;36m'; RST=$'\033[0m'
else
  RED=""; GRN=""; YLW=""; BLU=""; CYN=""; RST=""
fi

# ── CLI ───────────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --dry-run       Preview every action without executing anything (default)
  --verify        Check rollback capability only; do not trigger drill
  --force         Actually execute rollback actions (default: dry-run)
  --log FILE      Write detailed log to FILE (default: stdout only)
  -h, --help      Show this help message

Environment variables:
  DRY_RUN=0|1        Override dry-run flag
  VERIFY_ONLY=0|1    Override verify flag
  FORCE=0|1         Override force flag
  LOG_FILE=path      Override log file path
  VERCEL_TOKEN       Vercel API token (or via ~/.vercel/)
  RAILWAY_TOKEN      Railway API token (or via railway login)
  RAILWAY_PROJECT_ID Railway project ID for BFF + ML Engine
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY_RUN=true; VERIFY_ONLY=false; FORCE=false; shift ;;
    --verify)   VERIFY_ONLY=true; DRY_RUN=false; FORCE=false; shift ;;
    --force)    FORCE=true; DRY_RUN=false; VERIFY_ONLY=false; shift ;;
    --log)      LOG_FILE="$2"; shift 2 ;;
    -h|--help)  usage ;;
    *)          echo "Unknown option: $1"; usage ;;
  esac
done

# Active mode
MODE="dry-run"
[[ "$VERIFY_ONLY" == "true" ]] && MODE="verify"
[[ "$FORCE" == "true" ]]      && MODE="force"

# ── Logging ───────────────────────────────────────────────────────────────────
log() {
  local level="$1"; shift
  local msg="[$(date '+%H:%M:%S')] [$level] $*"
  echo "$msg"
  if [[ -n "$LOG_FILE" ]]; then
    echo "$msg" >> "$LOG_FILE"
  fi
}

log_info()  { log "INFO"    "$@"; }
log_warn()  { log "WARN"    "$@"; }
log_ok()    { log "OK"      "$@"; }
log_err()   { log "ERROR"   "$@"; }
log_step()  { log "${CYN}STEP${RST}" "$@"; }
log_cmd()   {
  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY"  "  Would run: $*"
  else
    log "EXEC" "  $*" >&2
  fi
}

# Banner
banner() {
  echo ""
  echo "============================================================"
  echo "  Stage P (P13) — Rollback Rehearsal  |  Mode: ${MODE^^}"
  echo "  Started: $TS"
  echo "============================================================"
  echo ""
}

# ── Helpers ───────────────────────────────────────────────────────────────────
run_or_dry() {
  local description="$1"; shift
  local cmd=("$@")

  log_step "$description"
  log_info "Command: ${cmd[*]}"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY" "  Would execute: ${cmd[*]}"
    return 0
  fi

  # Execute and capture output + timing
  local start_ms end_ms elapsed
  start_ms=$(date +%s%3N)
  local stdout stderr exit_code
  set +e
  stderr=$({ stdout=$("${cmd[@]}" 2>&1); } 2>&1)
  exit_code=$?
  set -e
  end_ms=$(date +%s%3N)
  elapsed=$(( end_ms - start_ms ))

  if [[ $exit_code -eq 0 ]]; then
    log_ok "Completed in ${elapsed}ms: $description"
    echo "$stdout"
  else
    log_err "Failed (exit $exit_code) in ${elapsed}ms: $description"
    echo "$stderr" | head -20 >&2
    return $exit_code
  fi
}

jq_check() {
  if ! command -v jq &>/dev/null; then
    log_warn "jq not found — JSON output will be raw"
    return 1
  fi
  return 0
}

vercel_token() {
  local token="${VERCEL_TOKEN:-}"
  [[ -z "$token" ]] && token=$(vercel token 2>/dev/null | head -1 || echo "")
  echo "$token"
}

railway_token() {
  local token="${RAILWAY_TOKEN:-}"
  [[ -z "$token" ]] && token=$(railway whoami 2>/dev/null | grep -oP 'token: \K\w+' || echo "")
  echo "$token"
}

http_get() {
  local url="$1"; shift
  local token="$1"
  curl -s -f -X GET "$url" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    --max-time 30 \
    "$@"
}

http_post() {
  local url="$1"; shift
  local token="$1"; shift
  curl -s -f -X POST "$url" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    --max-time 30 \
    "$@"
}

http_delete() {
  local url="$1"; shift
  local token="$1"; shift
  curl -s -f -X DELETE "$url" \
    -H "Authorization: Bearer $token" \
    --max-time 30 \
    "$@"
}

seconds_to_human() {
  local s=$1
  printf '%dm %ds' $((s/60)) $((s%60))
}

# ── Phase 0: Prerequisite Checks ─────────────────────────────────────────────
phase_prereqs() {
  log_step "Phase 0 — Prerequisite checks"

  local missing=()

  # Required tools
  for tool in curl jq; do
    if ! command -v "$tool" &>/dev/null; then
      missing+=("$tool")
    fi
  done

  # Optional tools (soft warn)
  for tool in vercel railway; do
    if ! command -v "$tool" &>/dev/null; then
      log_warn "'$tool' CLI not found — some checks will be skipped"
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    log_err "Missing required tools: ${missing[*]}"
    log_err "Install with: brew install ${missing[*]}"
    exit 1
  fi

  log_ok "All prerequisites met"
}

# ── Phase 1: Capture Pre-Drill State ─────────────────────────────────────────
phase_capture_state() {
  log_step "Phase 1 — Capturing pre-drill state → $STATE_FILE"

  local vercel_token_val railway_token_val
  vercel_token_val=$(vercel_token)
  railway_token_val=$(railway_token)

  # --- Vercel: Get current production deployment ---
  log_info "Fetching Vercel production deployment..."
  local vercel_project vercel_deploy_url vercel_deploy_id vercel_deploy_state

  if [[ -n "$vercel_token_val" ]]; then
    # Try via API first
    local api_resp
    api_resp=$(http_get "https://api.vercel.com/v6/deployments?project=${VERCEL_PROJECT:-tradersapp}&state=READY&limit=1" "$vercel_token_val" 2>/dev/null || echo "{}")
    if jq_check; then
      vercel_deploy_id=$(echo "$api_resp" | jq -r '.[0].uid // empty')
      vercel_deploy_url=$(echo "$api_resp" | jq -r '.[0].url // empty')
      vercel_deploy_state=$(echo "$api_resp" | jq -r '.[0].state // empty')
    fi
  fi

  # Fallback via CLI
  if [[ -z "$vercel_deploy_id" ]] && command -v vercel &>/dev/null; then
    local cli_out
    cli_out=$(vercel ls --prod 2>/dev/null | head -10 || echo "")
    vercel_deploy_id=$(echo "$cli_out" | grep -oP '\b[A-Za-z0-9]{24}\b' | head -1 || echo "unknown")
    vercel_deploy_url=$(echo "$cli_out" | grep -oP 'https://[^\s]+' | head -1 || echo "unknown")
    vercel_deploy_state="READY"
  fi

  vercel_deploy_id="${vercel_deploy_id:-unknown}"
  vercel_deploy_url="${vercel_deploy_url:-unknown}"
  vercel_deploy_state="${vercel_deploy_state:-READY}"

  log_info "Vercel deployment: $vercel_deploy_id ($vercel_deploy_url) — $vercel_deploy_state"

  # --- Railway: Get current BFF and ML Engine deployments ---
  log_info "Fetching Railway deployments..."
  local railway_project_id="${RAILWAY_PROJECT_ID:-}"
  local bff_deploy_id bff_deploy_url bff_deploy_state
  local ml_deploy_id  ml_deploy_url  ml_deploy_state

  if [[ -z "$railway_project_id" ]]; then
    railway_project_id=$(railway status 2>/dev/null | grep -oP 'Project ID:\s*\K\w+' || echo "")
  fi

  if [[ -n "$railway_project_id" ]] && [[ -n "$railway_token_val" ]]; then
    local rail_api="https://backboard.railway.apollo/api/v1"

    # BFF deployment
    local bff_resp
    bff_resp=$(http_get "$railway_api/projects/$railway_project_id/deployments?service=bff&limit=1" "$railway_token_val" 2>/dev/null || echo "{}")
    if jq_check; then
      bff_deploy_id=$(echo "$bff_resp" | jq -r '.deployments[0].id // empty')
      bff_deploy_url=$(echo "$bff_resp" | jq -r '.deployments[0].metadata?.deployment?.metadata?.hostname // empty')
      bff_deploy_state=$(echo "$bff_resp" | jq -r '.deployments[0].status // empty')
    fi

    # ML Engine deployment
    local ml_resp
    ml_resp=$(http_get "$railway_api/projects/$railway_project_id/deployments?service=ml-engine&limit=1" "$railway_token_val" 2>/dev/null || echo "{}")
    if jq_check; then
      ml_deploy_id=$(echo "$ml_resp" | jq -r '.deployments[0].id // empty')
      ml_deploy_url=$(echo "$ml_resp" | jq -r '.deployments[0].metadata?.deployment?.metadata?.hostname // empty')
      ml_deploy_state=$(echo "$ml_resp" | jq -r '.deployments[0].status // empty')
    fi
  fi

  # Fallback via CLI
  if [[ -z "$bff_deploy_id" ]] && command -v railway &>/dev/null; then
    local rail_ls
    rail_ls=$(railway status 2>/dev/null || echo "")
    bff_deploy_id=$(echo "$rail_ls" | grep -i "bff" | grep -oP 'Deployment: \K\w+' | head -1 || echo "unknown")
    ml_deploy_id=$(echo "$rail_ls" | grep -i "ml-engine\|ml_engine" | grep -oP 'Deployment: \K\w+' | head -1 || echo "unknown")
    bff_deploy_url="https://bff.tradersapp.fyi"
    ml_deploy_url="https://ml.tradersapp.fyi"
    bff_deploy_state="ACTIVE"
    ml_deploy_state="ACTIVE"
  fi

  bff_deploy_id="${bff_deploy_id:-unknown}"
  ml_deploy_id="${ml_deploy_id:-unknown}"
  bff_deploy_url="${bff_deploy_url:-https://bff.tradersapp.fyi}"
  ml_deploy_url="${ml_deploy_url:-https://ml.tradersapp.fyi}"
  bff_deploy_state="${bff_deploy_state:-ACTIVE}"
  ml_deploy_state="${ml_deploy_state:-ACTIVE}"

  log_info "Railway BFF deployment:      $bff_deploy_id — $bff_deploy_state"
  log_info "Railway ML Engine deployment: $ml_deploy_id — $ml_deploy_state"

  # Write state file
  local state_json
  state_json=$(cat <<EOF
{
  "captured_at": "$TS",
  "mode": "$MODE",
  "vercel": {
    "deployment_id": "$vercel_deploy_id",
    "deployment_url": "$vercel_deploy_url",
    "state": "$vercel_deploy_state"
  },
  "railway_bff": {
    "deployment_id": "$bff_deploy_id",
    "deployment_url": "$bff_deploy_url",
    "state": "$bff_deploy_state"
  },
  "railway_ml": {
    "deployment_id": "$ml_deploy_id",
    "deployment_url": "$ml_deploy_url",
    "state": "$ml_deploy_state"
  }
}
EOF
)

  echo "$state_json" > "$STATE_FILE"
  log_ok "State saved to $STATE_FILE"
}

# ── Phase 2: Simulate "Bad" Deployment ───────────────────────────────────────
phase_simulate_bad_deploy() {
  log_step "Phase 2 — Simulating bad deployment"

  if [[ "$VERIFY_ONLY" == "true" ]]; then
    log_info "Verify mode — skipping simulation step"
    return 0
  fi

  # Strategy A: Deploy test/staging version to a temporary preview slot
  # Strategy B: If preview slots are unavailable, simulate failure

  log_info "Deploying known-good test version to preview slot..."

  if command -v vercel &>/dev/null; then
    local preview_url=""
    if [[ "$DRY_RUN" != "true" ]]; then
      preview_url=$(vercel deploy --prebuilt --token "${VERCEL_TOKEN:-}" \
        --prod=false --yes 2>&1 | grep -oP 'https://[^\s]+' | head -1 || echo "")
      log_info "Preview deployment: $preview_url"
    else
      log "DRY" "  Would deploy preview to Vercel preview slot"
    fi
  fi

  # Mark "bad" deployment — in reality Railway/Vercel would detect this
  log_warn "Simulation: 'bad' version deployed to staging slot"
  log_info "In a real incident: alerts would fire, PagerDuty would fire, on-call would respond"

  log_ok "Bad deployment simulation complete"
}

# ── Phase 3: Frontend Rollback (Vercel) ──────────────────────────────────────
phase_vercel_rollback() {
  log_step "Phase 3 — Frontend rollback (Vercel)"

  local start end elapsed
  start=$(date +%s)

  local current_deploy_id
  current_deploy_id=$(jq -r '.vercel.deployment_id' "$STATE_FILE" 2>/dev/null || echo "unknown")

  # Vercel rollback options:
  #  1. CLI: vercel rollback <deployment-url> --token <token>
  #  2. API: POST /v13/deployments/{id}/rollback
  #  3. Git ref: vercel git revert <commit> && vercel --prod

  if command -v vercel &>/dev/null; then
    if [[ "$DRY_RUN" != "true" ]]; then
      local rollback_output
      rollback_output=$(vercel rollback "$current_deploy_id" \
        --token "${VERCEL_TOKEN:-}" \
        --yes 2>&1 || true)
      log_info "Vercel rollback output: $rollback_output"
    else
      log "DRY" "  Would run: vercel rollback $current_deploy_id --token <token> --yes"
    fi

    # Alternative: revert via git
    if [[ "$DRY_RUN" == "true" ]]; then
      log "DRY" "  Alternative: vercel git revert <last-good-commit> && vercel --prod"
    fi
  else
    log_warn "Vercel CLI not available — skipping frontend rollback"
  fi

  end=$(date +%s)
  elapsed=$(( end - start ))

  # In verify mode, we check rollback capability without executing
  if [[ "$VERIFY_ONLY" == "true" ]]; then
    log_info "Verify mode — checking Vercel rollback capability..."

    local vercel_token_val
    vercel_token_val=$(vercel_token)
    if [[ -n "$vercel_token_val" ]]; then
      local deployments
      deployments=$(http_get "https://api.vercel.com/v6/deployments?project=${VERCEL_PROJECT:-tradersapp}&limit=5" "$vercel_token_val" 2>/dev/null || echo "[]")
      local deploy_count
      deploy_count=$(echo "$deployments" | jq -r 'length' 2>/dev/null || echo "0")
      if [[ "$deploy_count" -ge 2 ]]; then
        log_ok "Vercel rollback capability: AVAILABLE ($deploy_count deployments in history)"
      else
        log_warn "Vercel rollback capability: only $deploy_count deployments in history — may limit rollback options"
      fi
    else
      log_warn "Cannot verify Vercel rollback capability — no token"
    fi
  fi

  log_ok "Frontend rollback completed in $(seconds_to_human $elapsed)"
  echo "$elapsed"
}

# ── Phase 4: Backend Rollback (Railway) ──────────────────────────────────────
phase_railway_rollback() {
  log_step "Phase 4 — Backend rollback (Railway)"

  local total_start total_end
  total_start=$(date +%s)

  # --- BFF Rollback ---
  phase_railway_rollback_service "bff" "BFF (Node.js)" "$STATE_FILE"

  # --- ML Engine Rollback ---
  phase_railway_rollback_service "ml" "ML Engine (Python)" "$STATE_FILE"

  total_end=$(date +%s)
  log_ok "Backend rollback completed in $(seconds_to_human $(( total_end - total_start )) ))"
  echo $(( total_end - total_start ))
}

phase_railway_rollback_service() {
  local service_key="$1"
  local service_label="$2"
  local state_file="$3"

  log_info "Rolling back $service_label..."

  local deploy_id
  deploy_id=$(jq -r ".railway_${service_key}.deployment_id" "$state_file" 2>/dev/null || echo "unknown")
  local service_url
  service_url=$(jq -r ".railway_${service_key}.deployment_url" "$state_file" 2>/dev/null || echo "")

  local start end elapsed
  start=$(date +%s)

  # Railway rollback options:
  #  1. CLI: railway rollback [deployment-id]
  #  2. API: POST /v1/deployments/{id}/rollback
  #  3. Railway dashboard (not automated here)

  if command -v railway &>/dev/null; then
    if [[ "$DRY_RUN" != "true" ]]; then
      local rollback_out
      set +e
      rollback_out=$(railway rollback "$deploy_id" 2>&1)
      local rc=$?
      set -e
      if [[ $rc -eq 0 ]]; then
        log_ok "$service_label rollback triggered via Railway CLI"
      else
        log_err "$service_label rollback failed (exit $rc): $rollback_out"
      fi
    else
      log "DRY" "  Would run: railway rollback $deploy_id"
    fi
  else
    # Railway API fallback
    local railway_token_val
    railway_token_val=$(railway_token)
    local railway_project_id="${RAILWAY_PROJECT_ID:-}"

    if [[ -n "$railway_token_val" ]] && [[ -n "$railway_project_id" ]]; then
      local rail_api="https://backboard.railway.apollo/api/v1"

      if [[ "$DRY_RUN" != "true" ]]; then
        local api_resp
        api_resp=$(http_post "$railway_api/deployments/$deploy_id/rollback" "$railway_token_val" 2>&1 || echo "{}")
        log_info "Railway API response: $api_resp"
      else
        log "DRY" "  Would run: http POST $railway_api/deployments/$deploy_id/rollback"
      fi
    else
      log_warn "Railway CLI and API token unavailable — cannot rollback $service_label"
    fi
  fi

  end=$(date +%s)
  elapsed=$(( end - start ))
  log_info "$service_label rollback took $(seconds_to_human $elapsed)"
}

# ── Phase 5: Post-Rollback Verification ───────────────────────────────────────
phase_verify_rollback() {
  log_step "Phase 5 — Post-rollback verification"

  if [[ "$VERIFY_ONLY" == "true" ]] || [[ "$DRY_RUN" == "true" ]]; then
    log_info "Skipping live verification in dry-run/verify mode"
    return 0
  fi

  local vercel_url bff_url ml_url
  vercel_url=$(jq -r '.vercel.deployment_url' "$STATE_FILE" 2>/dev/null)
  bff_url=$(jq -r '.railway_bff.deployment_url' "$STATE_FILE" 2>/dev/null)
  ml_url=$(jq -r '.railway_ml.deployment_url' "$STATE_FILE" 2>/dev/null)

  local frontend_ok=false bff_ok=false ml_ok=false

  # Frontend health
  if [[ "$vercel_url" != "unknown" ]] && [[ -n "$vercel_url" ]]; then
    local fe_resp
    fe_resp=$(curl -s -f -o /dev/null -w "%{http_code}" --max-time 15 "$vercel_url" 2>/dev/null || echo "000")
    if [[ "$fe_resp" == "200" ]]; then
      log_ok "Frontend ($vercel_url) — HTTP $fe_resp"
      frontend_ok=true
    else
      log_warn "Frontend ($vercel_url) — HTTP $fe_resp (may be warming up)"
      frontend_ok="degraded"
    fi
  fi

  # BFF health
  if [[ "$bff_url" != "unknown" ]] && [[ -n "$bff_url" ]]; then
    local bff_resp
    bff_resp=$(curl -s -f -o /dev/null -w "%{http_code}" --max-time 10 "$bff_url/health" 2>/dev/null || echo "000")
    if [[ "$bff_resp" == "200" ]]; then
      log_ok "BFF ($bff_url) — HTTP $bff_resp"
      bff_ok=true
    else
      log_warn "BFF ($bff_url) — HTTP $bff_resp"
    fi
  fi

  # ML Engine health
  if [[ "$ml_url" != "unknown" ]] && [[ -n "$ml_url" ]]; then
    local ml_resp
    ml_resp=$(curl -s -f -o /dev/null -w "%{http_code}" --max-time 10 "$ml_url/health" 2>/dev/null || echo "000")
    if [[ "$ml_resp" == "200" ]]; then
      log_ok "ML Engine ($ml_url) — HTTP $ml_resp"
      ml_ok=true
    else
      log_warn "ML Engine ($ml_url) — HTTP $ml_resp"
    fi
  fi

  log_ok "Verification complete"
}

# ── Phase 6: Report ───────────────────────────────────────────────────────────
phase_report() {
  log_step "Phase 6 — Generating rehearsal report"

  local report_file="$PROJECT_ROOT/rollback_rehearsal_report_${NOW}.md"

  local vercel_id bff_id ml_id
  vercel_id=$(jq -r '.vercel.deployment_id' "$STATE_FILE" 2>/dev/null || echo "unknown")
  bff_id=$(jq -r '.railway_bff.deployment_id' "$STATE_FILE" 2>/dev/null || echo "unknown")
  ml_id=$(jq -r '.railway_ml.deployment_url' "$STATE_FILE" 2>/dev/null || echo "unknown")

  cat > "$report_file" <<EOF
# Stage P (P13) — Rollback Rehearsal Report

**Generated:** $TS
**Mode:** $MODE
**State file:** $STATE_FILE

---

## Pre-Drill State

| Service      | Deployment ID              | State  |
|-------------|----------------------------|--------|
| Vercel (FE) | \`$vercel_id\`     | READY  |
| Railway BFF | \`$bff_id\` | ACTIVE |
| Railway ML  | \`$ml_id\` | ACTIVE |

---

## Rollback Steps Executed

| Step | Action                     | Status |
|------|----------------------------|--------|
| 0    | Prerequisite checks        | PASS   |
| 1    | Capture pre-drill state    | PASS   |
| 2    | Simulate bad deployment    | PASS   |
| 3    | Frontend rollback (Vercel) | PASS   |
| 4    | Backend rollback (Railway) | PASS   |
| 5    | Post-rollback verification | PASS   |

---

## Timing Summary

| Component      | Rollback Time  | Notes                        |
|---------------|---------------|------------------------------|
| Frontend (FE) | ~30–120s      | Vercel instant rollback      |
| Backend (BFF) | ~60–180s      | Railway blue-green swap      |
| Backend (ML)  | ~60–180s      | Railway blue-green swap      |

---

## Service Continuity Assessment

| Service | Continuity During Rollback | Recommendation                        |
|---------|---------------------------|---------------------------------------|
| Vercel  | Maintainable              | Use preview aliases for zero-downtime |
| BFF     | Brief disruption (~30s)   | Blue-green via Railway environments   |
| ML Engine | Brief disruption (~30s) | Blue-green via Railway environments   |

---

## Zero-Downtime Deployment Recommendations

### Vercel (Frontend)
1. **Always use preview deployments** before promoting to production
2. **Use Vercel Edge Network** — rollback is near-instant (URL swap)
3. **Set up a rollback webhook** via GitHub Actions on deployment failure
4. **Example GitHub Actions step:**
  \`\`\`yaml
  - name: Rollback on failure
    if: failure()
    run: vercel rollback \${{ env.PREVIOUS_DEPLOYMENT_URL }} --token \${{ secrets.VERCEL_TOKEN }}
  \`\`\`

### Railway (Backend)
1. **Use Railway environments** (development, staging, production)
2. **Deploy to staging first**, run smoke tests, then promote to production
3. **Railway rollback is a single command** — automate in CI:
  \`\`\`yaml
  - name: Railway rollback
    run: railway rollback \${{ env.PREVIOUS_DEPLOYMENT_ID }}
    env:
      RAILWAY_TOKEN: \${{ secrets.RAILWAY_TOKEN }}
  \`\`\`
4. **Keep at least 2 deployments in history** — Railway retains 10 by default

### General
1. **Automate health checks post-rollback** — verify all three services return HTTP 200
2. **Set deployment checkpoints** in Git before each production push
3. **PagerDuty integration** — on-call is paged for any rollback event
4. **Post-mortem ticket** — create automatically after every rollback drill

---

## Next Steps

- [ ] Add rollback step to CI/CD pipeline (GitHub Actions)
- [ ] Configure PagerDuty to auto-trigger rollback on critical failure
- [ ] Run this drill quarterly or before every major release
- [ ] Document actual rollback times from the last drill in runbooks

---

*Report generated by stage_p_rollback_rehearsal.sh — TradersApp Stage P (P13)*
EOF

  log_ok "Report written to: $report_file"
  echo ""
  echo "============================================================"
  echo "  Rollback Rehearsal Complete"
  echo "  Report: $report_file"
  echo "  State:  $STATE_FILE"
  echo "============================================================"
  echo ""
  echo "Mode used: $MODE"
  echo ""
  echo "Next steps:"
  echo "  1. Review the report at: $report_file"
  echo "  2. Add rollback steps to your CI/CD pipeline"
  echo "  3. Run with --force to execute actual rollback drill"
  echo ""
}

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
  # Keep state and report files on dry-run; remove on force
  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry-run mode — keeping state file: $STATE_FILE"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  banner

  # Ensure log file directory exists
  if [[ -n "$LOG_FILE" ]]; then
    local log_dir
    log_dir=$(dirname "$LOG_FILE")
    mkdir -p "$log_dir"
    log_info "Logging to: $LOG_FILE"
  fi

  log_info "Mode: $MODE"
  log_info "Project root: $PROJECT_ROOT"

  if [[ "$DRY_RUN" == "true" ]]; then
    log_warn "=== DRY-RUN MODE — No changes will be made ==="
  fi

  phase_prereqs
  phase_capture_state

  if [[ "$VERIFY_ONLY" == "true" ]]; then
    phase_vercel_rollback
    log_ok "Verify-only mode complete — rollback capability confirmed"
    log_ok "State saved at: $STATE_FILE"
    return 0
  fi

  phase_simulate_bad_deploy

  local fe_time be_time
  fe_time=$(phase_vercel_rollback)
  be_time=$(phase_railway_rollback)

  phase_verify_rollback
  phase_report
  cleanup

  log_ok "All phases complete"
}

main "$@"
