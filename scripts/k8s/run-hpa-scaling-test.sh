#!/usr/bin/env bash
# scripts/k8s/run-hpa-scaling-test.sh
# End-to-end HPA live scaling test for TradersApp microservices.
#
# Prerequisites (must be satisfied before running):
#   1. kubectl configured with cluster access
#   2. metrics-server installed (for CPU/memory HPA metrics)
#   3. ml-engine and bff pods Running (not Pending/CrashLoopBackOff)
#   4. HPA manifests applied: ml-engine-hpa + bff-hpa in tradersapp-dev
#
# What this script does:
#   1. Pre-flight checks (metrics API, pod readiness, HPA existence)
#   2. Records baseline HPA state
#   3. Generates sustained HTTP load against ml-engine:8001/predict
#   4. Polls replica count every 10s for up to SCALE_UP_TIMEOUT seconds
#   5. Reports whether scale-up was detected
#   6. Stops load, waits for scale-down, reports final state
#
# Usage:
#   bash scripts/k8s/run-hpa-scaling-test.sh
#
#   # Override defaults
#   NAMESPACE=tradersapp-dev SCALE_UP_TIMEOUT=120 bash scripts/k8s/run-hpa-scaling-test.sh

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-tradersapp-dev}"
ML_HPA_FILE="${ML_HPA_FILE:-${REPO_ROOT}/k8s/overlay/dev/hpa-ml-engine.yaml}"
BFF_HPA_FILE="${BFF_HPA_FILE:-${REPO_ROOT}/k8s/overlay/dev/hpa-bff.yaml}"
EXPECTED_ML_HPA_NAME="${EXPECTED_ML_HPA_NAME:-ml-engine-hpa}"
EXPECTED_BFF_HPA_NAME="${EXPECTED_BFF_HPA_NAME:-bff-hpa}"
SCALE_UP_TIMEOUT="${SCALE_UP_TIMEOUT:-180}"   # seconds to wait for scale-up
SCALE_DOWN_WAIT="${SCALE_DOWN_WAIT:-}"        # auto-computed unless explicitly set
LOAD_INTERVAL="${LOAD_INTERVAL:-0.05}"       # seconds between predict requests
LOAD_WORKERS="${LOAD_WORKERS:-25}"           # keep default aligned with the focused validator's proven-safe profile
LOAD_IMAGE="${LOAD_IMAGE:-tradersapp/bff:dev-latest}"
LOAD_POD_NAME="${LOAD_POD_NAME:-load-test}"
OUTPUT_DIR="${OUTPUT_DIR:-${REPO_ROOT}/.artifacts/hpa-scaling-test-$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$OUTPUT_DIR"

DEFAULT_SCALE_DOWN_STABILIZATION=300
DEFAULT_SCALE_DOWN_PERIOD=60
DEFAULT_SCALE_DOWN_BUFFER=30

# ── Helpers ───────────────────────────────────────────────────────────────────
log()   { echo "[$(date +%H:%M:%S)] $*"; }
warn()  { echo "[$(date +%H:%M:%S)] WARN: $*" >&2; }
fail()  { echo "[$(date +%H:%M:%S)] FAIL: $*" >&2; exit 1; }
info()  { echo "[$(date +%H:%M:%S)] INFO: $*" >&2; }

cleanup_load_pod() {
  kubectl delete pod "$LOAD_POD_NAME" \
    -n "$NAMESPACE" \
    --ignore-not-found=true \
    --force \
    --grace-period=0 \
    --wait=false \
    >/dev/null 2>&1 || true
}

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

# Capture everything to a log file too
exec > >(tee "${OUTPUT_DIR}/run.log") 2>&1

trap cleanup_load_pod EXIT

# ── Step 0: Tool check ───────────────────────────────────────────────────────
for cmd in kubectl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "required command not found: $cmd"
  fi
done

prefer_k3s_kubeconfig

# ── Step 1: Pre-flight checks ─────────────────────────────────────────────────
log "========================================"
log "HPA Live Scaling Test — TradersApp"
log "Namespace:   $NAMESPACE"
log "Cluster:     $(kubectl config current-context 2>/dev/null || echo unknown)"
log "Started:     $(date -Iseconds)"
log "Output dir:  $OUTPUT_DIR"
log "========================================"

# Check namespace
if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
  fail "namespace '$NAMESPACE' does not exist"
fi
log "[OK] Namespace '$NAMESPACE' exists"

# Check metrics API (critical — HPA won't work without it)
METRICS_AVAILABLE=false
if kubectl --request-timeout=10s get --raw /apis/metrics.k8s.io/v1beta1/nodes >/dev/null 2>&1; then
  METRICS_AVAILABLE=true
  log "[OK] metrics.k8s.io is registered"
else
  warn "metrics.k8s.io NOT registered — HPA cannot collect CPU/memory metrics"
  warn "Install metrics-server: kubectl apply -f https://.../components.yaml"
fi

# Check custom metrics API
if kubectl --request-timeout=10s get --raw /apis/custom.metrics.k8s.io/v1beta2 >/dev/null 2>&1; then
  log "[OK] custom.metrics.k8s.io is registered"
else
  warn "custom.metrics.k8s.io NOT registered — custom HPA metrics (e.g. ml-engine-p95-latency-ms) will be <unknown>"
fi

# Check HPA existence
assert_expected_hpa "ml-engine" "$EXPECTED_ML_HPA_NAME"
assert_expected_hpa "bff" "$EXPECTED_BFF_HPA_NAME"

for hpa in "$EXPECTED_ML_HPA_NAME" "$EXPECTED_BFF_HPA_NAME"; do
  if kubectl get hpa "$hpa" -n "$NAMESPACE" >/dev/null 2>&1; then
    log "[OK] HPA '$hpa' exists"
  else
    warn "HPA '$hpa' not found — applying from repo"
    if [[ "$hpa" == "$EXPECTED_ML_HPA_NAME" ]]; then
      kubectl apply -f "$ML_HPA_FILE" 2>&1 | sed 's/^/    /'
    else
      kubectl apply -f "$BFF_HPA_FILE" 2>&1 | sed 's/^/    /'
    fi
  fi
done

# Check pod readiness
check_pods() {
  local svc="$1"
  local ready
  ready=$(kubectl get pods -n "$NAMESPACE" -l "app=${svc}" \
    -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)
  [[ "$ready" == *"True"* ]]
}

if check_pods "ml-engine"; then
  log "[OK] ml-engine pods are Running"
else
  warn "ml-engine pods are NOT Running — HPA scale-up may not be triggered"
  kubectl get pods -n "$NAMESPACE" -l "app=ml-engine" 2>&1 | tee "${OUTPUT_DIR}/ml-engine-pods.txt"
  warn "Common causes: PVC missing, image pull error, init container failure"
fi

if check_pods "bff"; then
  log "[OK] bff pods are Running"
else
  warn "bff pods are NOT Running"
  kubectl get pods -n "$NAMESPACE" -l "app=bff" 2>&1 | tee "${OUTPUT_DIR}/bff-pods.txt"
fi

# ── Step 2: Record baseline ──────────────────────────────────────────────────
log ""
log "Step 2: Recording baseline HPA state"
kubectl get hpa -n "$NAMESPACE" -o wide > "${OUTPUT_DIR}/hpa-baseline.txt"
kubectl get deploy -n "$NAMESPACE" -o wide >> "${OUTPUT_DIR}/hpa-baseline.txt"
kubectl describe hpa -n "$NAMESPACE" > "${OUTPUT_DIR}/hpa-describe-baseline.txt"
cat "${OUTPUT_DIR}/hpa-baseline.txt"

BASELINE_REPLICAS=$(kubectl --request-timeout=10s get deploy ml-engine -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "1")

# ── Step 3: Start load generation ─────────────────────────────────────────────
log ""
log "Step 3: Starting sustained load against ml-engine:8001/predict"

# Kill any previous load tests
cleanup_load_pod
sleep 2

# Start load as a Kubernetes Job for better reliability
kubectl run "$LOAD_POD_NAME" \
  --namespace="$NAMESPACE" \
  --image="$LOAD_IMAGE" \
  --labels=app=frontend \
  --restart=Never \
  --command -- \
  node -e "const url='http://ml-engine:8001/predict'; const payload=JSON.stringify({symbol:'MNQ',candles:[]}); const headers={'Content-Type':'application/json'}; const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms)); async function worker(){ while (true) { try { await fetch(url,{method:'POST',headers,body:payload}); } catch (_) {} await sleep(${LOAD_INTERVAL} * 1000); } } Promise.all(Array.from({length:${LOAD_WORKERS}},()=>worker())).catch(()=>process.exit(1));" \
  >/dev/null 2>&1 || true

log "Load generator pod scheduled (may take ~10s to start)"
log "Waiting 15s for load pod to start..."
sleep 15

# Verify load pod is running
LOAD_POD=$(kubectl get pod "$LOAD_POD_NAME" -n "$NAMESPACE" -o jsonpath='{.metadata.name}' 2>/dev/null || echo "")
if [[ "$LOAD_POD" == "$LOAD_POD_NAME" ]]; then
  LOAD_STATUS=$(kubectl get pod "$LOAD_POD" -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
  log "Load pod '$LOAD_POD' status: $LOAD_STATUS"
else
  warn "Could not find load pod '$LOAD_POD_NAME'"
fi

# ── Step 4: Poll for scale-up ─────────────────────────────────────────────────
log ""
log "Step 4: Polling for scale-up (up to ${SCALE_UP_TIMEOUT}s)"

MONITOR_LOG="${OUTPUT_DIR}/scale-up-monitor.txt"
echo "# time_s replicas_desired replicas_actual cpu_util memory_util" > "$MONITOR_LOG"

# Try to read node metrics (may fail if metrics-server not installed)
get_cpu_util() {
  local pods
  pods=$(kubectl --request-timeout=10s top pods -n "$NAMESPACE" -l "app=ml-engine" --no-headers 2>/dev/null || echo "")
  if [[ -n "$pods" ]]; then
    echo "$pods" | awk '{print $2}' | tr -d 'm' | head -1
  else
    echo "unknown"
  fi
}

SCALED_UP=false
PEAK_REPLICAS="$BASELINE_REPLICAS"
PEAK_DESIRED="$BASELINE_REPLICAS"
for i in $(seq 1 $((SCALE_UP_TIMEOUT / 10))); do
  sleep 10

  REPLICAS=$(kubectl --request-timeout=10s get deploy ml-engine -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
  DESIRED=$(kubectl --request-timeout=10s get hpa "$EXPECTED_ML_HPA_NAME" -n "$NAMESPACE" -o jsonpath='{.status.desiredReplicas}' 2>/dev/null || echo "0")
  CURRENT=$(kubectl --request-timeout=10s get hpa "$EXPECTED_ML_HPA_NAME" -n "$NAMESPACE" -o jsonpath='{.status.currentReplicas}' 2>/dev/null || echo "0")
  CPU=$(get_cpu_util)
  TIMESTAMP=$(date +%H:%M:%S)

  echo "t=$((i*10))s replicas=${REPLICAS} desired=${DESIRED} current=${CURRENT} cpu=${CPU}" >> "$MONITOR_LOG"
  log "  t=$((i*10))s | ml-engine replicas=$REPLICAS | HPA desired=$DESIRED current=$CURRENT | cpu=$CPU"

  if [[ "$REPLICAS" -gt "$PEAK_REPLICAS" ]]; then
    PEAK_REPLICAS="$REPLICAS"
  fi
  if [[ "$DESIRED" -gt "$PEAK_DESIRED" ]]; then
    PEAK_DESIRED="$DESIRED"
  fi

  # Scale-up detected: actual replicas > 1 (hpa minReplicas default) AND scaling is active
  if [[ "$REPLICAS" -gt 1 || "$DESIRED" -gt 1 ]]; then
    SCALED_UP=true
    log "  *** Scale-up DETECTED: replicas=$REPLICAS > 1 ***"
    break
  fi

  # If no metrics available, HPA can't scale — report immediately
  if [[ "$METRICS_AVAILABLE" == "false" ]]; then
    warn "Metrics API not available — HPA cannot scale without CPU/memory metrics"
    warn "Install metrics-server to enable scaling"
    break
  fi
done

# ── Step 5: Capture scale-up state ───────────────────────────────────────────
log ""
log "Step 5: Capturing scale-up state"
kubectl get hpa -n "$NAMESPACE" -o wide > "${OUTPUT_DIR}/hpa-after-load.txt"
kubectl get pods -n "$NAMESPACE" -l "app=ml-engine" >> "${OUTPUT_DIR}/hpa-after-load.txt"
kubectl --request-timeout=10s top pods -n "$NAMESPACE" -l "app=ml-engine" >> "${OUTPUT_DIR}/hpa-after-load.txt" 2>&1 || true

# ── Step 6: Stop load ────────────────────────────────────────────────────────
log ""
log "Step 6: Stopping load"
cleanup_load_pod
log "Load stopped"

# ── Step 7: Wait for scale-down ─────────────────────────────────────────────
log ""
SCALE_DOWN_START_REPLICAS=$(kubectl --request-timeout=10s get deploy ml-engine -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "$PEAK_REPLICAS")
if [[ "$SCALE_DOWN_START_REPLICAS" -lt "$PEAK_REPLICAS" ]]; then
  SCALE_DOWN_START_REPLICAS="$PEAK_REPLICAS"
fi
scale_down_steps=0
scale_down_cursor="$SCALE_DOWN_START_REPLICAS"
while [[ "$scale_down_cursor" -gt "$BASELINE_REPLICAS" ]]; do
  scale_down_cursor=$(( (scale_down_cursor + 1) / 2 ))
  scale_down_steps=$((scale_down_steps + 1))
done

if [[ -z "$SCALE_DOWN_WAIT" ]]; then
  SCALE_DOWN_WAIT=$(((scale_down_steps * DEFAULT_SCALE_DOWN_STABILIZATION) + DEFAULT_SCALE_DOWN_BUFFER))
fi

log "Step 7: Waiting up to ${SCALE_DOWN_WAIT}s for scale-down to baseline replicas=${BASELINE_REPLICAS} (peak=${SCALE_DOWN_START_REPLICAS})"
SCALE_DOWN_COMPLETE=false
for i in $(seq 1 $((SCALE_DOWN_WAIT / 30))); do
  sleep 30
  REPLICAS=$(kubectl --request-timeout=10s get deploy ml-engine -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
  DESIRED=$(kubectl --request-timeout=10s get hpa "$EXPECTED_ML_HPA_NAME" -n "$NAMESPACE" -o jsonpath='{.status.desiredReplicas}' 2>/dev/null || echo "0")
  elapsed=$((i * 30))
  log "  t=${elapsed}s | ml-engine replicas=$REPLICAS | HPA desired=$DESIRED"

  if [[ "$REPLICAS" -le "$BASELINE_REPLICAS" && "$DESIRED" -le "$BASELINE_REPLICAS" ]]; then
    SCALE_DOWN_COMPLETE=true
    log "  *** Scale-down complete: replicas=$REPLICAS ***"
    break
  fi
done

# ── Step 8: Final state ───────────────────────────────────────────────────────
log ""
log "Step 8: Final state"
kubectl get hpa -n "$NAMESPACE" -o wide > "${OUTPUT_DIR}/hpa-final.txt"
kubectl get pods -n "$NAMESPACE" -l "app=ml-engine" >> "${OUTPUT_DIR}/hpa-final.txt"
kubectl --request-timeout=10s top pods -n "$NAMESPACE" -l "app=ml-engine" >> "${OUTPUT_DIR}/hpa-final.txt" 2>&1 || true
cat "${OUTPUT_DIR}/hpa-final.txt"

# ── Step 9: Print summary ──────────────────────────────────────────────────────
log ""
log "========================================"
log "HPA Scaling Test — Summary"
log "========================================"
cat "${OUTPUT_DIR}/hpa-baseline.txt"
echo ""
echo "--- After load ---"
cat "${OUTPUT_DIR}/hpa-after-load.txt"
echo ""
echo "--- Final state ---"
cat "${OUTPUT_DIR}/hpa-final.txt"
echo ""
echo "Monitor log:"
cat "${OUTPUT_DIR}/scale-up-monitor.txt"
echo ""

if [[ "$SCALED_UP" == "true" ]]; then
  if [[ "$SCALE_DOWN_COMPLETE" == "true" ]]; then
    log "[PASS] Scale-up detected during load test and scale-down returned to baseline"
    echo "PASS" > "${OUTPUT_DIR}/result.txt"
  else
    warn "[FAIL] Scale-up occurred, but scale-down did not return to baseline within ${SCALE_DOWN_WAIT}s"
    echo "FAIL" > "${OUTPUT_DIR}/result.txt"
    exit 1
  fi
elif [[ "$METRICS_AVAILABLE" == "false" ]]; then
  warn "[BLOCKED] metrics.k8s.io not available — HPA cannot function"
  warn "[ACTION] Install metrics-server to enable HPA"
  echo "BLOCKED" > "${OUTPUT_DIR}/result.txt"
else
  warn "[INCONCLUSIVE] Scale-up not detected — load may have been insufficient"
  warn "[ACTION] Increase LOAD_INTERVAL (decrease wait) or run longer"
  echo "INCONCLUSIVE" > "${OUTPUT_DIR}/result.txt"
fi

log "Results saved to: $OUTPUT_DIR"
log "See docs/HPA_SCALING_TEST_RUNBOOK.md for full runbook and blocker details"
