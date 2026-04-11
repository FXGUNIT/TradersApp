#!/bin/bash
# session-start hook — runs when Claude Code session begins
# CLAUDE.md and required project files are auto-loaded by Claude Code.
# This hook provides the startup banner only.

echo "=========================================="
echo "  TradersApp — Claude Code Session Active"
echo "=========================================="
echo ""
echo "  Microservices:  src/ | bff/ | ml-engine/ | telegram-bridge/"
echo "  Scoping:       ENABLED — error text auto-detects microservice"
echo "  Token economy: Aggressive compaction at 60% context"
echo "  Memory:        Persistent memory system active (.claude/memory/)"
echo ""
echo "  Required files auto-loaded:"
echo "    CLAUDE.md         — Architecture bible"
echo "    SPEC.md           — Requirements & blockers"
echo "    EDGE-CASES.md     — Market scenarios"
echo "    DOMAIN-RULES.md   — Trading rules"
echo "    LEGACY-PATTERNS.md— Existing patterns"
echo "    PROMPT-TEMPLATE.md— Session starter"
echo ""
echo "  Rules active:"
echo "    Autonomy:       No permission prompts, auto-approve all actions"
echo "    90% Accuracy:   Every task must be 90%+ correct before completion"
echo "    Evidence First: List file:line refs before writing any code"
echo "    Tests First:    Write test, paste failure, then implement"
echo "    Scoped:         Reply starts with 'Scoped to: [folder] — [desc]'"
echo "=========================================="
