# TradersApp — Prompt Template

**Last Updated:** 2026-04-02
**Purpose:** Copy-paste this template at the start of every new Claude/OpenClaw session.

---

## COPY-PASTE THIS BLOCK AT SESSION START

```
═══════════════════════════════════════════════════════
TRADERSAPP SESSION START — 2026-04-02
═══════════════════════════════════════════════════════

PROJECT CONTEXT:
- TradersApp: Real-time quantitative trading intelligence platform
- Repo: c:\Users\Asus\Desktop\TradersApp
- Stack: React + Vite (frontend), Node.js BFF (port 8788), Python FastAPI ML Engine (port 8001)
- Secrets: Infisical (never in Git)

KEY FILES FOR THIS SESSION:
[Paste only the 2-3 files you'll be touching]

LAST WORKING COMMIT: [run: git log --oneline -1]
[Paste last 3 commits from: git log --oneline -3]

═══════════════════════════════════════════════════════
WORKFLOW RULES (Non-Negotiable)
═══════════════════════════════════════════════════════

1. EVIDENCE FIRST: Before writing ANY code, I will list:
   "Evidence examined: [exact file:line references]"

2. TEST FIRST: If changing ML code, write or verify test BEFORE code

3. EVIDENCE-BASED FIX: After code output, I will run tests/logs
   and paste exact error output. You will only fix based on
   REAL evidence, never guesses.

4. SAFETY OVER SPEED: Prioritize correctness over speed.
   Trading code = financial risk. No shortcuts.

5. BACKUP BEFORE CHANGE: Run python scripts/auto_backup.py "description"
   BEFORE any significant change.

6. EDGE CASES FIRST: Check EDGE-CASES.md before touching data/execution code.

7. NO LIVE ORDERS: This platform does NOT execute trades.
   All outputs are analysis signals only.

═══════════════════════════════════════════════════════
RELEVANT DOMAIN RULES
═══════════════════════════════════════════════════════

[Paste from DOMAIN-RULES.md — relevant section only]
[Paste from SPEC.md — relevant requirement section]
[Paste from LEGACY-PATTERNS.md — relevant pattern]

═══════════════════════════════════════════════════════
MY REQUEST:
[Write your specific request here]

═══════════════════════════════════════════════════════
```

---

## EVIDENCE-FIRST PROMPT EXAMPLE

```
Evidence examined:
- ml-engine/models/direction/direction_model.py:45-52 (predict method)
- ml-engine/features/feature_pipeline.py:12-18 (feature list)
- ml-engine/config.py:7-10 (feature flags)

Implement the predict() method for DirectionModel using the
features defined in feature_pipeline. Follow the exact pattern
from LEGACY-PATTERNS.md section 4. Return NEUTRAL fallback on error.
Do NOT use any future-looking features (e.g., current close).
```

---

## POST-CHANGE VERIFICATION PROMPT

```
I ran: [paste command + output]

Test output: [paste test results]
Error: [paste error if any]

Based on this evidence, fix the issue. Do not change anything
outside the scope of the error.
```

---

## DAILY SESSION END CHECKLIST

Before ending every session:
1. ✅ Git commit all changes (if any): `git add . && git commit -m "description"`
2. ✅ Update SPEC.md if any requirements changed
3. ✅ Update EDGE-CASES.md if new edge case discovered
4. ✅ Note any new patterns in LEGACY-PATTERNS.md
5. ✅ Report status to user (what done, what next)
