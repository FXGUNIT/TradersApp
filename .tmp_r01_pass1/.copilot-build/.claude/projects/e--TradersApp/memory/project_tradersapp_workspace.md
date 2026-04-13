---
name: TradersApp workspace setup
description: TradersApp lives on E: drive; C: only has frontend now. All code work is in E:\TradersApp.
type: project
---

**Workspace locations:**
- E:\TradersApp\ — primary workspace (git repo, full ml-engine, bff, k8s, frontend, tests). This is where all code lives.
- C:\Users\Asus\Desktop\TradersApp\ — remnant of old location after user cut-pasted to E: drive. Only contains the frontend (src/, node_modules, dist/, public/, vite.config.js, package.json). No Python code.

**Why this matters:** Claude Code CWD may reset to C:\Users\Asus\Desktop\TradersApp on session start. Must `cd /e/TradersApp` before touching any Python/k8s code.

**What E:\TradersApp contains (verified 2026-04-07):**
- ml-engine/data/candle_db.py — dual-backend SQLite/PostgreSQL
- ml-engine/infrastructure/performance.py — pure Redis + _global_pools
- ml-engine/infrastructure/request_context.py — RequestIdMiddleware
- ml-engine/config.py — MLFLOW_USE_REGISTRY, MODEL_STORE_PVC_MOUNT
- ml-engine/training/model_store.py — MLflow registry integration
- ml-engine/inference/predictor.py — hot-reload support
- ml-engine/main.py — close_pools() in lifespan, RequestIdMiddleware registered
- k8s/ml-deployment.yaml — model-sync init container, PVC mount
- k8s/helm/tradersapp/templates/ml-engine.yaml — helm init container
- ml-engine/Dockerfile — MODEL_STORE_PVC_MOUNT env var
- All test files updated for pure Redis behavior
