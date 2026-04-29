param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $OpenCodeArgs
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

if (-not $OpenCodeArgs -or $OpenCodeArgs.Count -eq 0) {
  $OpenCodeArgs = @(".")
}

$opencode = Get-Command opencode -ErrorAction SilentlyContinue
if ($opencode) {
  $runner = @($opencode.Source)
} else {
  $npx = Get-Command npx -ErrorAction SilentlyContinue
  if (-not $npx) {
    throw "OpenCode CLI is not available and npx was not found. Run npm install first."
  }
  $runner = @($npx.Source, "opencode")
}

$infisical = Get-Command infisical -ErrorAction SilentlyContinue
$hasInfisicalProject = Test-Path (Join-Path $repoRoot ".infisical.json")

if ($infisical -and $hasInfisicalProject) {
  & $infisical.Source run -- @runner @OpenCodeArgs
} else {
  $command = $runner[0]
  $args = @()
  if ($runner.Count -gt 1) {
    $args += $runner[1..($runner.Count - 1)]
  }
  $args += $OpenCodeArgs
  & $command @args
}

exit $LASTEXITCODE
