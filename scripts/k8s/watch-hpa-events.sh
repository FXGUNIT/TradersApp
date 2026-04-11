#!/usr/bin/env bash
# =============================================================================
# watch-hpa-events.sh — HPA scaling event watcher for TradersApp
# =============================================================================
# Watches Kubernetes events for HPA ScalingReplicaSet reasons in the
# tradersapp namespace, formats them as Slack messages, and sends to a
# Slack webhook.
#
# Usage:
#   SLACK_HPA_WEBHOOK_URL="https://hooks.slack.com/..." \
#   K8S_NAMESPACE="tradersapp" \
#   ./watch-hpa-events.sh
#
# Kubernetes deployment: run as a DaemonSet or sidecar, or schedule via
# a CronJob that wakes every 5 minutes and tails recent events.
# The CronJob approach avoids long-running process management overhead.
#
# systemd timer equivalent (for bare-metal / VMs):
#   /etc/systemd/system/watch-hpa-events.timer
#   /etc/systemd/system/watch-hpa-events.service
# =============================================================================
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SLACK_WEBHOOK_URL="${SLACK_HPA_WEBHOOK_URL:-${SLACK_HPA_WEBHOOK_URL:-}}"
K8S_NAMESPACE="${K8S_NAMESPACE:-tradersapp}"
POLL_INTERVAL="${POLL_INTERVAL:-30}"    # seconds between kubectl polls
LOOKBACK_SECONDS="${LOOKBACK_SECONDS:-300}"  # catch events from last 5 minutes on start
PREV_REPLICAS_FILE="${PREV_REPLICAS_FILE:-/tmp/hpa_replicas_prev.json}"

# ── Validation ─────────────────────────────────────────────────────────────────
if [[ -z "$SLACK_WEBHOOK_URL" ]]; then
  echo "[watch-hpa-events] ERROR: SLACK_HPA_WEBHOOK_URL is not set. Exiting." >&2
  exit 1
fi

if ! command -v kubectl &>/dev/null; then
  echo "[watch-hpa-events] ERROR: kubectl not found in PATH." >&2
  exit 1
fi

# ── Slack payload helper ───────────────────────────────────────────────────────
send_slack() {
  local payload="$1"
  local response
  response=$(curl -s -X POST \
    -H 'Content-type: application/json' \
    --data "$payload" \
    "$SLACK_WEBHOOK_URL")
  if echo "$response" | grep -q '"ok":true'; then
    echo "[watch-hpa-events] Slack notification sent successfully."
  else
    echo "[watch-hpa-events] WARNING: Slack webhook returned non-ok: $response" >&2
  fi
}

format_slack_message() {
  local event_reason="$1"
  local hpa_name="$2"
  local namespace="$3"
  local first_timestamp="$4"
  local message="$5"
  local involved_object="$6"
  local count="${7:-1}"

  # Choose Slack emoji and colour based on scaling direction
  local emoji="kubernetes"
  local colour="#E01E5A"
  if echo "$message" | grep -qi "scaling up\|scale up\|increased"; then
    emoji=":arrow_up:"
    colour="#2EB67D"   # green
  elif echo "$message" | grep -qi "scaling down\|scale down\|decreased"; then
    emoji=":arrow_down:"
    colour="#ECB22E"   # yellow/amber
  fi

  # Slack Block Kit payload
  cat <<EOF
{
  "attachments": [
    {
      "color": "$colour",
      "blocks": [
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": "$emoji HPA Scaling Event: $hpa_name",
            "emoji": true
          }
        },
        {
          "type": "section",
          "fields": [
            {"type": "mrkdwn", "text": "*Reason:*\n\`$event_reason\`"},
            {"type": "mrkdwn", "text": "*Namespace:*\n\`$namespace\`"},
            {"type": "mrkdwn", "text": "*Involved Object:*\n\`$involved_object\`"},
            {"type": "mrkdwn", "text": "*First Seen:*\n\`$first_timestamp\`"},
            {"type": "mrkdwn", "text": "*Event Count:*\n$count"},
            {"type": "mrkdwn", "text": "*Message:*\n\`\`\`$message\`\`\`"}
          ]
        },
        {
          "type": "context",
          "elements": [
            {"type": "mrkdwn", "text": "TradersApp K8s Events | namespace=$namespace | $(date -u +%Y-%m-%dT%H:%M:%SZ)"}
          ]
        }
      ]
    }
  ]
}
EOF
}

# ── Main watch loop ────────────────────────────────────────────────────────────
echo "[watch-hpa-events] Starting HPA event watcher (namespace=$K8S_NAMESPACE, poll_interval=${POLL_INTERVAL}s)"
echo "[watch-hpa-events] Webhook URL: ${SLACK_WEBHOOK_URL:+<set>}" >&2

# Keep track of already-reported event hashes to avoid duplicates
declare -A REPORTED_EVENTS

while true; do
  # Get recent ScalingReplicaSet events for the namespace (lookback window)
  #kubectl get events \
  #  --namespace "$K8S_NAMESPACE" \
  #  --field-selector reason=ScalingReplicaSet \
  #  -o json \
  #  2>/dev/null | \

  # Use a JSONPath query to extract relevant fields efficiently
  #kubectl get events \
  #  --namespace "$K8S_NAMESPACE" \
  #  --field-selector reason=ScalingReplicaSet \
  #  -o custom-columns=\
  #    "LAST_SEEN:.lastTimestamp",\
  #    "REASON:.reason",\
  #    "FIRST_SEEN:.firstTimestamp",\
  #    "COUNT:.count",\
  #    "KIND:.involvedObject.kind",\
  #    "NAME:.involvedObject.name",\
  #    "MESSAGE:.message" \
  #  --no-headers 2>/dev/null | \

  # Parse events from kubectl output
  while IFS= read -r line; do
    # Skip empty lines
    [[ -z "$line" ]] && continue

    # Parse columns
    # Format: LAST_SEEN REASON FIRST_SEEN COUNT KIND NAME MESSAGE
    last_seen=$(echo "$line" | awk '{print $1}')
    reason=$(echo "$line" | awk '{print $2}')
    first_seen=$(echo "$line" | awk '{print $3}')
    count=$(echo "$line" | awk '{print $4}')
    kind=$(echo "$line" | awk '{print $5}')
    name=$(echo "$line" | awk '{print $6}')
    # Message is everything after field 6
    message=$(echo "$line" | awk '{$1=$2=$3=$4=$5=$6=""; print $0}' | sed 's/^[[:space:]]*//')

    # Build a unique event key to avoid duplicate alerts
    event_key="${reason}:${name}:${kind}:${count}"
    if [[ -n "${REPORTED_EVENTS[$event_key]:-}" ]]; then
      echo "[watch-hpa-events] Skipping already-reported event: $event_key"
      continue
    fi
    REPORTED_EVENTS[$event_key]=1

    # Format and send Slack message
    payload=$(format_slack_message \
      "$reason" \
      "$name" \
      "$K8S_NAMESPACE" \
      "$first_seen" \
      "$message" \
      "${kind}/${name}" \
      "$count")

    echo "[watch-hpa-events] Sending Slack notification for HPA event: $name ($reason)"
    send_slack "$payload"

  done < <(kubectl get events \
    --namespace "$K8S_NAMESPACE" \
    --field-selector reason=ScalingReplicaSet \
    -o custom-columns=\
      "LAST_SEEN:.lastTimestamp",\
      "REASON:.reason",\
      "FIRST_SEEN:.firstTimestamp",\
      "COUNT:.count",\
      "KIND:.involvedObject.kind",\
      "NAME:.involvedObject.name",\
      "MESSAGE:.message" \
    --no-headers 2>/dev/null)

  sleep "$POLL_INTERVAL"
done
