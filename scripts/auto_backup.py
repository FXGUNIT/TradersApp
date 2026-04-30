#!/usr/bin/env python3
"""
Auto Git Backup — runs after every significant code change.

This script is designed to be called by a pre-commit hook and by Claude Code
after every meaningful code change. It creates atomic commits with descriptive
messages automatically.

Usage:
    python scripts/auto_backup.py "Add Mamba SSM integration"
    python scripts/auto_backup.py "Fix circuit breaker" --files ml-engine/infrastructure/performance.py

Features:
- Automatic staging of changed files
- Atomic commits with descriptive messages
- Branch protection: never force-push to main
- Incremental backups: only commits changed files
- Backup verification: confirms push to remote
"""

import subprocess
import sys
import os
from pathlib import Path
from datetime import datetime, timezone
import json
import hashlib

# ─── Config ───────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).parent.parent.resolve()
COMMIT_MSG_PREFIX = "[AUTO-BACKUP]"
BACKUP_TAG_PREFIX = "backup/"


def run(cmd: list[str], cwd: Path = REPO_ROOT, check: bool = True) -> subprocess.CompletedProcess:
    """Run a shell command."""
    result = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )
    if check and result.returncode != 0:
        print(f"[ERROR] Command failed: {' '.join(cmd)}")
        print(f"STDOUT: {result.stdout}")
        print(f"STDERR: {result.stderr}")
        sys.exit(1)
    return result


def get_git_status() -> dict:
    """Get current git status."""
    result = run(["git", "status", "--porcelain=v1"], check=False)
    lines = result.stdout.strip().split("\n") if result.stdout.strip() else []
    files = []
    for line in lines:
        if line:
            status = line[:2]
            filepath = line[3:].strip()
            files.append({"status": status, "path": filepath})
    return {
        "files": files,
        "changed": len(files),
        "branch": run(["git", "branch", "--show-current"]).stdout.strip(),
        "commit": run(["git", "rev-parse", "--short", "HEAD"], check=False).stdout.strip()[:7],
    }


def get_current_branch() -> str:
    """Get the current branch name."""
    return run(["git", "branch", "--show-current"]).stdout.strip()


def is_clean() -> bool:
    """Check if working directory is clean."""
    status = get_git_status()
    return status["changed"] == 0


def create_backup_tag(commit_hash: str, description: str) -> str:
    """Create an annotated tag for this backup."""
    tag_name = f"{BACKUP_TAG_PREFIX}{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    tag_msg = f"{COMMIT_MSG_PREFIX} {description}\n\nCommit: {commit_hash}\nTimestamp: {datetime.now(timezone.utc).isoformat()}"
    result = run(["git", "tag", "-a", tag_name, "-m", tag_msg, commit_hash], check=False)
    if result.returncode == 0:
        return tag_name
    return None


def auto_backup(
    message: str,
    files: list[str] | None = None,
    push: bool = True,
    create_tag: bool = True,
) -> dict:
    """
    Create an automatic git backup commit.

    Args:
        message: Description of what changed
        files: Specific files to commit (None = all changed files)
        push: Whether to push to remote
        create_tag: Whether to create an annotated tag

    Returns:
        dict with commit info
    """
    os.chdir(REPO_ROOT)

    status = get_git_status()
    if status["changed"] == 0:
        print(f"[Backup] Nothing to commit — working directory is clean")
        return {"ok": True, "committed": False, "message": "No changes"}

    # Stage files
    if files:
        for f in files:
            run(["git", "add", f])
    else:
        # Stage all changed files (excluding node_modules, dist, __pycache__, etc.)
        exclude_patterns = [
            "node_modules/",
            "dist/",
            ".vite/",
            "__pycache__/",
            "*.pyc",
            ".pytest_cache/",
            "*.egg-info/",
<<<<<<< HEAD
            "htmlcov/",
            ".coverage",
            "coverage/",
=======
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
            ".env",
            ".env.local",
            "*.log",
            "trading_data.db",
            ".DS_Store",
            "*.db-shm",
            "*.db-wal",
        ]
        result = run(["git", "status", "--porcelain"], check=False)
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            status_code = line[:2].strip()
            filepath = line[3:].strip()

            # Skip deleted files (already staged as 'D')
            if status_code == "D":
                continue

            # Skip excluded patterns
            skip = False
            for pattern in exclude_patterns:
                if pattern.endswith("/"):
                    if filepath.startswith(pattern) or f"/{pattern}" in filepath:
                        skip = True
                        break
                elif filepath.endswith(pattern.replace("*", "")):
                    skip = True
                    break
            if not skip:
                run(["git", "add", filepath])

    # Commit
    commit_msg = f"{COMMIT_MSG_PREFIX} {message}\n\nAuto-backup at {datetime.now(timezone.utc).isoformat()}"
    result = run(["git", "commit", "-m", commit_msg], check=False)

    if result.returncode != 0:
        print(f"[Backup] Commit failed: {result.stderr}")
        return {"ok": False, "error": result.stderr}

    commit_hash = run(["git", "rev-parse", "--short", "HEAD"]).stdout.strip()
    print(f"[Backup] ✅ Committed: {commit_hash}")
    print(f"[Backup] 📝 {message}")

    # Create annotated tag
    if create_tag:
        tag = create_backup_tag(commit_hash, message)
        if tag:
            print(f"[Backup] 🏷️  Tagged: {tag}")

    # Push
    if push:
        branch = get_current_branch()
        if branch == "main":
            print(f"[Backup] ⚠️  Skipped push to main (branch protection enabled)")
        else:
            push_result = run(
                ["git", "push", "origin", branch, "--quiet"],
                check=False,
            )
            if push_result.returncode == 0:
                print(f"[Backup] ✅ Pushed to origin/{branch}")
            else:
                print(f"[Backup] ⚠️  Push failed (may need auth): {push_result.stderr}")

    return {
        "ok": True,
        "committed": True,
        "commit_hash": commit_hash,
        "message": message,
        "files_changed": status["changed"],
        "branch": branch,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def run_git_backup_from_args():
    """CLI entry point."""
    args = sys.argv[1:]
    message = "Auto-backup"
    files = None
    push = True

    i = 0
    while i < len(args):
        if args[i] == "--files" and i + 1 < len(args):
            files = args[i + 1].split(",")
            i += 2
        elif args[i] == "--no-push":
            push = False
            i += 1
        elif args[i] == "--no-tag":
            i += 1
        else:
            message = args[i]
            i += 1

    result = auto_backup(message, files=files, push=push)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    run_git_backup_from_args()
