from __future__ import annotations

import argparse
import hashlib
import re
import sys
import time
from pathlib import Path

from update_todo_progress import (
    DEFAULT_TODO_PATH,
    PROGRESS_END,
    PROGRESS_START,
    build_updated_markdown,
)


PROGRESS_BLOCK_RE = re.compile(
    rf"{re.escape(PROGRESS_START)}.*?{re.escape(PROGRESS_END)}",
    re.DOTALL,
)
LAST_UPDATED_RE = re.compile(r"^\*\*Last updated:\*\* .+$", re.MULTILINE)


def normalize_source(markdown: str) -> str:
    normalized = PROGRESS_BLOCK_RE.sub("", markdown, count=1)
    normalized = LAST_UPDATED_RE.sub("**Last updated:** <auto>", normalized, count=1)
    return normalized.strip()


def source_signature(markdown: str) -> str:
    return hashlib.sha256(normalize_source(markdown).encode("utf-8")).hexdigest()


def sync_once(todo_path: Path) -> str:
    current = todo_path.read_text(encoding="utf-8")
    updated = build_updated_markdown(todo_path)
    if updated == current:
        return "current"
    try:
        todo_path.write_text(updated, encoding="utf-8")
    except PermissionError:
        return "locked"
    return "synced"


def watch(todo_path: Path, poll_seconds: float) -> None:
    print(f"TODO autosync watching: {todo_path}")
    last_seen_signature: str | None = None

    while True:
        try:
            current = todo_path.read_text(encoding="utf-8")
            current_signature = source_signature(current)
            if current_signature != last_seen_signature:
                stamp = time.strftime("%Y-%m-%d %H:%M:%S")
                result = sync_once(todo_path)
                if result == "synced":
                    refreshed = todo_path.read_text(encoding="utf-8")
                    last_seen_signature = source_signature(refreshed)
                    print(f"[{stamp}] Synced TODO progress.")
                elif result == "current":
                    refreshed = todo_path.read_text(encoding="utf-8")
                    last_seen_signature = source_signature(refreshed)
                    print(f"[{stamp}] TODO progress already current.")
                else:
                    print(f"[{stamp}] TODO file is locked; retrying when it becomes writable.")
            time.sleep(poll_seconds)
        except KeyboardInterrupt:
            print("TODO autosync stopped.")
            return
        except FileNotFoundError:
            print(f"TODO autosync waiting for file: {todo_path}", file=sys.stderr)
            time.sleep(max(2.0, poll_seconds))
        except Exception as exc:
            print(f"TODO autosync error: {exc}", file=sys.stderr)
            time.sleep(max(2.0, poll_seconds))


def main() -> None:
    parser = argparse.ArgumentParser(description="Continuously refresh TODO dashboard when the source checklist changes.")
    parser.add_argument(
        "--file",
        type=Path,
        default=DEFAULT_TODO_PATH,
        help="Path to the TODO markdown file.",
    )
    parser.add_argument(
        "--poll-seconds",
        type=float,
        default=2.0,
        help="Polling interval in seconds.",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single sync and exit.",
    )
    args = parser.parse_args()
    todo_path = args.file.resolve()

    if args.once:
        result = sync_once(todo_path)
        if result == "synced":
            print("Synced TODO progress.")
        elif result == "current":
            print("TODO progress already current.")
        else:
            print("TODO file is locked; retry after the file becomes writable.")
        return

    watch(todo_path, poll_seconds=max(0.5, args.poll_seconds))


if __name__ == "__main__":
    main()
