#!/bin/bash
# Trivy Container Security Scanner
# Usage: ./scripts/trivy-scan.sh <image> [--format json|table|sarif]
# Example: ./scripts/trivy-scan.sh ghcr.io/tradersapp/ml-engine:latest
# Example: ./scripts/trivy-scan.sh --fs ./ml-engine

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TRIVY_IGNORE="${PROJECT_ROOT}/.trivyignore"
TRIVY_CONFIG="${PROJECT_ROOT}/.trivy.yaml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
FORMAT="table"
VERBOSE=false
SCAN_TYPE="image"
TARGET=""
OUTPUT_FILE=""
FAIL_ON_CRITICAL=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --image)
            SCAN_TYPE="image"
            TARGET="$2"
            shift 2
            ;;
        --fs)
            SCAN_TYPE="fs"
            TARGET="$2"
            shift 2
            ;;
        --repo)
            SCAN_TYPE="repo"
            TARGET="$2"
            shift 2
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --no-fail)
            FAIL_ON_CRITICAL=false
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --image <image>     Scan container image"
            echo "  --fs <path>         Scan filesystem"
            echo "  --repo <url>        Scan repository"
            echo "  --format <format>    Output format (table|json|sarif) [default: table]"
            echo "  --output <file>      Write output to file"
            echo "  --no-fail           Don't exit with error on critical findings"
            echo "  --verbose           Enable verbose output"
            echo "  --help              Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 --image ghcr.io/tradersapp/ml-engine:latest"
            echo "  $0 --image ghcr.io/tradersapp/bff:latest --format json --output results.json"
            echo "  $0 --fs ./ml-engine --format sarif --output results.sarif"
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            exit 1
            ;;
        *)
            TARGET="$1"
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "$TARGET" ]] && [[ "$SCAN_TYPE" == "image" ]]; then
    echo -e "${RED}Error: Target (image/path) is required${NC}"
    exit 1
fi

# Check if Trivy is installed
if ! command -v trivy &> /dev/null; then
    echo -e "${YELLOW}Trivy not found, installing...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install trivy
    else
        curl -sfL https://aquasecurity.github.io/trivy/v0.50.0/install.sh | sh -s -- -b /usr/local/bin
    fi
fi

# Set output redirect
OUTPUT_REDIR=""
if [[ -n "$OUTPUT_FILE" ]]; then
    OUTPUT_REDIR="--output ${OUTPUT_FILE}"
fi

# Build Trivy command
TRIVY_CMD="trivy --config ${TRIVY_CONFIG} --ignore-file ${TRIVY_IGNORE}"

# Add verbose flag if requested
if [[ "$VERBOSE" == true ]]; then
    TRIVY_CMD="${TRIVY_CMD} --debug"
fi

# Run scan based on type
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Trivy Security Scanner${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "Scan Type: ${SCAN_TYPE}"
echo -e "Target: ${TARGET}"
echo -e "Format: ${FORMAT}"
echo -e "Ignore File: ${TRIVY_IGNORE}"
echo -e ""

case $SCAN_TYPE in
    image)
        echo -e "${BLUE}Scanning image: ${TARGET}${NC}"
        ${TRIVY_CMD} image \
            --severity HIGH,CRITICAL \
            --format ${FORMAT} \
            ${OUTPUT_REDIR} \
            ${TARGET}
        SCAN_RESULT=$?
        ;;
    fs)
        echo -e "${BLUE}Scanning filesystem: ${TARGET}${NC}"
        ${TRIVY_CMD} fs \
            --severity HIGH,CRITICAL \
            --format ${FORMAT} \
            ${OUTPUT_REDIR} \
            ${TARGET}
        SCAN_RESULT=$?
        ;;
    repo)
        echo -e "${BLUE}Scanning repository: ${TARGET}${NC}"
        ${TRIVY_CMD} repo \
            --severity HIGH,CRITICAL \
            --format ${FORMAT} \
            ${OUTPUT_REDIR} \
            ${TARGET}
        SCAN_RESULT=$?
        ;;
esac

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Scan Complete${NC}"
echo -e "${BLUE}============================================${NC}"

# Parse results for summary
if [[ "$FORMAT" == "json" ]] && [[ -n "$OUTPUT_FILE" ]]; then
    CRITICAL_COUNT=$(jq -r '.Results[].Vulnerabilities[] | select(.Severity == "CRITICAL") | .VulnerabilityID' ${OUTPUT_FILE} 2>/dev/null | wc -l || echo "0")
    HIGH_COUNT=$(jq -r '.Results[].Vulnerabilities[] | select(.Severity == "HIGH") | .VulnerabilityID' ${OUTPUT_FILE} 2>/dev/null | wc -l || echo "0")

    echo -e "CRITICAL: ${RED}${CRITICAL_COUNT}${NC}"
    echo -e "HIGH: ${YELLOW}${HIGH_COUNT}${NC}"

    if [[ ${CRITICAL_COUNT} -gt 0 ]] && [[ "$FAIL_ON_CRITICAL" == true ]]; then
        echo ""
        echo -e "${RED}❌ CRITICAL vulnerabilities found!${NC}"
        echo "Add exceptions to .trivyignore or fix the vulnerabilities."
        exit 1
    fi
fi

if [[ ${SCAN_RESULT} -eq 0 ]]; then
    echo -e "${GREEN}✅ No CRITICAL or HIGH vulnerabilities found${NC}"
else
    if [[ "$FAIL_ON_CRITICAL" == true ]]; then
        echo -e "${RED}❌ Scan completed with issues${NC}"
    else
        echo -e "${YELLOW}⚠️  Scan completed with issues (non-blocking)${NC}"
    fi
fi

exit ${SCAN_RESULT}
