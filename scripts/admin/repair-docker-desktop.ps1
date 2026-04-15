param(
  [switch]$SkipWslReset
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[docker-repair] $Message"
}

function Test-IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Stop-DockerProcesses {
  Write-Step "Force-killing lingering Docker processes"
  $imageNames = @(
    "Docker Desktop.exe",
    "com.docker.backend.exe",
    "com.docker.build.exe",
    "com.docker.proxy.exe",
    "com.docker.vpnkit.exe",
    "docker-agent.exe",
    "local-sandboxesd.exe"
  )

  foreach ($imageName in $imageNames) {
    & taskkill /F /T /IM $imageName | Out-Null
  }

  Get-Process "Docker Desktop", "com.docker.backend", "com.docker.build", "com.docker.proxy", "com.docker.vpnkit", "docker-agent", "local-sandboxesd" -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
}

if (-not (Test-IsAdmin)) {
  Write-Error "Run this script as Administrator."
}

$dockerRoot = "C:\Program Files\Docker\Docker"
$dockerExe = Join-Path $dockerRoot "Docker Desktop.exe"
$dockerSvcExe = Join-Path $dockerRoot "com.docker.service"
$dockerCliDir = Join-Path $dockerRoot "resources\bin"
$dockerCliPluginSrc = Join-Path $dockerRoot "resources\cli-plugins"
$dockerCliPluginDir = "C:\Program Files\Docker\cli-plugins"
$dockerVersionBin = "C:\ProgramData\DockerDesktop\version-bin"
$dockerVersionBinCli = Join-Path $dockerVersionBin "cli-plugins"
$dockerVersionBinBin = Join-Path $dockerVersionBin "bin"

if (-not (Test-Path $dockerExe)) {
  throw "Docker Desktop binary not found at: $dockerExe"
}

Stop-DockerProcesses

Write-Step "Ensuring Docker Desktop HKLM registration keys exist (64-bit + WOW6432Node)"
$ddKeys = @(
  "HKLM:\SOFTWARE\Docker Inc.\Docker Desktop",
  "HKLM:\SOFTWARE\Docker Inc\Docker Desktop",
  "HKLM:\SOFTWARE\WOW6432Node\Docker Inc.\Docker Desktop",
  "HKLM:\SOFTWARE\WOW6432Node\Docker Inc\Docker Desktop"
)
foreach ($ddKey in $ddKeys) {
  New-Item -Path $ddKey -Force | Out-Null
  New-ItemProperty -Path $ddKey -Name "AppPath" -Value "$dockerRoot\" -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $ddKey -Name "InstallPath" -Value "$dockerRoot\" -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $ddKey -Name "Version" -Value "4.68.0" -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $ddKey -Name "Channel" -Value "main" -PropertyType String -Force | Out-Null
}

Write-Step "Ensuring Docker CLI plugin directories exist"
New-Item -Path $dockerCliPluginDir -ItemType Directory -Force | Out-Null
New-Item -Path $dockerVersionBin -ItemType Directory -Force | Out-Null
New-Item -Path $dockerVersionBinCli -ItemType Directory -Force | Out-Null
New-Item -Path $dockerVersionBinBin -ItemType Directory -Force | Out-Null

Write-Step "Copying Docker CLI plugins to fixed locations"
Get-ChildItem $dockerCliPluginSrc -File | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $dockerCliPluginDir $_.Name) -Force
  Copy-Item $_.FullName (Join-Path $dockerVersionBinCli $_.Name) -Force
}

Write-Step "Copying Docker CLI binaries to version-bin"
Get-ChildItem $dockerCliDir -File | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $dockerVersionBinBin $_.Name) -Force
}

Write-Step "Registering Docker service if missing"
$svc = Get-Service "com.docker.service" -ErrorAction SilentlyContinue
if (-not $svc) {
  & sc.exe create "com.docker.service" binPath= "`"$dockerSvcExe`"" start= auto DisplayName= "Docker Desktop Service" | Out-Null
}

Write-Step "Setting Docker service startup to Automatic"
& sc.exe config "com.docker.service" start= auto | Out-Null

if (-not $SkipWslReset) {
  Write-Step "Shutting down WSL"
  & wsl --shutdown | Out-Null

  Write-Step "Removing stale docker-desktop distro if present"
  $wslList = (& wsl -l -v 2>$null) | Out-String
  if ($wslList -match "docker-desktop") {
    & wsl --unregister docker-desktop | Out-Null
  }
}

Write-Step "Starting LxssManager and Docker service"
Start-Service -Name "LxssManager" -ErrorAction SilentlyContinue
Start-Service -Name "com.docker.service"

Write-Step "Applying stable Desktop settings"
$settingsStore = Join-Path $env:APPDATA "Docker\settings-store.json"
if (Test-Path $settingsStore) {
  try {
    $settings = Get-Content $settingsStore -Raw | ConvertFrom-Json
    $settings.AutoDownloadUpdates = $false
    $settings.EnableDockerAI = $false
    $settings.InferenceCanUseGPUVariant = $false
    if ($settings.PSObject.Properties.Name -notcontains "DisableHardwareAcceleration") {
      $settings | Add-Member -NotePropertyName "DisableHardwareAcceleration" -NotePropertyValue $true
    } else {
      $settings.DisableHardwareAcceleration = $true
    }
    if ($settings.PSObject.Properties.Name -notcontains "EnableInference") {
      $settings | Add-Member -NotePropertyName "EnableInference" -NotePropertyValue $false
    } else {
      $settings.EnableInference = $false
    }
    if ($settings.PSObject.Properties.Name -notcontains "EnableDockerMCPToolkit") {
      $settings | Add-Member -NotePropertyName "EnableDockerMCPToolkit" -NotePropertyValue $false
    } else {
      $settings.EnableDockerMCPToolkit = $false
    }
    $settings | ConvertTo-Json -Depth 20 | Set-Content $settingsStore -Encoding UTF8
  } catch {
    Write-Step "Warning: failed to update settings-store.json ($($_.Exception.Message))"
  }
}

Write-Step "Starting Docker Desktop"
Start-Process $dockerExe
Start-Sleep -Seconds 20

Stop-DockerProcesses
Start-Process $dockerExe
Start-Sleep -Seconds 25

Write-Step "Adding Docker CLI path to user environment"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ([string]::IsNullOrWhiteSpace($userPath)) {
  [Environment]::SetEnvironmentVariable("Path", $dockerCliDir, "User")
} elseif ($userPath -notlike "*$dockerCliDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$dockerCliDir", "User")
}

Write-Step "Adding Docker CLI path to machine environment"
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ([string]::IsNullOrWhiteSpace($machinePath)) {
  [Environment]::SetEnvironmentVariable("Path", $dockerCliDir, "Machine")
} elseif ($machinePath -notlike "*$dockerCliDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$machinePath;$dockerCliDir", "Machine")
}

Write-Step "Checking docker engine connectivity"
$env:Path = "$env:Path;$dockerCliDir"
& docker version

Write-Step "Repair completed"
