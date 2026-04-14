# R09 Proof Artifact: Cross-Service Integration Under Real Orchestration

**Task:** R09 — Prove cross-service integration works under real orchestration, not just isolated tests.  
**Claimed by:** codex | **Date:** 2026-04-14  
**Status:** IN PROGRESS — core local process-stack path verified, wider dependency matrix still pending

---

## Scope

This proof run verifies the real local chain:

`Frontend (Vite dev server + /api proxy) -> BFF -> ML Engine`

It is not a synthetic unit test. The services were started as separate local processes, then exercised through the frontend proxy path and through an ML Engine restart.

---

## Runtime Artifact

- Result summary: `.tmp_codex/r09-process-stack-20260414-165543/result.json`
- Service logs:
  - `.tmp_codex/r09-process-stack-20260414-165543/ml-engine.out.log`
  - `.tmp_codex/r09-process-stack-20260414-165543/ml-engine.err.log`
  - `.tmp_codex/r09-process-stack-20260414-165543/bff.out.log`
  - `.tmp_codex/r09-process-stack-20260414-165543/bff.err.log`
  - `.tmp_codex/r09-process-stack-20260414-165543/frontend.out.log`
  - `.tmp_codex/r09-process-stack-20260414-165543/frontend.err.log`

Environment used for the process proof:

- `BFF_HOST=127.0.0.1`
- `BFF_PORT=8788`
- `ML_ENGINE_URL=http://127.0.0.1:8001`
- `ML_ENGINE_INTERNAL_URL=http://127.0.0.1:8001`
- `ML_ANALYSIS_TRANSPORT=http`
- `KAFKA_ENABLE=false`
- `OTEL_ENABLED=false`

---

## Verified Results

Recorded in `result.json`:

```json
{
  "ml_health_status": "healthy",
  "proxy_health_ok": true,
  "consensus_ok": true,
  "consensus_signal": "NEUTRAL",
  "consensus_source": "ml_engine",
  "regime_ok": true,
  "restart_health_status": 503,
  "restart_health_ok": false,
  "restart_health_error": "fetch failed",
  "recovered_health_ok": true,
  "recovered_consensus_ok": true,
  "recovered_consensus_source": "ml_engine"
}
```

Meaning:

1. ML Engine health was live and healthy.
2. Frontend proxy path `/api/ml/health` returned `ok=true`.
3. Frontend proxy path `/api/ml/consensus` returned `ok=true` with `source="ml_engine"`, proving the request reached the real ML Engine rather than a fallback source.
4. Frontend proxy path `/api/ml/regime` returned `ok=true`.
5. After force-stopping ML Engine, `/api/ml/health` degraded cleanly with `503` and `ok=false`.
6. After restarting ML Engine, `/api/ml/health` returned `ok=true` again.
7. After restart, `/api/ml/consensus` returned `ok=true` again with `source="ml_engine"`.

This directly satisfies the most important parts of R09 step 2, step 4, and step 5 for the local process-stack path.

---

## Code Fixes Required Before This Passed

The cross-service run initially failed and exposed real defects. The proof only turned green after these fixes:

1. FastAPI request body binding fixed across ML route modules by removing explicitly quoted request model annotations.
2. `/predict` and `/pso/discover` updated to accept dict payloads from the real BFF request shape.
3. `main.create_app()` updated to register the app with `_infrastructure`, restoring live `model_registry_client` access.
4. Lifespan-managed services (`db`, `consensus_agg`, `store`, `feedback_logger`, `retrain_pipeline`, `triton_client`) switched from stale import-time captures to runtime lookups in the ML route modules.

Without those fixes, the real proxy path failed with:

- `422` request-body binding failures
- `AttributeError: 'dict' object has no attribute 'model_dump'`
- `RuntimeError: Model registry client is not initialized`
- `AttributeError: 'NoneType' object has no attribute 'aggregate'`

---

## Residual Gaps

This does **not** close R09 yet. Remaining proof still needed:

1. Redis-backed paths are still noisy in local no-Redis mode.
   - BFF logs repeated Redis reconnect noise.
   - The proof run still works, but Redis-present behavior is not yet verified here.

2. News-provider calls are not stabilized for local offline proof.
   - Yahoo/GDELT fetch aborts appear in logs when upstream responses are unavailable or interrupted.
   - Consensus still completed successfully, but upstream news-provider resilience remains a separate proof item.

3. This proof is process-orchestrated, not Docker-orchestrated.
   - Docker Compose proof is still partially blocked by the host Docker Desktop / WSL failure tracked in `R01`.

4. Wider boundary matrix still missing.
   - Analysis service
   - Firebase-backed auth flows
   - Telegram hooks
   - Any Redis-present cross-service behavior

---

## Interim Verdict

The critical local integration seam is now proven:

- frontend proxy -> BFF -> ML Engine request path works
- real consensus and regime calls succeed through the proxy
- ML Engine restart degrades cleanly and recovers without manual cleanup

That is strong evidence for R09, but not the full finish line for all dependencies and orchestration variants.
