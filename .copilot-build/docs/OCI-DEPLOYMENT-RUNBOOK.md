# TradersApp — Oracle Cloud Deployment Runbook

## Current Status (2026-04-10)

**Oracle Cloud Always Free VM deployed and running.**
- **VM:** tradersapp-oci | Oracle Linux 8.10 x86_64 | E2.1.Micro (1 OCPU, 1 GB RAM)
- **Public IP:** 80.225.216.5
- **Private IP:** 10.0.0.41
- **Instance ID:** ocid1.instance.oc1.ap-mumbai-1.anrg6ljrnris7pyc47ad4ljq23on3fbl43ee4nmgxlvsfjmwcs6pu5k6vgsq
- **SSH Key:** `~/.oci/tradersapp_ssh_key`

## What's Running

| Service | Status | Access |
|---------|--------|--------|
| Redis 7.2.4 | Running (PID 13299) | SSH only |
| TradersApp repo | Cloned | Via SSH |

## Redis Connection

- **Host:** `80.225.216.5`
- **Port:** `6379`
- **Auth:** `tradersapp_redis_pass`
- **Max Memory:** 768 MB (LRU eviction)
- **Version:** 7.2.4
- **Auto-start:** systemd service `tradersapp-redis.service` enabled

## How to Connect

### Via SSH tunnel (recommended for laptop use)
```bash
ssh -L 16379:127.0.0.1:6379 -i ~/.oci/tradersapp_ssh_key opc@80.225.216.5

# Then on your laptop, in another terminal:
redis-cli -p 16379 -a tradersapp_redis_pass
```

### Via SSH directly
```bash
ssh -i ~/.oci/tradersapp_ssh_key opc@80.225.216.5
redis-cli -a tradersapp_redis_pass PING
```

## Important Notes

### External Port Access (ISP Limitation)
- SSH (port 22): **accessible** from your laptop's network ✓
- Redis (port 6379): **blocked** by your laptop's ISP/at-home firewall ✗
- **Fix:** Create SSH tunnel (`ssh -L`) to access Redis from your laptop

### Why This Matters
Redis on the VM is the in-memory cache for your ML Engine. When your laptop's
BFF connects to Redis, it needs the Redis host address. Update your laptop's
`.env.local` or BFF environment:

```
REDIS_HOST=80.225.216.5   # or use SSH tunnel local address
REDIS_PORT=6379
REDIS_PASS=tradersapp_redis_pass
```

If your ISP blocks port 6379, set up the SSH tunnel above and use:
```
REDIS_HOST=127.0.0.1
REDIS_PORT=16379
```

## System Status
```
ssh -i ~/.oci/tradersapp_ssh_key opc@80.225.216.5 "free -h && uptime && systemctl status tradersapp-redis | head -6"
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/oci/redis-install.sh` | Download Redis binary and install (1GB RAM safe) |
| `scripts/oci/redis-build.sh` | Build Redis from source with Oracle agents stopped |
| `scripts/oci/redis-status.sh` | Check VM and Redis status |
| `scripts/oci/cloud-init-minimal.sh` | Cloud-init user data for new E2.1.Micro VMs |

## Upgrading to Ampere A1 (4 OCPU, 24 GB)

Ampere A1.Flex (Always Free — 4 OCPU, 24 GB RAM) is periodically available.
When Mumbai region has capacity, you can resize:

1. Terminate E2.1.Micro (save the subnet/security list)
2. Launch A1.Flex with the same subnet in the same AD
3. Run `scripts/oci/redis-install.sh` on the new VM
4. Docker Compose stack will then run with ML Engine + BFF + Frontend + MLflow

```python
# Launch command for Ampere A1.Flex (when capacity available)
launch_req = oci.core.models.LaunchInstanceDetails(
    compartment_id="<tenancy-ocid>",
    availability_domain="KTQz:AP-MUMBAI-1-AD-1",
    source_details=oci.core.models.InstanceSourceViaImageDetails(
        image_id="ocid1.image.oc1.ap-mumbai-1.aaaaaaaautknb2ulmj2kxpr6u47yl5pg6waylkie6azowejnplvcvkbxwixq"
    ),
    shape="VM.Standard.A1.Flex",
    subnet_id="ocid1.subnet.oc1.ap-mumbai-1.aaaaaaaa7il7h7u2iwcjd3xzus6f46do5435pole5agkyn5emj4aj5l25zva",
    shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(
        ocpus=1.0, memory_in_gbs=6.0
    ),
)
```

## Cost Guardrails
- Budget alert: $1/month with $0.01 threshold ✓
- E2.1.Micro: Always Free (no bill risk) ✓
- A1.Flex: Always Free only if within 4 OCPU/24 GB limits ✓
