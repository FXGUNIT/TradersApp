#!/usr/bin/env bash
# scripts/k8s/validate-postgres-cutover-prereqs.sh
#
# Read-only preflight for TODO 13 (PostgreSQL cutover).
# This script does not mutate the cluster. It only performs kubectl reads and
# reports PASS/WARN/FAIL for the cutover prerequisites.
#
# Checks:
#   - kubectl presence
#   - current context
#   - cluster reachability
#   - namespace existence
#   - ml-engine-secrets presence
#   - DATABASE_URL presence in ml-engine-secrets
#   - REQUIRE_DATABASE_URL presence in config/deployment env
#   - ml-engine deployment and pod presence
#   - service / endpoints / readiness hints
#
# Usage:
#   bash scripts/k8s/validate-postgres-cutover-prereqs.sh
#   NAMESPACE=tradersapp-dev bash scripts/k8s/validate-postgres-cutover-prereqs.sh
#   bash scripts/k8s/validate-postgres-cutover-prereqs.sh --namespace tradersapp-dev

set -euo pipefail

NAMESPACE="${NAMESPACE:-tradersapp-dev}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-ml-engine}"
SERVICE_NAME="${SERVICE_NAME:-ml-engine}"
SECRET_NAME="${SECRET_NAME:-ml-engine-secrets}"
CONFIGMAP_NAME="${CONFIGMAP_NAME:-ml-engine-env}"
REQUEST_TIMEOUT="${REQUEST_TIMEOUT:-10s}"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

usage() {
  cat <<'EOF'
Usage:
  validate-postgres-cutover-prereqs.sh [--namespace <name>] [--help]

Environment:
  NAMESPACE        Kubernetes namespace to validate (default: tradersapp-dev)
  DEPLOYMENT_NAME  ml-engine deployment name (default: ml-engine)
  SERVICE_NAME     ml-engine service name (default: ml-engine)
  SECRET_NAME      ml-engine Kubernetes secret name (default: ml-engine-secrets)
  CONFIGMAP_NAME   ConfigMap that carries REQUIRE_DATABASE_URL (default: ml-engine-env)
  REQUEST_TIMEOUT   kubectl request timeout, e.g. 10s (default: 10s)

This script is read-only. It uses kubectl get/list calls only and does not
modify the cluster.
EOF
}

timestamp() { date +%H:%M:%S; }
pass() {
  printf '[%s] PASS: %s\n' "$(timestamp)" "$*"
  PASS_COUNT=$((PASS_COUNT + 1))
}
warn() {
  printf '[%s] WARN: %s\n' "$(timestamp)" "$*"
  WARN_COUNT=$((WARN_COUNT + 1))
}
fail() {
  printf '[%s] FAIL: %s\n' "$(timestamp)" "$*" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

die_usage() {
  printf '[%s] FAIL: %s\n' "$(timestamp)" "$*" >&2
  usage
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    die_usage "required command not found: $1"
  fi
}

prefer_k3s_kubeconfig() {
  if [[ -n "${KUBECONFIG:-}" ]]; then
    return 0
  fi

  if [[ ! -f /etc/rancher/k3s/k3s.yaml ]]; then
    return 0
  fi

  local current_context=""
  current_context="$(kubectl config current-context 2>/dev/null || true)"
  if [[ -z "$current_context" || "$current_context" == "docker-desktop" ]]; then
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    printf '[%s] INFO: using k3s kubeconfig at %s (previous context: %s)\n' "$(timestamp)" "$KUBECONFIG" "${current_context:-unset}"
  fi
}

parse_args() {
  while (($# > 0)); do
    case "$1" in
      -n|--namespace)
        [[ $# -ge 2 ]] || die_usage "missing value for $1"
        NAMESPACE="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die_usage "unknown argument: $1"
        ;;
    esac
  done
}

check_key_in_secret() {
  local secret_name="$1"
  local secret_key="$2"
  local value

  value="$(kubectl --request-timeout="$REQUEST_TIMEOUT" -n "$NAMESPACE" get secret "$secret_name" -o "jsonpath={.data.${secret_key}}" 2>/dev/null || true)"
  if [[ -n "$value" ]]; then
    pass "secret/$secret_name contains key $secret_key"
    return 0
  fi

  fail "secret/$secret_name is missing key $secret_key or is not readable"
  return 1
}

check_require_database_url() {
  local config_value deploy_value sources=()

  config_value="$(kubectl --request-timeout="$REQUEST_TIMEOUT" -n "$NAMESPACE" get configmap "$CONFIGMAP_NAME" -o jsonpath='{.data.REQUIRE_DATABASE_URL}' 2>/dev/null || true)"
  deploy_value="$(kubectl --request-timeout="$REQUEST_TIMEOUT" -n "$NAMESPACE" get deploy "$DEPLOYMENT_NAME" -o jsonpath='{range .spec.template.spec.containers[?(@.name=="ml-engine")].env[?(@.name=="REQUIRE_DATABASE_URL")]}{.value}{end}' 2>/dev/null || true)"

  if [[ -n "$config_value" ]]; then
    sources+=("configmap/$CONFIGMAP_NAME")
  fi
  if [[ -n "$deploy_value" ]]; then
    sources+=("deployment/$DEPLOYMENT_NAME env")
  fi

  if ((${#sources[@]} > 0)); then
    pass "REQUIRE_DATABASE_URL present in ${sources[*]}"
    return 0
  fi

  fail "REQUIRE_DATABASE_URL not found in configmap/$CONFIGMAP_NAME or deployment/$DEPLOYMENT_NAME env"
  return 1
}

check_pod_readiness_hints() {
  local pod_lines ready_pods not_ready_pods total_pods

  pod_lines="$(kubectl --request-timeout="$REQUEST_TIMEOUT" -n "$NAMESPACE" get pods -l app="$DEPLOYMENT_NAME" -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\t"}{range .status.containerStatuses[*]}{.ready}{" "}{end}{"\n"}{end}' 2>/dev/null || true)"

  if [[ -z "$pod_lines" ]]; then
    fail "no pods found with label app=$DEPLOYMENT_NAME in namespace $NAMESPACE"
    return 1
  fi

  total_pods="$(printf '%s\n' "$pod_lines" | sed '/^$/d' | wc -l | tr -d ' ')"
  ready_pods="$(printf '%s\n' "$pod_lines" | awk '$0 ~ /true/ {c++} END {print c+0}')"
  not_ready_pods="$((total_pods - ready_pods))"

  if ((ready_pods > 0)); then
    pass "pods found for app=$DEPLOYMENT_NAME ($ready_pods/$total_pods report at least one ready container)"
  else
    warn "pods found for app=$DEPLOYMENT_NAME but none report ready containers yet"
  fi

  if ((not_ready_pods > 0)); then
    warn "$not_ready_pods pod(s) still report not-ready containers"
  fi

  printf '[%s] INFO: pod readiness snapshot for app=%s:\n' "$(timestamp)" "$DEPLOYMENT_NAME"
  printf '%s\n' "$pod_lines" | while IFS=$'\t' read -r pod_name phase readiness; do
    [[ -n "$pod_name" ]] || continue
    printf '[%s] INFO:   %s phase=%s ready=%s\n' "$(timestamp)" "$pod_name" "${phase:-unknown}" "${readiness:-unknown}"
  done
}

check_service_hints() {
  local service_type service_ports endpoints ready_addresses not_ready_addresses

  service_type="$(kubectl --request-timeout="$REQUEST_TIMEOUT" -n "$NAMESPACE" get service "$SERVICE_NAME" -o jsonpath='{.spec.type}' 2>/dev/null || true)"
  service_ports="$(kubectl --request-timeout="$REQUEST_TIMEOUT" -n "$NAMESPACE" get service "$SERVICE_NAME" -o jsonpath='{range .spec.ports[*]}{.name}:{.port}->{.targetPort}{" "}{end}' 2>/dev/null || true)"
  if [[ -n "$service_type" ]]; then
    pass "service/$SERVICE_NAME exists (type=$service_type ports=${service_ports:-unknown})"
  else
    warn "service/$SERVICE_NAME not found in namespace $NAMESPACE"
  fi

  endpoints="$(kubectl --request-timeout="$REQUEST_TIMEOUT" -n "$NAMESPACE" get endpoints "$SERVICE_NAME" -o jsonpath='{range .subsets[*].addresses[*]}{.ip}{" "}{end}' 2>/dev/null || true)"
  ready_addresses="${endpoints//[[:space:]]/}"
  not_ready_addresses="$(kubectl --request-timeout="$REQUEST_TIMEOUT" -n "$NAMESPACE" get endpoints "$SERVICE_NAME" -o jsonpath='{range .subsets[*].notReadyAddresses[*]}{.ip}{" "}{end}' 2>/dev/null || true)"

  if [[ -n "$ready_addresses" ]]; then
    pass "service/$SERVICE_NAME has ready endpoint(s): ${endpoints}"
  else
    warn "service/$SERVICE_NAME has no ready endpoints yet"
  fi

  if [[ -n "$not_ready_addresses" ]]; then
    warn "service/$SERVICE_NAME also has not-ready endpoints: ${not_ready_addresses}"
  fi
}

parse_args "$@"

require_cmd kubectl
prefer_k3s_kubeconfig
pass "kubectl is installed ($(command -v kubectl))"

printf '[%s] INFO: validating PostgreSQL cutover prereqs\n' "$(timestamp)"
printf '[%s] INFO: namespace=%s deployment=%s service=%s secret=%s configmap=%s\n' \
  "$(timestamp)" "$NAMESPACE" "$DEPLOYMENT_NAME" "$SERVICE_NAME" "$SECRET_NAME" "$CONFIGMAP_NAME"
printf '[%s] INFO: read-only mode only; no cluster mutations will be performed\n' "$(timestamp)"

context="$(kubectl config current-context 2>/dev/null || true)"
if [[ -n "$context" ]]; then
  pass "current kubectl context is '$context'"
else
  fail "kubectl current context is empty or unavailable"
fi

if kubectl --request-timeout="$REQUEST_TIMEOUT" get --raw='/readyz' >/dev/null 2>&1; then
  pass "Kubernetes API is reachable for the current context"
else
  fail "Kubernetes API is not reachable for the current context"
  printf '[%s] INFO: summary: %d pass, %d warn, %d fail\n' "$(timestamp)" "$PASS_COUNT" "$WARN_COUNT" "$FAIL_COUNT"
  exit 1
fi

if kubectl --request-timeout="$REQUEST_TIMEOUT" get namespace "$NAMESPACE" >/dev/null 2>&1; then
  pass "namespace/$NAMESPACE exists"
else
  fail "namespace/$NAMESPACE is missing"
fi

if kubectl --request-timeout="$REQUEST_TIMEOUT" -n "$NAMESPACE" get secret "$SECRET_NAME" >/dev/null 2>&1; then
  pass "secret/$SECRET_NAME exists in namespace $NAMESPACE"
else
  fail "secret/$SECRET_NAME is missing from namespace $NAMESPACE"
fi

check_key_in_secret "$SECRET_NAME" DATABASE_URL
check_require_database_url

if kubectl --request-timeout="$REQUEST_TIMEOUT" -n "$NAMESPACE" get deploy "$DEPLOYMENT_NAME" >/dev/null 2>&1; then
  pass "deployment/$DEPLOYMENT_NAME exists in namespace $NAMESPACE"
  ready_replicas="$(kubectl --request-timeout="$REQUEST_TIMEOUT" -n "$NAMESPACE" get deploy "$DEPLOYMENT_NAME" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  available_replicas="$(kubectl --request-timeout="$REQUEST_TIMEOUT" -n "$NAMESPACE" get deploy "$DEPLOYMENT_NAME" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || true)"
  desired_replicas="$(kubectl --request-timeout="$REQUEST_TIMEOUT" -n "$NAMESPACE" get deploy "$DEPLOYMENT_NAME" -o jsonpath='{.spec.replicas}' 2>/dev/null || true)"
  pass "deployment/$DEPLOYMENT_NAME replica snapshot desired=${desired_replicas:-unknown} ready=${ready_replicas:-0} available=${available_replicas:-0}"
else
  fail "deployment/$DEPLOYMENT_NAME is missing from namespace $NAMESPACE"
fi

check_pod_readiness_hints
check_service_hints

printf '[%s] INFO: summary: %d pass, %d warn, %d fail\n' "$(timestamp)" "$PASS_COUNT" "$WARN_COUNT" "$FAIL_COUNT"
if ((FAIL_COUNT > 0)); then
  exit 1
fi

exit 0
