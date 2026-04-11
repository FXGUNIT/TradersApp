#!/usr/bin/env sh
# watch-hpa-events.sh - HPA scaling event watcher for TradersApp
#
# Watches Kubernetes events for HorizontalPodAutoscaler rescale activity in the
# target namespace and sends Slack notifications when a webhook is configured.
#
# Usage:
#   SLACK_HPA_WEBHOOK_URL="https://hooks.slack.com/..." \
#   K8S_NAMESPACE="tradersapp" \
#   ./watch-hpa-events.sh
#
# Flags:
#   --once              Scan once and exit
#   --namespace NAME    Override the namespace to watch
#   --poll-interval N   Seconds between scans in continuous mode
#   --lookback-seconds N  Skip events older than this window

set -eu

K8S_NAMESPACE="${K8S_NAMESPACE:-tradersapp}"
POLL_INTERVAL="${POLL_INTERVAL:-30}"
LOOKBACK_SECONDS="${LOOKBACK_SECONDS:-300}"
RUN_ONCE="${RUN_ONCE:-0}"
KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
SEEN_EVENTS_FILE="${SEEN_EVENTS_FILE:-/tmp/watch-hpa-events.seen}"
SLACK_WEBHOOK_URL="${SLACK_HPA_WEBHOOK_URL:-${SLACK_WEBHOOK_URL:-}}"

usage() {
  cat <<'EOF'
Usage: watch-hpa-events.sh [--once] [--namespace NAME] [--poll-interval N] [--lookback-seconds N]
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --once)
      RUN_ONCE=1
      ;;
    --namespace)
      if [ "${2:-}" = "" ]; then
        echo "[watch-hpa-events] ERROR: --namespace requires a value" >&2
        exit 1
      fi
      K8S_NAMESPACE="$2"
      shift
      ;;
    --poll-interval)
      if [ "${2:-}" = "" ]; then
        echo "[watch-hpa-events] ERROR: --poll-interval requires a value" >&2
        exit 1
      fi
      POLL_INTERVAL="$2"
      shift
      ;;
    --lookback-seconds)
      if [ "${2:-}" = "" ]; then
        echo "[watch-hpa-events] ERROR: --lookback-seconds requires a value" >&2
        exit 1
      fi
      LOOKBACK_SECONDS="$2"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[watch-hpa-events] ERROR: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [ ! -x "$KUBECTL_BIN" ] && ! command -v "$KUBECTL_BIN" >/dev/null 2>&1; then
  echo "[watch-hpa-events] ERROR: kubectl not found at '$KUBECTL_BIN'." >&2
  exit 1
fi

if [ ! -f "$SEEN_EVENTS_FILE" ]; then
  : > "$SEEN_EVENTS_FILE"
fi

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

send_slack() {
  payload="$1"

  if [ -z "$SLACK_WEBHOOK_URL" ]; then
    echo "[watch-hpa-events] Slack webhook not configured; skipping send." >&2
    return 0
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "[watch-hpa-events] ERROR: curl not found in PATH." >&2
    return 1
  fi

  response="$(curl -fsS -X POST \
    -H 'Content-type: application/json' \
    --data "$payload" \
    "$SLACK_WEBHOOK_URL" 2>&1 || true)"

  if [ -n "$response" ]; then
    echo "[watch-hpa-events] Slack webhook response: $response"
  fi
}

format_slack_message() {
  event_reason="$1"
  hpa_name="$2"
  namespace="$3"
  first_timestamp="$4"
  message="$5"
  involved_object="$6"
  count="${7:-1}"

  emoji=":gear:"
  colour="#E01E5A"

  case "$message" in
    *"scaling up"*|*"scale up"*|*"increased"*|*"desired replica count is larger"*)
      emoji=":arrow_up:"
      colour="#2EB67D"
      ;;
    *"scaling down"*|*"scale down"*|*"decreased"*|*"desired replica count is smaller"*)
      emoji=":arrow_down:"
      colour="#ECB22E"
      ;;
  esac

  escaped_reason="$(json_escape "$event_reason")"
  escaped_hpa="$(json_escape "$hpa_name")"
  escaped_namespace="$(json_escape "$namespace")"
  escaped_first_seen="$(json_escape "$first_timestamp")"
  escaped_message="$(json_escape "$message")"
  escaped_object="$(json_escape "$involved_object")"
  now_utc="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || printf '%s' 'unknown')"

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
            "text": "$emoji HPA Scaling Event: $escaped_hpa",
            "emoji": true
          }
        },
        {
          "type": "section",
          "fields": [
            {"type": "mrkdwn", "text": "*Reason:*\n\`$escaped_reason\`"},
            {"type": "mrkdwn", "text": "*Namespace:*\n\`$escaped_namespace\`"},
            {"type": "mrkdwn", "text": "*Involved Object:*\n\`$escaped_object\`"},
            {"type": "mrkdwn", "text": "*First Seen:*\n\`$escaped_first_seen\`"},
            {"type": "mrkdwn", "text": "*Event Count:*\n$count"},
            {"type": "mrkdwn", "text": "*Message:*\n\`\`\`$escaped_message\`\`\`"}
          ]
        },
        {
          "type": "context",
          "elements": [
            {"type": "mrkdwn", "text": "TradersApp HPA watcher | namespace=$escaped_namespace | observed_at=$now_utc"}
          ]
        }
      ]
    }
  ]
}
EOF
}

event_already_seen() {
  event_key="$1"
  grep -Fxq "$event_key" "$SEEN_EVENTS_FILE"
}

mark_event_seen() {
  event_key="$1"
  printf '%s\n' "$event_key" >> "$SEEN_EVENTS_FILE"
}

scan_hpa_events() {
  cutoff=""
  case "$LOOKBACK_SECONDS" in
    ''|*[!0-9]*)
      LOOKBACK_SECONDS=0
      ;;
  esac
  if [ "$LOOKBACK_SECONDS" -gt 0 ]; then
    cutoff="$(date -u -d "-${LOOKBACK_SECONDS} seconds" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || true)"
  fi

  "$KUBECTL_BIN" get events \
    --namespace "$K8S_NAMESPACE" \
    --field-selector involvedObject.kind=HorizontalPodAutoscaler \
    --sort-by=.lastTimestamp \
    -o custom-columns=LAST_SEEN:.lastTimestamp,UID:.metadata.uid,TYPE:.type,REASON:.reason,COUNT:.count,KIND:.involvedObject.kind,NAME:.involvedObject.name,MESSAGE:.message \
    --no-headers 2>/dev/null |
  while IFS= read -r line; do
    [ -n "$line" ] || continue

    last_seen="$(printf '%s\n' "$line" | awk '{print $1}')"
    event_uid="$(printf '%s\n' "$line" | awk '{print $2}')"
    event_type="$(printf '%s\n' "$line" | awk '{print $3}')"
    event_reason="$(printf '%s\n' "$line" | awk '{print $4}')"
    count="$(printf '%s\n' "$line" | awk '{print $5}')"
    kind="$(printf '%s\n' "$line" | awk '{print $6}')"
    name="$(printf '%s\n' "$line" | awk '{print $7}')"
    message="$(printf '%s\n' "$line" | cut -d' ' -f8-)"

    if [ -n "$cutoff" ] && [ -n "$last_seen" ] && [ "$last_seen" \< "$cutoff" ]; then
      continue
    fi

    event_key="${event_uid:-${event_reason}:${name}:${last_seen}:${count}}"
    if event_already_seen "$event_key"; then
      echo "[watch-hpa-events] Skipping already-reported event: $event_key"
      continue
    fi

    payload="$(format_slack_message \
      "$event_reason" \
      "$name" \
      "$K8S_NAMESPACE" \
      "$last_seen" \
      "$message" \
      "${kind}/${name}" \
      "$count")"

    echo "[watch-hpa-events] HPA event detected: ${name} (${event_reason}, type=${event_type}, count=${count})"
    send_slack "$payload"
    mark_event_seen "$event_key"
  done
}

echo "[watch-hpa-events] Starting HPA event watcher (namespace=$K8S_NAMESPACE, poll_interval=${POLL_INTERVAL}s, lookback=${LOOKBACK_SECONDS}s)"
if [ -n "$SLACK_WEBHOOK_URL" ]; then
  echo "[watch-hpa-events] Slack webhook: configured"
else
  echo "[watch-hpa-events] Slack webhook: not configured"
fi

while :; do
  scan_hpa_events

  if [ "$RUN_ONCE" = "1" ]; then
    exit 0
  fi

  sleep "$POLL_INTERVAL"
done
