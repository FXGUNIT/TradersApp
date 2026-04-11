# 20-Point Platform Alignment Plan

**Last updated:** 2026-04-09

This document aligns the 20 platform tasks against the current TradersApp repo and the live work already completed in this chat.

## Why this version is different

Your original 20 items are directionally strong, but several of them overlap, and a few are too absolute for the current architecture.

The most important correction is this:

- Do **not** use Kafka for every inter-service call.
- Keep the **hot request path synchronous** for low latency.
- Use Kafka for **asynchronous** work: feedback loops, drift events, retraining triggers, data pipelines, and background processing.

That is the most apt scenario for this repo in its current form.

## Current Best-Fit Scenario

### Keep

- `k3s + Helm` as the primary self-hosted deployment path.
- `Infisical` as the upstream secrets source of truth.
- `MLflow + MinIO + PostgreSQL` as the MLOps core.
- `Redis` as the shared cache / online low-latency state layer.
- `Kafka` as the async event bus.
- `Airflow + Great Expectations` for data quality and retraining orchestration.
- `Prometheus + Grafana + Loki + Jaeger` as the observability stack.

### Do not force

- Kafka for all request/response traffic.
- WSL `k3s` as the final production target.
- a full rewrite into microservices before the platform baseline is stable.

### Production target

- WSL `k3s`: dev / lab / integration environment
- real production: proper Linux nodes, `k3s`, Helm, Longhorn, Infisical-backed secret sync

## Status Alignment Against Your 20 Tasks

| # | Task | Repo status | What already exists | What is still left | Est left |
|---|---|---|---|---|---:|
| 1 | Full containerization + self-hosted `k3s` | Partial | Dockerfiles, Compose stacks, Helm chart, Kustomize overlays, `k3s` bootstrap scripts, live WSL cluster work | Final Longhorn validation, flannel stability, real Linux-node target, production rollout proof | 2-4d |
| 2 | Full observability stack | Partial | `docker-compose.observability.yml`, `k8s/observability`, Prometheus endpoints, dashboards, alerts, Jaeger/OpenTelemetry code | Live k8s deployment, target scraping, Loki/Jaeger validation, alert routing, ops runbook verification | 3-5d |
| 3 | Self-hosted CI/CD with Gitea + Woodpecker | Partial | `.woodpecker.yml`, Gitea/Woodpecker docs, `scripts/ci/deploy-k3s.sh`, k8s verification scripts | Live runner setup, registry wiring, secrets wiring, smoke/rollback/canary completion | 3-5d |
| 4 | Event-driven architecture with Kafka | Partial | Kafka producer/consumer code, Helm Kafka chart, topic bootstrap, async feedback/drift flow | Use Kafka only where apt, add DLQ/lag/partitions/resilience, validate live broker behavior | 1-2w |
| 5 | DVC + Git reproducibility | Partial | `dvc.yaml`, DVC docs, DVC usage in ML docs and Airflow requirements | Reconcile tracked assets, verify remote, integrate with CI/MLflow cleanly, remove contradictions | 2-4d |
| 6 | Full MLOps lifecycle with MLflow | Partial | MLflow compose stack, Helm template, docs, client/test coverage | Live registry/artifact flow, promotion gates, rollback checks, persistent runtime validation | 2-4d |
| 7 | Great Expectations + Airflow DQ pipelines | Partial | Airflow requirements, docs, scripts, DAGs, DQ alert flow | Live deployment, expectation suites hardening, scheduled execution, alert verification | 4-6d |
| 8 | Low-latency inference serving with Triton/vLLM | Partial | Triton/vLLM Dockerfiles/manifests/docs/tests | Decide serving split, validate warmup/caching/autoscaling, hardware-aware tuning | 3-5d |
| 9 | Feast feature store | Partial | Feast repo, templates, docs, Redis/Postgres direction, export pipeline | Live apply/sync path, offline/online validation, registry/app integration cleanup | 3-5d |
| 10 | DDD-based modular microservices | Partial | Bounded-context docs, separate BFF/ML Engine/services, DDD verification script | Reduce remaining coupling, tighten service seams, avoid premature fragmentation | 1-2w |
| 11 | Model monitoring + auto retraining | Partial | Drift detection, model monitor, MLflow integration, retrain-related DAG/tests | Production thresholds, alert actions, retrain scheduling and safe promotion/rollback | 4-6d |
| 12 | Multi-level automated testing | Partial | unit/integration/load/chaos assets, Woodpecker verification steps, Locust and chaos files | CI gates, critical-path expansion, environment-backed smoke/perf rules | 4-6d |
| 13 | Security by design with Keycloak + Trivy | Partial | Keycloak code/docs, Trivy scanning, Trivy operator manifests, security docs | Enforce live scanning/policies, cluster auth flow, stronger service-to-service controls | 3-5d |
| 14 | ADR discipline | Mostly done | `docs/adr`, ADR register, creation script, existing architecture ADRs | Enforce updates in review flow, keep registry current | 0.5-1d |
| 15 | Docs-as-code with MkDocs | Mostly done | `mkdocs.yml`, docs tree, API/doc generation hooks | Publish/build path, fill missing sections, keep docs tied to releases | 1-2d |
| 16 | Redis caching + profiling | Partial | Redis integration, cache benchmark script, profiling helpers, BFF Redis session store | Remove remaining in-process cache dependence, standardize connection pooling and invalidation | 3-5d |
| 17 | Horizontal scalability from day one | Partial | HPAs, services, PVC work, Redis/Kafka direction, Helm production values | Finish statelessness, anti-affinity, topology spread, metric-based autoscaling, multi-node target | 1-2w |
| 18 | Resilient error handling + circuit breakers | Partial | some CB code/tests, retry/degrade patterns exist | Standardize across ML, Kafka, BFF, retraining, and external calls | 3-5d |
| 19 | Closed feedback loops for quantitative studies | Partial | feedback topics, drift alerts, retrain code/tests, Airflow direction | Final production outcome capture, schema discipline, retrain triggers, lineage | 3-5d |
| 20 | Regular architecture/code reviews + ADR enforcement | Partial | ADR process, docs, DDD checks, Woodpecker verification base | Add explicit review checklist and enforce ADR updates for major changes | 1-2d |

## What is already truly strong

- Dockerfiles and Compose coverage are already broad.
- Helm coverage is real and much fuller than the Kustomize path.
- MLflow, Airflow, observability, Kafka, Redis, Feast, Triton, Keycloak, ADRs, and MkDocs already exist in non-trivial form.
- This is **not** a greenfield platform build anymore.

## What is actually blocking progress

The platform is not blocked by a lack of tools.

It is blocked by four integration gaps:

1. live cluster validation is unfinished,
2. statefulness is not fully removed from runtime paths,
3. async/reliability behavior is only partially hardened,
4. many platform components exist in repo form but are not fully proven end-to-end.

## Revised Time Expectation

These estimates assume **one engineer**, mostly sequential work, existing repo reused instead of rewritten.

### Must do now

- finish live `k3s` / Longhorn / flannel / secret validation
- prove persistent app restart behavior

Expected: **2-4 days**

### Before production

- finish PostgreSQL cutover
- remove remaining in-process state
- finish Redis/Kafka hardening
- validate observability and alerts
- complete core CI/CD and deployment safety

Expected: **4-6 weeks**

### Full 20-point program at strong quality

- includes advanced testing, chaos, canary, deeper tracing, stronger security enforcement, and mature review process

Expected: **7-10 weeks**

### If parallelized well

With 2 contributors and low coordination overhead, the same full program could plausibly compress to:

- **4-6 weeks**

## Important accuracy note

I am **not** splitting each remaining task into 50+ subtasks.

That would create **1000+ pseudo-tasks**, most of them low-value and inaccurate.

The more accurate approach is:

- merge overlaps,
- keep only the real remaining epics,
- break those into a **single atomic execution list** with 50+ steps total.

That is what follows below.

## Atomic Execution List (64 steps)

### Stage A — Finish the live cluster foundation

1. Check `longhorn-system` pods after the flannel recovery.
2. Verify `StorageClass/longhorn` exists and is defaulted only if intended.
3. Create a small RWO Longhorn PVC and verify it binds.
4. Mount the RWO PVC from a test pod and verify write/read.
5. Create a small RWX Longhorn PVC and verify it binds.
6. Mount the RWX PVC from two pods and verify shared read/write.
7. Reboot or restart `k3s` once and verify Longhorn still comes back cleanly.
8. Reboot or restart `k3s` once and verify flannel recreates runtime state correctly.
9. If flannel still fails, persist the minimum safe runtime fix.
10. Verify node storage prerequisites remain present after restart.
11. Verify `local-path` and `longhorn` class behavior is not conflicting.
12. Record the validated cluster state in docs.

### Stage B — Secrets and deployment reality

13. Verify the in-cluster secret objects expected from Infisical actually exist.
14. Verify `ml-engine-secrets` contains `DATABASE_URL`.
15. Verify MLflow runtime secrets exist and match chart expectations.
16. Verify Redis-related secrets/config exist for the runtime path.
17. Verify BFF auth-related secrets exist.
18. Restart `ml-engine` and confirm it starts without SQLite fallback.
19. Restart BFF and confirm secret-backed startup is healthy.
20. Document the exact secret contract expected per service.

### Stage C — Database and persistent state

21. Audit every remaining SQLite read/write path in `ml-engine`.
22. Classify each SQLite usage as `must move`, `may stay dev-only`, or `remove`.
23. Finalize the PostgreSQL schema needed for live runtime writes.
24. Add or finish migration scripts for SQLite → PostgreSQL.
25. Backfill a representative dataset into PostgreSQL.
26. Verify concurrent write safety under multi-pod assumptions.
27. Remove or fence off Kubernetes runtime fallback to SQLite anywhere still reachable.
28. Validate `/data` contents that must survive restart beyond the DB itself.
29. Verify continual-learning artifacts persist correctly on `ml-state-pvc`.
30. Verify model storage persists correctly on the model PVC.

### Stage D — Shared state and low-latency runtime

31. Audit all in-process caches in `ml-engine`.
32. Replace remaining ML in-memory LRU behavior with shared Redis-backed behavior where required.
33. Standardize Redis connection pooling in Python code.
34. Audit BFF for any remaining in-process session/cache state.
35. Standardize Redis client reuse in BFF.
36. Add or finalize cache invalidation rules for shared data paths.
37. Add a request ID middleware path across BFF and ML Engine.
38. Propagate request IDs into logs and Kafka headers.
39. Add idempotency handling for retry-sensitive POST endpoints.
40. Validate degraded behavior when Redis is temporarily unavailable.

### Stage E — Kafka done the right way

41. Keep the hot request path synchronous and document that choice explicitly.
42. Define the exact async domains that should use Kafka.
43. Normalize Kafka topic schemas and ownership.
44. Ensure every `ml-engine` consumer group identity is pod-aware.
45. Validate manual offset commit behavior after successful processing only.
46. Add a DLQ topic strategy and poison-message handling.
47. Add consumer lag metrics and alert thresholds.
48. Define a partitioning strategy by symbol or other domain key.
49. Add producer-side circuit breaker and fallback buffering.
50. Verify the broker deployment path beyond a single-broker lab assumption.

### Stage F — Observability and operations

51. Deploy or validate the Prometheus stack in Kubernetes.
52. Ensure all target services expose scrape-ready metrics.
53. Validate Grafana datasources and dashboards against live data.
54. Validate Loki log shipping for BFF and ML Engine.
55. Validate Jaeger or OTLP traces across at least one full request path.
56. Add pod/node labels that matter for multi-pod debugging.
57. Tighten the alert set to the minimum operationally useful set.
58. Verify restart, latency, Kafka lag, and drift alerts really fire.

### Stage G — MLOps, data quality, and feature platform

59. Verify MLflow artifact persistence and registry behavior end to end.
60. Verify Feast offline and online stores against real runtime data.
61. Verify Airflow DAGs run successfully in their intended environment.
62. Verify Great Expectations gates actually block bad data before retraining.
63. Verify retraining writes lineage to MLflow and links to data versions.
64. Verify production feedback data can flow back into retraining safely.

## Optional next expansion after the 64 steps

After the steps above, the next maturity layer is:

- canary deployments,
- stronger Trivy/Keycloak enforcement,
- full chaos automation,
- stronger ADR enforcement in CI,
- MkDocs publication automation,
- deeper performance gates.

That work is valuable, but it should be treated as a second wave, not mixed into the current core execution line.
