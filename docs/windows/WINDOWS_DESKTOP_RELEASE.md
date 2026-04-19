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

## Known Limitation

WiX Burn warns when the bundle chains a dual-scope MSI (`perUserOrMachine`). The standalone MSI preserves the dual-scope install UI; the bootstrapper bundle currently assumes per-machine behavior for the chained package. Treat the MSI as the authoritative dual-scope installer until the bundle is split into explicit per-user and per-machine variants.
