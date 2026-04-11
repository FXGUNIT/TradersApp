#!/usr/bin/env python3
"""Validate ADR markdown files for CI and local checks.

Checks:
- Required metadata: `ADR ID:`, `Status:`, `Date:`
- Required sections: `## Context`, `## Decision`, `## Consequences`
- Valid status value
- ADR ID matches the filename prefix when present

Usage:
  python scripts/validate_adrs.py
  python scripts/validate_adrs.py docs/adr/ADR-001-example.md docs/adr/ADR-002-example.md
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

VALID_STATUSES = {"Proposed", "Accepted", "Deprecated", "Superseded", "Rejected"}
REQUIRED_HEADERS = ("## Context", "## Decision", "## Consequences")
ADR_FILENAME_RE = re.compile(r"^(ADR-\d+)")


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def validate_adr(path: Path) -> list[str]:
    errors: list[str] = []

    try:
        text = _read_text(path)
    except FileNotFoundError:
        return ["file does not exist"]
    except UnicodeDecodeError as exc:
        return [f"file is not valid UTF-8: {exc}"]
    except OSError as exc:
        return [f"unable to read file: {exc}"]

    for header in REQUIRED_HEADERS:
        if header not in text:
            errors.append(f"missing required section `{header}`")

    adr_id_match = re.search(r"^\*\*ADR ID:\*\*\s*(ADR-\d+)\b|^ADR ID:\s*(ADR-\d+)\b", text, re.MULTILINE)
    status_match = re.search(r"^\*\*Status:\*\*\s*(.+?)\s*$|^Status:\s*(.+?)\s*$", text, re.MULTILINE)
    date_match = re.search(r"^\*\*Date:\*\*\s*(.+?)\s*$|^Date:\s*(.+?)\s*$", text, re.MULTILINE)

    adr_id = next((group for group in adr_id_match.groups() if group), None) if adr_id_match else None
    status = next((group.strip() for group in status_match.groups() if group and group.strip()), None) if status_match else None
    date_value = next((group.strip() for group in date_match.groups() if group and group.strip()), None) if date_match else None

    if not adr_id:
        errors.append("missing `ADR ID:` field")
    if not status:
        errors.append("missing `Status:` field")
    elif status not in VALID_STATUSES:
        valid = ", ".join(sorted(VALID_STATUSES))
        errors.append(f"invalid status `{status}` (expected one of: {valid})")
    if not date_value:
        errors.append("missing `Date:` field")

    filename_match = ADR_FILENAME_RE.match(path.name)
    if adr_id and filename_match and filename_match.group(1) != adr_id:
        errors.append(
            f"ADR ID `{adr_id}` does not match filename prefix `{filename_match.group(1)}`"
        )

    return errors


def collect_files(repo_root: Path, requested_paths: list[str]) -> list[Path]:
    if requested_paths:
        files: list[Path] = []
        for raw_path in requested_paths:
            path = Path(raw_path)
            if not path.is_absolute():
                path = repo_root / path
            files.append(path.resolve())
        return files

    adr_dir = repo_root / "docs" / "adr"
    return sorted(adr_dir.glob("ADR-*.md"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate ADR markdown files.")
    parser.add_argument("paths", nargs="*", help="Specific ADR files to validate")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    files = collect_files(repo_root, args.paths)

    if not files:
        print("[OK] No ADR files to validate.")
        return 0

    any_errors = False
    for path in files:
        rel_path = path.relative_to(repo_root) if path.is_relative_to(repo_root) else path
        errors = validate_adr(path)
        if errors:
            any_errors = True
            print(f"[FAIL] {rel_path}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"[OK] {rel_path}")

    if any_errors:
        print("\n[FAIL] ADR validation failed.")
        return 1

    print("\n[PASS] All ADR files validated successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
