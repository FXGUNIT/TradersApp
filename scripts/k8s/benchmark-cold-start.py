#!/usr/bin/env python3
"""
Benchmark cold-start and warm-request latency for TradersApp ML Engine.

Enhanced Phase 6 version with:
  (a) Measure time from pod creation → /health returning 200
  (b) Measure time from new model load → first /predict returning 200
  (c) Output CSV with columns: timestamp, event, duration_ms, replica

Usage:
  # Measure cold-start for ml-engine in tradersapp-dev
  python scripts/k8s/benchmark-cold-start.py --namespace tradersapp-dev

  # Measure model-load time for a specific model
  python scripts/k8s/benchmark-cold-start.py \
    --deployment ml-engine \
    --measure-model-load \
    --model-name direction_v3

  # Multiple replicas, CSV output
  python scripts/k8s/benchmark-cold-start.py \
    --replicas 1 2 4 \
    --output-csv cold-start-results.csv

  # Skip restart (measure current state)
  python scripts/k8s/benchmark-cold-start.py --skip-restart

  # Dry-run syntax check
  python -m py_compile scripts/k8s/benchmark-cold-start.py && echo "OK"

Prerequisites:
  - kubectl configured for the target k3s/Railway cluster
  - Services deployed in the target namespace
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import platform
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
LOCK_SCOPE = "exclusive-live-ops"
LOCK_ROOT = REPO_ROOT / ".artifacts" / "cluster-locks"


# ─── Default test payload ───────────────────────────────────────────────────────

DEFAULT_PAYLOAD = {
    "symbol": "MNQ",
    "candles": [
        {
            "symbol": "MNQ",
            "timestamp": "1712500000",
            "open": 18500.0,
            "high": 18505.0,
            "low": 18498.0,
            "close": 18503.0,
            "volume": 4200,
        },
        {
            "symbol": "MNQ",
            "timestamp": "1712500300",
            "open": 18503.0,
            "high": 18508.5,
            "low": 18499.0,
            "close": 18507.0,
            "volume": 4350,
        },
        {
            "symbol": "MNQ",
            "timestamp": "1712500600",
            "open": 18507.0,
            "high": 18512.0,
            "low": 18506.5,
            "close": 18510.5,
            "volume": 4510,
        },
    ],
    "trades": [],
    "session_id": 1,
    "mathEngineSnapshot": {"amdPhase": "ACCUMULATION", "vrRegime": "NORMAL"},
}


# ─── Data model ────────────────────────────────────────────────────────────────

@dataclass
class BenchmarkEvent:
    timestamp: str          # ISO8601
    event: str              # e.g. "pod_create", "health_200", "predict_200"
    duration_ms: float      # ms since benchmark start
    replica: str           # pod name or replica index
    detail: str = ""        # extra context (HTTP status, etc.)


@dataclass
class BenchmarkResult:
    deployment: str
    service: str
    endpoint: str
    pod_create_to_health_ms: float = 0.0   # (a) pod creation → /health 200
    pod_create_to_predict_ms: float = 0.0  # (b) pod creation → first /predict 200
    model_load_to_predict_ms: float = 0.0  # (b variant) model load → first /predict 200
    cold_request_ms: float = 0.0
    cold_status: int = 0
    warm_requests_ms: list = field(default_factory=list)
    warm_avg_ms: float = 0.0
    warm_p95_ms: float = 0.0
    replica_count: int = 1
    max_cold_ms: float = 2000.0
    max_warm_p95_ms: float = 500.0
    passed: bool = False
    events: list = field(default_factory=list)


def _lock_slug(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "._-" else "-" for ch in value or "unknown")


def get_kubernetes_events(namespace: str, deployment: str) -> list[dict]:
    """
    Fetch Kubernetes pod events for the given deployment, sorted by creation time.
    Returns a list of dicts: {name, namespace, involvedObject, type, reason,
                            message, eventTime, firstTimestamp, lastTimestamp}.
    """
    result = subprocess.run(
        [
            "kubectl", "-n", namespace,
            "get", "events",
            "--field-selector", f"involvedObject.namespace={namespace}",
            "-o", "jsonpath={.items[*]}",
        ],
        capture_output=True, text=True, check=False,
    )
    raw = result.stdout.strip()
    if not raw:
        return []

    # kubectl jsonpath={.items[*]} returns a space-separated list of JSON objects;
    # parse each one individually.
    events: list[dict] = []
    try:
        import json as _json
        # Each object is a separate JSON blob separated by whitespace.
        for raw_obj in raw.split("}"):
            trimmed = raw_obj.strip().rstrip("}")
            if not trimmed:
                continue
            try:
                obj = _json.loads(trimmed + "}")
                # Filter to events that mention the deployment name in involvedObject
                name = (obj.get("involvedObject", {}) or {}).get("name", "")
                if name and deployment in name:
                    events.append(obj)
            except Exception:
                continue
    except Exception:
        return []

    # Sort by firstTimestamp ascending
    def _ts(e: dict) -> float:
        raw_ts = (
            e.get("eventTime")
            or e.get("firstTimestamp")
            or e.get("lastTimestamp")
            or ""
        )
        if not raw_ts:
            return 0.0
        try:
            return datetime.fromisoformat(raw_ts.replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0.0

    return sorted(events, key=_ts)


def track_kubernetes_events(
    namespace: str,
    deployment: str,
    benchmark_start_epoch: float,
    replica_index: int,
) -> list[BenchmarkEvent]:
    """
    Query Kubernetes for pod events after benchmark_start_epoch and emit
    BenchmarkEvent records for each meaningful phase:
      Scheduled, PodScheduled, ContainersReady, Ready
    with colab_start_event timestamp embedded in the detail field.
    """
    events_out: list[BenchmarkEvent] = []
    all_events = get_kubernetes_events(namespace, deployment)

    def _iso_now() -> str:
        return datetime.now(timezone.utc).isoformat()

    # Known k8s event reasons we care about, in order
    PHASE_KEYS = [
        ("Scheduled",   "PodScheduled"),
        ("ContainersReady", "ContainerSetup"),
        ("Ready",       "Ready"),
    ]

    seen: set[str] = set()
    for ev in all_events:
        reason     = ev.get("reason", "")
        msg        = ev.get("message", "") or ev.get("note", "")
        ts_raw     = (
            ev.get("eventTime")
            or ev.get("firstTimestamp")
            or ev.get("lastTimestamp")
            or ""
        )
        if not ts_raw:
            continue
        try:
            event_epoch = datetime.fromisoformat(ts_raw.replace("Z", "+00:00")).timestamp()
        except Exception:
            continue

        # Only include events that fired after benchmark started
        if event_epoch < benchmark_start_epoch - 5:  # 5s grace period
            continue

        duration_ms = round((event_epoch - benchmark_start_epoch) * 1000.0, 2)

        if reason in [k for k, _ in PHASE_KEYS] and reason not in seen:
            seen.add(reason)
            # Embed colab_start_event-style timestamp in detail
            colab_ts = ts_raw
            events_out.append(BenchmarkEvent(
                timestamp=_iso_now(),
                event=f"k8s_{reason}",
                duration_ms=duration_ms,
                replica=str(replica_index),
                detail=f"colab_start_event={colab_ts}  reason={reason}  msg={msg[:80]}",
            ))

    return events_out
    result = subprocess.run(
        ["kubectl", "config", "current-context"],
        capture_output=True,
        text=True,
        check=False,
    )
    context = result.stdout.strip()
    return context or "unknown-context"


class ClusterOperationLock:
    def __init__(self, namespace: str, operation: str, scope: str = LOCK_SCOPE) -> None:
        self.namespace = namespace
        self.operation = operation
        self.scope = scope
        self.context = get_kube_context()
        lock_name = "__".join(
            [
                _lock_slug(self.context),
                _lock_slug(namespace),
                _lock_slug(scope),
            ]
        )
        self.lock_dir = LOCK_ROOT / lock_name
        self.owner_file = self.lock_dir / "owner.txt"

    def acquire(self) -> None:
        LOCK_ROOT.mkdir(parents=True, exist_ok=True)
        try:
            self.lock_dir.mkdir()
        except FileExistsError as exc:
            owner = ""
            if self.owner_file.exists():
                owner = self.owner_file.read_text(encoding="utf-8", errors="replace")
            raise RuntimeError(
                "another live cluster operation lock is already active for "
                f"context={self.context} namespace={self.namespace} scope={self.scope}\n"
                f"{owner}".rstrip()
            ) from exc

        self.owner_file.write_text(
            "\n".join(
                [
                    f"operation={self.operation}",
                    f"script={Path(__file__).name}",
                    f"pid={os.getpid()}",
                    f"context={self.context}",
                    f"namespace={self.namespace}",
                    f"scope={self.scope}",
                    f"cwd={os.getcwd()}",
                    f"host={platform.node() or 'unknown-host'}",
                    f"started_at={datetime.now(timezone.utc).isoformat()}",
                ]
            )
            + "\n",
            encoding="utf-8",
        )

    def release(self) -> None:
        if self.owner_file.exists():
            self.owner_file.unlink()
        try:
            self.lock_dir.rmdir()
        except FileNotFoundError:
            return


# ─── HTTP helpers ──────────────────────────────────────────────────────────────

def http_request(
    url: str,
    payload: Optional[dict] = None,
    timeout: float = 10.0,
    method: str = "GET",
) -> tuple[int, str]:
    """Returns (http_status, response_body)."""
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(
        url, data=data, headers=headers, method=method
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        body = response.read().decode("utf-8", errors="replace")
        return response.status, body


def timed_request(
    url: str,
    payload: Optional[dict] = None,
    timeout: float = 20.0,
    method: str = "POST",
) -> tuple[float, int, str]:
    """Returns (elapsed_ms, http_status, response_body)."""
    started = time.perf_counter()
    status, body = http_request(url, payload=payload, timeout=timeout, method=method)
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    return elapsed_ms, status, body


# ─── Pod / k8s helpers ─────────────────────────────────────────────────────────

def get_pod_names(namespace: str, deployment: str) -> list[str]:
    """Return list of running pod names for the given deployment."""
    result = subprocess.run(
        [
            "kubectl", "-n", namespace,
            "get", "pods",
            "-l", f"app={deployment}",
            "--field-selector", "status.phase=Running",
            "-o", "jsonpath={.items[*].metadata.name}",
        ],
        capture_output=True, text=True, check=False,
    )
    return result.stdout.strip().split() if result.stdout.strip() else []


def get_oldest_pod_creation_timestamp(namespace: str, deployment: str) -> Optional[float]:
    """
    Return the oldest pod creation timestamp (Unix epoch) among running pods.
    Returns None if no pods are found.
    """
    result = subprocess.run(
        [
            "kubectl", "-n", namespace,
            "get", "pods",
            "-l", f"app={deployment}",
            "--field-selector", "status.phase=Running",
            "-o", "jsonpath={.items[*].metadata.creationTimestamp}",
        ],
        capture_output=True, text=True, check=False,
    )
    timestamps_raw = result.stdout.strip()
    if not timestamps_raw:
        return None

    from datetime import datetime
    ts_list = []
    for raw in timestamps_raw.split():
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            ts_list.append(dt.timestamp())
        except ValueError:
            continue
    return min(ts_list) if ts_list else None


def wait_for_health(url: str, timeout_seconds: int) -> float:
    """
    Poll health endpoint until 200 or timeout.
    Returns the elapsed_ms from start to first 200, or raises RuntimeError.
    """
    deadline = time.time() + timeout_seconds
    last_error = "unknown"
    while time.time() < deadline:
        try:
            status, _ = http_request(url, timeout=3.0)
            if status == 200:
                return (time.time() - (deadline - timeout_seconds)) * 1000.0
            last_error = f"HTTP {status}"
        except Exception as exc:  # pragma: no cover - operational helper
            last_error = str(exc)
        time.sleep(2)
    raise RuntimeError(f"Timed out waiting for health at {url}: {last_error}")


def start_port_forward(
    namespace: str, service: str, local_port: int, remote_port: int
) -> subprocess.Popen:
    return subprocess.Popen(
        [
            "kubectl", "-n", namespace,
            "port-forward", f"svc/{service}",
            f"{local_port}:{remote_port}",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )


# ─── CSV writer ─────────────────────────────────────────────────────────────────

CSV_FIELDNAMES = [
    "timestamp", "event", "duration_ms", "replica", "detail",
]


def write_events_csv(events: list[BenchmarkEvent], path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        for ev in events:
            writer.writerow({
                "timestamp":   ev.timestamp,
                "event":       ev.event,
                "duration_ms": round(ev.duration_ms, 2),
                "replica":     ev.replica,
                "detail":      ev.detail,
            })


# ─── Core benchmark logic ───────────────────────────────────────────────────────

def run_benchmark(
    namespace: str,
    deployment: str,
    service: str,
    base_url: str,
    endpoint: str,
    health_path: str,
    local_port: int,
    remote_port: int,
    warm_requests: int,
    timeout_seconds: int,
    max_cold_ms: float,
    max_warm_p95_ms: float,
    skip_restart: bool,
    measure_model_load: bool,
    model_name: Optional[str],
    output_json: Optional[str],
    output_csv: Optional[str],
    replica_index: int,
) -> BenchmarkResult:
    """
    Run a single cold-start benchmark iteration.

    Returns a BenchmarkResult with all timing data and pass/fail.
    """
    start_epoch = time.time()
    events: list[BenchmarkEvent] = []

    def now_ms() -> float:
        return (time.time() - start_epoch) * 1000.0

    def ts() -> str:
        return datetime.now(timezone.utc).isoformat()

    def add(event: str, replica: str, detail: str = "") -> None:
        events.append(BenchmarkEvent(
            timestamp=ts(),
            event=event,
            duration_ms=round(now_ms(), 2),
            replica=replica,
            detail=detail,
        ))

    port_forward: Optional[subprocess.Popen] = None
    pod_create_ts: Optional[float] = None

    try:
        # ── Record pre-restart pod list ──────────────────────────────────────
        pods_before = get_pod_names(namespace, deployment)
        add("benchmark_start", str(replica_index), f"pods_before={pods_before}")

        # ── Record pod creation timestamp (if restarting) ─────────────────────
        if not skip_restart:
            pod_create_ts = get_oldest_pod_creation_timestamp(namespace, deployment)
            add("pod_creation_recorded", str(replica_index),
                f"ts={pod_create_ts}" if pod_create_ts else "ts=unknown")

        # ── Restart deployment (unless --skip-restart) ───────────────────────
        if not skip_restart:
            add("rollout_restart_begin", str(replica_index))
            subprocess.run(
                ["kubectl", "-n", namespace, "rollout", "restart",
                 f"deployment/{deployment}"],
                check=True, capture_output=True,
            )
            add("rollout_restart_issued", str(replica_index))

            # Wait for rollout to complete
            subprocess.run(
                ["kubectl", "-n", namespace, "rollout", "status",
                 f"deployment/{deployment}", f"--timeout={timeout_seconds}s"],
                check=True, capture_output=True,
            )
            add("rollout_status_complete", str(replica_index))

        # ── Set up port-forward ──────────────────────────────────────────────
        if base_url:
            url_prefix = base_url.rstrip("/")
        else:
            add("port_forward_start", str(replica_index))
            port_forward = start_port_forward(
                namespace, service, local_port, remote_port
            )
            url_prefix = f"http://127.0.0.1:{local_port}"
            sleep_until = time.time() + 10
            while time.time() < sleep_until:
                try:
                    http_request(f"{url_prefix}/health", timeout=2.0)
                    break
                except Exception:
                    pass
                time.sleep(0.5)
            add("port_forward_ready", str(replica_index))

        health_url    = f"{url_prefix}{health_path}"
        predict_url   = f"{url_prefix}{endpoint}"
        full_start_ms = now_ms()

        # ── (a) Measure: pod creation → /health returning 200 ────────────────
        add("health_poll_start", str(replica_index), f"url={health_url}")

        try:
            # (a) Time from pod creation (or restart) to first 200 health response
            health_elapsed_ms = wait_for_health(health_url, timeout_seconds)
            # health_elapsed_ms is time since wait_for_health was called
            # For pod_create_to_health: we need wall-clock from restart
            pod_create_to_health_ms = now_ms() if pod_create_ts is None else \
                (time.time() - pod_create_ts) * 1000.0

            add("health_200", str(replica_index),
                f"pod_create_to_health={round(pod_create_to_health_ms, 1)}ms")
        except RuntimeError as exc:
            add("health_timeout", str(replica_index), str(exc))
            pod_create_to_health_ms = -1.0
            health_elapsed_ms = -1.0

        # ── (b) Measure: first /predict request after health ─────────────────
        add("first_predict_start", str(replica_index), f"url={predict_url}")
        model_load_to_predict_ms: float = -1.0

        try:
            cold_ms, cold_status, cold_body = timed_request(
                predict_url, payload=DEFAULT_PAYLOAD, timeout=float(timeout_seconds)
            )
            model_load_to_predict_ms = now_ms() if pod_create_ts is None else \
                (time.time() - pod_create_ts) * 1000.0

            add("first_predict_response", str(replica_index),
                f"status={cold_status}  duration={round(cold_ms, 1)}ms  "
                f"model_load_to_predict={round(model_load_to_predict_ms, 1)}ms")
        except Exception as exc:
            cold_ms = -1.0
            cold_status = 0
            cold_body = ""
            add("first_predict_error", str(replica_index), str(exc))

        # ── (b variant) Measure model load time directly ─────────────────────
        if measure_model_load and model_name:
            model_load_result = _measure_model_load(
                namespace, service, local_port, remote_port, url_prefix,
                model_name, timeout_seconds
            )
            model_load_to_predict_ms = model_load_result

        # ── Warm requests ────────────────────────────────────────────────────
        warm_latencies: list[float] = []
        for i in range(warm_requests):
            add(f"warm_request_{i+1}_start", str(replica_index))
            try:
                elapsed_ms, status, _ = timed_request(
                    predict_url, payload=DEFAULT_PAYLOAD, timeout=15.0
                )
                if status != 200:
                    raise RuntimeError(f"HTTP {status}")
                warm_latencies.append(elapsed_ms)
                add(f"warm_request_{i+1}_200", str(replica_index),
                    f"{round(elapsed_ms, 1)}ms")
            except Exception as exc:
                add(f"warm_request_{i+1}_error", str(replica_index), str(exc))

        # ── Compute statistics ────────────────────────────────────────────────
        warm_avg_ms = (
            round(statistics.mean(warm_latencies), 2)
            if warm_latencies else 0.0
        )
        warm_p95_ms = (
            max(warm_latencies) if len(warm_latencies) < 2
            else round(statistics.quantiles(warm_latencies, n=20)[18], 2)
        )

        pod_create_to_predict_ms = (
            (time.time() - pod_create_ts) * 1000.0
            if pod_create_ts is not None and cold_status == 200
            else -1.0
        )

        overall_pass = (
            cold_status == 200
            and (pod_create_to_health_ms < 0 or pod_create_to_health_ms <= max_cold_ms)
            and warm_p95_ms <= max_warm_p95_ms
        )

        result = BenchmarkResult(
            deployment=deployment,
            service=service,
            endpoint=endpoint,
            pod_create_to_health_ms=round(pod_create_to_health_ms, 2),
            pod_create_to_predict_ms=round(pod_create_to_predict_ms, 2),
            model_load_to_predict_ms=round(model_load_to_predict_ms, 2),
            cold_request_ms=round(cold_ms, 2),
            cold_status=cold_status,
            warm_requests_ms=[round(v, 2) for v in warm_latencies],
            warm_avg_ms=warm_avg_ms,
            warm_p95_ms=warm_p95_ms,
            replica_count=replica_index,
            max_cold_ms=max_cold_ms,
            max_warm_p95_ms=max_warm_p95_ms,
            passed=overall_pass,
            events=events,
        )

    finally:
        if port_forward is not None:
            port_forward.terminate()
            try:
                port_forward.wait(timeout=5)
            except subprocess.TimeoutExpired:
                port_forward.kill()
                port_forward.wait(timeout=5)

    return result


def _measure_model_load(
    namespace: str,
    service: str,
    local_port: int,
    remote_port: int,
    url_prefix: str,
    model_name: str,
    timeout_seconds: int,
) -> float:
    """
    Trigger model reload and measure time until first successful inference.
    Calls the ML Engine's internal /internal/reload-model endpoint (if available),
    then fires /predict requests until a 200 is seen.
    """
    start = time.time()

    reload_url = f"{url_prefix}/internal/reload-model"
    try:
        status, _ = http_request(
            reload_url,
            payload={"model_name": model_name},
            timeout=5.0,
            method="POST",
        )
    except Exception:
        pass  # endpoint may not exist; fall through to predict polling

    # Poll /predict until 200
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            elapsed_ms, status, _ = timed_request(
                f"{url_prefix}/predict",
                payload=DEFAULT_PAYLOAD,
                timeout=10.0,
            )
            if status == 200:
                return elapsed_ms
        except Exception:
            pass
        time.sleep(1)

    return -1.0


# ─── CLI main ──────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Benchmark cold-start and warm-request latency for TradersApp services."
    )
    parser.add_argument(
        "--namespace", default="tradersapp-dev",
        help="Kubernetes namespace to target",
    )
    parser.add_argument(
        "--deployment", default="ml-engine",
        help="Deployment to restart before measuring",
    )
    parser.add_argument(
        "--service", default="ml-engine",
        help="Service name to port-forward if --base-url is omitted",
    )
    parser.add_argument(
        "--base-url", default="",
        help="Existing base URL to benchmark (skips port-forward)",
    )
    parser.add_argument(
        "--health-path", default="/health",
        help="Health path to poll before measuring",
    )
    parser.add_argument(
        "--endpoint", default="/predict",
        help="POST endpoint to benchmark",
    )
    parser.add_argument(
        "--local-port", type=int, default=8001,
        help="Local port for port-forward",
    )
    parser.add_argument(
        "--remote-port", type=int, default=8001,
        help="Remote service port for port-forward",
    )
    parser.add_argument(
        "--warm-requests", type=int, default=5,
        help="Number of warm requests after the first cold request",
    )
    parser.add_argument(
        "--timeout", type=int, default=180,
        help="Seconds to wait for rollout and health recovery",
    )
    parser.add_argument(
        "--max-cold-ms", type=float, default=2000.0,
        help="Fail if cold-start latency exceeds this threshold",
    )
    parser.add_argument(
        "--max-warm-p95-ms", type=float, default=500.0,
        help="Fail if warm-request p95 exceeds this threshold",
    )
    parser.add_argument(
        "--skip-restart", action="store_true",
        help="Measure current state without restarting the deployment",
    )
    parser.add_argument(
        "--output-json", default="",
        help="Optional path to write the JSON summary",
    )
    parser.add_argument(
        "--output-csv", default="",
        help="Optional path to write per-event CSV (timestamp, event, duration_ms, replica)",
    )
    parser.add_argument(
        "--replicas", nargs="+", type=int, default=[1],
        help="Replica counts to sweep (runs benchmark for each)",
    )
    parser.add_argument(
        "--measure-model-load", action="store_true",
        help="Also measure time for model reload + first inference",
    )
    parser.add_argument(
        "--model-name", default="",
        help="Model name to reload (used with --measure-model-load)",
    )
    parser.add_argument(
        "--format", default="json",
        choices=["json", "csv"],
        help="Output format for results (default: json)",
    )

    args = parser.parse_args()
    lock = ClusterOperationLock(args.namespace, "benchmark-cold-start")

    try:
        lock.acquire()
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    all_results: list[BenchmarkResult] = []
    all_pass = True

    try:
        for replica_count in args.replicas:
            # Scale deployment to target replica count
            if replica_count != int(
                subprocess.run(
                    ["kubectl", "-n", args.namespace, "get", "deploy", args.deployment,
                     "-o", "jsonpath={.spec.replicas}"],
                    capture_output=True, text=True, check=False,
                ).stdout.strip() or "1"
            ):
                subprocess.run(
                    ["kubectl", "-n", args.namespace, "scale",
                     "deploy", args.deployment, f"--replicas={replica_count}"],
                    check=True,
                )
                subprocess.run(
                    ["kubectl", "-n", args.namespace, "rollout", "status",
                     "deploy", args.deployment, f"--timeout={args.timeout}s"],
                    check=True,
                )

            result = run_benchmark(
                namespace=args.namespace,
                deployment=args.deployment,
                service=args.service,
                base_url=args.base_url,
                endpoint=args.endpoint,
                health_path=args.health_path,
                local_port=args.local_port,
                remote_port=args.remote_port,
                warm_requests=args.warm_requests,
                timeout_seconds=args.timeout,
                max_cold_ms=args.max_cold_ms,
                max_warm_p95_ms=args.max_warm_p95_ms,
                skip_restart=args.skip_restart,
                measure_model_load=args.measure_model_load,
                model_name=args.model_name or None,
                output_json=None,
                output_csv=None,
                replica_index=replica_count,
            )
            all_results.append(result)
            all_pass = all_pass and result.passed

            summary = {
                "deployment": result.deployment,
                "service": result.service,
                "endpoint": result.endpoint,
                "replica_count": replica_count,
                "pod_create_to_health_ms": result.pod_create_to_health_ms,
                "pod_create_to_predict_ms": result.pod_create_to_predict_ms,
                "model_load_to_predict_ms": result.model_load_to_predict_ms,
                "cold_request_ms": result.cold_request_ms,
                "cold_status": result.cold_status,
                "warm_requests_ms": result.warm_requests_ms,
                "warm_avg_ms": result.warm_avg_ms,
                "warm_p95_ms": result.warm_p95_ms,
                "max_cold_ms": result.max_cold_ms,
                "max_warm_p95_ms": result.max_warm_p95_ms,
                "pass": result.passed,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            print(json.dumps(summary, indent=2))

            if args.output_csv or args.format == "csv":
                csv_path = args.output_csv or (
                    f"tests/load/results/cold-start-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.csv"
                )
                if len(args.replicas) > 1:
                    csv_path = csv_path.replace('.csv', f'-replica-{replica_count}.csv')
                Path(csv_path).parent.mkdir(parents=True, exist_ok=True)

                # Attach k8s pod events (with colab_start_event timestamps) before writing CSV
                k8s_events = track_kubernetes_events(
                    args.namespace, args.deployment,
                    start_epoch=time.time(),  # approximate; events captured after restart
                    replica_index=replica_count,
                )
                write_events_csv(result.events + k8s_events, csv_path)
                print(f'CSV written: {csv_path}')

            json_path = args.output_json
            if json_path:
                if len(args.replicas) > 1:
                    json_path = json_path.replace('.json', f'-replica-{replica_count}.json')
                Path(json_path).parent.mkdir(parents=True, exist_ok=True)
                Path(json_path).write_text(json.dumps(summary, indent=2), encoding='utf-8')

            print(
                f'[replica={replica_count}] '
                f'pod_create->health={result.pod_create_to_health_ms}ms  '
                f'pod_create->predict={result.pod_create_to_predict_ms}ms  '
                f'warm_p95={result.warm_p95_ms}ms  '
                f'pass={result.passed}'
            )
            print()

        if not all_pass:
            print('RESULT: FAIL - one or more thresholds breached', file=sys.stderr)
            return 1
        print('RESULT: PASS - all cold-start benchmarks passed thresholds')
        return 0
    finally:
        lock.release()
if __name__ == "__main__":
    raise SystemExit(main())
