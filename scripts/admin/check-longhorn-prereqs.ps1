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

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$repoRootForWsl = ($repoRoot -replace "\\", "/")
$wslRepo = (& wsl.exe -d $Distro -- bash -lc "wslpath -a '$repoRootForWsl'" | Out-String).Trim()

if (-not $wslRepo) {
  throw "Unable to resolve WSL path for $repoRoot"
}

$wslScript = "$wslRepo/scripts/admin/check-longhorn-prereqs.sh"
Invoke-Wsl "bash '$wslScript'"
