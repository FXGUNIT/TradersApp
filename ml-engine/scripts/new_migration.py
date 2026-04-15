#!/usr/bin/env python3
"""
Create a new Alembic migration with a required message.

Examples:
  python ml-engine/scripts/new_migration.py "add user_roles table"
  python ml-engine/scripts/new_migration.py "add index on events.created_at" --autogenerate
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: new_migration.py \"migration message\" [--autogenerate]")
        return 2

    message = sys.argv[1].strip()
    if not message:
        print("Migration message cannot be empty.", file=sys.stderr)
        return 2

    autogenerate = "--autogenerate" in sys.argv[2:]
    repo_root = Path(__file__).resolve().parents[2]
    script = repo_root / "ml-engine" / "scripts" / "alembic_manage.py"

    cmd = [sys.executable, str(script), "revision", "-m", message]
    if autogenerate:
        cmd.append("--autogenerate")

    return subprocess.run(cmd, cwd=str(repo_root)).returncode


if __name__ == "__main__":
    raise SystemExit(main())
