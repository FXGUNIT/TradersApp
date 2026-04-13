#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Post-start: runs EVERY TIME the Codespace starts/resumes.
# Boots the docker-compose dev stack automatically. ~60s to healthy.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

CODESPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== TradersApp Codespace: post-start =="

# Wait for Docker-in-Docker to be ready
echo "Waiting for Docker daemon..."
for i in $(seq 1 30); do
  if docker info >/dev/null 2>&1; then
    echo "Docker is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Docker daemon not available after 30s" >&2
    exit 1
  fi
  sleep 1
done

# ── Load .env (Codespace secrets / local overrides) ──────────
if [ -f "$CODESPACE_DIR/.env" ]; then
  echo "Loading .env..."
  set -a
  # shellcheck disable=SC1091
  source "$CODESPACE_DIR/.env"
  set +a
fi

# ── Ensure bind-mount directories exist ──────────────────────
mkdir -p "$CODESPACE_DIR/ml-engine/data"
mkdir -p "$CODESPACE_DIR/ml-engine/models/store"
mkdir -p "$CODESPACE_DIR/mlflow/artifacts"

# ── Pull latest images (non-blocking, background) ────────────
echo "Pulling latest images (background)..."
docker compose \
  --file "$CODESPACE_DIR/docker-compose.dev.yml" \
  --profile mlops \
  pull --quiet \
  &

# ── Build & start full stack (core + MLflow) ──────────────────
echo "Starting dev stack (core + mlops profiles)..."
docker compose \
  --file "$CODESPACE_DIR/docker-compose.dev.yml" \
  --profile mlops \
  up -d --build 2>&1 | tail -5

# ── Health check loop ────────────────────────────────────────
echo "Waiting for services to become healthy..."
services=("traders-dev-redis" "traders-dev-ml-engine" "traders-dev-bff" "traders-dev-analysis" "traders-dev-mlflow")
max_wait=180
elapsed=0

all_healthy=false
while [ "$elapsed" -lt "$max_wait" ]; do
  healthy_count=0
  for svc in "${services[@]}"; do
    # Prefer health status, fall back to running state
    status=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "missing")
    if [ "$status" = "healthy" ]; then
      ((healthy_count++))
    elif [ "$status" = "running" ]; then
      # Some services (mlflow) may not have a healthcheck defined
      ((healthy_count++))
    fi
  done

  if [ "$healthy_count" -eq "${#services[@]}" ]; then
    all_healthy=true
    break
  fi

  sleep 5
  ((elapsed+=5))
  echo "  ... ${healthy_count}/${#services[@]} healthy (${elapsed}s elapsed)"
done

echo ""
if [ "$all_healthy" = true ]; then
  echo "============================================"
  echo "  ✓ All services healthy!"
  echo ""
  echo "  Frontend:   http://localhost:80"
  echo "  BFF:        http://localhost:8788"
  echo "  ML Engine:  http://localhost:8001"
  echo "  Analysis:   localhost:50051 (gRPC)"
  echo "  MLflow:     http://localhost:5000"
  echo "============================================"
else
  echo "WARNING: Some services did not become healthy within ${max_wait}s"
  docker compose --file "$CODESPACE_DIR/docker-compose.dev.yml" ps
fi

echo "== post-start complete =="
