from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

import httpx


REPO_ROOT = Path(__file__).resolve().parents[2]
ML_ENGINE_DIR = REPO_ROOT / "ml-engine"
TMP_ROOT = REPO_ROOT / ".tmp_ci"


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
            "ML_ENGINE_BASE_URL": "http://127.0.0.1:8001",
        }
    )
    return env


def main() -> int:
    TMP_ROOT.mkdir(exist_ok=True)
    run_dir = TMP_ROOT / f"ml-engine-integration-{int(time.time() * 1000)}"
    run_dir.mkdir(parents=True, exist_ok=True)
    log_path = run_dir / "ml-engine.log"
    env = build_env(str(run_dir))

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
                    "pytest",
                    "tests/integration/test_monitoring_endpoints.py",
                    "-q",
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
