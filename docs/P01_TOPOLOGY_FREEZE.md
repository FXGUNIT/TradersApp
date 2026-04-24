# P01 Topology Freeze

**Date:** 2026-04-15 IST  
**Status:** Archived (superseded Stage P baseline)

> This file is historical only. We do not own or pay for `traders.app`, and the active production path is now `https://tradergunit.pages.dev` plus the free `sslip.io` Contabo hosts. Do not use the Vercel/Railway `traders.app` topology below unless a future paid-domain plan is explicitly reopened.

## Decision

Freeze Stage P production topology to **Option A: Vercel + Railway + Infisical + GitHub Actions**.

- Frontend runtime: Vercel (`https://traders.app`)
- BFF runtime: Railway (`https://bff.traders.app`)
- ML Engine runtime: Railway (`https://api.traders.app`)
- Secrets source: Infisical (`.github/workflows/infisical-sync.yml`)
- Deploy orchestration: GitHub Actions (`.github/workflows/ci.yml`)
- Uptime checks and alert fan-out: GitHub Actions monitor workflow (`.github/workflows/monitor.yml`)

## Why This Topology

- It is already the active deployment contract in the repo workflows.
- Stage P can be closed fastest with minimum architecture churn.
- Rollback paths already exist in workflow and provider tooling.

## Owner Of Record

- Primary owner: `FXGUNIT` (inferred from `origin` remote: `https://github.com/FXGUNIT/TradersApp.git`)
- Backup owner: `@default-owner` (current CODEOWNERS fallback until a named backup owner is set)

## Rollback Target

- Frontend rollback target: previous known-good Vercel deployment.
- Backend rollback target: previous known-good Railway deployment for `bff` and `ml-engine`.
- Emergency repo-level rollback workflow: `.github/workflows/rollback.yml`.

## Evidence

- `.github/workflows/ci.yml` defines `deploy-production` with Railway + Vercel production steps.
- `.github/workflows/infisical-sync.yml` defines Infisical -> Railway/Vercel secret propagation.
- `.github/workflows/monitor.yml` defines 5-minute public health checks and alert hooks.
