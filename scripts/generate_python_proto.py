#!/usr/bin/env python3
"""
Generate Python gRPC stubs from proto files for ml-engine.

Usage:
  python scripts/generate_python_proto.py          # Generate all
  python scripts/generate_python_proto.py --watch  # Watch mode
  python scripts/generate_python_proto.py --clean # Remove generated stubs

Requirements:
  pip install grpcio-tools

Proto files:
  proto/ddd/v1/analysis.proto  → ml_engine/generated/ddd/v1/analysis_pb2.py
  proto/ddd/v1/common.proto   → ml_engine/generated/ddd/v1/common_pb2.py
  proto/ddd/v1/ingestion.proto → ml_engine/generated/ddd/v1/ingestion_pb2.py
  proto/ddd/v1/learning.proto → ml_engine/generated/ddd/v1/learning_pb2.py
  proto/ddd/v1/analysis.proto → ml_engine/generated/ddd/v1/analysis_pb2_grpc.py
  (and combined _pb2_grpc.py for all services)

The ml-engine gRPC server should import from:
  from ml_engine.generated.ddd.v1 import analysis_pb2, analysis_pb2_grpc
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
PROTO_DIR = PROJECT_ROOT / "proto" / "ddd" / "v1"
OUT_DIR = PROJECT_ROOT / "ml-engine" / "generated" / "ddd" / "v1"

# Proto files to compile (order matters for imports)
PROTO_FILES = [
    PROTO_DIR / "common.proto",
    PROTO_DIR / "analysis.proto",
    PROTO_DIR / "ingestion.proto",
    PROTO_DIR / "learning.proto",
]

# Package path for each proto (mirrors PROTO_DIR structure)
PROTO_PACKAGE_MAP = {
    "common.proto": "ddd/v1",
    "analysis.proto": "ddd/v1",
    "ingestion.proto": "ddd/v1",
    "learning.proto": "ddd/v1",
}


def _find_protoc() -> Path | None:
    """Find protoc binary."""
    # Try system PATH
    import shutil as _sh
    path = _sh.which("protoc")
    if path:
        return Path(path)

    # Try common Windows locations
    for base in [Path("C:/Program Files"), Path("C:/Program Files (x86)")]:
        for sub in ["protobuf/src", "protobuf", "google.protobuf"]:
            protoc = base / sub / "protoc.exe"
            if protoc.exists():
                return protoc

    return None


def generate(out_dir: Path, verbose: bool = False) -> list[Path]:
    """
    Run protoc to generate Python stubs from proto files.

    Returns list of generated .py files.
    """
    protoc = _find_protoc()
    if not protoc:
        raise FileNotFoundError(
            "protoc not found. Install protobuf compiler:\n"
            "  Windows: choco install protobuf\n"
            "  macOS:   brew install protobuf\n"
            "  Linux:   apt install protobuf-compiler\n"
            "\nAlso install Python stubs: pip install grpcio-tools"
        )

    out_dir.mkdir(parents=True, exist_ok=True)

    # Build protoc command
    proto_files = [p for p in PROTO_FILES if p.exists()]
    if not proto_files:
        raise FileNotFoundError(f"No proto files found in {PROTO_DIR}")

    cmd = [
        str(protoc),
        f"--python_out={out_dir}",
        f"--pyi_out={out_dir}",
        f"--grpc_python_out={out_dir}",
        f"-I{PROTO_DIR.parent}",  # proto/ is the include root
        *[str(p) for p in proto_files],
    ]

    if verbose:
        print(f"[ProtoGen] protoc: {' '.join(cmd)}")

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[ProtoGen] ERROR:\n{result.stderr}")
        sys.exit(1)

    # Fix import paths in generated files
    _fix_import_paths(out_dir, proto_files)

    # List generated files
    generated = list(out_dir.glob("*_pb2*.py"))
    print(f"[ProtoGen] Generated {len(generated)} files in {out_dir}")
    for f in sorted(generated):
        print(f"  {f.relative_to(out_dir)}")
    return generated


def _fix_import_paths(out_dir: Path, proto_files: list[Path]) -> None:
    """
    Fix generated import statements.

    protoc generates: import analysis_pb2 as analysis_pb2
    We need:         from ml_engine.generated.ddd.v1 import analysis_pb2
    """
    for py_file in out_dir.glob("*_pb2*.py"):
        content = py_file.read_text()

        # Fix grpc import (it's always in the _grpc.py files)
        if "_pb2_grpc" in py_file.name:
            # Replace: import analysis_pb2 as analysis_pb2
            # With:    from ml_engine.generated.ddd.v1 import analysis_pb2
            import_name = py_file.name.replace("_pb2_grpc.py", "_pb2")
            new_import = f"from ml_engine.generated.ddd.v1 import {import_name}"
            old_import = f"import {import_name}"
            content = content.replace(old_import, new_import)

        py_file.write_text(content)


def clean(out_dir: Path) -> None:
    """Remove all generated stub files."""
    if out_dir.exists():
        shutil.rmtree(out_dir)
        print(f"[ProtoGen] Cleaned {out_dir}")


def init_import_path():
    """Add generated stubs to sys.path for local testing."""
    stub_path = PROJECT_ROOT / "ml-engine" / "generated"
    if str(stub_path) not in sys.path:
        sys.path.insert(0, str(stub_path))


def verify() -> bool:
    """Verify generated stubs can be imported."""
    init_import_path()
    try:
        from ml_engine.generated.ddd.v1 import common_pb2, analysis_pb2  # noqa: F401
        print("[ProtoGen] Verification PASSED — stubs importable")
        return True
    except ImportError as e:
        print(f"[ProtoGen] Verification FAILED: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Generate Python gRPC stubs from proto files")
    parser.add_argument("--out", type=str, default=str(OUT_DIR), help="Output directory")
    parser.add_argument("--proto-dir", type=str, default=str(PROTO_DIR), help="Proto source directory")
    parser.add_argument("--clean", action="store_true", help="Remove generated stubs")
    parser.add_argument("--verify", action="store_true", help="Verify stubs import correctly")
    parser.add_argument("--watch", action="store_true", help="Watch mode (requires watchgod)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    args = parser.parse_args()

    out_dir = Path(args.out)
    proto_dir = Path(args.proto_dir)

    if args.clean:
        clean(out_dir)
        return

    if args.verify:
        init_import_path()
        verify()
        return

    if args.watch:
        try:
            from watchgod import watch
        except ImportError:
            print("Watch mode requires: pip install watchgod")
            sys.exit(1)
        print(f"[ProtoGen] Watching {proto_dir} for changes...")
        for changes in watch(proto_dir):
            added = [p for p, t in changes if p.suffix == ".proto" and t == 1]
            if added:
                print(f"[ProtoGen] Proto file changed: {[p.name for p in added]}")
                generate(out_dir, args.verbose)
        return

    print("[ProtoGen] Generating Python gRPC stubs...")
    print(f"  Proto files: {proto_dir}")
    print(f"  Output:     {out_dir}")
    generated = generate(out_dir, args.verbose)

    if generated:
        print(f"\n[ProtoGen] {len(generated)} files generated.")
        print("\nTo use in ml-engine:")
        print("  from ml_engine.generated.ddd.v1 import analysis_pb2, analysis_pb2_grpc")
        print("\nTo verify imports:")
        print("  python scripts/generate_python_proto.py --verify")


if __name__ == "__main__":
    main()
