#!/usr/bin/env python3
"""
Model Versioning Script — ml-engine/scripts/version_models.py

Backs up trained model artifacts to a versioned directory with metadata.
Can be run manually or triggered from GitHub Actions daily backup.

Usage:
    python scripts/version_models.py --output ./model_backups
    python scripts/version_models.py --list
    python scripts/version_models.py --restore 2026-04-01
"""
import argparse
import json
import os
import shutil
import sys
import tarfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

# Add ml-engine to path
ML_ENGINE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ML_ENGINE_DIR))


def get_model_store_path() -> Path:
    """Find the model store directory."""
    default = ML_ENGINE_DIR / "models" / "stored"
    env_path = os.environ.get("ML_MODELS_PATH", str(default))
    return Path(env_path)


def list_versions(models_dir: Path) -> list[dict]:
    """List all model versions currently stored."""
    if not models_dir.exists():
        return []

    versions = []
    for item in sorted(models_dir.iterdir()):
        if item.suffix == ".meta":
            continue
        if item.is_dir():
            # Check for metadata
            meta_file = item.with_suffix(".meta")
            meta = {}
            if meta_file.exists():
                try:
                    meta = json.loads(meta_file.read_text())
                except Exception:
                    pass
            versions.append({
                "name": item.name,
                "path": str(item),
                "size_mb": round(sum(f.stat().st_size for f in item.rglob("*") if f.is_file()) / 1e6, 2),
                "meta": meta,
            })
        elif item.suffix == ".pkl":
            meta_file = item.with_suffix(".meta")
            meta = {}
            if meta_file.exists():
                try:
                    meta = json.loads(meta_file.read_text())
                except Exception:
                    pass
            versions.append({
                "name": item.name,
                "path": str(item),
                "size_mb": round(item.stat().st_size / 1e6, 2),
                "meta": meta,
            })
    return versions


def create_backup(models_dir: Path, output_dir: Path, label: str | None = None) -> Path:
    """
    Create a timestamped backup of all model files.
    Returns the path to the backup archive.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    label_str = f"_{label}" if label else ""
    archive_name = f"models_backup_{timestamp}{label_str}.tar.gz"
    archive_path = output_dir / archive_name

    # Collect all model files
    model_files = []
    if models_dir.exists():
        for f in models_dir.rglob("*.pkl"):
            model_files.append(f)
        for f in models_dir.rglob("*.joblib"):
            model_files.append(f)
        for f in models_dir.rglob("*.meta"):
            model_files.append(f)

    if not model_files:
        print("No model files found to back up.")
        return archive_path

    # Create tar.gz archive
    with tarfile.open(archive_path, "w:gz") as tar:
        for f in model_files:
            arcname = f.relative_to(models_dir.parent)
            tar.add(f, arcname=arcname)

    # Write metadata alongside the archive
    meta = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "timestamp": timestamp,
        "label": label,
        "files_count": len(model_files),
        "files": [str(f.relative_to(models_dir.parent)) for f in model_files],
        "archive_size_mb": round(archive_path.stat().st_size / 1e6, 2),
    }
    meta_path = archive_path.with_suffix(".meta.json")
    meta_path.write_text(json.dumps(meta, indent=2))

    print(f"Backup created: {archive_path}")
    print(f"  Files: {len(model_files)}")
    print(f"  Size: {meta['archive_size_mb']} MB")
    return archive_path


def restore_backup(archive_path: Path, models_dir: Path) -> None:
    """Restore models from a backup archive."""
    if not archive_path.exists():
        print(f"Archive not found: {archive_path}")
        sys.exit(1)

    # Clear existing models (optional safety — backup first!)
    if models_dir.exists():
        print(f"Clearing existing models in {models_dir}")
        for f in models_dir.rglob("*.pkl"):
            f.unlink()
        for f in models_dir.rglob("*.meta"):
            f.unlink()
        for f in models_dir.rglob("*.joblib"):
            f.unlink()

    models_dir.mkdir(parents=True, exist_ok=True)

    with tarfile.open(archive_path, "r:gz") as tar:
        members = tar.getmembers()
        print(f"Restoring {len(members)} files...")
        for member in members:
            target = models_dir.parent / member.name
            target.parent.mkdir(parents=True, exist_ok=True)
            tar.extract(member, path=models_dir.parent)

    print(f"Restored from: {archive_path}")


def rollback_by_tag(tag: str, models_dir: Path) -> None:
    """Rollback to models from a specific GitHub release tag."""
    # This would be called by GitHub Actions after softprops/action-gh-release
    print(f"Rolling back to release tag: {tag}")
    # In practice: download from GitHub release, extract, restore
    print("In CI/CD: use GitHub CLI to download release assets")
    print(f"  gh release download {tag} --dir models_backup/")
    print(f"  python scripts/version_models.py --restore {tag}")


def print_status(models_dir: Path, backup_dir: Path) -> None:
    """Print current model status."""
    print("=" * 60)
    print("ML Model Version Status")
    print("=" * 60)
    print(f"Model store: {models_dir}")
    print(f"Backup dir:  {backup_dir}")

    versions = list_versions(models_dir)
    print(f"\nTrained models ({len(versions)}):")
    if not versions:
        print("  No trained models found.")
    else:
        for v in versions:
            meta = v.get("meta", {})
            trained = meta.get("metrics", {}).get("trained_at", "unknown")
            acc = meta.get("metrics", {}).get("cv_roc_auc_mean", "N/A")
            print(f"  [{v['name']}] {v['size_mb']} MB  trained={trained}  CV_AUC={acc}")

    # List backups
    backups = sorted(backup_dir.glob("models_backup_*.tar.gz"), reverse=True)
    print(f"\nBackups ({len(backups)}):")
    if not backups:
        print("  No backups found.")
    else:
        for b in backups[:5]:
            meta_file = b.with_suffix(".meta.json")
            size = round(b.stat().st_size / 1e6, 2)
            ts = b.stem.replace("models_backup_", "")
            if meta_file.exists():
                try:
                    m = json.loads(meta_file.read_text())
                    label = m.get("label", "")
                    files = m.get("files_count", "")
                    print(f"  {ts}  {size} MB  label={label}  files={files}")
                except Exception:
                    print(f"  {ts}  {size} MB")
            else:
                print(f"  {ts}  {size} MB")
        if len(backups) > 5:
            print(f"  ... and {len(backups) - 5} more")

    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="ML Model Versioning")
    parser.add_argument("--output", default="./model_backups", help="Backup output directory")
    parser.add_argument("--label", help="Optional label for this backup (e.g., 'pre-fomc')")
    parser.add_argument("--list", action="store_true", help="List current model versions")
    parser.add_argument("--restore", metavar="PATH", help="Restore from a backup archive")
    parser.add_argument("--status", action="store_true", help="Print model version status")
    args = parser.parse_args()

    ml_dir = ML_ENGINE_DIR
    models_dir = get_model_store_path()
    output_dir = Path(args.output).resolve()

    if args.list:
        versions = list_versions(models_dir)
        for v in versions:
            print(f"{v['name']}: {v['size_mb']} MB")
        return

    if args.restore:
        restore_backup(Path(args.restore), models_dir)
        return

    if args.status or (not args.list and not args.restore):
        print_status(models_dir, output_dir)
        print("\nTo create a backup: python scripts/version_models.py --output ./backups --label <name>")

    if args.output != "./model_backups" or args.label:
        create_backup(models_dir, output_dir, args.label)


if __name__ == "__main__":
    main()
