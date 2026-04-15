#!/usr/bin/env python3
"""
Thin wrapper around Alembic for predictable project-local migrations.

Examples:
  python ml-engine/scripts/alembic_manage.py upgrade head
  python ml-engine/scripts/alembic_manage.py downgrade -1
  python ml-engine/scripts/alembic_manage.py revision -m "add new table"
  python ml-engine/scripts/alembic_manage.py stamp head
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    ini_path = root / "alembic.ini"

    if not ini_path.exists():
        print(f"alembic.ini not found at: {ini_path}", file=sys.stderr)
        return 1

    args = sys.argv[1:]
    if not args:
        print("Usage: alembic_manage.py <alembic args...>", file=sys.stderr)
        print(
            "Example: python ml-engine/scripts/alembic_manage.py upgrade head",
            file=sys.stderr,
        )
        return 2

    env = os.environ.copy()
    alembic_bin = shutil.which("alembic")
    if alembic_bin:
        cmd = [alembic_bin, "-c", str(ini_path), *args]
    else:
        # Fallback for environments where console scripts are not on PATH
        # (e.g. only `python -m` entry points are available).
        cmd = [sys.executable, "-m", "alembic", "-c", str(ini_path), *args]
    return subprocess.run(cmd, cwd=str(root), env=env).returncode


if __name__ == "__main__":
    raise SystemExit(main())
