#!/usr/bin/env bash
# k6-runner.sh — Run k6 load-test scenarios against a configurable BASE_URL
#
# Usage:
#   # Run all scenarios against localhost (default)
#   bash k6-runner.sh
#
#   # Run against a specific environment
#   BASE_URL=https://ml-engine.staging.example.com bash k6-runner.sh
#
#   # Run a single scenario
#   SCENARIO=predict bash k6-runner.sh
#
#   # Override SLA thresholds via env vars
#   SLA_P95_MS=150 SLA_P99_MS=300 MAX_FAIL_RATIO=0.005 bash k6-runner.sh
#
#   # Output JSON results for CI
#   K6_OUT=json OUTPUT_FILE=results.json bash k6-runner.sh
#
# Prerequisites:
#   - k6 >= 0.47.0 installed  (https://k6.io/docs/getting-started/installation/)
#   - ML Engine + BFF running at BASE_URL / BFF_BASE_URL
#
# Exit codes:
#   0  — all SLA thresholds passed
#   1  — one or more SLA thresholds breached (k6 exit code propagated)

set -euo pipefail

# ─── Paths ─────────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCENARIOS_FILE="$REPO_ROOT/tests/load/k6/scenarios.js"
OPTIONS_FILE="$REPO_ROOT/tests/load/k6/options.json"
RESULTS_DIR="${RESULTS_DIR:-$REPO_ROOT/.artifacts/k6/$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$RESULTS_DIR"

# ─── Defaults ─────────────────────────────────────────────────────────────────

BASE_URL="${BASE_URL:-http://127.0.0.1:8001}"
BFF_BASE_URL="${BFF_BASE_URL:-http://127.0.0.1:8788}"
SCENARIO="${SCENARIO:-all}"          # all | predict | mamba | consensus
SLA_P95_MS="${SLA_P95_MS:-200}"
SLA_P99_MS="${SLA_P99_MS:-500}"
MAX_FAIL_RATIO="${MAX_FAIL_RATIO:-0.01}"

# k6 output type: "" (default console) | json | influxdb | cloud
K6_OUT="${K6_OUT:-}"
OUTPUT_FILE="${OUTPUT_FILE:-}"

# k6 flags
K6_NO_USAGE="${K6_NO_USAGE:-true}"  # suppress usage summary
K6_INSECURE_TLS="${K6_INSECURE_TLS:-false}"  # set true for self-signed certs

# ─── Validation ───────────────────────────────────────────────────────────────

for cmd in k6; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: k6 is not installed." >&2
    echo "Install: https://k6.io/docs/getting-started/installation/" >&2
    exit 1
  fi
done

if [[ ! -f "$SCENARIOS_FILE" ]]; then
  echo "ERROR: scenarios file not found: $SCENARIOS_FILE" >&2
  exit 1
fi

# ─── Build k6 arguments ────────────────────────────────────────────────────────

K6_ARGS=(
  run
  "$SCENARIOS_FILE"
  --env "BASE_URL=$BASE_URL"
  --env "BFF_BASE_URL=$BFF_BASE_URL"
  --env "SCENARIO=$SCENARIO"
  --env "SLA_P95_MS=$SLA_P95_MS"
  --env "SLA_P99_MS=$SLA_P99_MS"
  --env "MAX_FAIL_RATIO=$MAX_FAIL_RATIO"
)

# Output options
if [[ -n "$K6_OUT" ]]; then
  K6_ARGS+=(--out "$K6_OUT")
fi

if [[ -n "$OUTPUT_FILE" ]]; then
  if [[ "$K6_OUT" == "json" ]]; then
    K6_ARGS+=(--out "json=$OUTPUT_FILE")
  else
    echo "WARN: OUTPUT_FILE is set but K6_OUT=$K6_OUT; only 'json' output writes to a file." >&2
  fi
fi

# HTML summary report (always generated for CI artifacts)
K6_ARGS+=(--summary-export "${RESULTS_DIR}/summary.json")

# TLS / verbosity
if [[ "$K6_INSECURE_TLS" == "true" ]]; then
  K6_ARGS+=(--insecure-skip-tls-verify)
fi

# ─── Header ───────────────────────────────────────────────────────────────────

echo "========================================"
echo "k6 Load Test Runner"
echo "========================================"
echo "Scenarios file : $SCENARIOS_FILE"
echo "BASE_URL       : $BASE_URL"
echo "BFF_BASE_URL   : $BFF_BASE_URL"
echo "Scenario       : $SCENARIO"
echo "SLA P95        : ${SLA_P95_MS} ms"
echo "SLA P99        : ${SLA_P99_MS} ms"
echo "Max fail ratio : $MAX_FAIL_RATIO"
echo "Results dir    : $RESULTS_DIR"
echo "========================================"

# ─── Health check before running ──────────────────────────────────────────────

ML_HEALTH_URL="${BASE_URL}/health"
BFF_HEALTH_URL="${BFF_BASE_URL}/health"

echo "Pre-flight health check..."
if curl -fsS -m 5 "$ML_HEALTH_URL" >/dev/null 2>&1; then
  echo "  ✓ ML Engine health OK: $ML_HEALTH_URL"
else
  echo "  ! ML Engine not reachable at $ML_HEALTH_URL (will proceed anyway — endpoint may be warming)"
fi

if curl -fsS -m 5 "$BFF_HEALTH_URL" >/dev/null 2>&1; then
  echo "  ✓ BFF health OK: $BFF_HEALTH_URL"
else
  echo "  ! BFF not reachable at $BFF_HEALTH_URL (will proceed anyway)"
fi
echo ""

# ─── Run k6 ────────────────────────────────────────────────────────────────────

echo "Running k6..."
START_TIME=$(date +%s)

k6 "${K6_ARGS[@]}"
K6_EXIT=$?

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "k6 exit code : $K6_EXIT"
echo "Duration     : ${DURATION}s"
echo "Results dir  : $RESULTS_DIR"

# ─── Parse summary.json for SLA report ───────────────────────────────────────

SUMMARY_FILE="${RESULTS_DIR}/summary.json"
if [[ -f "$SUMMARY_FILE" ]]; then
  echo ""
  echo "=== SLA Summary ==="
  # Extract p(95) and p(99) from k6 summary JSON
  python3 -c "
import json, sys

data = json.load(open('$SUMMARY_FILE'))
metrics = data.get('metrics', {})

def p95(name):
    m = metrics.get(name, {})
    return m.get('values', {}).get('p(95)', 'N/A')

def p99(name):
    m = metrics.get(name, {})
    return m.get('values', {}).get('p(99)', 'N/A')

def fail_rate(name):
    m = metrics.get(name, {})
    return m.get('values', {}).get('fail_rate', 'N/A')

print(f'  /predict   p95={p95(\"predict_latency_ms\")} ms  p99={p99(\"predict_latency_ms\")} ms  fail={fail_rate(\"predict_fail_rate\")}')
print(f'  /mamba     p95={p95(\"mamba_latency_ms\")} ms  p99={p99(\"mamba_latency_ms\")} ms  fail={fail_rate(\"mamba_fail_rate\")}')
print(f'  /consensus p95={p95(\"consensus_latency_ms\")} ms  p99={p99(\"consensus_latency_ms\")} ms  fail={fail_rate(\"consensus_fail_rate\")}')
print(f'  SLA P95 threshold : ${SLA_P95_MS} ms')
print(f'  SLA P99 threshold : ${SLA_P99_MS} ms')
print(f'  Max fail ratio    : $MAX_FAIL_RATIO')
" 2>/dev/null || true
fi

# ─── Write CSV manifest ────────────────────────────────────────────────────────

cat > "${RESULTS_DIR}/run-manifest.csv" <<EOF
scenario,base_url,bff_base_url,sla_p95_ms,sla_p99_ms,max_fail_ratio,exit_code,duration_s,timestamp
$SCENARIO,$BASE_URL,$BFF_BASE_URL,$SLA_P95_MS,$SLA_P99_MS,$MAX_FAIL_RATIO,$K6_EXIT,$DURATION,$(date -Iseconds)
EOF

echo "Run manifest : ${RESULTS_DIR}/run-manifest.csv"

exit $K6_EXIT
