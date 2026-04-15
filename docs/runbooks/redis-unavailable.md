# Runbook: Redis Unavailable

**Severity:** P2 — session store degraded, rate limiting fails open, ML Engine cache misses
**Detection:** `docker exec traders-redis redis-cli ping` fails, circuit breaker OPEN

---

## Step 1: Verify Redis

```bash
# Ping
docker exec traders-redis redis-cli ping
# Expected: PONG
# Failure: "Could not connect to Redis"

# Check Redis logs
docker logs traders-redis --tail 50
```

---

## Step 2: Fix Redis

### Redis OOM (eviction causing data loss)
```bash
# Check memory
docker exec traders-redis redis-cli info memory | grep used_memory_human

# Increase memory
# In docker-compose.yml:
#   command: redis-server --save 60 1 --maxmemory 512mb --maxmemory-policy allkeys-lru
docker compose -f docker-compose.yml up -d redis
```

### Redis crash / restart loop
```bash
docker restart traders-redis
sleep 2
docker exec traders-redis redis-cli ping
```

### Redis volume corrupted
```bash
# Stop Redis
docker compose -f docker-compose.yml stop redis

# Backup corrupted data
cp -r ./redis-data ./redis-data-backup-$(date +%Y%m%d%H%M%S)

# Clear Redis data (sessions will expire, users re-authenticate)
rm -rf ./redis-data/*
docker compose -f docker-compose.yml up -d redis

# Verify
docker exec traders-redis redis-cli ping
```

---

## Step 3: Verify downstream recovery

```bash
# ML Engine should reconnect automatically
sleep 5
curl -sf http://localhost:8001/health | python3 -c "import json,sys; d=json.load(sys.stdin); print('DB:', d.get('db','unknown'))"

# BFF should reconnect
curl -sf http://localhost:8788/ready
```

---

## Step 4: Data recovery

Redis is ephemeral by design (sessions expire via TTL). No persistent data is stored only in Redis.

If long-term session recovery is needed:
- Sessions stored in `bff/data/identity-domain.json` (admin sessions)
- ML idempotency keys: lost sessions will be treated as new (safe — idempotent operations)

---

## Step 5: Post-incident

- [ ] Check Prometheus: `curl http://localhost:9090/api/v1/query?query=redis_up`
- [ ] If OOM: add Redis memory limit to docker-compose.yml
- [ ] Document root cause in GitHub issue
