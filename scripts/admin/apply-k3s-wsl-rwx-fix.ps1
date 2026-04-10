param(
  [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$repoRootForWsl = ($repoRoot -replace "\\", "/")
$inlineScript = @"
set -euo pipefail
REPO="`$(wslpath -a '$repoRootForWsl')"
bash "`$REPO/scripts/admin/apply-k3s-wsl-rwx-fix.sh"
"@

& wsl.exe -d $Distro -- bash -lc $inlineScript

if ($LASTEXITCODE -ne 0) {
  throw "k3s WSL RWX fix failed with exit code $LASTEXITCODE"
}

Write-Host "k3s startup guard and shared-rwx storage class are active."
