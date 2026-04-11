---
name: review-changes
description: "Use when reviewing recent code changes, analyzing git diffs, assessing change impact, or performing structured code reviews. Triggers on code review, diff analysis, change impact assessment, or 'what changed' tasks."
---

## Review Changes

Perform a thorough, risk-aware code review using the knowledge graph.

### Steps

1. Run `detect_changes` to get risk-scored change analysis.
2. Run `get_affected_flows` to find impacted execution paths.
3. For each high-risk function, run `query_graph` with pattern="tests_for" to check test coverage.
4. Run `get_impact_radius` to understand the blast radius.
5. For any untested changes, suggest specific test cases.

### Output Format

Provide findings grouped by risk level (high/medium/low) with:

- What changed and why it matters
- Test coverage status
- Suggested improvements
- Overall merge recommendation
