param(
    [Parameter(Mandatory = $false)]
    [string]$Environment = "production",

    [Parameter(Mandatory = $false)]
    [string]$OutputPath = ".env.cicd",

    [Parameter(Mandatory = $false)]
    [string]$ProjectId = "",

    [Parameter(Mandatory = $false)]
    [string]$InfisicalToken = ""
)

$ErrorActionPreference = "Stop"

if (-not $ProjectId) {
    if (-not (Test-Path -LiteralPath ".infisical.json")) {
        throw ".infisical.json not found. Run from repo root or pass -ProjectId explicitly."
    }

    $config = Get-Content -LiteralPath ".infisical.json" -Raw | ConvertFrom-Json
    if (-not $config.workspaceId) {
        throw "workspaceId missing from .infisical.json"
    }
    $ProjectId = [string]$config.workspaceId
}

$effectiveToken = $InfisicalToken
if (-not $effectiveToken) {
    $effectiveToken = $env:INFISICAL_TOKEN
}

$infisicalCmd = Get-Command infisical -ErrorAction SilentlyContinue
if (-not $infisicalCmd) {
    throw "Infisical CLI not found in PATH."
}

$infisicalPath = $infisicalCmd.Source
if ($infisicalPath -match 'infisical\.(cmd|ps1)$') {
    $candidate = Join-Path (Split-Path -Parent $infisicalPath) 'node_modules\@infisical\cli\bin\infisical.exe'
    if (Test-Path -LiteralPath $candidate) {
        $infisicalPath = $candidate
    }
}

$requiredKeys = @(
    "GITEA_DB_PASSWORD",
    "GITEA_ADMIN_USERNAME",
    "GITEA_ADMIN_PASSWORD",
    "GITEA_DOMAIN",
    "GITEA_ROOT_URL",
    "GITEA_SSH_DOMAIN",
    "WOODPECKER_HOST",
    "WOODPECKER_ADMIN",
    "WOODPECKER_REPO_OWNERS",
    "WOODPECKER_GITEA_CLIENT",
    "WOODPECKER_GITEA_SECRET",
    "WOODPECKER_GRPC_SECRET",
    "WOODPECKER_AGENT_SECRET"
)

$exportArgs = @(
    "export"
    "--env=$Environment"
    "--projectId=$ProjectId"
    "--path=/"
    "--format=dotenv"
    "--secret-overriding=false"
    "--silent"
)

if ($effectiveToken) {
    $exportArgs += "--token=$effectiveToken"
}

$secretOutput = & $infisicalPath @exportArgs
if ($LASTEXITCODE -ne 0) {
    throw "infisical export failed"
}

if ([string]::IsNullOrWhiteSpace(($secretOutput -join "`n"))) {
    throw "infisical export returned no dotenv content"
}

[System.IO.File]::WriteAllText((Join-Path (Get-Location) $OutputPath), ($secretOutput -join "`n") + "`n")

$exported = @{}
Get-Content -LiteralPath $OutputPath | ForEach-Object {
    if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)=(.*)$') {
        $exported[$matches[1]] = $matches[2]
    }
}

$missing = @($requiredKeys | Where-Object { -not $exported.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($exported[$_]) })

if ($missing.Count -gt 0) {
    Write-Host "Rendered $OutputPath from Infisical, but some CI/CD bootstrap keys are still missing:" -ForegroundColor Yellow
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host "Add them to Infisical environment '$Environment' and rerun this script." -ForegroundColor Yellow
    exit 2
}

Write-Host "Rendered $OutputPath from Infisical environment '$Environment'." -ForegroundColor Green
Write-Host "Validated keys: $($requiredKeys.Count)" -ForegroundColor Green
