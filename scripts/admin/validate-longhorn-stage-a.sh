#!/usr/bin/env bash
set -euo pipefail

namespace="longhorn-stage-a-smoke"
manifest_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
manifest="${manifest_dir}/longhorn-stage-a-smoke.yaml"
keep_namespace=0

if [[ "${1:-}" == "--keep-namespace" ]]; then
  keep_namespace=1
fi

status() {
  local label="$1"
  local result="$2"
  printf '%-28s %s\n' "$label" "$result"
}

fail() {
  local message="$1"
  status "validation" "FAILED"
  echo "$message" >&2
  exit 1
}

kctl() {
  sudo -n k3s kubectl "$@"
}

cleanup() {
  if [[ "${keep_namespace}" -eq 0 ]]; then
    kctl delete namespace "${namespace}" --ignore-not-found=true --wait=true >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

echo "== Longhorn Stage A validation =="
status "namespace" "${namespace}"

longhorn_pods="$(kctl get pods -n longhorn-system --no-headers 2>/dev/null || true)"
if [[ -z "${longhorn_pods}" ]]; then
  fail "No pods found in longhorn-system"
fi

echo
echo "Longhorn pods:"
printf '%s\n' "${longhorn_pods}"

if ! printf '%s\n' "${longhorn_pods}" | awk '
  BEGIN { bad=0 }
  {
    split($2, ready, "/")
    if ($3 != "Running" && $3 != "Completed") {
      bad=1
    }
    if ($3 == "Running" && ready[1] != ready[2]) {
      bad=1
    }
  }
  END { exit bad }
'; then
  fail "Some longhorn-system pods are not fully ready"
fi
status "A01 longhorn pods" "healthy"

echo
echo "Storage classes:"
kctl get storageclass \
  -o custom-columns=NAME:.metadata.name,DEFAULT:.metadata.annotations.storageclass\\.kubernetes\\.io/is-default-class,PROVISIONER:.provisioner,VOLUME_BINDING:.volumeBindingMode \
  --no-headers

if ! kctl get storageclass longhorn --no-headers >/dev/null 2>&1; then
  fail "StorageClass/longhorn is missing"
fi

default_classes="$(kctl get storageclass -o jsonpath='{range .items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")]}{.metadata.name}{"\n"}{end}')"
default_count="$(printf '%s\n' "${default_classes}" | awk 'NF { count++ } END { print count + 0 }')"
if (( default_count > 1 )); then
  fail "Multiple default StorageClasses detected: ${default_classes}"
fi

longhorn_default="$(kctl get storageclass longhorn -o jsonpath='{.metadata.annotations.storageclass\.kubernetes\.io/is-default-class}')"
status "A02 longhorn class" "exists"
status "A02 longhorn default" "${longhorn_default:-false/empty}"

kctl delete namespace "${namespace}" --ignore-not-found=true --wait=true >/dev/null 2>&1 || true
kctl apply -f "${manifest}" >/dev/null

kctl -n "${namespace}" wait --for=jsonpath='{.status.phase}'=Bound pvc/longhorn-rwo-smoke --timeout=240s >/dev/null
status "A03 RWO PVC" "Bound"

kctl -n "${namespace}" wait --for=condition=Ready pod/rwo-smoke --timeout=180s >/dev/null
rwo_value="$(kctl -n "${namespace}" exec rwo-smoke -- sh -lc 'echo longhorn-rwo-ok > /data/probe.txt && cat /data/probe.txt' | tr -d '\r')"
if [[ "${rwo_value}" != "longhorn-rwo-ok" ]]; then
  fail "RWO smoke pod returned unexpected content: ${rwo_value}"
fi
status "A04 RWO pod IO" "${rwo_value}"

kctl -n "${namespace}" wait --for=jsonpath='{.status.phase}'=Bound pvc/longhorn-rwx-smoke --timeout=240s >/dev/null
status "A05 RWX PVC" "Bound"

kctl -n "${namespace}" wait --for=condition=Ready pod/rwx-writer --timeout=180s >/dev/null
kctl -n "${namespace}" wait --for=condition=Ready pod/rwx-reader --timeout=180s >/dev/null
kctl -n "${namespace}" exec rwx-writer -- sh -lc 'echo longhorn-rwx-ok > /data/probe.txt' >/dev/null
rwx_value="$(kctl -n "${namespace}" exec rwx-reader -- cat /data/probe.txt | tr -d '\r')"
if [[ "${rwx_value}" != "longhorn-rwx-ok" ]]; then
  fail "RWX smoke pod returned unexpected content: ${rwx_value}"
fi
status "A06 RWX shared IO" "${rwx_value}"
status "validation" "PASSED"
