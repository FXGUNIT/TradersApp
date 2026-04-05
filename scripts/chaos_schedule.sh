#!/usr/bin/env bash
# scripts/chaos_schedule.sh
# Runs chaos experiments against staging via GitHub Actions workflow_dispatch.
#
# Usage:
#   bash scripts/chaos_schedule.sh staging
#   bash scripts/chaos_schedule.sh production
#
# Prerequisites:
#   gh CLI authenticated: gh auth status
#   Workflow file: .github/workflows/chaos-nightly.yml
#   Repository: gunitsingh1994/TradersApp (or your fork)

set -euo pipefail

TARGET="${1:-staging}"
REPO="${GITHUB_REPO:-gunitsingh1994/TradersApp}"

echo "========================================"
echo "Chaos Engineering — Staging Runner"
echo "Target environment: $TARGET"
echo "Repository: $REPO"
echo "========================================"

# Verify gh CLI
if ! command -v gh &> /dev/null; then
  echo "ERROR: gh CLI not found. Install from: https://cli.github.com/"
  exit 1
fi

# Verify authenticated
if ! gh auth status &> /dev/null; then
  echo "ERROR: Not authenticated with gh. Run: gh auth login"
  exit 1
fi

# Trigger chaos-nightly workflow
echo "[*] Triggering chaos-nightly.yml workflow..."
RUN_URL=$(gh workflow run chaos-nightly.yml \
  --field environment="$TARGET" \
  --json url --jq '.url')

echo "[*] Chaos experiment triggered: $RUN_URL"

# Wait for completion (poll every 60s)
echo "[*] Monitoring experiment progress..."
while true; do
  STATUS=$(gh run list \
    --workflow=chaos-nightly.yml \
    --limit 1 \
    --json status,conclusion --jq '.[0] | "\(.status) \(.conclusion)"' \
    2>/dev/null || echo "in_progress null")

  STATUS_WORD=$(echo "$STATUS" | awk '{print $1}')
  CONCLUSION=$(echo "$STATUS" | awk '{print $2}')

  echo "  Status: $STATUS_WORD | Conclusion: $CONCLUSION"
  echo "  Run: $RUN_URL"

  if [ "$STATUS_WORD" = "completed" ]; then
    if [ "$CONCLUSION" = "success" ]; then
      echo "[✓] Chaos experiments PASSED"
    else
      echo "[✗] Chaos experiments FAILED (conclusion: $CONCLUSION)"
    fi
    break
  elif [ "$STATUS_WORD" = "cancelled" ]; then
    echo "[!] Chaos experiment was cancelled"
    break
  fi

  echo "  Sleeping 60s before next check..."
  sleep 60
done

echo "========================================"
echo "Run URL: $RUN_URL"
echo "========================================"
