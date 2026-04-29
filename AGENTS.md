# Agent Automation Rules

These rules apply to Codex, Claude Code, GitHub Copilot agent mode, and OpenCode when working in this repository.

## Autonomy

- Work autonomously after the user gives a task list.
- Do not stop for routine reads, edits, terminal commands, MCP calls, or local validation.
- Ask only before actions that are genuinely destructive, such as deleting the project, formatting a drive, rotating/deleting secrets, or pushing irreversible infrastructure changes.
- Never print secret values. Refer to secrets by name only.

## OpenCode CLI Integration

- Use the project wrapper for OpenCode automation:
  `powershell -ExecutionPolicy Bypass -File scripts\agents\open-cli.ps1 ...`
- The wrapper runs from the repository root and injects Infisical secrets when `.infisical.json` is present.
- The wrapper disables OpenCode's Claude-Code compatibility layer so OpenCode does not load global Claude skills or large Claude prompts.
- For one-shot automation, use:
  `powershell -ExecutionPolicy Bypass -File scripts\agents\open-cli.ps1 run "TASK"`
- For the interactive OpenCode TUI, use:
  `powershell -ExecutionPolicy Bypass -File scripts\agents\open-cli.ps1 .`
- For the OpenCode API server, use:
  `powershell -ExecutionPolicy Bypass -File scripts\agents\open-cli.ps1 serve --hostname 127.0.0.1 --port 4096`

## Secret Handling

- Keep provider keys in Infisical, GitHub Secrets, or ignored local env files.
- Do not write API keys, tokens, passwords, or VNC credentials into tracked files.
- Preserve existing secret names exactly unless the user explicitly asks for a rename.

## Verification

- After changing automation config, verify with:
  `powershell -ExecutionPolicy Bypass -File scripts\agents\open-cli.ps1 --version`
  and
  `powershell -ExecutionPolicy Bypass -File scripts\agents\open-cli.ps1 mcp list`
