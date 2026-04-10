param(
  [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

Write-Host "== Longhorn prerequisite check on WSL distro '$Distro' =="

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$repoRootForWsl = ($repoRoot -replace "\\", "/")
$inlineScript = @"
set -euo pipefail
REPO="`$(wslpath -a '$repoRootForWsl')"
bash "`$REPO/scripts/admin/check-longhorn-prereqs.sh"
"@

& wsl.exe -d $Distro -- bash -lc $inlineScript

if ($LASTEXITCODE -ne 0) {
  throw "Longhorn prerequisite check failed with exit code $LASTEXITCODE"
}
