# Windows P23 Reference-Machine Runbook

`P23` is not complete until the desktop shell is proven on real Windows reference hardware. This runbook is the operator path for consistent evidence capture on:

- Windows 10 x64 `4 GB RAM`
- Windows 11 x64 `4 GB RAM`
- no discrete GPU

Use this runbook together with:

- `scripts/windows/run-p23-reference-certification.ps1`
- `scripts/windows/certify-desktop-performance.ps1`
- [WINDOWS_DESKTOP_PERFORMANCE_CERTIFICATION.md](/e:/TradersApp/docs/windows/WINDOWS_DESKTOP_PERFORMANCE_CERTIFICATION.md)

## Pass Criteria

Each reference machine needs one evidence bundle that shows all of the following:

- shell window ready within `<= 8s`
- visible login route confirmed by the operator within the startup budget
- idle working set within `<= 500 MB`
- no local `BFF`, `ML`, `Redis`, or other sidecar child processes
- degraded-network flow handled without shell crash
- forced logout or minimum-version enforcement returns the shell to login
- final signed release payload rerun also passes

If any of those fail, treat `P23` as blocked.

## Before You Start

Prepare these inputs before touching the reference machine:

1. A desktop build or signed installer that matches the release candidate you want to certify.
2. Access to a normal test user account for desktop sign-in.
3. Access to the existing admin control path that can force a logout, block a session, or enforce minimum desktop version.
4. Permission to disable and re-enable the active network adapter on the machine.
5. AC power connected. Do not run the cold-start timing on battery saver.

Recommended machine prep:

1. Reboot the machine.
2. Let Windows finish startup noise for at least `2-3 minutes`.
3. Close browsers, Teams, Windows Update dialogs, and anything else likely to distort RAM or launch timing.
4. Confirm Task Manager does not show another `TradersApp.Desktop.exe` still running.

## Standard Command

Run the wrapper from the repo root. It creates a dedicated run directory, captures the machine profile, starts a transcript, and then calls the existing certification harness.

Local release build example:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run-p23-reference-certification.ps1 `
  -ReferenceMachineLabel "win11-4gb-ref-01" `
  -DesktopExePath .\desktop\windows\TradersApp.Desktop\bin\Release\net8.0-windows\TradersApp.Desktop.exe
```

Installed signed payload example:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run-p23-reference-certification.ps1 `
  -ReferenceMachineLabel "win10-4gb-ref-01" `
  -DesktopExePath "C:\Program Files\TradersApp\TradersApp.Desktop.exe"
```

Default output root:

- `.artifacts/windows/p23/`

Per-run output directory:

- `.artifacts/windows/p23/<timestamp>-<reference-machine-label>/`

Each run directory contains:

- `reference-machine-profile.json`
- `reference-machine-profile.md`
- `manual-check-template.md`
- `p23-reference-run.log`
- `desktop-p23-certification-*.json`
- `desktop-p23-certification-*.md`

## What The Harness Automates

The PowerShell harness automatically captures:

- shell-window-ready timing
- idle working set and private memory
- child-process tree and forbidden sidecar process matches
- OCR lazy-load proof
- absence of GPU runtime payload files
- absence of obvious sidecar payload files
- presence of degraded-network source hooks
- presence of forced-logout / minimum-version policy hooks

Important accuracy note:

- The automated timing proves when the desktop shell exposes its main window.
- The operator still needs to look at the screen and confirm the visible login route is actually ready inside the budget.

## Operator Flow

Run these steps on each reference machine in order.

### 1. Cold Start And Idle RAM

1. Fully close TradersApp if it is already running.
2. Wait `10 seconds` so the previous process tree is gone.
3. Run `run-p23-reference-certification.ps1`.
4. Watch the shell launch.
5. Confirm the login route is visually ready and usable.
6. Let the script finish its idle memory sample.
7. Open the generated Markdown artifact and record whether the visible login route met the `<= 8s` target.

Expected outcome:

- `Shell window ready seconds` is `<= 8`
- `Idle working set MB` is `<= 500`
- `No local sidecar processes launched` is `PASS`

### 2. Degraded-Network Proof

Use the machine profile artifact to identify the active adapter before disconnecting it.

Recommended operator sequence:

1. Sign in to the desktop app with the normal test user.
2. Reach a stable authenticated screen.
3. Disable the active adapter for `45-60 seconds`.
4. Confirm the shell stays open.
5. Confirm the app shows the offline/degraded-network state.
6. Re-enable the same adapter.
7. Confirm reconnect feedback appears and the app resumes traffic.

Practical ways to disable the adapter:

- Windows Settings or Control Panel
- Taskbar Wi-Fi off/on
- `Disable-NetAdapter -Name "<adapter-name>" -Confirm:$false`
- `Enable-NetAdapter -Name "<adapter-name>" -Confirm:$false`

Record in the rerun:

- how long the adapter stayed offline
- whether the offline message appeared
- whether the reconnect message appeared
- whether the shell recovered without restart

### 3. Forced Logout / Minimum-Version Proof

Do not invent a fake control path. Use the real existing admin or policy mechanism already used by the app.

Recommended operator sequence:

1. Start from an authenticated desktop session.
2. Trigger one real server-side policy action:
   - force logout
   - blocked session
   - maintenance mode
   - minimum desktop version enforcement
3. Wait for the next policy poll or make one protected action in the app.
4. Confirm the shell route collapses back to login.
5. Confirm the user cannot continue operating on the protected route.

Record in the rerun:

- what trigger was used
- how long it took to take effect
- whether the route returned to login cleanly

### 4. Signed Release Payload Rerun

The local developer build is not enough for final sign-off.

After the signed release is packaged:

1. Install the signed payload on each reference machine.
2. Re-run the wrapper with the installed `TradersApp.Desktop.exe` path.
3. Record `SignedReleaseStatus` as `pass` or `fail`.
4. Keep the signed-payload evidence bundle with the release artifacts.

## How To Record Manual Outcomes

The easiest path is to rerun the wrapper once you know the manual results.

Example:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run-p23-reference-certification.ps1 `
  -ReferenceMachineLabel "win11-4gb-ref-01" `
  -DesktopExePath "C:\Program Files\TradersApp\TradersApp.Desktop.exe" `
  -VisibleLoginStatus pass `
  -VisibleLoginNotes "Login visible and usable at 6.8s after cold launch." `
  -DegradedNetworkStatus pass `
  -DegradedNetworkNotes "Disabled Wi-Fi for 50s; offline then reconnect messaging observed; shell stayed open." `
  -ForcedLogoutStatus pass `
  -ForcedLogoutNotes "Admin block forced the route back to login on the next policy poll." `
  -SignedReleaseStatus pass `
  -SignedReleaseNotes "Installed signed MSI payload from release candidate RC-01."
```

Use `fail` plus a concrete note if any gate misses.

## Evidence Review

Before filing `P23` as complete, verify each reference-machine directory contains:

1. one machine profile file pair
2. one transcript log
3. one certification JSON
4. one certification Markdown summary
5. manual status fields populated for:
   - visible login
   - degraded network
   - forced logout
   - signed release payload

Minimum release bundle expectation:

- one Windows 10 `4 GB` directory
- one Windows 11 `4 GB` directory
- signed-payload rerun evidence retained for both

## Common Failure Cases

- Shell-ready timing passes, but the login route is still visually loading. That is not a pass.
- Idle RAM is measured on a noisy machine with browsers and Windows update activity still running. Reboot and retest.
- Operator disables the wrong adapter and thinks degraded-network never triggered. Use `reference-machine-profile.md`.
- Forced logout is only simulated locally instead of using the real server-side control path.
- Only the local build is tested, but the signed installed payload is never rerun.
