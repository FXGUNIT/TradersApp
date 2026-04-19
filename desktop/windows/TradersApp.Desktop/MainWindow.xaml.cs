using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using TradersApp.Desktop.Services;

namespace TradersApp.Desktop;

public partial class MainWindow : Window
{
    private readonly DesktopSecureStore _secureStore = new();
    private readonly DesktopUpdateService _desktopUpdateService = new();
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);
    private CancellationTokenSource? _statusBannerCts;
    private DesktopRuntimeContext? _runtimeContext;

    public MainWindow()
    {
        InitializeComponent();
    }

    private async void Window_OnLoaded(object sender, RoutedEventArgs e)
    {
        _runtimeContext = DesktopRuntimeContext.Create(_secureStore);
        _desktopUpdateService.Initialize();
        await EnsureWebViewReadyAsync();
        _desktopUpdateService.StartBackgroundChecks();
    }

    private async Task EnsureWebViewReadyAsync()
    {
        if (!File.Exists(DesktopHostOptions.DesktopWebIndexPath))
        {
            ShowMissingAssets(
                $"Expected desktop bundle at '{DesktopHostOptions.DesktopWebIndexPath}'. Run 'npm run build:desktop:web' before building the Windows shell.");
            return;
        }

        try
        {
            _ = CoreWebView2Environment.GetAvailableBrowserVersionString();
        }
        catch (Exception ex)
        {
            ShowMissingAssets(
                $"WebView2 Runtime is not available on this machine. Install the Evergreen Runtime, then retry. {ex.Message}");
            return;
        }

        try
        {
            await AppWebView.EnsureCoreWebView2Async();
            ConfigureWebView();
            AppWebView.Source = DesktopHostOptions.AppStartUri;
            MissingAssetsPanel.Visibility = Visibility.Collapsed;
            ShowStatus("Windows thin client ready.");
        }
        catch (Exception ex)
        {
            ShowMissingAssets($"WebView2 initialization failed: {ex.Message}");
        }
    }

    private void ConfigureWebView()
    {
        if (AppWebView.CoreWebView2 is null)
        {
            return;
        }

        AppWebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
            DesktopHostOptions.AppHostName,
            DesktopHostOptions.DesktopWebRootPath,
            CoreWebView2HostResourceAccessKind.DenyCors);

        var settings = AppWebView.CoreWebView2.Settings;
        settings.AreDefaultContextMenusEnabled = false;
        settings.AreDevToolsEnabled = false;
        settings.AreBrowserAcceleratorKeysEnabled = false;
        settings.IsBuiltInErrorPageEnabled = true;
        settings.IsStatusBarEnabled = false;
        settings.IsZoomControlEnabled = false;

        AppWebView.CoreWebView2.NavigationStarting -= CoreWebView2_OnNavigationStarting;
        AppWebView.CoreWebView2.NavigationStarting += CoreWebView2_OnNavigationStarting;
        AppWebView.CoreWebView2.NewWindowRequested -= CoreWebView2_OnNewWindowRequested;
        AppWebView.CoreWebView2.NewWindowRequested += CoreWebView2_OnNewWindowRequested;
        AppWebView.CoreWebView2.WebMessageReceived -= CoreWebView2_OnWebMessageReceived;
        AppWebView.CoreWebView2.WebMessageReceived += CoreWebView2_OnWebMessageReceived;
    }

    private void CoreWebView2_OnNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri))
        {
            return;
        }

        if (DesktopHostOptions.IsAllowedTopLevelNavigation(uri))
        {
            return;
        }

        e.Cancel = true;
        OpenExternal(uri);
    }

    private void CoreWebView2_OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri))
        {
            OpenExternal(uri);
        }
    }

    private async void CoreWebView2_OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (AppWebView.CoreWebView2 is null)
        {
            return;
        }

        string id = string.Empty;

        try
        {
            using var doc = JsonDocument.Parse(e.WebMessageAsJson);
            var root = doc.RootElement;
            if (!root.TryGetProperty("channel", out var channelElement) ||
                !string.Equals(channelElement.GetString(), DesktopHostOptions.DesktopBridgeChannel, StringComparison.Ordinal))
            {
                return;
            }

            id = root.TryGetProperty("id", out var idElement) ? idElement.GetString() ?? string.Empty : string.Empty;
            var command = root.TryGetProperty("command", out var commandElement)
                ? commandElement.GetString() ?? string.Empty
                : string.Empty;
            var payload = root.TryGetProperty("payload", out var payloadElement)
                ? payloadElement.Clone()
                : default;

            var result = await ExecuteBridgeCommandAsync(command, payload);
            PostBridgeResponse(id, true, result, null);
        }
        catch (Exception ex)
        {
            PostBridgeResponse(id, false, null, ex.Message);
        }
    }

    private async Task<object?> ExecuteBridgeCommandAsync(string command, JsonElement payload)
    {
        return command switch
        {
            "runtime.getContext" => _runtimeContext,
            "storage.get" => _secureStore.Get(ReadPayloadString(payload, "key")),
            "storage.set" => SetSecureValue(payload),
            "storage.remove" => RemoveSecureValue(payload),
            "policy.notify" => await HandlePolicyNotificationAsync(payload),
            "updates.check" => await _desktopUpdateService.CheckForUpdatesInteractiveAsync(),
            "updates.import" => await InstallPackageAsync(ReadPayloadString(payload, "path")),
            "app.restart" => RestartApplication(),
            _ => throw new InvalidOperationException($"Unsupported desktop bridge command '{command}'."),
        };
    }

    private object SetSecureValue(JsonElement payload)
    {
        var key = ReadPayloadString(payload, "key");
        var value = ReadPayloadString(payload, "value");
        _secureStore.Set(key, value);
        return new { stored = true };
    }

    private object RemoveSecureValue(JsonElement payload)
    {
        var key = ReadPayloadString(payload, "key");
        _secureStore.Remove(key);
        return new { removed = true };
    }

    private async Task<object> HandlePolicyNotificationAsync(JsonElement payload)
    {
        var reason = ReadPayloadString(payload, "reason");
        var minimumDesktopVersion = ReadPayloadString(payload, "minimumDesktopVersion");
        var maintenanceActive = ReadPayloadBoolean(payload, "maintenanceActive");

        if (string.Equals(reason, "MINIMUM_DESKTOP_VERSION_REQUIRED", StringComparison.Ordinal))
        {
            ShowStatus(
                $"Minimum desktop version {minimumDesktopVersion} is required. Checking for updates.");
            await _desktopUpdateService.CheckForUpdatesInteractiveAsync();
        }
        else if (maintenanceActive)
        {
            ShowStatus("Maintenance mode is active. This desktop session will close.", persist: true);
        }
        else
        {
            ShowStatus($"Desktop policy update received: {reason}.", persist: true);
        }

        return new
        {
            acknowledged = true,
            reason,
            minimumDesktopVersion,
            maintenanceActive,
        };
    }

    private async Task<object> InstallPackageAsync(string packagePath)
    {
        if (string.IsNullOrWhiteSpace(packagePath))
        {
            var dialog = new OpenFileDialog
            {
                CheckFileExists = true,
                Filter = DesktopHostOptions.ManualPackageDialogFilter,
                Multiselect = false,
                Title = "Select a signed TradersApp installer",
            };

            if (dialog.ShowDialog(this) != true)
            {
                return new { success = false, cancelled = true };
            }

            packagePath = dialog.FileName;
        }

        var result = await _desktopUpdateService.InstallLocalPackageAsync(packagePath);
        ShowStatus(result.Message, persist: !result.Success);
        if (result.Success)
        {
            Application.Current.Shutdown();
        }

        return result;
    }

    private object RestartApplication()
    {
        var executablePath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(executablePath))
        {
            throw new InvalidOperationException("Unable to resolve the running executable path.");
        }

        Process.Start(new ProcessStartInfo(executablePath)
        {
            UseShellExecute = true,
            WorkingDirectory = AppContext.BaseDirectory,
        });
        Application.Current.Shutdown();
        return new { restarting = true };
    }

    private void PostBridgeResponse(string id, bool ok, object? result, string? error)
    {
        if (AppWebView.CoreWebView2 is null)
        {
            return;
        }

        var payload = JsonSerializer.Serialize(new
        {
            channel = DesktopHostOptions.DesktopBridgeChannel,
            id,
            ok,
            result,
            error,
        }, _jsonOptions);

        AppWebView.CoreWebView2.PostWebMessageAsJson(payload);
    }

    private void ShowMissingAssets(string message)
    {
        MissingAssetsTextBlock.Text = message;
        MissingAssetsPanel.Visibility = Visibility.Visible;
        ShowStatus(message, persist: true);
    }

    private void ShowStatus(string message, bool persist = false)
    {
        StatusTextBlock.Text = message;
        StatusBanner.Visibility = Visibility.Visible;

        _statusBannerCts?.Cancel();
        _statusBannerCts?.Dispose();
        _statusBannerCts = null;

        if (persist)
        {
            return;
        }

        _statusBannerCts = new CancellationTokenSource();
        var token = _statusBannerCts.Token;
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(6), token);
                await Dispatcher.InvokeAsync(() =>
                {
                    if (!token.IsCancellationRequested)
                    {
                        StatusBanner.Visibility = Visibility.Collapsed;
                    }
                });
            }
            catch (TaskCanceledException)
            {
                // Ignore superseded banners.
            }
        }, token);
    }

    private static string ReadPayloadString(JsonElement payload, string propertyName)
    {
        if (payload.ValueKind != JsonValueKind.Object ||
            !payload.TryGetProperty(propertyName, out var element))
        {
            return string.Empty;
        }

        return element.GetString() ?? string.Empty;
    }

    private static bool ReadPayloadBoolean(JsonElement payload, string propertyName)
    {
        if (payload.ValueKind != JsonValueKind.Object ||
            !payload.TryGetProperty(propertyName, out var element))
        {
            return false;
        }

        return element.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String => bool.TryParse(element.GetString(), out var value) && value,
            _ => false,
        };
    }

    private void OpenExternal(Uri uri)
    {
        try
        {
            Process.Start(new ProcessStartInfo(uri.AbsoluteUri)
            {
                UseShellExecute = true,
            });
        }
        catch (Exception ex)
        {
            ShowStatus($"Unable to open {uri.Host}: {ex.Message}", persist: true);
        }
    }

    private async void RetryButton_OnClick(object sender, RoutedEventArgs e)
    {
        await EnsureWebViewReadyAsync();
    }

    private async void CheckForUpdatesButton_OnClick(object sender, RoutedEventArgs e)
    {
        var result = await _desktopUpdateService.CheckForUpdatesInteractiveAsync();
        if (!string.IsNullOrWhiteSpace(result.Message))
        {
            ShowStatus(result.Message, persist: !result.Success);
        }
    }

    private async void InstallPackageButton_OnClick(object sender, RoutedEventArgs e)
    {
        await InstallPackageAsync(string.Empty);
    }

    private async void Window_OnKeyDown(object sender, KeyEventArgs e)
    {
        if ((Keyboard.Modifiers & (ModifierKeys.Control | ModifierKeys.Shift)) !=
            (ModifierKeys.Control | ModifierKeys.Shift))
        {
            return;
        }

        if (e.Key == Key.U)
        {
            e.Handled = true;
            var result = await _desktopUpdateService.CheckForUpdatesInteractiveAsync();
            ShowStatus(result.Message, persist: !result.Success);
        }
        else if (e.Key == Key.I)
        {
            e.Handled = true;
            await InstallPackageAsync(string.Empty);
        }
    }
}
