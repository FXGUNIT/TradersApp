param(
  [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

function Invoke-Wsl {
  param([string]$Command)

  & wsl.exe -d $Distro -- bash -lc $Command
  if ($LASTEXITCODE -ne 0) {
    throw "WSL command failed: $Command"
  }
}

Write-Host "== Longhorn prerequisite check on WSL distro '$Distro' =="

Invoke-Wsl @'
set -euo pipefail

status() {
  local label="$1"
  local result="$2"
  printf '%-28s %s\n' "$label" "$result"
}

if command -v iscsiadm >/dev/null 2>&1; then
  status "open-iscsi binary" "OK ($(command -v iscsiadm))"
else
  status "open-iscsi binary" "MISSING"
fi

if command -v mount.nfs4 >/dev/null 2>&1; then
  status "NFSv4 client binary" "OK ($(command -v mount.nfs4))"
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
status "longhorn storageclass" "$(sudo -n k3s kubectl get storageclass longhorn --no-headers 2>/dev/null | awk '{print $1}' || echo MISSING)"
'@
