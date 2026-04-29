param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $OpenCodeArgs
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

function Import-DotEnvFile {
  param([Parameter(Mandatory = $true)] [string] $Path)

  if (-not (Test-Path $Path)) {
    return $false
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      continue
    }

    $name = $Matches[1]
    $value = $Matches[2].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }

  return $true
}

function Import-InfisicalEnv {
  param([Parameter(Mandatory = $true)] [string] $ProjectRoot)

  if (-not (Test-Path (Join-Path $ProjectRoot ".infisical.json"))) {
    return $false
  }

  $infisical = Get-Command infisical.cmd -ErrorAction SilentlyContinue
  if (-not $infisical) {
    $infisical = Get-Command infisical -ErrorAction SilentlyContinue
  }
  if (-not $infisical) {
    return $false
  }

  try {
    $json = & $infisical.Source export --format=json --silent
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($json)) {
      return $false
    }

    $secrets = $json | ConvertFrom-Json
    foreach ($secret in $secrets) {
      if ($secret.key -and $null -ne $secret.value) {
        [Environment]::SetEnvironmentVariable([string] $secret.key, [string] $secret.value, "Process")
      }
    }
    return $true
  } catch {
    return $false
  }
}

if (-not $OpenCodeArgs -or $OpenCodeArgs.Count -eq 0) {
  $OpenCodeArgs = @(".")
}

$opencode = Get-Command opencode -ErrorAction SilentlyContinue
if ($opencode) {
  $runner = @("opencode")
} else {
  $npx = Get-Command npx -ErrorAction SilentlyContinue
  if (-not $npx) {
    throw "OpenCode CLI is not available and npx was not found. Run npm install first."
  }
  $runner = @("npx", "opencode")
}

$loadedSecrets = Import-InfisicalEnv -ProjectRoot $repoRoot
if (-not $loadedSecrets) {
  Import-DotEnvFile -Path (Join-Path $repoRoot ".env.local") | Out-Null
}

$command = $runner[0]
$args = @()
if ($runner.Count -gt 1) {
  $args += $runner[1..($runner.Count - 1)]
}
$args += $OpenCodeArgs

& $command @args

exit $LASTEXITCODE
