---
description: Start the OpenCode headless API server with project config and Infisical secrets.
allowed-tools: Bash(powershell -ExecutionPolicy Bypass -File scripts/agents/open-cli.ps1*)
---

Start the OpenCode server for local automation:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\agents\open-cli.ps1 serve --hostname 127.0.0.1 --port 4096
```

Use this only when a running OpenCode API server is useful for the current task. Stop the process when it is no longer needed.
