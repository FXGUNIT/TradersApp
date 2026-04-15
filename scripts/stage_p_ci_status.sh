#!/usr/bin/env bash
# stage_p_ci_status.sh — Show latest ci.yml run status and Deploy Production outcome
# Usage: ./stage_p_ci_status.sh [--watch]
# Exit codes: 0 = success/skipped, 1 = failed/running/error

set -uo pipefail

REPO="FXGUNIT/TradersApp"
WORKFLOW="ci.yml"
WATCH=false
POLL_INTERVAL=30

# ── jq replacement via Python ─────────────────────────────────────────────────
jq_() {
  python3 -c "
import sys, json
data = json.load(sys.stdin)
keys = '$*'.split()
if not keys or keys == ['']:
    print(json.dumps(data))
else:
    for k in keys:
        data = data[0] if isinstance(data, list) else data.get(k, {})
    print(json.dumps(data))
" 2>/dev/null
}

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

latest_run_id() {
  gh run list --workflow="${WORKFLOW}" --limit 1 --json databaseId 2>/dev/null | jq_ databaseId
}

latest_run_status() {
  gh run list --workflow="${WORKFLOW}" --limit 1 --json status,conclusion 2>/dev/null | jq_ status conclusion
}

run_jobs() {
  gh api "/repos/${REPO}/actions/runs/${1}/jobs" 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
jobs = data.get('jobs', [])
print(json.dumps([{'name': j.get('name','?'), 'conclusion': j.get('conclusion',''), 'status': j.get('status','')} for j in jobs]))
"
}

print_job() {
  local name="$1" conclusion="$2" status="$3"
  case "$conclusion" in
    "success")   echo "  [OK] ${name}: SUCCESS" ;;
    "failure")   echo "  [X]  ${name}: FAILED" ;;
    "skipped")   echo "  [--] ${name}: SKIPPED" ;;
    "cancelled") echo "  [--] ${name}: CANCELLED" ;;
    *)           echo "  [??] ${name}: ${status^^}" ;;
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
      deploy_result=$(run_jobs "$run_id" | python3 -c "
import sys,json
jobs=json.load(sys.stdin)
for j in jobs:
    if 'deploy' in j['name'].lower() and 'production' in j['name'].lower():
        print(j.get('conclusion',''))
")
      if [[ -n "$deploy_result" && "$deploy_result" != "success" ]]; then
        echo "FAILED — Deploy Production job ended with: ${deploy_result}"
        echo ""
        echo "Job summary:"
        run_jobs "$run_id" | python3 -c "
import sys,json
jobs=json.load(sys.stdin)
for j in jobs:
    c=j.get('conclusion') or j.get('status') or 'unknown'
    print(f\"  {j.get('name','?')}: {c}\")
"
        return 1
      fi
      echo "GREEN — Deploy Production reached SUCCESS"
      echo ""
      echo "Job summary:"
      run_jobs "$run_id" | python3 -c "
import sys,json
jobs=json.load(sys.stdin)
for j in jobs:
    c=j.get('conclusion') or j.get('status') or 'unknown'
    print(f\"  {j.get('name','?')}: {c}\")
"
      return 0
      ;;

    "failure")
      echo "FAILED — one or more jobs did not succeed"
      echo ""
      echo "Job summary:"
      run_jobs "$run_id" | python3 -c "
import sys,json
jobs=json.load(sys.stdin)
for j in jobs:
    c=j.get('conclusion') or j.get('status') or 'unknown'
    print(f\"  {j.get('name','?')}: {c}\")
"
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
  status=$(echo "$info" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
  conclusion=$(echo "$info" | python3 -c "import sys,json; print(json.load(sys.stdin).get('conclusion',''))")

  if [[ "$status" == "in_progress" || "$status" == "queued" ]]; then
    show_status "$run_id" "$status" "$conclusion"
    local exit_code=$?

    if $WATCH; then
      echo ""
      echo "Waiting for CI to complete..."
      while [[ "$status" == "in_progress" || "$status" == "queued" ]]; do
        sleep "$POLL_INTERVAL"
        info=$(latest_run_status)
        status=$(echo "$info" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
        conclusion=$(echo "$info" | python3 -c "import sys,json; print(json.load(sys.stdin).get('conclusion',''))")
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
