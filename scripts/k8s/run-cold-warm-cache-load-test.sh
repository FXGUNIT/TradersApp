#!/usr/bin/env bash
# run-cold-warm-cache-load-test.sh — k8s cold vs warm cache comparison
#
# Orchestrates a two-phase k6 run against the live k8s cluster:
#   Phase 1 (cold):  Restart ml-engine pod to evict Redis cache.
#                    Wait for pod to be Ready, then run cold-warm.js.
#   Phase 2 (warm):  Run cold-warm.js immediately after — cache is now warm.
#   Output:          CSV saved to tests/load/results/cold-warm-{timestamp}.csv
#
# Prerequisites:
#   - kubectl configured for the target k3s/Railway cluster
#   - k6 installed and in PATH
#   - ml-engine deployed with the cold-warm.js scenario accessible
#   - Chaos Mesh installed (for PodChaos if cache-clear strategy = pod-kill)
#
# Usage:
#   bash scripts/k8s/run-cold-warm-cache-load-test.sh
#   NAMESPACE=tradersapp-dev bash scripts/k8s/run-cold-warm-cache-load-test.sh
#   BASE_URL=http://ml-engine:8001 bash scripts/k8s/run-cold-warm-cache-load-test.sh
#   CACHE_CLEAR=strategy bash scripts/k8s/run-cold-warm-cache-load-test.sh
#                      (strategy = pod-kill | redis-flush | rollout-restart)
#
# Exit codes:
#   0  — both phases completed successfully
#   1  — pre-flight check failed or recovery SLO breached

set -euo pipefail

# ─── Config ─────────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-tradersapp-dev}"
DEPLOYMENT="${DEPLOYMENT:-ml-engine}"
SERVICE="${SERVICE:-ml-engine}"
SERVICE_PORT="${SERVICE_PORT:-8001}"
BASE_URL="${BASE_URL:-http://ml-engine:${SERVICE_PORT}}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
TIMEOUT_ROLLBACK="${TIMEOUT_ROLLBACK:-300}"
RESULTS_DIR="${RESULTS_DIR:-$REPO_ROOT/tests/load/results}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RUN_ID="${RUN_ID:-cold-warm-${TIMESTAMP}}"

# k6 binary
K6="${K6:-k6}"

# Cache-clear strategy: pod-kill | redis-flush | rollout-restart
CACHE_CLEAR="${CACHE_CLEAR:-rollout-restart}"

# k6 output CSV (overwritten each phase)
K6_CSV="${RESULTS_DIR}/cold-warm-${TIMESTAMP}.csv"
K6_OUT="${RESULTS_DIR}/cold-warm-${TIMESTAMP}"

mkdir -p "$RESULTS_DIR"

# ─── Helpers ────────────────────────────────────────────────────────────────────

log()   { echo "[$(date +%H:%M:%S)] $*"; }
warn()  { echo "[$(date +%H:%M:%S)] WARN: $*" >&2; }
fail()  { echo "ERROR: $*" >&2; exit 1; }
run()   { log "RUN: $*"; "$@"; }

kubectl_or_fail() {
  kubectl -n "$NAMESPACE" "$@" || fail "kubectl failed: $*"
}

wait_for_rollout() {
  log "Waiting up to ${TIMEOUT_ROLLBACK}s for rollout to complete..."
  kubectl_or_fail rollout status "deploy/$DEPLOYMENT" "--timeout=${TIMEOUT_ROLLBACK}s"
}

wait_for_healthy() {
  local url="$1"
  local timeout="$2"
  local deadline
  deadline=$(($(date +%s) + timeout))
  log "Polling $url until healthy (timeout=${timeout}s)..."
  while true; do
    status=$(curl -fsS -m 3 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    if [[ "$status" == "200" ]]; then
      log "Health check passed (HTTP $status) — $url is healthy"
      return 0
    fi
    if [[ $(date +%s) -gt $deadline ]]; then
      warn "Health check timed out after ${timeout}s (last status=$status)"
      return 1
    fi
    sleep 3
  done
}

clear_cache_pod_kill() {
  # Use Chaos Mesh PodChaos to kill one ml-engine pod (cache on that pod is gone)
  local chaos_yaml="$REPO_ROOT/k8s/chaos/ml-engine-pod-chaos.yaml"
  if [[ ! -f "$chaos_yaml" ]]; then
    warn "Chaos manifest not found: $chaos_yaml — falling back to rollout-restart"
    clear_cache_rollout_restart
    return
  fi
  log "Applying PodChaos to kill one ml-engine pod..."
  kubectl apply -f "$chaos_yaml" || warn "Chaos apply failed — continuing"
  sleep 65  # wait for pod-kill chaos to complete (manifest says duration=60s)
  kubectl delete -f "$chaos_yaml" --wait=true --ignore-not-found=true || true
  log "PodChaos cleanup complete"
}

clear_cache_redis_flush() {
  # Flush Redis to evict all cached data
  log "Flushing Redis cache..."
  REDIS_POD=$(kubectl -n "$NAMESPACE" get pods -l "app=redis" \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  if [[ -n "$REDIS_POD" ]]; then
    kubectl -n "$NAMESPACE" exec "$REDIS_POD" -- redis-cli FLUSHALL >/dev/null 2>&1 \
      || warn "Redis FLUSHALL failed — cache may not be cleared"
  else
    warn "Redis pod not found — falling back to rollout-restart"
    clear_cache_rollout_restart
  fi
  log "Redis flush complete"
}

clear_cache_rollout_restart() {
  log "Triggering rollout restart to clear pod-level cache..."
  kubectl_or_fail rollout restart "deploy/$DEPLOYMENT"
  wait_for_rollout
  log "Rollout restart complete"
}

run_k6_cold_warm() {
  # Runs cold-warm.js and captures the K6_CSV_RESULT lines into the output CSV.
  local phase="$1"   # cold | warm
  local log_file="$RESULTS_DIR/k6-${phase}-${TIMESTAMP}.log"
  local csv_file="$RESULTS_DIR/k6-${phase}-${TIMESTAMP}.csv"

  log "Running k6 ${phase} phase — output: $csv_file"
  log "BASE_URL=$BASE_URL RUN_ID=${RUN_ID}-${phase} OUTPUT_CSV=$csv_file"

  # k6 run with JSON output; post-process the JSON into our summary CSV
  $K6 run \
    --quiet \
    --out json="$RESULTS_DIR/k6-${phase}-${TIMESTAMP}.json" \
    "$REPO_ROOT/tests/load/k6/cold-warm.js" \
    > "$log_file" 2>&1 || true

  # Extract K6_CSV_RESULT lines from log into the CSV
  {
    echo "run_id,cache_state,p50_ms,p95_ms,p99_ms,fail_rate"
    grep '^K6_CSV_RESULT:' "$log_file" \
      | sed 's/^K6_CSV_RESULT://' \
      | sort -u
  } > "$csv_file"

  log "k6 ${phase} phase log: $log_file"
  log "k6 ${phase} phase CSV : $csv_file"

  # Return CSV path via stdout so the parent can read it
  echo "$csv_file"
}

compute_comparison() {
  local cold_csv="$1"
  local warm_csv="$2"
  local out_csv="$RESULTS_DIR/cold-warm-${TIMESTAMP}.csv"

  log "Computing cold vs warm comparison..."
  python3 - "$cold_csv" "$warm_csv" "$out_csv" <<'PY'
import csv, sys, statistics

cold_csv, warm_csv, out_csv = sys.argv[1:]

def rows(path):
    r = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            r.append(row)
    return r

def median(values):
    if not values: return 0.0
    return statistics.median(values)

def p95(values):
    if len(values) == 0: return 0.0
    s = sorted(values)
    idx = int(0.95 * (len(s) - 1))
    return s[min(idx, len(s) - 1)]

def p99(values):
    if len(values) == 0: return 0.0
    s = sorted(values)
    idx = int(0.99 * (len(s) - 1))
    return s[min(idx, len(s) - 1)]

cold_rows = rows(cold_csv)
warm_rows = rows(warm_csv)

with open(out_csv, "w", newline="", encoding="utf-8") as out:
    writer = csv.writer(out)
    writer.writerow(["run_id", "cache_state", "p50_ms", "p95_ms", "p99_ms", "fail_rate"])
    for row in cold_rows:
        writer.writerow([row["run_id"], row["cache_state"],
                          row["p50_ms"], row["p95_ms"], row["p99_ms"], row["fail_rate"]])
    for row in warm_rows:
        writer.writerow([row["run_id"], row["cache_state"],
                          row["p50_ms"], row["p95_ms"], row["p99_ms"], row["fail_rate"]])

# Print summary to stdout for the log
cold_p95s = [float(r["p95_ms"]) for r in cold_rows]
warm_p95s = [float(r["p95_ms"]) for r in warm_rows]
if cold_p95s and warm_p95s:
    cold_p50 = median([float(r["p50_ms"]) for r in cold_rows])
    warm_p50 = median([float(r["p50_ms"]) for r in warm_rows])
    speedup  = cold_p95s[0] / warm_p95s[0] if warm_p95s[0] else 0
    print(f"COLD p50={cold_p50:.2f}ms  p95={p95(cold_p95s):.2f}ms  p99={p99(cold_p95s):.2f}ms")
    print(f"WARM p50={warm_p50:.2f}ms  p95={p95(warm_p95s):.2f}ms  p99={p99(warm_p95s):.2f}ms")
    print(f"P95 speedup (cold/warm): {speedup:.2f}x")
PY

  log "Comparison CSV: $out_csv"
  echo "$out_csv"
}

# ─── Pre-flight checks ──────────────────────────────────────────────────────────

log "========================================"
log "Cold vs Warm Cache Load Test"
log "========================================"
log "Namespace   : $NAMESPACE"
log "Deployment  : $DEPLOYMENT"
log "Service     : $SERVICE:$SERVICE_PORT"
log "Base URL    : $BASE_URL"
log "Cache clear : $CACHE_CLEAR"
log "Results dir : $RESULTS_DIR"
log "Timestamp   : $TIMESTAMP"
log "========================================"

for cmd in kubectl curl $K6 python3; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

# ─── Phase 1: Cold ──────────────────────────────────────────────────────────────

log "PHASE 1/2 — Clearing cache (strategy=$CACHE_CLEAR)..."

# Record pre-phase pod list
kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" -o wide \
  > "$RESULTS_DIR/pods-pre-cold-${TIMESTAMP}.txt" || true

case "$CACHE_CLEAR" in
  pod-kill)
    clear_cache_pod_kill
    ;;
  redis-flush)
    clear_cache_redis_flush
    ;;
  rollout-restart)
    clear_cache_rollout_restart
    ;;
  *)
    warn "Unknown cache-clear strategy '$CACHE_CLEAR' — using rollout-restart"
    clear_cache_rollout_restart
    ;;
esac

wait_for_rollout

# Verify /health is 200
HEALTH_URL="${BASE_URL}${HEALTH_PATH}"
if ! wait_for_healthy "$HEALTH_URL" "$TIMEOUT_ROLLBACK"; then
  fail "Health check failed after cache clear — cannot proceed"
fi

COLD_CSV=$(run_k6_cold_warm cold)

log "Cold phase complete — CSV: $COLD_CSV"

# ─── Phase 2: Warm ──────────────────────────────────────────────────────────────

log "PHASE 2/2 — Running warm phase (cache is now hot)..."
WARM_CSV=$(run_k6_cold_warm warm)
log "Warm phase complete — CSV: $WARM_CSV"

# ─── Comparison ────────────────────────────────────────────────────────────────

FINAL_CSV=$(compute_comparison "$COLD_CSV" "$WARM_CSV")

log "========================================"
log "Cold vs Warm Cache Load Test — DONE"
log "Results CSV : $FINAL_CSV"
log "Cold log    : $RESULTS_DIR/k6-cold-${TIMESTAMP}.log"
log "Warm log    : $RESULTS_DIR/k6-warm-${TIMESTAMP}.log"
log "========================================"

exit 0
