---
name: create-pr
description: "Use when creating pull requests, writing PR descriptions, drafting PR titles, or preparing code for review submission. Triggers on 'create PR', 'open pull request', 'write PR description', 'submit for review', or git push + PR creation tasks."
risk: unknown
source: community
---

# Create PR

Guide for creating well-structured pull requests.

## When to Use

- The user asks to create, draft, or submit a pull request
- Writing PR titles and descriptions from commit history or diff
- Preparing code changes for team review

## Workflow

1. **Summarize changes** — Read the diff/commits and write a concise PR title
2. **Write description** — Include: what changed, why, how to test, and any breaking changes
3. **Checklist** — Verify tests pass, lint clean, no secrets, docs updated if needed
4. **Create** — Use git commands or GitHub CLI to push branch and open PR
