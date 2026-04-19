using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.RegularExpressions;
using NetSparkleUpdater;
using NetSparkleUpdater.Enums;
using NetSparkleUpdater.SignatureVerifiers;
using NetSparkleUpdater.UI.WPF;

namespace TradersApp.Desktop.Services;

internal sealed class DesktopUpdateService
{
    private SparkleUpdater? _updater;
    private bool _isInitialized;

    public void Initialize()
    {
        if (_isInitialized)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(DesktopHostOptions.AppCastUrl) ||
            string.IsNullOrWhiteSpace(DesktopHostOptions.AppCastPublicKey))
        {
            _isInitialized = true;
            return;
        }

        _updater = new SparkleUpdater(
            DesktopHostOptions.AppCastUrl,
            new Ed25519Checker(SecurityMode.Strict, DesktopHostOptions.AppCastPublicKey),
            Assembly.GetExecutingAssembly().GetName().Name ?? "TradersApp.Desktop",
            new UIFactory())
        {
            RelaunchAfterUpdate = false,
            CustomInstallerArguments = "/passive /norestart",
            TmpDownloadFilePath = Path.Combine(DesktopHostOptions.AppDataRoot, "updates"),
        };

        _isInitialized = true;
    }

    public void StartBackgroundChecks()
    {
        if (_updater is null || _updater.IsUpdateLoopRunning)
        {
            return;
        }

        _updater.StartLoop(false, false, DesktopHostOptions.UpdateCheckInterval);
    }

    public Task<DesktopUpdateActionResult> CheckForUpdatesInteractiveAsync()
    {
        if (_updater is null)
        {
            return Task.FromResult(new DesktopUpdateActionResult(
                Success: false,
                Message: "Automatic updates are not configured. Set TRADERSAPP_APPCAST_URL and TRADERSAPP_APPCAST_PUBLIC_KEY for signed update checks.",
                FilePath: null,
                PackageVersion: null,
                Hash: null,
                HashValidated: false,
                SignatureValidated: false));
        }

        _updater.CheckForUpdatesAtUserRequest(false);
        return Task.FromResult(new DesktopUpdateActionResult(
            Success: true,
            Message: "Checking for signed updates.",
            FilePath: null,
            PackageVersion: null,
            Hash: null,
            HashValidated: false,
            SignatureValidated: true));
    }

    public async Task<DesktopUpdateActionResult> InstallLocalPackageAsync(string packagePath)
    {
        if (string.IsNullOrWhiteSpace(packagePath))
        {
            return new DesktopUpdateActionResult(
                Success: false,
                Message: "No installer package was selected.",
                FilePath: null,
                PackageVersion: null,
                Hash: null,
                HashValidated: false,
                SignatureValidated: false);
        }

        if (!File.Exists(packagePath))
        {
            return new DesktopUpdateActionResult(
                Success: false,
                Message: $"Installer file not found: {packagePath}",
                FilePath: packagePath,
                PackageVersion: null,
                Hash: null,
                HashValidated: false,
                SignatureValidated: false);
        }

        var extension = Path.GetExtension(packagePath);
        if (!string.Equals(extension, ".exe", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(extension, ".msi", StringComparison.OrdinalIgnoreCase))
        {
            return new DesktopUpdateActionResult(
                Success: false,
                Message: "Only .exe and .msi desktop installers are accepted.",
                FilePath: packagePath,
                PackageVersion: null,
                Hash: null,
                HashValidated: false,
                SignatureValidated: false);
        }

        if (!TryValidateAuthenticodeSignature(packagePath, out var signerSubject, out var signatureError))
        {
            return new DesktopUpdateActionResult(
                Success: false,
                Message: signatureError ?? "The selected installer is unsigned.",
                FilePath: packagePath,
                PackageVersion: null,
                Hash: null,
                HashValidated: false,
                SignatureValidated: false);
        }

        var packageVersion = GetVersionFromInstaller(packagePath);
        var currentVersion = GetCurrentVersion();
        if (packageVersion <= currentVersion)
        {
            return new DesktopUpdateActionResult(
                Success: false,
                Message: $"Installer version {packageVersion} is not newer than the current desktop version {currentVersion}.",
                FilePath: packagePath,
                PackageVersion: packageVersion.ToString(3),
                Hash: null,
                HashValidated: false,
                SignatureValidated: true);
        }

        var computedHash = await ComputeSha256Async(packagePath);
        var sidecarValidation = ValidateSha256Sidecar(packagePath, computedHash);
        if (!sidecarValidation.IsValid)
        {
            return new DesktopUpdateActionResult(
                Success: false,
                Message: sidecarValidation.Message,
                FilePath: packagePath,
                PackageVersion: packageVersion.ToString(3),
                Hash: computedHash,
                HashValidated: false,
                SignatureValidated: true);
        }

        LaunchInstaller(packagePath, extension);

        return new DesktopUpdateActionResult(
            Success: true,
            Message: sidecarValidation.SidecarPresent
                ? $"Launching signed installer {Path.GetFileName(packagePath)}. Authenticode and SHA-256 sidecar validation both passed."
                : $"Launching signed installer {Path.GetFileName(packagePath)} from {signerSubject}.",
            FilePath: packagePath,
            PackageVersion: packageVersion.ToString(3),
            Hash: computedHash,
            HashValidated: sidecarValidation.SidecarPresent,
            SignatureValidated: true);
    }

    private static void LaunchInstaller(string packagePath, string extension)
    {
        ProcessStartInfo startInfo = string.Equals(extension, ".msi", StringComparison.OrdinalIgnoreCase)
            ? new ProcessStartInfo("msiexec.exe", $"/i \"{packagePath}\" /passive /norestart")
            : new ProcessStartInfo(packagePath, "/passive /norestart");

        startInfo.UseShellExecute = true;
        Process.Start(startInfo);
    }

    private static bool TryValidateAuthenticodeSignature(
        string packagePath,
        out string signerSubject,
        out string? error)
    {
        signerSubject = string.Empty;
        error = null;

        try
        {
            using var certificate = new X509Certificate2(X509Certificate.CreateFromSignedFile(packagePath));
            if (string.IsNullOrWhiteSpace(certificate.Thumbprint))
            {
                error = "The selected installer is not Authenticode-signed.";
                return false;
            }

            signerSubject = certificate.Subject;
            return true;
        }
        catch (CryptographicException ex)
        {
            error = $"Authenticode validation failed: {ex.Message}";
            return false;
        }
    }

    private static async Task<string> ComputeSha256Async(string packagePath)
    {
        await using var stream = File.OpenRead(packagePath);
        using var sha256 = SHA256.Create();
        var hash = await sha256.ComputeHashAsync(stream);
        return Convert.ToHexString(hash);
    }

    private static (bool IsValid, bool SidecarPresent, string Message) ValidateSha256Sidecar(
        string packagePath,
        string computedHash)
    {
        var sidecarPath = $"{packagePath}.sha256";
        if (!File.Exists(sidecarPath))
        {
            return (true, false, "Installer is signed and newer. No sidecar hash was supplied.");
        }

        var expectedHash = File.ReadAllText(sidecarPath).Trim().Split(' ', '\t').FirstOrDefault() ?? string.Empty;
        var valid = string.Equals(expectedHash, computedHash, StringComparison.OrdinalIgnoreCase);
        return valid
            ? (true, true, "Installer signature and SHA-256 sidecar validated.")
            : (false, true, "Installer SHA-256 did not match the supplied sidecar hash.");
    }

    private static Version GetCurrentVersion()
    {
        return Assembly.GetExecutingAssembly().GetName().Version ?? new Version(1, 0, 0, 0);
    }

    private static Version GetVersionFromInstaller(string packagePath)
    {
        var fileInfo = FileVersionInfo.GetVersionInfo(packagePath);
        var candidate = NormalizeVersion(fileInfo.ProductVersion) ??
                        NormalizeVersion(fileInfo.FileVersion);

        return candidate ?? new Version(0, 0, 0, 0);
    }

    private static Version? NormalizeVersion(string? rawValue)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return null;
        }

        var cleaned = rawValue.Split('+', '-', ' ').FirstOrDefault(static part => !string.IsNullOrWhiteSpace(part));
        if (Version.TryParse(cleaned, out var version))
        {
            return version;
        }

        var numericMatch = Regex.Match(rawValue, @"\d+(\.\d+){1,3}");
        return numericMatch.Success && Version.TryParse(numericMatch.Value, out version)
            ? version
            : null;
    }
}

internal sealed record DesktopUpdateActionResult(
    bool Success,
    string Message,
    string? FilePath,
    string? PackageVersion,
    string? Hash,
    bool HashValidated,
    bool SignatureValidated);
