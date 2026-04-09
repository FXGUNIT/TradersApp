#!/usr/bin/env bash
set -euo pipefail

status() {
  local label="$1"
  local result="$2"
  printf '%-28s %s\n' "$label" "$result"
}

if command -v iscsiadm >/dev/null 2>&1; then
  iscsi_path="$(command -v iscsiadm)"
  status "open-iscsi binary" "OK (${iscsi_path})"
else
  status "open-iscsi binary" "MISSING"
fi

if command -v mount.nfs4 >/dev/null 2>&1; then
  nfs4_path="$(command -v mount.nfs4)"
  status "NFSv4 client binary" "OK (${nfs4_path})"
else
  status "NFSv4 client binary" "MISSING"
fi

if systemctl list-unit-files iscsid.service >/dev/null 2>&1; then
  status "iscsid service" "$(systemctl is-active iscsid 2>/dev/null || true)"
else
  status "iscsid service" "MISSING"
fi

status "hostname" "$(hostname)"
status "node count" "$(sudo -n k3s kubectl get nodes --no-headers 2>/dev/null | wc -l || echo 0)"

if sudo -n k3s kubectl get storageclass longhorn --no-headers >/dev/null 2>&1; then
  status "longhorn storageclass" "longhorn"
else
  status "longhorn storageclass" "MISSING"
fi
