---
description: Run a one-shot OpenCode CLI automation task through Infisical.
argument-hint: "[task prompt]"
allowed-tools: Bash(powershell -ExecutionPolicy Bypass -File scripts/agents/open-cli.ps1*)
---

Run this OpenCode automation command from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\agents\open-cli.ps1 run "$ARGUMENTS"
```

Use this when the user wants another agent pass, repo automation, code review assistance, or a scripted OpenCode answer. Keep secrets hidden and summarize only outcomes.
