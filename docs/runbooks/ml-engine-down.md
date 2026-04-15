# Runbook: ML Engine Down

**Severity:** P1 — consensus signals unavailable
**Detection:** Prometheus alert, k6 SLO breach, user report
**SLA:** Restore within 30 minutes

---

## Step 1: Verify the outage

```bash
# Check ML Engine health
curl -sf http://localhost:8001/health | python3 -m json.tool

# Expected: {"ok": true, ...}
# Failure: non-200 or connection refused

# Check ML Engine logs
docker logs traders-ml-engine --tail 50

# Check readiness probe
curl -sf http://localhost:8001/ready
```

---

## Step 2: Check dependencies

```bash
# Redis must be healthy for ML Engine to start
docker exec traders-redis redis-cli ping
# Expected: PONG

# Check Kafka
docker exec traders-kafka kafka-broker-api-versions --bootstrap-server localhost:9092
# Expected: broker version list (may timeout on health check — normal)
```

---

## Step 3: Common fixes

### ML Engine OOM (Out of Memory)
```bash
# Check memory usage
docker stats traders-ml-engine --no-stream

# Restart with memory limit
docker stop traders-ml-engine
docker rm traders-ml-engine
# Edit docker-compose.yml: add --memory=2g to ml-engine service
docker compose -f docker-compose.yml up -d ml-engine
```

### Model files corrupted
```bash
# Check model directory
ls -la ml-engine/data/models/

# Verify model store integrity
docker exec traders-ml-engine python -c "from ml_engine.infrastructure.model_store import ModelStore; print('OK')"

# If corrupted: rollback to previous version
# See: docs/runbooks/model-rollback.md
```

### Port conflict (8001 already in use)
```bash
lsof -i :8001
# Kill conflicting process
```

---

## Step 4: Graceful restart

```bash
# Graceful (drain in-flight requests)
docker exec traders-ml-engine python -c "import signal; signal.raise_signal(signal.SIGTERM)"

# If unresponsive: force restart
docker restart traders-ml-engine

# Verify recovery
sleep 5 && curl -sf http://localhost:8001/health
```

---

## Step 5: Confirm BFF fallback

While ML Engine is down, BFF should return degraded but not crash:
```bash
curl -sf http://localhost:8788/ml/consensus
# Expected: 200 with fallback payload (not 500)
# Check "degraded" or "ml_engine_unavailable" in response
```

---

## Step 6: Post-incident

- [ ] File bug in GitHub Issues with `ml-engine` label
- [ ] If OOM: increase memory limit in docker-compose.yml
- [ ] Check Prometheus metrics: `curl http://localhost:9090/api/v1/query?query=bff_ml_engine_errors_total`
- [ ] Update this runbook if new root cause found
