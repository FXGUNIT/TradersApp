# R11 Proof Artifact: Error Handling & Graceful Degradation

**Task:** R11 - Prove error handling and graceful degradation across expected failure modes.  
**Claimed by:** codex | **Date:** 2026-04-14  
**Status:** IN PROGRESS - core local dependency-loss scenarios are now verified, broader failure matrix still pending

---

## Scope

This proof covers real local failure injection for the most relevant currently reachable dependency-loss paths:

1. ML Engine unavailable
2. Redis unavailable
3. Optional breaking-news upstream timeouts

The goal here is not to prove every operational failure mode yet. The goal is to prove the app degrades predictably instead of crashing, hanging, or flooding logs when core supporting services disappear.

---

## Code Hardening Added

The following runtime changes were made to improve graceful degradation:

- `bff/services/redis-session-store.mjs`
  - Redis failures now enter a retry cooldown window instead of reconnecting on every later call.
  - local no-Redis operation still degrades, but without repeated reconnect spam.

- `bff/services/boardRoomService.mjs`
  - Board Room Redis now uses explicit connect attempts with cooldown rather than the Redis client's endless reconnect loop.
  - when Redis is absent locally, Board Room routes and cron jobs degrade quietly instead of emitting repeated connection errors.

- `bff/services/breakingNewsService.mjs`
  - Yahoo Finance RSS and GDELT timeout/abort cases are now logged as transient optional-source warnings.
  - warnings are deduped per source within a cooldown window.

- `bff/services/consensusEngine.mjs`
  - auxiliary ML-dependent news calls (`news-trigger`, `news/reactions`, `news/reaction`) now log deduped degraded warnings instead of repeated hard errors when ML is already unavailable.

---

## Verified Failure Cases

### 1. ML Engine Down

Environment:

- `ML_ENGINE_URL=http://127.0.0.1:8999`
- `ML_ENGINE_INTERNAL_URL=http://127.0.0.1:8999`
- BFF started on `http://127.0.0.1:8803`

Artifact:

- `.tmp_codex/bff-ml-down-verify-after/bff.out.log`
- `.tmp_codex/bff-ml-down-verify-after/bff.err.log`

Verified behavior:

- `GET /ml/health` returned `503`
- response body: `{"ok":false,"error":"fetch failed"}`
- `GET /ml/consensus?...` returned `503`
- response body still contained a controlled fallback payload:
  - `ok: false`
  - `source: "ml_engine_fallback"`
  - `signal: "NEUTRAL"`
  - `timing.reason: "ML Engine offline — enter manually with firm rules only"`
- auxiliary ML-dependent paths no longer emitted repeated hard errors
  - `news/reactions` logged one degraded warning
  - `news-trigger` logged one degraded warning
  - `0` `news-trigger failed` log lines
  - `0` `news/reactions failed` log lines

What this proves:

- the BFF does not crash when ML Engine is missing
- health checks become explicitly unhealthy
- consensus degrades to a bounded fallback payload instead of returning garbage or hanging
- auxiliary follow-up actions do not multiply the outage into extra noisy failures

### 2. Redis Down

Environment:

- BFF started on `http://127.0.0.1:8799`
- no Redis service present
- `REDIS_RETRY_COOLDOWN_MS=60000`

Artifact:

- `.tmp_codex/bff-no-redis-verify/bff.out.log`
- `.tmp_codex/bff-no-redis-verify/bff.err.log`

Verified behavior:

- `GET /health` returned `200`
- only one degraded Redis warning was emitted
- `0` `Reconnecting...` messages
- `0` `[boardRoom] Redis error` messages
- `0` `[Redis] Client error` messages

What this proves:

- local no-Redis operation stays live
- degraded background behavior is visible but not spammy
- Redis absence no longer poisons the logs during ordinary local startup

### 3. Optional Breaking-News Upstreams Timeout

Environment:

- BFF started on `http://127.0.0.1:8801`
- `BREAKING_NEWS_WARN_COOLDOWN_MS=60000`

Artifact:

- `.tmp_codex/bff-news-verify-after/bff.out.log`
- `.tmp_codex/bff-news-verify-after/bff.err.log`

Verified behavior:

- two consecutive `GET /news/breaking?fresh=true&max=5` calls returned `200`
- `0` `[breakingNews] ... error` log lines
- only two warnings remained:
  - Yahoo Finance RSS timed out
  - GDELT timed out

What this proves:

- optional upstream-source timeouts do not fail the route
- repeated requests do not keep re-emitting the same hard errors inside the cooldown window
- the news route still returns a controlled success payload while partial sources are unavailable

---

## Verification Commands

- `node --test bff/tests/*.test.mjs` -> `18 passed`
- local Redis-absent verification via `.tmp_codex/bff-no-redis-verify`
- local news-timeout verification via `.tmp_codex/bff-news-verify-after`
- local ML-down verification via `.tmp_codex/bff-ml-down-verify-after`

---

## Residual Gaps

This does not close R11 yet. Still missing:

1. Frontend-visible failure-state verification
   - explicit UI messaging under ML outage
   - explicit UI messaging under auth/backend outage
   - state recovery after dependency returns

2. Firebase/auth dependency-loss proof
   - login/session refresh when identity backend is unavailable
   - forced-expiry and stale-token recovery

3. Analysis-service failure proof
   - degraded behavior when the analysis transport is slow or absent

4. Redis-present and restart proof
   - Redis recovery after being restored
   - state behavior across a real Redis outage and return

5. Docker-orchestrated failure injection
   - still partially blocked by the host Docker Desktop / WSL issue tracked in `R01`

---

## Interim Verdict

The local stack now degrades much more honestly and cleanly under core dependency loss:

- ML-down paths return controlled fallback responses
- Redis-absent local runs stop flooding logs
- optional upstream news failures stay non-fatal and deduped

That is real progress toward R11, but the broader end-user failure matrix and recovery proofs still need explicit coverage.
