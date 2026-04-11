#!/bin/bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:8788}"
OUTPUT_DIR="${OUTPUT_DIR:-tests/load/results}"
mkdir -p "$OUTPUT_DIR"
k6 run tests/load/k6/scenarios.js \
  --env BASE_URL="$BASE_URL" \
  --out json="$OUTPUT_DIR/k6-report.json" \
  --out csv="$OUTPUT_DIR/k6-report.csv"
echo "k6 results saved to $OUTPUT_DIR/"
