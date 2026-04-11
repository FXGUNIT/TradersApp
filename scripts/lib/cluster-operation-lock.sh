#!/usr/bin/env bash
# Shared local lock for disruptive cluster operations.
#
# The lock is process-local to this workspace and is intended to prevent
# overlapping chaos/load runs from separate agents or terminals against the
# same kube context + namespace.

cluster_lock_slug() {
  printf '%s' "${1:-unknown}" | tr -cs 'A-Za-z0-9._-' '-'
}

cluster_lock_acquire() {
  local operation="${1:?operation is required}"
  local namespace="${2:?namespace is required}"
  local scope="${3:-exclusive-live-ops}"
  local repo_root="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
  local context="${KUBE_CONTEXT:-$(kubectl config current-context 2>/dev/null || printf 'unknown-context')}"
  local hostname_value
  local owner_file

  hostname_value="$(hostname 2>/dev/null || printf 'unknown-host')"
  CLUSTER_LOCK_ROOT="${CLUSTER_LOCK_ROOT:-$repo_root/.artifacts/cluster-locks}"
  mkdir -p "$CLUSTER_LOCK_ROOT"

  local lock_name
  lock_name="$(cluster_lock_slug "$context")__$(cluster_lock_slug "$namespace")__$(cluster_lock_slug "$scope")"
  CLUSTER_LOCK_DIR="$CLUSTER_LOCK_ROOT/$lock_name"
  owner_file="$CLUSTER_LOCK_DIR/owner.txt"

  if mkdir "$CLUSTER_LOCK_DIR" 2>/dev/null; then
    cat >"$owner_file" <<EOF
operation=$operation
script=${0##*/}
pid=$$
context=$context
namespace=$namespace
scope=$scope
cwd=$(pwd)
host=$hostname_value
started_at=$(date -Iseconds)
EOF
    export CLUSTER_LOCK_ROOT
    export CLUSTER_LOCK_DIR
    return 0
  fi

  printf 'ERROR: another live cluster operation lock is already active for context=%s namespace=%s scope=%s\n' \
    "$context" "$namespace" "$scope" >&2
  if [[ -f "$owner_file" ]]; then
    printf 'ERROR: current lock owner:\n' >&2
    sed 's/^/ERROR:   /' "$owner_file" >&2 || true
  fi
  return 1
}

cluster_lock_release() {
  if [[ -z "${CLUSTER_LOCK_DIR:-}" ]]; then
    return 0
  fi
  if [[ -d "$CLUSTER_LOCK_DIR" ]]; then
    case "$CLUSTER_LOCK_DIR" in
      "$CLUSTER_LOCK_ROOT"/*)
        rm -f -- "$CLUSTER_LOCK_DIR/owner.txt"
        rmdir -- "$CLUSTER_LOCK_DIR" 2>/dev/null || rm -rf -- "$CLUSTER_LOCK_DIR"
        ;;
      *)
        printf 'WARN: refusing to release unexpected lock dir: %s\n' "$CLUSTER_LOCK_DIR" >&2
        ;;
    esac
  fi
}
