$rule = Get-NetFirewallRule -DisplayName "k3s-api" -ErrorAction SilentlyContinue
if (-not $rule) {
    New-NetFirewallRule -DisplayName "k3s-api" -Direction Inbound -Protocol TCP -LocalPort 6443 -Action Allow -Enabled True | Out-Null
    Write-Host "Firewall rule created for port 6443"
} else {
    Write-Host "Rule already exists"
}
