# Stage P (P14) — Cost Guardrails Guide

**Stage:** P14 — Production Hardening: Cost Guardrails
**Updated:** 2026-04-16
**Owner:** FXGUNIT

---

## Overview

This document covers spend alerts, resource caps, and budget guardrails for every managed platform in the TradersApp topology. Setting these up **before** going live prevents surprise bills. All limits are checked monthly by `scripts/stage_p_cost_check.sh`.

---

## 1. Vercel — Frontend (`src/`)

Vercel hosts the React frontend and serves static assets.

### 1.1 Access Billing Settings

1. Log in to [vercel.com](https://vercel.com)
2. Navigate to **Dashboard → Settings → Billing**
3. Click **Spending Limits**

### 1.2 Set Spend Thresholds

| Threshold | Alert Type | Action |
|-----------|-----------|--------|
| `$0`      | Email alert | Immediate notification on any spend |
| `$10`     | Email alert | Warn when approaching free tier |
| `$25`     | Hard cap + block | Stop deployments if exceeded |

**Steps:**
1. Under **Spending Limits**, click **Add Limit**
2. Set **Monthly limit** to `25` USD
3. Enable **Alert at 10 USD**
4. Enable **Alert at 0 USD** (zero-dollar alert catches any unexpected charge)
5. Toggle **Block deployment when exceeded** to `ON`
6. Add your email under **Recipients**

> **Tip:** Vercel's zero-dollar alert sends an email the moment any charge occurs — useful for catching unexpected overages immediately.

### 1.3 Free Tier Limits

| Resource | Limit |
|----------|-------|
| Bandwidth | 100 GB / month |
| Deployments | 100 / day |
| Serverless function execution | 100,000 hrs / month |
| Build minutes | 6,000 / month |

Monitor at: **Dashboard → Settings → Usage**

### 1.4 Hard Cap Behavior

When the monthly spend cap is reached:
- New deployments are **blocked**
- Existing deployments continue serving
- An email is sent automatically
- To override: temporarily raise the cap or upgrade to a paid plan

### 1.5 Enforcing via Vercel API

```bash
# Set spending limit via Vercel API
curl -X PATCH https://api.vercel.com/v1/billing/spending-limit \
  -H "Authorization: Bearer $VERCEL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 25, "warnAt": 10, "blockAt": 25}'
```

Store `VERCEL_API_TOKEN` in Infisical — never hardcode it.

---

## 2. Railway — BFF + ML Engine (`bff/`, `ml-engine/`)

Railway hosts the Node.js BFF (port 8788) and the Python ML Engine (port 8001).

### 2.1 Access Usage & Budget Settings

1. Log in to [railway.app](https://railway.app)
2. Select your **Project** (e.g., `tradersapp-bff`, `tradersapp-ml`)
3. Navigate to **Usage → Budget Alerts**

### 2.2 Set Budget Alerts

| Threshold | Type | Action |
|-----------|------|--------|
| `$0`      | Email alert | Any charge |
| `$3`      | Email alert | 60% of free credit used |
| `$5`      | Hard cap | Stop billing (Always-Free limit) |

**Steps:**
1. Click **Add Budget Alert**
2. Set **Amount** to `5.00` USD (Always-Free credit)
3. Enable **Email notification at 60%** (≈ `$3.00`)
4. Enable **Email notification at 0%** for immediate alerts
5. Click **Save**

### 2.3 Always-Free Plan Limits

| Resource | Limit |
|----------|-------|
| Monthly credit | `$5` / month |
| Trial period | 500 hours after trial ends |
| Active projects | Unlimited (within credit) |

### 2.4 Check Current Usage via CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Check usage for the current project
railway usage

# Check usage for a specific project
railway usage --projectId <PROJECT_ID>
```

Expected output:
```
Project: tradersapp-bff
Period: 2026-04-01 → 2026-04-30
-----------------------------------------
Compute:     $2.34  ████████░░░░░░░░░░░░  $5.00
Database:    $0.00  ░░░░░░░░░░░░░░░░░░░  $5.00
Outbound BW: $0.12  ░░░░░░░░░░░░░░░░░░░  $5.00
-----------------------------------------
Total:       $2.46  █████████░░░░░░░░░░  $5.00
```

### 2.5 Set Resource Limits per Service

Railway does not support per-service hard resource caps, but you can optimize via:

**a) Scale to zero (idle timeout):**
- Railway auto-scales to zero after 15 minutes of inactivity on Hobby plan
- For ML Engine, keep minimum 1 replica if latency is critical

**b) Set NixOS/ Nix config resource hints in `railway.json`:**

```json
// bff/railway.json
{
  "build": {
    "nixConfig": null
  },
  "deploy": {
    "numReplicas": 1,
    "autoscaling": {
      "enabled": false
    }
  }
}
```

```json
// ml-engine/railway.json
{
  "build": {
    "nixConfig": "nixpkgs.python311"
  },
  "deploy": {
    "numReplicas": 1,
    "autoscaling": {
      "enabled": true,
      "minReplicas": 1,
      "maxReplicas": 2,
      "metrics": [
        {"type": "CPU", "target": 70}
      ]
    }
  }
}
```

**c) Monitor ML Engine memory:**
- ML Engine can use significant RAM during inference
- Set a Railway alert at **3.5 USD** to catch runaway memory before it hits the $5 cap
- Add `RAILWAY_MEMORY_LIMIT=2048` (MB) in Railway environment variables

### 2.6 Railway API for Alerts

```bash
# Get current project usage
curl "https://backboard.railway.app/api/v1/usage" \
  -H "Authorization: Bearer $RAILWAY_TOKEN"

# Set budget alert via Railway API
curl -X POST "https://backboard.railway.app/api/v1/budget-alerts" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "<ID>", "amount": 5.0, "notifyAt": [0, 3.0]}'
```

---

## 3. Infisical — Secrets Management

Infisical is used to store all API keys, tokens, and credentials for the TradersApp stack.

### 3.1 Free Tier Limits

| Resource | Limit |
|----------|-------|
| Secrets | 25 total |
| Projects | 3 |
| Environments | 3 per project (Development, Staging, Production) |
| Members | 1 (solo) |
| Audit logs | 7 days |

### 3.2 Upgrade Triggers

Monitor at: **Infisical Dashboard → Settings → Usage**

**Hard triggers (upgrade immediately):**

| Condition | Action |
|-----------|--------|
| Secrets count ≥ 23 | Plan upgrade — 2 slots remain |
| Projects ≥ 3 | Cannot create new project without upgrade |
| Environments pushing secrets > 25 | Risk of secrets being dropped |

### 3.3 Staying Within Free Tier

```bash
# Count current secrets across all projects
# Via Infisical CLI
infisical secrets list --projectId <ID> | wc -l

# Quick audit: check if any project is approaching 25 secrets
infisical secrets list --projectId <ID> --env production
```

**Retention rules:**
- Never store secrets you don't actively use
- Delete old/stale credentials quarterly
- Consolidate multiple small secrets into a JSON blob if semantically related (but prefer flat structure for readability)
- Use **Infisical Dynamic Secrets** for short-lived tokens instead of storing long-lived API keys

### 3.4 Upgrade Path

If limits are approached:

1. **Free → Starter** (~$5/month): 100 secrets, unlimited projects
2. **Starter → Team** (~$20/month): Unlimited secrets, RBAC, audit logs

---

## 4. Oracle Cloud Infrastructure — k3s Production

Oracle Cloud Always-Free resources host the k3s production cluster for Stage P+.

### 4.1 Always-Free Limits

| Resource | Always-Free Limit |
|----------|-------------------|
| vCPU (AMD) | 4 cores |
| RAM | 24 GB |
| Block Storage | 200 GB |
| Object Storage | 20 GB |
| Outbound transfer | 10 TB / month |
| Load Balancer | 1 × 10 Mbps |

### 4.2 Set Billing Alerts in Oracle Cloud Console

1. Log in to [cloud.oracle.com](https://cloud.oracle.com)
2. Navigate to **Billing → Cost Management → Cost Analysis**
3. Click **Budgets → Create Budget**
4. Configure:

| Field | Value |
|-------|-------|
| Budget name | `tradersapp-prod-monthly` |
| Compartment | `ManagedCompartmentforPaaS` |
| Monthly budget | `$0` (alert on any spend) |
| Alert threshold | `80%` → `$0` = alert immediately |
| Alert recipients | Your email |

**Alternative — Cost Alerts (no budget needed):**
1. **Billing → Cost Management → Cost Alerts**
2. Create alert: **"Alert when estimated cost > $0"**
3. This catches Always-Free exhaustion or unexpected paid resources

### 4.3 Monitor Usage via OCI CLI

```bash
# Install OCI CLI (if not already)
bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"

# Configure (one-time)
oci setup config

# Check current billing (estimated cost)
oci usageapi schedule-collection --region us-ashburn-1

# Get cost breakdown
oci usageapi request --region us-ashburn-1 \
  --scope '{"type": "AD", "ad": "ad1"}' \
  --queryType "COST" \
  --dateRange '{"startDate": "2026-04-01", "endDate": "2026-04-30"}'
```

### 4.4 Oracle Cloud Free Tier Exhaustion Behavior

When Always-Free limits are exhausted:
- **No automatic charges** — Oracle does not auto-charge
- **Services switch to paid** if you accept the upgrade
- **Block the upgrade:** Oracle Cloud → Settings → Billing → Deselect "Allow Pay as You Go"
- Services may **pause** (AMP clusters can hibernate) — this is expected

### 4.5 k3s Resource Guards

On the k3s nodes, set namespace resource quotas:

```yaml
# k8s/resource-quota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tradersapp-quota
  namespace: tradersapp-prod
spec:
  hard:
    requests.cpu: "2"
    requests.memory: "8Gi"
    limits.cpu: "4"
    limits.memory: "24Gi"
    persistentvolumeclaims: "10"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: tradersapp-limits
  namespace: tradersapp-prod
spec:
  limits:
  - type: Container
    default:
      cpu: 500m
      memory: 512Mi
    defaultRequest:
      cpu: 200m
      memory: 256Mi
    max:
      cpu: "2"
      memory: "8Gi"
    min:
      cpu: 50m
      memory: 64Mi
```

Apply with:
```bash
kubectl apply -f k8s/resource-quota.yaml
```

---

## 5. Consolidated Alert Summary Table

| Platform | Alert 1 | Alert 2 | Hard Cap | CLI Check Command |
|----------|---------|---------|----------|-------------------|
| **Vercel** | `$0` (email) | `$10` (email) | `$25` (block deploy) | `vercel billing` |
| **Railway** | `$0` (email) | `$3` (email) | `$5` (stop) | `railway usage` |
| **Infisical** | 23 secrets | 3 projects | N/A (read-only) | `infisical secrets list` |
| **Oracle Cloud** | `$0` (any cost) | 80% of limit | N/A (no auto-charge) | `oci usageapi request` |

---

## 6. Monthly Cost Review Checklist

Run before every billing cycle close (last 3 days of month):

- [ ] Run `scripts/stage_p_cost_check.sh --alert`
- [ ] Check Vercel usage in dashboard — verify no deployments exceeded limits
- [ ] Check Railway usage — confirm ML Engine inference time is within $5 credit
- [ ] Check Oracle Cloud billing — confirm Always-Free resources not exceeded
- [ ] Check Infisical secret count — stay ≤ 23/25
- [ ] Review any unexpected charges in all platform billing pages
- [ ] Rotate any stale secrets before the count becomes a blocker

---

## 7. Escalation Path

| Condition | Response |
|-----------|----------|
| Any platform shows > 80% usage | Run `scripts/stage_p_cost_check.sh --alert`, review immediately |
| Railway hits $5 cap | ML Engine pauses; manually restart after billing cycle reset |
| Vercel blocked | Raise cap temporarily; investigate which route caused spike |
| Oracle Cloud Always-Free exhausted | Confirm no auto-upgrade was accepted; review paid resources |
| Infisical at 24/25 secrets | Upgrade to Starter plan before the month ends |
| Unexpected charge > $0 | Dispute immediately via platform billing portal |

---

*Last reviewed: 2026-04-16*
