# R01 Fresh-Clone Repro Log

Status: in progress
Last updated: 2026-04-14

## Goal

Prove the documented local bootstrap path works from a genuinely clean environment twice, without hidden machine state or manual fixes.

## Baseline Environment

- Workspace root: `E:\TradersApp`
- Disposable sibling workspace used for the first valid pass: `E:\TradersApp-R01-Pass1`
- OS: Windows host

Tool versions are being captured during the active rerun because Docker/WSL is currently blocked on the host.

## What Was Learned

### Invalid first attempt

The first disposable copy was created inside the repo tree. That allowed the nested workspace to inherit parent state such as existing dependencies, so it was rejected as proof.

### Real reproducibility gap found and fixed

The documented Docker path in `docs/LOCAL_DEV.md` previously implied Docker alone was enough. In reality, `scripts/dev-up.ps1` built the frontend on the host, which meant Node.js and npm were also required.

Fix landed:

- `scripts/dev-up.ps1` now auto-runs `npm install` on a fresh workspace when `node_modules` is missing.
- `docs/LOCAL_DEV.md` now states that Node.js 18+ with npm is required on the host for the Docker bootstrap path.

### First valid sibling-workspace pass

The first valid disposable environment was moved to a sibling path outside the repo root:

- `E:\TradersApp-R01-Pass1`

Observed results from that sibling workspace:

- frontend dependencies installed successfully
- `npm run build` completed successfully
- `dist/index.html` was produced

This proves the host-side frontend bootstrap works in a clean sibling workspace when the documented prerequisites are present.

### Remaining blocker during isolated stack startup

The initial sibling `dev-up.ps1` run overlapped with an already-running main stack, so it was not a clean isolation proof for service startup.

During the follow-up retry, the host Docker/WSL layer degraded:

- Docker CLI calls stopped responding normally
- the Docker Linux engine pipe was missing
- `LxssManager` was found stopped on the host
- starting `LxssManager` from this session was not permitted

That means the current blocker is host-level, not repo-level.

## Additional Hardening Landed During R01

- `scripts/dev-up.ps1` now fails fast with a clear message when Docker Desktop or the WSL-backed Linux engine is unavailable.
- `.gitignore` was expanded and generated artifacts were staged for removal so they do not pollute fresh-clone proof or Docker build contexts.

## Remaining Work To Complete R01

1. Recover the host WSL/Docker engine so `docker compose` is functional again.
2. Stop the main stack before rerunning the sibling workspace bootstrap.
3. Run `.\scripts\dev-up.ps1` in `E:\TradersApp-R01-Pass1`.
4. Run `.\scripts\dev-smoke.ps1` against that isolated pass.
5. Capture Node, npm, Python, Docker, and OS versions for the proof artifact.
6. Repeat the same process in a second disposable workspace.

## Current Conclusion

Fresh-workspace host bootstrap is partly proven: dependency install and frontend build succeed from a clean sibling workspace using documented steps. Full R01 completion is currently blocked by the host WSL/Docker layer, not by a remaining repo bootstrap defect.
