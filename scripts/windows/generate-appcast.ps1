[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PackagePath,
    [Parameter(Mandatory = $true)]
    [string]$AppCastOutputDirectory,
    [Parameter(Mandatory = $true)]
    [string]$ChangesDirectory,
    [Parameter(Mandatory = $true)]
    [string]$ReleaseVersion,
    [Parameter(Mandatory = $true)]
    [string]$UpdatesBaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$ReleaseNotesBaseUrl,
    [string]$AppCastUrl = "",
    [string]$ProductName = "TradersApp Desktop",
    [string]$OperatingSystem = "windows-x64",
    [string]$KeyPath = $env:NETSPARKLE_KEY_PATH
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:SPARKLE_PRIVATE_KEY) -and `
    [string]::IsNullOrWhiteSpace($env:SPARKLE_PUBLIC_KEY) -and `
    [string]::IsNullOrWhiteSpace($KeyPath)) {
    throw "NetSparkle signing keys are required. Set SPARKLE_PRIVATE_KEY and SPARKLE_PUBLIC_KEY or provide -KeyPath."
}

$resolvedPackagePath = Resolve-Path -LiteralPath $PackagePath
$resolvedOutputDir = Resolve-Path -LiteralPath $AppCastOutputDirectory -ErrorAction SilentlyContinue
if (-not $resolvedOutputDir) {
    New-Item -ItemType Directory -Path $AppCastOutputDirectory -Force | Out-Null
    $resolvedOutputDir = Resolve-Path -LiteralPath $AppCastOutputDirectory
}

$resolvedChangesDir = Resolve-Path -LiteralPath $ChangesDirectory
$releaseNotesPath = Join-Path $resolvedChangesDir "$ReleaseVersion.md"
if (-not (Test-Path -LiteralPath $releaseNotesPath)) {
    throw "Release notes file not found: $releaseNotesPath"
}

$arguments = @(
    "--single-file", $resolvedPackagePath,
    "--appcast-output-directory", $resolvedOutputDir,
    "--change-log-path", $resolvedChangesDir,
    "--base-url", $UpdatesBaseUrl.TrimEnd('/'),
    "--change-log-url", $ReleaseNotesBaseUrl.TrimEnd('/'),
    "--product-name", $ProductName,
    "--os", $OperatingSystem,
    "--output-file-name", "appcast",
    "--human-readable", "true",
    "--file-version", $ReleaseVersion
)

if (-not [string]::IsNullOrWhiteSpace($AppCastUrl)) {
    $arguments += @("--link-tag", $AppCastUrl)
}

if (-not [string]::IsNullOrWhiteSpace($KeyPath)) {
    $resolvedKeyPath = Resolve-Path -LiteralPath $KeyPath
    $arguments += @("--key-path", $resolvedKeyPath)
}

& netsparkle-generate-appcast @arguments
if ($LASTEXITCODE -ne 0) {
    throw "netsparkle-generate-appcast failed."
}
