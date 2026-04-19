using System.IO;
using System.Reflection;
using System.Text.Json;

namespace TradersApp.Desktop.Services;

internal static class DesktopHostOptions
{
    public const string DesktopBridgeChannel = "tradersapp-desktop";
    public const string AppHostName = "app.traders.local";
    public static readonly Uri AppStartUri = new($"https://{AppHostName}/index.html");

    private static readonly HashSet<string> AllowedTopLevelHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        AppHostName,
    };
    private static readonly DesktopRuntimeSettings RuntimeSettings = LoadRuntimeSettings();

    public static string AppVersion =>
        Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";

    public static string AppDataRoot =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "TradersApp",
            "Desktop");

    public static string SecureStorePath => Path.Combine(AppDataRoot, "secure-store.json");

    public static string DesktopWebRootPath => Path.Combine(AppContext.BaseDirectory, "webapp");

    public static string DesktopWebIndexPath => Path.Combine(DesktopWebRootPath, "index.html");

    public static string AppCastUrl => ResolveSetting(
        "TRADERSAPP_APPCAST_URL",
        RuntimeSettings.AppCastUrl,
        "https://downloads.traders.app/windows/appcast.xml");

    public static string AppCastPublicKey =>
        ResolveSetting("TRADERSAPP_APPCAST_PUBLIC_KEY", RuntimeSettings.AppCastPublicKey, string.Empty);

    public static string ManualPackageDialogFilter =>
        "TradersApp installers (*.exe;*.msi)|*.exe;*.msi";

    public static TimeSpan UpdateCheckInterval => TimeSpan.FromHours(
        RuntimeSettings.UpdateCheckIntervalHours.GetValueOrDefault(6));

    public static bool IsAllowedTopLevelNavigation(Uri uri)
    {
        if (uri.IsFile)
        {
            return false;
        }

        if (uri.Scheme.Equals("about", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return AllowedTopLevelHosts.Contains(uri.Host);
    }

    private static DesktopRuntimeSettings LoadRuntimeSettings()
    {
        var settingsPath = Path.Combine(AppContext.BaseDirectory, "desktop-settings.json");
        if (!File.Exists(settingsPath))
        {
            return new DesktopRuntimeSettings();
        }

        try
        {
            var payload = File.ReadAllText(settingsPath);
            return JsonSerializer.Deserialize<DesktopRuntimeSettings>(payload) ?? new DesktopRuntimeSettings();
        }
        catch
        {
            return new DesktopRuntimeSettings();
        }
    }

    private static string ResolveSetting(string environmentKey, string? configuredValue, string fallback)
    {
        var value = Environment.GetEnvironmentVariable(environmentKey);
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value.Trim();
        }

        if (!string.IsNullOrWhiteSpace(configuredValue))
        {
            return configuredValue.Trim();
        }

        return fallback;
    }
}

internal sealed class DesktopRuntimeSettings
{
    public string? AppCastUrl { get; init; }

    public string? AppCastPublicKey { get; init; }

    public double? UpdateCheckIntervalHours { get; init; }
}
