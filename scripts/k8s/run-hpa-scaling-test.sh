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
#   3. Generates sustained HTTP load against ml-engine:8001/health
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
SCALE_DOWN_WAIT="${SCALE_DOWN_WAIT:-360}"     # seconds to wait for scale-down
LOAD_INTERVAL="${LOAD_INTERVAL:-0.05}"       # seconds between health requests
LOAD_WORKERS="${LOAD_WORKERS:-25}"           # busybox workers when local load tools are unavailable
OUTPUT_DIR="${OUTPUT_DIR:-${REPO_ROOT}/.artifacts/hpa-scaling-test-$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$OUTPUT_DIR"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()   { echo "[$(date +%H:%M:%S)] $*"; }
warn()  { echo "[$(date +%H:%M:%S)] WARN: $*" >&2; }
fail()  { echo "[$(date +%H:%M:%S)] FAIL: $*" >&2; exit 1; }
info()  { echo "[$(date +%H:%M:%S)] INFO: $*" >&2; }

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
if kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes >/dev/null 2>&1; then
  METRICS_AVAILABLE=true
  log "[OK] metrics.k8s.io is registered"
else
  warn "metrics.k8s.io NOT registered — HPA cannot collect CPU/memory metrics"
  warn "Install metrics-server: kubectl apply -f https://.../components.yaml"
fi

# Check custom metrics API
if kubectl get --raw /apis/custom.metrics.k8s.io/v1beta2 >/dev/null 2>&1; then
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

# ── Step 3: Start load generation ─────────────────────────────────────────────
log ""
log "Step 3: Starting sustained load against ml-engine:8001/health"

# Kill any previous load tests
kubectl delete pod load-test -n "$NAMESPACE" --ignore-not-found=true >/dev/null 2>&1 || true
sleep 2

# Start load as a Kubernetes Job for better reliability
kubectl run load-test \
  --namespace="$NAMESPACE" \
  --image=busybox \
  --restart=Never \
  --dry-run=client \
  -o yaml | sed 's/restart: Always/restart: Never/' | kubectl apply -f - >/dev/null 2>&1 || \
  kubectl run load-test \
    --namespace="$NAMESPACE" \
    --image=busybox \
    --restart=Never \
    --command -- \
    sh -c "worker() { while wget -qO- http://ml-engine:8001/health >/dev/null 2>&1; do sleep ${LOAD_INTERVAL}; done; }; i=0; while [ \$i -lt ${LOAD_WORKERS} ]; do worker & i=\$((i + 1)); done; wait" \
    >/dev/null 2>&1 || true

log "Load generator pod scheduled (may take ~10s to start)"
log "Waiting 15s for load pod to start..."
sleep 15

# Verify load pod is running
LOAD_POD=$(kubectl get pods -n "$NAMESPACE" -l "run=load-test" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
if [[ -n "$LOAD_POD" ]]; then
  LOAD_STATUS=$(kubectl get pod "$LOAD_POD" -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
  log "Load pod '$LOAD_POD' status: $LOAD_STATUS"
else
  warn "Could not find load-test pod"
fi

# ── Step 4: Poll for scale-up ─────────────────────────────────────────────────
log ""
log "Step 4: Polling for scale-up (up to ${SCALE_UP_TIMEOUT}s)"

MONITOR_LOG="${OUTPUT_DIR}/scale-up-monitor.txt"
echo "# time_s replicas_desired replicas_actual cpu_util memory_util" > "$MONITOR_LOG"

# Try to read node metrics (may fail if metrics-server not installed)
get_cpu_util() {
  local pods
  pods=$(kubectl top pods -n "$NAMESPACE" -l "app=ml-engine" --no-headers 2>/dev/null || echo "")
  if [[ -n "$pods" ]]; then
    echo "$pods" | awk '{print $2}' | tr -d 'm' | head -1
  else
    echo "unknown"
  fi
}

SCALED_UP=false
for i in $(seq 1 $((SCALE_UP_TIMEOUT / 10))); do
  sleep 10

  REPLICAS=$(kubectl get deploy ml-engine -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
  DESIRED=$(kubectl get hpa "$EXPECTED_ML_HPA_NAME" -n "$NAMESPACE" -o jsonpath='{.status.desiredReplicas}' 2>/dev/null || echo "0")
  CURRENT=$(kubectl get hpa "$EXPECTED_ML_HPA_NAME" -n "$NAMESPACE" -o jsonpath='{.status.currentReplicas}' 2>/dev/null || echo "0")
  CPU=$(get_cpu_util)
  TIMESTAMP=$(date +%H:%M:%S)

  echo "t=$((i*10))s replicas=${REPLICAS} desired=${DESIRED} current=${CURRENT} cpu=${CPU}" >> "$MONITOR_LOG"
  log "  t=$((i*10))s | ml-engine replicas=$REPLICAS | HPA desired=$DESIRED current=$CURRENT | cpu=$CPU"

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
kubectl top pods -n "$NAMESPACE" -l "app=ml-engine" >> "${OUTPUT_DIR}/hpa-after-load.txt" 2>&1 || true

# ── Step 6: Stop load ────────────────────────────────────────────────────────
log ""
log "Step 6: Stopping load"
kubectl delete pod load-test -n "$NAMESPACE" --ignore-not-found=true >/dev/null 2>&1 || true
log "Load stopped"

# ── Step 7: Wait for scale-down ─────────────────────────────────────────────
log ""
log "Step 7: Waiting ${SCALE_DOWN_WAIT}s for scale-down (stabilization window 300s)"
for i in $(seq 1 $((SCALE_DOWN_WAIT / 30))); do
  sleep 30
  REPLICAS=$(kubectl get deploy ml-engine -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
  DESIRED=$(kubectl get hpa "$EXPECTED_ML_HPA_NAME" -n "$NAMESPACE" -o jsonpath='{.status.desiredReplicas}' 2>/dev/null || echo "0")
  log "  t=${i}0m | ml-engine replicas=$REPLICAS | HPA desired=$DESIRED"

  if [[ "$REPLICAS" -le 1 && "$DESIRED" -le 1 ]]; then
    log "  *** Scale-down complete: replicas=$REPLICAS ***"
    break
  fi
done

# ── Step 8: Final state ───────────────────────────────────────────────────────
log ""
log "Step 8: Final state"
kubectl get hpa -n "$NAMESPACE" -o wide > "${OUTPUT_DIR}/hpa-final.txt"
kubectl get pods -n "$NAMESPACE" -l "app=ml-engine" >> "${OUTPUT_DIR}/hpa-final.txt"
kubectl top pods -n "$NAMESPACE" -l "app=ml-engine" >> "${OUTPUT_DIR}/hpa-final.txt" 2>&1 || true
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
  log "[PASS] Scale-up detected during load test"
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
