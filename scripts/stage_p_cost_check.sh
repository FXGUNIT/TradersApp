#!/usr/bin/env bash
# =============================================================================
# stage_p_cost_check.sh
# TradersApp Stage P14 — Cost Guardrails Check
#
# Checks spend and usage across all TradersApp platforms:
#   - Vercel  (Frontend)
#   - Railway (BFF + ML Engine)
#   - Oracle Cloud (k3s production)
#
# Usage:
#   ./stage_p_cost_check.sh            # dry-run, print summary table
#   ./stage_p_cost_check.sh --alert    # send alert if any limit > 80%
#   ./stage_p_cost_check.sh --json     # output machine-readable JSON
# =============================================================================

set -euo pipefail

ALERT_MODE=false
JSON_MODE=false

# ── Parse flags ──────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --alert) ALERT_MODE=true; shift ;;
    --json)  JSON_MODE=true;  shift ;;
    --help)
      echo "Usage: $0 [--alert] [--json]"
      echo "  --alert  Send alert (print warning) if any platform > 80% of limit"
      echo "  --json   Output machine-readable JSON instead of markdown table"
      exit 0
      ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

# ── Colour codes ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Colour

# ── Helpers ───────────────────────────────────────────────────────────────────
timestamp() { date '+%Y-%m-%d %T %Z'; }

vercel_check() {
  # Returns: spend_usd, limit_usd, pct
  local token="${VERCEL_API_TOKEN:-}"
  if [[ -z "$token" ]]; then
    echo "0.00|0|unknown"
    return
  fi

  # Vercel Billing API — current billing period spend
  local resp
  resp=$(curl -s --max-time 10 \
    -H "Authorization: Bearer $token" \
    "https://api.vercel.com/v1/billing/current" 2>/dev/null || echo "")

  local spend limit
  spend=$(echo "$resp" | grep -o '"spend":[0-9.]*' | head -1 | cut -d: -f2)
  limit=$(echo "$resp" | grep -o '"limit":[0-9.]*' | head -1 | cut -d: -f2)

  spend="${spend:-0.00}"
  limit="${limit:-25}"

  local pct
  pct=$(awk "BEGIN { printf \"%.0f\", ($spend/$limit)*100 }")

  echo "${spend}|${limit}|${pct}"
}

railway_check() {
  # Returns: spend_usd, limit_usd, pct
  local token="${RAILWAY_TOKEN:-}"
  if [[ -z "$token" ]]; then
    # Fallback to CLI
    local out
    out=$(railway usage 2>/dev/null || echo "")
    local spend
    spend=$(echo "$out" | grep -i "total" | awk '{print $NF}' | tr -d '$' | head -1)
    spend="${spend:-unknown}"
    echo "${spend}|5|unknown"
    return
  fi

  local resp
  resp=$(curl -s --max-time 10 \
    -H "Authorization: Bearer $token" \
    "https://backboard.railway.app/api/v1/usage" 2>/dev/null || echo "")

  local spend
  spend=$(echo "$resp" | grep -o '"totalCost":[0-9.]*' | head -1 | cut -d: -f2)
  spend="${spend:-0.00}"
  local limit=5.00
  local pct
  pct=$(awk "BEGIN { printf \"%.0f\", ($spend/$limit)*100 }")

  echo "${spend}|${limit}|${pct}"
}

oci_check() {
  # Returns: spend_usd, limit_usd, pct
  # Oracle Always-Free has no monetary cost; we check resource utilisation
  # instead: CPU cores, RAM (GB), storage (GB)
  local ocid="${OCI_CONFIG_PROFILE:-DEFAULT}"

  local cpu_used ram_used storage_used
  cpu_used=$(oci compute instance list \
    --compartment-id "${OCI_COMPARTMENT_OCID:-}" \
    --limit 1 --query "length(data) || 0" \
    --raw-output 2>/dev/null || echo "?")

  # Fallback: just report "Always-Free" with a notional $0 spend
  # Oracle Cloud Always-Free does not bill; track resource % instead
  local always_free_cpu=4
  local always_free_ram=24
  local always_free_storage=200

  # Attempt to get actual shape resource usage via OCI CLI
  local actual_cpu actual_ram
  actual_cpu=$(oci compute instance list \
    --compartment-id "${OCI_COMPARTMENT_OCID:-}" \
    --query "data[*].{shape:shape}" \
    --raw-output 2>/dev/null | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "1")

  local cpu_pct
  cpu_pct=$(awk "BEGIN { printf \"%.0f\", ($actual_cpu/$always_free_cpu)*100 }")

  echo "0.00|Always-Free|${cpu_pct}"
}

infisical_check() {
  # Returns: secrets_count, max_secrets, pct
  local token="${INFISICAL_TOKEN:-}"
  if [[ -z "$token" ]]; then
    echo "unknown|25|unknown"
    return
  fi

  local resp
  resp=$(curl -s --max-time 10 \
    -H "Authorization: Bearer $token" \
    "https://api.infisical.com/v1/secrets/count" 2>/dev/null || echo "")

  local count
  count=$(echo "$resp" | grep -o '"count":[0-9]*' | head -1 | cut -d: -f2)
  count="${count:-unknown}"
  local max=25
  local pct
  pct=$(awk "BEGIN { printf \"%.0f\", ($count/$max)*100 }")

  echo "${count}|${max}|${pct}"
}

# ── Colour helpers ─────────────────────────────────────────────────────────────
pct_colour() {
  local p="$1"
  if   [[ "$p" == "unknown" ]]; then echo "$CYAN";
  elif (( p >= 90 ));               then echo "$RED";
  elif (( p >= 80 ));               then echo "$YELLOW";
  else                                  echo "$GREEN";
  fi
}

pct_label() {
  local p="$1"
  if   [[ "$p" == "unknown" ]]; then echo "UNKNOWN";
  elif (( p >= 90 ));               then echo "CRITICAL";
  elif (( p >= 80 ));               then echo "WARNING";
  else                                  echo "OK";
  fi
}

# ── Main logic ────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  TradersApp — Stage P14 Cost Guardrails Check"
echo "  $(timestamp)"
echo "═══════════════════════════════════════════════════════"
echo ""

# Gather results
read -r VERCEL_SPEND VERCEL_LIMIT VERCEL_PCT < <(echo "$(vercel_check)")
read -r RAILWAY_SPEND RAILWAY_LIMIT RAILWAY_PCT < <(echo "$(railway_check)")
read -r OCI_SPEND OCI_LIMIT OCI_PCT < <(echo "$(oci_check)")
read -r INFISICAL_COUNT INFISICAL_MAX INFISICAL_PCT < <(echo "$(infisical_check)")

# ── Markdown table output ─────────────────────────────────────────────────────
print_markdown() {
  local v_colour v_label r_colour r_label i_colour i_label

  v_colour=$(pct_colour "$VERCEL_PCT"); v_label=$(pct_label "$VERCEL_PCT")
  r_colour=$(pct_colour "$RAILWAY_PCT"); r_label=$(pct_label "$RAILWAY_PCT")
  i_colour=$(pct_colour "$INFISICAL_PCT"); i_label=$(pct_label "$INFISICAL_PCT")

  echo "| Platform       | Current Spend | Limit     | Utilisation | Status      |"
  echo "|----------------|---------------|-----------|-------------|-------------|"
  printf "| **Vercel**     | %-11s | %-9s | %3s%% %-4s | ${v_colour}%s${NC} |\n" \
    "\$$VERCEL_SPEND" "\$$VERCEL_LIMIT" "$VERCEL_PCT" "" "$v_label"
  printf "| **Railway**    | %-11s | %-9s | %3s%% %-4s | ${r_colour}%s${NC} |\n" \
    "\$$RAILWAY_SPEND" "\$$RAILWAY_LIMIT" "$RAILWAY_PCT" "" "$r_label"
  printf "| **Oracle OCI** | %-11s | %-9s | %3s%% %-4s | ${CYAN}%s${NC} |\n" \
    "\$$OCI_SPEND" "$OCI_LIMIT" "$OCI_PCT" "" "ALWAYS-FREE"
  printf "| **Infisical**  | %-11s / 25 | 25        | %3s%% %-4s | ${i_colour}%s${NC} |\n" \
    "$INFISICAL_COUNT" "$INFISICAL_PCT" "" "$i_label"
  echo ""
}

# ── JSON output ───────────────────────────────────────────────────────────────
print_json() {
  cat <<EOF
{
  "timestamp": "$(timestamp)",
  "platforms": {
    "vercel": {
      "current_spend_usd": "$VERCEL_SPEND",
      "limit_usd": "$VERCEL_LIMIT",
      "utilisation_pct": "$VERCEL_PCT",
      "status": "$(pct_label "$VERCEL_PCT")"
    },
    "railway": {
      "current_spend_usd": "$RAILWAY_SPEND",
      "limit_usd": "$RAILWAY_LIMIT",
      "utilisation_pct": "$RAILWAY_PCT",
      "status": "$(pct_label "$RAILWAY_PCT")"
    },
    "oracle_oci": {
      "current_spend_usd": "$OCI_SPEND",
      "limit": "$OCI_LIMIT",
      "utilisation_pct": "$OCI_PCT",
      "status": "ALWAYS-FREE"
    },
    "infisical": {
      "secrets_count": "$INFISICAL_COUNT",
      "max_secrets": "$INFISICAL_MAX",
      "utilisation_pct": "$INFISICAL_PCT",
      "status": "$(pct_label "$INFISICAL_PCT")"
    }
  },
  "alert_triggered": $ALERT_MODE
}
EOF
}

# ── Alert output ──────────────────────────────────────────────────────────────
print_alert() {
  local alerts=()

  # Collect any platform > 80%
  for platform in "Vercel" "$VERCEL_PCT" \
                  "Railway" "$RAILWAY_PCT" \
                  "Infisical" "$INFISICAL_PCT"; do
    : # handled below
  done

  local alert_count=0
  local msg=""

  check_pct() {
    local label="$1"; shift
    local pct="$1"
    if [[ "$pct" != "unknown" ]] && (( pct >= 80 )); then
      alert_count=$((alert_count + 1))
      msg+="  [${pct}%] $label is at ${pct}% of limit — REVIEW IMMEDIATELY\n"
    fi
  }

  check_pct "Vercel"    "$VERCEL_PCT"
  check_pct "Railway"   "$RAILWAY_PCT"
  check_pct "Infisical" "$INFISICAL_PCT"

  if $ALERT_MODE; then
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "  COST ALERT REPORT — $(timestamp)"
    echo "═══════════════════════════════════════════════════════"
    print_markdown

    if (( alert_count > 0 )); then
      echo -e "ALERT: ${RED}$alert_count platform(s) exceed 80% utilisation:${NC}"
      echo -e "$msg"
      echo "Action required: Run this script with elevated access to investigate."
      echo "Vercel:  https://vercel.com/dashboard → Settings → Billing → Spending Limits"
      echo "Railway: https://railway.app/project → Usage → Budget Alerts"
      echo "Infisical: https://app.infisical.com → Settings → Usage"
      echo ""
      echo "Escalation: If Vercel/Railway hit hard cap, deployments/services may pause."
      exit 2
    else
      echo -e "${GREEN}All platforms within safe limits (< 80%).${NC}"
      echo ""
      exit 0
    fi
  fi
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
if $JSON_MODE; then
  print_json
else
  print_markdown
  print_alert
fi

exit 0
