# Windows Desktop Performance Certification

`P23` is the hardware-compatibility gate for the Windows thin client. The repo now provides an evidence harness, but the final sign-off still requires real runs on Windows 10 x64 and Windows 11 x64 reference machines with `4 GB RAM` and no discrete GPU.

Use [WINDOWS_P23_REFERENCE_MACHINE_RUNBOOK.md](/e:/TradersApp/docs/windows/WINDOWS_P23_REFERENCE_MACHINE_RUNBOOK.md) for the operator sequence. This document is the harness and evidence overview.

## Scope

This certification covers:

- cold start budget to the visible login route
- idle RAM after the shell and packaged web UI settle
- OCR lazy-loading and absence of GPU-specific payload
- degraded-network and reconnect behavior
- forced logout / minimum-version policy exit behavior
- proof that the desktop shell does not spawn local `BFF`, `ML`, or other sidecar services

## Evidence Harness

Run the wrapper from the repo root on each reference machine:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run-p23-reference-certification.ps1 `
  -ReferenceMachineLabel "win11-4gb-ref-01" `
  -DesktopExePath .\desktop\windows\TradersApp.Desktop\bin\Release\net8.0-windows\TradersApp.Desktop.exe
```

For an installed release payload, pass the installed executable path instead:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run-p23-reference-certification.ps1 `
  -ReferenceMachineLabel "win10-4gb-ref-01" `
  -DesktopExePath "C:\Program Files\TradersApp\TradersApp.Desktop.exe"
```

The wrapper creates a dedicated run directory below `.artifacts/windows/p23/` and writes:

- `reference-machine-profile.json`
- `reference-machine-profile.md`
- `manual-check-template.md`
- `p23-reference-run.log`

The underlying harness still emits:

- `desktop-p23-certification-*.json`
- `desktop-p23-certification-*.md`

The harness captures:

- shell window ready time
- working set and private memory after the idle settle period
- child-process tree for sidecar detection
- OCR lazy-load evidence from `src/features/terminal/terminalOcrService.js`
- built `ocr-*.js` chunk presence in the resolved desktop web bundle
- absence of known GPU runtime binaries in the release payload
- absence of obvious local sidecar payload files in the desktop release root
- source-level proof that degraded-network hooks still exist in `useConnectionStatusEffect.js`
- source-level proof that forced-logout and minimum-version enforcement still exist in `useDesktopClientPolicy.js`

Bundle resolution order:

1. explicit `-DesktopWebDir` override
2. packaged `webapp` beside the target desktop executable
3. repo build output at `dist/desktop-web`
4. repo fallback at `desktop/windows/TradersApp.Desktop/webapp`

You can also record manual gate outcomes directly into the evidence file:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run-p23-reference-certification.ps1 `
  -ReferenceMachineLabel "win11-4gb-ref-01" `
  -DesktopExePath "C:\Program Files\TradersApp\TradersApp.Desktop.exe" `
  -VisibleLoginStatus pass `
  -DegradedNetworkStatus pass `
  -DegradedNetworkNotes "NIC disabled for 45s; reconnect toast observed; session recovered." `
  -ForcedLogoutStatus fail `
  -ForcedLogoutNotes "Policy route did not collapse back to login within 60s." `
  -SignedReleaseStatus pass
```

## Certification Flow

1. Build the desktop web bundle with `npm run build:desktop:web`.
2. Build the desktop shell in `Release` or install the signed release payload.
3. Run `scripts/windows/run-p23-reference-certification.ps1` on a Windows 10 x64 4 GB machine.
4. Run the same wrapper on a Windows 11 x64 4 GB machine.
5. Capture manual degraded-network, forced-logout, and signed-payload outcomes in a follow-up rerun.
6. Store the entire run directories with the release evidence.
7. Only mark `P23` complete after both reference machines pass.

## Manual Checks Still Required

The script does not replace operator verification. Record these alongside the artifacts:

1. Cold start to visible login screen is `<= 8s` on both reference machines.
2. Degraded-network behavior shows the expected offline state, then reconnect recovery, without crashing the shell.
3. Forced logout, maintenance mode, and minimum desktop version enforcement all collapse the route back to login.
4. The same checks pass on the final signed release payload, not only on a local developer build.

The certification script now includes explicit `manualValidation` fields in both
JSON and Markdown output so those outcomes can be attached to the same evidence
bundle instead of being tracked separately.

The automated timing is for shell-window readiness. The visible login route still requires operator confirmation during the runbook.

## Network And Policy Validation

Use this manual sequence after the desktop shell launches successfully:

1. Sign in with a normal non-admin desktop account.
2. Disconnect network access or disable the NIC long enough to trigger the offline path.
3. Confirm the desktop session remains open, the UI shows degraded/offline feedback, and reconnect restores traffic when the network returns.
4. Trigger a forced logout through the admin path or minimum-version policy.
5. Confirm the desktop route exits back to login within the normal policy window or on the next protected call.

Relevant implementation points:

- `src/features/shell/useConnectionStatusEffect.js`
- `src/features/shell/useDesktopClientPolicy.js`
- `src/features/identity/authRoutingHandlers.js`

## Thin-Client Guardrails

The desktop shell must stay a UI host only:

- `desktop/windows/TradersApp.Desktop/MainWindow.xaml.cs` loads packaged assets into WebView2.
- `src/features/terminal/terminalOcrService.js` lazy-loads `tesseract.js` via `await import("tesseract.js")`.
- No local `BFF`, `ML`, `analysis-service`, or `redis` process should appear in the desktop child-process tree.

If the certification script reports a local sidecar payload or process-tree violation, treat that as a release blocker.
