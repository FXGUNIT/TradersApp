param(
  [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

Write-Host "== Longhorn control-plane reconcile on WSL distro '$Distro' =="

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$repoRootForWsl = ($repoRoot -replace "\\", "/")
$inlineScript = @"
set -euo pipefail
REPO="`$(wslpath -a '$repoRootForWsl')"
bash "`$REPO/scripts/admin/reconcile-longhorn-control-plane.sh"
"@

& wsl.exe -d $Distro -- bash -lc $inlineScript

if ($LASTEXITCODE -ne 0) {
  throw "Longhorn control-plane reconcile failed with exit code $LASTEXITCODE"
}
