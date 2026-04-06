#!/bin/bash
# Sign Docker Images with Cosign
# Usage: ./scripts/sign-images.sh <image> [--key <key-file>] [--output <signature-file>]
# Requires: Cosign installed and configured

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
IMAGE=""
KEY_FILE="${COSIGN_KEY_FILE:-${HOME}/.cosign/cosign.key}"
OUTPUT_DIR="${PROJECT_ROOT}/signatures"
SIGN=true
VERIFY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --image|-i)
            IMAGE="$2"
            shift 2
            ;;
        --key|-k)
            KEY_FILE="$2"
            shift 2
            ;;
        --output|-o)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --verify)
            VERIFY=true
            SIGN=false
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --image <image>     Image to sign/verify (required)"
            echo "  --key <file>       Cosign private key [default: ~/.cosign/cosign.key]"
            echo "  --output <dir>     Output directory for signatures [default: ./signatures]"
            echo "  --verify           Verify image instead of signing"
            echo "  --help             Show this help"
            echo ""
            echo "Environment Variables:"
            echo "  COSIGN_KEY_FILE    Path to Cosign private key"
            echo "  COSIGN_PASSWORD    Password for private key"
            echo ""
            echo "Examples:"
            echo "  $0 --image ghcr.io/tradersapp/ml-engine:latest"
            echo "  $0 --image ghcr.io/tradersapp/bff:latest --key /path/to/key.pem"
            echo "  $0 --image ghcr.io/tradersapp/ml-engine:latest --verify"
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            exit 1
            ;;
        *)
            IMAGE="$1"
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "$IMAGE" ]]; then
    echo -e "${RED}Error: Image is required${NC}"
    echo "Usage: $0 --image <image>"
    exit 1
fi

# Check if Cosign is installed
if ! command -v cosign &> /dev/null; then
    echo -e "${RED}Cosign not found${NC}"
    echo "Install: https://docs.sigstore.dev/cosign/installation/"
    exit 1
fi

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Cosign Image Signing${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "Image: ${IMAGE}"
echo -e "Key: ${KEY_FILE}"
echo ""

if [[ "$SIGN" == true ]]; then
    # Signing mode
    echo -e "${YELLOW}Signing image...${NC}"

    # Check if key file exists
    if [[ ! -f "$KEY_FILE" ]]; then
        echo -e "${RED}Key file not found: ${KEY_FILE}${NC}"
        echo "Generate a key pair:"
        echo "  cosign generate-key-pair"
        exit 1
    fi

    # Create output directory
    mkdir -p "${OUTPUT_DIR}"

    # Sign the image
    if [[ -n "${COSIGN_PASSWORD:-}" ]]; then
        COSIGN_PASSWORD="${COSIGN_PASSWORD}" cosign sign \
            --key "${KEY_FILE}" \
            --output-signature "${OUTPUT_DIR}/${IMAGE##*/}.sig" \
            --output-certificate "${OUTPUT_DIR}/${IMAGE##*/}.pem" \
            "$IMAGE"
    else
        cosign sign \
            --key "${KEY_FILE}" \
            --output-signature "${OUTPUT_DIR}/${IMAGE##*/}.sig" \
            --output-certificate "${OUTPUT_DIR}/${IMAGE##*/}.pem" \
            "$IMAGE"
    fi

    echo ""
    echo -e "${GREEN}✅ Image signed successfully${NC}"
    echo -e "Signature: ${OUTPUT_DIR}/${IMAGE##*/}.sig"
    echo -e "Certificate: ${OUTPUT_DIR}/${IMAGE##*/}.pem"

elif [[ "$VERIFY" == true ]]; then
    # Verification mode
    echo -e "${YELLOW}Verifying image signature...${NC}"

    # Look for signature file
    SIG_FILE="${OUTPUT_DIR}/${IMAGE##*/}.sig"
    CERT_FILE="${OUTPUT_DIR}/${IMAGE##*/}.pem"

    if [[ -f "$SIG_FILE" ]]; then
        cosign verify \
            --key "${KEY_FILE}" \
            --signature "${SIG_FILE}" \
            "$IMAGE"

        echo ""
        echo -e "${GREEN}✅ Image signature verified${NC}"
    else
        echo -e "${RED}Signature file not found: ${SIG_FILE}${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}============================================${NC}"
