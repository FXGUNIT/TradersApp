#!/usr/bin/env bash
# Run k6 load test sweeps while scaling a target deployment through 1/2/4/8 replicas.
#
# Usage:
#   # Run all k6 scenarios against local cluster
#   bash scripts/k8s/scale-load-test.sh
#
#   # Specify k6 scenario (predict | mamba | consensus | all)
#   bash scripts/k8s/scale-load-test.sh --scenarios predict
#
#   # Specify replicas and users
#   REPLICAS="1 2 4 8" USERS=80 bash scripts/k8s/scale-load-test.sh --scenarios all
#
#   # Warm cache before measuring (pre-populate Redis)
#   bash scripts/k8s/scale-load-test.sh --warm-cache --scenarios predict
#
#   # Override SLA thresholds
#   SLA_P95_MS=150 SLA_P99_MS=300 bash scripts/k8s/scale-load-test.sh --scenarios predict
#
#   # Output CSV results to custom directory
#   OUTPUT_DIR=/tmp/scale-test bash scripts/k8s/scale-load-test.sh --scenarios all
#
# Prerequisites:
#   - kubectl configured for the target k3s/Railway cluster
#   - k6 >= 0.47.0 installed
#   - Services running in the target namespace
#
# Exit codes:
#   0  — all sweep iterations passed SLA thresholds
#   1  — one or more iterations breached SLA thresholds

set -euo pipefail

# ─── Argument parsing ─────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCK_HELPER="$REPO_ROOT/scripts/lib/cluster-operation-lock.sh"

# shellcheck source=/dev/null
source "$LOCK_HELPER"

# Default values
NAMESPACE="${NAMESPACE:-tradersapp-dev}"
DEPLOYMENT="${DEPLOYMENT:-ml-engine}"
BFF_DEPLOYMENT="${BFF_DEPLOYMENT:-bff}"
SCALE_BFF="${SCALE_BFF:-false}"
REPLICAS="${REPLICAS:-1 2 4 8}"
USERS="${USERS:-40}"
SPAWN_RATE="${SPAWN_RATE:-5}"
RUN_TIME="${RUN_TIME:-45s}"
STOP_TIMEOUT="${STOP_TIMEOUT:-10}"
SLA_P95_MS="${SLA_P95_MS:-200}"
SLA_P99_MS="${SLA_P99_MS:-500}"
MAX_FAIL_RATIO="${MAX_FAIL_RATIO:-0.01}"
HOST="${HOST:-}"
PORT_FORWARD_PORT="${PORT_FORWARD_PORT:-8788}"
OUTPUT_DIR="${OUTPUT_DIR:-$REPO_ROOT/.artifacts/scale-load/$(date +%Y%m%d-%H%M%S)}"
USER_CLASS="${USER_CLASS:-}"
WARM_CACHE="${WARM_CACHE:-false}"
K6_SCENARIOS="${K6_SCENARIOS:-all}"
CLUSTER_OPERATION_LOCK_OWNED="${CLUSTER_OPERATION_LOCK_OWNED:-false}"

# k6 runner script
K6_RUNNER="$REPO_ROOT/tests/load/k6/k6-runner.sh"

# Pre-warm endpoint (POST to /predict with sample data)
WARM_PAYLOAD='{"symbol":"MNQ","candles":[{"symbol":"MNQ","timestamp":"1712500000","open":18500.0,"high":18505.0,"low":18498.0,"close":18503.0,"volume":4200}],"trades":[],"session_id":1,"mathEngineSnapshot":{"amdPhase":"ACCUMULATION","vrRegime":"NORMAL"}}'
WARM_CACHE_REQUESTS="${WARM_CACHE_REQUESTS:-20}"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$REPO_ROOT/tests/load/results"

# ─── Helpers ──────────────────────────────────────────────────────────────────

log()   { echo "[$(date +%H:%M:%S)] $*"; }
fail()  { echo "ERROR: $*" >&2; exit 1; }

for cmd in kubectl curl python3; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

warm_cache() {
  local url="$1"
  log "Warming cache at $url ($WARM_CACHE_REQUESTS requests)..."
  for i in $(seq 1 "$WARM_CACHE_REQUESTS"); do
    status=$(curl -fsS -m 5 -X POST "$url" \
      -H "Content-Type: application/json" \
      -d "$WARM_PAYLOAD" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
    if [[ "$status" == "200" ]] || [[ "$status" == "503" ]]; then
      log "  warm $i: HTTP $status ✓"
    else
      log "  warm $i: HTTP $status ✗"
    fi
    sleep 0.3
  done
  log "Cache warm complete."
}

# CSV helpers
CSV_FILE=""
init_csv() {
  local label="$1"
  CSV_FILE="$REPO_ROOT/tests/load/results/scale-${label}-$(date +%Y%m%d-%H%M%S).csv"
  cat > "$CSV_FILE" <<EOF
timestamp,replica_count,scenario,base_url,sla_p95_ms,sla_p99_ms,max_fail_ratio,exit_code,total_requests,total_failures,fail_ratio,p50_ms,p95_ms,p99_ms,actual_p95_ms,actual_p99_ms,actual_fail_ratio,duration_s
EOF
  log "CSV output: $CSV_FILE"
}

append_csv() {
  local replica="$1"; local scenario="$2"; local base_url="$3"
  local sla_p95="$4"; local sla_p99="$5"; local max_fail="$6"
  local exit_code="$7"; local duration="$8"; local summary_file="$9"

  # Parse summary.json from k6 output
  local total_req=0; local total_fail=0; local fail_ratio_val="0"
  local p50="0"; local p95="0"; local p99="0"

  if [[ -f "$summary_file" ]] && command -v python3 >/dev/null 2>&1; then
    python3 -c "
import json, sys
try:
    data = json.load(open('$summary_file'))
    m = data.get('metrics', {})
    # Total request metrics — use 'http_reqs' which is always present
    reqs = m.get('http_reqs', {})
    vals = reqs.get('values', {})
    total_req = int(vals.get('count', 0))
    total_fail = int(vals.get('failures', 0))
    fail_ratio_val = str(round(vals.get('fail_rate', 0.0), 6))
    # Consensus latency metric (fallback to http_req_duration)
    latency_m = m.get('consensus_latency_ms') or m.get('http_req_duration') or {}
    lv = latency_m.get('values', {})
    p50 = str(round(lv.get('p(50)', 0.0), 1))
    p95 = str(round(lv.get('p(95)', 0.0), 1))
    p99 = str(round(lv.get('p(99)', 0.0), 1))
except Exception as e:
    print('# CSV parse error:', e, file=sys.stderr)
" 2>/dev/null || true
  fi

  echo "$(date -Iseconds),$replica,$scenario,$base_url,$sla_p95,$sla_p99,$max_fail,$exit_code,$total_req,$total_fail,$fail_ratio_val,$p50,$p95,$p99,$p95,$p99,$fail_ratio_val,$duration" >> "$CSV_FILE"

  # ── Per-replica CSV: tests/load/results/scale-{replicas}.csv ─────────────────
  local replica_csv="$REPO_ROOT/tests/load/results/scale-${replica}.csv"
  if [[ ! -f "$replica_csv" ]]; then
    cat > "$replica_csv" <<'CSVEOF'
timestamp,scenario,sla_p95_ms,sla_p99_ms,total_requests,total_failures,fail_ratio,p50_ms,p95_ms,p99_ms,duration_s,exit_code
CSVEOF
  fi
  echo "$(date -Iseconds),$scenario,$sla_p95,$sla_p99,$total_req,$total_fail,$fail_ratio_val,$p50,$p95,$p99,$duration,$exit_code" >> "$replica_csv"
  log "Per-replica CSV: $replica_csv"
}

# ─── Parse CLI flags ───────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenarios)
      K6_SCENARIOS="$2"; shift 2 ;;
    --warm-cache)
      WARM_CACHE="true"; shift ;;
    --output-dir)
      OUTPUT_DIR="$2"; shift 2 ;;
    --namespace)
      NAMESPACE="$2"; shift 2 ;;
    --deployment)
      DEPLOYMENT="$2"; shift 2 ;;
    --help)
      echo "Usage: $0 [--scenarios predict|mamba|consensus|all] [--warm-cache] [--output-dir DIR] [--namespace NS] [--deployment NAME]"
      echo ""
      echo "Environment variables:"
      echo "  REPLICAS           Space-separated list of replica counts (default: '1 2 4 8')"
      echo "  USERS              Locust/k6 virtual users (default: 40)"
      echo "  RUN_TIME           Test duration per iteration (default: 45s)"
      echo "  SLA_P95_MS         P95 SLA in ms (default: 200)"
      echo "  SLA_P99_MS         P99 SLA in ms (default: 500)"
      echo "  MAX_FAIL_RATIO     Max failure ratio (default: 0.01)"
      echo "  HOST               Override base URL (skip port-forward)"
      echo "  SCALE_BFF          Also scale BFF deployment (default: false)"
      exit 0 ;;
    *) shift ;;
  esac
done

# ─── Pre-flight ────────────────────────────────────────────────────────────────

if ! command -v k6 >/dev/null 2>&1; then
  log "! k6 not found in PATH — falling back to Locust"
  USE_K6=false
else
  USE_K6=true
  if [[ ! -f "$K6_RUNNER" ]]; then
    log "! k6-runner.sh not found at $K6_RUNNER — using direct k6 invocation"
  fi
fi

ORIGINAL_REPLICAS="$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "1")"
ORIGINAL_BFF_REPLICAS=""
PORT_FORWARD_PID=""
LOCK_ACQUIRED="false"
OVERALL_STATUS=0

cleanup() {
  if [[ -n "$PORT_FORWARD_PID" ]] && kill -0 "$PORT_FORWARD_PID" >/dev/null 2>&1; then
    kill "$PORT_FORWARD_PID" >/dev/null 2>&1 || true
  fi
  kubectl -n "$NAMESPACE" scale deploy "$DEPLOYMENT" --replicas="$ORIGINAL_REPLICAS" >/dev/null 2>&1 || true
  if [[ "$SCALE_BFF" == "true" && -n "$ORIGINAL_BFF_REPLICAS" ]]; then
    kubectl -n "$NAMESPACE" scale deploy "$BFF_DEPLOYMENT" --replicas="$ORIGINAL_BFF_REPLICAS" >/dev/null 2>&1 || true
  fi
  if [[ "$LOCK_ACQUIRED" == "true" ]]; then
    cluster_lock_release >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "$CLUSTER_OPERATION_LOCK_OWNED" == "true" ]]; then
  if [[ -z "${CLUSTER_LOCK_DIR:-}" || ! -d "$CLUSTER_LOCK_DIR" ]]; then
    fail "Inherited cluster lock requested, but no active lock directory was found."
  fi
  log "Using inherited cluster-operation lock: $CLUSTER_LOCK_DIR"
else
  cluster_lock_acquire "scale-load-test" "$NAMESPACE" || fail "Unable to acquire live-operation lock."
  LOCK_ACQUIRED="true"
  log "Acquired cluster-operation lock: $CLUSTER_LOCK_DIR"
fi

if [[ "$SCALE_BFF" == "true" ]]; then
  ORIGINAL_BFF_REPLICAS="$(kubectl -n "$NAMESPACE" get deploy "$BFF_DEPLOYMENT" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "1")"
fi

# ─── Port-forward to BFF ───────────────────────────────────────────────────────

if [[ -z "$HOST" ]]; then
  log "Starting temporary port-forward to svc/bff on localhost:$PORT_FORWARD_PORT"
  kubectl -n "$NAMESPACE" port-forward svc/bff "$PORT_FORWARD_PORT":8788 \
    > "${OUTPUT_DIR}/port-forward.log" 2>&1 &
  PORT_FORWARD_PID=$!

  for _ in $(seq 1 30); do
    if curl -fsS -m 3 "http://127.0.0.1:${PORT_FORWARD_PORT}/health" >/dev/null 2>&1; then
      HOST="http://127.0.0.1:${PORT_FORWARD_PORT}"
      log "Port-forward ready: $HOST"
      break
    fi
    sleep 2
  done
fi

if [[ -z "$HOST" ]]; then
  fail "Unable to determine a healthy test host."
fi

# ─── Warm cache (optional) ─────────────────────────────────────────────────────

if [[ "$WARM_CACHE" == "true" ]]; then
  log "Pre-warming cache..."
  warm_cache "${HOST}/api/consensus"
  warm_cache "${HOST}/ml/predict"
fi

# ─── Print header ─────────────────────────────────────────────────────────────

log "========================================"
log "Scale Load Test Sweep"
log "========================================"
log "Namespace    : $NAMESPACE"
log "Deployment   : $DEPLOYMENT"
log "Host         : $HOST"
log "Scenarios    : $K6_SCENARIOS"
log "Replicas     : $REPLICAS"
log "Output dir   : $OUTPUT_DIR"
log "Warm cache   : $WARM_CACHE"
log "SLA P95      : ${SLA_P95_MS} ms"
log "SLA P99      : ${SLA_P99_MS} ms"
log "Max fail %   : $(python3 -c "print($MAX_FAIL_RATIO * 100)")%"
log "========================================"

# Init CSV with timestamp
CSV_LABEL="${K6_SCENARIOS}-warm" && [[ "$WARM_CACHE" != "true" ]] && CSV_LABEL="${K6_SCENARIOS}-cold"
init_csv "$CSV_LABEL"

# ─── Scale + run loop ──────────────────────────────────────────────────────────

for replica_count in $REPLICAS; do
  log ""
  log ">>> Scaling $DEPLOYMENT to $replica_count replica(s)"
  kubectl -n "$NAMESPACE" scale deploy "$DEPLOYMENT" --replicas="$replica_count"
  kubectl -n "$NAMESPACE" rollout status deploy "$DEPLOYMENT" --timeout=180s

  if [[ "$SCALE_BFF" == "true" ]]; then
    log ">>> Scaling $BFF_DEPLOYMENT to $replica_count replica(s)"
    kubectl -n "$NAMESPACE" scale deploy "$BFF_DEPLOYMENT" --replicas="$replica_count"
    kubectl -n "$NAMESPACE" rollout status deploy "$BFF_DEPLOYMENT" --timeout=180s
  fi

  # Warm cache before measurement if requested
  if [[ "$WARM_CACHE" == "true" ]]; then
    log "Warming cache at replica count $replica_count..."
    warm_cache "${HOST}/api/consensus"
  fi

  # Allow services to stabilize
  sleep 5

  report_prefix="${OUTPUT_DIR}/replicas-${replica_count}"
  SUMMARY_FILE="${report_prefix}-summary.json"
  START_TIME=$(date +%s)

  if [[ "$USE_K6" == "true" ]]; then
    # ── Run via k6 ────────────────────────────────────────────────────────────
    log "Running k6 scenario '$K6_SCENARIOS' at ${replica_count} replicas..."

    k6_args=(
      run
      "$REPO_ROOT/tests/load/k6/scenarios.js"
      --env "BASE_URL=${HOST}/ml"
      --env "BFF_BASE_URL=${HOST}"
      --env "SCENARIO=$K6_SCENARIOS"
      --env "SLA_P95_MS=$SLA_P95_MS"
      --env "SLA_P99_MS=$SLA_P99_MS"
      --env "MAX_FAIL_RATIO=$MAX_FAIL_RATIO"
      --summary-export "$SUMMARY_FILE"
    )

    if k6 "${k6_args[@]}"; then
      log "k6 PASS for replica count $replica_count ✓"
    else
      log "k6 FAIL for replica count $replica_count ✗ — SLA threshold breached" >&2
      OVERALL_STATUS=1
    fi
  else
    # ── Fallback: run via Locust ───────────────────────────────────────────────
    log "Running Locust at ${replica_count} replicas..."

    locust_args=(
      -f "$REPO_ROOT/tests/load/locustfile.py"
      --host "$HOST"
      --headless
      --users "$USERS"
      --spawn-rate "$SPAWN_RATE"
      --run-time "$RUN_TIME"
      --stop-timeout "$STOP_TIMEOUT"
      --html "${report_prefix}.html"
      --csv "$report_prefix"
      --sla-p95-ms "$SLA_P95_MS"
      --sla-p99-ms "$SLA_P99_MS"
      --max-fail-ratio "$MAX_FAIL_RATIO"
    )
    [[ -n "$USER_CLASS" ]] && locust_args+=("$USER_CLASS")

    if python -m locust "${locust_args[@]}"; then
      log "Locust PASS for replica count $replica_count ✓"
    else
      log "Locust FAIL for replica count $replica_count ✗ — SLA threshold breached" >&2
      OVERALL_STATUS=1
    fi
    # Generate synthetic summary for CSV
    SUMMARY_FILE="${report_prefix}_stats_stats.json"
  fi

  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))

  # Append to CSV
  append_csv "$replica_count" "$K6_SCENARIOS" "$HOST" \
    "$SLA_P95_MS" "$SLA_P99_MS" "$MAX_FAIL_RATIO" \
    "$OVERALL_STATUS" "$DURATION" \
    "$SUMMARY_FILE"

  log "Results: ${report_prefix}*"
done

# ─── Summary ───────────────────────────────────────────────────────────────────

echo ""
log "========================================"
log "Scale Load Test Sweep Complete"
log "========================================"
log "Results CSV : $CSV_FILE"
log "Artifacts   : $OUTPUT_DIR"

if [[ -f "$CSV_FILE" ]]; then
  echo ""
  log "Summary (from CSV):"
  python3 -c "
import csv, sys

try:
    rows = list(csv.DictReader(open('$CSV_FILE')))
    if not rows:
        print('  (no data)')
        sys.exit(0)

    sla_p95 = float(rows[0].get('sla_p95_ms', 0))
    sla_p99 = float(rows[0].get('sla_p99_ms', 0))
    max_fail = float(rows[0].get('max_fail_ratio', 0.01))

    print(f'  SLA P95  : {sla_p95:.0f} ms   SLA P99: {sla_p99:.0f} ms   Max fail: {max_fail*100:.2f}%')
    print(f'  {\"─\"*75}')
    print(f'  {\"Replicas\":>9}  {\"P95(ms)\":>9}  {\"P99(ms)\":>9}  {\"Fail%\":>7}  {\"Exit\":>5}  {\"P95 vs SLA\":>12}  {\"P99 vs SLA\":>12}')
    print(f'  {\"─\"*75}')

    prev_p95 = None
    prev_p99 = None
    for r in rows:
        rep   = int(r.get('replica_count', 0))
        p95   = float(r.get('p95_ms', 0) or r.get('actual_p95_ms', 0))
        p99   = float(r.get('p99_ms', 0) or r.get('actual_p99_ms', 0))
        fail  = float(r.get('fail_ratio', 0))
        exc   = r.get('exit_code', '?')

        p95_flag = '  OK' if p95 <= sla_p95 else ' FAIL'
        p99_flag = '  OK' if p99 <= sla_p99 else ' FAIL'
        fail_flag = 'OK' if fail <= max_fail else 'FAIL'

        delta_p95 = ''
        delta_p99 = ''
        if prev_p95 is not None:
            d95 = p95 - prev_p95
            delta_p95 = f'{d95:+.1f}ms'
        if prev_p99 is not None:
            d99 = p99 - prev_p99
            delta_p99 = f'{d99:+.1f}ms'

        print(f'  {rep:>9}  {p95:>9.1f}  {p99:>9.1f}  {fail*100:>6.2f}%  {exc:>5}  {p95_flag} ({delta_p95:<8})  {p99_flag} ({delta_p99:<8})')
        prev_p95 = p95
        prev_p99 = p99

    print(f'  {\"─\"*75}')
    print('  (P95/P99 delta shows change vs previous replica count; + = slower, - = faster)')
except Exception as e:
    print('  Could not parse CSV summary:', e)
" 2>/dev/null || true
fi

if [[ "$OVERALL_STATUS" -eq 0 ]]; then
  log "All scale-load sweeps PASSED — SLA thresholds met ✓"
else
  log "One or more scale-load sweeps FAILED — SLA thresholds breached ✗" >&2
fi

exit "$OVERALL_STATUS"
