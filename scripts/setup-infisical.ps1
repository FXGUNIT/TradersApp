# ═══════════════════════════════════════════════════════════════════════════════
# TradersApp — Infisical Secrets Setup
# ═══════════════════════════════════════════════════════════════════════════════
# Run this ONCE to set up Infisical workspace structure, then every time
# you add new secrets. It will:
#   1. Create/structure secrets in Infisical (production / staging / development)
#   2. Set GitHub Action secrets (Infisical token + critical keys for CI)
#   3. Document the secret schema
#
# Prerequisites:
#   - Infisical account at app.infisical.com
#   - Workspace: TradersApp (already initialized — .infisical.json exists)
#   - GitHub CLI authenticated: gh auth login
#
# Usage:
#   .\scripts\setup-infisical.ps1 -InfisicalToken "is.*" -InfisicalWorkspaceId "0e4f9b8b-846e-4e66-a4aa-97c8fa9863ab"
#   OR run interactively: .\scripts\setup-infisical.ps1

param(
    [Parameter(Mandatory=$false)]
    [string]$InfisicalToken = "",

    [Parameter(Mandatory=$false)]
    [string]$InfisicalWorkspaceId = "0e4f9b8b-846e-4e66-a4aa-97c8fa9863ab"
)

$ErrorActionPreference = "Stop"
$Repo = "gunitsingh1994/TradersApp"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "TradersApp — Infisical Secrets Setup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check/Install Infisical CLI ─────────────────────────────────────
Write-Host "[1/7] Checking Infisical CLI..." -ForegroundColor Yellow
$infisicalCmd = Get-Command infisical -ErrorAction SilentlyContinue
if (-not $infisicalCmd) {
    Write-Host "Installing Infisical CLI..." -ForegroundColor White
    # Windows: download from GitHub releases
    $version = "0.24.4"
    $zipUrl = "https://github.com/Infisical/infisical/releases/download/v$version/infisical-windows-amd64.zip"
    $zipPath = "$env:TEMP\infisical.zip"
    $extractPath = "$env:LOCALAPPDATA\infisical"
    try {
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
        Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
        $infisicalExe = "$extractPath\infisical.exe"
        # Add to PATH for this session
        $env:PATH = "$extractPath;$env:PATH"
        Write-Host "Installed Infisical CLI to $infisicalExe" -ForegroundColor Green
    } catch {
        Write-Host "Failed to auto-install. Please install manually:" -ForegroundColor Red
        Write-Host "  npm install -g @infisical/cli" -ForegroundColor White
        Write-Host "  OR download from: https://github.com/Infisical/infisical/releases" -ForegroundColor White
    }
} else {
    Write-Host "Infisical CLI found: $($infisicalCmd.Source)" -ForegroundColor Green
}

# ── Step 2: Authenticate ─────────────────────────────────────────────────────
if (-not $InfisicalToken) {
    Write-Host ""
    Write-Host "Enter your Infisical Token (starts with 'is.'):" -ForegroundColor Yellow
    $InfisicalToken = Read-Host "Infisical Token"
}
if (-not $InfisicalToken.StartsWith("is.")) {
    Write-Host "ERROR: Token must start with 'is.' — get it from app.infisical.com → Settings → Access Tokens" -ForegroundColor Red
    exit 1
}

Write-Host "[2/7] Authenticating with Infisical..." -ForegroundColor Yellow
$env:INFISICAL_TOKEN = $InfisicalToken
$authResult = infisical auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Authentication failed. Please check your token." -ForegroundColor Red
    exit 1
}
Write-Host "Authenticated with Infisical" -ForegroundColor Green

# ── Step 3: Read current .env.local secrets ─────────────────────────────────
Write-Host "[3/7] Reading secrets from .env.local..." -ForegroundColor Yellow
$envPath = ".env.local"
if (-not (Test-Path $envPath)) {
    Write-Host "ERROR: .env.local not found in current directory" -ForegroundColor Red
    exit 1
}

$secrets = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$') {
        $key = $matches[1]
        $value = $matches[2].Trim()
        if ($value.Length -gt 0) {
            $secrets[$key] = $value
        }
    }
}
Write-Host "Found $($secrets.Count) secrets in .env.local" -ForegroundColor Green

# ── Step 4: Categorize secrets by environment ────────────────────────────────
Write-Host "[4/7] Categorizing secrets for Infisical environments..." -ForegroundColor Yellow

# ── FRONTEND (VITE_* — public but must be secret-free in repo) ──────────────
$frontendSecrets = @{}
foreach ($key in @(
    'VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET','VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID','VITE_FIREBASE_DATABASE_URL',
<<<<<<< HEAD
    'VITE_BFF_URL',
=======
    'VITE_BFF_URL','VITE_TELEGRAM_BOT_TOKEN','VITE_TELEGRAM_CHAT_ID',
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
    'VITE_TELEGRAM_BOT_USERNAME',
    'VITE_FEATURE_FLOATING_SUPPORT_CHAT','VITE_FEATURE_COLLECTIVE_CONSCIOUSNESS',
    'VITE_FEATURE_MAIN_TERMINAL','VITE_FEATURE_CLEAN_ONBOARDING'
)) {
    if ($secrets.ContainsKey($key)) { $frontendSecrets[$key] = $secrets[$key] }
}

# ── BFF SERVER (server-only, not exposed to browser) ────────────────────────
$bffSecrets = @{}
foreach ($key in @(
    'BFF_ADMIN_PASS_HASH','MASTER_SALT','BFF_HOST','BFF_PORT',
<<<<<<< HEAD
    'BFF_ALLOWED_ORIGINS','BFF_TELEGRAM_BOT_TOKEN','BFF_TELEGRAM_CHAT_ID','ML_ENGINE_URL',
=======
    'BFF_ALLOWED_ORIGINS','ML_ENGINE_URL',
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
    'AI_GEMINI_PRO_KEY','AI_GROQ_TURBO_KEY','AI_OPENROUTER_MIND_ALPHA',
    'AI_OPENROUTER_MIND_BETA','AI_CEREBRAS_KEY','AI_DEEPSEEK_KEY','AI_SAMBANOVA_KEY',
    'FINNHUB_API_KEY','NEWS_API_KEY',
    'TELEGRAM_BRIDGE_PORT','SUPPORT_SERVICE_KEY','TELEGRAM_BOT_MODE',
    'TELEGRAM_ADMIN_CHAT_IDS'
)) {
    if ($secrets.ContainsKey($key)) { $bffSecrets[$key] = $secrets[$key] }
}

# ── ML ENGINE (Python, never reaches frontend) ────────────────────────────────
$mlSecrets = @{}
foreach ($key in @(
    'DATABASE_URL','ML_ENGINE_API_KEY','PYTHONUNBUFFERED'
)) {
    if ($secrets.ContainsKey($key)) { $mlSecrets[$key] = $secrets[$key] }
}

# ── TELEGRAM BRIDGE (separate service) ─────────────────────────────────────
$telegramSecrets = @{}
foreach ($key in @(
    'TELEGRAM_BOT_TOKEN','TELEGRAM_ADMIN_CHAT_IDS','TELEGRAM_ADMIN_API_KEY',
    'TELEGRAM_BRIDGE_PORT','TELEGRAM_WEBHOOK_URL','TELEGRAM_WEBHOOK_KEY'
)) {
    if ($secrets.ContainsKey($key)) { $telegramSecrets[$key] = $secrets[$key] }
}

Write-Host "  Frontend (VITE_*): $($frontendSecrets.Count) secrets" -ForegroundColor White
Write-Host "  BFF Server:       $($bffSecrets.Count) secrets" -ForegroundColor White
Write-Host "  ML Engine:        $($mlSecrets.Count) secrets" -ForegroundColor White
Write-Host "  Telegram Bridge:  $($telegramSecrets.Count) secrets" -ForegroundColor White

# ── Step 5: Push to Infisical ────────────────────────────────────────────────
Write-Host "[5/7] Pushing secrets to Infisical..." -ForegroundColor Yellow

function Set-InfisicalSecret {
    param($env, $key, $value)
    try {
        infisical secrets set "$key"="$value" --env=$env --projectId=$InfisicalWorkspaceId 2>&1 | Out-Null
        Write-Host "  ✓ $key ($env)" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Failed: $key — $_" -ForegroundColor Red
    }
}

$environments = @('production', 'staging', 'development')
$secretMap = @{
    'production' = $frontendSecrets + $bffSecrets + $mlSecrets + $telegramSecrets
    'staging'    = @{}  # Staging inherits from production unless overridden
    'development'= @{}  # Dev-specific (local overrides)
}

foreach ($env in $environments) {
    Write-Host ""
    Write-Host "  Syncing $env environment..." -ForegroundColor Cyan
    $envSecrets = $secretMap[$env]
    if ($env -eq 'staging') {
        # Staging overrides: different URLs
        $envSecrets = @{
<<<<<<< HEAD
            'VITE_BFF_URL' = 'https://bff.173.249.18.14.sslip.io'
            'ML_ENGINE_URL' = 'https://api.173.249.18.14.sslip.io'
=======
            'VITE_BFF_URL' = 'https://staging-bff.traders.app'
            'ML_ENGINE_URL' = 'https://staging-api.traders.app'
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
        }
    }
    foreach ($entry in $envSecrets.GetEnumerator()) {
        Set-InfisicalSecret -env $env -key $entry.Key -value $entry.Value
    }
}

# ── Step 6: Set GitHub Actions Secrets ───────────────────────────────────────
Write-Host ""
Write-Host "[6/7] Setting GitHub Actions Secrets from Infisical..." -ForegroundColor Yellow

# These are the secrets the CI pipeline needs (Infisical token + AI keys)
$ghSecrets = @{
    'INFISICAL_TOKEN' = $InfisicalToken
    'AI_GEMINI_PRO_KEY' = $secrets['AI_GEMINI_PRO_KEY']
    'AI_GROQ_TURBO_KEY' = $secrets['AI_GROQ_TURBO_KEY']
    'AI_OPENROUTER_MIND_ALPHA' = $secrets['AI_OPENROUTER_MIND_ALPHA']
    'AI_OPENROUTER_MIND_BETA' = $secrets['AI_OPENROUTER_MIND_BETA']
    'AI_CEREBRAS_KEY' = $secrets['AI_CEREBRAS_KEY']
    'AI_DEEPSEEK_KEY' = $secrets['AI_DEEPSEEK_KEY']
    'AI_SAMBANOVA_KEY' = $secrets['AI_SAMBANOVA_KEY']
    'FINNHUB_API_KEY' = $secrets['FINNHUB_API_KEY']
    'NEWS_API_KEY' = $secrets['NEWS_API_KEY']
    'BFF_ADMIN_PASS_HASH' = $secrets['BFF_ADMIN_PASS_HASH']
    'MASTER_SALT' = $secrets['MASTER_SALT']
}

foreach ($entry in $ghSecrets.GetEnumerator()) {
    if ($entry.Value) {
        gh secret set $entry.Key --body $entry.Value --repo $Repo 2>&1 | Out-Null
        Write-Host "  ✓ GitHub Secret: $($entry.Key)" -ForegroundColor Green
    }
}

# ── Step 7: Verify setup ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "[7/7] Verifying Infisical workspace..." -ForegroundColor Yellow
Write-Host "  Workspace: $InfisicalWorkspaceId" -ForegroundColor White
Write-Host "  Environments: production, staging, development" -ForegroundColor White
Write-Host ""
Write-Host "  Check your workspace at:" -ForegroundColor Cyan
Write-Host "  https://app.infisical.com/organizations/0e4f9b8b-846e-4e66-a4aa-97c8fa9863ab" -ForegroundColor White
Write-Host ""

# ── Enable GitHub App integration in Infisical ───────────────────────────────
Write-Host "==================================================" -ForegroundColor Green
Write-Host "SETUP COMPLETE!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor White
Write-Host "  1. In Infisical dashboard: Settings → Integrations → GitHub" -ForegroundColor White
Write-Host "     Connect the TradersApp repo and enable 'Auto-inject into GitHub Actions'" -ForegroundColor White
Write-Host ""
Write-Host "  2. In Infisical dashboard: Settings → Integrations → Railway" -ForegroundColor White
Write-Host "     Connect Railway and enable auto-inject for ML Engine + BFF services" -ForegroundColor White
Write-Host ""
Write-Host "  3. After Railway + Vercel are set up, run:" -ForegroundColor White
Write-Host "     .\scripts\setup-production.ps1 [params]" -ForegroundColor White
Write-Host ""
Write-Host "  4. Push to main to trigger CI/CD + Infisical sync" -ForegroundColor White
Write-Host ""
Write-Host "SECRETS ARCHITECTURE:" -ForegroundColor Cyan
Write-Host "  Infisical (single source of truth)" -ForegroundColor White
Write-Host "    ├─ production env  → Railway BFF + ML Engine + Vercel" -ForegroundColor White
Write-Host "    ├─ staging env     → Railway staging + Vercel preview" -ForegroundColor White
Write-Host "    └─ development env → local dev (npm run dev:infisical)" -ForegroundColor White
Write-Host ""
Write-Host "  GitHub Actions (runtime secrets for CI)" -ForegroundColor Cyan
Write-Host "    └─ INFISICAL_TOKEN + AI keys (synced from Infisical)" -ForegroundColor White
Write-Host ""
<<<<<<< HEAD
Write-Host "  NEVER commit .env.local to Git — all secrets stay in Infisical" -ForegroundColor Yellow
=======
Write-Host "  NEVER commit .env.local to Git — all secrets stay in Infisical" -ForegroundColor Yellow
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
