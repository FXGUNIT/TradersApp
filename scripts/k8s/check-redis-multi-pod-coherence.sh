#!/bin/bash
# ---------------------------------------------------------------------------
# Redis Multi-Pod Coherence Test Runner
#
# Usage:
#   # Option A — Run from a k3s/k8s worker pod (full cluster access)
#   kubectl exec -n tradersapp-dev deploy/<your-pod> -- \
#     python -m pytest tests/integration/test_redis_multi_pod_coherence.py -v
#
#   # Option B — Run from developer host (requires local Redis on port 6379)
#   bash scripts/k8s/check-redis-multi-pod-coherence.sh
#
#   # Option C — Override Redis target explicitly
#   REDIS_URL=redis://my-redis:6379/0 \
#     python -m pytest tests/integration/test_redis_multi_pod_coherence.py -v
# ---------------------------------------------------------------------------
set -euo pipefail

REDIS_URL="${REDIS_URL:-}"

# If REDIS_URL not set, let the test auto-detect (cluster vs local)
if [[ -n "$REDIS_URL" ]]; then
  echo "Using explicit REDIS_URL=$REDIS_URL"
else
  echo "No REDIS_URL set — test will auto-detect (cluster Kubernetes DNS or localhost)"
fi

cd /e/TradersApp

echo "========================================"
echo "Redis Multi-Pod Coherence Test"
echo "========================================"

python -m pytest \
  tests/integration/test_redis_multi_pod_coherence.py \
  -v \
  --tb=short \
  -s \
  2>&1

echo ""
echo "========================================"
echo "Test run complete."
echo "========================================"
