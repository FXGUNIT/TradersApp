[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ReferenceMachineLabel,
    [string]$DesktopExePath = "",
    [string]$DesktopWebDir = "",
    [string]$OutputDirectory = "",
    [double]$MaxColdStartSeconds = 8,
    [double]$MaxIdleRamMb = 500,
    [int]$LaunchTimeoutSeconds = 30,
    [int]$IdleSettleSeconds = 20,
    [ValidateSet("not-run", "pass", "fail")]
    [string]$VisibleLoginStatus = "not-run",
    [string]$VisibleLoginNotes = "",
    [ValidateSet("not-run", "pass", "fail")]
    [string]$DegradedNetworkStatus = "not-run",
    [string]$DegradedNetworkNotes = "",
    [ValidateSet("not-run", "pass", "fail")]
    [string]$ForcedLogoutStatus = "not-run",
    [string]$ForcedLogoutNotes = "",
    [ValidateSet("not-run", "pass", "fail")]
    [string]$SignedReleaseStatus = "not-run",
    [string]$SignedReleaseNotes = "",
    [switch]$SkipRuntimeProbe,
    [switch]$KeepAppOpen
)

$ErrorActionPreference = "Stop"

function Get-SafeLabel {
    param([Parameter(Mandatory = $true)][string]$Label)

    $safeLabel = ($Label.ToLowerInvariant() -replace "[^a-z0-9._-]+", "-").Trim("-")
    if ([string]::IsNullOrWhiteSpace($safeLabel)) {
        throw "ReferenceMachineLabel must contain at least one letter or number."
    }

    return $safeLabel
}

function Get-DisplayValue {
    param(
        $Value,
        [string]$Fallback = "n/a"
    )

    if ($null -eq $Value) {
        return $Fallback
    }

    if ($Value -is [string] -and [string]::IsNullOrWhiteSpace($Value)) {
        return $Fallback
    }

    return [string]$Value
}

function Write-MarkdownFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string[]]$Lines
    )

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($Path, $Lines, $utf8NoBom)
}

function Get-NetworkAdapterInventory {
    try {
        return @(
            Get-NetAdapter -ErrorAction Stop |
                Sort-Object -Property Name |
                ForEach-Object {
                    [ordered]@{
                        name = $_.Name
                        interfaceDescription = $_.InterfaceDescription
                        status = $_.Status.ToString()
                        linkSpeed = $_.LinkSpeed.ToString()
                        macAddress = $_.MacAddress
                    }
                }
        )
    }
    catch {
        return @()
    }
}

function Get-ReferenceMachineProfile {
    $operatingSystem = Get-CimInstance Win32_OperatingSystem
    $computerSystem = Get-CimInstance Win32_ComputerSystem
    $processors = @(Get-CimInstance Win32_Processor)
    $videoControllers = @(Get-CimInstance Win32_VideoController)
    $physicalMemoryMb = [Math]::Round([double]$computerSystem.TotalPhysicalMemory / 1MB, 0)
    $physicalMemoryGb = [Math]::Round([double]$computerSystem.TotalPhysicalMemory / 1GB, 2)
    $approximateFourGbClass = $physicalMemoryMb -ge 3584 -and $physicalMemoryMb -le 4608
    $logicalProcessorCount = ($processors | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum

    return [ordered]@{
        generatedAt = (Get-Date).ToString("o")
        referenceMachineLabel = $ReferenceMachineLabel
        computerName = $env:COMPUTERNAME
        operatingSystem = [ordered]@{
            caption = $operatingSystem.Caption
            version = $operatingSystem.Version
            buildNumber = $operatingSystem.BuildNumber
            architecture = $operatingSystem.OSArchitecture
            lastBootUpTime = $operatingSystem.LastBootUpTime
        }
        hardware = [ordered]@{
            manufacturer = $computerSystem.Manufacturer
            model = $computerSystem.Model
            totalPhysicalMemoryMb = $physicalMemoryMb
            totalPhysicalMemoryGb = $physicalMemoryGb
            approximateFourGbClass = $approximateFourGbClass
            logicalProcessorCount = $logicalProcessorCount
            processorNames = @($processors | ForEach-Object { $_.Name })
            videoControllers = @(
                $videoControllers | ForEach-Object {
                    [ordered]@{
                        name = $_.Name
                        adapterRamMb = if ($_.AdapterRAM) { [Math]::Round([double]$_.AdapterRAM / 1MB, 0) } else { $null }
                        driverVersion = $_.DriverVersion
                    }
                }
            )
        }
        networkAdapters = @(Get-NetworkAdapterInventory)
        operatorNotes = @(
            "Confirm this device is one of the designated Windows 10/11 x64 4 GB reference machines.",
            "Use the adapter inventory below when disabling or re-enabling the active NIC for degraded-network proof."
        )
    }
}

function Write-ReferenceMachineProfileMarkdown {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Profile,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $lines = @(
        "# P23 Reference Machine Profile",
        "",
        ("- Generated: `" + $Profile.generatedAt + "`"),
        ("- Label: `" + $Profile.referenceMachineLabel + "`"),
        ("- Computer name: `" + $Profile.computerName + "`"),
        "",
        "## Operating System",
        "",
        ("- Caption: `" + (Get-DisplayValue -Value $Profile.operatingSystem.caption) + "`"),
        ("- Version: `" + (Get-DisplayValue -Value $Profile.operatingSystem.version) + "`"),
        ("- Build: `" + (Get-DisplayValue -Value $Profile.operatingSystem.buildNumber) + "`"),
        ("- Architecture: `" + (Get-DisplayValue -Value $Profile.operatingSystem.architecture) + "`"),
        ("- Last boot: `" + (Get-DisplayValue -Value $Profile.operatingSystem.lastBootUpTime) + "`"),
        "",
        "## Hardware",
        "",
        ("- Manufacturer: `" + (Get-DisplayValue -Value $Profile.hardware.manufacturer) + "`"),
        ("- Model: `" + (Get-DisplayValue -Value $Profile.hardware.model) + "`"),
        ("- Total RAM: `" + $Profile.hardware.totalPhysicalMemoryMb + " MB (" + $Profile.hardware.totalPhysicalMemoryGb + " GB)`"),
        ("- Approximate 4 GB class: `" + $Profile.hardware.approximateFourGbClass + "`"),
        ("- Logical processor count: `" + $Profile.hardware.logicalProcessorCount + "`"),
        ""
    )

    if ($Profile.hardware.processorNames.Count -gt 0) {
        $lines += "Processor(s):"
        foreach ($processorName in $Profile.hardware.processorNames) {
            $lines += ("- `" + $processorName + "`")
        }
        $lines += ""
    }

    if ($Profile.hardware.videoControllers.Count -gt 0) {
        $lines += "Video controller(s):"
        foreach ($videoController in $Profile.hardware.videoControllers) {
            $adapterRam = Get-DisplayValue -Value $videoController.adapterRamMb
            $lines += ("- `" + $videoController.name + "` | RAM MB: `" + $adapterRam + "` | Driver: `" + (Get-DisplayValue -Value $videoController.driverVersion) + "`")
        }
        $lines += ""
    }

    if ($Profile.networkAdapters.Count -gt 0) {
        $lines += "## Network Adapters"
        $lines += ""
        foreach ($adapter in $Profile.networkAdapters) {
            $lines += ("- `" + $adapter.name + "` | Status: `" + (Get-DisplayValue -Value $adapter.status) + "` | Link: `" + (Get-DisplayValue -Value $adapter.linkSpeed) + "` | MAC: `" + (Get-DisplayValue -Value $adapter.macAddress) + "`")
        }
        $lines += ""
    }

    $lines += "## Operator Notes"
    $lines += ""
    foreach ($note in $Profile.operatorNotes) {
        $lines += ("- " + $note)
    }

    Write-MarkdownFile -Path $Path -Lines $lines
}

function Write-ManualTemplate {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$RunDirectory,
        [Parameter(Mandatory = $true)][string]$Label,
        [string]$DesktopExePath = ""
    )

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("# P23 Manual Check Template")
    $lines.Add("")
    $lines.Add("- Run directory: `" + $RunDirectory + "`")
    $lines.Add("- Reference machine label: `" + $Label + "`")
    if (-not [string]::IsNullOrWhiteSpace($DesktopExePath)) {
        $lines.Add("- Desktop EXE path: `" + $DesktopExePath + "`")
    }
    $lines.Add("")
    $lines.Add("## Required Manual Outcomes")
    $lines.Add("")
    $lines.Add("- Visible login route: record PASS/FAIL and the observed shell-to-login time.")
    $lines.Add("- Degraded-network flow: record how long the adapter stayed offline and whether the reconnect toast appeared.")
    $lines.Add("- Forced logout / minimum-version flow: record the trigger used and whether the route collapsed back to login.")
    $lines.Add("- Signed release rerun: record the installed payload path and whether the signed package still passed.")
    $lines.Add("")
    $lines.Add("## Suggested Rerun Command")
    $lines.Add("")
    $lines.Add("```powershell")
    $lines.Add("powershell -ExecutionPolicy Bypass -File .\\scripts\\windows\\run-p23-reference-certification.ps1 `")
    $lines.Add("  -ReferenceMachineLabel """ + $Label + """ `")
    if (-not [string]::IsNullOrWhiteSpace($DesktopExePath)) {
        $lines.Add("  -DesktopExePath """ + $DesktopExePath + """ `")
    }
    $lines.Add("  -VisibleLoginStatus pass `")
    $lines.Add("  -VisibleLoginNotes ""Login visible at 6.8s after cold launch."" `")
    $lines.Add("  -DegradedNetworkStatus pass `")
    $lines.Add("  -DegradedNetworkNotes ""Disabled active NIC for 45s; offline and reconnect toasts observed; shell stayed open."" `")
    $lines.Add("  -ForcedLogoutStatus pass `")
    $lines.Add("  -ForcedLogoutNotes ""Admin block forced the route back to login on next policy poll."" `")
    $lines.Add("  -SignedReleaseStatus pass `")
    $lines.Add("  -SignedReleaseNotes ""Installed signed release payload in Program Files.""")
    $lines.Add("```")

    Write-MarkdownFile -Path $Path -Lines @($lines)
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$harnessPath = Join-Path $repoRoot "scripts/windows/certify-desktop-performance.ps1"

if (-not (Test-Path -LiteralPath $harnessPath)) {
    throw "Expected certification harness at '$harnessPath'."
}

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $repoRoot ".artifacts/windows/p23"
}

$safeLabel = Get-SafeLabel -Label $ReferenceMachineLabel
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDirectory = Join-Path $OutputDirectory ($timestamp + "-" + $safeLabel)
New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null
$resolvedRunDirectory = (Resolve-Path -LiteralPath $runDirectory).Path
$transcriptPath = Join-Path $resolvedRunDirectory "p23-reference-run.log"
$machineProfileJsonPath = Join-Path $resolvedRunDirectory "reference-machine-profile.json"
$machineProfileMarkdownPath = Join-Path $resolvedRunDirectory "reference-machine-profile.md"
$manualTemplatePath = Join-Path $resolvedRunDirectory "manual-check-template.md"

$machineProfile = Get-ReferenceMachineProfile
$machineProfile | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $machineProfileJsonPath
Write-ReferenceMachineProfileMarkdown -Profile $machineProfile -Path $machineProfileMarkdownPath
Write-ManualTemplate -Path $manualTemplatePath -RunDirectory $resolvedRunDirectory -Label $ReferenceMachineLabel -DesktopExePath $DesktopExePath

$invokeArgs = @{
    ReferenceMachineLabel = $ReferenceMachineLabel
    OutputDirectory = $resolvedRunDirectory
    MaxColdStartSeconds = $MaxColdStartSeconds
    MaxIdleRamMb = $MaxIdleRamMb
    LaunchTimeoutSeconds = $LaunchTimeoutSeconds
    IdleSettleSeconds = $IdleSettleSeconds
    VisibleLoginStatus = $VisibleLoginStatus
    VisibleLoginNotes = $VisibleLoginNotes
    DegradedNetworkStatus = $DegradedNetworkStatus
    DegradedNetworkNotes = $DegradedNetworkNotes
    ForcedLogoutStatus = $ForcedLogoutStatus
    ForcedLogoutNotes = $ForcedLogoutNotes
    SignedReleaseStatus = $SignedReleaseStatus
    SignedReleaseNotes = $SignedReleaseNotes
}

if (-not [string]::IsNullOrWhiteSpace($DesktopExePath)) {
    $invokeArgs.DesktopExePath = $DesktopExePath
}

if (-not [string]::IsNullOrWhiteSpace($DesktopWebDir)) {
    $invokeArgs.DesktopWebDir = $DesktopWebDir
}

if ($SkipRuntimeProbe) {
    $invokeArgs.SkipRuntimeProbe = $true
}

if ($KeepAppOpen) {
    $invokeArgs.KeepAppOpen = $true
}

$transcriptStarted = $false

try {
    Start-Transcript -LiteralPath $transcriptPath -Force | Out-Null
    $transcriptStarted = $true
    Write-Host "Reference-machine profile JSON: $machineProfileJsonPath"
    Write-Host "Reference-machine profile Markdown: $machineProfileMarkdownPath"
    Write-Host "Manual template: $manualTemplatePath"
    & $harnessPath @invokeArgs
}
finally {
    if ($transcriptStarted) {
        try {
            Stop-Transcript | Out-Null
        }
        catch {
            # Ignore transcript shutdown noise if PowerShell already ended it.
        }
    }
}

Write-Host "P23 reference-machine run directory: $resolvedRunDirectory"
