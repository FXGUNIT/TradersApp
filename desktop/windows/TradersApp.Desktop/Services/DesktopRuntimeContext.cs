namespace TradersApp.Desktop.Services;

internal sealed record DesktopRuntimeContext(
    bool Available,
    string Platform,
    string AppVersion,
    string InstallId,
    string DeviceId)
{
    private const string InstallIdKey = "runtime.installId";
    private const string DeviceIdKey = "runtime.deviceId";

    public static DesktopRuntimeContext Create(DesktopSecureStore secureStore)
    {
        var installId = secureStore.GetOrCreateGuid(InstallIdKey);
        var deviceId = secureStore.GetOrCreateGuid(DeviceIdKey);

        return new DesktopRuntimeContext(
            Available: true,
            Platform: "windows",
            AppVersion: DesktopHostOptions.AppVersion,
            InstallId: installId,
            DeviceId: deviceId);
    }
}
