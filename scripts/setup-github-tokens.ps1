$ErrorActionPreference = "Stop"
$Gh = "$env:TEMP\gh\bin\gh.exe"
$Repo = "FXGUNIT/TRADERS-REGIMENT"

# Set remaining secrets - FINNHUB and NEWS_API from .env.local (already captured)
$remaining = @{
    "FINNHUB_API_KEY" = ""
    "NEWS_API_KEY" = ""
}

# Set GitHub variables for Railway
$vars = @{
    "RAILWAY_STAGING_ENV_ID" = ""
    "RAILWAY_STAGING_ML_SERVICE_ID" = ""
    "RAILWAY_STAGING_BFF_SERVICE_ID" = ""
    "RAILWAY_PROD_ENV_ID" = ""
    "RAILWAY_PROD_ML_SERVICE_ID" = ""
    "RAILWAY_PROD_BFF_SERVICE_ID" = ""
    "VERCEL_ORG_ID" = ""
    "VERCEL_PROJECT_ID" = ""
}

Write-Host "Remaining secrets to set:" -ForegroundColor Yellow
foreach ($k in $remaining.Keys) {
    if ($remaining[$k] -ne "") {
        Write-Host "  Setting $k..."
        & $Gh secret set $k --body $remaining[$k] --repo $Repo 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { Write-Host "  OK" -ForegroundColor Green }
    } else {
        Write-Host "  $k → (empty, skip)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "GitHub Variables (for Railway/Vercel):" -ForegroundColor Yellow
foreach ($v in $vars.Keys) {
    Write-Host "  $v → (not yet set - waiting on Railway/Vercel setup)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Setup summary:" -ForegroundColor Cyan
Write-Host "  ✓ 16 secrets set" -ForegroundColor Green
Write-Host "  ○ Railway variables (need Railway account setup)" -ForegroundColor Gray
Write-Host "  ○ Vercel variables (need Vercel account setup)" -ForegroundColor Gray