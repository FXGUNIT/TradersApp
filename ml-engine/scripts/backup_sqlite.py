#!/usr/bin/env python3
"""
backup_sqlite.py — R17 gap fix: ML Engine SQLite backup script
Backs up trading_data.db using SQLite's .backup command (consistent online backup).

Usage:
  python ml-engine/scripts/backup_sqlite.py --backup-dir /backups
  python ml-engine/scripts/backup_sqlite.py --restore /backups/trading_data_20260415_030000.db
  python ml-engine/scripts/backup_sqlite.py --verify /backups/trading_data_latest.db
"""

import argparse
import datetime
import os
import shutil
import sqlite3
import sys

DB_PATH = os.environ.get("DB_PATH", "ml-engine/data/trading_data.db")
BACKUP_DIR = os.environ.get("BACKUP_DIR", "/backups/sqlite")


def now_tag():
    return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")


def backup_sqlite(db_path, dest_path):
    """Use SQLite online backup API — works while DB is being written to."""
    try:
        src = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    except sqlite3.OperationalError:
        # Fallback: lock mode for offline backup
        src = sqlite3.connect(db_path)

    dest = sqlite3.connect(dest_path)
    try:
        src.backup(dest)
    finally:
        src.close()
        dest.close()


def run_backup(backup_dir):
    os.makedirs(backup_dir, exist_ok=True)
    tag = now_tag()
    archive_path = os.path.join(backup_dir, f"trading_data_{tag}.db")

    db_abs = os.path.abspath(DB_PATH)
    if not os.path.exists(db_abs):
        print(f"[backup_sqlite] DB not found: {db_abs}", file=sys.stderr)
        sys.exit(1)

    print(f"[backup_sqlite] Backing up {db_abs} -> {archive_path}")
    backup_sqlite(db_abs, archive_path)

    size_mb = os.path.getsize(archive_path) / 1024 / 1024
    print(f"[backup_sqlite] Backup complete: {archive_path} ({size_mb:.1f} MB)")

    # Update latest
    latest = os.path.join(backup_dir, "trading_data_latest.db")
    if os.path.lexists(latest):
        os.unlink(latest)
    try:
        os.symlink(os.path.basename(archive_path), latest)
    except OSError:
        shutil.copy2(archive_path, latest)

    # Retention: last 30 backups
    backups = sorted(
        f for f in os.listdir(backup_dir)
        if f.startswith("trading_data_") and f.endswith(".db")
    )
    for old in backups[:-30]:
        os.unlink(os.path.join(backup_dir, old))
        print(f"[backup_sqlite] Removed old backup: {old}")

    return archive_path


def run_restore(backup_path):
    if not os.path.exists(backup_path):
        print(f"[backup_sqlite] Backup not found: {backup_path}", file=sys.stderr)
        sys.exit(1)

    db_abs = os.path.abspath(DB_PATH)
    print(f"[backup_sqlite] Restoring {backup_path} -> {db_abs}")

    # Backup current DB first
    corrupt_backup = db_abs + f".corrupt_{now_tag()}.db"
    shutil.copy2(db_abs, corrupt_backup)
    print(f"[backup_sqlite] Current DB saved as: {corrupt_backup}")

    # Restore
    backup_sqlite(backup_path, db_abs)
    print("[backup_sqlite] Restore complete.")

    # Verify
    run_verify(db_abs)


def run_verify(path_or_db):
    try:
        conn = sqlite3.connect(path_or_db)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        cur.execute("PRAGMA integrity_check")
        result = cur.fetchone()
        conn.close()
        print(f"[backup_sqlite] Tables: {tables}")
        print(f"[backup_sqlite] Integrity: {result[0]}")
        if result[0] != "ok":
            print("[backup_sqlite] WARNING: integrity check failed!", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"[backup_sqlite] Verification failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ML Engine SQLite backup utility")
    parser.add_argument("--backup-dir", default=BACKUP_DIR, help="Backup output directory")
    parser.add_argument("--restore", metavar="PATH", help="Restore from backup file")
    parser.add_argument("--verify", metavar="PATH", help="Verify backup integrity")
    args = parser.parse_args()

    if args.restore:
        run_restore(args.restore)
    elif args.verify:
        run_verify(args.verify)
    else:
        run_backup(args.backup_dir)
