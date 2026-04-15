# Stage P — DNS Setup Guide (Beginner-Friendly)

**Scoped to:** `docs/` — DNS configuration guide for TradersApp production deployment

**Last Updated:** 2026-04-16
**Domain Owner:** FXGUNIT
**Domain:** `traders.app`

---

## Problem Statement

The following subdomains currently return `NXDOMAIN` (DNS lookup failure):

| Subdomain               | Expected Service       | Status Before Fix |
| ---------------------- | ---------------------- | ---------------- |
| `bff.traders.app`      | Railway BFF service    | NXDOMAIN         |
| `api.traders.app`      | Railway ML Engine API  | NXDOMAIN         |
| `staging.traders.app`  | Vercel staging deploy | NXDOMAIN         |
| `traders.app`          | Vercel frontend        | Resolves (redirects to `https://stocks.news/`) |

This guide walks you through creating the correct DNS records so every subdomain points to the right hosting provider.

---

## Architecture Overview

```
traders.app
├── CNAME → Vercel frontend
│
├── bff.traders.app
│   └── A record → Railway BFF public IP
│
├── api.traders.app
│   └── A record → Railway ML Engine public IP
│
└── staging.traders.app
    └── CNAME → Vercel staging deployment URL
```

---

## Step 1 — Gather Your Railway Public IPs

Before touching DNS, collect the public IPs of your Railway services.

1. Log in to the **Railway dashboard**: https://railway.app
2. Open your **TradersApp** project
3. For each service below, repeat steps 4–7:

   - **BFF service** (Node.js API)
   - **ML Engine service** (Python FastAPI)

4. Click the service name in the left panel
5. Click the **Settings** tab (gear icon)
6. Scroll to **Networking**
7. Copy the **Public Networking IP** — it looks like `123.45.67.890`

   > **Screenshot description:** Railway dashboard showing a service named "bff" with a grey IP address chip labelled "Public Networking IP: 123.45.67.890" in the Networking section of Settings.

**Record these IPs now.** You will need them in Step 3.

---

## Step 2 — Find Your Vercel Deployment URLs

### For the Production Frontend

1. Log in to the **Vercel dashboard**: https://vercel.com
2. Select your **frontend project** (the React app)
3. Click **Settings** (top navigation)
4. Click **Domains** in the left sidebar
5. Confirm `traders.app` is listed here — if not, you will add it in Step 4

### For the Staging Deployment

1. In the same project, click **Deployments** (top navigation)
2. Find the **latest staging deployment** (often labelled "Ready" with a green dot)
3. Click into it
4. Copy the **deployment URL** — it looks like:
   `traders-app-xxxxx.vercel.app`

   > **Screenshot description:** Vercel Deployments page showing a deployment with status "Ready", a green dot, and the URL `traders-app-xxxxx.vercel.app` highlighted in the top-right corner of the deployment card.

---

## Step 3 — Identify Your DNS Registrar

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

> **Important:** The root domain (`traders.app`) cannot use a CNAME. You must use an **A record** pointing to Vercel's IP addresses, OR an **ALIAS record** (Cloudflare) / **ANAME record** (others) pointing to Vercel's deployment.

**Cloudflare users:**
- Type: **A**
- Name: `@` (or `traders.app`)
- Content: `76.76.21.21`
- Proxy status: **DNS only** (grey cloud) — do NOT proxy through Cloudflare for the root; let Vercel handle HTTPS.

**Namecheap / GoDaddy / Google Domains users:**
- Type: **A**
- Name: `@`
- Content: `76.76.21.21`
- TTL: `Automatic` or `3600`

> **Screenshot description:** DNS record form showing Type: A, Name: @, Content: 76.76.21.21, TTL: Automatic, Proxy status: DNS only (grey cloud).

### 4B — `www.traders.app` — WWW Subdomain

- Type: **CNAME**
- Name: `www`
- Content: `cname.vercel-dns.com`
- Proxy status: **DNS only** (grey cloud)

### 4C — `bff.traders.app` — BFF Service

- Type: **A**
- Name: `bff`
- Content: `[YOUR_RAILWAY_BFF_PUBLIC_IP]` (from Step 1, e.g. `123.45.67.890`)
- TTL: `Automatic` or `3600`

### 4D — `api.traders.app` — ML Engine API

- Type: **A**
- Name: `api`
- Content: `[YOUR_RAILWAY_ML_ENGINE_PUBLIC_IP]` (from Step 1)
- TTL: `Automatic` or `3600`

### 4E — `staging.traders.app` — Staging Frontend

- Type: **CNAME**
- Name: `staging`
- Content: `[YOUR_VERCEL_STAGING_URL]` (from Step 2, e.g. `traders-app-xxxxx.vercel.app`)
- Proxy status: **DNS only** (grey cloud)

---

## Step 5 — Add traders.app to Vercel (If Not Already Done)

1. In the Vercel dashboard, go to your frontend project → **Settings** → **Domains**
2. In the ** Domains** text field, type `traders.app`
3. Click **Add**
4. Vercel will show you the verification record to add at your registrar — it will be an **A record** or **CNAME** (usually `@ → 76.76.21.21` as shown in Step 4A)
5. Go back to your registrar and add that record
6. Return to Vercel and click **Check** to verify

   > **Screenshot description:** Vercel Domains settings page with a modal reading "Add custom domain — traders.app" and showing the DNS record to add: Type A, Name @, Value 76.76.21.21, with a green "Check" button.

**For staging.traders.app:**
1. In the same Domains settings page, click **Add**
2. Type `staging.traders.app`
3. Click **Add**
4. Add the CNAME record shown (Step 4E) at your registrar
5. Click **Check** in Vercel

---

## Step 6 — Wait for DNS Propagation

DNS changes can take **5 minutes to 48 hours** to spread globally, though it is usually within 15–30 minutes.

### Option A — Google Toolbox Dig (Recommended)

1. Open: **https://toolbox.googleapps.com/apps/dig/**
2. In the **DNS Lookup** tab:
   - Leave **Server** blank (use system resolver)
   - **Type:** Select `A` or `CNAME` as appropriate
   - **Host:** Enter your subdomain (e.g. `bff.traders.app`)
3. Click **Lookup**

**Expected results:**

| Subdomain             | Expected Answer                  |
| --------------------- | ---------------------------------|
| `traders.app`         | `76.76.21.21`                    |
| `www.traders.app`     | `cname.vercel-dns.com`           |
| `bff.traders.app`     | `[YOUR_RAILWAY_BFF_IP]`          |
| `api.traders.app`     | `[YOUR_RAILWAY_ML_IP]`           |
| `staging.traders.app` | `traders-app-xxxxx.vercel.app`  |

> **Screenshot description:** Google Dig tool showing a successful A record lookup for `bff.traders.app` returning the correct Railway IP, with a green "Success" banner.

### Option B — Command Line Dig

Open a terminal (PowerShell, Git Bash, or macOS Terminal):

```bash
# Test each subdomain
dig +short bff.traders.app A
dig +short api.traders.app A
dig +short staging.traders.app CNAME
dig +short traders.app A

# If dig is not available, use nslookup
nslookup bff.traders.app
nslookup api.traders.app
```

### Option C — Browser Verification

After waiting ~15 minutes, open each URL in your browser:

- `https://traders.app` — should load the TradersApp frontend
- `https://bff.traders.app/health` — should return a JSON health response
- `https://api.traders.app/health` — should return ML Engine health response
- `https://staging.traders.app` — should load the staging frontend

> If any subdomain still returns NXDOMAIN after 1 hour, double-check the DNS record was saved correctly at your registrar. A common mistake is adding a trailing dot to the CNAME content, or selecting the wrong record type.

---

## Step 7 — Fix traders.app Redirect (If Needed)

If `traders.app` currently redirects to `https://stocks.news/`, this means the old deployment is still active or the domain is misconfigured in Vercel.

1. In Vercel, go to your project → **Settings** → **Domains**
2. Confirm `traders.app` shows as **Valid** with a green checkmark
3. Click on the domain and check that the **Redirect** field is empty or points to your main deployment
4. If the old redirect persists, run a fresh deployment:

   ```bash
   vercel --prod
   ```

---

## Record Summary Table

| Subdomain               | Type | Content                                   | Proxy Status   |
| ---------------------- | ---- | ----------------------------------------- | -------------- |
| `traders.app`          | A    | `76.76.21.21`                             | DNS only       |
| `www.traders.app`      | CNAME| `cname.vercel-dns.com`                    | DNS only       |
| `bff.traders.app`      | A    | `[Railway BFF IP]`                        | DNS only       |
| `api.traders.app`      | A    | `[Railway ML Engine IP]`                  | DNS only       |
| `staging.traders.app`  | CNAME| `[Vercel Staging URL]`                    | DNS only       |

---

## Registrar-Specific Notes

### Cloudflare

- Always use the **grey cloud (DNS only)** for API and BFF subdomains. **Do NOT proxy through Cloudflare** for Railway services — Railway handles its own TLS certificates and Cloudflare proxying can cause SSL errors.
- For `traders.app`, create an **A record** with the grey cloud.
- Cloudflare supports **ALIAS records** for the apex — use this instead of A record if you prefer pointing to a CNAME target.

### Namecheap

1. Go to **Dashboard** → **Domain List** → click **Manage** next to `traders.app`
2. Click the **Advanced DNS** tab
3. Add records using the table above
4. Namecheap requires **no trailing dot** in CNAME content (unlike BIND format)

### GoDaddy

1. Go to **My Products** → **DNS** next to `traders.app`
2. Click **Add** to add each record
3. GoDaddy sometimes caches aggressively — set TTL to `3600` (1 hour) and wait 30 min

### Google Domains

1. Go to **Domains** → `traders.app` → **DNS** → **Manage custom records**
2. Add each record
3. Google Domains supports **Synthetic records** for apex aliasing — use this if available

---

## CNAME Alternative — Using Railway Public URLs Directly

If you cannot get a static IP from Railway (or it changes), Railway provides a public URL per deployment:

1. In Railway dashboard → your service → **Settings** → **Networking**
2. Copy the **Public URL** — it looks like:
   `bff.up.railway.app` or `ml-engine-xxxx.railway.app`

   > **Screenshot description:** Railway service settings showing a blue public URL chip reading "Public URL: bff.up.railway.app" with a copy button.

3. Instead of an A record, create a **CNAME** pointing to that URL:

   | Subdomain        | Type   | Content               |
   | --------------- | ------ | --------------------- |
   | `bff.traders.app`  | CNAME  | `bff.up.railway.app`     |
   | `api.traders.app`  | CNAME  | `ml-engine.up.railway.app` |

   > **Note:** Most registrars allow CNAMEs on subdomains only, not the apex. Use the A record method for `traders.app` itself.

> **Caveat:** Railway public URLs can change when a service is redeployed. If the service gets a new URL, update the CNAME accordingly. For production, prefer the static IP method (A records) to avoid this.

---

## Troubleshooting

| Symptom                               | Cause                                    | Fix                                                   |
| ------------------------------------ | ---------------------------------------- | ---------------------------------------------------- |
| `NXDOMAIN` persists after 1 hour    | Record saved incorrectly or not saved    | Re-check the record at your registrar                |
| `dig` returns wrong IP               | Old cached value from resolver           | Use `dig +short @8.8.8.8 bff.traders.app` to query Google's resolver directly |
| HTTPS certificate error on BFF       | Railway service TLS misconfigured        | In Railway service Settings → Networking, enable "Generate TLS Certificate" |
| Cloudflare SSL error (525)           | Cloudflare is proxying HTTPS to Railway  | Set Cloudflare proxy to **DNS only** (grey cloud)   |
| `traders.app` still redirects        | Old Vercel redirect config still active  | Redeploy: `vercel --prod` to push fresh config       |
| Staging CNAME not resolving          | Vercel staging URL entered with `https://` | Enter only the hostname: `traders-app-xxxx.vercel.app` |

---

## After DNS Is Working — Next Steps

Once all subdomains resolve correctly:

1. **Verify TLS certificates** — visit each URL with `https://` and confirm the padlock icon
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
4. **Update Vercel environment variables** if needed (e.g., `VITE_API_BASE_URL=https://bff.traders.app`)
5. Proceed to the next Stage P checklist item.

---

*This guide is part of the Stage P Production Activation documentation. For Railway infrastructure questions, see the Railway docs at https://docs.railway.app. For Vercel domain configuration, see https://vercel.com/docs/concepts/projects/custom-domains.*
