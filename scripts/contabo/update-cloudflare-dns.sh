#!/usr/bin/env bash
# Legacy traders.app DNS helper kept for archived Cloudflare-managed host flows.
# The current canonical public frontend is https://tradergunit.pages.dev/.
# Updates Cloudflare DNS A records for TradersApp after Contabo deployment.
# Requires CLOUDFLARE_API_EMAIL and CLOUDFLARE_API_KEY env vars.
# Usage: ./update-cloudflare-dns.sh <contabo_ip>
# Example: ./update-cloudflare-dns.sh 173.249.18.14

set -euo pipefail

CF_EMAIL="${CLOUDFLARE_API_EMAIL:?Missing CLOUDFLARE_API_EMAIL}"
CF_KEY="${CLOUDFLARE_API_KEY:?Missing CLOUDFLARE_API_KEY}"
CF_ZONE_ID="${CLOUDFLARE_ZONE_ID:-2e37170e38f507ea989a79ca587a85e1}"
CF_DOMAIN="${CLOUDFLARE_DOMAIN:-traders.app}"
TARGET_IP="${1:-}"

if [ -z "${TARGET_IP}" ]; then
  echo "Usage: $0 <contabo_ip>" >&2
  echo "Example: $0 173.249.18.14" >&2
  exit 1
fi

echo "[cloudflare-dns] Target IP: ${TARGET_IP}"
echo "[cloudflare-dns] Domain: ${CF_DOMAIN}"

cf_api() {
  curl -s "https://api.cloudflare.com/client/v4/$1" \
    -H "X-Auth-Email: ${CF_EMAIL}" \
    -H "X-Auth-Key: ${CF_KEY}" \
    -H "Content-Type: application/json" \
    "$@"
}

update_a_record() {
  local name="$1"
  local proxied="${2:-false}"

  echo "[cloudflare-dns] Updating A record: ${name} -> ${TARGET_IP}"

  local existing
  existing=$(cf_api "zones/${CF_ZONE_ID}/dns_records?type=A&name=${name}&per_page=1" | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print(d['result'][0]['id'] if d.get('result') and d['result'][0]['name']==d['result'][0]['name'] else '')" 2>/dev/null || true)

  if [ -z "${existing}" ]; then
    echo "[cloudflare-dns] Creating new A record: ${name}"
    cf_api "zones/${CF_ZONE_ID}/dns_records" -X POST \
      --data "$(printf '{"type":"A","name":"%s","content":"%s","proxied":%s,"ttl":3600}' "${name}" "${TARGET_IP}" "${proxied}")" | \
      python3 -c "import json,sys; d=json.load(sys.stdin); print('Created: ' + str(d.get('success')) + ' ' + str(d.get('errors')))"
  else
    echo "[cloudflare-dns] Updating existing record ID: ${existing}"
    cf_api "zones/${CF_ZONE_ID}/dns_records/${existing}" -X PUT \
      --data "$(printf '{"type":"A","name":"%s","content":"%s","proxied":%s,"ttl":3600}' "${name}" "${TARGET_IP}" "${proxied}")" | \
      python3 -c "import json,sys; d=json.load(sys.stdin); print('Updated: ' + str(d.get('success')) + ' ' + str(d.get('errors')))"
  fi
}

update_a_record "${CF_DOMAIN}" "false"
update_a_record "bff.${CF_DOMAIN}" "false"
update_a_record "api.${CF_DOMAIN}" "false"

echo "[cloudflare-dns] Done. Note: TTL is 3600 — allow up to 60 min for full propagation."
echo "[cloudflare-dns] Verify with: curl -s https://cloudflare-dns.com/dns-query?name=${CF_DOMAIN}\&type=A -H 'Accept: application/dns-json'"
