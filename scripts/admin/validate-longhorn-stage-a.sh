#!/usr/bin/env bash
set -euo pipefail

namespace="longhorn-stage-a-smoke"
manifest_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
manifest="${manifest_dir}/longhorn-stage-a-smoke.yaml"
keep_namespace=0
temp_kubeconfig=""
kctl_cmd=()

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
  "${kctl_cmd[@]}" "$@"
}

wait_for_api() {
  local state=""
  local livez=""

  sudo -n systemctl start k3s >/dev/null 2>&1 || true

  for _ in $(seq 1 60); do
    state="$(sudo -n systemctl is-active k3s 2>/dev/null || true)"
    livez="$(curl -ksS -o /dev/null -w '%{http_code}' https://127.0.0.1:6443/livez 2>/dev/null || true)"
    if [[ "${state}" == "active" && ( "${livez}" == "200" || "${livez}" == "401" ) ]]; then
      status "k3s service" "${state}"
      status "API livez" "${livez}"
      return
    fi
    sleep 5
  done

  fail "k3s API did not become ready in time (state=${state:-unknown}, livez=${livez:-none})"
}

setup_kubectl() {
  local windows_kubectl="/mnt/c/Program Files/Docker/Docker/resources/bin/kubectl.exe"
  local win_cfg=""

  if sudo -n /usr/local/bin/k3s kubectl version --client >/dev/null 2>&1; then
    kctl_cmd=(sudo -n /usr/local/bin/k3s kubectl)
    status "kubectl mode" "k3s embedded"
    return
  fi

  if [[ -x "${windows_kubectl}" ]]; then
    temp_kubeconfig="$(mktemp /tmp/k3s-stage-a-kubeconfig-XXXX.yaml)"
    sudo -n cat /etc/rancher/k3s/k3s.yaml > "${temp_kubeconfig}"
    win_cfg="$(wslpath -w "${temp_kubeconfig}")"
    kctl_cmd=("${windows_kubectl}" --kubeconfig "${win_cfg}")
    status "kubectl mode" "Windows kubectl.exe fallback"
    return
  fi

  fail "Unable to find a working kubectl entrypoint for k3s"
}

first_pod_by_prefix() {
  local prefix="$1"
  printf '%s\n' "${longhorn_pods}" | awk -v prefix="${prefix}" '$1 ~ ("^" prefix) { print $1; exit }'
}

first_unhealthy_pod() {
  printf '%s\n' "${longhorn_pods}" | awk '
    {
      split($2, ready, "/")
      if (($3 != "Running" && $3 != "Completed") || ($3 == "Running" && ready[1] != ready[2])) {
        print $1
        exit
      }
    }
  '
}

print_pod_debug() {
  local pod="$1"
  local container="${2:-}"

  if [[ -z "${pod}" ]]; then
    return
  fi

  echo
  echo "Describe ${pod}:"
  kctl -n longhorn-system describe pod "${pod}" | tail -n 60 || true

  if [[ -n "${container}" ]]; then
    echo
    echo "Logs ${pod}/${container}:"
    kctl -n longhorn-system logs "${pod}" -c "${container}" --tail=80 || true
    echo
    echo "Previous logs ${pod}/${container}:"
    kctl -n longhorn-system logs "${pod}" -c "${container}" --tail=80 --previous || true
  else
    echo
    echo "Logs ${pod}:"
    kctl -n longhorn-system logs "${pod}" --tail=80 || true
    echo
    echo "Previous logs ${pod}:"
    kctl -n longhorn-system logs "${pod}" --tail=80 --previous || true
  fi
}

diagnose_longhorn_failure() {
  local manager_pod=""
  local ui_pod=""
  local failing_pod=""

  manager_pod="$(first_pod_by_prefix 'longhorn-manager')"
  ui_pod="$(first_pod_by_prefix 'longhorn-ui')"
  failing_pod="$(first_unhealthy_pod)"

  echo
  echo "Longhorn diagnostics:"
  print_pod_debug "${manager_pod}" "longhorn-manager"
  print_pod_debug "${ui_pod}"
  if [[ -n "${failing_pod}" && "${failing_pod}" != "${manager_pod}" && "${failing_pod}" != "${ui_pod}" ]]; then
    print_pod_debug "${failing_pod}"
  fi
}

cleanup() {
  if [[ -n "${temp_kubeconfig}" ]]; then
    rm -f "${temp_kubeconfig}" >/dev/null 2>&1 || true
  fi
  if [[ "${keep_namespace}" -eq 0 ]]; then
    if (( ${#kctl_cmd[@]} > 0 )); then
      kctl delete namespace "${namespace}" --ignore-not-found=true --wait=true >/dev/null 2>&1 || true
    fi
  fi
}

trap cleanup EXIT

echo "== Longhorn Stage A validation =="
status "namespace" "${namespace}"
wait_for_api
setup_kubectl

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
  diagnose_longhorn_failure
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
