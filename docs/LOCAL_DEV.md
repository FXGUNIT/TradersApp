# TradersApp â€” Local Dev Quickstart

This guide covers the fastest way to run the full stack locally with minimal setup.

## Option A (Recommended): Docker Dev Stack

**Prereqs:** Docker Desktop running.

Start the core stack (frontend + BFF + ML Engine + Redis):
```powershell
.\scripts\dev-up.ps1
```

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
