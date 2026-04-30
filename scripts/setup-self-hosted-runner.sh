#!/usr/bin/env bash
# scripts/setup-self-hosted-runner.sh
# Registers the Contabo VPS as a GitHub Actions self-hosted runner.
# Run this ONCE on the VPS (via SSH).
#
# Prerequisites:
#   - SSH access to Contabo VPS
#   - GitHub repo: Settings → Actions → Runners → "New self-hosted runner"
#   - Copy the runner registration token from that page
#
# Usage (from your LOCAL machine):
#   ssh contabo@173.249.18.14 bash -c "$(cat scripts/setup-self-hosted-runner.sh)" \
#     RUNNER_TOKEN="g4xxxxxxx" RUNNER_LABEL="contabo-vps"

set -euo pipefail

RUNNER_TOKEN="${RUNNER_TOKEN:-}"
REPO="${REPO:-FXGUNIT/TRADERS-REGIMENT}"
RUNNER_DIR="${RUNNER_DIR:-/opt/actions-runner}"
RUNNER_LABEL="${RUNNER_LABEL:-contabo-vps}"
RUNNER_NAME="${RUNNER_NAME:-tradersapp-runner}"

if [ -z "${RUNNER_TOKEN}" ]; then
  echo "Usage: RUNNER_TOKEN=g4xxxxxxx bash scripts/setup-self-hosted-runner.sh"
  echo ""
  echo "Get token from: https://github.com/${REPO}/settings/actions/runners/new"
  echo "  → Choose: Linux, x64, download the runner"
  exit 1
fi

ARCH=$(uname -m)
case "$ARCH" in
  x86_64) ARCH_NAME="x64" ;;
  aarch64|arm64) ARCH_NAME="arm64" ;;
  *) echo "Unsupported arch: $ARCH"; exit 1 ;;
esac

echo "━━━ Setting up self-hosted runner on $(hostname) ━━━"
echo "  Repo: ${REPO}"
echo "  Arch: ${ARCH_NAME}"
echo "  Dir:  ${RUNNER_DIR}"

# Create runner user if not exists
if ! id runner &>/dev/null; then
  echo "[1/5] Creating runner user..."
  useradd --system --shell /bin/bash --comment "GitHub Actions Runner" runner
fi

# Install dependencies
echo "[2/5] Installing dependencies..."
if command -v apt-get &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq curl jq docker.io >/dev/null 2>&1
elif command -v apk &>/dev/null; then
  apk add --no-cache curl jq docker
fi

# Ensure docker is running
if ! docker info &>/dev/null; then
  echo "[!] Docker not running — attempting to start..."
  if command -v systemctl &>/dev/null; then
    systemctl start docker || service docker start || true
  fi
fi

# Create and enter runner directory
mkdir -p "${RUNNER_DIR}"
cd "${RUNNER_DIR}"

# Download runner if not already present
if [ ! -f "./bin/github-runner-root" ] && [ ! -f "./config.sh" ]; then
  echo "[3/5] Downloading GitHub Actions runner..."
  RUNNER_VERSION=$(curl -s https://api.github.com/repos/actions/runner/releases/latest | jq -r '.tag_name' | sed 's/v//')
  curl -sL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-${ARCH_NAME}-${RUNNER_VERSION}.tar.gz" | tar xz
fi

# Configure runner
echo "[4/5] Configuring runner..."
# Unregister if already registered
if [ -f ".runner" ]; then
  echo "  Runner already configured — skipping config step"
else
  ./config.sh \
    --url "https://github.com/${REPO}" \
    --token "${RUNNER_TOKEN}" \
    --name "${RUNNER_NAME}" \
    --label "${RUNNER_LABEL}" \
    --labels "${RUNNER_LABEL},docker,linux,self-hosted" \
    --unattended \
    --replace \
    --ephemeral
fi

# Install as systemd service
echo "[5/5] Installing systemd service..."
if command -v systemctl &>/dev/null; then
  sudo ./svc.sh install runner 2>/dev/null || \
    ./bin/installdependencies.sh || true
  sudo ./svc.sh start

  echo "✅ Runner installed and started"
  echo "   Status: $(sudo ./svc.sh status 2>&1 | head -1)"
  echo "   Logs:   journalctl -u actions.runner.* -f"
else
  echo "⚠ No systemd — starting in foreground mode"
  echo "   To run: cd ${RUNNER_DIR} && ./run.sh"
fi

echo ""
echo "━━━ Verify ━━━"
curl -s https://api.github.com/repos/${REPO}/actions/runners \
  | jq -r '.runners[] | select(.name == "'"${RUNNER_NAME}"'" or .labels[].name == "'"${RUNNER_LABEL}"'") | "\(.name) — \(.status)"' 2>/dev/null \
  || echo "Check at: https://github.com/${REPO}/settings/actions/runners"