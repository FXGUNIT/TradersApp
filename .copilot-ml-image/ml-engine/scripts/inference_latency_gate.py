#!/usr/bin/env python3
"""
Inference latency gate for CI/CD.

Usage:
  python ml-engine/scripts/inference_latency_gate.py
  python ml-engine/scripts/inference_latency_gate.py --model lightgbm_direction --samples 1000 --batch-size 32 --target-p99-ms 100
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ML_ENGINE_ROOT = PROJECT_ROOT / "ml-engine"
if str(ML_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ENGINE_ROOT))

from inference.triton_client import TritonInferenceClient


def main() -> None:
    parser = argparse.ArgumentParser(description="Run inference latency benchmark and enforce p99 SLA.")
    parser.add_argument("--model", default=os.environ.get("TRITON_MODEL", "lightgbm_direction"))
    parser.add_argument("--samples", type=int, default=1000)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--target-p99-ms", type=float, default=float(os.environ.get("INFERENCE_P99_TARGET_MS", "100")))
    parser.add_argument("--json-out", type=str, default="")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero when p99 exceeds target.")
    args = parser.parse_args()

    os.environ["INFERENCE_P99_TARGET_MS"] = str(args.target_p99_ms)

    client = TritonInferenceClient(url=os.environ.get("TRITON_URL", "localhost:8001"))
    try:
        result = client.benchmark(
            n_samples=max(1, args.samples),
            batch_size=max(1, args.batch_size),
            model_name=args.model,
        )
    except Exception as exc:
        result = {
            "model": args.model,
            "ok": False,
            "error": str(exc),
            "target_p99_ms": args.target_p99_ms,
            "meets_p99_target": False,
        }
        print(json.dumps(result, indent=2))
        if args.json_out:
            out_path = Path(args.json_out)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        raise SystemExit(2)

    print(json.dumps(result, indent=2))

    if args.json_out:
        out_path = Path(args.json_out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    if args.strict and not result.get("meets_p99_target", False):
        raise SystemExit(
            f"Inference latency gate failed: p99={result.get('p99_ms')}ms > target={result.get('target_p99_ms')}ms"
        )


if __name__ == "__main__":
    main()
