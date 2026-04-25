param(
    [string]$FirewallName = "home",
    [switch]$AddWebRules,
    [switch]$SkipAssign
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

function New-ContaboHeaders {
    param([string]$AccessToken)

    @{
        Authorization = "Bearer $AccessToken"
        "x-request-id" = [guid]::NewGuid().ToString()
        "x-trace-id" = [guid]::NewGuid().ToString()
    }
}

function Invoke-ContaboApi {
    param(
        [ValidateSet("GET", "POST", "PUT", "PATCH", "DELETE")]
        [string]$Method,
        [string]$Path,
        [string]$AccessToken,
        [object]$Body = $null
    )

    $headers = New-ContaboHeaders -AccessToken $AccessToken
    $uri = "https://api.contabo.com$Path"

    if ($null -eq $Body) {
        return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
    }

    $json = $Body | ConvertTo-Json -Depth 20
    return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -ContentType "application/json" -Body $json
}

function Get-PortList {
    param([object]$DestPorts)

    if ($null -eq $DestPorts) {
        return @()
    }

    if ($DestPorts -is [string]) {
        $trimmed = $DestPorts.Trim()
        if ($trimmed.StartsWith("[")) {
            try {
                return @($trimmed | ConvertFrom-Json)
            }
            catch {
                return @($trimmed)
            }
        }

        return @($trimmed -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    }

    return @($DestPorts)
}

function ConvertTo-ContaboRule {
    param([object]$Rule)

    $ipv4 = @()
    $ipv6 = @()

    if ($Rule.srcCidr) {
        if ($Rule.srcCidr.ipv4) { $ipv4 = @($Rule.srcCidr.ipv4) }
        if ($Rule.srcCidr.ipv6) { $ipv6 = @($Rule.srcCidr.ipv6) }
    }

    [ordered]@{
        protocol = $Rule.protocol
        destPorts = @(Get-PortList -DestPorts $Rule.destPorts | ForEach-Object { [string]$_ })
        srcCidr = [ordered]@{
            ipv4 = $ipv4
            ipv6 = $ipv6
        }
        action = if ($Rule.action) { $Rule.action } else { "accept" }
        status = if ($Rule.status) { $Rule.status } else { "active" }
        displayName = if ($Rule.displayName) { $Rule.displayName } else { "Imported rule" }
    }
}

function New-AcceptRule {
    param(
        [string]$DisplayName,
        [string]$Protocol,
        [string[]]$Ports,
        [string[]]$Ipv4Sources,
        [string[]]$Ipv6Sources = @()
    )

    [ordered]@{
        protocol = $Protocol
        destPorts = @($Ports | ForEach-Object { [string]$_ })
        srcCidr = [ordered]@{
            ipv4 = @($Ipv4Sources)
            ipv6 = @($Ipv6Sources)
        }
        action = "accept"
        status = "active"
        displayName = $DisplayName
    }
}

function Test-RuleExists {
    param(
        [object[]]$Rules,
        [string]$Protocol,
        [string]$Port,
        [string]$Ipv4Source
    )

    foreach ($rule in $Rules) {
        $ports = Get-PortList -DestPorts $rule.destPorts
        $ipv4 = @()
        if ($rule.srcCidr -and $rule.srcCidr.ipv4) {
            $ipv4 = @($rule.srcCidr.ipv4)
        }

        if (
            $rule.protocol -eq $Protocol -and
            $rule.status -eq "active" -and
            $ports -contains $Port -and
            ($ipv4 -contains $Ipv4Source -or $ipv4 -contains "AnyIPv4")
        ) {
            return $true
        }
    }

    return $false
}

function Test-DropAnyRule {
    param([object]$Rule)

    if ($Rule.action -ne "drop") {
        return $false
    }

    $ports = @(Get-PortList -DestPorts $Rule.destPorts)
    $ipv4 = @()
    $ipv6 = @()

    if ($Rule.srcCidr) {
        if ($Rule.srcCidr.ipv4) { $ipv4 = @($Rule.srcCidr.ipv4) }
        if ($Rule.srcCidr.ipv6) { $ipv6 = @($Rule.srcCidr.ipv6) }
    }

    $isAnySource = (
        $ipv4 -contains "AnyIPv4" -or
        $ipv4 -contains "0.0.0.0/0" -or
        $ipv6 -contains "AnyIPv6" -or
        $ipv6 -contains "::/0"
    )

    $isAnyPort = (
        $ports.Count -eq 0 -or
        $ports -contains "Any" -or
        $ports -contains "any" -or
        $ports -contains "1-65535"
    )

    return ($isAnySource -and $isAnyPort)
}

function Move-DropAnyRulesToEnd {
    param([object[]]$Rules)

    $allowAndSpecificRules = @()
    $dropAnyRules = @()

    foreach ($rule in $Rules) {
        if (Test-DropAnyRule -Rule $rule) {
            $dropAnyRules += $rule
        }
        else {
            $allowAndSpecificRules += $rule
        }
    }

    return @($allowAndSpecificRules + $dropAnyRules)
}

Write-Host ""
Write-Host "Contabo firewall setup"
Write-Host "This adds SSH first, then assigns the firewall only after the SSH rule exists."
Write-Host "Credentials are used in memory only and are not saved."
Write-Host ""

$clientId = Read-Host "Contabo API Client ID"
$clientSecretSecure = Read-Host "Contabo API Client Secret" -AsSecureString
$apiUser = Read-Host "Contabo API User / email"
$apiPasswordSecure = Read-Host "Contabo API Password" -AsSecureString

if ([string]::IsNullOrWhiteSpace($FirewallName)) {
    $FirewallName = "home"
}

try {
    $publicIp = (Invoke-RestMethod -Uri "https://api.ipify.org?format=json" -Method GET).ip
}
catch {
    $publicIp = Read-Host "Could not detect your public IPv4. Enter the IPv4 address to allow for SSH"
}

if ($publicIp -notmatch "^\d{1,3}(\.\d{1,3}){3}$") {
    throw "The detected/provided IP '$publicIp' does not look like an IPv4 address."
}

$sshSource = "$publicIp/32"
Write-Host ""
Write-Host "SSH will be allowed from: $sshSource"

$clientSecret = Convert-SecureStringToText -SecureString $clientSecretSecure
$apiPassword = Convert-SecureStringToText -SecureString $apiPasswordSecure

try {
    $tokenBody = @{
        grant_type = "password"
        client_id = $clientId
        client_secret = $clientSecret
        username = $apiUser
        password = $apiPassword
    }

    $tokenResponse = Invoke-RestMethod `
        -Uri "https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token" `
        -Method POST `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $tokenBody

    $accessToken = $tokenResponse.access_token
    if ([string]::IsNullOrWhiteSpace($accessToken)) {
        throw "Contabo did not return an access token."
    }

    $firewallsResponse = Invoke-ContaboApi -Method GET -Path "/v1/firewalls?size=100" -AccessToken $accessToken
    $matchingFirewalls = @($firewallsResponse.data | Where-Object { $_.name -eq $FirewallName })

    if ($matchingFirewalls.Count -eq 0) {
        throw "No firewall named '$FirewallName' was found. Create it in Contabo first, or rerun this script with -FirewallName."
    }

    if ($matchingFirewalls.Count -gt 1) {
        Write-Host "Multiple firewalls named '$FirewallName' were found:"
        $matchingFirewalls | Select-Object firewallId, name, status | Format-Table
        $selectedFirewallId = Read-Host "Enter the firewallId to use"
        $firewall = $matchingFirewalls | Where-Object { $_.firewallId -eq $selectedFirewallId } | Select-Object -First 1
        if ($null -eq $firewall) {
            throw "Selected firewallId was not found."
        }
    }
    else {
        $firewall = $matchingFirewalls[0]
    }

    $firewallDetails = Invoke-ContaboApi -Method GET -Path "/v1/firewalls/$($firewall.firewallId)" -AccessToken $accessToken
    $firewallData = @($firewallDetails.data)[0]
    $existingRules = @()
    if ($firewallData.rules -and $firewallData.rules.inbound) {
        $existingRules = @($firewallData.rules.inbound | ForEach-Object { ConvertTo-ContaboRule -Rule $_ })
    }

    $rules = @($existingRules)

    if (Test-RuleExists -Rules $rules -Protocol "tcp" -Port "22" -Ipv4Source $sshSource) {
        Write-Host "SSH rule already exists."
    }
    else {
        $rules += New-AcceptRule `
            -DisplayName "Allow SSH from current IP" `
            -Protocol "tcp" `
            -Ports @("22") `
            -Ipv4Sources @($sshSource)
        Write-Host "Prepared SSH allow rule for TCP 22 from $sshSource."
    }

    if ($AddWebRules) {
        if (-not (Test-RuleExists -Rules $rules -Protocol "tcp" -Port "80" -Ipv4Source "AnyIPv4")) {
            $rules += New-AcceptRule -DisplayName "Allow HTTP" -Protocol "tcp" -Ports @("80") -Ipv4Sources @("AnyIPv4") -Ipv6Sources @("AnyIPv6")
            Write-Host "Prepared HTTP allow rule for TCP 80 from Any."
        }

        if (-not (Test-RuleExists -Rules $rules -Protocol "tcp" -Port "443" -Ipv4Source "AnyIPv4")) {
            $rules += New-AcceptRule -DisplayName "Allow HTTPS" -Protocol "tcp" -Ports @("443") -Ipv4Sources @("AnyIPv4") -Ipv6Sources @("AnyIPv6")
            Write-Host "Prepared HTTPS allow rule for TCP 443 from Any."
        }
    }

    $rules = Move-DropAnyRulesToEnd -Rules $rules

    $updateBody = @{
        rules = @{
            inbound = @($rules)
        }
    }

    $updatedFirewall = Invoke-ContaboApi -Method PUT -Path "/v1/firewalls/$($firewall.firewallId)" -AccessToken $accessToken -Body $updateBody
    Write-Host "Firewall rules updated for '$FirewallName'."

    if (-not $SkipAssign) {
        $latestFirewall = @($updatedFirewall.data)[0]
        $assignedInstances = @()
        if ($latestFirewall.instances) {
            $assignedInstances = @($latestFirewall.instances)
        }

        if ($assignedInstances.Count -gt 0) {
            Write-Host "Firewall is already assigned to:"
            $assignedInstances | Select-Object instanceId, displayName, name | Format-Table
        }
        else {
            $instancesResponse = Invoke-ContaboApi -Method GET -Path "/v1/compute/instances?size=100" -AccessToken $accessToken
            $instances = @($instancesResponse.data)

            if ($instances.Count -eq 0) {
                Write-Host "No VPS/VDS instances were returned by the API. Rules were updated, assignment skipped."
            }
            elseif ($instances.Count -eq 1) {
                $instance = $instances[0]
                Invoke-ContaboApi -Method POST -Path "/v1/firewalls/$($firewall.firewallId)/instances/$($instance.instanceId)" -AccessToken $accessToken | Out-Null
                Write-Host "Assigned firewall '$FirewallName' to instance $($instance.instanceId) $($instance.displayName)."
            }
            else {
                Write-Host ""
                Write-Host "Multiple VPS/VDS instances found. Choose the one to protect:"
                $instances | Select-Object instanceId, displayName, name, productId | Format-Table
                $instanceId = Read-Host "Enter instanceId to assign firewall, or press Enter to skip assignment"
                if (-not [string]::IsNullOrWhiteSpace($instanceId)) {
                    Invoke-ContaboApi -Method POST -Path "/v1/firewalls/$($firewall.firewallId)/instances/$instanceId" -AccessToken $accessToken | Out-Null
                    Write-Host "Assigned firewall '$FirewallName' to instance $instanceId."
                }
                else {
                    Write-Host "Assignment skipped. SSH rule is still saved in the firewall."
                }
            }
        }
    }

    Write-Host ""
    Write-Host "Done. SSH was handled before any firewall assignment."
}
finally {
    $clientSecret = $null
    $apiPassword = $null
    $accessToken = $null
}
