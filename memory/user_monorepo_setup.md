---
name: user_zero_micromanagement
description: User wants ZERO micromanagement. No file clicking, no folder switching, no typing names. Paste error → type "fix this error" → done.
type: feedback
---

User is a complete beginner. All work done by AI.

**Zero-Micromanagement Setup (created 2026-04-03):**
- `.claudeignore` created — ignores node_modules/, dist/, __pycache__, archives, large data
- `CLAUDE.md` updated — added Monorepo Scoping section at top
- `.claude/settings.json` — aggressive compaction at 60% context
- `.claude/rules/scoping.md` — strict scoping rules
- `.claude/hooks/session-start.sh` — prints scope info on session start
- `FIX-ERROR.md` — one-line instruction: paste error → type "fix this error"

**Scope Detection Rules:**
- Error pasted → detect microservice from stack trace/file paths → scope ONLY to that folder
- File open in editor → use that file's folder
- Unclear → ask for error text only, never ask for clicks/names

**Detection keywords:** `src/`→Frontend, `bff/`→BFF, `ml-engine/`→ML, `telegram-bridge/`→Telegram

**Token economy:** Use /compact at 60% context. Grep before read. Specific reads, no globbing.
