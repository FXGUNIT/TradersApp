#!/usr/bin/env bash
# stage_p_ci_trigger.sh — Verify secrets/variables then trigger ci.yml workflow dispatch
# Usage: ./stage_p_ci_trigger.sh [--dry-run]
# Exit codes: 0 = triggered, 1 = missing vars/secrets

set -euo pipefail

REPO="FXGUNIT/TradersApp"
WORKFLOW="ci.yml"
BRANCH="main"
DRY_RUN=false

# ── Parse flags ────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      echo "Usage: $0 [--dry-run]"
      echo "  --dry-run  Show what would happen without triggering anything"
      exit 0
      ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
jq_required() {
  if ! command -v jq &>/dev/null; then
    echo "ERROR: 'jq' is required but not installed." >&2
    exit 1
  fi
}

gh_authenticated() {
  gh auth status &>/dev/null
}

# Fetch a paginated JSON list from GitHub Actions API and extract name+value objects
fetch_actions_list() {
  local endpoint="$1"   # e.g. "secrets" or "variables"
  local page=1
  local per_page=100
  local all_items="[]"

  while true; do
    local response
    response=$(gh api --paginate \
      "/repos/${REPO}/actions/${endpoint}" \
      --param "per_page=${per_page}" \
      --param "page=${page}" \
      --jq "[.${endpoint}[] | {name: .name, value: .${endpoint}[]}]" 2>/dev/null || true)

    if [[ -z "$response" || "$response" == "[]" || "$response" == "null" ]]; then
      break
    fi

    all_items=$(echo "$all_items" "$response" | jq -s '.[0] + .[1]' 2>/dev/null || echo "$all_items")

    local count
    count=$(echo "$response" | jq length)
    if (( count < per_page )); then
      break
    fi
    ((page++))
  done

  echo "$all_items"
}

fetch_secrets() {
  gh api "repos/${REPO}/actions/secrets" --jq '.secrets | map({name: .name})'
}

fetch_variables() {
  gh api "repos/${REPO}/actions/variables" --jq '.variables | map({name: .name})'
}

check_list() {
  local label="$1"       # "secret" or "variable"
  local kind="$2"        # "secrets" or "variables" (API path segment)
  shift 2
  local required=("$@")

  local missing=()

  # Fetch all existing names
  local existing_json
  existing_json=$(fetch_"${kind}")

  for item in "${required[@]}"; do
    local found
    found=$(echo "$existing_json" | jq --arg name "$item" '[.[] | select(.name == $name)] | length')
    if [[ "$found" != "1" ]]; then
      missing+=("$item")
    fi
  done

  if ((${#missing[@]} > 0)); then
    echo "Missing ${label}s:"
    for m in "${missing[@]}"; do
      echo "  ✗ ${m}"
    done
    return 1
  else
    echo "All required ${label}s are set:"
    for item in "${required[@]}"; do
      echo "  ✓ ${item}"
    done
    return 0
  fi
}

# ── Pre-checks ────────────────────────────────────────────────────────────────
echo "=== Stage P CI Trigger — pre-flight checks ==="
echo ""

jq_required

if ! gh_authenticated; then
  echo "ERROR: Not authenticated with GitHub CLI." >&2
  echo "Run: gh auth login" >&2
  exit 1
fi

echo "Authenticated as: $(gh api user --jq '.login')"
echo "Repository: ${REPO}"
echo ""

# ── Required secrets ───────────────────────────────────────────────────────────
REQUIRED_SECRETS=(
  DISCORD_WEBHOOK_URL
  INFISICAL_TOKEN
  PAGERDUTY_ROUTING_KEY
  RAILWAY_TOKEN
  SLACK_WEBHOOK_URL
  VERCEL_ORG_ID
  VERCEL_PROJECT_ID
  VERCEL_TOKEN
)

# ── Required variables ────────────────────────────────────────────────────────
REQUIRED_VARIABLES=(
  # Already verified in prior stages
  BFF_URL
  FRONTEND_URL
  ML_ENGINE_URL
  K6_BASE_URL
  MLFLOW_TRACKING_URI
  MODEL_FRESHNESS_MAX_DAYS
  PROMETHEUS_URL
  # Stage-P additions
  RAILWAY_PROD_BFF_SERVICE_ID
  RAILWAY_PROD_ENV_ID
  RAILWAY_PROD_ML_SERVICE_ID
  RAILWAY_STAGING_BFF_SERVICE_ID
  RAILWAY_STAGING_ENV_ID
  RAILWAY_STAGING_ML_SERVICE_ID
)

secrets_ok=true
variables_ok=true

echo "--- Checking Secrets ---"
if ! check_list "secret" "secrets" "${REQUIRED_SECRETS[@]}"; then
  secrets_ok=false
fi
echo ""

echo "--- Checking Variables ---"
if ! check_list "variable" "variables" "${REQUIRED_VARIABLES[@]}"; then
  variables_ok=false
fi
echo ""

# ── Report ────────────────────────────────────────────────────────────────────
if $secrets_ok && $variables_ok; then
  echo "=== All secrets and variables are set ==="
  echo ""
  if $DRY_RUN; then
    echo "[DRY RUN] Would trigger: gh workflow run ${WORKFLOW} --ref ${BRANCH}"
    exit 0
  else
    echo "Triggering workflow..."
    gh workflow run "${WORKFLOW}" --ref "${BRANCH}"
    echo ""
    echo "Workflow dispatched. Monitor at: https://github.com/${REPO}/actions/workflows/${WORKFLOW}"
    exit 0
  fi
else
  echo "=== ABORTED — missing secrets/variables ==="
  echo ""
  if ! $secrets_ok; then
    echo "Secrets check FAILED — set them in GitHub repo settings:"
    echo "  Settings → Secrets and variables → Actions → New repository secret"
    for m in "${REQUIRED_SECRETS[@]}"; do
      if [[ ! " ${REQUIRED_SECRETS[*]} " =~ " ${m} " ]] || ! echo "$(fetch_secrets)" | jq -e --arg n "$m" 'map(.name) | contains([$n])' &>/dev/null; then
        :
      fi
    done
  fi
  if ! $variables_ok; then
    echo "Variables check FAILED — set them in GitHub repo settings:"
    echo "  Settings → Secrets and variables → Actions → Variables → New variable"
  fi
  echo ""
  echo "Alternatively use 'gh' CLI:"
  echo "  gh secret set <NAME> --body '<value>'"
  echo "  gh variable set <NAME> --body '<value>'"
  exit 1
fi
