param(
  [string]$Distro = "Ubuntu",
  [switch]$KeepNamespace
)

$ErrorActionPreference = "Stop"

Write-Host "== Longhorn Stage A validation on WSL distro '$Distro' =="

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$repoRootForWsl = ($repoRoot -replace "\\", "/")
$keepArg = if ($KeepNamespace) { "--keep-namespace" } else { "" }
$inlineScript = @"
set -euo pipefail
REPO="`$(wslpath -a '$repoRootForWsl')"
bash "`$REPO/scripts/admin/validate-longhorn-stage-a.sh" $keepArg
"@

& wsl.exe -d $Distro -- bash -lc $inlineScript

if ($LASTEXITCODE -ne 0) {
  throw "Longhorn Stage A validation failed with exit code $LASTEXITCODE"
}
