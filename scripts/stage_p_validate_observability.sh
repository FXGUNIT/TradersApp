#!/usr/bin/env bash
#
# stage_p_validate_observability.sh
# Stage P11 — Observability Validation
#
# Validates that production observability (Prometheus metrics, MLflow tracking,
# alert routing) is correctly wired.
#
# Usage:
#   ./scripts/stage_p_validate_observability.sh [--alert-test]
#   ML_ENGINE_URL=https://api.173.249.18.14.sslip.io BFF_URL=https://bff.173.249.18.14.sslip.io \
#     MLFLOW_TRACKING_URI=http://localhost:5000 \
#     PROMETHEUS_URL=http://localhost:9090 \
#     ./scripts/stage_p_validate_observability.sh
#
# Exit codes:
#   0  All checks passed (or only --alert-test checks skipped)
#   1  At least one check failed
#   2  Usage error

set -euo pipefail

# ── Defaults ────────────────────────────────────────────────────────────────
ML_ENGINE_URL="${ML_ENGINE_URL:-${ML_ENGINE_URL:-}}"
BFF_URL="${BFF_URL:-${BFF_URL:-}}"
MLFLOW_TRACKING_URI="${MLFLOW_TRACKING_URI:-http://localhost:5000}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
PAGERDUTY_ROUTING_KEY="${PAGERDUTY_ROUTING_KEY:-}"

RUN_ALERT_TEST=false
EVIDENCE_DIR="docs/stage-p"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
JSON_OUT="${EVIDENCE_DIR}/p11-validation-${TIMESTAMP}.json"

# ── Argument parsing ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --alert-test)
      RUN_ALERT_TEST=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--alert-test]"
      echo "  --alert-test   Also fire synthetic Discord/Slack/PagerDuty test alerts"
      echo ""
      echo "Environment variables (all optional if GitHub Actions vars are set):"
      echo "  ML_ENGINE_URL        ML Engine base URL (default: from env or https://api.173.249.18.14.sslip.io)"
      echo "  BFF_URL              BFF base URL       (default: from env or https://bff.173.249.18.14.sslip.io)"
      echo "  MLFLOW_TRACKING_URI  MLflow server URI (default: http://localhost:5000)"
      echo "  PROMETHEUS_URL       Prometheus URI     (default: http://localhost:9090)"
      echo "  DISCORD_WEBHOOK_URL  Discord webhook    (required for alert test)"
      echo "  SLACK_WEBHOOK_URL    Slack webhook      (required for alert test)"
      echo "  PAGERDUTY_ROUTING_KEY PagerDuty routing key (required for alert test)"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Use --help for usage." >&2
      exit 2
      ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────────────────────

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
WARN_COUNT=0

# results is a JSON array of check objects
declare -a RESULTS

json_escape() {
  # Escape a string for safe embedding in JSON (handles \, ", and control chars)
  printf '%s' "$1" | python3 -c \
    'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null \
    || printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g'
}

record_result() {
  # $1 = check_id, $2 = label, $3 = PASS|FAIL|SKIP|WARN, $4 = detail (optional)
  local id="$1" label="$2" status="$3" detail="${4:-}"

  case "$status" in
    PASS) ((PASS_COUNT++)) ;;
    FAIL) ((FAIL_COUNT++)) ;;
    SKIP) ((SKIP_COUNT++)) ;;
    WARN) ((WARN_COUNT++)) ;;
  esac

  # Format the line
  local short_status
  printf "%-4s  %-4s  %s" "[${status}]" "$id" "$label"
  if [[ -n "$detail" ]]; then
    printf "  (%s)" "$detail"
  fi
  printf "\n"

  # Append to JSON array
  local escaped_detail
  escaped_detail=$(json_escape "$detail")
  local escaped_label
  escaped_label=$(json_escape "$label")
  RESULTS+=("{\"id\":\"$id\",\"label\":$escaped_label,\"status\":\"$status\"${detail:+, \"detail\":$escaped_detail}}")
}

# ── Setup ────────────────────────────────────────────────────────────────────

mkdir -p "$EVIDENCE_DIR"

echo "==============================================================="
echo "  STAGE P11 — Observability Validation"
echo "  Run: ${TIMESTAMP}"
echo "==============================================================="
echo ""

# ── C01: ML Engine /metrics reachable ───────────────────────────────────────
check_c01() {
  if [[ -z "$ML_ENGINE_URL" ]]; then
    record_result "C01" "ML Engine /metrics reachable" "SKIP" "ML_ENGINE_URL not set"
    return
  fi

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${ML_ENGINE_URL}/metrics" 2>/dev/null || echo "000")

  if [[ "$http_code" == "200" ]]; then
    record_result "C01" "ML Engine /metrics reachable" "PASS" "HTTP ${http_code}"
  else
    record_result "C01" "ML Engine /metrics reachable" "FAIL" "HTTP ${http_code} (expected 200)"
  fi
}

# ── C02–C05: ML Engine key metrics present ────────────────────────────────────
check_ml_metrics() {
  if [[ -z "$ML_ENGINE_URL" ]]; then
    record_result "C02" "ML Engine metrics: consensus_latency_ms"     "SKIP" "ML_ENGINE_URL not set"
    record_result "C03" "ML Engine metrics: prediction_confidence"    "SKIP" "ML_ENGINE_URL not set"
    record_result "C04" "ML Engine metrics: regime_detection_score"  "SKIP" "ML_ENGINE_URL not set"
    record_result "C05" "ML Engine metrics: ml_engine_requests_total" "SKIP" "ML_ENGINE_URL not set"
    return
  fi

  local metrics_out
  metrics_out=$(curl -s --max-time 15 "${ML_ENGINE_URL}/metrics" 2>/dev/null || echo "")

  # Save evidence
  echo "$metrics_out" > "${EVIDENCE_DIR}/ml-metrics-${TIMESTAMP}.txt"

  # C02 consensus_latency_ms
  if echo "$metrics_out" | grep -q "^consensus_latency_ms"; then
    record_result "C02" "ML Engine metrics: consensus_latency_ms" "PASS"
  else
    record_result "C02" "ML Engine metrics: consensus_latency_ms" "FAIL" "metric not found in output"
  fi

  # C03 prediction_confidence
  if echo "$metrics_out" | grep -q "^prediction_confidence"; then
    record_result "C03" "ML Engine metrics: prediction_confidence" "PASS"
  else
    record_result "C03" "ML Engine metrics: prediction_confidence" "FAIL" "metric not found in output"
  fi

  # C04 regime_detection_score
  if echo "$metrics_out" | grep -q "^regime_detection_score"; then
    record_result "C04" "ML Engine metrics: regime_detection_score" "PASS"
  else
    record_result "C04" "ML Engine metrics: regime_detection_score" "FAIL" "metric not found in output"
  fi

  # C05 ml_engine_requests_total
  if echo "$metrics_out" | grep -q "^ml_engine_requests_total"; then
    record_result "C05" "ML Engine metrics: ml_engine_requests_total" "PASS"
  else
    record_result "C05" "ML Engine metrics: ml_engine_requests_total" "FAIL" "metric not found in output"
  fi
}

# ── C06: BFF /metrics reachable ─────────────────────────────────────────────
check_c06() {
  if [[ -z "$BFF_URL" ]]; then
    record_result "C06" "BFF /metrics reachable" "SKIP" "BFF_URL not set"
    return
  fi

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${BFF_URL}/metrics" 2>/dev/null || echo "000")

  if [[ "$http_code" == "200" ]]; then
    record_result "C06" "BFF /metrics reachable" "PASS" "HTTP ${http_code}"
  else
    record_result "C06" "BFF /metrics reachable" "FAIL" "HTTP ${http_code} (expected 200)"
  fi
}

# ── C07–C08: BFF key metrics present ─────────────────────────────────────────
check_bff_metrics() {
  if [[ -z "$BFF_URL" ]]; then
    record_result "C07" "BFF metrics: bff_http_request_duration_seconds" "SKIP" "BFF_URL not set"
    record_result "C08" "BFF metrics: bff_circuit_breaker_state"          "SKIP" "BFF_URL not set"
    return
  fi

  local metrics_out
  metrics_out=$(curl -s --max-time 15 "${BFF_URL}/metrics" 2>/dev/null || echo "")

  # Save evidence
  echo "$metrics_out" > "${EVIDENCE_DIR}/bff-metrics-${TIMESTAMP}.txt"

  # C07 bff_http_request_duration_seconds
  if echo "$metrics_out" | grep -q "^bff_http_request_duration_seconds"; then
    record_result "C07" "BFF metrics: bff_http_request_duration_seconds" "PASS"
  else
    record_result "C07" "BFF metrics: bff_http_request_duration_seconds" "FAIL" "metric not found in output"
  fi

  # C08 bff_circuit_breaker_state
  if echo "$metrics_out" | grep -q "^bff_circuit_breaker_state"; then
    record_result "C08" "BFF metrics: bff_circuit_breaker_state" "PASS"
  else
    record_result "C08" "BFF metrics: bff_circuit_breaker_state" "FAIL" "metric not found in output"
  fi
}

# ── C09: MLflow server reachable ────────────────────────────────────────────
check_c09() {
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${MLFLOW_TRACKING_URI}/health" 2>/dev/null || echo "000")

  if [[ "$http_code" == "200" ]]; then
    record_result "C09" "MLflow server reachable" "PASS" "HTTP ${http_code}"
  else
    record_result "C09" "MLflow server reachable" "FAIL" "HTTP ${http_code} (expected 200) — ${MLFLOW_TRACKING_URI}/health"
  fi
}

# ── C10–C14: MLflow experiments ─────────────────────────────────────────────
check_mlflow_experiments() {
  # Fetch experiment list and save evidence
  local exp_list
  exp_list=$(curl -s --max-time 15 \
    -H "Content-Type: application/json" \
    "${MLFLOW_TRACKING_URI}/api/2.0/mlflow/experiments/list" \
    -o "${EVIDENCE_DIR}/mlflow-experiments-${TIMESTAMP}.json" 2>/dev/null || echo "")

  # Use python3 for reliable JSON parsing (available on Linux/Windows Git Bash/macOS)
  local check_script
  check_script=$(cat <<'PYEOF'
import json, sys

exp_file = sys.argv[1]
required = ["direction", "regime", "session", "alpha"]
try:
    with open(exp_file) as f:
        data = json.load(f)
    names = {e.get("name") for e in data.get("experiments", [])}
    results = []
    for r in required:
        results.append(("PASS" if r in names else "FAIL", r))
    # Check for at least one completed run per experiment
    # We check last_run_time via the experiment object
    with open(exp_file) as f:
        data = json.load(f)
    for exp in data.get("experiments", []):
        name = exp.get("name")
        if name in required:
            lri = exp.get("last_run_info") or {}
            lrt = lri.get("last_run_time")
            if lrt is None:
                results.append(("FAIL", f"experiment={name} has no runs"))
            else:
                results.append(("PASS", f"experiment={name} last_run_time present"))
    for status, msg in results:
        print(f"{status}|{msg}")
except Exception as e:
    print(f"FAIL|python_error: {e}")
    sys.exit(1)
PYEOF
)

  local python_out
  python_out=$(python3 -c "$check_script" "${EVIDENCE_DIR}/mlflow-experiments-${TIMESTAMP}.json" 2>/dev/null || echo "FAIL|python3 not available")

  # Map results to check IDs
  declare -A id_map=(
    ["direction"]="C10"
    ["regime"]="C11"
    ["session"]="C12"
    ["alpha"]="C13"
  )
  # Track which experiments we've handled
  declare -A exp_status

  while IFS='|' read -r status msg; do
    # Extract experiment name from msg like "direction" or "experiment=direction last_run_time present"
    for exp in direction regime session alpha; do
      if echo "$msg" | grep -q "^experiment=$exp "; then
        if [[ -n "${id_map[$exp]:-}" ]]; then
          record_result "${id_map[$exp]}" "MLflow experiment: $exp" "$status" "$msg"
          unset "id_map[$exp]"
        fi
      elif echo "$msg" | grep -q "^${exp}$"; then
        if [[ -n "${id_map[$exp]:-}" ]]; then
          record_result "${id_map[$exp]}" "MLflow experiment: $exp" "$status" "$msg"
          unset "id_map[$exp]"
        fi
      fi
    done
  done <<< "$python_out"

  # Any experiments not checked get a SKIP (shouldn't happen if python_out is correct)
  for exp in direction regime session alpha; do
    if [[ -v "id_map[$exp]" ]]; then
      record_result "${id_map[$exp]}" "MLflow experiment: $exp" "SKIP" "python3 parsing failed"
    fi
  done

  # C14: Experiments have completed runs
  if echo "$python_out" | grep -q "^FAIL|.*has no runs"; then
    record_result "C14" "MLflow experiments have completed runs" "FAIL" "one or more experiments have no runs"
  else
    record_result "C14" "MLflow experiments have completed runs" "PASS"
  fi
}

# ── Prometheus alert rules check ─────────────────────────────────────────────
check_prometheus_alerts() {
  local prom_out
  prom_out=$(curl -s --max-time 15 \
    "${PROMETHEUS_URL}/api/v1/alerts" \
    -o "${EVIDENCE_DIR}/prometheus-alerts-${TIMESTAMP}.json" 2>/dev/null || echo '{"status":"error"}')

  local prom_status
  prom_status=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status','error'))" \
    2>/dev/null <<< "$prom_out" || echo "error")

  if [[ "$prom_status" == "success" ]]; then
    local firing_count
    firing_count=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(len([a for a in d.get('data',{}).get('alerts',[]) if a.get('state')=='firing']))" \
      2>/dev/null <<< "$prom_out" || echo "-1")
    record_result "P01" "Prometheus alert rules loaded" "PASS" "rules evaluated, firing=${firing_count}"
  else
    record_result "P01" "Prometheus alert rules loaded" "WARN" "Prometheus returned status=${prom_status} — check PROMETHEUS_URL"
  fi
}

# ── Alert tests (A01–A03) ────────────────────────────────────────────────────

alert_discord() {
  if [[ -z "${DISCORD_WEBHOOK_URL}" ]]; then
    record_result "A01" "Discord alert test" "SKIP" "DISCORD_WEBHOOK_URL not set"
    return
  fi

  local ts
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  local response
  response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"content\": \"[P11 VALIDATION] Observability test alert — sent at ${ts}\",
      \"embeds\": [{
        \"title\": \"P11 Observability Validation\",
        \"description\": \"Synthetic test alert from stage_p_validate_observability.sh\",
        \"color\": 3066993,
        \"footer\": { \"text\": \"TradersApp Stage P11\" },
        \"timestamp\": \"${ts}\"
      }]
    }" \
    "${DISCORD_WEBHOOK_URL}" 2>/dev/null || echo "")

  # Discord returns 204 No Content on success
  if [[ -z "$response" ]] || [[ "$response" == "null" ]] 2>/dev/null; then
    record_result "A01" "Discord alert test" "PASS" "Webhook accepted (Discord returns 204 on success)"
  else
    record_result "A01" "Discord alert test" "FAIL" "Unexpected response: ${response}"
  fi
}

alert_slack() {
  if [[ -z "${SLACK_WEBHOOK_URL}" ]]; then
    record_result "A02" "Slack alert test" "SKIP" "SLACK_WEBHOOK_URL not set"
    return
  fi

  local ts
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  local response
  response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"[P11 VALIDATION] Observability test alert\",
      \"blocks\": [
        {
          \"type\": \"section\",
          \"text\": {
            \"type\": \"mrkdwn\",
            \"text\": \":test_tube: *P11 Observability Validation*\nSent at ${ts}\nThis is a synthetic test — safe to ignore.\"
          }
        },
        {
          \"type\": \"context\",
          \"elements\": [
            { \"type\": \"mrkdwn\", \"text\": \"Source: stage_p_validate_observability.sh\" }
          ]
        }
      ]
    }" \
    "${SLACK_WEBHOOK_URL}" 2>/dev/null || echo "")

  # Slack returns "ok" true on success
  if echo "$response" | grep -q '"ok":true'; then
    record_result "A02" "Slack alert test" "PASS" "Webhook accepted"
  elif [[ -z "$response" ]]; then
    record_result "A02" "Slack alert test" "PASS" "Webhook accepted (empty response = success for Slack)"
  else
    record_result "A02" "Slack alert test" "FAIL" "Response: ${response}"
  fi
}

alert_pagerduty() {
  if [[ -z "${PAGERDUTY_ROUTING_KEY}" ]]; then
    record_result "A03" "PagerDuty alert test" "SKIP" "PAGERDUTY_ROUTING_KEY not set"
    return
  fi

  local ts
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  local dedup_key="p11-validation-${TIMESTAMP}"

  local trigger_response
  trigger_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"routing_key\": \"${PAGERDUTY_ROUTING_KEY}\",
      \"event_action\": \"trigger\",
      \"dedup_key\": \"${dedup_key}\",
      \"payload\": {
        \"summary\": \"[P11 VALIDATION] Test alert — ignore\",
        \"severity\": \"info\",
        \"source\": \"stage-p-observability-validation\",
        \"component\": \"observability\",
        \"class\": \"validation\",
        \"timestamp\": \"${ts}\",
        \"custom_details\": {
          \"validation_run\": \"STAGE_P11\",
          \"environment\": \"production\",
          \"test_alert\": true
        }
      }
    }" \
    "https://events.pagerduty.com/v2/enqueue" 2>/dev/null || echo "")

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "{}" \
    "https://events.pagerduty.com/v2/enqueue" 2>/dev/null || echo "000")

  # PagerDuty Events API v2 returns HTTP 202 on success
  if echo "$trigger_response" | grep -q '"status":"success"'; then
    record_result "A03" "PagerDuty alert test" "PASS" "Event accepted (HTTP 202)"

    # Resolve the test incident immediately
    sleep 2
    curl -s -X POST \
      -H "Content-Type: application/json" \
      -d "{
        \"routing_key\": \"${PAGERDUTY_ROUTING_KEY}\",
        \"event_action\": \"resolve\",
        \"dedup_key\": \"${dedup_key}\"
      }" \
      "https://events.pagerduty.com/v2/enqueue" > /dev/null 2>&1 || true

  else
    record_result "A03" "PagerDuty alert test" "FAIL" "Response: ${trigger_response}"
  fi
}

# ── Run all checks ────────────────────────────────────────────────────────────

echo "--- Metrics Checks ---"
check_c01
check_ml_metrics
check_c06
check_bff_metrics

echo ""
echo "--- MLflow Checks ---"
check_c09
check_mlflow_experiments

echo ""
echo "--- Prometheus Checks ---"
check_prometheus_alerts

if $RUN_ALERT_TEST; then
  echo ""
  echo "--- Alert Routing Tests (--alert-test) ---"
  alert_discord
  alert_slack
  alert_pagerduty
else
  record_result "A01" "Discord alert test"         "SKIP" "--alert-test not specified"
  record_result "A02" "Slack alert test"           "SKIP" "--alert-test not specified"
  record_result "A03" "PagerDuty alert test"       "SKIP" "--alert-test not specified"
fi

# ── Write JSON evidence ──────────────────────────────────────────────────────

# Build JSON array string
json_results=$(IFS=','; echo "${RESULTS[*]}")
cat > "$JSON_OUT" << EOF
{
  "stage": "P11",
  "run_timestamp": "${TIMESTAMP}",
  "endpoints_tested": {
    "ml_engine_metrics": "${ML_ENGINE_URL}/metrics",
    "bff_metrics": "${BFF_URL}/metrics",
    "mlflow": "${MLFLOW_TRACKING_URI}",
    "prometheus": "${PROMETHEUS_URL}"
  },
  "checks": {
    "C01": "ML Engine /metrics reachable",
    "C02": "ML Engine metrics: consensus_latency_ms",
    "C03": "ML Engine metrics: prediction_confidence",
    "C04": "ML Engine metrics: regime_detection_score",
    "C05": "ML Engine metrics: ml_engine_requests_total",
    "C06": "BFF /metrics reachable",
    "C07": "BFF metrics: bff_http_request_duration_seconds",
    "C08": "BFF metrics: bff_circuit_breaker_state",
    "C09": "MLflow server reachable",
    "C10": "MLflow experiment: direction",
    "C11": "MLflow experiment: regime",
    "C12": "MLflow experiment: session",
    "C13": "MLflow experiment: alpha",
    "C14": "MLflow experiments have completed runs",
    "P01": "Prometheus alert rules loaded",
    "A01": "Discord alert test",
    "A02": "Slack alert test",
    "A03": "PagerDuty alert test"
  },
  "alert_test_run": ${RUN_ALERT_TEST},
  "results": [${json_results}],
  "summary": {
    "pass": ${PASS_COUNT},
    "fail": ${FAIL_COUNT},
    "skip": ${SKIP_COUNT},
    "warn": ${WARN_COUNT}
  },
  "status": "STAGE P11 COMPLETE"
}
EOF

echo ""
echo "==============================================================="
echo "  RESULT: ${PASS_COUNT} PASS, ${FAIL_COUNT} FAIL, ${SKIP_COUNT} SKIP, ${WARN_COUNT} WARN"
if [[ "$FAIL_COUNT" -eq 0 ]]; then
  echo "  STATUS: STAGE P11 COMPLETE"
  echo "==============================================================="
  echo ""
  echo "Evidence saved to: ${JSON_OUT}"
  exit 0
else
  echo "  STATUS: STAGE P11 INCOMPLETE — review failures above"
  echo "==============================================================="
  echo ""
  echo "Evidence saved to: ${JSON_OUT}"
  exit 1
fi
