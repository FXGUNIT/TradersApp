#!/usr/bin/env python3
"""
enforce_file_limits.py — Local file-size gate matching CI constraints.

Limits (from CLAUDE.md):
  Python files  : ≤ 600 lines
  JS/TS/MJS     : ≤ 500 lines
  React (JSX/TSX in src/) : ≤ 300 lines

Usage:
  python scripts/enforce_file_limits.py          # scan entire repo
  python scripts/enforce_file_limits.py src/     # scan specific path
  python scripts/enforce_file_limits.py --quiet  # only print violations
"""

import sys
import os
from pathlib import Path

PYTHON_LIMIT = 600
JS_LIMIT = 500
REACT_LIMIT = 300

EXCLUDE_DIRS = {
    ".git", "node_modules", "venv", ".venv", "env",
    "site-packages", ".pytest_tmp", "dist", "build",
    "__pycache__", ".mypy_cache",
}

RULES = [
    {
        "extensions": {".py"},
        "limit": PYTHON_LIMIT,
        "label": "Python",
        "scope": None,
    },
    {
        "extensions": {".js", ".ts", ".mjs"},
        "limit": JS_LIMIT,
        "label": "JS/TS",
        "scope": None,
    },
    {
        "extensions": {".jsx", ".tsx"},
        "limit": REACT_LIMIT,
        "label": "React",
        "scope": "src",
    },
]


def is_excluded(path: Path, root: Path) -> bool:
    for part in path.relative_to(root).parts:
        if part in EXCLUDE_DIRS:
            return True
    return False


def count_lines(path: Path) -> int:
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return sum(1 for _ in f)
    except OSError:
        return 0


def scan(root: Path, quiet: bool) -> list[tuple[Path, int, int, str]]:
    violations: list[tuple[Path, int, int, str]] = []
    counts: dict[str, int] = {r["label"]: 0 for r in RULES}

    for rule in RULES:
        scope_root = root / rule["scope"] if rule["scope"] else root
        if not scope_root.exists():
            continue

        for path in sorted(scope_root.rglob("*")):
            if not path.is_file():
                continue
            if is_excluded(path, root):
                continue
            if path.suffix not in rule["extensions"]:
                continue

            lines = count_lines(path)
            counts[rule["label"]] += 1
            rel = path.relative_to(root)

            if lines > rule["limit"]:
                violations.append((rel, lines, rule["limit"], rule["label"]))
                print(f"  ❌ [{rule['label']}] {rel} — {lines} lines (max {rule['limit']})")
            elif not quiet:
                print(f"  ✓  [{rule['label']}] {rel} — {lines} lines")

    return violations


def main() -> None:
    args = sys.argv[1:]
    quiet = "--quiet" in args
    args = [a for a in args if not a.startswith("--")]

    workspace = Path(__file__).resolve().parent.parent
    scan_root = Path(args[0]).resolve() if args else workspace

    if not quiet:
        print(f"Scanning: {scan_root}\n")

    violations = scan(scan_root, quiet)

    print()
    if violations:
        print(f"❌ File size gate FAILED — {len(violations)} file(s) exceed hard limits:")
        for rel, lines, limit, label in violations:
            print(f"   {rel}  ({lines}/{limit} lines, {lines - limit} over)")
        sys.exit(1)
    else:
        print("✅ File size gate PASSED — all files within hard limits")


if __name__ == "__main__":
    main()
