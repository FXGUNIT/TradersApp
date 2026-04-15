#!/usr/bin/env python3
"""
backup_postgres.py — R17 gap fix: PostgreSQL (MLflow metadata) backup script
Backs up the mlflow PostgreSQL database.

Usage:
  python scripts/backup_postgres.py --backup-dir /backups
  python scripts/backup_postgres.py --restore /backups/mlflow_20260415_030000.dump
  python scripts/backup_postgres.py --verify /backups/mlflow_latest.dump
"""

import argparse
import datetime
import os
import shutil
import subprocess
import sys

PG_CONTAINER = os.environ.get("PG_CONTAINER", "traders-postgres")
PG_USER = os.environ.get("POSTGRES_USER", "traders")
PG_DB = os.environ.get("POSTGRES_DB", "mlflow")
BACKUP_DIR = os.environ.get("BACKUP_DIR", "/backups/postgres")


def pg_dump_cmd(cmd_args, capture=True):
    result = subprocess.run(
        ["docker", "exec", PG_CONTAINER, "pg_dump", *cmd_args],
        capture_output=capture,
    )
    return result


def pg_restore_cmd(cmd_args, capture=True):
    result = subprocess.run(
        ["docker", "exec", PG_CONTAINER, "pg_restore", *cmd_args],
        capture_output=capture,
    )
    return result


def now_tag():
    return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")


def run_backup(backup_dir):
    os.makedirs(backup_dir, exist_ok=True)
    tag = now_tag()
    archive_path = os.path.join(backup_dir, f"mlflow_{tag}.dump")

    print(f"[backup_postgres] Dumping {PG_DB}@{PG_CONTAINER} -> {archive_path}")

    result = pg_dump_cmd([
        "--username", PG_USER,
        "--dbname", PG_DB,
        "--format=c",        # custom (compressed)
        "--file", f"/tmp/mlflow_backup_{tag}.dump",
    ])

    if result.returncode != 0:
        print(f"[backup_postgres] pg_dump failed: {result.stderr.decode()}", file=sys.stderr)
        sys.exit(1)

    # Copy from container
    subprocess.run(
        ["docker", "cp",
         f"{PG_CONTAINER}:/tmp/mlflow_backup_{tag}.dump",
         archive_path],
        check=True,
    )

    # Cleanup temp in container
    subprocess.run(
        ["docker", "exec", PG_CONTAINER, "rm", f"/tmp/mlflow_backup_{tag}.dump"],
        capture_output=True,
    )

    size_mb = os.path.getsize(archive_path) / 1024 / 1024
    print(f"[backup_postgres] Backup complete: {archive_path} ({size_mb:.1f} MB)")

    # Update latest
    latest = os.path.join(backup_dir, "mlflow_latest.dump")
    if os.path.lexists(latest):
        os.unlink(latest)
    try:
        os.symlink(os.path.basename(archive_path), latest)
    except OSError:
        shutil.copy2(archive_path, latest)

    # Retention: last 14 backups
    backups = sorted(
        f for f in os.listdir(backup_dir)
        if f.startswith("mlflow_") and f.endswith(".dump")
    )
    for old in backups[:-14]:
        os.unlink(os.path.join(backup_dir, old))
        print(f"[backup_postgres] Removed old backup: {old}")

    return archive_path


def run_restore(backup_path):
    if not os.path.exists(backup_path):
        print(f"[backup_postgres] Backup not found: {backup_path}", file=sys.stderr)
        sys.exit(1)

    print("[backup_postgres] Stopping MLflow writers before restore...")
    subprocess.run(["docker", "compose", "-f", "docker-compose.yml",
                    "stop", "mlflow"], capture_output=True)
    subprocess.run(["docker", "start", PG_CONTAINER], capture_output=True)

    # Restore
    tmp_restore = f"/tmp/mlflow_restore_{now_tag()}.dump"
    subprocess.run(["docker", "cp", backup_path, f"{PG_CONTAINER}:{tmp_restore}"], check=True)

    print(f"[backup_postgres] Restoring {tmp_restore} into {PG_DB}...")
    result = pg_restore_cmd([
        "--username", PG_USER,
        "--dbname", PG_DB,
        "--clean",    # drop existing objects
        "--if-exists",
        "--format=custom",        # custom format (must match backup)
        tmp_restore,
    ])

    if result.returncode != 0:
        print(f"[backup_postgres] pg_restore failed: {result.stderr.decode()}", file=sys.stderr)
        print("[backup_postgres] WARNING: restore may be partial. Check PostgreSQL logs.",
              file=sys.stderr)

    subprocess.run(["docker", "exec", PG_CONTAINER, "rm", tmp_restore], capture_output=True)
    print("[backup_postgres] Restore complete.")


def run_verify(backup_path):
    if not os.path.exists(backup_path):
        print(f"[backup_postgres] Backup not found: {backup_path}", file=sys.stderr)
        sys.exit(1)

    size_mb = os.path.getsize(backup_path) / 1024 / 1024
    # Basic integrity: check it's a valid pg_dump custom format
    with open(backup_path, "rb") as f:
        magic = f.read(6)
    if magic[:5] == b"PGDMP":
        print(f"[backup_postgres] Valid pg_dump format. Size: {size_mb:.1f} MB")
    else:
        print(f"[backup_postgres] WARNING: unexpected magic bytes: {magic!r}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PostgreSQL backup utility")
    parser.add_argument("--backup-dir", default=BACKUP_DIR)
    parser.add_argument("--restore", metavar="PATH", help="Restore from backup file")
    parser.add_argument("--verify", metavar="PATH", help="Verify backup")
    args = parser.parse_args()

    if args.restore:
        run_restore(args.restore)
    elif args.verify:
        run_verify(args.verify)
    else:
        run_backup(args.backup_dir)
