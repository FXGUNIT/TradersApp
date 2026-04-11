#!/usr/bin/env bash
# scripts/k8s/apply-hpa-ml-engine.sh
# Apply the ML Engine HPA and run a load test to verify scaling.

set -euo pipefail

NAMESPACE="${NAMESPACE:-tradersapp}"
HPA_FILE="${1:-k8s/hpa-ml-engine.yaml}"

echo "==> Applying ML Engine HPA"
kubectl apply -f "${HPA_FILE}" --namespace="${NAMESPACE}"

echo "==> Waiting for HPA to be ready"
kubectl wait --for=condition=Ready=true hpa/ml-engine-hpa \
  --namespace="${NAMESPACE}" --timeout=30s || true

echo "==> Current HPA status"
kubectl get hpa ml-engine-hpa --namespace="${NAMESPACE}" -o wide

echo "==> Running load test to verify scaling"
# Use hey or ab if available, otherwise use curl loop
if command -v hey &>/dev/null; then
  echo "Using hey for load test..."
  hey -z 60s -c 20 -m POST \
    -H "Content-Type: application/json" \
    -d '{"symbol":"MNQ","candles":[]}' \
    "http://localhost:8001/predict" \
    2>&1 | tail -20
elif command -v ab &>/dev/null; then
  echo "Using ab for load test..."
  ab -n 200 -c 10 -p /dev/stdin \
    -T "application/json" \
    "http://localhost:8001/predict" <<'PAYLOAD'
{"symbol":"MNQ","candles":[]}
PAYLOAD
else
  echo "No load tool found — using curl loop"
  for i in $(seq 1 20); do
    curl -sf "http://localhost:8001/health" &>/dev/null && echo "Request ${i}: OK" || echo "Request ${i}: FAIL"
  done
  echo "Load test complete."
fi

echo "==> Verifying pod count"
kubectl get pods -n "${NAMESPACE}" -l app=ml-engine

echo "==> HPA apply complete"
echo "Metrics to watch:"
echo "  kubectl top pods -n ${NAMESPACE} -l app=ml-engine"
echo "  kubectl get hpa ml-engine-hpa -n ${NAMESPACE} -w"
