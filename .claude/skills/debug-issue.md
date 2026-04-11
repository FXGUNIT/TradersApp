---
name: debug-issue
description: "Use when systematically debugging issues, tracing call chains, finding root causes, or analyzing code flow paths. Triggers on debug, trace error, find root cause, call chain analysis, or 'why is this failing' tasks."
---

## Debug Issue

Use the knowledge graph to systematically trace and debug issues.

### Steps

1. Use `semantic_search_nodes` to find code related to the issue.
2. Use `query_graph` with `callers_of` and `callees_of` to trace call chains.
3. Use `get_flow` to see full execution paths through suspected areas.
4. Run `detect_changes` to check if recent changes caused the issue.
5. Use `get_impact_radius` on suspected files to see what else is affected.

### Tips

- Check both callers and callees to understand the full context.
- Look at affected flows to find the entry point that triggers the bug.
- Recent changes are the most common source of new issues.
