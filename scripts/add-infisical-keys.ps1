$ErrorActionPreference = "SilentlyContinue"
$Infisical = "C:\Users\Asus\AppData\Roaming\npm\node_modules\@infisical\cli\bin\infisical.exe"
$Env = "dev"
$ProjectId = "0e4f9b8b-846e-4e66-a4aa-97c8fa9863ab"

$secrets = @{
    "VITE_TELEGRAM_BOT_TOKEN" = "8559799496:AAG9MBNlSPR4l3A3YwIhDOi-R6pcOEPmYPk"
    "TELEGRAM_BOT_TOKEN" = "8559799496:AAG9MBNlSPR4l3A3YwIhDOi-R6pcOEPmYPk"
    "TELEGRAM_BRIDGE_BOT_TOKEN" = "8628748521:AAFhRzPSnm427SYRQPS5Y9v0VC23F7b041o"
    "FINNHUB_API_KEY" = "d7776l9r01qp6afkfof0d7776l9r01qp6afkfofg"
    "NEWS_API_KEY" = "pub_d0372350e0ec4ff9b87fb0355c58a1ff"
}

foreach ($entry in $secrets.GetEnumerator()) {
    Write-Host "[$($count+1)/$($secrets.Count)] $($entry.Key)..." -NoNewline
    & $Infisical secrets set "$($entry.Key)=$($entry.Value)" --env $Env --projectId $ProjectId 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
    }
    $count++
}
Write-Host ""
Write-Host "Done! Set $($secrets.Count) secrets in Infisical dev env." -ForegroundColor Cyan