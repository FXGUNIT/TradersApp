#!/usr/bin/env bash
# stage_p_ci_status.sh — Show latest ci.yml run status and Deploy Production outcome
# Usage: ./stage_p_ci_status.sh [--watch]
# Exit codes: 0 = success/skipped, 1 = failed/running/error

set -uo pipefail

REPO="FXGUNIT/TradersApp"
WORKFLOW="ci.yml"
WATCH=false
POLL_INTERVAL=30

# ── Parse flags ────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --watch|-w) WATCH=true ;;
    --help|-h)
      echo "Usage: $0 [--watch]"
      echo "  --watch  Poll every ${POLL_INTERVAL}s until CI completes"
      exit 0
      ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
run_url() {
  echo "https://github.com/${REPO}/actions/runs/${1}"
}

# Fetch run IDs and dates, pick the most recent
latest_run_id() {
  gh run list --workflow="${WORKFLOW}" --limit 1 --json id --jq '.[0].id'
}

latest_run_status() {
  gh run list --workflow="${WORKFLOW}" --limit 1 --json status,conclusion --jq '.[0] | {status: .status, conclusion: .conclusion}'
}

# List all jobs for a run with name + conclusion
run_jobs() {
  gh api "/repos/${REPO}/actions/runs/${1}/jobs" \
    --jq '.jobs | map({name: .name, conclusion: .conclusion, status: .status})'
}

# Print a one-liner for a job
print_job() {
  local name="$1" conclusion="$2" status="$3"
  case "$conclusion" in
    "success")   echo "  ✓ ${name}: SUCCESS" ;;
    "failure")   echo "  ✗ ${name}: FAILED" ;;
    "skipped")   echo "  ⊘ ${name}: SKIPPED" ;;
    "cancelled") echo "  ⊘ ${name}: CANCELLED" ;;
    *)           echo "  ? ${name}: ${status^^}" ;;
  esac
}

# Main status display
show_status() {
  local run_id="$1"
  local status="$2"    # queued | in_progress | completed
  local conclusion="$3"  # success | failure | skipped | cancelled | neutral | ...

  local url
  url=$(run_url "$run_id")

  echo ""
  echo "=== CI Run #${run_id} ==="
  echo "URL:  ${url}"
  echo ""

  if [[ "$status" == "in_progress" ]]; then
    echo "CI running..."
    echo "(polling every ${POLL_INTERVAL}s, press Ctrl+C to stop)"
    return 2
  fi

  if [[ "$status" == "queued" ]]; then
    echo "CI queued..."
    return 2
  fi

  # status == completed — evaluate conclusion
  case "$conclusion" in
    "success")
      # Double-check: confirm Deploy Production specifically succeeded
      local deploy_result
      deploy_result=$(run_jobs "$run_id" | jq -c '.[] | select(.name | test("Deploy Production"; "i")) | .conclusion')
      if [[ -n "$deploy_result" && "$deploy_result" != '"success"' ]]; then
        echo "FAILED — Deploy Production job ended with: ${deploy_result}"
        echo ""
        echo "Job summary:"
        run_jobs "$run_id" | jq -r '.[] | "\(.name // "?"): \((.conclusion // .status) // "unknown")"' | while read -r line; do
          echo "  ${line}"
        done
        return 1
      fi
      echo "GREEN — Deploy Production reached SUCCESS"
      echo ""
      echo "Job summary:"
      run_jobs "$run_id" | jq -r '.[] | "\(.name // "?"): \((.conclusion // .status) // "unknown")"' | while read -r line; do
        echo "  ${line}"
      done
      return 0
      ;;

    "failure")
      echo "FAILED — one or more jobs did not succeed"
      echo ""
      echo "Job summary:"
      run_jobs "$run_id" | jq -r '.[] | "\(.name // "?"): \((.conclusion // .status) // "unknown")"' | while read -r line; do
        echo "  ${line}"
      done
      return 1
      ;;

    "skipped")
      echo "BLOCKED — run was skipped entirely (upstream condition not met)"
      return 1
      ;;

    "cancelled")
      echo "CANCELLED — run was manually cancelled"
      return 1
      ;;

    "neutral")
      echo "NEUTRAL — run completed with no pass/fail outcome"
      return 1
      ;;

    *)
      echo "UNKNOWN conclusion: '${conclusion}' — check the run URL manually"
      return 1
      ;;
  esac
}

# ── Main logic ────────────────────────────────────────────────────────────────
main() {
  if ! gh auth status &>/dev/null; then
    echo "ERROR: Not authenticated with GitHub CLI." >&2
    echo "Run: gh auth login" >&2
    exit 1
  fi

  local run_id
  run_id=$(latest_run_id)

  if [[ -z "$run_id" || "$run_id" == "null" ]]; then
    echo "No CI runs found for workflow '${WORKFLOW}'."
    echo "Trigger one with: gh workflow run ${WORKFLOW} --ref main"
    exit 1
  fi

  local status conclusion
  local info
  info=$(latest_run_status)
  status=$(echo "$info" | jq -r '.status')
  conclusion=$(echo "$info" | jq -r '.conclusion')

  if [[ "$status" == "in_progress" || "$status" == "queued" ]]; then
    show_status "$run_id" "$status" "$conclusion"
    local exit_code=$?

    if $WATCH; then
      echo ""
      echo "Waiting for CI to complete..."
      while [[ "$status" == "in_progress" || "$status" == "queued" ]]; do
        sleep "$POLL_INTERVAL"
        info=$(latest_run_status)
        status=$(echo "$info" | jq -r '.status')
        conclusion=$(echo "$info" | jq -r '.conclusion')
      done
      show_status "$run_id" "$status" "$conclusion"
      exit_code=$?
      exit $exit_code
    else
      exit $exit_code
    fi
  else
    show_status "$run_id" "$status" "$conclusion"
    exit $?
  fi
}

main
