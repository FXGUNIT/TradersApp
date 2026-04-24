# Cloudflare Tunnel + Worker BFF Proxy

## What This Solves

Bug 1 (NET::ERR_CERT_COMMON_NAME_INVALID on user devices):
- Devices whose DNS resolves `tradergunit.pages.dev` → Contabo IP directly (bypassing Cloudflare)
- Browser sees Contabo's `*.sslip.io` self-signed cert — cert doesn't cover `*.pages.dev` → REJECTED
- All BFF fetch calls fail silently → News/AI shows "offline" permanently

Cloudflare Tunnel routes browser → Cloudflare edge (valid cert) → Contabo (private network, no cert needed by browser). Browser never sees Contabo cert.

## Architecture

```
Browser                          Contabo VPS
  │                                  │
  │ https://api.traders.app          │
  ▼                                  │
Cloudflare Edge  ←────  Cloudflare Tunnel (encrypted)  ←─── cloudflared daemon
  │
  └──── Worker (bff-worker/index.js)
            │ forward /ml/* /news/* etc.
            ▼
       Caddy port 8788 (BFF)
```

## Setup Steps

### Step 1 — Transfer domain to Cloudflare (one-time)

If `traders.app` is at GoDaddy/Namecheap:
1. Cloudflare Dashboard → Add Site → enter `traders.app`
2. Cloudflare gives nameservers: `cassandra.ns.cloudflare.com`, `vasilii.ns.cloudflare.com`
3. At your registrar: change nameservers to Cloudflare's pair
4. Cloudflare now controls DNS for `traders.app`

> **Skip Step 1** if `traders.app` is already on Cloudflare.

### Step 2 — Create Cloudflare Tunnel (once per VPS)

1. Cloudflare Zero Trust Dashboard → Networks → Tunnels → Create a Tunnel
2. Type: **Cloudflare Tunnel** (not Argo Tunnel)
3. Name: `tradersapp-contabo`
4. Save the **Tunnel Token** — treat like a password, add to Infisical

### Step 3 — Configure Tunnel Connector (on Contabo)

Add to `CONTABO_APP_ENV` or `.env.local` on the Contabo VPS:

```bash
CLOUDFLARED_TUNNEL_TOKEN=<your-tunnel-token>
TUNNEL_HOST=bff-internal   # matches TUNNEL_HOST_HEADER in bff-worker/index.js
```

Install cloudflared on Contabo:
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
cloudflared service install <your-tunnel-token>
```

Or run via Docker Compose (add to `deploy/contabo/docker-compose.yml`):
```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARED_TUNNEL_TOKEN}
    environment:
      TUNNEL_HOST: bff-internal
    network_mode: host
```

### Step 4 — Add DNS CNAME for api.traders.app

In Cloudflare Dashboard → `traders.app` → DNS:
- Type: CNAME
- Name: `api`
- Target: `<your-tunnel-id>.cfargotunnel.com`
- Proxy status: **Proxied** (orange cloud — ON)

### Step 5 — Deploy Worker

```bash
cd deploy/cloudflare-tunnel/bff-worker
npm install -g wrangler
wrangler auth  # login to Cloudflare
wrangler deploy
```

Or via CI (GitHub Actions — add to existing workflow):
```yaml
- name: Deploy BFF Proxy Worker
  uses: cloudflare/wrangler-action@v3
  with:
    api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    config_path: deploy/cloudflare-tunnel/bff-worker/wrangler.toml
    secret_ids: TUNNEL_TOKEN
```

Create `CLOUDFLARE_API_TOKEN` at: dash.cloudflare.com → Profile → API Tokens → Create Token → Edit zone `traders.app`.

### Step 6 — Update Pages Deploy Workflow

In `.github/workflows/deploy-pages-root.yml`, change `VITE_BFF_URL` to:
```yaml
VITE_BFF_URL: https://api.traders.app
```

And update `VITE_PROOF_BFF`:
```yaml
VITE_PROOF_BFF: https://api.traders.app/health
```

### Step 7 — Update Contabo CORS Allowlist

In `deploy/contabo/Caddyfile`, add to the BFF block or env-var block:
```
encode /ml/* /news/* /identity/* /terminal/* /onboarding/* /support/* /content/* /board-room/* /calendar/* /trade-calc/* /telegram/* /health /ai-status {
    header {
        Access-Control-Allow-Origin "https://tradergunit.pages.dev"
        Access-Control-Allow-Headers "Content-Type Authorization Idempotency-Key X-Request-ID x-tradersapp-install-id"
        # ... rest of headers
    }
    reverse_proxy localhost:8788
}
```

Alternatively add `https://api.traders.app` to `BFF_ALLOWED_ORIGINS` env var on Contabo.

### Step 8 — Verify

```bash
# Browser devtools should show requests to https://api.traders.app/ml/consensus
# (not https://bff.173.249.18.14.sslip.io/...)

# Direct check — Worker responds:
curl -sI https://api.traders.app/health
# Expect: HTTP/1.1 200 (Cloudflare proxy → Contabo BFF)

# No cert warnings:
curl -vk https://api.traders.app/health
# Expect: certificate is valid (Cloudflare-issued *.pages.dev or api.traders.app cert)
```

## Files

```
deploy/cloudflare-tunnel/
├── bff-worker/
│   ├── index.js       # Cloudflare Worker — proxies BFF API calls via tunnel
│   └── wrangler.toml  # Worker deployment config
└── SETUP.md           # This file
```

## Troubleshooting

**Worker returns 502:**
- Check cloudflared is running on Contabo: `systemctl status cloudflared` or `docker ps`
- Check Tunnel is active in Cloudflare dashboard (shows "healthy" connector)

**Tunnel won't connect:**
- `CLOUDFLARED_TUNNEL_TOKEN` may be wrong — regenerate from Cloudflare dashboard
- Contabo firewall may block port 7844 (tunnel data port) — open it

**api.traders.app returns 404:**
- DNS CNAME not proxied — check orange cloud is ON in Cloudflare DNS settings
- Worker not deployed to that route — check `wrangler.toml` route or zone binding
