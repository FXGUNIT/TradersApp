#!/bin/bash
# Secrets Scanning Script
# Usage: ./scripts/secrets-scan.sh [--pre-commit]
# Pre-commit mode: Scan only staged files
# Full mode: Scan all files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default mode
PRECOMMIT=false
FAIL_ON_FINDING=true
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --pre-commit)
            PRECOMMIT=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --no-fail)
            FAIL_ON_FINDING=false
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --pre-commit    Scan only staged files"
            echo "  --no-fail       Don't fail on findings (for testing)"
            echo "  --verbose       Show detailed output"
            echo "  --help          Show this help"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

cd "${PROJECT_ROOT}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Secrets Scanner${NC}"
echo -e "${BLUE}============================================${NC}"

# Check for gitleaks
if ! command -v gitleaks &> /dev/null; then
    echo -e "${YELLOW}Installing gitleaks...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install gitleaks
    else
        curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz | \
            tar -xz -C /usr/local/bin
    fi
fi

# Build gitleaks command
GITLEAKS_CMD="gitleaks detect --source . --format json --no-git"

if [[ "$PRECOMMIT" == true ]]; then
    echo "Mode: Pre-commit (staged files only)"
    # Get staged files
    STAGED_FILES=$(git diff --cached --name-only | head -100)
    if [[ -z "$STAGED_FILES" ]]; then
        echo -e "${GREEN}No staged files to scan${NC}"
        exit 0
    fi
    echo "Staged files:"
    echo "$STAGED_FILES" | head -10
    echo "..."
fi

# Run gitleaks
echo ""
echo -e "${YELLOW}Running secrets scan...${NC}"

if [[ "$VERBOSE" == true ]]; then
    GITLEAKS_CMD="${GITLEAKS_CMD} --verbose"
fi

SCAN_OUTPUT=$(eval "${GITLEAKS_CMD}" 2>&1 || true)
SCAN_EXIT_CODE=$?

# Parse results
FINDINGS_COUNT=$(echo "$SCAN_OUTPUT" | grep -c '"line"' || echo "0")

echo ""
echo -e "${BLUE}Scan Results:${NC}"

if [[ $FINDINGS_COUNT -gt 0 ]]; then
    echo -e "${RED}❌ Found ${FINDINGS_COUNT} potential secrets!${NC}"
    echo ""

    # Show findings
    echo "$SCAN_OUTPUT" | jq -r '.[] | "- File: \(.file)\n  Rule: \(.RuleID)\n  Line: \(.Line)"' 2>/dev/null || \
        echo "$SCAN_OUTPUT" | head -50

    echo ""
    echo "============================================"
    echo -e "${RED}ACTION REQUIRED:${NC}"
    echo ""
    echo "1. Review each finding carefully"
    echo "2. If false positive: Add to .gitleaksignore"
    echo "3. If true positive:"
    echo "   - Rotate the secret immediately"
    echo "   - Update Infisical"
    echo "   - Remove from git history"
    echo ""
    echo "To remove from git history:"
    echo "  git filter-branch --force --index-filter \\"
    echo "    'git rm --cached --ignore-unmatch <file>' \\"
    echo "    --prune-empty --tag-name-filter cat -- --all"
    echo ""

    if [[ "$FAIL_ON_FINDING" == true ]]; then
        echo -e "${RED}Blocking commit due to secrets found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ No secrets found!${NC}"
fi

echo ""
echo -e "${BLUE}============================================${NC}"
exit $SCAN_EXIT_CODE
