[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    [Parameter(Mandatory = $true)]
    [string]$AppCastUrl,
    [Parameter(Mandatory = $true)]
    [string]$AppCastPublicKey,
    [double]$UpdateCheckIntervalHours = 6
)

$ErrorActionPreference = "Stop"

$payload = @{
    appCastUrl = $AppCastUrl
    appCastPublicKey = $AppCastPublicKey
    updateCheckIntervalHours = $UpdateCheckIntervalHours
} | ConvertTo-Json -Depth 3

$parentDirectory = Split-Path -Parent $OutputPath
if ($parentDirectory) {
    New-Item -ItemType Directory -Path $parentDirectory -Force | Out-Null
}

Set-Content -LiteralPath $OutputPath -Value $payload
Write-Host "Wrote desktop runtime settings to $OutputPath"
