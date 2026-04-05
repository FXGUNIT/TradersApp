# Automated Testing Strategy

The pipeline now enforces four testing layers before any image publish or deploy step.

## 1. Unit Tests

Primary stack:

- `pytest`
- focused coverage on critical retrain and drift modules

CI stage:

- `verify-ml-engine`

Coverage gate:

- `feedback.retrain_pipeline`
- `infrastructure.drift_detector`
- `infrastructure.model_monitor`

## 2. Integration Tests

Integration tests boot a real ML Engine process and validate live HTTP contracts:

- `/health`
- `/sla`
- `/monitoring/status`
- `/metrics`

CI stage:

- `verify-ml-integration`

Entrypoint:

- [run_ml_engine_integration_smoke.py](../scripts/ci/run_ml_engine_integration_smoke.py)

## 3. Performance Tests

Performance smoke tests use Locust in headless mode against a live ML Engine.

Targets:

- `/predict`
- `/drift/status`

CI stage:

- `verify-performance`

Entrypoint:

- [run_locust_smoke.py](../scripts/ci/run_locust_smoke.py)

Local command:

```bash
locust -f tests/load/locustfile.py MLEngineUser --headless --host=http://127.0.0.1:8001 --users 8 --spawn-rate 2 --run-time 20s --sla-p95-ms 500 --max-fail-ratio 0.05
```

The CI smoke threshold is intentionally looser than the production alert threshold. CI runs on noisy shared infrastructure; Prometheus remains the source of truth for the stricter live SLA alerts.

## 4. Chaos Engineering

Chaos experiments are defined for Chaos Mesh and kept in `k8s/chaos/`.

Current manifests:

- [ml-engine-pod-chaos.yaml](../k8s/chaos/ml-engine-pod-chaos.yaml)
- [bff-network-delay-chaos.yaml](../k8s/chaos/bff-network-delay-chaos.yaml)

CI stage:

- `verify-chaos`

Entrypoint:

- [verify_chaos_mesh.py](../scripts/ci/verify_chaos_mesh.py)

## Installing Chaos Mesh in k3s

```bash
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm repo update
helm upgrade --install chaos-mesh chaos-mesh/chaos-mesh \
  --namespace chaos-testing \
  --create-namespace
```

Apply experiments:

```bash
kubectl apply -f k8s/chaos/
```

Run chaos only in non-production environments unless you have explicit blast-radius controls and rollback drills in place.
