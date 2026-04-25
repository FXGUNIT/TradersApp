param(
    [string]$GitHubRepo = "FXGUNIT/TradersApp",
    [string]$InfisicalEnv = "dev",
    [string]$InfisicalPath = "/",
    [switch]$SkipGitHub,
    [switch]$SkipInfisical
)

$ErrorActionPreference = "Stop"

function Convert-SecureStringToText {
    param([securestring]$SecureString)

    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    try {
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        if ($bstr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    }
}

function ConvertTo-DotEnvValue {
    param([string]$Value)

    $escaped = $Value.Replace("\", "\\").Replace('"', '\"')
    return '"' + $escaped + '"'
}

function Set-GitHubSecret {
    param(
        [string]$Name,
        [string]$Value,
        [string]$Repo
    )

    $Value | gh secret set $Name -R $Repo | Out-Host
}

$infisicalExe = "C:\Users\Asus\AppData\Roaming\npm\node_modules\@infisical\cli\bin\infisical.exe"
if (-not (Test-Path -LiteralPath $infisicalExe)) {
    $infisicalCommand = Get-Command infisical -ErrorAction SilentlyContinue
    if ($null -eq $infisicalCommand) {
        throw "Infisical CLI was not found."
    }
    $infisicalExe = $infisicalCommand.Source
}

Write-Host ""
Write-Host "Save Contabo secrets to GitHub Actions and Infisical"
Write-Host "Nothing is committed to git. Secret values are not printed."
Write-Host ""
Write-Host "Target GitHub repo: $GitHubRepo"
Write-Host "Target Infisical env/path: $InfisicalEnv $InfisicalPath"
Write-Host ""

$clientId = Read-Host "CONTABO_API_CLIENT_ID"
$clientSecretSecure = Read-Host "CONTABO_API_CLIENT_SECRET" -AsSecureString
$apiUser = Read-Host "CONTABO_API_USER"
$apiPasswordSecure = Read-Host "CONTABO_API_PASSWORD" -AsSecureString

$clientSecret = Convert-SecureStringToText -SecureString $clientSecretSecure
$apiPassword = Convert-SecureStringToText -SecureString $apiPasswordSecure

$secrets = [ordered]@{
    CONTABO_API_CLIENT_ID = $clientId
    CONTABO_API_CLIENT_SECRET = $clientSecret
    CONTABO_API_USER = $apiUser
    CONTABO_API_PASSWORD = $apiPassword
}

$tempFile = $null

try {
    if (-not $SkipGitHub) {
        Write-Host ""
        Write-Host "Saving GitHub Actions repository secrets..."
        foreach ($secret in $secrets.GetEnumerator()) {
            Set-GitHubSecret -Name $secret.Key -Value $secret.Value -Repo $GitHubRepo
        }
        Write-Host "GitHub Actions secrets saved."
    }

    if (-not $SkipInfisical) {
        Write-Host ""
        Write-Host "Saving Infisical shared secrets..."
        $tempFile = Join-Path ([IO.Path]::GetTempPath()) ("contabo-secrets-" + [guid]::NewGuid().ToString("N") + ".env")
        $lines = foreach ($secret in $secrets.GetEnumerator()) {
            "$($secret.Key)=$(ConvertTo-DotEnvValue -Value $secret.Value)"
        }
        Set-Content -LiteralPath $tempFile -Value $lines -Encoding UTF8 -NoNewline

        & $infisicalExe secrets set --file $tempFile --env $InfisicalEnv --path $InfisicalPath
        if ($LASTEXITCODE -ne 0) {
            throw "Infisical CLI failed with exit code $LASTEXITCODE."
        }
        Write-Host "Infisical secrets saved."
    }

    Write-Host ""
    Write-Host "Done."
    Write-Host "Important: because these values were pasted into chat, rotate the Contabo API secret/password after saving replacement values."
}
finally {
    if ($tempFile -and (Test-Path -LiteralPath $tempFile)) {
        Remove-Item -LiteralPath $tempFile -Force
    }

    $clientSecret = $null
    $apiPassword = $null
    $secrets = $null
}
