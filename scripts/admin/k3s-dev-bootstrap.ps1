#!/usr/bin/env pwsh
# =============================================================================
# k3s-dev-bootstrap.ps1 -- Bootstrap tradersapp-dev namespace and secrets
#
# Stage B tasks: B01-B05
# Creates namespace, populates all K8s secrets, then reports key presence.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\admin\k3s-dev-bootstrap.ps1
#
# Safe to re-run -- all kubectl calls use --dry-run=client | apply -f -
# =============================================================================

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$repoRoot  = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$envFile   = Join-Path $repoRoot '.env.local'
$namespace = 'tradersapp-dev'

Write-Host ""
Write-Host "=== TradersApp k3s Dev Bootstrap ===" -ForegroundColor Cyan
Write-Host "Namespace : $namespace"
Write-Host "Env file  : $envFile"
Write-Host ""

# ---------------------------------------------------------------------------
# Helper: parse .env.local into a hashtable (skips comments + blank lines)
# ---------------------------------------------------------------------------
function Read-EnvFile {
    param([string]$Path)
    $map = @{}
    if (-not (Test-Path $Path)) { return $map }
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -match '^#' -or $line -eq '') { return }
        $eq = $line.IndexOf('=')
        if ($eq -lt 1) { return }
        $key = $line.Substring(0, $eq).Trim()
        $val = $line.Substring($eq + 1).Trim().Trim('"').Trim("'")
        $map[$key] = $val
    }
    return $map
}

# ---------------------------------------------------------------------------
# Helper: get value from hashtable or return default (PS 5.1 -- no ?? operator)
# ---------------------------------------------------------------------------
function Get-EnvOrDefault {
    param([hashtable]$Map, [string]$Key, [string]$Default = '')
    if ($Map.ContainsKey($Key) -and $Map[$Key] -ne '') { return $Map[$Key] }
    return $Default
}

# ---------------------------------------------------------------------------
# Helper: invoke kubectl against the real k3s kubeconfig inside WSL.
# Avoids accidental use of a stale Docker Desktop kube-context.
# ---------------------------------------------------------------------------
function Invoke-K3sKubectl {
    param(
        [Parameter(Mandatory = $true, Position = 0)]
        [string[]]$KubectlArgs,
        [Parameter(ValueFromPipeline = $true)]
        [string]$Stdin
    )

    begin {
        $buffer = [System.Collections.Generic.List[string]]::new()
    }

    process {
        if ($null -ne $Stdin) {
            $buffer.Add($Stdin) | Out-Null
        }
    }

    end {
        if ($buffer.Count -gt 0) {
            $payload = $buffer -join [Environment]::NewLine
            return ($payload | wsl -e sudo -E env KUBECONFIG=/etc/rancher/k3s/k3s.yaml /usr/local/bin/kubectl @KubectlArgs) 2>&1
        }

        return (wsl -e sudo -E env KUBECONFIG=/etc/rancher/k3s/k3s.yaml /usr/local/bin/kubectl @KubectlArgs) 2>&1
    }
}

# ---------------------------------------------------------------------------
# Helper: create a K8s secret (idempotent via dry-run | apply)
# ---------------------------------------------------------------------------
function New-K8sSecret {
    param(
        [string]$Name,
        [string]$Namespace,
        [hashtable]$Literals
    )
    $kubectlArgs = [System.Collections.Generic.List[string]]::new()
    $kubectlArgs.Add('create'); $kubectlArgs.Add('secret'); $kubectlArgs.Add('generic')
    $kubectlArgs.Add($Name); $kubectlArgs.Add("--namespace=$Namespace")
    foreach ($kv in $Literals.GetEnumerator()) {
        $kubectlArgs.Add("--from-literal=$($kv.Key)=$($kv.Value)")
    }
    $kubectlArgs.Add('--dry-run=client'); $kubectlArgs.Add('-o'); $kubectlArgs.Add('yaml')

    $yaml = Invoke-K3sKubectl -KubectlArgs $kubectlArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to generate YAML for secret $Name : $yaml"
        return
    }
    $outStr = ($yaml | Out-String)
    $applied = ($outStr | Invoke-K3sKubectl -KubectlArgs @('apply', '-f', '-')) 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to apply secret ${Name}: $applied"
    } else {
        Write-Host "  [OK] $Name" -ForegroundColor Green
    }
}

# ---------------------------------------------------------------------------
# 0. Load .env.local
# ---------------------------------------------------------------------------
$envVars = Read-EnvFile -Path $envFile
Write-Host "Loaded $($envVars.Count) keys from .env.local"
Write-Host ""

$postgresPassword = Get-EnvOrDefault $envVars 'POSTGRES_PASSWORD' 'dev-postgres-placeholder'
$databaseUrl = Get-EnvOrDefault $envVars 'DATABASE_URL' ''
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    $databaseUrl = "postgresql://tradersapp:$postgresPassword@tradersapp-postgres:5432/tradersapp?sslmode=disable"
}

# ---------------------------------------------------------------------------
# 1. Create namespace
# ---------------------------------------------------------------------------
Write-Host "--- Namespace ---" -ForegroundColor Yellow
$nsYaml = Invoke-K3sKubectl -KubectlArgs @('create', 'namespace', $namespace, '--dry-run=client', '-o', 'yaml')
if ($LASTEXITCODE -ne 0) {
    Write-Warning "namespace dry-run failed: $nsYaml"
} else {
    $nsResult = ($nsYaml | Out-String) | Invoke-K3sKubectl -KubectlArgs @('apply', '-f', '-') 2>&1
    Write-Host "  namespace/$namespace : $nsResult"
}
Write-Host ""

# ---------------------------------------------------------------------------
# 2. ml-engine-secrets
# ---------------------------------------------------------------------------
Write-Host "--- ml-engine-secrets ---" -ForegroundColor Yellow
$mlSecrets = @{
    DATABASE_URL              = $databaseUrl
    REDIS_URL                 = Get-EnvOrDefault $envVars 'REDIS_URL' 'redis://redis:6379'
    REDIS_HOST                = Get-EnvOrDefault $envVars 'REDIS_HOST' 'redis'
    REDIS_PORT                = Get-EnvOrDefault $envVars 'REDIS_PORT' '6379'
    MLFLOW_TRACKING_URI       = Get-EnvOrDefault $envVars 'MLFLOW_TRACKING_URI' 'http://mlflow:5000'
    OPENAI_API_KEY            = Get-EnvOrDefault $envVars 'AI_OPENROUTER_MIND_ALPHA' ''
    ANTHROPIC_API_KEY         = Get-EnvOrDefault $envVars 'AI_OPENROUTER_MIND_BETA' ''
    GROQ_API_KEY              = Get-EnvOrDefault $envVars 'AI_GROQ_TURBO_KEY' ''
    GEMINI_API_KEY            = Get-EnvOrDefault $envVars 'AI_GEMINI_PRO_KEY' ''
    DEEPSEEK_API_KEY          = Get-EnvOrDefault $envVars 'AI_DEEPSEEK_KEY' ''
    KEYCLOAK_CLIENT_ID        = Get-EnvOrDefault $envVars 'KEYCLOAK_CLIENT_ID' 'tradersapp-dev'
    KEYCLOAK_CLIENT_SECRET    = Get-EnvOrDefault $envVars 'KEYCLOAK_CLIENT_SECRET' 'dev-placeholder'
    AWS_ACCESS_KEY_ID         = Get-EnvOrDefault $envVars 'AWS_ACCESS_KEY_ID' ''
    AWS_SECRET_ACCESS_KEY     = Get-EnvOrDefault $envVars 'AWS_SECRET_ACCESS_KEY' ''
    AWS_DEFAULT_REGION        = Get-EnvOrDefault $envVars 'AWS_DEFAULT_REGION' 'us-east-1'
    REQUIRE_DATABASE_URL      = 'true'
}
New-K8sSecret -Name 'ml-engine-secrets' -Namespace $namespace -Literals $mlSecrets

# ---------------------------------------------------------------------------
# 3. tradersapp-secrets
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "--- tradersapp-secrets ---" -ForegroundColor Yellow
$appSecrets = @{
    JWT_SECRET              = Get-EnvOrDefault $envVars 'MASTER_SALT' 'dev-jwt-placeholder-change-in-prod'
    BFF_API_KEY             = Get-EnvOrDefault $envVars 'SUPPORT_SERVICE_KEY' 'dev-bff-api-key-placeholder'
    BFF_ADMIN_PASS_HASH     = Get-EnvOrDefault $envVars 'BFF_ADMIN_PASS_HASH' ''
    MASTER_SALT             = Get-EnvOrDefault $envVars 'MASTER_SALT' ''
    POSTGRES_PASSWORD       = $postgresPassword
    FINNHUB_API_KEY         = Get-EnvOrDefault $envVars 'FINNHUB_API_KEY' ''
    NEWS_API_KEY            = Get-EnvOrDefault $envVars 'NEWS_API_KEY' ''
    TELEGRAM_BOT_TOKEN      = Get-EnvOrDefault $envVars 'TELEGRAM_BOT_TOKEN' ''
    TELEGRAM_ADMIN_CHAT_IDS = Get-EnvOrDefault $envVars 'TELEGRAM_ADMIN_CHAT_IDS' ''
}
New-K8sSecret -Name 'tradersapp-secrets' -Namespace $namespace -Literals $appSecrets

# ---------------------------------------------------------------------------
# 4. mlflow-runtime-secret
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "--- mlflow-runtime-secret ---" -ForegroundColor Yellow
$mlflowSecrets = @{
    POSTGRES_DB          = 'mlflow'
    POSTGRES_USER        = 'mlflow'
    POSTGRES_PASSWORD    = Get-EnvOrDefault $envVars 'POSTGRES_PASSWORD' 'dev-mlflow-postgres-placeholder'
    MINIO_ROOT_USER      = Get-EnvOrDefault $envVars 'MINIO_ROOT_USER' 'minioadmin'
    MINIO_ROOT_PASSWORD  = Get-EnvOrDefault $envVars 'MINIO_ROOT_PASSWORD' 'minioadmin123'
}
New-K8sSecret -Name 'mlflow-runtime-secret' -Namespace $namespace -Literals $mlflowSecrets

# ---------------------------------------------------------------------------
# 5. bff-secrets
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "--- bff-secrets ---" -ForegroundColor Yellow
$bffSecrets = @{
    JWT_SECRET               = Get-EnvOrDefault $envVars 'MASTER_SALT' 'dev-jwt-placeholder'
    BFF_API_KEY              = Get-EnvOrDefault $envVars 'SUPPORT_SERVICE_KEY' 'dev-bff-api-key'
    BFF_ADMIN_PASS_HASH      = Get-EnvOrDefault $envVars 'BFF_ADMIN_PASS_HASH' ''
    MASTER_SALT              = Get-EnvOrDefault $envVars 'MASTER_SALT' ''
    KEYCLOAK_URL             = Get-EnvOrDefault $envVars 'KEYCLOAK_URL' 'http://keycloak:8080'
    KEYCLOAK_REALM           = Get-EnvOrDefault $envVars 'KEYCLOAK_REALM' 'tradersapp'
    KEYCLOAK_CLIENT_ID       = Get-EnvOrDefault $envVars 'KEYCLOAK_CLIENT_ID' 'tradersapp-dev'
    KEYCLOAK_CLIENT_SECRET   = Get-EnvOrDefault $envVars 'KEYCLOAK_CLIENT_SECRET' 'dev-placeholder'
    AI_GEMINI_PRO_KEY        = Get-EnvOrDefault $envVars 'AI_GEMINI_PRO_KEY' ''
    AI_GROQ_TURBO_KEY        = Get-EnvOrDefault $envVars 'AI_GROQ_TURBO_KEY' ''
    AI_DEEPSEEK_KEY          = Get-EnvOrDefault $envVars 'AI_DEEPSEEK_KEY' ''
    AI_CEREBRAS_KEY          = Get-EnvOrDefault $envVars 'AI_CEREBRAS_KEY' ''
    AI_SAMBANOVA_KEY         = Get-EnvOrDefault $envVars 'AI_SAMBANOVA_KEY' ''
    AI_OPENROUTER_MIND_ALPHA = Get-EnvOrDefault $envVars 'AI_OPENROUTER_MIND_ALPHA' ''
    AI_OPENROUTER_MIND_BETA  = Get-EnvOrDefault $envVars 'AI_OPENROUTER_MIND_BETA' ''
    FINNHUB_API_KEY          = Get-EnvOrDefault $envVars 'FINNHUB_API_KEY' ''
    NEWS_API_KEY             = Get-EnvOrDefault $envVars 'NEWS_API_KEY' ''
}
New-K8sSecret -Name 'bff-secrets' -Namespace $namespace -Literals $bffSecrets

# ---------------------------------------------------------------------------
# 6. Verify -- list secrets in namespace
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "--- Verification ---" -ForegroundColor Yellow
$secretList = Invoke-K3sKubectl -KubectlArgs @('get', 'secrets', '-n', $namespace, '--no-headers')
$secretList | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "--- Key presence report ---" -ForegroundColor Yellow

$criticalKeys = @(
    @{ Secret = 'ml-engine-secrets';    Key = 'DATABASE_URL';       Note = 'EMPTY=dev SQLite fallback' },
    @{ Secret = 'ml-engine-secrets';    Key = 'REDIS_URL';          Note = '' },
    @{ Secret = 'ml-engine-secrets';    Key = 'MLFLOW_TRACKING_URI'; Note = '' },
    @{ Secret = 'tradersapp-secrets';   Key = 'JWT_SECRET';         Note = 'from MASTER_SALT' },
    @{ Secret = 'tradersapp-secrets';   Key = 'BFF_API_KEY';        Note = 'from SUPPORT_SERVICE_KEY' },
    @{ Secret = 'mlflow-runtime-secret'; Key = 'POSTGRES_PASSWORD'; Note = '' }
)

foreach ($ck in $criticalKeys) {
    $raw = Invoke-K3sKubectl -KubectlArgs @('get', 'secret', $ck.Secret, '-n', $namespace, '-o', "jsonpath={.data.$($ck.Key)}")
    if ($LASTEXITCODE -eq 0 -and $raw -and $raw -ne '') {
        $decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($raw))
        if ($decoded -eq '') {
            Write-Host "  [WARN] $($ck.Secret)/$($ck.Key) = EMPTY  $($ck.Note)" -ForegroundColor Yellow
        } else {
            Write-Host "  [OK]   $($ck.Secret)/$($ck.Key) = set ($($decoded.Length) chars)  $($ck.Note)" -ForegroundColor Green
        }
    } else {
        Write-Host "  [MISS] $($ck.Secret)/$($ck.Key) = MISSING" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Bootstrap complete." -ForegroundColor Cyan
Write-Host "Next: wsl -e sudo -E env KUBECONFIG=/etc/rancher/k3s/k3s.yaml /usr/local/bin/helm upgrade --install tradersapp /mnt/e/TradersApp/k8s/helm/tradersapp -n tradersapp-dev -f /mnt/e/TradersApp/k8s/helm/tradersapp/values.yaml -f /mnt/e/TradersApp/k8s/helm/tradersapp/values.dev.yaml"
Write-Host ""
