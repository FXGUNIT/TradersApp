from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx


REPO_ROOT = Path(__file__).resolve().parents[2]
ML_ENGINE_DIR = REPO_ROOT / "ml-engine"


def wait_for_health(url: str, proc: subprocess.Popen, timeout_seconds: int = 120):
    deadline = time.time() + timeout_seconds
    last_error = "unknown"
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"ML Engine exited early with code {proc.returncode}")
        try:
            response = httpx.get(url, timeout=2.0)
            if response.status_code == 200:
                return
            last_error = f"HTTP {response.status_code}"
        except Exception as exc:  # pragma: no cover - exercised in CI
            last_error = str(exc)
        time.sleep(2)
    raise RuntimeError(f"Timed out waiting for ML Engine health: {last_error}")


def build_env(tmp_dir: str) -> dict[str, str]:
    env = os.environ.copy()
    env.update(
        {
            "DB_PATH": str(Path(tmp_dir) / "trading_data.db"),
            "MODEL_STORE": str(Path(tmp_dir) / "models"),
            "KAFKA_ENABLE": "false",
            "OTEL_ENABLED": "false",
            "MLFLOW_TRACKING_URI": "http://127.0.0.1:5999",
        }
    )
    return env


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="ml-engine-locust-") as tmp_dir:
        log_path = Path(tmp_dir) / "ml-engine.log"
        env = build_env(tmp_dir)
        sla_p95_ms = os.environ.get("CI_LOCUST_SLA_P95_MS", "500")
        max_fail_ratio = os.environ.get("CI_LOCUST_MAX_FAIL_RATIO", "0.05")

        with log_path.open("w", encoding="utf-8") as log_handle:
            proc = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "main:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "8001",
                ],
                cwd=ML_ENGINE_DIR,
                env=env,
                stdout=log_handle,
                stderr=subprocess.STDOUT,
            )

            try:
                wait_for_health("http://127.0.0.1:8001/health", proc)
                subprocess.run(
                    [
                        sys.executable,
                        "-m",
                        "locust",
                        "-f",
                        str(REPO_ROOT / "tests" / "load" / "locustfile.py"),
                        "MLEngineUser",
                        "--headless",
                        "--host",
                        "http://127.0.0.1:8001",
                        "--users",
                        "8",
                        "--spawn-rate",
                        "2",
                        "--run-time",
                        "20s",
                        "--stop-timeout",
                        "5",
                        "--sla-p95-ms",
                        str(sla_p95_ms),
                        "--max-fail-ratio",
                        str(max_fail_ratio),
                    ],
                    cwd=REPO_ROOT,
                    env=env,
                    check=True,
                )
                return 0
            except Exception:
                print(log_path.read_text(encoding="utf-8"))
                raise
            finally:
                proc.terminate()
                try:
                    proc.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
