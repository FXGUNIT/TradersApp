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

if (-not (Test-IsAdmin)) {
  Write-Error "Run this script as Administrator."
}

$dockerRoot = "C:\Program Files\Docker\Docker"
$dockerExe = Join-Path $dockerRoot "Docker Desktop.exe"
$dockerSvcExe = Join-Path $dockerRoot "com.docker.service"
$dockerCliDir = Join-Path $dockerRoot "resources\bin"

if (-not (Test-Path $dockerExe)) {
  throw "Docker Desktop binary not found at: $dockerExe"
}

Write-Step "Stopping Docker Desktop processes"
Get-Process "Docker Desktop", "com.docker.backend", "com.docker.proxy" -ErrorAction SilentlyContinue |
  Stop-Process -Force -ErrorAction SilentlyContinue

Write-Step "Ensuring Docker Desktop HKLM registration key exists"
$ddKey = "HKLM:\SOFTWARE\Docker Inc\Docker Desktop"
New-Item -Path $ddKey -Force | Out-Null
New-ItemProperty -Path $ddKey -Name "InstallPath" -Value "$dockerRoot\" -PropertyType String -Force | Out-Null
New-ItemProperty -Path $ddKey -Name "Version" -Value "4.68.0" -PropertyType String -Force | Out-Null
New-ItemProperty -Path $ddKey -Name "Channel" -Value "main" -PropertyType String -Force | Out-Null

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

Write-Step "Starting Docker Desktop"
Start-Process $dockerExe
Start-Sleep -Seconds 20

Write-Step "Adding Docker CLI path to user environment"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ([string]::IsNullOrWhiteSpace($userPath)) {
  [Environment]::SetEnvironmentVariable("Path", $dockerCliDir, "User")
} elseif ($userPath -notlike "*$dockerCliDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$dockerCliDir", "User")
}

Write-Step "Checking docker engine connectivity"
$env:Path = "$env:Path;$dockerCliDir"
& docker version

Write-Step "Repair completed"
