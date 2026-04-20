#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/k8s/render-core-minimal-manifests.sh \
    --namespace tradersapp \
    --image-repo ghcr.io/<owner> \
    --image-tag <sha> \
    [--output-dir /path/to/output] \
    [--kubeconfig /path/to/kubeconfig] \
    [--services redis,ml-engine,bff,frontend] \
    [--validate-client]

Purpose:
  Render the minimal TradersApp Helm chart once, then split the output into
  deterministic per-service apply slices:
    01-redis.yaml
    02-ml-engine.yaml
    03-bff.yaml
    04-frontend.yaml

  The script also writes:
    tradersapp-deployments.yaml   # full rendered manifest
    00-apply-order.txt            # staged apply order
EOF
}

NAMESPACE="tradersapp"
IMAGE_REPO=""
IMAGE_TAG=""
KUBECONFIG_PATH=""
VALIDATE_CLIENT="false"
SELECTED_SERVICES_ARG=""
SELECTED_SERVICES=()
PYTHON_BIN=""
NODE_RAM_MIB="${NODE_RAM_MIB:-1024}"
NODE_SWAP_MIB="${NODE_SWAP_MIB:-2048}"
NODE_OS_RESERVE_MIB="${NODE_OS_RESERVE_MIB:-160}"
NODE_CONTROL_PLANE_RESERVE_MIB="${NODE_CONTROL_PLANE_RESERVE_MIB:-190}"
MIN_MEM_AVAILABLE_MIB="${MIN_NODE_MEM_AVAILABLE_MIB:-350}"
MIN_SWAP_FREE_MIB="${MIN_NODE_SWAP_FREE_MIB:-768}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VALUES_FILE="${REPO_ROOT}/k8s/helm/tradersapp/values.minimal.yaml"
OUTPUT_DIR="${REPO_ROOT}/artifacts/k8s/core-minimal"
TEMP_SPLIT_DIR=""
BUDGET_SCRIPT="${SCRIPT_DIR}/generate-core-memory-budget.py"
CORE_SERVICES=(redis ml-engine bff frontend)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace)
      NAMESPACE="${2:-}"
      shift 2
      ;;
    --image-repo)
      IMAGE_REPO="${2:-}"
      shift 2
      ;;
    --image-tag)
      IMAGE_TAG="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --kubeconfig)
      KUBECONFIG_PATH="${2:-}"
      shift 2
      ;;
    --services)
      SELECTED_SERVICES_ARG="${2:-}"
      shift 2
      ;;
    --validate-client)
      VALIDATE_CLIENT="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${IMAGE_REPO}" || -z "${IMAGE_TAG}" ]]; then
  echo "::error::--image-repo and --image-tag are required" >&2
  usage >&2
  exit 1
fi

normalize_selected_services() {
  local service=""

  if [[ -z "${SELECTED_SERVICES_ARG}" ]]; then
    SELECTED_SERVICES=("${CORE_SERVICES[@]}")
    return 0
  fi

  local cleaned="${SELECTED_SERVICES_ARG// /}"
  declare -A requested_lookup=()
  local raw_services=()
  IFS=',' read -r -a raw_services <<< "${cleaned}"

  for service in "${raw_services[@]}"; do
    [[ -n "${service}" ]] || continue
    case "${service}" in
      redis|ml-engine|bff|frontend)
        requested_lookup["${service}"]=1
        ;;
      *)
        echo "::error::Unsupported service in --services: ${service}" >&2
        exit 1
        ;;
    esac
  done

  for service in "${CORE_SERVICES[@]}"; do
    if [[ -n "${requested_lookup["${service}"]:-}" ]]; then
      SELECTED_SERVICES+=("${service}")
    fi
  done

  if [[ "${#SELECTED_SERVICES[@]}" -eq 0 ]]; then
    echo "::error::--services resolved to an empty service set" >&2
    exit 1
  fi
}

mkdir -p "${OUTPUT_DIR}"
TEMP_SPLIT_DIR="$(mktemp -d)"
normalize_selected_services

cleanup() {
  rm -rf "${TEMP_SPLIT_DIR}"
}
trap cleanup EXIT

FULL_MANIFEST_PATH="${OUTPUT_DIR}/tradersapp-deployments.yaml"
APPLY_ORDER_PATH="${OUTPUT_DIR}/00-apply-order.txt"
SELECTED_SERVICES_PATH="${OUTPUT_DIR}/00-selected-services.txt"
REDIS_MANIFEST_PATH="${OUTPUT_DIR}/01-redis.yaml"
ML_ENGINE_MANIFEST_PATH="${OUTPUT_DIR}/02-ml-engine.yaml"
BFF_MANIFEST_PATH="${OUTPUT_DIR}/03-bff.yaml"
FRONTEND_MANIFEST_PATH="${OUTPUT_DIR}/04-frontend.yaml"

service_manifest_filename() {
  case "$1" in
    redis)
      printf '01-redis.yaml\n'
      ;;
    ml-engine)
      printf '02-ml-engine.yaml\n'
      ;;
    bff)
      printf '03-bff.yaml\n'
      ;;
    frontend)
      printf '04-frontend.yaml\n'
      ;;
    *)
      echo "::error::Unknown service for manifest filename: $1" >&2
      exit 1
      ;;
  esac
}

service_manifest_path() {
  case "$1" in
    redis)
      printf '%s\n' "${REDIS_MANIFEST_PATH}"
      ;;
    ml-engine)
      printf '%s\n' "${ML_ENGINE_MANIFEST_PATH}"
      ;;
    bff)
      printf '%s\n' "${BFF_MANIFEST_PATH}"
      ;;
    frontend)
      printf '%s\n' "${FRONTEND_MANIFEST_PATH}"
      ;;
    *)
      echo "::error::Unknown service for manifest path: $1" >&2
      exit 1
      ;;
  esac
}

write_apply_order() {
  : > "${APPLY_ORDER_PATH}"
  local service=""
  for service in "${SELECTED_SERVICES[@]}"; do
    service_manifest_filename "${service}" >> "${APPLY_ORDER_PATH}"
  done
}

write_selected_services() {
  : > "${SELECTED_SERVICES_PATH}"
  local service=""
  for service in "${SELECTED_SERVICES[@]}"; do
    printf '%s\n' "${service}" >> "${SELECTED_SERVICES_PATH}"
  done
}

render_full_manifest() {
  helm template tradersapp "${REPO_ROOT}/k8s/helm/tradersapp" \
    --namespace "${NAMESPACE}" \
    -f "${VALUES_FILE}" \
    --set "bff.image.repository=${IMAGE_REPO}/bff" \
    --set "bff.image.tag=${IMAGE_TAG}" \
    --set "frontend.image.repository=${IMAGE_REPO}/frontend" \
    --set "frontend.image.tag=${IMAGE_TAG}" \
    --set "mlEngine.image.repository=${IMAGE_REPO}/ml-engine" \
    --set "mlEngine.image.tag=${IMAGE_TAG}" > "${FULL_MANIFEST_PATH}"
}

split_into_documents() {
  awk -v outdir="${TEMP_SPLIT_DIR}" '
    function next_file() {
      doc += 1
      current = sprintf("%s/doc-%03d.yaml", outdir, doc)
    }
    BEGIN {
      doc = 0
      current = ""
    }
    /^---[[:space:]]*$/ {
      current = ""
      next
    }
    {
      if ($0 ~ /^[[:space:]]*$/ && current == "") {
        next
      }
      if (current == "") {
        next_file()
      }
      print >> current
    }
  ' "${FULL_MANIFEST_PATH}"
}

append_document() {
  local source_path="$1"
  local target_path="$2"

  if [[ -s "${target_path}" ]]; then
    printf '\n---\n' >> "${target_path}"
  fi
  cat "${source_path}" >> "${target_path}"
}

classify_documents() {
  : > "${REDIS_MANIFEST_PATH}"
  : > "${ML_ENGINE_MANIFEST_PATH}"
  : > "${BFF_MANIFEST_PATH}"
  : > "${FRONTEND_MANIFEST_PATH}"

  local doc_path
  local resource_name
  for doc_path in "${TEMP_SPLIT_DIR}"/doc-*.yaml; do
    [[ -s "${doc_path}" ]] || continue
    resource_name="$(sed -n 's/^  name: //p' "${doc_path}" | head -n 1 | tr -d '\r')"
    if [[ -z "${resource_name}" ]]; then
      continue
    fi

    case "${resource_name}" in
      redis)
        append_document "${doc_path}" "${REDIS_MANIFEST_PATH}"
        ;;
      ml-engine|ml-engine-config|ml-engine-env)
        append_document "${doc_path}" "${ML_ENGINE_MANIFEST_PATH}"
        ;;
      bff|bff-config)
        append_document "${doc_path}" "${BFF_MANIFEST_PATH}"
        ;;
      frontend)
        append_document "${doc_path}" "${FRONTEND_MANIFEST_PATH}"
        ;;
      *)
        echo "::error::Unable to classify rendered resource '${resource_name}' from ${doc_path}" >&2
        exit 1
        ;;
    esac
  done
}

assert_expected_outputs() {
  local path
  for path in \
    "${FULL_MANIFEST_PATH}" \
    "${REDIS_MANIFEST_PATH}" \
    "${ML_ENGINE_MANIFEST_PATH}" \
    "${BFF_MANIFEST_PATH}" \
    "${FRONTEND_MANIFEST_PATH}"; do
    if [[ ! -s "${path}" ]]; then
      echo "::error::Expected manifest output is missing or empty: ${path}" >&2
      exit 1
    fi
  done
}

validate_client_manifests() {
  if [[ "${VALIDATE_CLIENT}" != "true" ]]; then
    return 0
  fi

  if ! command -v kubectl >/dev/null 2>&1; then
    echo "::error::kubectl is required for --validate-client" >&2
    exit 1
  fi

  local manifest_path
  local kubectl_base=(kubectl)
  local service
  if [[ -n "${KUBECONFIG_PATH}" ]]; then
    kubectl_base+=(--kubeconfig "${KUBECONFIG_PATH}")
  fi

  for service in "${SELECTED_SERVICES[@]}"; do
    manifest_path="$(service_manifest_path "${service}")"
    echo "Client dry-run validating $(basename "${manifest_path}")"
    "${kubectl_base[@]}" apply --dry-run=client --validate=false -f "${manifest_path}" >/dev/null
  done
}

generate_budget_report() {
  if [[ ! -f "${BUDGET_SCRIPT}" ]]; then
    echo "::error::Budget generator script is missing: ${BUDGET_SCRIPT}" >&2
    exit 1
  fi

  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python)"
  else
    echo "::error::python3 or python is required to generate the core budget report" >&2
    exit 1
  fi

  "${PYTHON_BIN}" "${BUDGET_SCRIPT}" \
    --manifest-dir "${OUTPUT_DIR}" \
    --node-ram-mib "${NODE_RAM_MIB}" \
    --node-swap-mib "${NODE_SWAP_MIB}" \
    --os-reserve-mib "${NODE_OS_RESERVE_MIB}" \
    --control-plane-reserve-mib "${NODE_CONTROL_PLANE_RESERVE_MIB}" \
    --min-mem-available-mib "${MIN_MEM_AVAILABLE_MIB}" \
    --min-swap-free-mib "${MIN_SWAP_FREE_MIB}"
}

write_apply_order
write_selected_services
render_full_manifest
split_into_documents
classify_documents
assert_expected_outputs
validate_client_manifests
generate_budget_report

echo "Rendered full manifest: ${FULL_MANIFEST_PATH}"
echo "Staged apply order file: ${APPLY_ORDER_PATH}"
echo "Selected service list: ${SELECTED_SERVICES_PATH}"
echo "Split manifests:"
echo "  ${REDIS_MANIFEST_PATH}"
echo "  ${ML_ENGINE_MANIFEST_PATH}"
echo "  ${BFF_MANIFEST_PATH}"
echo "  ${FRONTEND_MANIFEST_PATH}"
