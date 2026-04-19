[CmdletBinding()]
param(
    [string]$BundlePackagesDir = "desktop/windows/installer/TradersApp.Bundle/Packages",
    [string]$BootstrapperUrl = $env:WEBVIEW2_BOOTSTRAPPER_URL,
    [string]$OfflineInstallerUrl = $env:WEBVIEW2_OFFLINE_INSTALLER_URL,
    [switch]$DownloadOfflineInstaller
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$resolvedPackagesDir = Resolve-Path -LiteralPath $BundlePackagesDir -ErrorAction SilentlyContinue
if (-not $resolvedPackagesDir) {
    New-Item -ItemType Directory -Path $BundlePackagesDir -Force | Out-Null
    $resolvedPackagesDir = Resolve-Path -LiteralPath $BundlePackagesDir
}

function Save-RemoteFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceUrl,
        [Parameter(Mandatory = $true)]
        [string]$DestinationPath
    )

    Write-Host "Downloading $SourceUrl"
    Invoke-WebRequest -Uri $SourceUrl -OutFile $DestinationPath
    Write-Host "Saved $DestinationPath"
}

if ([string]::IsNullOrWhiteSpace($BootstrapperUrl)) {
    Write-Warning "WEBVIEW2_BOOTSTRAPPER_URL was not set. The WiX bundle will build without a packaged WebView2 bootstrapper."
}
else {
    $bootstrapperPath = Join-Path $resolvedPackagesDir "MicrosoftEdgeWebview2Setup.exe"
    Save-RemoteFile -SourceUrl $BootstrapperUrl -DestinationPath $bootstrapperPath
}

if ($DownloadOfflineInstaller) {
    if ([string]::IsNullOrWhiteSpace($OfflineInstallerUrl)) {
        Write-Warning "WEBVIEW2_OFFLINE_INSTALLER_URL was not set. Skipping the offline Evergreen runtime package."
    }
    else {
        $offlineFileName = Split-Path -Path $OfflineInstallerUrl -Leaf
        if ([string]::IsNullOrWhiteSpace($offlineFileName)) {
            $offlineFileName = "MicrosoftEdgeWebView2RuntimeInstaller.exe"
        }

        $offlinePath = Join-Path $resolvedPackagesDir $offlineFileName
        Save-RemoteFile -SourceUrl $OfflineInstallerUrl -DestinationPath $offlinePath
    }
}
