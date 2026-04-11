#!/bin/bash
# Checks canary promotion criteria and exits 0 if criteria met
set -euo pipefail

NAMESPACE="${1:-tradersapp-dev}"

CANARY_POD=$(kubectl get pods -n "$NAMESPACE" -l app=bff-canary -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$CANARY_POD" ]; then
    echo "ERROR: No canary pod found in namespace $NAMESPACE"
    exit 1
fi

echo "Canary pod: $CANARY_POD"

# Wait for pod to be Ready (60s timeout)
echo "Checking Ready status..."
kubectl wait --for=condition=Ready "pod/$CANARY_POD" -n "$NAMESPACE" --timeout=60s

# Check health endpoint
echo "Checking /health on canary pod..."
kubectl exec "$CANARY_POD" -n "$NAMESPACE" -- \
    wget -qO- "http://localhost:8788/health" | grep -q '"status":"ok"'

echo "CANARY PROMOTION CRITERIA: PASS"
