#!/usr/bin/env bash
# Longhorn unified dispatcher runs all requested stages in a single WSL
# session so the Windows sandbox boundary is crossed once per end-to-end run.
#
# Usage:
#   bash longhorn-dispatch.sh [stages...]
#
# Stages (run in order given):
#   prereqs    - check-longhorn-prereqs.sh
#   reconcile  - reconcile-longhorn-control-plane.sh
#   validate   - validate-longhorn-stage-a.sh
#   rwx-fix    - apply k3s WSL RWX storage class fix
#   all        - prereqs -> reconcile -> validate (default)
#
# Flags:
#   --keep-namespace   passed through to validate stage
#   --distro NAME      override WSL distro (unused inside WSL itself)
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

keep_namespace_flag=""
stages=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-namespace) keep_namespace_flag="--keep-namespace"; shift ;;
    --distro)         shift; shift ;; # consumed by PS1 wrapper, ignored here
    prereqs|reconcile|validate|rwx-fix|all)
      stages+=("$1"); shift ;;
    *)
      echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ ${#stages[@]} -eq 0 ]]; then
  stages=(all)
fi

expand_all() {
  local expanded=()
  for s in "${stages[@]}"; do
    if [[ "$s" == "all" ]]; then
      expanded+=(prereqs reconcile validate)
    else
      expanded+=("$s")
    fi
  done
  stages=("${expanded[@]}")
}
expand_all

run_stage() {
  local stage="$1"
  echo
  echo "================================================================"
  echo "  STAGE: ${stage}"
  echo "================================================================"

  case "${stage}" in
    prereqs)
      bash "${script_dir}/check-longhorn-prereqs.sh"
      ;;
    reconcile)
      bash "${script_dir}/reconcile-longhorn-control-plane.sh"
      ;;
    validate)
      bash "${script_dir}/validate-longhorn-stage-a.sh" ${keep_namespace_flag}
      ;;
    rwx-fix)
      bash "${script_dir}/apply-k3s-wsl-rwx-fix.sh"
      ;;
    *)
      echo "Unknown stage: ${stage}" >&2
      return 1
      ;;
  esac
}

failed=()
for stage in "${stages[@]}"; do
  if ! run_stage "${stage}"; then
    failed+=("${stage}")
    echo "!! Stage ${stage} FAILED - continuing remaining stages"
  fi
done

echo
echo "================================================================"
if [[ ${#failed[@]} -gt 0 ]]; then
  echo "  DISPATCH COMPLETE - ${#failed[@]} stage(s) failed: ${failed[*]}"
  exit 1
else
  echo "  DISPATCH COMPLETE - all ${#stages[@]} stage(s) passed"
fi
