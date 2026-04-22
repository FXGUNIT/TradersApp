# Windows Desktop Release Runbook

## Scope

This release path packages TradersApp as a Windows-only thin desktop client:

- React/Vite UI is bundled into the desktop shell.
- The desktop shell is `WPF + WebView2`.
- Authentication, admin access control, policy enforcement, and trading logic remain server-side.
- Signed installers and a signed NetSparkle appcast drive the update path.

## Required Secrets And Variables

GitHub repository secrets:

- `SIGN_CERTIFICATE_BASE64`
- `SIGN_CERTIFICATE_PASSWORD`
- `SPARKLE_PRIVATE_KEY`
- `SPARKLE_PUBLIC_KEY`

GitHub repository variables:

- `SIGN_TIMESTAMP_URL`
- `WEBVIEW2_BOOTSTRAPPER_URL`
- `WEBVIEW2_OFFLINE_INSTALLER_URL`
- `WINDOWS_APPCAST_URL`
- `WINDOWS_UPDATES_BASE_URL`
- `WINDOWS_RELEASE_NOTES_BASE_URL`

If the custom Windows update URLs are not set, the release workflow already
falls back to GitHub Releases for the appcast and update payloads. That is the
safe default path while the public domain cutover is still unsettled.

## Release Workflow

Workflow file: `.github/workflows/windows-release.yml`

Trigger a release in one of two ways:

1. Push a tag such as `v1.2.3.4`.
2. Run the workflow manually and provide `release_version`.

The workflow performs these steps:

1. Builds the desktop web bundle with `npm run build:desktop:web`.
2. Generates `desktop-settings.json` with the signed appcast URL and public key.
3. Downloads the WebView2 bootstrapper and optional offline Evergreen runtime installer.
4. Builds the WPF desktop shell with the requested `DesktopVersion`.
5. Authenticode-signs the desktop executable before MSI packaging.
6. Builds the MSI and WiX bootstrapper bundle.
7. Authenticode-signs the MSI and setup EXE.
8. Generates SHA-256 sidecars for release assets.
9. Generates a signed NetSparkle `appcast.xml` and `appcast.xml.signature`.
10. Scans the staged release payload with Trivy and emits a CycloneDX SBOM.
11. Publishes the release assets to GitHub Releases on tag builds.

## Local Build Smoke Test

Use these commands locally before pushing a release tag:

```powershell
npm run build:desktop:web
dotnet build desktop/windows/TradersApp.Desktop/TradersApp.Desktop.csproj -c Release -p:DesktopVersion=1.2.3.4
dotnet build desktop/windows/installer/TradersApp.Package/TradersApp.Package.wixproj -c Release -p:DesktopVersion=1.2.3.4
dotnet build desktop/windows/installer/TradersApp.Bundle/TradersApp.Bundle.wixproj -c Release -p:DesktopVersion=1.2.3.4
python -m pytest bff/tests/test_r07_route_contracts.py -q
```

Before tagging a release candidate, run the `P23` wrapper on both 4 GB reference machines and retain the generated run directories:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run-p23-reference-certification.ps1 `
  -ReferenceMachineLabel "win11-4gb-ref-01" `
  -DesktopExePath .\desktop\windows\TradersApp.Desktop\bin\Release\net8.0-windows\TradersApp.Desktop.exe
```

See [WINDOWS_P23_REFERENCE_MACHINE_RUNBOOK.md](/e:/TradersApp/docs/windows/WINDOWS_P23_REFERENCE_MACHINE_RUNBOOK.md) for the full `P23` sign-off sequence and [WINDOWS_DESKTOP_PERFORMANCE_CERTIFICATION.md](/e:/TradersApp/docs/windows/WINDOWS_DESKTOP_PERFORMANCE_CERTIFICATION.md) for harness details.

## Installer Outputs

The signed release payload contains:

- `TradersApp.Desktop.Setup.exe`
- `TradersApp.Package.msi`
- `appcast.xml`
- `appcast.xml.signature`
- `*.sha256` sidecars
- release notes markdown
- Trivy SARIF
- CycloneDX SBOM

## Operational Notes

- The desktop app reads update configuration from `desktop-settings.json`, which is generated during the release workflow and copied into the app output.
- The desktop update path expects both Authenticode-signed installers and valid NetSparkle signatures.
- The bundle currently includes the packaged WebView2 bootstrapper when `WEBVIEW2_BOOTSTRAPPER_URL` is configured.
- If `WEBVIEW2_OFFLINE_INSTALLER_URL` is configured and the workflow input is enabled, the offline Evergreen runtime installer is attached as a release asset for support use.
- The built-in fallback appcast URL is GitHub Releases:
  `https://github.com/FXGUNIT/TradersApp/releases/latest/download/appcast.xml`
  Set `WINDOWS_APPCAST_URL` only when you intentionally move updates to a dedicated host later.

## Known Limitation

WiX Burn warns when the bundle chains a dual-scope MSI (`perUserOrMachine`). The standalone MSI preserves the dual-scope install UI; the bootstrapper bundle currently assumes per-machine behavior for the chained package. Treat the MSI as the authoritative dual-scope installer until the bundle is split into explicit per-user and per-machine variants.
