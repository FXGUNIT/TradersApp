#!/bin/bash
# ADR Creation Script
# Usage: ./scripts/create-adr.sh "Decision Title" [--id N]
# Example: ./scripts/create-adr.sh "PostgreSQL for Primary Database"
# Example: ./scripts/create-adr.sh "Redis Cache" --id 018

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADR_DIR="${SCRIPT_DIR}/../docs/adr"
TEMPLATE_FILE="${ADR_DIR}/TEMPLATE.md"
README_FILE="${ADR_DIR}/README.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
if [ $# -lt 1 ]; then
    echo -e "${RED}Error: Decision title required${NC}"
    echo "Usage: $0 \"Decision Title\" [--id N]"
    exit 1
fi

DECISION_TITLE="$1"
ADR_ID=""
FORCE_ID=false

# Parse optional --id flag
if [ $# -ge 2 ]; then
    if [ "$2" == "--id" ] && [ $# -eq 4 ]; then
        ADR_ID="$3"
        FORCE_ID=true
    elif [ "$2" == "--id" ]; then
        echo -e "${RED}Error: --id requires a number${NC}"
        exit 1
    fi
fi

# Convert title to kebab-case for filename
slugify() {
    echo "$1" | sed 's/ /-/g' | sed 's/[^a-zA-Z0-9-]//g' | tr '[:upper:]' '[:lower:]'
}

# Find next available ADR number
find_next_id() {
    local max_id=0
    for file in "${ADR_DIR}"/ADR-*.md; do
        if [ -f "$file" ]; then
            local id
            id=$(basename "$file" | grep -oP 'ADR-\d+' | grep -oP '\d+')
            if [ "$id" -gt "$max_id" ]; then
                max_id=$id
            fi
        fi
    done
    printf "%03d" $((max_id + 1))
}

# Generate slug from title
generate_slug() {
    local title="$1"
    echo "$title" | sed 's/[^a-zA-Z0-9 ]//g' | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/--/-/g' | sed 's/^-//' | sed 's/-$//'
}

# Validate template exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo -e "${RED}Error: Template file not found at ${TEMPLATE_FILE}${NC}"
    exit 1
fi

# Get ADR ID
if [ -z "$ADR_ID" ]; then
    ADR_ID=$(find_next_id)
fi

# Generate filenames
SLUG=$(generate_slug "$DECISION_TITLE")
FILENAME="ADR-${ADR_ID}-${SLUG}.md"
FILEPATH="${ADR_DIR}/${FILENAME}"

# Check if file already exists
if [ -f "$FILEPATH" ]; then
    echo -e "${YELLOW}Warning: ${FILEPATH} already exists${NC}"
    if [ "$FORCE_ID" == "false" ]; then
        echo "Use --id flag to force specific ID"
        exit 1
    fi
fi

# Get current date in YYYY-MM-DD format
CURRENT_DATE=$(date '+%Y-%m-%d')

# Create the ADR file
cat > "$FILEPATH" << EOF
# ADR-${ADR_ID}: ${DECISION_TITLE}

**ADR ID:** ADR-${ADR_ID}
**Title:** ${DECISION_TITLE}
**Status:** Proposed
**Date:** ${CURRENT_DATE}
**Author:** Claude

## Context

[What is the issue that we're seeing that is motivating this decision or change?]

## Decision

[What is the change that we're proposing and/or doing?]

## Consequences

### Positive
- [List of beneficial outcomes]

### Negative
- [List of harmful outcomes or tradeoffs]

### Neutral
- [List of outcomes that are neither clearly positive nor negative]

## Alternatives Considered

### Alternative 1: [Name]
- **Pros:** [Benefits]
- **Cons:** [Drawbacks]
- **Why rejected:** [Reason]

### Alternative 2: [Name]
- **Pros:** [Benefits]
- **Cons:** [Drawbacks]
- **Why rejected:** [Reason]

## References

- [Link to relevant documentation]
- Related ADRs: [ADR-XXX, ADR-YYY]

---

*Created with: ./scripts/create-adr.sh*
EOF

echo -e "${GREEN}Created: ${FILEPATH}${NC}"
echo ""
echo "Next steps:"
echo "1. Edit the file and fill in the details"
echo "2. Update status to 'Accepted' when approved"
echo "3. Add to README.md index if needed"
