#!/usr/bin/env bash
# Read-only preflight checks for TODOs 55, 56, and 62.
#
# This script only inspects local tooling, kube context, and cluster object
# state. It does not scale workloads, patch manifests, port-forward, or mutate
# any Kubernetes resource.
#
# Checks performed:
#   - kubectl, curl, python3 availability
#   - k6 and/or Locust availability
#   - current kubectl context and API server reachability
#   - namespace, deployment, service, and endpoint availability
#   - load-test wrapper help output
#   - benchmark cold-start low-blast-radius flags (`--skip-restart` / `--base-url`)
#
# Usage:
#   bash scripts/k8s/validate-load-benchmark-prereqs.sh
#   NAMESPACE=tradersapp bash scripts/k8s/validate-load-benchmark-prereqs.sh
#   BASE_URL=http://127.0.0.1:8001 bash scripts/k8s/validate-load-benchmark-prereqs.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

NAMESPACE="${NAMESPACE:-tradersapp-dev}"
ML_ENGINE_DEPLOYMENT="${ML_ENGINE_DEPLOYMENT:-ml-engine}"
ML_ENGINE_SERVICE="${ML_ENGINE_SERVICE:-ml-engine}"
BFF_DEPLOYMENT="${BFF_DEPLOYMENT:-bff}"
BFF_SERVICE="${BFF_SERVICE:-bff}"
SCALE_SCRIPT="${SCALE_SCRIPT:-$REPO_ROOT/scripts/k8s/scale-load-test.sh}"
COLD_WARM_SCRIPT="${COLD_WARM_SCRIPT:-$REPO_ROOT/scripts/k8s/run-cold-warm-cache-load-test.sh}"
BENCHMARK_SCRIPT="${BENCHMARK_SCRIPT:-$REPO_ROOT/scripts/k8s/benchmark-cold-start.py}"
BASE_URL="${BASE_URL:-${BENCHMARK_BASE_URL:-}}"
CURL_TIMEOUT="${CURL_TIMEOUT:-5}"
KUBECTL_REQUEST_TIMEOUT="${KUBECTL_REQUEST_TIMEOUT:-5s}"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "PASS: $*"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  echo "WARN: $*" >&2
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "FAIL: $*" >&2
}

usage() {
  cat <<'EOF'
Usage: bash scripts/k8s/validate-load-benchmark-prereqs.sh [options]

Read-only preflight for TODOs 55, 56, and 62.

Options:
  --namespace NAME              Kubernetes namespace to inspect (default: tradersapp-dev)
  --ml-engine-deployment NAME   ML Engine deployment name (default: ml-engine)
  --ml-engine-service NAME      ML Engine service name (default: ml-engine)
  --bff-deployment NAME         BFF deployment name (default: bff)
  --bff-service NAME           BFF service name (default: bff)
  --base-url URL               Optional low-blast-radius benchmark URL
  --scale-script PATH          Path to scripts/k8s/scale-load-test.sh
  --cold-warm-script PATH      Path to scripts/k8s/run-cold-warm-cache-load-test.sh
  --benchmark-script PATH      Path to scripts/k8s/benchmark-cold-start.py
  --curl-timeout SECONDS       curl timeout for health probes (default: 5)
  --kubectl-timeout DURATION   kubectl request timeout (default: 5s)
  --help                       Show this help

Environment variables:
  NAMESPACE, ML_ENGINE_DEPLOYMENT, ML_ENGINE_SERVICE, BFF_DEPLOYMENT,
  BFF_SERVICE, SCALE_SCRIPT, COLD_WARM_SCRIPT, BENCHMARK_SCRIPT, BASE_URL,
  BENCHMARK_BASE_URL, CURL_TIMEOUT, KUBECTL_REQUEST_TIMEOUT

Notes:
  - The script only reads cluster state. It never scales or patches workloads.
  - If BASE_URL is provided, the checker will also probe its /health endpoint
    to confirm the benchmark can run with --skip-restart / --base-url.
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --namespace)
        NAMESPACE="${2:?Missing value for --namespace}"
        shift 2
        ;;
      --ml-engine-deployment)
        ML_ENGINE_DEPLOYMENT="${2:?Missing value for --ml-engine-deployment}"
        shift 2
        ;;
      --ml-engine-service)
        ML_ENGINE_SERVICE="${2:?Missing value for --ml-engine-service}"
        shift 2
        ;;
      --bff-deployment)
        BFF_DEPLOYMENT="${2:?Missing value for --bff-deployment}"
        shift 2
        ;;
      --bff-service)
        BFF_SERVICE="${2:?Missing value for --bff-service}"
        shift 2
        ;;
      --base-url)
        BASE_URL="${2:?Missing value for --base-url}"
        shift 2
        ;;
      --scale-script)
        SCALE_SCRIPT="${2:?Missing value for --scale-script}"
        shift 2
        ;;
      --cold-warm-script)
        COLD_WARM_SCRIPT="${2:?Missing value for --cold-warm-script}"
        shift 2
        ;;
      --benchmark-script)
        BENCHMARK_SCRIPT="${2:?Missing value for --benchmark-script}"
        shift 2
        ;;
      --curl-timeout)
        CURL_TIMEOUT="${2:?Missing value for --curl-timeout}"
        shift 2
        ;;
      --kubectl-timeout)
        KUBECTL_REQUEST_TIMEOUT="${2:?Missing value for --kubectl-timeout}"
        shift 2
        ;;
      --help)
        usage
        exit 0
        ;;
      *)
        fail "Unknown argument: $1"
        echo
        usage
        exit 1
        ;;
    esac
  done
}

require_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    pass "Required command present: $cmd"
    return 0
  fi

  fail "Required command missing: $cmd"
  return 1
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
    echo "INFO: using k3s kubeconfig at $KUBECONFIG (previous context: ${current_context:-unset})"
  fi
}

check_help_contains_all() {
  local label="$1"
  shift

  local command_parts=()
  local required_tokens=()
  local token=""

  while [[ $# -gt 0 ]]; do
    if [[ "$1" == "--" ]]; then
      shift
      break
    fi
    command_parts+=("$1")
    shift
  done

  required_tokens=("$@")

  local output=""
  if output="$("${command_parts[@]}" --help 2>&1)"; then
    :
  else
    fail "$label help failed to execute"
    return 1
  fi

  for token in "${required_tokens[@]}"; do
    if ! printf '%s' "$output" | grep -Fq -- "$token"; then
      fail "$label help output is missing required option: $token"
      return 1
    fi
  done

  pass "$label help exposes required options"
}

check_reachable_base_url() {
  local url="$1"
  local health_url="${url%/}/health"

  if curl -fsS --max-time "$CURL_TIMEOUT" "$health_url" >/dev/null 2>&1; then
    pass "Low-blast-radius base URL is reachable: $health_url"
  else
    fail "Low-blast-radius base URL is configured but /health is not reachable: $health_url"
  fi
}

check_namespace() {
  if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    pass "Namespace exists: $NAMESPACE"
  else
    fail "Namespace missing or unreachable: $NAMESPACE"
  fi
}

check_context() {
  local current_context
  current_context="$(kubectl config current-context 2>/dev/null || true)"
  if [[ -n "$current_context" ]]; then
    pass "kubectl current context: $current_context"
  else
    fail "kubectl current context is not set"
    return 1
  fi

  local current_namespace
  current_namespace="$(kubectl config view --minify --output jsonpath='{..namespace}' 2>/dev/null || true)"
  if [[ -z "$current_namespace" ]]; then
    current_namespace="default"
  fi

  if [[ "$current_namespace" == "$NAMESPACE" ]]; then
    pass "Current context namespace matches target namespace: $current_namespace"
  else
    warn "Current context namespace is '$current_namespace' while target namespace is '$NAMESPACE'"
  fi
}

check_cluster_reachable() {
  if kubectl version --request-timeout="$KUBECTL_REQUEST_TIMEOUT" >/dev/null 2>&1; then
    pass "Kubernetes API server is reachable"
  else
    fail "Kubernetes API server is not reachable from the current context"
  fi
}

check_deployment_ready() {
  local name="$1"
  local available=""
  local ready=""
  local desired=""

  if ! kubectl -n "$NAMESPACE" get deploy "$name" >/dev/null 2>&1; then
    fail "Deployment missing in namespace '$NAMESPACE': $name"
    return 1
  fi

  available="$(kubectl -n "$NAMESPACE" get deploy "$name" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || true)"
  ready="$(kubectl -n "$NAMESPACE" get deploy "$name" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  desired="$(kubectl -n "$NAMESPACE" get deploy "$name" -o jsonpath='{.spec.replicas}' 2>/dev/null || true)"

  available="${available:-0}"
  ready="${ready:-0}"
  desired="${desired:-0}"

  if [[ "$available" =~ ^[0-9]+$ ]] && [[ "$ready" =~ ^[0-9]+$ ]] && [[ "$desired" =~ ^[0-9]+$ ]]; then
    if (( available >= 1 && ready >= 1 )); then
      pass "Deployment is ready: $name (ready=$ready available=$available desired=$desired)"
    else
      fail "Deployment is not ready: $name (ready=$ready available=$available desired=$desired)"
    fi
  else
    fail "Unable to read readiness for deployment: $name"
  fi
}

check_service_and_endpoints() {
  local name="$1"
  local endpoints=""

  if ! kubectl -n "$NAMESPACE" get svc "$name" >/dev/null 2>&1; then
    fail "Service missing in namespace '$NAMESPACE': $name"
    return 1
  fi

  endpoints="$(kubectl -n "$NAMESPACE" get endpoints "$name" -o jsonpath='{range .subsets[*].addresses[*]}{.ip}{" "}{end}' 2>/dev/null || true)"
  if [[ -n "$endpoints" ]]; then
    pass "Service has endpoints: $name ($endpoints)"
  else
    fail "Service has no ready endpoints: $name"
  fi
}

check_load_tooling() {
  local have_python3="$1"
  local have_k6=0
  local have_locust=0

  if command -v k6 >/dev/null 2>&1; then
    have_k6=1
    pass "k6 is available"
  else
    warn "k6 is not installed"
  fi

  if [[ "$have_python3" -eq 1 ]]; then
    if python3 -c 'import importlib.util, sys; sys.exit(0 if importlib.util.find_spec("locust") else 1)' >/dev/null 2>&1; then
      have_locust=1
      pass "Locust is available via python3 -m locust"
    else
      warn "Locust is not available via python3 -m locust"
    fi
  else
    warn "Locust check skipped because python3 is unavailable"
  fi

  if (( have_k6 == 0 && have_locust == 0 )); then
    fail "Neither k6 nor Locust is available; TODOs 55 and 56 cannot run"
  fi
}

main() {
  local have_kubectl=0
  local have_python3=0

  parse_args "$@"
  prefer_k3s_kubeconfig

  echo "Load Benchmark Preflight"
  echo "Namespace: $NAMESPACE"
  echo "ML Engine: $ML_ENGINE_DEPLOYMENT / $ML_ENGINE_SERVICE"
  echo "BFF:       $BFF_DEPLOYMENT / $BFF_SERVICE"
  echo "Scripts:   $SCALE_SCRIPT"
  echo "           $COLD_WARM_SCRIPT"
  echo "           $BENCHMARK_SCRIPT"
  echo

  require_cmd curl
  require_cmd bash
  require_cmd python3 && have_python3=1 || true
  require_cmd kubectl && have_kubectl=1 || true

  check_load_tooling "$have_python3"

  if [[ "$have_kubectl" -eq 1 ]]; then
    check_context || true
    check_cluster_reachable || true
    check_namespace || true
    check_deployment_ready "$ML_ENGINE_DEPLOYMENT" || true
    check_service_and_endpoints "$ML_ENGINE_SERVICE" || true
    check_deployment_ready "$BFF_DEPLOYMENT" || true
    check_service_and_endpoints "$BFF_SERVICE" || true
  else
    warn "Skipping Kubernetes checks because kubectl is unavailable"
  fi

  if [[ -e "$SCALE_SCRIPT" ]]; then
    check_help_contains_all "scale-load-test.sh" bash "$SCALE_SCRIPT" -- "--scenarios" "--warm-cache" "--namespace" "--deployment" || true
  else
    fail "Missing expected script: $SCALE_SCRIPT"
  fi

  if [[ -e "$COLD_WARM_SCRIPT" ]]; then
    check_help_contains_all "run-cold-warm-cache-load-test.sh" bash "$COLD_WARM_SCRIPT" -- "--scenarios" "--namespace" "--deployment" "--output-dir" || true
  else
    fail "Missing expected script: $COLD_WARM_SCRIPT"
  fi

  if [[ "$have_python3" -eq 1 ]]; then
    if [[ -e "$BENCHMARK_SCRIPT" ]]; then
      check_help_contains_all "benchmark-cold-start.py" python3 "$BENCHMARK_SCRIPT" -- "--skip-restart" "--base-url" "--namespace" "--deployment" || true
    else
      fail "Missing expected script: $BENCHMARK_SCRIPT"
    fi
  else
    warn "Skipping benchmark help checks because python3 is unavailable"
  fi

  if [[ -n "$BASE_URL" ]]; then
    check_reachable_base_url "$BASE_URL"
    if [[ "$have_python3" -eq 1 ]] && [[ -e "$BENCHMARK_SCRIPT" ]]; then
      pass "Low-blast-radius mode is ready: use --skip-restart with --base-url $BASE_URL"
    fi
  else
    warn "Low-blast-radius mode is supported by the benchmark script, but no base URL was supplied"
    warn "Provide BASE_URL (or pass --base-url) together with --skip-restart to avoid restart and port-forwarding"
  fi

  echo
  echo "Summary: $PASS_COUNT PASS, $WARN_COUNT WARN, $FAIL_COUNT FAIL"

  if (( FAIL_COUNT > 0 )); then
    exit 1
  fi
  exit 0
}

main "$@"
