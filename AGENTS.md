# Agent Automation Rules

These rules apply to Codex, Claude Code, GitHub Copilot, ChatGPT, Gemini, OpenCode, and ANY other AI that touches this codebase. If you're an AI and you see this file, these rules are BINDING on you. No exceptions.

---

## Deploy Process — Binding on All AI Agents

**The One True Deploy Chain:**

```
Push to main
  → CI builds BFF image and pushes to GHCR
  → Watchtower on VPS detects new image, pulls and restarts container
  → Live in ~3 min total, $0 extra cost
```

**Step-by-step for every backend change:**
1. Write code in the correct microservice directory
2. Test locally (docker build / pytest)
3. Commit and push: `git add <files> && git commit -m "type: description" && git push origin main`
4. Wait for CI to pass at: https://github.com/FXGUNIT/TRADERS-REGIMENT/actions
5. Watchtower auto-deploys (~5 min polling interval)
6. Verify: `curl https://bff.173.249.18.14.sslip.io/health`

**What AI agents must NEVER do:**

| Forbidden | Why | Correct Action |
|---|---|---|
| Build image locally and upload to VPS | Bypasses CI, no scan, no SBOM, no rollback | Push code, let CI build |
| SSH into VPS and edit files directly | Changes lost on next deploy | Change code, push, wait |
| `docker commit` to modify running container | Not reproducible, lost on restart | Change Dockerfile, push |
| `workflow_dispatch` for normal deploys | Wastes Actions minutes | Let watchtower handle it |
| Force-push to main | Destroys history, bypasses all checks | Revert properly |

**CI Failure:** Fix the root cause, push a new commit, wait for CI to pass. Do NOT manually deploy to bypass CI.

**Emergency rollback:**
```bash
gh workflow run deploy-contabo.yml --field skip_build=true --field image_tag=<sha> --field skip_bootstrap=true
```

**Adding secrets:**
1. `gh secret set NAME --body "value" --repo FXGUNIT/TRADERS-REGIMENT`
2. Add to allowlist in `scripts/contabo/build-runtime-env.sh` if it reaches the BFF container
3. Commit and push → Watchtower auto-restarts

---

## OpenCode CLI Integration

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
