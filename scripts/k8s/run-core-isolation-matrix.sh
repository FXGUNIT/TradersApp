#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/k8s/run-core-isolation-matrix.sh \
    --kubeconfig /path/to/kubeconfig \
    --namespace tradersapp \
    --image-repo ghcr.io/<owner> \
    --image-tag <sha> \
    [--profiles singles,pairs,triples,full] \
    [--output-dir /path/to/output] \
    [--continue-on-failure] \
    [--dry-run]

Purpose:
  Execute the P09 staged OCI bring-up matrix in the exact validation order:
    singles -> pairings -> triple -> full stack

Default profiles:
  singles = redis, ml-engine, bff, frontend
  pairs   = redis+bff, redis+ml-engine, redis+frontend
  triples = redis+ml-engine+bff
  full    = redis+ml-engine+bff+frontend

Artifacts:
  - summary.tsv / summary.md
  - per-profile logs
  - nested deploy-core-minimal evidence bundles
EOF
}

KUBECONFIG_PATH=""
NAMESPACE="tradersapp"
IMAGE_REPO=""
IMAGE_TAG=""
PROFILE_GROUPS="singles,pairs,triples,full"
OUTPUT_DIR=""
STOP_ON_FAILURE="true"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kubeconfig)
      KUBECONFIG_PATH="${2:-}"
      shift 2
      ;;
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
    --profiles)
      PROFILE_GROUPS="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --continue-on-failure)
      STOP_ON_FAILURE="false"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
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

if [[ "${DRY_RUN}" != "true" ]]; then
  if [[ -z "${KUBECONFIG_PATH}" ]]; then
    echo "::error::--kubeconfig is required unless --dry-run is used" >&2
    usage >&2
    exit 1
  fi

  if [[ ! -f "${KUBECONFIG_PATH}" ]]; then
    echo "::error::Kubeconfig not found: ${KUBECONFIG_PATH}" >&2
    exit 1
  fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_SCRIPT="${SCRIPT_DIR}/deploy-core-minimal.sh"
RUN_TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
if [[ -z "${OUTPUT_DIR}" ]]; then
  OUTPUT_DIR="${REPO_ROOT}/artifacts/k8s/core-isolation-matrix/${RUN_TIMESTAMP}"
fi

LOG_DIR="${OUTPUT_DIR}/logs"
DEPLOY_RUNS_DIR="${OUTPUT_DIR}/deploy-runs"
SUMMARY_TSV="${OUTPUT_DIR}/summary.tsv"
SUMMARY_MD="${OUTPUT_DIR}/summary.md"
MATRIX_METADATA="${OUTPUT_DIR}/matrix-metadata.txt"
PROFILES_TXT="${OUTPUT_DIR}/profiles.txt"

mkdir -p "${LOG_DIR}" "${DEPLOY_RUNS_DIR}"

declare -A PROFILE_GROUP_LOOKUP=()
PROFILE_LABELS=()
PROFILE_SERVICES=()
FIRST_FAILURE_LABEL=""
FIRST_FAILURE_SERVICES=""
FIRST_FAILURE_STAGE=""
FAILURE_COUNT=0

normalize_profile_groups() {
  local cleaned="${PROFILE_GROUPS// /}"
  local raw_groups=()
  local group=""
  IFS=',' read -r -a raw_groups <<< "${cleaned}"

  for group in "${raw_groups[@]}"; do
    [[ -n "${group}" ]] || continue
    case "${group}" in
      all)
        PROFILE_GROUP_LOOKUP["singles"]=1
        PROFILE_GROUP_LOOKUP["pairs"]=1
        PROFILE_GROUP_LOOKUP["triples"]=1
        PROFILE_GROUP_LOOKUP["full"]=1
        ;;
      singles|pairs|triples|full)
        PROFILE_GROUP_LOOKUP["${group}"]=1
        ;;
      *)
        echo "::error::Unsupported profile group in --profiles: ${group}" >&2
        exit 1
        ;;
    esac
  done

  if [[ "${#PROFILE_GROUP_LOOKUP[@]}" -eq 0 ]]; then
    echo "::error::--profiles resolved to an empty profile group set" >&2
    exit 1
  fi
}

group_enabled() {
  [[ -n "${PROFILE_GROUP_LOOKUP["$1"]:-}" ]]
}

add_profile() {
  PROFILE_LABELS+=("$1")
  PROFILE_SERVICES+=("$2")
}

build_profiles() {
  if group_enabled "singles"; then
    add_profile "single-redis" "redis"
    add_profile "single-ml-engine" "ml-engine"
    add_profile "single-bff" "bff"
    add_profile "single-frontend" "frontend"
  fi

  if group_enabled "pairs"; then
    add_profile "pair-redis-bff" "redis,bff"
    add_profile "pair-redis-ml-engine" "redis,ml-engine"
    add_profile "pair-redis-frontend" "redis,frontend"
  fi

  if group_enabled "triples"; then
    add_profile "triple-redis-ml-engine-bff" "redis,ml-engine,bff"
  fi

  if group_enabled "full"; then
    add_profile "full-core" "redis,ml-engine,bff,frontend"
  fi

  if [[ "${#PROFILE_LABELS[@]}" -eq 0 ]]; then
    echo "::error::No matrix profiles were selected" >&2
    exit 1
  fi
}

write_metadata() {
  cat > "${MATRIX_METADATA}" <<EOF
generatedAt=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
namespace=${NAMESPACE}
imageRepo=${IMAGE_REPO}
imageTag=${IMAGE_TAG}
profiles=${PROFILE_GROUPS}
stopOnFailure=${STOP_ON_FAILURE}
dryRun=${DRY_RUN}
outputDir=${OUTPUT_DIR}
EOF

  : > "${PROFILES_TXT}"
  local idx=0
  local label=""
  local services=""
  for label in "${PROFILE_LABELS[@]}"; do
    services="${PROFILE_SERVICES[${idx}]}"
    printf '%02d\t%s\t%s\n' "$((idx + 1))" "${label}" "${services}" >> "${PROFILES_TXT}"
    idx=$((idx + 1))
  done

  printf 'order\tprofile\tservices\tresult\tfailureStage\tevidenceDir\tlogPath\n' > "${SUMMARY_TSV}"
}

run_profile() {
  local order="$1"
  local label="$2"
  local services="$3"
  local log_path="${LOG_DIR}/${label}.log"
  local status="planned"
  local failure_stage="(none)"
  local evidence_dir="(not-run)"
  local rc=0

  echo "=== [${order}] ${label} :: ${services} ==="

  if [[ "${DRY_RUN}" == "true" ]]; then
    {
      echo "DRY RUN"
      echo "Would run deploy-core-minimal with services=${services}"
      echo "Namespace=${NAMESPACE}"
      echo "ImageRepo=${IMAGE_REPO}"
      echo "ImageTag=${IMAGE_TAG}"
    } > "${log_path}"
    status="planned"
    evidence_dir="(dry-run)"
  else
    set +e
    DEPLOY_ARTIFACTS_ROOT="${DEPLOY_RUNS_DIR}" \
    DEPLOY_RUN_LABEL="${label}" \
    bash "${DEPLOY_SCRIPT}" \
      --kubeconfig "${KUBECONFIG_PATH}" \
      --namespace "${NAMESPACE}" \
      --image-repo "${IMAGE_REPO}" \
      --image-tag "${IMAGE_TAG}" \
      --services "${services}" > "${log_path}" 2>&1
    rc=$?
    set -e

    cat "${log_path}"
    evidence_dir="$(sed -n 's/^Deployment evidence directory: //p' "${log_path}" | head -n 1)"
    if [[ -z "${evidence_dir}" ]]; then
      evidence_dir="(missing)"
    fi

    if [[ "${rc}" -eq 0 ]]; then
      status="passed"
    else
      status="failed"
      if [[ -d "${evidence_dir}/stage-captures" ]]; then
        failure_stage="$(find "${evidence_dir}/stage-captures" -mindepth 1 -maxdepth 1 -type d -name '*-failed' | sort | head -n 1 | xargs -r basename)"
        if [[ -z "${failure_stage}" ]]; then
          failure_stage="(missing)"
        fi
      else
        failure_stage="(missing)"
      fi
      FAILURE_COUNT=$((FAILURE_COUNT + 1))
      if [[ -z "${FIRST_FAILURE_LABEL}" ]]; then
        FIRST_FAILURE_LABEL="${label}"
        FIRST_FAILURE_SERVICES="${services}"
        FIRST_FAILURE_STAGE="${failure_stage}"
      fi
    fi
  fi

  printf '%02d\t%s\t%s\t%s\t%s\t%s\t%s\n' "${order}" "${label}" "${services}" "${status}" "${failure_stage}" "${evidence_dir}" "${log_path}" >> "${SUMMARY_TSV}"
  echo "Result: ${status}"
  echo

  if [[ "${status}" == "failed" && "${STOP_ON_FAILURE}" == "true" ]]; then
    return 1
  fi
  return 0
}

render_summary_markdown() {
  {
    echo "# Core Isolation Matrix"
    echo
    echo "Generated: \`$(date -u +"%Y-%m-%dT%H:%M:%SZ")\`"
    echo "Namespace: \`${NAMESPACE}\`"
    echo "Image tag: \`${IMAGE_TAG}\`"
    echo "Profile groups: \`${PROFILE_GROUPS}\`"
    echo "Stop on failure: \`${STOP_ON_FAILURE}\`"
    echo "Dry run: \`${DRY_RUN}\`"
    echo
    echo "| Order | Profile | Services | Result | Failure Stage | Evidence | Log |"
    echo "|---|---|---|---|---|---|---|"

    while IFS=$'\t' read -r order label services result failure_stage evidence_dir log_path; do
      if [[ "${order}" == "order" ]]; then
        continue
      fi
      echo "| ${order} | \`${label}\` | \`${services}\` | ${result} | \`${failure_stage}\` | \`${evidence_dir}\` | \`${log_path}\` |"
    done < "${SUMMARY_TSV}"

    echo
    if [[ -n "${FIRST_FAILURE_LABEL}" ]]; then
      echo "First failing profile: \`${FIRST_FAILURE_LABEL}\` (\`${FIRST_FAILURE_SERVICES}\`)"
      echo "First failing stage: \`${FIRST_FAILURE_STAGE:-unknown}\`"
    elif [[ "${DRY_RUN}" == "true" ]]; then
      echo "Dry run only. No profiles were executed."
    else
      echo "All requested profiles completed without a detected rollout failure."
    fi
  } > "${SUMMARY_MD}"
}

normalize_profile_groups
build_profiles
write_metadata

index=0
for label in "${PROFILE_LABELS[@]}"; do
  services="${PROFILE_SERVICES[${index}]}"
  if ! run_profile "$((index + 1))" "${label}" "${services}"; then
    break
  fi
  index=$((index + 1))
done

render_summary_markdown

echo "Matrix summary: ${SUMMARY_MD}"
if [[ -n "${FIRST_FAILURE_LABEL}" ]]; then
  echo "::error::Isolation matrix stopped on first failure: ${FIRST_FAILURE_LABEL} (${FIRST_FAILURE_SERVICES})" >&2
  exit 1
fi

echo "Isolation matrix complete."
