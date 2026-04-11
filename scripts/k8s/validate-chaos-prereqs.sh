#!/usr/bin/env bash
# scripts/k8s/validate-chaos-prereqs.sh
#
# Read-only preflight for chaos TODOs 57-60:
#   57 - kill a random ml-engine pod
#   58 - network partition / delay one pod
#   59 - Redis failover
#   60 - Kafka broker failure
#
# Checks performed:
#   - kubectl presence
#   - current context configured and reachable
#   - Chaos Mesh CRDs (PodChaos, NetworkChaos)
#   - target namespace existence
#   - local chaos manifests and runners exist
#   - required controllers/services and replica readiness
#
# This script never mutates the cluster. It only reads cluster state.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-tradersapp}"
KUBECTL_TIMEOUT="${KUBECTL_TIMEOUT:-5s}"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

usage() {
  cat <<EOF
Usage:
  validate-chaos-prereqs.sh [--namespace <name>] [--help]

Environment:
  NAMESPACE         Kubernetes namespace to inspect (default: tradersapp)
  KUBECTL_TIMEOUT   Timeout for kubectl calls (default: 5s)

This script is read-only. It performs preflight checks for TODOs 57-60 and
does not apply, patch, delete, or restart any Kubernetes resource.
EOF
}

now() {
  date +%H:%M:%S
}

section() {
  printf '\n[%s] === %s ===\n' "$(now)" "$*"
}

pass() {
  printf '[%s] PASS: %s\n' "$(now)" "$*"
  PASS_COUNT=$((PASS_COUNT + 1))
}

warn() {
  printf '[%s] WARN: %s\n' "$(now)" "$*" >&2
  WARN_COUNT=$((WARN_COUNT + 1))
}

fail() {
  printf '[%s] FAIL: %s\n' "$(now)" "$*" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

kctl() {
  kubectl --request-timeout="$KUBECTL_TIMEOUT" "$@"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "required command not found: $1"
    return 1
  fi
}

check_local_file() {
  local path="$1"
  local label="$2"

  if [[ -f "$path" ]]; then
    pass "$label exists: ${path#"$REPO_ROOT"/}"
  else
    fail "$label missing: ${path#"$REPO_ROOT"/}"
  fi
}

check_crd() {
  local crd="$1"

  if kctl get crd "$crd" >/dev/null 2>&1; then
    pass "Chaos Mesh CRD installed: $crd"
  else
    fail "Chaos Mesh CRD missing: $crd"
  fi
}

check_namespace() {
  if kctl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    pass "namespace exists: $NAMESPACE"
  else
    fail "namespace missing: $NAMESPACE"
  fi
}

check_context() {
  local context
  context="$(kubectl config current-context 2>/dev/null || true)"

  if [[ -n "$context" ]]; then
    pass "current kubectl context configured: $context"
  else
    fail "no current kubectl context is configured"
    return
  fi

  if kctl get --raw='/readyz' >/dev/null 2>&1; then
    pass "current context is reachable (/readyz responded)"
  else
    fail "current context is not reachable or not authorized (/readyz failed)"
  fi
}

check_service() {
  local name="$1"

  if kctl get service "$name" -n "$NAMESPACE" >/dev/null 2>&1; then
    pass "service exists: svc/$name"
  else
    fail "service missing: svc/$name"
  fi
}

check_controller() {
  local kind="$1"
  local name="$2"
  local min_ready="$3"
  local label="$4"
  local warn_single="${5:-0}"

  if ! kctl get "$kind" "$name" -n "$NAMESPACE" >/dev/null 2>&1; then
    fail "$label missing: $kind/$name"
    return
  fi

  local desired ready
  desired="$(kctl get "$kind" "$name" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || true)"
  ready="$(kctl get "$kind" "$name" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  desired="${desired:-0}"
  ready="${ready:-0}"

  if [[ ! "$desired" =~ ^[0-9]+$ ]]; then
    desired=0
  fi
  if [[ ! "$ready" =~ ^[0-9]+$ ]]; then
    ready=0
  fi

  if (( desired < min_ready )); then
    fail "$label has only $desired desired replica(s); minimum required is $min_ready"
    return
  fi

  if (( ready < min_ready )); then
    fail "$label has only $ready ready replica(s); minimum required is $min_ready"
    return
  fi

  pass "$label ready (desired=$desired, ready=$ready, minimum=$min_ready)"

  if [[ "$warn_single" == "1" && "$desired" -eq 1 ]]; then
    warn "$label is single-replica; the corresponding chaos drill will be maximally disruptive"
  fi
}

check_drill_57() {
  section "TODO 57 - kill a random ml-engine pod"
  check_local_file "$REPO_ROOT/k8s/chaos/ml-engine-pod-chaos.yaml" "Chaos manifest"
  check_local_file "$REPO_ROOT/scripts/chaos/run-pod-kill.sh" "Runner script"
  check_crd "podchaos.chaos-mesh.org"
  check_service "ml-engine"
  check_controller "deployment" "ml-engine" 2 "ml-engine deployment"
}

check_drill_58() {
  section "TODO 58 - network partition / delay one pod"
  check_local_file "$REPO_ROOT/k8s/chaos/bff-network-delay-chaos.yaml" "Chaos manifest"
  check_local_file "$REPO_ROOT/scripts/chaos/run-network-partition.sh" "Runner script"
  check_crd "networkchaos.chaos-mesh.org"
  check_service "bff"
  check_controller "deployment" "bff" 1 "bff deployment"
  check_service "ml-engine"
  check_controller "deployment" "ml-engine" 1 "ml-engine deployment"
}

check_drill_59() {
  section "TODO 59 - Redis failover"
  check_local_file "$REPO_ROOT/k8s/chaos/redis-failover.yaml" "Chaos manifest"
  check_local_file "$REPO_ROOT/scripts/chaos/run-redis-failover.sh" "Runner script"
  check_crd "podchaos.chaos-mesh.org"
  check_service "redis"
  check_controller "deployment" "redis" 1 "redis deployment" 1
  check_service "bff"
  check_controller "deployment" "bff" 1 "bff deployment"
}

check_drill_60() {
  section "TODO 60 - Kafka broker failure"
  check_local_file "$REPO_ROOT/k8s/chaos/kafka-broker-chaos.yaml" "Chaos manifest"
  check_local_file "$REPO_ROOT/scripts/chaos/run-kafka-broker-failure.sh" "Runner script"
  check_crd "podchaos.chaos-mesh.org"
  check_service "kafka"
  check_service "kafka-headless"
  check_controller "statefulset" "kafka" 1 "kafka statefulset" 1
  check_service "bff"
  check_controller "deployment" "bff" 1 "bff deployment"
}

while (($# > 0)); do
  case "$1" in
    -n|--namespace)
      if [[ $# -lt 2 ]]; then
        printf '[%s] FAIL: missing value for %s\n' "$(now)" "$1" >&2
        usage
        exit 1
      fi
      NAMESPACE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf '[%s] FAIL: unknown argument: %s\n' "$(now)" "$1" >&2
      usage
      exit 1
      ;;
  esac
done

section "Chaos Preflight"
printf '[%s] WARN: Chaos drills 57-60 are disruptive and must not run concurrently with other agent work against the same cluster or namespace.\n' "$(now)"
printf '[%s] WARN: This script is read-only; it only inspects cluster state and local manifests.\n' "$(now)"
printf '[%s] INFO: Namespace: %s\n' "$(now)" "$NAMESPACE"

need_cmd kubectl

check_context
check_namespace
check_crd "podchaos.chaos-mesh.org"
check_crd "networkchaos.chaos-mesh.org"

check_drill_57
check_drill_58
check_drill_59
check_drill_60

section "Summary"
printf '[%s] PASS: %d\n' "$(now)" "$PASS_COUNT"
printf '[%s] WARN: %d\n' "$(now)" "$WARN_COUNT"
printf '[%s] FAIL: %d\n' "$(now)" "$FAIL_COUNT"

if (( FAIL_COUNT > 0 )); then
  printf '[%s] RESULT: FAIL\n' "$(now)" >&2
  exit 1
fi

printf '[%s] RESULT: PASS\n' "$(now)"
exit 0
