#!/usr/bin/env python3
"""
Stage P Setup — TradersApp Production Activation
==================================================
Usage:
  python scripts/setup_stage_p.py --init   # Generate values template
  python scripts/setup_stage_p.py           # Push all values to GitHub

Edit scripts/STAGE_P_VALUES.json between --init and the push step.
"""

import os, sys, json, subprocess

REPO = "FXGUNIT/TradersApp"
GH = "gh"
VALUES_FILE = "scripts/STAGE_P_VALUES.json"

def run(cmd):
    print(f"  > {cmd}")
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return r.stdout.strip(), r.stderr.strip(), r.returncode

def gh_secret_set(name, value):
    cmd = f'echo "{value}" | {GH} secret set {name} --repo {REPO}'
    _, err, rc = run(cmd)
    print(f"  [OK] {name}" + (f": {err[:80]}" if rc != 0 else ""))
    return rc == 0

def gh_var_set(name, value):
    cmd = f'{GH} api repos/{REPO}/actions/variables -X POST -f name="{name}" -f value="{value}"'
    _, err, rc = run(cmd)
    if rc != 0:
        cmd = f'{GH} api repos/{REPO}/actions/variables/{name} -X PATCH -f value="{value}"'
        _, err2, rc2 = run(cmd)
        print(f"  [OK] {name} (var)" + (f": {err2[:80]}" if rc2 != 0 else ""))
        return rc2 == 0
    print(f"  ✓ {name} (var)")
    return True

def section(t):
    print(f"\n{'='*55}\n  {t}\n{'='*55}")

def init_template():
    template = {
        "_comment": "Replace placeholder values with real ones. Secrets are masked in GitHub.",
        "secrets": {
            "DISCORD_WEBHOOK_URL": "https://discord.com/api/webhooks/YOUR/WEBHOOK/HERE",
            "INFISICAL_TOKEN": "st_your_infisical_service_token_here",
            "PAGERDUTY_ROUTING_KEY": "your_pagerduty_integration_key",
            "RAILWAY_TOKEN": "railway_auth_token_here",
            "SLACK_WEBHOOK_URL": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
            "VERCEL_ORG_ID": "team_xxxxxxxxxxxx",
            "VERCEL_PROJECT_ID": "prj_xxxxxxxxxxxx",
            "VERCEL_TOKEN": "vercel_deploy_token_here"
        },
        "variables": {
            "RAILWAY_PROD_BFF_SERVICE_ID": "",
            "RAILWAY_PROD_ENV_ID": "",
            "RAILWAY_PROD_ML_SERVICE_ID": "",
            "RAILWAY_STAGING_BFF_SERVICE_ID": "",
            "RAILWAY_STAGING_ENV_ID": "",
            "RAILWAY_STAGING_ML_SERVICE_ID": ""
        }
    }
    with open(VALUES_FILE, "w") as f:
        json.dump(template, f, indent=2)
    print(f"\n[OK] Template written to {VALUES_FILE}")
    print("  1. Edit that file with your actual values")
    print("  2. Then re-run: python scripts/setup_stage_p.py")

def push_all():
    if not os.path.exists(VALUES_FILE):
        print(f"ERROR: {VALUES_FILE} not found.")
        print("  Run: python scripts/setup_stage_p.py --init")
        sys.exit(1)

    out, err, rc = run(f"{GH} auth status 2>&1")
    if "Logged in to github.com account" not in out:
        print("ERROR: Not logged into GitHub.")
        sys.exit(1)

    with open(VALUES_FILE) as f:
        data = json.load(f)

    section("GITHUB SECRETS")
    s_ok = s_fail = 0
    for name, val in data.get("secrets", {}).items():
        if not val or "YOUR" in val or "_here" in val or "st_your" in val:
            print(f"  ⊘ {name} — placeholder, skipping")
            continue
        gh_secret_set(name, val) and (s_ok := s_ok + 1) or (s_fail := s_fail + 1)

    section("GITHUB VARIABLES (Railway IDs)")
    v_ok = v_fail = 0
    for name, val in data.get("variables", {}).items():
        if not val:
            print(f"  ⊘ {name} — empty, skipping")
            continue
        gh_var_set(name, val) and (v_ok := v_ok + 1) or (v_fail := v_fail + 1)

    section("DONE")
    print(f"  Secrets pushed: {s_ok} ok, {s_fail} failed")
    print(f"  Variables pushed: {v_ok} ok, {v_fail} failed")
    print(f"\n  Next: run the public probe, trigger CI, then continue Stage P tasks.")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--init":
        init_template()
    else:
        push_all()