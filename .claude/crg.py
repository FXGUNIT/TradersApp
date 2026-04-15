#!/usr/bin/env python3
"""Token-efficient code-review-graph wrapper. Call: python crg.py <tool> [args_json]"""
import subprocess, json, sys

TOOL = "code-review-graph"
ADDR = ["uvx", TOOL, "serve"]

def crg(tool, args=None):
    proc = subprocess.Popen(ADDR, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    msgs = [
        {"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"crg-cli","version":"1"}}},
        {"jsonrpc":"2.0","method":"initialized","params":{}},
        {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":tool,"arguments":args or {}}},
    ]
    out, _ = proc.communicate(input="\n".join(json.dumps(m) for m in msgs).encode(), timeout=60)
    for line in out.decode().splitlines():
        if line.strip():
            try:
                obj = json.loads(line)
                if obj.get("id") == 1 and "result" in obj:
                    return json.loads(obj["result"]["content"][0]["text"])
            except:
                pass
    return {}

if len(sys.argv) < 2:
    print("Usage: crg.py <tool> [args_json]")
    print("Tools:", "build_or_update_graph_tool", "get_architecture_overview_tool", "list_communities_tool",
          "get_community_tool", "list_graph_stats_tool", "find_large_functions_tool",
          "get_impact_radius_tool", "query_graph_tool", "semantic_search_nodes_tool",
          "list_flows_tool", "get_flow_tool", "detect_changes_tool", "refactor_tool",
          "generate_wiki_tool", "get_wiki_page_tool", "list_repos_tool", "cross_repo_search_tool")
    sys.exit(1)

tool = sys.argv[1]
args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
result = crg(tool, args)
print(json.dumps(result, indent=2))
