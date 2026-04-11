#!/usr/bin/env bash
# scripts/k8s/validate-live-cluster-gates.sh
#
# Read-only validation for the live k3s cluster gates referenced by
# docs/TODO_MASTER_LIST.md immediate next actions.
#
# Checks:
#   - namespace existence
#   - required secrets:
#       * ml-engine-secrets
#       * bff-secrets or tradersapp-secrets
#       * mlflow-runtime-secret
#   - HPA presence
#   - PodDisruptionBudget presence
#   - ResourceQuota presence
#   - LimitRange presence
#
# Usage:
#   bash scripts/k8s/validate-live-cluster-gates.sh
#   NAMESPACE=tradersapp-dev bash scripts/k8s/validate-live-cluster-gates.sh
#   bash scripts/k8s/validate-live-cluster-gates.sh --namespace tradersapp-dev

set -euo pipefail

NAMESPACE="${NAMESPACE:-tradersapp-dev}"

usage() {
  cat <<'EOF'
Usage:
  validate-live-cluster-gates.sh [--namespace <name>] [--help]

Environment:
  NAMESPACE   Kubernetes namespace to validate (default: tradersapp-dev)

This script is read-only. It uses kubectl get/list calls only and does not
modify the cluster.
EOF
}

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
pass() { printf '[%s] PASS: %s\n' "$(date +%H:%M:%S)" "$*"; }
fail() {
  printf '[%s] FAIL: %s\n' "$(date +%H:%M:%S)" "$*" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

PASS_COUNT=0
FAIL_COUNT=0

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[%s] FAIL: required command not found: %s\n' "$(date +%H:%M:%S)" "$1" >&2
    exit 1
  fi
}

check_exists() {
  local kind="$1"
  local name="$2"
  local output

  if output="$(kubectl get "$kind" "$name" -n "$NAMESPACE" -o name 2>&1)"; then
    pass "$kind/$name exists in namespace $NAMESPACE"
    PASS_COUNT=$((PASS_COUNT + 1))
  elif [[ "$output" == *"NotFound"* || "$output" == *"not found"* ]]; then
    fail "$kind/$name is missing from namespace $NAMESPACE"
  else
    fail "unable to query $kind/$name in namespace $NAMESPACE: $output"
  fi

  return 0
}

check_any_exists() {
  local kind="$1"
  shift

  local found=()
  local errors=()
  local candidate
  local output

  for candidate in "$@"; do
    if output="$(kubectl get "$kind" "$candidate" -n "$NAMESPACE" -o name 2>&1)"; then
      found+=("$candidate")
    elif [[ "$output" == *"NotFound"* || "$output" == *"not found"* ]]; then
      continue
    else
      errors+=("$candidate => $output")
    fi
  done

  if ((${#found[@]} > 0)); then
    pass "$kind gate satisfied by: ${found[*]}"
    PASS_COUNT=$((PASS_COUNT + 1))
  elif ((${#errors[@]} > 0)); then
    fail "unable to query $kind gate in namespace $NAMESPACE: ${errors[*]}"
  else
    fail "$kind gate missing; none of these exist in namespace $NAMESPACE: $*"
  fi

  return 0
}

check_collection_presence() {
  local kind="$1"
  local label="$2"

  local items
  if items="$(kubectl get "$kind" -n "$NAMESPACE" -o name 2>&1)"; then
    if [[ -n "$items" ]]; then
      pass "$label present: ${items//$'\n'/, }"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      fail "$label missing from namespace $NAMESPACE"
    fi
  else
    fail "$label check failed in namespace $NAMESPACE: $items"
  fi

  return 0
}

while (($# > 0)); do
  case "$1" in
    -n|--namespace)
      if [[ $# -lt 2 ]]; then
        printf '[%s] FAIL: missing value for %s\n' "$(date +%H:%M:%S)" "$1" >&2
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
      printf '[%s] FAIL: unknown argument: %s\n' "$(date +%H:%M:%S)" "$1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd kubectl

log "Validating live cluster gates"
log "Namespace: $NAMESPACE"
log "Mode: read-only kubectl get/list checks only"

if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
  fail "namespace '$NAMESPACE' does not exist"
else
  pass "namespace '$NAMESPACE' exists"
  PASS_COUNT=$((PASS_COUNT + 1))
fi

check_exists secret ml-engine-secrets
check_any_exists secret bff-secrets tradersapp-secrets
check_exists secret mlflow-runtime-secret
check_collection_presence hpa "HPA"
check_collection_presence pdb "PodDisruptionBudget"
check_collection_presence resourcequota "ResourceQuota"
check_collection_presence limitrange "LimitRange"

log "Summary: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
if [[ $FAIL_COUNT -gt 0 ]]; then
  log "Result: FAIL"
  exit 1
fi

log "Result: PASS"
