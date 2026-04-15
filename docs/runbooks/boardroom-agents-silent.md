# Runbook: Board Room Agents Silent

**Severity:** P2 — cron not processing threads, agents not reporting heartbeat
**Detection:** No agent heartbeat logs, threads not auto-closed

---

## Step 1: Check agent heartbeat

```bash
# Call heartbeat endpoint directly
curl -sf -X POST http://localhost:8788/board-room/heartbeat \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "NewsService", "status": "active", "focus": "health check"}'
```

---

## Step 2: Check Board Room cron status

```bash
# Manual cron trigger
curl -sf -X POST http://localhost:8788/board-room/cron \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Check Redis for thread state
docker exec traders-redis redis-cli KEYS "board-room:*" | head -10
```

---

## Step 3: Restart Board Room cron

```bash
# Restart the cron process
docker compose -f docker-compose.yml restart board-room-cron

# Or manually trigger via Railway:
railway run --service board-room-cron node bff/board-room/cron/boardRoomCron.mjs
```

---

## Step 4: Check AI providers

If agents are failing to generate reports:
```bash
curl -sf http://localhost:8788/ai/status | python3 -m json.tool
# Check that at least one provider shows configured: true
```

---

## Step 5: Post-incident

- [ ] Check cron logs for errors
- [ ] If AI provider failure: see ai/status, update Infisical secrets
- [ ] Document root cause in GitHub issue
