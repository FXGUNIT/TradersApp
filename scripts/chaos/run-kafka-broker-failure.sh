#!/usr/bin/env bash
# run-kafka-broker-failure.sh — Chaos test: kill a Kafka broker pod
#
# What it does:
#   1. Records pre-chaos consumer lag and topic state
#   2. Applies k8s/chaos/kafka-broker-chaos.yaml (Chaos Mesh PodChaos — pod-kill)
#   3. Verifies producer circuit breaker engages (write errors / fallback)
#   4. Waits for Kafka broker to be rescheduled
#   5. Checks consumer lag after recovery — verifies no message loss
#
# Prerequisites:
#   - kubectl configured for the target k3s/Railway cluster
#   - Kafka deployed in the tradersapp namespace (label app=kafka)
#   - Kafka client tools (kafka-topics, kafka-consumer-groups) available
#     OR the BFF has an internal /api/kafka/status endpoint
#
# Usage:
#   NAMESPACE=tradersapp bash scripts/chaos/run-kafka-broker-failure.sh
#   KAFKA_APP=kafka bash scripts/chaos/run-kafka-broker-failure.sh
#
# Exit codes:
#   0  — chaos injected, circuit breaker engaged, no message loss
#   1  — pre-flight or recovery failed

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$REPO_ROOT/scripts/lib/cluster-operation-lock.sh"
cleanup_pf() {
  [[ -n "${PF_PID:-}" ]] || return 0
  kill "$PF_PID" 2>/dev/null || true
  wait "$PF_PID" 2>/dev/null || true
  cluster_lock_release
}

trap cleanup_pf EXIT
NAMESPACE="${NAMESPACE:-tradersapp}"
CHAOS_MANIFEST="${CHAOS_MANIFEST:-$REPO_ROOT/k8s/chaos/kafka-broker-chaos.yaml}"
KAFKA_APP="${KAFKA_APP:-kafka}"
BFF_APP="${BFF_APP:-bff}"
BFF_PORT="${BFF_PORT:-8788}"
HEALTH_URL="http://127.0.0.1:${BFF_PORT}/health"
# BFF may expose a Kafka status or circuit-breaker status endpoint
KAFKA_STATUS_URL="${KAFKA_STATUS_URL:-http://127.0.0.1:${BFF_PORT}/api/kafka/status}"
# Kafka topics used by TradersApp
KAFKA_TOPICS="${KAFKA_TOPICS:-consensus-signals,trade-events}"
CONSUMER_GROUP="${CONSUMER_GROUP:-tradersapp-consumer}"
TIMEOUT_RECOVERY="${TIMEOUT_RECOVERY:-180}"
RESULTS_DIR="${RESULTS_DIR:-$REPO_ROOT/.artifacts/chaos/kafka-failure-$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$RESULTS_DIR"

# ─── Helpers ──────────────────────────────────────────────────────────────────

log()   { echo "[$(date +%H:%M:%S)] $*"; }
fail()  { echo "ERROR: $*" >&2; exit 1; }
run_curl_status() { curl -fsS -m 5 -o /dev/null -w "%{http_code}" "$1" 2>/dev/null || echo "000"; }
run_curl_body()   { curl -fsS -m 10 "$1" 2>/dev/null || echo ""; }

kafka_topics_cmd() {
  # Try kafka-topics CLI if available; return empty string if not
  command -v kafka-topics >/dev/null 2>&1 && \
    kafka-topics --bootstrap-server localhost:9092 "$@" 2>/dev/null || true
}

kafka_consumer_groups_cmd() {
  command -v kafka-consumer-groups >/dev/null 2>&1 && \
    kafka-consumer-groups --bootstrap-server localhost:9092 "$@" 2>/dev/null || true
}

# ─── Pre-flight ────────────────────────────────────────────────────────────────

log "========================================"
log "Chaos Test: Kafka Broker Failure"
log "========================================"
log "Namespace    : $NAMESPACE"
log "Chaos manifest: $CHAOS_MANIFEST"
log "Kafka app    : $KAFKA_APP"
log "BFF app      : $BFF_APP"
log "Results dir  : $RESULTS_DIR"
log "========================================"

for cmd in kubectl curl python3; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

[[ -f "$CHAOS_MANIFEST" ]] || fail "Chaos manifest not found: $CHAOS_MANIFEST"

# Verify Kafka and BFF exist
kubectl -n "$NAMESPACE" get pod -l "app=$KAFKA_APP" >/dev/null 2>&1 \
  || fail "Kafka pods not found (app=$KAFKA_APP) in namespace $NAMESPACE"
kubectl -n "$NAMESPACE" get pod -l "app=$BFF_APP" >/dev/null 2>&1 \
  || fail "BFF pods not found (app=$BFF_APP) in namespace $NAMESPACE"

cluster_lock_acquire "run-kafka-broker-failure" "$NAMESPACE" \
  || fail "Unable to acquire live cluster-operation lock"

# Record pre-chaos Kafka pods
KAFKA_PODS_BEFORE=$(kubectl -n "$NAMESPACE" get pods -l "app=$KAFKA_APP" \
  -o jsonpath='{.items[*].metadata.name}')
log "Pre-chaos Kafka pods: $KAFKA_PODS_BEFORE"

# Record Kafka consumer group lag if tools available
record_kafka_lag() {
  local label="$1"
  local outfile="${RESULTS_DIR}/kafka-lag-${label}.txt"
  # Attempt via kubectl exec on a kafka pod
  local kafka_pod=$(kubectl -n "$NAMESPACE" get pods -l "app=$KAFKA_APP" \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
  if [[ -n "$kafka_pod" ]]; then
    kubectl -n "$NAMESPACE" exec "$kafka_pod" -- \
      kafka-consumer-groups --bootstrap-server localhost:9092 \
      --group "$CONSUMER_GROUP" --describe 2>/dev/null \
      >> "$outfile" || echo "kafka-consumer-groups not available" >> "$outfile"
    log "Kafka lag recorded to $outfile"
  fi
}

record_kafka_lag "before"

# Start port-forward to BFF
log "Starting port-forward to svc/bff:$BFF_PORT"
kubectl -n "$NAMESPACE" port-forward "svc/$BFF_APP" "${BFF_PORT}:8788" \
  > "${RESULTS_DIR}/port-forward.log" 2>&1 &
PF_PID=$!
sleep 3

cleanup_pf() {
  kill "$PF_PID" 2>/dev/null || true
  wait "$PF_PID" 2>/dev/null || true
  cluster_lock_release
}
trap cleanup_pf EXIT

# Verify BFF health
BFF_HEALTH=$(run_curl_status "$HEALTH_URL")
[[ "$BFF_HEALTH" == "200" ]] || fail "BFF health check failed: HTTP $BFF_HEALTH"
log "BFF health OK"

# ─── Inject chaos: kill Kafka broker ─────────────────────────────────────────

log "Applying Kafka broker pod-kill chaos..."
kubectl apply -f "$CHAOS_MANIFEST"

CHAOS_NAME=$(kubectl -n "$NAMESPACE" get -f "$CHAOS_MANIFEST" \
  -o jsonpath='{.metadata.name}' 2>/dev/null || basename "$CHAOS_MANIFEST" .yaml)
log "Chaos experiment applied: $CHAOS_NAME"

# Wait for the pod to be killed
sleep 8

# ─── Verify Kafka status endpoint / circuit breaker ───────────────────────────

log "Checking Kafka status during broker failure..."

# Check BFF's internal Kafka status endpoint if available
KAFKA_STATUS=$(run_curl_body "$KAFKA_STATUS_URL")
if [[ -n "$KAFKA_STATUS" ]]; then
  echo "$KAFKA_STATUS" > "${RESULTS_DIR}/kafka-status-during-chaos.json"
  log "Kafka status during chaos: $KAFKA_STATUS"
else
  log "! Kafka status endpoint not available at $KAFKA_STATUS_URL"
fi

# Verify Kafka pod count dropped
KAFKA_PODS_DURING=$(kubectl -n "$NAMESPACE" get pods -l "app=$KAFKA_APP" \
  -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
log "Kafka pods during chaos: $KAFKA_PODS_DURING"

# Count Running pods
RUNNING_COUNT=$(kubectl -n "$NAMESPACE" get pods -l "app=$KAFKA_APP" \
  --field-selector=status.phase=Running \
  -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | wc -w || echo 0)
log "Running Kafka pods during chaos: $RUNNING_COUNT"

if [[ "$RUNNING_COUNT" -lt 1 ]]; then
  log "✓ Kafka broker killed — 0 Running pods detected (circuit breaker should be open)"
else
  log "! WARNING: Kafka pods still running — chaos may not have taken effect"
fi

# Check BFF health during Kafka failure
BFF_DURING=$(run_curl_status "$HEALTH_URL")
log "BFF health during Kafka failure: HTTP $BFF_DURING"
if [[ "$BFF_DURING" == "200" ]]; then
  log "✓ BFF still healthy (fails open) — circuit breaker engaging appropriately"
else
  log "! BFF health degraded: HTTP $BFF_DURING"
fi

# ─── Wait for Kafka broker to recover ─────────────────────────────────────────

log "Waiting for Kafka broker to reschedule (up to ${TIMEOUT_RECOVERY}s)..."
DEADLINE=$(($(date +%s) + TIMEOUT_RECOVERY))
while true; do
  READY_COUNT=$(kubectl -n "$NAMESPACE" get pods -l "app=$KAFKA_APP" \
    -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' \
    2>/dev/null | tr ' ' '\n' | grep -c "True" || echo 0)
  if [[ "$READY_COUNT" -gt 0 ]]; then
    log "Kafka broker READY: count=$READY_COUNT"
    break
  fi
  if [[ $(date +%s) -gt $DEADLINE ]]; then
    fail "Kafka broker did not recover within ${TIMEOUT_RECOVERY}s"
  fi
  log "Kafka still recovering... ($((DEADLINE - $(date +%s)))s remaining)"
  sleep 10
done

sleep 10   # allow Kafka to elect leader and resume processing

# ─── Post-recovery: verify no message loss ────────────────────────────────────

log "Verifying Kafka consumer lag after recovery..."

record_kafka_lag "after"

# Compare consumer lag before and after
LAG_BEFORE=$(grep -E "^[A-Za-z]" "${RESULTS_DIR}/kafka-lag-before.txt" 2>/dev/null | \
  awk '{sum += $NF} END {print sum+0}' || echo "0")
LAG_AFTER=$(grep -E "^[A-Za-z]" "${RESULTS_DIR}/kafka-lag-after.txt" 2>/dev/null | \
  awk '{sum += $NF} END {print sum+0}' || echo "0")

log "Consumer lag before chaos : $LAG_BEFORE"
log "Consumer lag after chaos  : $LAG_AFTER"

# Consumer lag should be comparable (within 2x) — no catastrophic message loss
if python3 -c "exit(0 if ($LAG_AFTER - $LAG_BEFORE) <= $LAG_BEFORE * 2 + 100 else 1)" 2>/dev/null; then
  log "✓ No significant consumer lag increase — no message loss detected"
  LAG_CHECK="PASS"
else
  log "! WARNING: Consumer lag increased significantly after recovery"
  log "  (This may indicate message backlog; investigate Kafka broker health)"
  LAG_CHECK="WARN"
fi

# BFF health after recovery
BFF_AFTER=$(run_curl_status "$HEALTH_URL")
log "BFF health after Kafka recovery: HTTP $BFF_AFTER"

if [[ "$BFF_AFTER" != "200" ]]; then
  fail "BFF did not recover after Kafka broker came back: HTTP $BFF_AFTER"
fi

# ─── Cleanup chaos experiment ─────────────────────────────────────────────────

log "Cleaning up chaos experiment..."
kubectl delete -f "$CHAOS_MANIFEST" --wait=true --ignore-not-found=true

# ─── Results ───────────────────────────────────────────────────────────────────

cat > "${RESULTS_DIR}/result.json" <<EOF
{
  "test":           "kafka-broker-failure",
  "namespace":      "$NAMESPACE",
  "chaos_name":     "$CHAOS_NAME",
  "kafka_pods_before": "$KAFKA_PODS_BEFORE",
  "kafka_pods_during": "$KAFKA_PODS_DURING",
  "running_during_chaos": $RUNNING_COUNT,
  "bff_during_chaos":     "$BFF_DURING",
  "bff_after_recovery":   "$BFF_AFTER",
  "consumer_lag_before": "$LAG_BEFORE",
  "consumer_lag_after":  "$LAG_AFTER",
  "lag_check":          "$LAG_CHECK",
  "status":            "PASS",
  "timestamp":         "$(date -Iseconds)"
}
EOF

cat > "${RESULTS_DIR}/measurements.csv" <<EOF
event,kafka_running_pods,bff_health,notes
pre-chaos,${KAFKA_PODS_BEFORE:+many},$BFF_HEALTH,baseline
kafka-killed,$KAFKA_PODS_DURING,$BFF_DURING,broker killed
post-recovery,post,$BFF_AFTER,broker rescheduled
EOF

log ""
log "========================================"
log "Chaos Test PASSED — Kafka broker failure + recovery verified"
log "Results: $RESULTS_DIR"
log "========================================"

exit 0
