# Stage P — DNS Setup Guide (Beginner-Friendly)

**Scoped to:** `docs/` — DNS configuration guide for TradersApp production deployment

**Last Updated:** 2026-04-19
**Status:** OCI k3s — Railway/Vercel deprecated. Full guide in `docs/TODO_MASTER_LIST.md`

---

## Problem Statement

The following subdomains currently return `NXDOMAIN` or point to the wrong edge:

| Subdomain               | Expected Service       | Status Before Fix |
| ---------------------- | ---------------------- | ---------------- |
| `bff.traders.app`      | OCI k3s BFF service   | NXDOMAIN / wrong edge |
| `api.traders.app`      | OCI k3s ML Engine API  | NXDOMAIN         |
| `traders.app`          | OCI k3s frontend       | Resolves to wrong edge (Vercel/AWS redirect to `stocks.news`) |

This guide walks you through updating DNS records to point all subdomains at the OCI Always Free k3s node at `144.24.112.249`, after the ingress controller is deployed (P11).

---

## Architecture Overview

```
traders.app
├── A → 144.24.112.249 (OCI k3s node)
│
├── bff.traders.app
│   └── A → 144.24.112.249 → ingress-nginx → bff service
│
└── api.traders.app
    └── A → 144.24.112.249 → ingress-nginx → ml-engine service
```

**Before P11/P12 completes:** These DNS changes should NOT be made. The OCI node must have an ingress controller running and the core services must be healthy first. See `docs/TODO_MASTER_LIST.md` — P09 must complete before P11/P12.

> `staging.traders.app` is no longer part of the production path — Vercel staging has been deprecated.

---

## Step 1 — Confirm OCI k3s Node Readiness

Before updating DNS, verify the OCI node is ready:

1. SSH to the OCI node: `ssh opc@144.24.112.249`
2. Check k3s is running: `sudo systemctl status k3s`
3. Check core services are running:
   ```bash
   kubectl --kubeconfig /tmp/k3s_external.yaml get pods -n tradersapp
   ```
   All pods should be `Running` before DNS is changed.
4. Check ingress-nginx is deployed:
   ```bash
   kubectl --kubeconfig /tmp/k3s_external.yaml get svc -n ingress-nginx
   ```
   Ingress controller must be running before DNS cutover.

**OCI k3s node IP is always `144.24.112.249`** — no need to gather public IPs from a dashboard.

---

## Step 2 — Identify Your DNS Registrar

Your DNS records live at whichever registrar you bought `traders.app` from. Common options:

| Registrar       | Dashboard URL                   |
| --------------- | ------------------------------- |
| Cloudflare     | https://dash.cloudflare.com     |
| Namecheap      | https://ap.www.namecheap.com    |
| GoDaddy        | https://dns.godaddy.com         |
| Google Domains | https://domains.google         |
| Porkbun        | https://porkbun.com             |
| Route53 (AWS)  | https://console.aws.amazon.com/route53 |

> **Tip:** If you do not know your registrar, open a terminal and run:
>
> ```bash
> whois traders.app
> ```
> Look for the line `Registrar URL:` — that tells you where to go.

---

## Step 4 — Add All DNS Records

Navigate to your DNS management panel (Cloudflare, Namecheap, etc.) and add each record below.

### 4A — `traders.app` — Root Domain (Apex Record)

> **Important:** The root domain (`traders.app`) cannot use a CNAME. You must use an **A record** pointing to the OCI k3s node, OR an **ALIAS record** (Cloudflare) / **ANAME record** (others).

**Cloudflare users:**
- Type: **A**
- Name: `@` (or `traders.app`)
- Content: `144.24.112.249`
- Proxy status: **Proxied** (orange cloud) — Cloudflare will proxy HTTPS to the OCI ingress

**Namecheap / GoDaddy / Google Domains users:**
- Type: **A**
- Name: `@`
- Content: `144.24.112.249`
- TTL: `Automatic` or `3600`

### 4B — `www.traders.app` — WWW Subdomain

- Type: **A**
- Name: `www`
- Content: `144.24.112.249`
- Proxy status: **Proxied** (Cloudflare)

### 4C — `bff.traders.app` — BFF Service

- Type: **A**
- Name: `bff`
- Content: `144.24.112.249`
- TTL: `Automatic` or `3600`

### 4D — `api.traders.app` — ML Engine API

- Type: **A**
- Name: `api`
- Content: `144.24.112.249`
- TTL: `Automatic` or `3600`

---

## Step 5 — Wait for DNS Propagation (OCI Ingress)

DNS changes can take **5 minutes to 48 hours** to spread globally, though it is usually within 15–30 minutes.

### Option A — Google Toolbox Dig (Recommended)

1. Open: **https://toolbox.googleapps.com/apps/dig/**
2. In the **DNS Lookup** tab:
   - Leave **Server** blank (use system resolver)
   - **Type:** Select `A` or `CNAME` as appropriate
   - **Host:** Enter your subdomain (e.g. `bff.traders.app`)
3. Click **Lookup**

**Expected results:**

| Subdomain             | Expected Answer     |
| --------------------- | -------------------|
| `traders.app`         | `144.24.112.249`    |
| `www.traders.app`     | `144.24.112.249`    |
| `bff.traders.app`     | `144.24.112.249`    |
| `api.traders.app`     | `144.24.112.249`    |

### Option B — Command Line Dig

```bash
dig +short bff.traders.app A
dig +short api.traders.app A
dig +short traders.app A

# Query Google's resolver directly to bypass stale cache
dig +short @8.8.8.8 bff.traders.app A
```

### Option C — Browser Verification

After ~15 minutes, open each URL in your browser:

- `https://traders.app` — should load the TradersApp frontend
- `https://bff.traders.app/health` — should return a JSON health response
- `https://api.traders.app/health` — should return ML Engine health response

---

## Record Summary Table

| Subdomain               | Type | Content           | Proxy Status |
| ---------------------- | ---- | ---------------- | ----------- |
| `traders.app`          | A    | `144.24.112.249` | Proxied     |
| `www.traders.app`      | A    | `144.24.112.249` | Proxied     |
| `bff.traders.app`      | A    | `144.24.112.249` | Proxied     |
| `api.traders.app`      | A    | `144.24.112.249` | Proxied     |

> `staging.traders.app` has been deprecated — remove if it exists.

---

## Registrar-Specific Notes

### Cloudflare
- Use the **orange cloud (Proxied)** for all subdomains pointing to OCI k3s. Cloudflare will proxy HTTPS through to the OCI ingress controller.
- After ingress-nginx + cert-manager are deployed (P11), TLS certificates are managed automatically via Let's Encrypt.

### Namecheap
1. Go to **Dashboard** → **Domain List** → click **Manage** next to `traders.app`
2. Click the **Advanced DNS** tab
3. Add the A records from the table above
4. Namecheap requires **no trailing dot** in A record content

### GoDaddy
1. Go to **My Products** → **DNS** next to `traders.app`
2. Click **Add** to add each A record
3. Set TTL to `3600` (1 hour)

### Google Domains
1. Go to **Domains** → `traders.app` → **DNS** → **Manage custom records**
2. Add each A record

---

## Troubleshooting

| Symptom                               | Cause                                    | Fix                                                   |
| ------------------------------------ | ---------------------------------------- | ---------------------------------------------------- |
| `NXDOMAIN` persists after 1 hour    | Record saved incorrectly or not saved    | Re-check the record at your registrar                |
| `dig` returns wrong IP               | Old cached value from resolver           | Use `dig +short @8.8.8.8 bff.traders.app` to query Google's resolver directly |
| HTTPS certificate error on BFF       | cert-manager not yet deployed (P11 pending) | TLS certs are provisioned by cert-manager on k3s after P11 |
| Cloudflare SSL error (525)           | Cloudflare proxying HTTPS before ingress ready | Set proxy to **DNS only** (grey cloud) until P11 is complete |
| `traders.app` still redirects        | Old Vercel redirect still active         | Update DNS A record to `144.24.112.249` and wait for propagation |

---

## After DNS Is Working — Next Steps

Once all subdomains resolve to `144.24.112.249`:

1. **Verify TLS certificates** — visit each URL with `https://` and confirm the padlock icon (cert-manager handles this after P11)
2. **Test the BFF health endpoint:**
   ```bash
   curl https://bff.traders.app/health
   # Expected: {"ok":true,...}
   ```
3. **Test the ML Engine health endpoint:**
   ```bash
   curl https://api.traders.app/health
   # Expected: {"ok":true,...}
   ```
4. Proceed to the next Stage P checklist item in `docs/TODO_MASTER_LIST.md`.
