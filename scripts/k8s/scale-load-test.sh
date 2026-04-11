#!/usr/bin/env bash
# Run headless Locust sweeps while scaling a target deployment through 1/2/4/8 replicas.
#
# Example:
#   NAMESPACE=tradersapp-dev bash scripts/k8s/scale-load-test.sh
#   HOST=http://127.0.0.1:8788 REPLICAS="1 2 4 8" USERS=80 bash scripts/k8s/scale-load-test.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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

mkdir -p "$OUTPUT_DIR"

for cmd in kubectl curl python; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $cmd" >&2
    exit 1
  fi
done

if ! python -m locust --version >/dev/null 2>&1; then
  echo "ERROR: Locust is not available in the active Python environment." >&2
  echo "Install it with: python -m pip install locust" >&2
  exit 1
fi

ORIGINAL_REPLICAS="$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.spec.replicas}')"
ORIGINAL_BFF_REPLICAS=""
PORT_FORWARD_PID=""
OVERALL_STATUS=0

cleanup() {
  if [[ -n "$PORT_FORWARD_PID" ]] && kill -0 "$PORT_FORWARD_PID" >/dev/null 2>&1; then
    kill "$PORT_FORWARD_PID" >/dev/null 2>&1 || true
  fi

  kubectl -n "$NAMESPACE" scale deploy "$DEPLOYMENT" --replicas="$ORIGINAL_REPLICAS" >/dev/null 2>&1 || true
  if [[ "$SCALE_BFF" == "true" && -n "$ORIGINAL_BFF_REPLICAS" ]]; then
    kubectl -n "$NAMESPACE" scale deploy "$BFF_DEPLOYMENT" --replicas="$ORIGINAL_BFF_REPLICAS" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "$SCALE_BFF" == "true" ]]; then
  ORIGINAL_BFF_REPLICAS="$(kubectl -n "$NAMESPACE" get deploy "$BFF_DEPLOYMENT" -o jsonpath='{.spec.replicas}')"
fi

if [[ -z "$HOST" ]]; then
  echo "Starting temporary port-forward to svc/bff on localhost:$PORT_FORWARD_PORT"
  kubectl -n "$NAMESPACE" port-forward svc/bff "$PORT_FORWARD_PORT":8788 >"$OUTPUT_DIR/port-forward.log" 2>&1 &
  PORT_FORWARD_PID=$!

  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$PORT_FORWARD_PORT/health" >/dev/null 2>&1; then
      HOST="http://127.0.0.1:$PORT_FORWARD_PORT"
      break
    fi
    sleep 2
  done
fi

if [[ -z "$HOST" ]]; then
  echo "ERROR: unable to determine a healthy test host." >&2
  exit 1
fi

echo "========================================"
echo "Scale Load Test"
echo "Namespace:    $NAMESPACE"
echo "Deployment:   $DEPLOYMENT"
echo "Host:         $HOST"
echo "Replicas:     $REPLICAS"
echo "Output dir:   $OUTPUT_DIR"
echo "========================================"

for replica_count in $REPLICAS; do
  echo
  echo ">>> Scaling $DEPLOYMENT to $replica_count replica(s)"
  kubectl -n "$NAMESPACE" scale deploy "$DEPLOYMENT" --replicas="$replica_count"
  kubectl -n "$NAMESPACE" rollout status deploy "$DEPLOYMENT" --timeout=180s

  if [[ "$SCALE_BFF" == "true" ]]; then
    echo ">>> Scaling $BFF_DEPLOYMENT to $replica_count replica(s)"
    kubectl -n "$NAMESPACE" scale deploy "$BFF_DEPLOYMENT" --replicas="$replica_count"
    kubectl -n "$NAMESPACE" rollout status deploy "$BFF_DEPLOYMENT" --timeout=180s
  fi

  report_prefix="$OUTPUT_DIR/replicas-${replica_count}"
  locust_args=(
    -m locust
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

  if [[ -n "$USER_CLASS" ]]; then
    locust_args+=("$USER_CLASS")
  fi

  if ! python "${locust_args[@]}"; then
    echo "Load test failed for replica count ${replica_count}" >&2
    OVERALL_STATUS=1
  fi
done

echo
if [[ "$OVERALL_STATUS" -eq 0 ]]; then
  echo "All scale-load sweeps completed successfully. Reports: $OUTPUT_DIR"
else
  echo "One or more scale-load sweeps breached the configured thresholds. Reports: $OUTPUT_DIR" >&2
fi

exit "$OVERALL_STATUS"
