# P25 — OVHcloud VPS-3 Deployment Plan
**Status:** READY TO EXECUTE
**Last Updated:** 2026-04-20
**Supersedes:** P09 Core Deployment

---

## Why OVHcloud VPS-3

| Provider | Spec | Monthly Cost | Availability |
|---|---|---|---|
| Oracle Ampere A1 | 4 OCPU / 24GB ARM | Free | Mumbai exhausted, no ETA |
| Oracle E2.1 (paid) | 1 OCPU / 8GB | ~$20+/month (unclear) | E2 shapes end-of-orderability |
| OVHcloud VPS-3 | **8 vCore / 24GB / 200GB NVMe** | **$19.97/month** | Guaranteed |

**Verdict:** OVHcloud VPS-3 is the best value at ~$20/month. 8 cores, 24GB RAM, NVMe storage. Three times the RAM, eight times the cores of Oracle E2.1 for the same price.

---

## Monthly Cost

| Item | Cost |
|---|---|
| OVHcloud VPS-3 | $19.97/month |
| Domain (optional, e.g. tradersapp.cloud) | ~$10-15/year |
| Total | **~$20/month** |

---

## Architecture

```
OVHcloud VPS-3 (VPS-3, 8 vCore / 24GB / 200GB NVMe)
│
├── Docker Engine
│   └── Docker Compose (tradersapp stack)
│       ├── nginx-reverse-proxy  :443 → routes to frontend/bff
│       ├── frontend             :80/:443 (static, no BFF URL needed at build)
│       ├── bff                  :8788 (Express API)
│       ├── ml-engine            :8001 (FastAPI ML)
│       ├── redis                :6379
│       └── analysis-service      :8082 (gRPC worker)
│
└── Cloudflare (free tier, DNS + Proxy)
    ├── DNS A record → VPS public IP
    └── SSL termination (edge certificate, auto-renew)
```

**Key design decisions:**
- Cloudflare Free handles SSL — no Let's Encrypt on the VPS, no port 80 needed
- Frontend builds with `VITE_BFF_URL=https://api.tradersapp.domain` at deploy time
- BFF connects to ML Engine via internal Docker network, not external
- No k3s overhead — Docker Compose is sufficient for 1 node

---

## Phase 1: OVHcloud Account & VPS Provisioning

### 1.1 Create OVHcloud Account
1. Go to [ovhcloud.com](https://www.ovhcloud.com)
2. Sign up — email + password only (no credit card required at signup)
3. Verify email

### 1.2 Order VPS-3
1. Select **VPS-3** from [ovhcloud.com/en/vps/](https://www.ovhcloud.com/en/vps/)
2. Choose region closest to target audience (e.g., `APAC - India/Singapore` if available, otherwise `Europe`)
3. OS: **Ubuntu 22.04 LTS** (x86_64)
4. SSH Key: Generate new Ed25519 key, paste public key during order
5. Billing: Monthly ($19.97) or hourly (switch to monthly after setup)
6. Complete order

### 1.3 Note VPS Details
After provisioning (5-15 minutes), OVHcloud sends:
- **Public IPv4 address**
- **Root password** (if no SSH key)
- VPS control panel URL

Save:
```
VPS_IP = <public IPv4>
SSH_KEY = ~/.ssh/ovh_vps_ed25519
```

---

## Phase 2: Initial Server Setup (Manual, One-Time)

### 2.1 SSH into VPS
```bash
ssh -i ~/.ssh/ovh_vps_ed25519 root@<VPS_IP>
```

### 2.2 Initial Hardening
```bash
# Create deploy user
adduser deploy
usermod -aG sudo deploy

# Disable root password login
sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd

# Setup UFW firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 443/tcp   # HTTPS
ufw allow 80/tcp    # HTTP (for Cloudflare challenges)
ufw enable
```

### 2.3 Install Docker
```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
systemctl enable docker
```

### 2.4 Install Docker Compose
```bash
mkdir -p /opt/bin
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /opt/bin/docker-compose
chmod +x /opt/bin/docker-compose
ln -sf /opt/bin/docker-compose /usr/local/bin/docker-compose
```

### 2.5 Create App Directory
```bash
mkdir -p /opt/tradersapp
chown deploy:deploy /opt/tradersapp
```

### 2.6 Add Deploy User SSH Access
```bash
# As root, add your public key to deploy user's authorized_keys
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
echo "<your-public-key>" >> /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

---

## Phase 3: Cloudflare DNS Setup

### 3.1 Create Cloudflare Account
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Add your domain (or use a free subdomain via [freedns.afraid.org](https://freedns.afraid.org) or similar)
3. Point NS records to Cloudflare nameservers

### 3.2 Add DNS Record
```
Type: A
Name: api          (or @ for root)
Content: <VPS_IP>
Proxy status: DNS Only (grey cloud) — change to Proxied (orange cloud) after SSL works
```

### 3.3 Get SSL Certificate
1. In Cloudflare SSL/TLS settings:
   - Mode: **Full (strict)** — but first set to **Flexible** during initial setup
   - After VPS SSL works: switch to Full
2. Edge certificate is automatically issued by Cloudflare

---

## Phase 4: Docker Compose Configuration (Production)

### 4.1 Create `docker-compose.ovh.yml`
Create `/opt/tradersapp/docker-compose.ovh.yml`:

```yaml
# TradersApp — OVHcloud VPS Production Stack
# Run: docker compose -f docker-compose.ovh.yml up -d

services:
  # ── Redis (ephemeral cache) ──────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: traders-redis
    restart: unless-stopped
    ports:
      - "127.0.0.1:6379:6379"  # Internal only
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── ML Engine ────────────────────────────────────────────────────────────
  ml-engine:
    build:
      context: .
      dockerfile: ml-engine/Dockerfile
    image: ghcr.io/fxgunit/ml-engine:latest
    container_name: traders-ml-engine
    restart: unless-stopped
    ports:
      - "127.0.0.1:8001:8001"   # Internal only
    environment:
      DB_PATH: /data/trading_data.db
      MODEL_STORE: /models/store
      REDIS_HOST: redis
      REDIS_PORT: 6379
      MLFLOW_TRACKING_URI: ""
      NODE_ENV: production
    volumes:
      - ml-data:/data
      - ml-models:/models
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  # ── Analysis Service (gRPC worker) ──────────────────────────────────────
  analysis-service:
    build:
      context: .
      dockerfile: bff/Dockerfile
    image: ghcr.io/fxgunit/analysis-service:latest
    container_name: traders-analysis-service
    command: ["node", "analysis-server.mjs"]
    restart: unless-stopped
    ports:
      - "127.0.0.1:8082:8082"   # Internal only
    environment:
      ML_ENGINE_URL: http://ml-engine:8001
      NODE_ENV: production
    depends_on:
      ml-engine:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8082/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

  # ── BFF (API Gateway) ───────────────────────────────────────────────────
  bff:
    build:
      context: .
      dockerfile: bff/Dockerfile
    image: ghcr.io/fxgunit/bff:latest
    container_name: traders-bff
    restart: unless-stopped
    ports:
      - "127.0.0.1:8788:8788"   # Internal only, nginx proxies
    environment:
      ML_ENGINE_URL: http://ml-engine:8001
      ML_ANALYSIS_TRANSPORT: grpc
      ML_ANALYSIS_GRPC_ADDR: analysis-service:8082
      REDIS_HOST: redis
      REDIS_PORT: 6379
      NODE_ENV: production
    depends_on:
      ml-engine:
        condition: service_healthy
      analysis-service:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8788/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

  # ── nginx Reverse Proxy ─────────────────────────────────────────────────
  nginx:
    image: nginx:1.29-alpine
    container_name: traders-nginx
    restart: unless-stopped
    ports:
      - "80:8080"
      - "443:8443"
    volumes:
      - ./nginx/production.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      bff:
        condition: service_healthy
      frontend:
        condition: service_started

  # ── Frontend ─────────────────────────────────────────────────────────────
  frontend:
    image: ghcr.io/fxgunit/frontend:latest
    container_name: traders-frontend
    restart: unless-stopped
    environment:
      VITE_BFF_URL: https://api.tradersapp.<domain>
    depends_on:
      - bff

volumes:
  redis-data:
  ml-data:
  ml-models:
```

### 4.2 Create nginx Production Config
Create `/opt/tradersapp/nginx/production.conf`:

```nginx
server {
    listen 8080;
    server_name api.tradersapp.<domain>;

    # Redirect HTTP → HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 8443 ssl;
    server_name api.tradersapp.<domain>;

    # SSL terminated at Cloudflare edge
    # Cloudflare injects CF-Connecting-IP header
    ssl_certificate /etc/ssl/certs/cloudflare-origin.pem;
    ssl_certificate_key /etc/ssl/private/cloudflare-origin.key;

    # ── BFF API ───────────────────────────────────────────────────────────
    location / {
        proxy_pass http://bff:8788;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # ── WebSocket ─────────────────────────────────────────────────────────
    location /ws {
        proxy_pass http://bff:8788;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_http_version 1.1;
        proxy_read_timeout 86400;
    }
}
```

### 4.3 Initial Deploy (Manual)
```bash
# As deploy user on VPS
cd /opt/tradersapp

# Clone repo
git clone https://github.com/fxgunit/TradersApp.git .
git checkout main

# Pull latest images from GHCR
docker compose -f docker-compose.ovh.yml pull

# Start stack
docker compose -f docker-compose.ovh.yml up -d

# Check status
docker compose -f docker-compose.ovh.yml ps
docker compose -f docker-compose.ovh.yml logs --tail=50
```

---

## Phase 5: GitHub Actions Deployment Pipeline

### 5.1 Generate Deploy SSH Key
```bash
# On local machine
ssh-keygen -t ed25519 -f ~/.ssh/tradersapp_deploy -N "" -C "tradersapp-github-actions"
cat ~/.ssh/tradersapp_deploy.pub   # Add to OVHcloud VPS: /home/deploy/.ssh/authorized_keys
```

### 5.2 Add GitHub Secrets
In GitHub repo: Settings → Secrets and variables → Actions

| Secret Name | Value |
|---|---|
| `OVH_VPS_HOST` | `<VPS public IP>` |
| `OVH_VPS_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | Full content of `~/.ssh/tradersapp_deploy` (private key) |
| `DOMAIN` | `api.tradersapp.<domain>` |

### 5.3 Add GitHub Variables
In GitHub repo: Settings → Variables → Actions

| Variable Name | Value |
|---|---|
| `DEPLOY_PATH` | `/opt/tradersapp` |

### 5.4 Create Workflow: `.github/workflows/deploy-ovh.yml`

```yaml
# ─────────────────────────────────────────────────────────────────────────────
# TradersApp — OVHcloud VPS Deployment
# Deploys TradersApp stack to OVHcloud VPS-3 via GitHub Actions.
# Runs on: push to main
# Required secrets: OVH_VPS_HOST, OVH_VPS_USER, DEPLOY_SSH_KEY, DOMAIN
# ─────────────────────────────────────────────────────────────────────────────

name: Deploy to OVHcloud

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      skip_build:
        description: "Skip Docker build, pull latest GHCR images"
        required: false
        default: "false"
        type: boolean

env:
  DEPLOY_PATH: /opt/tradersapp

jobs:
  deploy:
    name: Deploy to OVHcloud VPS
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.DEPLOY_SSH_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H ${{ secrets.OVH_VPS_HOST }} >> ~/.ssh/known_hosts 2>/dev/null

      - name: Wait for Docker to be ready
        run: |
          for i in {1..10}; do
            if ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no \
              ${{ secrets.OVH_VPS_USER }}@${{ secrets.OVH_VPS_HOST }} \
              "docker version > /dev/null 2>&1"; then
              echo "Docker ready"
              exit 0
            fi
            echo "Waiting for Docker... ($i/10)"
            sleep 15
          done
          echo "Docker not ready after 150s"
          exit 1

      - name: Build and push Docker images
        if: inputs.skip_build != 'true'
        run: |
          echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u FXGUNIT --password-stdin

          # Build BFF
          docker build -t ghcr.io/fxgunit/bff:latest \
            --build-arg BFF_ADMIN_PASS_HASH=${{ secrets.BFF_ADMIN_PASS_HASH }} \
            --build-arg MASTER_SALT=${{ secrets.MASTER_SALT }} \
            -f bff/Dockerfile .

          # Build ML Engine
          docker build -t ghcr.io/fxgunit/ml-engine:latest \
            -f ml-engine/Dockerfile .

          # Push images
          docker push ghcr.io/fxgunit/bff:latest
          docker push ghcr.io/fxgunit/ml-engine:latest

      - name: Pull latest images on VPS
        run: |
          ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no \
            ${{ secrets.OVH_VPS_USER }}@${{ secrets.OVH_VPS_HOST }} \
            << 'ENDSSH'
            set -e
            cd /opt/tradersapp

            # Pull latest images
            docker compose -f docker-compose.ovh.yml pull

            # Restart stack with new images
            docker compose -f docker-compose.ovh.yml up -d --remove-orphans

            # Wait for health
            sleep 10

            # Check health
            docker compose -f docker-compose.ovh.yml ps

            # Show recent logs
            docker compose -f docker-compose.ovh.yml logs --tail=30
            ENDSSH

      - name: Smoke test
        run: |
          sleep 5
          curl -f --max-time 10 \
            "https://${{ secrets.DOMAIN }}/health" \
            -o /dev/null -w "%{http_code}" \
            || echo "Health check failed — check logs above"
```

---

## Phase 6: Post-Deployment

### 6.1 Enable Cloudflare SSL (Full Strict)
1. Cloudflare dashboard → SSL/TLS
2. Mode: **Full (strict)**
3. Edge certificate auto-renews
4. Change DNS: Proxy status → **Proxied (orange cloud)**

### 6.2 Verify All Endpoints
```bash
# BFF health
curl https://api.tradersapp.<domain>/health

# ML Engine health
curl https://api.tradersapp.<domain>/ml/health

# Frontend
curl https://api.tradersapp.<domain>/
```

### 6.3 Setup Uptime Monitoring
1. Cloudflare Analytics → Monitoring (or use [uptimerobot.com](https://uptimerobot.com) free tier)
2. Add endpoints to monitor every 5 minutes
3. Alert on downtime

### 6.4 Backup Strategy
- OVHcloud VPS-3 includes **daily backup** (schedule in OVHcloud control panel)
- Critical data: scripts push to GitHub periodically
- Database: use Redis RDB snapshots + SQLite WAL mode

### 6.5 Idle Protection (OVHcloud)
OVHcloud does not have an idle termination policy like Oracle. The VPS stays on 24/7 as long as you pay the bill.

---

## Phase 7: Future Scaling Path

### Upgrade VPS
OVHcloud allows upgrading VPS in-place:
- VPS-3 → VPS-RISE (more RAM, same price band)
- No downtime migration

### Horizontal Scaling (when needed)
When VPS-3 is no longer enough:
1. Add a second VPS for ML Engine only
2. Route ML traffic to second VPS
3. Both on same private network via OVHcloud vRack

### Ampere A1 Migration (when Mumbai clears)
If Oracle Ampere A1 becomes available in Mumbai:
1. Migrate to Ampere A1 (4 OCPU / 24GB, free)
2. Cancel OVHcloud VPS
3. Zero cost long-term again

---

## Execution Checklist

### User Does (manual, one-time)
- [ ] Create OVHcloud account at [ovhcloud.com](https://www.ovhcloud.com)
- [ ] Order VPS-3 with Ubuntu 22.04, add SSH key
- [ ] Note VPS public IP address
- [ ] Create Cloudflare account, add domain
- [ ] Add `A api` DNS record pointing to VPS IP
- [ ] Generate deploy SSH key pair
- [ ] Add deploy public key to VPS `/home/deploy/.ssh/authorized_keys`
- [ ] Add GitHub Secrets (OVH_VPS_HOST, OVH_VPS_USER, DEPLOY_SSH_KEY, DOMAIN)
- [ ] Add GitHub Variable (DEPLOY_PATH: /opt/tradersapp)
- [ ] Add OVH_VPS_HOST to GitHub variable so workflow can reference it without leaking

### Claude Does (automated via GitHub Actions)
- [ ] Write `.github/workflows/deploy-ovh.yml`
- [ ] Write `/opt/tradersapp/docker-compose.ovh.yml`
- [ ] Write `/opt/tradersapp/nginx/production.conf`
- [ ] Write `/opt/tradersapp/.env.production`
- [ ] Configure firewall on VPS (UFW)
- [ ] Run initial deployment

---

## Cost Summary

| Item | Monthly | Notes |
|---|---|---|
| OVHcloud VPS-3 | $19.97 | 8 vCore / 24GB / 200GB NVMe |
| Cloudflare Free | $0 | DNS + SSL |
| Domain | ~$1 | Optional, ~$10-15/year |
| **Total** | **~$21/month** | |

---

## What This Plan Achieves

| Requirement | Solution |
|---|---|
| No laptop dependency | GitHub Actions handles everything after initial VPS setup |
| 24/7 always-on | OVHcloud VPS, no idle policy |
| No trial, no expiry | Paid but permanent, cancel anytime |
| Room to grow | 8 cores, 24GB RAM — 3x current needs |
| Future Ampere A1 path | OVHcloud is short-term bridge until Ampere clears |
| Zero-trust security | Cloudflare SSL + internal Docker networking |
| Automated deploys | Push to main → GitHub Actions → VPS updated |
