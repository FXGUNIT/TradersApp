#!/usr/bin/env python3
"""
backup_redis.py — R17 gap fix: Redis backup script
Backs up Redis RDB snapshot to local directory.
Run via cron: 0 3 * * * python3 /app/scripts/backup_redis.py

Usage:
  python3 scripts/backup_redis.py --backup-dir /backups
  python3 scripts/backup_redis.py --restore /backups/redis_20260415_030000.rdb
  python3 scripts/backup_redis.py --verify /backups/redis_latest.rdb
"""

import argparse
import datetime
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile

REDIS_CONTAINER = os.environ.get("REDIS_CONTAINER", "traders-redis")
BACKUP_DIR = os.environ.get("BACKUP_DIR", "/backups/redis")


def now_tag():
    return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")


def redis_cmd(cmd):
    result = subprocess.run(
        ["docker", "exec", REDIS_CONTAINER, "redis-cli", *cmd.split()],
        capture_output=True,
        text=True,
    )
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def run_backup(backup_dir):
    os.makedirs(backup_dir, exist_ok=True)
    tag = now_tag()

    # Force RDB snapshot
    print("[backup_redis] Triggering BGSAVE...")
    rc, out, err = redis_cmd("BGSAVE")
    if rc != 0:
        print(f"[backup_redis] BGSAVE failed: {err}", file=sys.stderr)
        # Continue anyway — dump.rdb may exist from last save

    # Get last save time to confirm
    rc, out, _ = redis_cmd("LASTSAVE")
    last_save = datetime.datetime.fromtimestamp(int(out or 0))
    print(f"[backup_redis] Last SAVE at: {last_save.isoformat()}")

    # Copy dump.rdb from container
    with tempfile.NamedTemporaryFile(suffix=".rdb", delete=False) as tmp:
        tmp_path = tmp.name

    rc, _, err = redis_cmd(f"CONFIG GET dir")
    if rc == 0:
        redis_dir = rc  # not needed
    docker_dir = "/data"
    dump_src = f"{docker_dir}/dump.rdb"

    # Copy from container
    result = subprocess.run(
        ["docker", "cp", f"{REDIS_CONTAINER}:{dump_src}", tmp_path],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"[backup_redis] Failed to copy dump.rdb: {result.stderr}", file=sys.stderr)
        sys.exit(1)

    # Compress
    archive_path = os.path.join(backup_dir, f"redis_{tag}.tar.gz")
    with tarfile.open(archive_path, "w:gz") as tar:
        tar.add(tmp_path, arcname="dump.rdb")
    os.unlink(tmp_path)

    # Update latest symlink
    latest = os.path.join(backup_dir, "redis_latest.tar.gz")
    if os.path.lexists(latest):
        os.unlink(latest)
    os.symlink(os.path.basename(archive_path), latest)

    size_mb = os.path.getsize(archive_path) / 1024 / 1024
    print(f"[backup_redis] Backup saved: {archive_path} ({size_mb:.1f} MB)")
    print(f"[backup_redis] Latest symlink: {latest}")

    # Retention: keep last 30 backups
    backups = sorted(
        f for f in os.listdir(backup_dir)
        if f.startswith("redis_") and f.endswith(".tar.gz")
    )
    for old in backups[:-30]:
        path = os.path.join(backup_dir, old)
        os.unlink(path)
        print(f"[backup_redis] Removed old backup: {old}")

    return archive_path


def run_restore(backup_path):
    if not os.path.exists(backup_path):
        print(f"[backup_redis] Backup not found: {backup_path}", file=sys.stderr)
        sys.exit(1)

    # Verify it's a valid tarball
    try:
        with tarfile.open(backup_path) as tar:
            members = tar.getnames()
            if "dump.rdb" not in members:
                print("[backup_redis] Invalid backup: no dump.rdb inside", file=sys.stderr)
                sys.exit(1)
    except Exception as e:
        print(f"[backup_redis] Corrupt backup file: {e}", file=sys.stderr)
        sys.exit(1)

    # Stop Redis
    print("[backup_redis] Stopping Redis...")
    subprocess.run(["docker", "stop", REDIS_CONTAINER], capture_output=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        with tarfile.open(backup_path) as tar:
            tar.extractall(tmpdir)
        dump_src = os.path.join(tmpdir, "dump.rdb")
        docker_dir = "/data"
        subprocess.run(
            ["docker", "cp", dump_src, f"{REDIS_CONTAINER}:{docker_dir}/dump.rdb"],
            check=True,
        )

    subprocess.run(["docker", "start", REDIS_CONTAINER], capture_output=True)
    rc, _, _ = redis_cmd("PING")
    if rc == 0:
        print("[backup_redis] Restore complete. Redis responding.")
    else:
        print("[backup_redis] Restore complete but Redis not responding.", file=sys.stderr)
        sys.exit(1)


def run_verify(backup_path):
    if not os.path.exists(backup_path):
        print(f"[backup_redis] Backup not found: {backup_path}", file=sys.stderr)
        sys.exit(1)

    try:
        with tarfile.open(backup_path) as tar:
            members = tar.getnames()
            if "dump.rdb" not in members:
                print("[backup_redis] Invalid: no dump.rdb", file=sys.stderr)
                sys.exit(1)
            print(f"[backup_redis] Valid backup. Contents: {members}")
    except Exception as e:
        print(f"[backup_redis] Corrupt: {e}", file=sys.stderr)
        sys.exit(1)

    size_mb = os.path.getsize(backup_path) / 1024 / 1024
    print(f"[backup_redis] OK. Size: {size_mb:.1f} MB")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Redis backup/restore utility")
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
