# `traders.app` Reference Audit

**Last updated:** 2026-04-22

This audit exists to separate real production blockers from harmless legacy text
while the corrected nested-domain `is-a.dev` path is being prepared.

## Active Production Path

These references are part of the live Contabo path or the next planned domain
cutover. The next cutover branch will target the corrected host family:

- `traders.tradergunit.is-a.dev`
- `bff.traders.tradergunit.is-a.dev`
- `api.traders.tradergunit.is-a.dev`

Variable-driven surfaces still require the GitHub repo vars to be updated
during cutover.

- `deploy/contabo/runtime.env.example`
- `deploy/contabo/Dockerfile.frontend`
- `Dockerfile.frontend`
- `Dockerfile.frontend.contabo`
- `runtime.env.contabo.example`
- `scripts/contabo/build-runtime-env.sh`
- `scripts/contabo/verify_public_deploy.py`
- `tests/load/k6/contabo-public-edge.js`
- `vite.config.js`
- `vercel.json`
- `scripts/windows/build-desktop-web.mjs`
- `.github/workflows/windows-release.yml`
- `.github/workflows/deploy-contabo.yml`
- `.github/workflows/verify-contabo-public.yml`
- `desktop/windows/installer/TradersApp.Package/Package.wxs`
- `desktop/windows/installer/TradersApp.Bundle/Bundle.wxs`
- `docs/DEPLOYMENT.md`

## Variable-Driven Production Surfaces

These files stay on `main` but already honor repo variables or GitHub Releases
fallbacks, so they do not need additional code edits for the domain cutover if
the cutover checklist is followed.

- `.github/workflows/windows-release.yml`
- `desktop/windows/TradersApp.Desktop/Services/DesktopHostOptions.cs`
- `docs/windows/WINDOWS_DESKTOP_RELEASE.md`

## Legacy Docs And Archived Paths

These references are historical, fallback-only, or non-active provider notes.
They do not block the current Contabo launch.

- `deploy/ovh/runtime.env.example`
- `deploy/ovh/Dockerfile.frontend`
- `scripts/ovh/build-runtime-env.sh`
- `scripts/stage_p_validate_observability.sh`
- `scripts/stage_p_public_probe.py`
- `scripts/setup-production.ps1`
- `scripts/setup-infisical.ps1`
- `scripts/k8s/bootstrap-oci-edge.sh`
- `wrangler.toml.example`
- `docs/TODO_MASTER_LIST.md`
- `docs/P26_Contabo_Deployment_Plan.md`

## Sample, Test, And Demo Strings

These references are test identities or fixture content. They are not public
deployment blockers and can stay unchanged unless branding cleanup is wanted.

- `AI_RELIABILITY_TEST_SUITE_SUMMARY.md`
- `CONTEXT_WINDOW_TEST_REPORT.md`
- `contextWindowStressTest.js`
- `contextWindowTestRunner.js`
- `tests/e2e/playwright/idor-guard.spec.js`
- `src/services/supportChatService.js`

## Generated Build Artifacts

These files contain baked frontend URLs from the last desktop web build. Do not
edit them directly. They will refresh on the next desktop web build or Windows
release after the cutover branch is merged.

- `desktop/windows/TradersApp.Desktop/webapp/assets/base-*.js`
- `desktop/windows/TradersApp.Desktop/webapp/assets/CollectiveConsciousness-*.js`
- `desktop/windows/TradersApp.Desktop/webapp/assets/MainTerminal-*.js`
- `desktop/windows/TradersApp.Desktop/webapp/assets/SupportChatModal-*.js`

## Already Resolved

- Windows desktop app updates no longer depend on `downloads.traders.app`.
- The built-in desktop appcast fallback is GitHub Releases:
  - `https://github.com/FXGUNIT/TradersApp/releases/latest/download/appcast.xml`
- Off-box fallback verification against `sslip.io` was re-captured
  successfully in GitHub Actions run `24775819624`, and the summary markdown
  now reflects the real `k6` envelope values after the parser fix on `main`.
- The developer-root landing page now exists on `main` so the root `is-a.dev`
  resubmission can point to a dev-facing preview instead of the product root.
- The first root request `#36802` is no longer a blocker to monitor; it was
  closed and must be replaced with the corrected resubmission path.

## Execution Order After Approval

1. Merge the corrected root request for `tradergunit.is-a.dev`.
2. Open and merge the nested `traders`, `bff.traders`, and `api.traders`
   `is-a.dev` requests.
3. Merge or cherry-pick the nested-domain cutover prep branch.
4. Update GitHub repo variables to the `traders.tradergunit.is-a.dev` host
   family.
5. Run `Deploy to Contabo VPS`.
6. Run `Verify Contabo Public Deploy` against the nested host family.
7. Rebuild the desktop web bundle before the next Windows release so generated
   assets pick up the new BFF host.
