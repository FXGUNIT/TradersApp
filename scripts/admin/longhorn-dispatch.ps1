param(
  [string]$Distro = "Ubuntu",
  [switch]$KeepNamespace,
  [string[]]$Stages = @("all")
)

# ─────────────────────────────────────────────────────────────────────
# Single-entry Longhorn dispatcher — makes EXACTLY ONE wsl.exe call
# so the sandbox approval prompt fires only once.
#
# Usage:
#   .\longhorn-dispatch.ps1                              # runs prereqs→reconcile→validate
#   .\longhorn-dispatch.ps1 -Stages validate             # single stage
#   .\longhorn-dispatch.ps1 -Stages prereqs,validate     # pick stages
#   .\longhorn-dispatch.ps1 -Stages rwx-fix              # apply RWX storage fix
#   .\longhorn-dispatch.ps1 -KeepNamespace -Stages validate
# ─────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

Write-Host "== Longhorn dispatch on WSL distro '$Distro' =="
Write-Host "   Stages: $($Stages -join ', ')"

# Resolve repo root to WSL path (one wslpath call, unavoidable)
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$repoRootForWsl = ($repoRoot -replace "\\", "/")
$wslRepo = (& wsl.exe -d $Distro -- bash -lc "wslpath -a '$repoRootForWsl'" | Out-String).Trim()

if (-not $wslRepo) {
  throw "Unable to resolve WSL path for $repoRoot"
}

# Build arg list for the bash dispatcher
$bashArgs = @()
foreach ($stage in $Stages) {
  $bashArgs += $stage
}
if ($KeepNamespace) {
  $bashArgs += "--keep-namespace"
}

$wslScript = "$wslRepo/scripts/admin/longhorn-dispatch.sh"
$argString = ($bashArgs -join " ")

# THE SINGLE WSL CALL — everything runs inside this one bash session
& wsl.exe -d $Distro -- bash -lc "bash '$wslScript' $argString"

if ($LASTEXITCODE -ne 0) {
  throw "Longhorn dispatch failed with exit code $LASTEXITCODE"
}
