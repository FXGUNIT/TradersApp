#!/usr/bin/env bash
# Diagnose metrics.k8s.io stability over a fixed sampling window.
#
# Captures:
# - APIService availability status/reason
# - Whether `kubectl top nodes` succeeds
# - metrics-server deployment readiness and pod restart counts
# - HPA ScalingActive state for ml-engine and bff
#
# Usage:
#   NAMESPACE=tradersapp-dev bash scripts/k8s/diagnose-metrics-api-stability.sh
#   DURATION_SECONDS=300 INTERVAL_SECONDS=15 bash scripts/k8s/diagnose-metrics-api-stability.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-tradersapp-dev}"
EXPECTED_ML_HPA_NAME="${EXPECTED_ML_HPA_NAME:-ml-engine-hpa}"
EXPECTED_BFF_HPA_NAME="${EXPECTED_BFF_HPA_NAME:-bff-hpa}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-15}"
DURATION_SECONDS="${DURATION_SECONDS:-300}"
OUTPUT_DIR="${OUTPUT_DIR:-${REPO_ROOT}/.artifacts/metrics-api-stability-$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$OUTPUT_DIR"

log()  { echo "[$(date +%H:%M:%S)] $*"; }
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

metrics_api_available() {
  kubectl --request-timeout=10s top nodes --no-headers >/dev/null 2>&1
}

get_hpa_condition_status() {
  local hpa="$1"
  local condition="$2"
  local status=""
  status="$(kubectl get hpa "$hpa" -n "$NAMESPACE" \
    -o jsonpath="{.status.conditions[?(@.type==\"${condition}\")].status}" 2>/dev/null || true)"
  if [[ -n "$status" ]]; then
    echo "$status"
  else
    echo "Unknown"
  fi
}

get_apiservice_status() {
  kubectl get apiservice v1beta1.metrics.k8s.io \
    -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' 2>/dev/null || true
}

get_apiservice_reason() {
  kubectl get apiservice v1beta1.metrics.k8s.io \
    -o jsonpath='{.status.conditions[?(@.type=="Available")].reason}' 2>/dev/null || true
}

get_metrics_server_ready() {
  kubectl get deploy metrics-server -n kube-system \
    -o jsonpath='{.status.readyReplicas}/{.status.replicas}' 2>/dev/null || echo "0/0"
}

get_metrics_server_pods() {
  kubectl get pod -n kube-system -l k8s-app=metrics-server \
    -o jsonpath='{range .items[*]}{.metadata.name}{":"}{.status.phase}{":"}{range .status.containerStatuses[*]}{.restartCount}{end}{" "}{end}' 2>/dev/null || true
}

capture_snapshot() {
  local stamp="$1"
  kubectl get apiservice v1beta1.metrics.k8s.io -o yaml > "${OUTPUT_DIR}/${stamp}-apiservice.yaml" 2>&1 || true
  kubectl get deploy metrics-server -n kube-system -o yaml > "${OUTPUT_DIR}/${stamp}-metrics-server-deploy.yaml" 2>&1 || true
  kubectl get pod -n kube-system -l k8s-app=metrics-server -o wide > "${OUTPUT_DIR}/${stamp}-metrics-server-pods.txt" 2>&1 || true
  kubectl logs -n kube-system deploy/metrics-server --tail=200 > "${OUTPUT_DIR}/${stamp}-metrics-server.log" 2>&1 || true
  kubectl get hpa "$EXPECTED_ML_HPA_NAME" "$EXPECTED_BFF_HPA_NAME" -n "$NAMESPACE" -o wide > "${OUTPUT_DIR}/${stamp}-hpa.txt" 2>&1 || true
}

for cmd in kubectl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "required command not found: $cmd"
  fi
done

prefer_k3s_kubeconfig

exec > >(tee "${OUTPUT_DIR}/run.log") 2>&1

log "========================================"
log "Metrics API Stability Probe"
log "Namespace:   $NAMESPACE"
log "Duration:    ${DURATION_SECONDS}s"
log "Interval:    ${INTERVAL_SECONDS}s"
log "Output dir:  $OUTPUT_DIR"
log "========================================"

if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
  fail "namespace '$NAMESPACE' does not exist"
fi

capture_snapshot "start"

SAMPLES_FILE="${OUTPUT_DIR}/samples.tsv"
printf "timestamp\tapiservice_available\tapiservice_reason\ttop_nodes\tmetrics_server_ready\tmetrics_server_pods\tml_scaling_active\tbff_scaling_active\n" > "$SAMPLES_FILE"

end_at=$(( $(date +%s) + DURATION_SECONDS ))
sample_count=0
top_failures=0
apiservice_failures=0
scaling_failures=0

while (( $(date +%s) < end_at )); do
  sample_count=$((sample_count + 1))
  timestamp="$(date -Iseconds)"
  apiservice_available="$(get_apiservice_status)"
  apiservice_reason="$(get_apiservice_reason)"
  metrics_server_ready="$(get_metrics_server_ready)"
  metrics_server_pods="$(get_metrics_server_pods)"
  ml_scaling="$(get_hpa_condition_status "$EXPECTED_ML_HPA_NAME" "ScalingActive")"
  bff_scaling="$(get_hpa_condition_status "$EXPECTED_BFF_HPA_NAME" "ScalingActive")"

  top_nodes_state="up"
  if ! metrics_api_available; then
    top_nodes_state="down"
    top_failures=$((top_failures + 1))
  fi

  if [[ "$apiservice_available" != "True" ]]; then
    apiservice_failures=$((apiservice_failures + 1))
  fi

  if [[ "$ml_scaling" != "True" || "$bff_scaling" != "True" ]]; then
    scaling_failures=$((scaling_failures + 1))
  fi

  printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
    "$timestamp" \
    "${apiservice_available:-Unknown}" \
    "${apiservice_reason:-Unknown}" \
    "$top_nodes_state" \
    "$metrics_server_ready" \
    "${metrics_server_pods:-none}" \
    "$ml_scaling" \
    "$bff_scaling" \
    >> "$SAMPLES_FILE"

  log "sample=${sample_count} apiservice=${apiservice_available:-Unknown}/${apiservice_reason:-Unknown} top_nodes=${top_nodes_state} metrics_server=${metrics_server_ready} ml=${ml_scaling} bff=${bff_scaling}"

  if [[ "$top_nodes_state" == "down" || "$apiservice_available" != "True" ]]; then
    warn "Captured metrics instability at sample ${sample_count}"
    capture_snapshot "flap-${sample_count}"
  fi

  sleep "$INTERVAL_SECONDS"
done

capture_snapshot "end"

RESULT="PASS"
if (( top_failures > 0 || apiservice_failures > 0 || scaling_failures > 0 )); then
  RESULT="FLAPPING"
fi

printf "result=%s\nsamples=%s\ntop_failures=%s\napiservice_failures=%s\nscaling_failures=%s\n" \
  "$RESULT" "$sample_count" "$top_failures" "$apiservice_failures" "$scaling_failures" \
  > "${OUTPUT_DIR}/summary.txt"

log "========================================"
log "Summary"
log "========================================"
cat "${OUTPUT_DIR}/summary.txt"
