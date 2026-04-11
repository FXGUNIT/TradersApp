#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Post-create: runs ONCE when the Codespace is first built.
# Installs dependencies for all services. Idempotent.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

CODESPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== TradersApp Codespace: post-create =="

# ── Frontend + BFF npm deps ──────────────────────────────────
echo "[1/4] Installing npm dependencies..."
npm ci --quiet 2>/dev/null || npm install --quiet 2>/dev/null || true
if [ -d "$CODESPACE_DIR/bff" ] && [ -f "$CODESPACE_DIR/bff/package.json" ]; then
  (cd "$CODESPACE_DIR/bff" && npm ci --quiet 2>/dev/null || npm install --quiet 2>/dev/null || true)
fi

# ── ML Engine Python deps ───────────────────────────────────
echo "[2/4] Installing ML Engine Python dependencies..."
if [ -f "$CODESPACE_DIR/ml-engine/requirements.txt" ]; then
  pip install --no-cache-dir -r "$CODESPACE_DIR/ml-engine/requirements.txt" --quiet 2>/dev/null || true
fi

# ── Create dirs for bind mounts ──────────────────────────────
echo "[3/4] Creating data directories..."
mkdir -p "$CODESPACE_DIR/ml-engine/data"
mkdir -p "$CODESPACE_DIR/ml-engine/models/store"
mkdir -p "$CODESPACE_DIR/mlflow/artifacts"

# ── Bootstrap .env if not present ────────────────────────────
echo "[4/4] Checking environment file..."
if [ ! -f "$CODESPACE_DIR/.env" ]; then
  if [ -f "$CODESPACE_DIR/.devcontainer/.env.codespaces.example" ]; then
    cp "$CODESPACE_DIR/.devcontainer/.env.codespaces.example" "$CODESPACE_DIR/.env"
    echo "      Created .env from .env.codespaces.example — review and fill secrets if needed."
  fi
else
  echo "      .env already exists — skipping."
fi

echo "== post-create complete =="
