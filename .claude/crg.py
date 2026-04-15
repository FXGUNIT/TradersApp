#!/usr/bin/env python3
"""Token-efficient code-review-graph MCP wrapper.
Usage:
  python crg.py stats                          — graph stats
  python crg.py communities [limit] [sort]     — list communities
  python crg.py arch                           — architecture overview
  python crg.py search <query> [limit]         — semantic search
  python crg.py callers <fn>                   — who calls this function
  python crg.py callees <fn>                  — what this function calls
  python crg.py flows [limit]                  — execution flows
  python crg.py large [min_lines] [limit]       — oversized functions
  python crg.py detect                         — changed files impact
  python crg.py impact <file> [depth]          — blast radius
  python crg.py wiki <community>              — wiki page content
"""
import subprocess, json, sys

ADDR = ["uvx", "code-review-graph", "serve"]

TOOL_MAP = {
    "stats":       "list_graph_stats_tool",
    "communities": "list_communities_tool",
    "arch":        "get_architecture_overview_tool",
    "search":      "semantic_search_nodes_tool",
    "callers":     "query_graph_tool",
    "callees":     "query_graph_tool",
    "flows":       "list_flows_tool",
    "large":       "find_large_functions_tool",
    "detect":      "detect_changes_tool",
    "impact":      "get_impact_radius_tool",
    "wiki":        "get_wiki_page_tool",
    "community":   "get_community_tool",
}

def crg(tool, args=None):
    proc = subprocess.Popen(ADDR, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    msgs = [
        {"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"crg","version":"1"}}},
        {"jsonrpc":"2.0","method":"initialized","params":{}},
        {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":tool,"arguments":args or {}}},
    ]
    inp = "\n".join(json.dumps(m) for m in msgs).encode()
    out, _ = proc.communicate(input=inp, timeout=60)
    for line in out.splitlines():
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
            if obj.get("id") == 1 and "result" in obj:
                return json.loads(obj["result"]["content"][0]["text"])
        except Exception:
            pass
    return {}

def fmt_stats(r):
    return f"Files: {r.get('files_count','?')} | Nodes: {r.get('total_nodes','?')} | Edges: {r.get('total_edges','?')} | Langs: {', '.join(r.get('languages',[]))}"

def fmt_communities(r, limit=10):
    lines = [f"Communities ({r.get('total','')})"]
    for c in r.get("communities",[])[:limit]:
        lines.append(f"  [{c['size']:4d}] {c['name']} ({c['dominant_language']}) — {c.get('description','')}")
    return "\n".join(lines)

def fmt_arch(r):
    lines = [f"Architecture ({r.get('total_communities','?')} communities)"]
    for c in r.get("communities",[]):
        lines.append(f"  [{c['size']:4d}] {c['name']} — {c.get('description','')}")
    if r.get("warnings"):
        lines.append("WARNINGS: " + "; ".join(r["warnings"]))
    return "\n".join(lines)

def fmt_search(r):
    if not r.get("nodes"): return "No results"
    lines = [f"Search results ({len(r['nodes'])}):"]
    for n in r["nodes"][:10]:
        lines.append(f"  [{n['kind']}] {n['qualified_name']} — {n.get('file','')}")
    return "\n".join(lines)

def fmt_flows(r):
    lines = [f"Execution flows ({r.get('total','')})"]
    for f in r.get("flows",[])[:10]:
        lines.append(f"  [{f['criticality']:.2f}] {f['name']} — {len(f['steps'])} steps")
    return "\n".join(lines)

def fmt_large(r):
    lines = [f"Large functions ({len(r.get('functions',[]))} found):"]
    for f in r.get("functions",[])[:15]:
        lines.append(f"  [{f['lines']:4d}] {f['qualified_name']} — {f.get('file','')}")
    return "\n".join(lines)

def fmt_query(r):
    lines = []
    for n in r.get("nodes",[])[:20]:
        lines.append(f"  [{n['kind']}] {n['qualified_name']} @ {n.get('file','')}:{n.get('line_start','')}")
    return "\n".join(lines) if lines else "No results"

def fmt_impact(r):
    lines = [f"Impact radius ({r.get('total_affected','?')} nodes affected):"]
    for n in r.get("affected_nodes",[])[:15]:
        lines.append(f"  [{n['kind']}] {n['qualified_name']} @ {n.get('file','')}")
    return "\n".join(lines)

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "stats"
    rest = sys.argv[2:]

    if cmd == "stats":
        r = crg(TOOL_MAP["stats"])
        print(fmt_stats(r))

    elif cmd == "communities":
        limit = int(rest[0]) if rest else 10
        sortby = rest[1] if len(rest) > 1 else "size"
        r = crg(TOOL_MAP["communities"], {"sort_by": sortby, "limit": limit})
        print(fmt_communities(r, limit))

    elif cmd == "arch":
        r = crg(TOOL_MAP["arch"])
        print(fmt_arch(r))

    elif cmd == "search":
        query = rest[0] if rest else ""
        limit = int(rest[1]) if len(rest) > 1 else 10
        r = crg(TOOL_MAP["search"], {"query": query, "limit": limit})
        print(fmt_search(r))

    elif cmd == "callers":
        fn = rest[0] if rest else ""
        r = crg(TOOL_MAP["callers"], {"pattern": "callers_of", "target": fn})
        print(f"Callers of {fn}:\n{fmt_query(r)}")

    elif cmd == "callees":
        fn = rest[0] if rest else ""
        r = crg(TOOL_MAP["callees"], {"pattern": "callees_of", "target": fn})
        print(f"Callees of {fn}:\n{fmt_query(r)}")

    elif cmd == "flows":
        limit = int(rest[0]) if rest else 20
        r = crg(TOOL_MAP["flows"], {"sort_by": "criticality", "limit": limit})
        print(fmt_flows(r))

    elif cmd == "large":
        min_lines = int(rest[0]) if rest else 50
        limit = int(rest[1]) if len(rest) > 1 else 20
        r = crg(TOOL_MAP["large"], {"min_lines": min_lines, "limit": limit})
        print(fmt_large(r))

    elif cmd == "detect":
        r = crg(TOOL_MAP["detect"])
        print(json.dumps(r, indent=2)[:2000])

    elif cmd == "impact":
        fn = rest[0] if rest else ""
        depth = int(rest[1]) if len(rest) > 1 else 2
        r = crg(TOOL_MAP["impact"], {"changed_files": [fn], "max_depth": depth})
        print(fmt_impact(r))

    elif cmd == "wiki":
        name = rest[0] if rest else ""
        r = crg(TOOL_MAP["wiki"], {"community_name": name})
        print(r.get("content", r)[:2000])

    elif cmd == "community":
        name = rest[0] if rest else ""
        r = crg(TOOL_MAP["community"], {"community_name": name, "include_members": True})
        print(json.dumps(r, indent=2)[:2000])

    else:
        print(__doc__)

if __name__ == "__main__":
    main()
