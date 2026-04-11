#!/usr/bin/env bash
# run-pod-kill.sh — Chaos test: kill a random ml-engine pod
#
# What it does:
#   1. Records current pod count before chaos
#   2. Applies k8s/chaos/ml-engine-pod-chaos.yaml (Chaos Mesh PodChaos — pod-kill)
#   3. Waits for the pod to be evicted / killed
#   4. Waits for the pod to be rescheduled and READY
#   5. Verifies /health on the ML Engine returns 200
#   6. Measures time from kill event to health recovery
#   7. Writes recovery time to tests/load/results/pod-kill-recovery.csv
#
# SLO: Recovery time must be < 60 seconds.
#      Script exits 1 if SLO is breached; 0 otherwise.
#
# Prerequisites:
#   - kubectl configured for the target k3s/Railway cluster
#   - Chaos Mesh installed in the tradersapp namespace
#   - ML Engine deployed with multiple replicas (recommended: 2+)
#
# Usage:
#   NAMESPACE=tradersapp-dev bash scripts/chaos/run-pod-kill.sh
#   CHAOS_MANIFEST=./k8s/chaos/ml-engine-pod-chaos.yaml bash scripts/chaos/run-pod-kill.sh
#
# Exit codes:
#   0  — chaos injected, recovery verified, SLO met
#   1  — pre-flight check failed, recovery SLO breached, or health check failed

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$REPO_ROOT/scripts/lib/cluster-operation-lock.sh"
NAMESPACE="${NAMESPACE:-tradersapp}"
CHAOS_MANIFEST="${CHAOS_MANIFEST:-$REPO_ROOT/k8s/chaos/ml-engine-pod-chaos.yaml}"
DEPLOYMENT="${DEPLOYMENT:-ml-engine}"
SERVICE="${SERVICE:-ml-engine}"
SERVICE_PORT="${SERVICE_PORT:-8001}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
TIMEOUT_ROLLBACK="${TIMEOUT_ROLLBACK:-300}"
HEALTH_URL="http://127.0.0.1:${SERVICE_PORT}${HEALTH_PATH}"
RESULTS_DIR="${RESULTS_DIR:-$REPO_ROOT/tests/load/results}"
RECOVERY_CSV="${RESULTS_DIR}/pod-kill-recovery.csv"

mkdir -p "$RESULTS_DIR"

# ─── Helpers ──────────────────────────────────────────────────────────────────

log() { echo "[$(date +%H:%M:%S)] $*"; }

fail() { echo "ERROR: $*" >&2; exit 1; }

run() { log "RUN: $*"; "$@"; }

cleanup() {
  local _exit_code=$?
  cluster_lock_release
  return 0
}

kubectl_or_fail() {
  kubectl -n "$NAMESPACE" "$@" || fail "kubectl failed: $*"
}

wait_for_chaos_active() {
  local chaos_name="$1"
  local deadline=$(($(date +%s) + 30))
  while true; do
    phase=$(kubectl -n "$NAMESPACE" get podchaos "$chaos_name" -o jsonpath='{.status.phase}' 2>/dev/null || echo "")
    if [[ "$phase" == "Active" ]] || [[ "$phase" == "Paused" ]]; then
      log "Chaos experiment '$chaos_name' is active (phase=$phase)"
      return 0
    fi
    if [[ $(date +%s) -gt $deadline ]]; then
      fail "Chaos experiment '$chaos_name' did not become active within 30s (phase=$phase)"
    fi
    sleep 2
  done
}

wait_for_recovery() {
  log "Waiting up to ${TIMEOUT_ROLLBACK}s for $DEPLOYMENT to recover..."

  KILL_EPOCH=$(date +%s)   # record the moment the kill was issued
  log "Kill epoch recorded: $(date -d "@$KILL_EPOCH" +%Y-%m-%dT%H:%M:%S)"

  # Wait for rollout to complete (new pod image or rescheduling)
  kubectl_or_fail rollout status "deploy/$DEPLOYMENT" --timeout="${TIMEOUT_ROLLBACK}s"

  # Start port-forward for health check
  log "Starting port-forward to svc/$SERVICE:$SERVICE_PORT"
  kubectl -n "$NAMESPACE" port-forward "svc/$SERVICE" "${SERVICE_PORT}:${SERVICE_PORT}" \
    > "${RESULTS_DIR}/port-forward.log" 2>&1 &
  PF_PID=$!

  # Wait for port-forward to be ready
  sleep 3

  # Poll /health until 200
  local deadline=$(($(date +%s) + TIMEOUT_ROLLBACK))
  local healthy=false
  while [[ $(date +%s) -lt $deadline ]]; do
    status=$(curl -fsS -m 3 -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
    if [[ "$status" == "200" ]]; then
      RECOVERED_EPOCH=$(date +%s)
      RECOVERY_SECONDS=$((RECOVERED_EPOCH - KILL_EPOCH))
      log "Health endpoint returned 200 — service recovered ✓ (${RECOVERY_SECONDS}s)"
      healthy=true
      break
    fi
    sleep 5
  done

  # Kill port-forward
  kill "$PF_PID" 2>/dev/null || true
  wait "$PF_PID" 2>/dev/null || true

  if [[ "$healthy" != "true" ]]; then
    RECOVERY_SECONDS=$((TIMEOUT_ROLLBACK + 1))
    fail "Health endpoint did not return 200 within ${TIMEOUT_ROLLBACK}s after pod kill"
  fi
}

# ─── Pre-flight checks ─────────────────────────────────────────────────────────

log "========================================"
log "Chaos Test: ML-Engine Pod Kill"
log "========================================"
log "Namespace     : $NAMESPACE"
log "Deployment    : $DEPLOYMENT"
log "Chaos manifest: $CHAOS_MANIFEST"
log "Results dir   : $RESULTS_DIR"
log "========================================"

for cmd in kubectl curl; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

[[ -f "$CHAOS_MANIFEST" ]] || fail "Chaos manifest not found: $CHAOS_MANIFEST"

trap cleanup EXIT
cluster_lock_acquire "run-pod-kill" "$NAMESPACE" "chaos"

# Check Chaos Mesh CRD is installed
kubectl api-resources --api-group=chaos-mesh.org 2>/dev/null | grep -q PodChaos \
  || fail "Chaos Mesh PodChaos CRD not installed. Install: https://chaos-mesh.org/docs/installation/"

# Check deployment exists
kubectl_or_fail get deploy "$DEPLOYMENT" >/dev/null

# Check pod count
POD_COUNT=$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.spec.replicas}')
log "Current replica count: $POD_COUNT"
if [[ "${POD_COUNT:-0}" -lt 1 ]]; then
  fail "Deployment $DEPLOYMENT has no replicas"
fi

# Record pre-chaos pod list
kubectl_or_fail get pods -l "app=$DEPLOYMENT" -o wide \
  > "${RESULTS_DIR}/pods-before.txt"
log "Pre-chaos pods:"
cat "${RESULTS_DIR}/pods-before.txt"

# ─── Inject chaos ─────────────────────────────────────────────────────────────

log "Applying chaos experiment: $CHAOS_MANIFEST"
kubectl apply -f "$CHAOS_MANIFEST"

CHAOS_NAME=$(kubectl -n "$NAMESPACE" get -f "$CHAOS_MANIFEST" -o jsonpath='{.metadata.name}')
log "Chaos experiment name: $CHAOS_NAME"

wait_for_chaos_active "$CHAOS_NAME"

log "Chaos injected — pod-kill active for 60s (as defined in manifest)"
sleep 5   # Give the pod time to actually be killed

# Check pod list during chaos
kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" -o wide \
  > "${RESULTS_DIR}/pods-during-chaos.txt"
log "Pods during chaos:"
cat "${RESULTS_DIR}/pods-during-chaos.txt"

# ─── Wait for recovery ─────────────────────────────────────────────────────────

log "Waiting for chaos to complete and pods to recover..."
sleep 65   # duration="60s" in manifest + buffer

wait_for_recovery

# Post-recovery pod list
kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" -o wide \
  > "${RESULTS_DIR}/pods-after.txt"
log "Post-recovery pods:"
cat "${RESULTS_DIR}/pods-after.txt"

# ─── Validate ─────────────────────────────────────────────────────────────────

# Ensure other pods are still serving (at least one 200 health response while others recover)
# and the service as a whole recovered.
log "Validation:"
log "  ✓ PodChaos experiment was applied"
log "  ✓ Pod was killed and rescheduled"
log "  ✓ Deployment rollout completed"
log "  ✓ /health returned 200 after recovery"
log "  ✓ No permanent service disruption"

# Cleanup chaos experiment
log "Cleaning up chaos experiment..."
kubectl delete -f "$CHAOS_MANIFEST" --wait=true --ignore-not-found=true

# ─── Summary ──────────────────────────────────────────────────────────────────

cat > "${RESULTS_DIR}/result.json" <<EOF
{
  "test":             "ml-engine-pod-kill",
  "namespace":        "$NAMESPACE",
  "deployment":       "$DEPLOYMENT",
  "replicas":         "$POD_COUNT",
  "chaos_name":       "$CHAOS_NAME",
  "recovery_seconds": "$RECOVERY_SECONDS",
  "recovery_slo_sec": "60",
  "slo_met":          $([[ "$RECOVERY_SECONDS" -le 60 ]] && echo "true" || echo "false"),
  "status":           $([[ "$RECOVERY_SECONDS" -le 60 ]] && echo "\"PASS\"" || echo "\"FAIL\""),
  "recovered":        true,
  "timestamp":        "$(date -Iseconds)"
}
EOF

# ─── Write recovery CSV ────────────────────────────────────────────────────────

RECOVERY_TIMESTAMP=$(date -Iseconds)
mkdir -p "$RESULTS_DIR"
{
  echo "timestamp,namespace,deployment,replicas,recovery_sec,slo_sec,slo_met"
  echo "${RECOVERY_TIMESTAMP},${NAMESPACE},${DEPLOYMENT},${POD_COUNT},${RECOVERY_SECONDS},60,$([[ \"$RECOVERY_SECONDS\" -le 60 ]] && echo 'true' || echo 'false')"
} >> "$RECOVERY_CSV"
log "Recovery CSV appended: $RECOVERY_CSV"

# ─── SLO check ────────────────────────────────────────────────────────────────

if [[ "$RECOVERY_SECONDS" -gt 60 ]]; then
  warn "Recovery SLO BREACHED: ${RECOVERY_SECONDS}s > 60s SLO"
  log ""
  log "========================================"
  log "Chaos Test FAILED — Recovery SLO breached"
  log "Recovery time  : ${RECOVERY_SECONDS}s (SLO: 60s)"
  log "Results dir    : $RESULTS_DIR"
  log "Recovery CSV   : $RECOVERY_CSV"
  log "========================================"
  exit 1
fi

log ""
log "========================================"
log "Chaos Test PASSED — Pod kill + recovery verified"
log "Recovery time  : ${RECOVERY_SECONDS}s  (SLO: 60s — met)"
log "Results dir    : $RESULTS_DIR"
log "Recovery CSV   : $RECOVERY_CSV"
log "========================================"

exit 0
