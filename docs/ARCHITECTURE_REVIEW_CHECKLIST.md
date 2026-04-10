# Architecture Review Checklist

Every PR that introduces a new service, cross-service integration, ML model, or
infrastructure change must pass this checklist before merge.

---

## 1. ADR Coverage

- [ ] Is a new architectural decision being made? → Create an ADR in `docs/adr/`
- [ ] Does the ADR follow the template in `docs/adr/TEMPLATE.md`?
- [ ] Status is one of: `Proposed` / `Accepted` / `Deprecated` / `Superseded` / `Rejected`
- [ ] Has `docs/adr/REGISTER.md` been updated with the new ADR row?

---

## 2. API Contract

- [ ] New endpoints return the `BaseResponse` shape (`ok`, `error`, `latency_ms`, `timestamp`)
- [ ] Input validated with Pydantic (ML Engine) or Zod/manual check (BFF)
- [ ] Timeout wired: 5 s for ML Engine calls, 3 s for News
- [ ] Circuit breaker registered for any new external HTTP call in BFF
- [ ] `GET /health` returns 200 for any new service

---

## 3. Security

- [ ] No secrets hardcoded — all via Infisical / env vars
- [ ] No `eval()` / `new Function()` in JS
- [ ] No `exec()` with user-controlled input in Python
- [ ] SQL queries use parameterised statements only
- [ ] New BFF routes protected by `authorizeRequest` (or explicitly marked public)
- [ ] Rate limiting configured in `getRateLimitConfig()` for new paths
- [ ] CORS origins not expanded without justification
- [ ] Trivy scan passes (0 CRITICAL, 0 HIGH) for new Docker image

---

## 4. Observability

- [ ] New service exports Prometheus metrics at `/metrics`
- [ ] OTEL `service.name` set in Deployment env (`OTEL_SERVICE_NAME`)
- [ ] Structured logs include `request_id`, `latency_ms`, `status`
- [ ] Grafana / alert rules updated if new SLO introduced

---

## 5. Kubernetes / Infrastructure

- [ ] New Deployment has `livenessProbe` and `readinessProbe`
- [ ] `resources.requests` and `resources.limits` set
- [ ] `securityContext` enforces `runAsNonRoot`, `readOnlyRootFilesystem`, `drop ALL capabilities`
- [ ] NetworkPolicy in `security.yaml` updated if new pod-to-pod communication added
- [ ] HPA configured if service needs autoscaling
- [ ] PDB configured (minAvailable ≥ 1) for any stateful service

---

## 6. ML Engine (if applicable)

- [ ] New model follows one of the three patterns in `CLAUDE.md` (Classifier / Regressor / Ensemble)
- [ ] `train(X, y)` uses `TimeSeriesSplit` CV; no look-ahead leakage
- [ ] `predict(X)` returns explicit dict shape with guardrails
- [ ] `get_feature_importance()` implemented (SHAP or permutation)
- [ ] MLflow run logged with DVC commit hash tag (`dvc_commit`)
- [ ] Model passes thresholds before auto-registration: PBO < 5%, Sharpe ≥ 0.5, win rate ≥ 50%
- [ ] Paper traded for 1 full week before live use

---

## 7. Data / DVC

- [ ] New datasets tracked with `dvc add` (not committed raw to git)
- [ ] `.dvc` pointer file committed; data in DVC remote
- [ ] `dvc.yaml` pipeline stage added for new data transformation

---

## 8. Testing

- [ ] Unit tests cover the public contract of any new Python class
- [ ] Integration test covers the new BFF route shape (`ok`, status code)
- [ ] No `sleep` in tests — use `waitFor` / retry with timeout
- [ ] Coverage does not drop below existing threshold (check CI report)

---

## 9. Documentation

- [ ] `mkdocs.yml` nav updated if new documentation page added
- [ ] `mkdocs build --strict` passes locally
- [ ] `README.md` or service-level `README` updated if behaviour changes

---

## Reviewer Sign-off

| Reviewer | Role | Date | Notes |
| -------- | ---- | ---- | ----- |
|          |      |      |       |

> Checklist version: 1.0 — Maintained in `docs/ARCHITECTURE_REVIEW_CHECKLIST.md`
