# Public Host Reference Audit

**Last updated:** 2026-04-23

## Canonical Contract

- Canonical public frontend: `https://tradergunit.pages.dev/`
- Current Contabo runtime proof hosts:
  - `https://173.249.18.14.sslip.io`
  - `https://bff.173.249.18.14.sslip.io/health`
  - `https://api.173.249.18.14.sslip.io/health`
- `is-a.dev` is retired for the active path.
- `traders.app` is legacy/archive-only inside this repo unless a future
  migration plan explicitly reopens it.

## Active Files That Must Match The Canonical Contract

- `src/App.jsx`
- `src/config/proofHosts.js`
- `src/features/landing/DeveloperRootLanding.jsx`
- `deploy/contabo/runtime.env.example`
- `deploy/contabo/Dockerfile.frontend`
- `scripts/contabo/build-runtime-env.sh`
- `scripts/pages/verify_pages_root_runtime.py`
- `scripts/contabo/verify_public_deploy.py`
- `scripts/windows/build-desktop-web.mjs`
- `.github/workflows/deploy-pages-root.yml`
- `.github/workflows/verify-pages-root.yml`
- `.github/workflows/deploy-contabo.yml`
- `.github/workflows/verify-contabo-public.yml`
- `docs/P26_Contabo_Deployment_Plan.md`
- `docs/DEPLOYMENT.md`
- `docs/TODO_MASTER_LIST.md`
- `README.md`

## How To Read Old Hostnames

- `tradergunit.pages.dev`
  This is the real public frontend and should be treated as the default answer.
- `173.249.18.14.sslip.io`
  This is the current Contabo runtime-edge proof host family. It is still real,
  but it is not the canonical public frontend.
- `tradergunit.is-a.dev`
  Obsolete plan. Do not treat it as pending work.
- `traders.app`
  Historical or archived reference unless a document explicitly says otherwise.

## Legacy Surfaces Left In Place On Purpose

These are retained for archive or rollback context and should not be used to
redefine the live hostname contract:

- `docs/STAGE_P_DNS_SETUP.md`
- `docs/STAGE_P_MASTER_DASHBOARD.md`
- `docs/STAGE_P_24X7_EXECUTION_CHECKLIST.md`
- `docs/STAGE_P_PRODUCTION_ACTIVATION_PROOF.md`
- `docs/STAGE_P_OBSERVABILITY_VALIDATION.md`
- `docs/GO_LIVE_CERTIFICATE.md`
- `scripts/stage_p_public_probe.py`
- `scripts/contabo/update-cloudflare-dns.sh`

## Generated Assets

Built desktop assets may still contain older baked hosts until the next desktop
web build. Do not edit generated bundles directly.
