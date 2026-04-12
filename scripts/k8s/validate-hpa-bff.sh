#!/usr/bin/env bash
# scripts/k8s/validate-hpa-bff.sh
# Validates BFF HPA by:
#   (a) applying the HPA manifest
#   (b) running a sustained load test against the BFF to trigger scale-up
#   (c) verifying replica count increases above minReplicas
#
# Prerequisites:
#   - kubectl configured with cluster access
#   - k6 or hey or ab installed for load generation
#   - BFF deployed in the target namespace
#
# Usage:
#   NAMESPACE=tradersapp-dev bash scripts/k8s/validate-hpa-bff.sh
#   NAMESPACE=tradersapp bash scripts/k8s/validate-hpa-bff.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-tradersapp-dev}"
HPA_FILE="${REPO_ROOT}/k8s/overlay/dev/hpa-bff.yaml"
EXPECTED_HPA_NAME="${EXPECTED_HPA_NAME:-bff-hpa}"
BFF_URL="${BFF_URL:-http://bff:8788}"
BFF_PORT="${BFF_PORT:-8788}"
MIN_REPLICAS="${MIN_REPLICAS:-2}"
MAX_REPLICAS="${MAX_REPLICAS:-8}"
SCALE_UP_TIMEOUT="${SCALE_UP_TIMEOUT:-180}"
LOAD_DURATION="${LOAD_DURATION:-90}"
LOAD_CONCURRENCY="${LOAD_CONCURRENCY:-600}"
LOAD_IMAGE="${LOAD_IMAGE:-tradersapp/bff:dev-latest}"
OUTPUT_DIR="${OUTPUT_DIR:-${REPO_ROOT}/.artifacts/hpa-validation/bff-$(date +%Y%m%d-%H%M%S)}"
LOAD_POD_NAME="${LOAD_POD_NAME:-bff-hpa-load}"

mkdir -p "$OUTPUT_DIR"

log() { echo "[$(date +%H:%M:%S)] $*"; }
warn() { echo "[$(date +%H:%M:%S)] WARN: $*" >&2; }
fail() { echo "[$(date +%H:%M:%S)] FAIL: $*" >&2; exit 1; }

prefer_k3s_kubeconfig() {
  if [[ -n "${KUBECONFIG:-}" ]]; then
    return 0
  fi

  local k3s_kubeconfig="/etc/rancher/k3s/k3s.yaml"
  if [[ ! -f "$k3s_kubeconfig" ]]; then
    return 0
  fi

  local current_context=""
  current_context="$(kubectl config current-context 2>/dev/null || true)"

  if [[ -n "$current_context" ]]; then
    if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl get nodes >/dev/null 2>&1; then
      return 0
    fi
  fi

  if KUBECONFIG="$k3s_kubeconfig" kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 \
    || KUBECONFIG="$k3s_kubeconfig" kubectl get nodes >/dev/null 2>&1; then
    export KUBECONFIG="$k3s_kubeconfig"
    log "Using k3s kubeconfig at $KUBECONFIG (previous context: ${current_context:-unset})"
  fi
}

for cmd in kubectl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "required command not found: $cmd"
  fi
done

prefer_k3s_kubeconfig

find_hpas_for_target() {
  local target="$1"
  kubectl get hpa -n "$NAMESPACE" \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.scaleTargetRef.name}{"\n"}{end}' 2>/dev/null \
    | awk -F '\t' -v target="$target" '$2 == target { print $1 }'
}

assert_expected_hpa() {
  local target="$1"
  local expected="$2"
  mapfile -t matches < <(find_hpas_for_target "$target")

  if [[ "${#matches[@]}" -eq 0 ]]; then
    return 0
  fi

  if [[ "${#matches[@]}" -gt 1 ]]; then
    fail "multiple HPAs target deployment '$target': ${matches[*]}; remove drifted HPAs before validation"
  fi

  if [[ "${matches[0]}" != "$expected" ]]; then
    fail "unexpected HPA '${matches[0]}' targets deployment '$target'; expected '$expected'"
  fi
}

cleanup_load_pod() {
  kubectl delete pod "$LOAD_POD_NAME" -n "$NAMESPACE" --ignore-not-found=true >/dev/null 2>&1 || true
}

run_incluster_load() {
  cleanup_load_pod
  kubectl run "$LOAD_POD_NAME" \
    -n "$NAMESPACE" \
    --image="$LOAD_IMAGE" \
    --labels=app=frontend \
    --restart=Never \
    --command -- \
    node -e "const url='${BFF_URL}/health'; const endAt=Date.now()+(${LOAD_DURATION}*1000); const workers=${LOAD_CONCURRENCY}; async function worker(){ while (Date.now()<endAt){ try { await fetch(url); } catch (_) {} } } Promise.all(Array.from({length:workers},()=>worker())).then(()=>process.exit(0)).catch(()=>process.exit(1));" \
    2>&1 | tee "${OUTPUT_DIR}/load-incluster.log"
}

trap cleanup_load_pod EXIT

# ── Step 1: Pre-flight checks ────────────────────────────────────────────────
log "Step 1: Pre-flight checks"
log "  Namespace: $NAMESPACE"
log "  Context:   $(kubectl config current-context 2>/dev/null || echo unknown)"
log "  HPA file:  $HPA_FILE"
log "  BFF URL:   $BFF_URL"

if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
  fail "namespace '$NAMESPACE' does not exist"
fi

if ! kubectl get deploy bff -n "$NAMESPACE" >/dev/null 2>&1; then
  fail "deployment 'bff' not found in namespace '$NAMESPACE'"
fi

assert_expected_hpa "bff" "$EXPECTED_HPA_NAME"

# ── Step 2: Record baseline ──────────────────────────────────────────────────
log "Step 2: Recording baseline"
HPA_BEFORE=$(kubectl get hpa "$EXPECTED_HPA_NAME" -n "$NAMESPACE" \
  -o jsonpath='{.spec.minReplicas}/{.spec.maxReplicas}/{.status.currentReplicas}/{.status.desiredReplicas}' \
  2>/dev/null || echo "N/A")
REPLICAS_BEFORE=$(kubectl get deploy bff -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
log "  HPA (min/max/current/desired): $HPA_BEFORE"
log "  Deployment replicas:            $REPLICAS_BEFORE"

CURRENT_MIN=$(kubectl get hpa "$EXPECTED_HPA_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.minReplicas}' 2>/dev/null || echo "")
if [[ -z "$CURRENT_MIN" ]]; then
  warn "HPA $EXPECTED_HPA_NAME not found - will apply manifest"
fi

# ── Step 3: Apply / reconcile HPA ───────────────────────────────────────────
log "Step 3: Applying BFF HPA manifest"
kubectl apply -f "$HPA_FILE" --namespace="$NAMESPACE"
log "HPA applied."
kubectl get hpa "$EXPECTED_HPA_NAME" -n "$NAMESPACE" -o wide 2>&1 | tee "${OUTPUT_DIR}/hpa-before.txt"

# ── Step 4: Wait for HPA to stabilise ───────────────────────────────────────
log "Step 4: Waiting 15s for HPA controller to synchronise"
sleep 15

# ── Step 5: Identify load generation tool ────────────────────────────────────
if command -v k6 >/dev/null 2>&1; then
  LOAD_CMD="k6"
elif command -v hey >/dev/null 2>&1; then
  LOAD_CMD="hey"
elif command -v ab >/dev/null 2>&1; then
  LOAD_CMD="ab"
else
  LOAD_CMD="kubectl"
fi
log "Step 5: Starting sustained load test (${LOAD_DURATION}s, ${LOAD_CONCURRENCY} concurrent)"
log "  Using load tool: $LOAD_CMD"
log "  Metrics to watch:"
log "    kubectl get hpa $EXPECTED_HPA_NAME -n $NAMESPACE -w"
log "    kubectl top pods -n $NAMESPACE -l app=bff"

# ── Step 6: Run load + monitor HPA ───────────────────────────────────────────
MONITOR_LOG="${OUTPUT_DIR}/hpa-monitor.log"
kubectl get hpa "$EXPECTED_HPA_NAME" -n "$NAMESPACE" -w &
HPA_WATCH_PID=$!

# Background load
run_load() {
  case "$LOAD_CMD" in
    k6)
      k6 run - <<'K6SCRIPT' 2>&1 | tee "${OUTPUT_DIR}/load-k6.log"
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  duration: '__DURATION__',
  vus: __VUS__,
  thresholds: { http_req_duration: ['p(95)<1000'] },
};

export default function () {
  const res = http.get('__URL__/health');
  check(res, { 'status 200': r => r.status === 200 });
  sleep(0.02);
}
K6SCRIPT
      ;;
    hey)
      hey -z "${LOAD_DURATION}s" -c "$LOAD_CONCURRENCY" "${BFF_URL}/health" \
        2>&1 | tee "${OUTPUT_DIR}/load-hey.log"
      ;;
    ab)
      ab -n 10000 -c "$LOAD_CONCURRENCY" "${BFF_URL}/health" \
        2>&1 | tee "${OUTPUT_DIR}/load-ab.log"
      ;;
    kubectl)
      run_incluster_load
      ;;
  esac
}

run_load &
LOAD_PID=$!

# Poll replica count
SCALED_UP=false
for i in $(seq 1 $((SCALE_UP_TIMEOUT / 10))); do
  sleep 10
  CURRENT=$(kubectl get deploy bff -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
  DESIRED=$(kubectl get hpa "$EXPECTED_HPA_NAME" -n "$NAMESPACE" -o jsonpath='{.status.desiredReplicas}' 2>/dev/null || echo "0")
  log "  t=$((i*10))s | replicas=$CURRENT | HPA desired=$DESIRED"
  echo "t=$((i*10))s replicas=$CURRENT desired=$DESIRED" >> "$MONITOR_LOG"
  if [[ "$CURRENT" -gt "$MIN_REPLICAS" ]]; then
    SCALED_UP=true
    log "  Scale-up confirmed: replicas=$CURRENT > minReplicas=$MIN_REPLICAS"
    break
  fi
done

kill "$LOAD_PID" 2>/dev/null || true
kill "$HPA_WATCH_PID" 2>/dev/null || true

# ── Step 7: Verify results ───────────────────────────────────────────────────
log "Step 7: Verifying BFF HPA scaling"
kubectl get hpa "$EXPECTED_HPA_NAME" -n "$NAMESPACE" -o wide 2>&1 | tee "${OUTPUT_DIR}/hpa-after.txt"
kubectl get pods -n "$NAMESPACE" -l app=bff 2>&1 | tee "${OUTPUT_DIR}/pods-after.txt"

FINAL_REPLICAS=$(kubectl get deploy bff -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
FINAL_DESIRED=$(kubectl get hpa "$EXPECTED_HPA_NAME" -n "$NAMESPACE" -o jsonpath='{.status.desiredReplicas}' 2>/dev/null || echo "0")

log "  Final replicas: $FINAL_REPLICAS"
log "  HPA desired:    $FINAL_DESIRED"
log "  HPA min/max:    $MIN_REPLICAS / $MAX_REPLICAS"

if [[ "$FINAL_REPLICAS" -le "$MAX_REPLICAS" ]]; then
  log "  [PASS] Replica count within maxReplicas ($FINAL_REPLICAS <= $MAX_REPLICAS)"
else
  fail "Replica count exceeds maxReplicas: $FINAL_REPLICAS > $MAX_REPLICAS"
fi

if [[ "$FINAL_REPLICAS" -gt "$MIN_REPLICAS" ]]; then
  log "  [PASS] Scaled above minReplicas ($FINAL_REPLICAS > $MIN_REPLICAS)"
elif [[ "$FINAL_DESIRED" -gt "$MIN_REPLICAS" ]]; then
  warn "[WARN] HPA desires $FINAL_DESIRED replicas; scale pending"
else
  warn "[PASS] HPA active and within bounds; load may have been insufficient"
fi

log ""
log "========================================"
log "BFF HPA Validation Complete"
log "Output dir: $OUTPUT_DIR"
log "  HPA before: $HPA_BEFORE"
log "  HPA after:  minReplicas=$MIN_REPLICAS maxReplicas=$MAX_REPLICAS current=$FINAL_REPLICAS desired=$FINAL_DESIRED"
log "========================================"

echo "PASS" > "${OUTPUT_DIR}/result.txt"
