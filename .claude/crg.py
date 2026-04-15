#!/usr/bin/env python3
"""Token-efficient code-review-graph MCP wrapper for TradersApp."""
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
    "flow":        "get_flow_tool",
    "repos":       "list_repos_tool",
}

def crg(tool, args=None, retries=4):
    """Call an MCP tool, return parsed JSON result. Retries on cold-start."""
    import time as _time
    for attempt in range(retries):
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
        _time.sleep(0.3 * (attempt + 1))
    return {}

def fmt_stats(r):
    langs = ", ".join(r.get("languages", []))
    nbyp = r.get("nodes_by_kind", {})
    ebyp = r.get("edges_by_kind", {})
    return (
        f"Files: {r.get('files_count','?')} | Nodes: {r.get('total_nodes','?')} | Edges: {r.get('total_edges','?')}\n"
        f"Langs: {langs} | Last: {r.get('last_updated','')}\n"
        f"Nodes: {nbyp} | Edges: {ebyp}"
    )

def fmt_communities(r, limit=15):
    total = r.get("summary","")
    lines = [f"Communities ({total}):"]
    for c in r.get("communities", [])[:limit]:
        lines.append(f"  [{c['size']:5d}] {c['name']} ({c['dominant_language']})")
    return "\n".join(lines)

def fmt_arch(r):
    lines = [f"Architecture ({r.get('total_communities','?')} communities):"]
    for c in r.get("communities", []):
        lines.append(f"  [{c['size']:5d}] {c['name']} — {c.get('description','')}")
    if r.get("warnings"):
        lines.append("WARNINGS: " + "; ".join(r["warnings"]))
    return "\n".join(lines)

def fmt_search(r):
    if not r.get("nodes"):
        return f"No results (query: {r.get('query','')})"
    lines = [f"Search results ({len(r['nodes'])}):"]
    for n in r["nodes"][:15]:
        lines.append(f"  [{n.get('kind','?')}] {n.get('qualified_name','?')} @ {n.get('file','')}:{n.get('line_start','')}")
    return "\n".join(lines)

def fmt_flows(r):
    total = r.get("summary","")
    lines = [f"Execution flows ({total}):"]
    for f in r.get("flows", [])[:10]:
        lines.append(f"  [{f['criticality']:.3f}] depth={f['depth']} nodes={f['node_count']} files={f['file_count']} | {f['name']}")
    return "\n".join(lines)

def fmt_large(r):
    fns = r.get("results", []) or r.get("functions", [])
    if not fns:
        return f"No oversized functions found (min={r.get('min_lines','?')})"
    lines = [f"Large functions ({len(fns)} found):"]
    for f in fns[:20]:
        lines.append(f"  [{f.get('lines','?'):4d}] {f.get('qualified_name','?')} @ {f.get('file','')}:{f.get('line_start','')}")
    return "\n".join(lines)

def fmt_query(r, label=""):
    nodes = r.get("nodes", [])
    if not nodes:
        return f"No callers/callees found"
    lines = [label]
    for n in nodes[:25]:
        lines.append(f"  [{n.get('kind','?')}] {n.get('qualified_name','?')} @ {n.get('file','')}:{n.get('line_start','')}")
    return "\n".join(lines)

def fmt_impact(r):
    affected = r.get("affected_nodes", [])
    total = r.get("total_affected", len(affected))
    changed = r.get("changed_files", [])
    lines = [f"Impact: {total} nodes across {len(changed)} file(s): {changed[:3]}"]
    for n in affected[:15]:
        lines.append(f"  [{n.get('kind','?')}] {n.get('qualified_name','?')} @ {n.get('file','')}")
    return "\n".join(lines)

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "stats"
    rest = sys.argv[2:]

    if cmd == "stats":
        print(fmt_stats(crg(TOOL_MAP["stats"])))

    elif cmd == "communities":
        limit = int(rest[0]) if rest else 15
        r = crg(TOOL_MAP["communities"], {"sort_by": "size"})
        print(fmt_communities(r, limit))

    elif cmd == "arch":
        print(fmt_arch(crg(TOOL_MAP["arch"])))

    elif cmd == "search":
        query = rest[0] if rest else ""
        kind = rest[1] if len(rest) > 1 else None
        r = crg(TOOL_MAP["search"], {"query": query, "kind": kind} if kind else {"query": query})
        print(fmt_search(r))

    elif cmd == "callers":
        fn = rest[0] if rest else ""
        r = crg(TOOL_MAP["callers"], {"pattern": "callers_of", "target": fn})
        print(fmt_query(r, f"Callers of '{fn}':"))

    elif cmd == "callees":
        fn = rest[0] if rest else ""
        r = crg(TOOL_MAP["callees"], {"pattern": "callees_of", "target": fn})
        print(fmt_query(r, f"Callees of '{fn}':"))

    elif cmd == "flows":
        limit = int(rest[0]) if rest else 10
        r = crg(TOOL_MAP["flows"], {"sort_by": "criticality", "limit": limit})
        print(fmt_flows(r))

    elif cmd == "large":
        min_lines = int(rest[0]) if rest else 80
        r = crg(TOOL_MAP["large"], {"min_lines": min_lines})
        print(fmt_large(r))

    elif cmd == "detect":
        r = crg(TOOL_MAP["detect"])
        print(json.dumps(r, indent=2)[:3000])

    elif cmd == "impact":
        fn = rest[0] if rest else ""
        depth = int(rest[1]) if len(rest) > 1 else 2
        r = crg(TOOL_MAP["impact"], {"changed_files": [fn], "max_depth": depth})
        print(fmt_impact(r))

    elif cmd == "wiki":
        name = rest[0] if rest else ""
        r = crg(TOOL_MAP["wiki"], {"community_name": name})
        content = r.get("content", "")
        print(content[:3000] if content else json.dumps(r, indent=2)[:1000])

    elif cmd == "community":
        name = rest[0] if rest else ""
        r = crg(TOOL_MAP["community"], {"community_name": name, "include_members": True})
        print(json.dumps(r, indent=2)[:3000])

    elif cmd == "flow":
        fid = rest[0] if rest else None
        fname = rest[1] if len(rest) > 1 else None
        kwargs = {}
        if fid: kwargs["flow_id"] = int(fid)
        elif fname: kwargs["flow_name"] = fname
        r = crg(TOOL_MAP["flow"], kwargs)
        print(json.dumps(r, indent=2)[:3000])

    elif cmd == "repos":
        r = crg(TOOL_MAP["repos"])
        print(json.dumps(r, indent=2))

    else:
        print(__doc__)
        print("Commands: stats | communities [n] | arch | search <q> [kind] | callers <fn> | callees <fn> | flows [n] | large [min_lines] | detect | impact <file> [depth] | wiki <name> | community <name> | flow [id] [name] | repos")

if __name__ == "__main__":
    main()
