---
name: explore-codebase
description: "Use when navigating an unfamiliar codebase, understanding project structure, mapping module dependencies, or finding where specific functionality lives. Triggers on codebase exploration, project navigation, 'where is this code', or architecture understanding tasks."
---

## Explore Codebase

Use the code-review-graph MCP tools to explore and understand the codebase.

### Steps

1. Run `list_graph_stats` to see overall codebase metrics.
2. Run `get_architecture_overview` for high-level community structure.
3. Use `list_communities` to find major modules, then `get_community` for details.
4. Use `semantic_search_nodes` to find specific functions or classes.
5. Use `query_graph` with patterns like `callers_of`, `callees_of`, `imports_of` to trace relationships.
6. Use `list_flows` and `get_flow` to understand execution paths.

### Tips

- Start broad (stats, architecture) then narrow down to specific areas.
- Use `children_of` on a file to see all its functions and classes.
- Use `find_large_functions` to identify complex code.
