# R01 Fresh-Clone Repro Log

Status: blocked on host Docker Desktop / WSL repair
Last updated: 2026-04-14

## Goal

Prove the documented local bootstrap path works from a genuinely clean environment twice, without hidden machine state, nested dependency inheritance, or manual repo surgery.

## Baseline Environment

- Workspace root: `E:\TradersApp`
- Disposable sibling workspace pass 1: `E:\TradersApp-R01-Pass1`
- Disposable sibling workspace pass 2: `E:\TradersApp-R01-Pass2`
- OS: `Microsoft Windows NT 10.0.19045.0`
- Node.js: `v24.14.0`
- npm: `11.9.0`
- Python: `3.14.3`
- Docker client binary version: `29.3.1`
- WSL version: `2.6.3.0`

## What Was Verified

### Invalid nested pass was rejected

The first disposable copy created inside the repo tree was rejected as proof because Node tooling could still inherit parent workspace state such as `node_modules`.

### Repo-side bootstrap fixes already landed

The clean-workspace investigation found and fixed two real bootstrap issues in the repo:

- `docs/LOCAL_DEV.md` now states that the Docker dev path still requires host `Node.js 18+` and `npm`.
- `scripts/dev-up.ps1` auto-runs `npm install` when the frontend workspace is fresh and `node_modules` is missing.
- `scripts/dev-up.ps1` now resolves `docker.exe` from the standard Docker Desktop install path even when Docker is not on `PATH`.
- `scripts/dev-up.ps1` now fails fast with explicit WSL / Docker engine errors instead of hanging or failing later in `docker compose`.

### Clean sibling pass 1

Disposable workspace:

- `E:\TradersApp-R01-Pass1`

Verified earlier in this stage:

- frontend dependencies installed successfully in the sibling workspace
- `npm run build` succeeded
- `dist/index.html` was produced

Re-verified in the current hardened state:

- `.\scripts\dev-up.ps1` now fails immediately with the real host blocker instead of a misleading PATH error

Observed result:

- `Docker Desktop's Linux engine is unavailable because WSL is not running (LxssManager is stopped).`

### Clean sibling pass 2

Disposable workspace:

- `E:\TradersApp-R01-Pass2`

Verified in the current run:

- `npm install` succeeded from a clean sibling workspace
- `npm run build` succeeded immediately afterward
- `dist/index.html` was produced in the disposable workspace

Observed side note:

- root `npm install` reported `4 vulnerabilities (1 moderate, 3 high)` in dependencies
- this does not block repro proof, but it is still real dependency hygiene debt

## Remaining Host-Level Blocker

The repo-side bootstrap path is no longer the primary blocker. The remaining failure is the host Docker Desktop / WSL installation.

Observed diagnostics:

- `docker.exe` exists at `C:\Program Files\Docker\Docker\resources\bin\docker.exe`
- the Docker Linux engine pipe is missing: `\\.\pipe\dockerDesktopLinuxEngine`
- `wsl.exe -l -v` shows `docker-desktop` in state `Uninstalling`
- Docker Desktop logs report: missing registry key `SOFTWARE\Docker Inc.\Docker Desktop`
- starting `LxssManager` directly from this session fails

Practical meaning:

- the repo can now find Docker correctly
- the host cannot actually provide a working Linux container engine
- `docker compose` startup and container health validation are blocked outside the repo

## Current Verified Failure Mode

Both the main workspace and the sibling workspace now fail with the same accurate reason:

- `.\scripts\dev-up.ps1` -> `Docker Desktop's Linux engine is unavailable because WSL is not running (LxssManager is stopped).`

That is a better failure mode than the earlier misleading `docker was not found` preflight.

## Remaining Work To Complete R01

1. Repair the host Docker Desktop / WSL installation so the `docker-desktop` distro is healthy again.
2. Rerun `.\scripts\dev-up.ps1` in an isolated sibling workspace.
3. Run `.\scripts\dev-smoke.ps1` against that isolated stack.
4. Capture the Docker server version once the engine is healthy.
5. Repeat the full stack bootstrap in a second isolated sibling workspace.

## Current Conclusion

`R01` is materially advanced but not complete.

What is proven:

- the documented host prerequisites are now explicit
- the frontend dependency install + production build path succeeds in two disposable sibling workspaces
- `dev-up.ps1` now handles fresh frontend workspaces automatically
- `dev-up.ps1` now reports the real host Docker/WSL outage instead of failing on PATH assumptions

What is still not proven:

- isolated `docker compose` startup from a clean sibling workspace
- sibling-workspace smoke validation with the full stack up
- a second full clean-stack pass

The remaining blocker is host Docker Desktop / WSL health, not an unresolved repo bootstrap defect.
