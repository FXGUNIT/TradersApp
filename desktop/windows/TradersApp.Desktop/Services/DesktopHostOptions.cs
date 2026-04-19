using System.Reflection;
using System.IO;

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
        "https://downloads.traders.app/windows/appcast.xml");

    public static string AppCastPublicKey =>
        ResolveSetting("TRADERSAPP_APPCAST_PUBLIC_KEY", string.Empty);

    public static string ManualPackageDialogFilter =>
        "TradersApp installers (*.exe;*.msi)|*.exe;*.msi";

    public static TimeSpan UpdateCheckInterval => TimeSpan.FromHours(6);

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

    private static string ResolveSetting(string environmentKey, string fallback)
    {
        var value = Environment.GetEnvironmentVariable(environmentKey);
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }
}
