#!/usr/bin/env python3
"""
Stage P Setup Wizard — TradersApp Production Activation
=======================================================
Guides you through every manual step needed to close P02–P15.
Run from TradersApp root directory.

Usage:
  python scripts/setup_stage_p.py

Steps this wizard covers:
  1. Railway: Login + collect 6 service/environment IDs
  2. Vercel:  Collect org ID + project ID + token
  3. Alert channels: Discord / Slack / PagerDuty webhook URLs
  4. Infisical: Collect service account token
  5. DNS:      Guide for registrar DNS records
  6. GitHub:   Push all secrets + variables in one shot
"""

import os, sys, getpass, json, subprocess, re

REPO = "FXGUNIT/TradersApp"
GH = "gh"

def run(cmd, capture=True, input_text=None):
    """Run shell command, return stdout or (stdout, stderr, rc)."""
    print(f"  > {cmd}")
    kwargs = {"shell": True}
    if capture:
        kwargs["capture_output"] = True
        kwargs["text"] = True
    if input_text:
        kwargs["input"] = input_text
    result = subprocess.run(cmd, **kwargs)
    if capture:
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    return result.returncode

def gh_api(endpoint, method="GET", body=None):
    """Call GitHub API, return parsed JSON."""
    cmd = f"{GH} api {endpoint}"
    if method != "GET":
        cmd += f" -X {method}"
    if body:
        cmd += f" -f {body}" if isinstance(body, dict) else f" -d '{body}'"
    out, err, rc = run(cmd)
    if rc != 0:
        raise RuntimeError(f"gh api failed: {err}")
    return json.loads(out) if out else {}

def gh_run(cmd):
    """Run gh command without unpacking."""
    out, _, rc = run(cmd)
    return out, rc

def gh_secret_set(name, value):
    """Set a GitHub Actions secret via gh CLI."""
    cmd = f'echo "{value}" | {GH} secret set {name} --repo {REPO}'
    out, err, rc = run(cmd)
    if rc == 0:
        print(f"  ✓ {name} set")
        return True
    print(f"  ✗ {name} FAILED: {err[:120]}")
    return False

def gh_var_set(name, value):
    """Set a GitHub Actions variable via gh CLI."""
    cmd = f'{GH} api repos/{REPO}/actions/variables --method POST -f name="{name}" -f value="{value}"'
    out, err, rc = run(cmd)
    if rc == 0:
        print(f"  ✓ {name} (var) set")
        return True
    # Try update if already exists
    cmd2 = f'{GH} api repos/{REPO}/actions/variables/{name} --method PATCH -f value="{value}"'
    out2, err2, rc2 = run(cmd2)
    if rc2 == 0:
        print(f"  ✓ {name} (var) updated")
        return True
    print(f"  ✗ {name} (var) FAILED: {err2[:120]}")
    return False

def ask(label, required=True, default=None, secret=False):
    """Prompt user for a value."""
    opts = f" [{default}]" if default else ""
    prompt = f"  {label}{opts}: "
    while True:
        if secret:
            val = getpass.getpass(prompt)
        else:
            val = input(prompt).strip()
        if required and not val:
            if default:
                val = default
            else:
                print("  (required)")
                continue
        return val

def ask_bool(label, default="n"):
    """Yes/no question."""
    yn = input(f"  {label} (y/N): ").strip().lower()
    if not yn and default:
        yn = default
    return yn == "y"

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def step(num, title):
    print(f"\n{'─'*50}")
    print(f"STEP {num}: {title}")
    print('─'*50)

# ═══════════════════════════════════════════════════════════════
# VERIFY GH AUTH
# ═══════════════════════════════════════════════════════════════
section("1 — VERIFY GITHUB AUTH")
out, err, rc = run(f"{GH} auth status 2>&1")
print(out)
if "Logged in to github.com account" not in out:
    print("ERROR: Not logged into GitHub. Run: gh auth login")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════════
# CHECK CURRENT STATE
# ═══════════════════════════════════════════════════════════════
section("2 — CURRENT STAGE P STATUS")
out, _ = gh_run(f"{GH} api repos/{REPO}/actions/secrets --paginate")
secrets = json.loads(out).get("secrets", []) if out else []
existing_secrets = {s["name"] for s in secrets}
print(f"  Existing secrets: {sorted(existing_secrets)}")

out, _ = gh_run(f"{GH} api repos/{REPO}/actions/variables --paginate")
variables = json.loads(out).get("variables", []) if out else []
existing_vars = {v["name"] for v in variables}
print(f"  Existing variables: {sorted(existing_vars)}")

NEEDED_SECRETS = {
    "DISCORD_WEBHOOK_URL": "Discord webhook URL for alert routing",
    "INFISICAL_TOKEN":      "Infisical service account token (Settings → Service Tokens)",
    "PAGERDUTY_ROUTING_KEY":"PagerDuty Events API v2 routing key",
    "RAILWAY_TOKEN":        "Railway auth token (railway login --browser)",
    "SLACK_WEBHOOK_URL":    "Slack incoming webhook URL for alerts",
    "VERCEL_ORG_ID":        "Vercel org/team ID (vercel teams ls)",
    "VERCEL_PROJECT_ID":    "Vercel frontend project ID (vercel projects)",
    "VERCEL_TOKEN":         "Vercel deploy token",
}
NEEDED_VARS = {
    "RAILWAY_PROD_BFF_SERVICE_ID":  "Railway prod BFF service ID",
    "RAILWAY_PROD_ENV_ID":           "Railway prod environment ID",
    "RAILWAY_PROD_ML_SERVICE_ID":    "Railway prod ML Engine service ID",
    "RAILWAY_STAGING_BFF_SERVICE_ID":"Railway staging BFF service ID",
    "RAILWAY_STAGING_ENV_ID":        "Railway staging environment ID",
    "RAILWAY_STAGING_ML_SERVICE_ID": "Railway staging ML Engine service ID",
}
ALREADY_DONE_VARS = {"BFF_URL","FRONTEND_URL","K6_BASE_URL","MLFLOW_TRACKING_URI","ML_ENGINE_URL","MODEL_FRESHNESS_MAX_DAYS","PROMETHEUS_URL"}

# ═══════════════════════════════════════════════════════════════
# STEP 1 — RAILWAY LOGIN + IDs
# ═══════════════════════════════════════════════════════════════
step(1, "RAILWAY — Login + collect 6 IDs")

print("""
Railway setup — two parts:

PART A: LOGIN (if not done already)
  1. Open a NEW terminal tab
  2. Run: railway login --browser
  3. Authorize in the browser window that opens
  4. Come back here and press Enter
""")
input("  Press Enter when Railway login is done in another terminal...")

# Check Railway login
out, err, rc = run("railway whoami 2>&1")
if "not logged" in out.lower() or rc != 0:
    print("  ✗ Railway not logged in. Run 'railway login --browser' in another terminal first.")
    railway_token = ask("Railway token (if you have one)", required=False, default="")
    if railway_token:
        # Try setting token directly
        run(f'echo "{railway_token}" | railway init --token 2>&1')
else:
    print(f"  ✓ Railway logged in: {out}")

print("""
PART B: COLLECT 6 IDs FROM RAILWAY DASHBOARD
Open https://railway.app and for EACH service below:
  1. Go to your project → service → Settings
  2. Copy the "Service ID" (starts with, e.g., a1b2c3...)
  3. Also copy the "Environment ID" from the Environment settings

For each ID below, paste it when prompted. Copy exactly — no extra spaces.
""")

railway_ids = {}
for var in sorted(NEEDED_VARS.keys()):
    desc = NEEDED_VARS[var]
    val = ask(f"{var}\n  ({desc})", required=False, default="")
    railway_ids[var] = val

# ═══════════════════════════════════════════════════════════════
# STEP 2 — VERCEL IDs + TOKEN
# ═══════════════════════════════════════════════════════════════
step(2, "VERCEL — Collect org/project ID and deploy token")

print("""
Vercel setup — open https://vercel.com/dashboard

TO FIND VERCEL_ORG_ID:
  1. Go to Settings → Teams (or click your team name)
  2. The URL will look like: vercel.com/teams/TEAM-NAME/view
  3. Your org ID is the team ID from: vercel.com/account?orgId=XXXXXXXXXXXXX
     (Check browser DevTools → Application → Cookies → vrl_org_id)
  OR run this in a new terminal: vercel teams ls
     Team ID = the id column (e.g. team_xxxxxxxxxxxxx)
""")

vercel_org_id = ask("VERCEL_ORG_ID (team ID from Vercel dashboard)", required=False, default="")
vercel_project_id = ask("VERCEL_PROJECT_ID (frontend project ID)", required=False, default="")

print("""
TO FIND VERCEL_TOKEN:
  1. Go to https://vercel.com/account/tokens
  2. Click "Create New Token"
  3. Name it "GitHub Actions Deploy" — Token scope: Full Account
  4. Copy the token immediately (shown only once)
""")
vercel_token = ask("VERCEL_TOKEN", required=False, secret=True, default="")

# ═══════════════════════════════════════════════════════════════
# STEP 3 — ALERT CHANNELS
# ═══════════════════════════════════════════════════════════════
step(3, "ALERT CHANNELS — Discord / Slack / PagerDuty webhooks")

print("""
For each channel you want alerts on, get the webhook URL:

DISCORD:
  1. In Discord, go to Server Settings → Integrations → Webhooks
  2. Create webhook → name it "TradersApp Alerts" → copy URL
  Format: https://discord.com/api/webhooks/XXXX/YYYY

SLACK:
  1. Go to https://api.slack.com/messaging/webhooks
  2. Create a new Slack App → Enable Incoming Webhooks
  3. Add New Webhook to Workspace → copy URL
  Format: https://hooks.slack.com/services/XXXXX/YYYYY/ZZZZZ

PAGERDUTY:
  1. Go to https://your-account.pagerduty.com → Services → Add Service
  2. Create integration: "Events API v2"
  3. Copy the "Integration Key" (not the webhook URL)
  Format: just the key like: a1b2c3d4-e5f6-7890-abcd-ef1234567890
""")

discord_webhook = ask("DISCORD_WEBHOOK_URL (or leave blank to skip)", required=False, default="")
slack_webhook   = ask("SLACK_WEBHOOK_URL (or leave blank to skip)", required=False, default="")
pagerduty_key   = ask("PAGERDUTY_ROUTING_KEY (or leave blank to skip)", required=False, default="")

# ═══════════════════════════════════════════════════════════════
# STEP 4 — INFISICAL
# ═══════════════════════════════════════════════════════════════
step(4, "INFISICAL — Service account token")

print("""
Get your Infisical service token:
  1. Log into https://app.infisical.com
  2. Go to Settings → Service Tokens
  3. Create a new token: name it "GitHub Actions", scope: all environments
  4. Copy the token immediately (shown only once)
  Format: st_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
""")
infisical_token = ask("INFISICAL_TOKEN", required=False, secret=True, default="")

# ═══════════════════════════════════════════════════════════════
# STEP 5 — DNS RECORDS
# ═══════════════════════════════════════════════════════════════
step(5, "DNS SETUP — Domain registrar guide")

print("""
╔═══════════════════════════════════════════════════════════╗
║              DNS RECORDS TO CREATE                        ║
║  Log into your domain registrar (traders.app domain)      ║
║  and add these DNS records:                                ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  FOR BFF SERVICE:                                          ║
║    Type: A     Name: bff        Value: [Railway BFF IP]   ║
║    Type: AAAA  Name: bff        Value: [Railway BFF IPv6] ║
║                                                           ║
║  FOR ML ENGINE SERVICE:                                    ║
║    Type: A     Name: api        Value: [Railway ML IP]    ║
║    Type: AAAA  Name: api        Value: [Railway ML IPv6]  ║
║                                                           ║
║  FOR STAGING:                                              ║
║    Type: A     Name: staging    Value: [Railway staging]  ║
║                                                           ║
║  NOTE: Get the actual IP from Railway dashboard:           ║
║        Railway → Project → Service → Settings → Networking║
║        Look for "Public Networking → IPv4" address         ║
║                                                           ║
║  ALTERNATIVE: Use CNAME pointing to Railway deployment URL  ║
║    Name: bff    → CNAME → [railway-bff-xxxx.up.railway.app]║
║    Name: api    → CNAME → [railway-ml-xxxx.up.railway.app] ║
║    Name: staging → CNAME → [railway-staging-xxxx.up.railway.app]║
║                                                           ║
║  FOR TRADERS.APP ROOT DOMAIN (currently pointing to wrong app):║
║    Go to your Vercel dashboard → your frontend project     ║
║    → Settings → Domains → add traders.app                  ║
║    Vercel will give you the correct IP/CNAME to point to   ║
╚═══════════════════════════════════════════════════════════╝

After adding DNS records, use https://toolbox.googleapps.com/apps/dig/
to verify each record resolves correctly.

Press Enter when you have created all DNS records...
""")
input()

# ═══════════════════════════════════════════════════════════════
# STEP 6 — PUSH ALL SECRETS TO GITHUB
# ═══════════════════════════════════════════════════════════════
step(6, "PUSHING ALL SECRETS + VARIABLES TO GITHUB")

print("\nUploading to GitHub Actions secrets and variables...")

errors = []
successes = []

# Secrets
secrets_to_set = {
    "VERCEL_TOKEN": vercel_token,
    "VERCEL_ORG_ID": vercel_org_id,
    "VERCEL_PROJECT_ID": vercel_project_id,
    "DISCORD_WEBHOOK_URL": discord_webhook,
    "SLACK_WEBHOOK_URL": slack_webhook,
    "PAGERDUTY_ROUTING_KEY": pagerduty_key,
    "INFISICAL_TOKEN": infisical_token,
    "RAILWAY_TOKEN": railway_ids.get("RAILWAY_TOKEN", ""),
}
# Filter empty ones
secrets_to_set = {k: v for k, v in secrets_to_set.items() if v}

for name, val in secrets_to_set.items():
    if name in existing_secrets:
        print(f"  → {name} already set, skipping (or update manually)")
        continue
    if gh_secret_set(name, val):
        successes.append(name)
    else:
        errors.append(name)

# Variables
vars_to_set = {k: v for k, v in railway_ids.items()}
for name in NEEDED_VARS:
    if name in ALREADY_DONE_VARS:
        continue
    val = vars_to_set.get(name, "")
    if not val:
        print(f"  ⚠ {name} — empty, skipping")
        continue
    if name in existing_vars:
        print(f"  → {name} already set, updating...")
    if gh_var_set(name, val):
        successes.append(name)
    else:
        errors.append(name)

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
section("SETUP COMPLETE — NEXT STEPS")
print(f"""
Secrets uploaded: {len(successes)}/{len(secrets_to_set) + len(vars_to_set)}
Errors: {errors}

NEXT ACTIONS:
  1. DNS propagation: Wait 5-30 min after creating DNS records
  2. Verify DNS: Run python scripts/stage_p_public_probe.py
  3. Trigger CI: Push any dummy commit or go to GitHub Actions
     and click "Run workflow" on the ci.yml workflow
  4. Watch for "Deploy Production" job to reach SUCCESS (not skipped)
  5. Then we close P02–P15 with validation steps
""")