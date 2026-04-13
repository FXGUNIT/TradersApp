# TradersApp â€” Local Dev Quickstart

This guide covers the fastest way to run the full stack locally with minimal setup.

## Option A (Recommended): Docker Dev Stack

**Prereqs:** Docker Desktop running with its Linux engine ready, plus Node.js 18+ with npm available on the host.

Why Node/npm are still required on the Docker path:
- `scripts/dev-up.ps1` builds the frontend bundle on the host before Docker starts nginx.
- On a fresh workspace, `scripts/dev-up.ps1` now auto-runs `npm install` if `node_modules` is missing.
- If Node/npm is not installed at all, the script stops immediately with a clear prerequisite error instead of failing later during `vite build`.

Start the core stack (frontend + BFF + ML Engine + Redis):
```powershell
.\scripts\dev-up.ps1
```

`dev-up.ps1` now builds the frontend bundle on the host first, rebuilds the
service images, and then serves `dist/` through the lightweight nginx container.
That keeps frontend bring-up independent of npm registry access inside Docker
while still ensuring backend code changes are picked up on a normal restart.
On a truly fresh clone, the first run may take longer because it will install
frontend dependencies before building `dist/`.

If `dev-up.ps1` stops with a Docker or WSL readiness error, fix the host first:
- Start or restart Docker Desktop and wait until the Linux engine is fully up.
- If the message mentions `LxssManager`, the Windows WSL service is stopped and Docker cannot start Linux containers until that host issue is resolved.
- Rerun `.\scripts\dev-up.ps1` only after the Docker engine is available again.

Optional tiers:
```powershell
.\scripts\dev-up.ps1 -Tier mlops   # adds MLflow
.\scripts\dev-up.ps1 -Tier full    # adds Prometheus/Grafana/Loki/Jaeger
```

Stop/reset:
```powershell
.\scripts\dev-up.ps1 -Down
.\scripts\dev-up.ps1 -Reset
```

Endpoints:
- Frontend: `http://localhost`
- BFF: `http://localhost:8788/health`
- ML Engine: `http://localhost:8001/health`

Quick health check:
```powershell
.\scripts\dev-smoke.ps1
```

## Option B: Local Processes (No Docker)

**Prereqs:** Node 18+ and Python 3.11+.

Frontend:
```powershell
npm install
npm run dev
```

BFF:
```powershell
cd bff
npm install
npm run dev
```

ML Engine:
```powershell
python -m venv ml-engine\.venv
ml-engine\.venv\Scripts\activate
pip install -r ml-engine\requirements.txt
python ml-engine\main.py
```

## Environment Vars

Local defaults load from `.env.local`. If starting fresh, copy `.env.example` â†’ `.env.local`
and fill in the keys you need.
