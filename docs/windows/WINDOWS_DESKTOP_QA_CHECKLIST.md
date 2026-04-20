# Windows Desktop QA Checklist

## Install And Launch

- [ ] Clean Windows 10 x64 machine: install with `TradersApp.Desktop.Setup.exe`.
- [ ] Clean Windows 11 x64 machine: install with `TradersApp.Desktop.Setup.exe`.
- [ ] Verify launch succeeds when WebView2 is already installed.
- [ ] Verify launch succeeds when WebView2 is missing and the bootstrapper must install it.
- [ ] Verify the standalone MSI installs successfully in both per-user and per-machine modes.
- [ ] Verify Start Menu shortcut, Desktop shortcut, repair, uninstall, and reinstall.

## Desktop Runtime Behavior

- [ ] Run `powershell -ExecutionPolicy Bypass -File .\scripts\windows\certify-desktop-performance.ps1 ...` on each 4 GB reference machine and archive the JSON/Markdown artifacts.
- [ ] Confirm login screen loads within the startup budget on a 4 GB RAM laptop.
- [ ] Confirm idle desktop memory stays within the budget after login and first navigation.
- [ ] Confirm core screens match the web UI and no desktop-only regressions appear.
- [ ] Confirm external links open in the system browser instead of inside the app shell.
- [ ] Confirm desktop devtools and debug affordances are unavailable in release builds.

## Auth, Policy, And Admin Control

- [ ] Log in as a valid user and confirm the desktop session registers version, install ID, and device ID.
- [ ] Validate degraded-network handling and reconnect recovery on the desktop shell while the session remains open.
- [ ] Block that user from the admin panel and confirm the desktop session is forced out on the next policy check or protected call.
- [ ] Confirm a blocked user cannot sign in again while the status remains `BLOCKED`.
- [ ] Confirm maintenance mode forces a shell-level exit path.
- [ ] Confirm minimum desktop version enforcement prompts an update check and logs the user out.

## Update Flow

- [ ] Confirm automatic update checks use the signed appcast.
- [ ] Confirm manual import accepts a newer signed installer.
- [ ] Confirm manual import rejects an unsigned installer.
- [ ] Confirm manual import rejects an installer with the same or older version.
- [ ] Confirm manual import rejects a corrupted installer when the `.sha256` sidecar does not match.
- [ ] Confirm the app restarts cleanly after a successful update.

## Release Integrity

- [ ] Verify `TradersApp.Desktop.exe`, `TradersApp.Package.msi`, and `TradersApp.Desktop.Setup.exe` are Authenticode-signed.
- [ ] Verify `appcast.xml` and `appcast.xml.signature` are published together.
- [ ] Verify every published installer has a matching `.sha256` sidecar.
- [ ] Verify the workflow emitted a CycloneDX SBOM and Trivy SARIF.
- [ ] Verify the desktop release payload contains no local `BFF`, `ML`, GPU-runtime, or source-map artifacts.
- [ ] Verify no source maps, secrets, or model artifacts are present in the release payload.
