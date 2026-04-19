using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace TradersApp.Desktop.Services;

internal sealed class DesktopSecureStore
{
    private readonly object _gate = new();
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    public DesktopSecureStore()
    {
        Directory.CreateDirectory(DesktopHostOptions.AppDataRoot);
    }

    public string? Get(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            return null;
        }

        lock (_gate)
        {
            var store = ReadStore();
            if (!store.TryGetValue(key, out var encrypted))
            {
                return null;
            }

            return Unprotect(encrypted);
        }
    }

    public void Set(string key, string value)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            throw new ArgumentException("A secure-store key is required.", nameof(key));
        }

        lock (_gate)
        {
            var store = ReadStore();
            store[key] = Protect(value);
            WriteStore(store);
        }
    }

    public void Remove(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            return;
        }

        lock (_gate)
        {
            var store = ReadStore();
            if (!store.Remove(key))
            {
                return;
            }

            WriteStore(store);
        }
    }

    public string GetOrCreateGuid(string key)
    {
        var existing = Get(key);
        if (!string.IsNullOrWhiteSpace(existing))
        {
            return existing;
        }

        var created = Guid.NewGuid().ToString("D");
        Set(key, created);
        return created;
    }

    private Dictionary<string, string> ReadStore()
    {
        if (!File.Exists(DesktopHostOptions.SecureStorePath))
        {
            return new Dictionary<string, string>(StringComparer.Ordinal);
        }

        try
        {
            var json = File.ReadAllText(DesktopHostOptions.SecureStorePath, Encoding.UTF8);
            return JsonSerializer.Deserialize<Dictionary<string, string>>(json, _jsonOptions)
                   ?? new Dictionary<string, string>(StringComparer.Ordinal);
        }
        catch
        {
            return new Dictionary<string, string>(StringComparer.Ordinal);
        }
    }

    private void WriteStore(Dictionary<string, string> store)
    {
        var json = JsonSerializer.Serialize(store, _jsonOptions);
        File.WriteAllText(DesktopHostOptions.SecureStorePath, json, Encoding.UTF8);
    }

    private static string Protect(string value)
    {
        var plaintext = Encoding.UTF8.GetBytes(value ?? string.Empty);
        var encrypted = ProtectedData.Protect(plaintext, null, DataProtectionScope.CurrentUser);
        return Convert.ToBase64String(encrypted);
    }

    private static string? Unprotect(string value)
    {
        try
        {
            var encrypted = Convert.FromBase64String(value);
            var decrypted = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(decrypted);
        }
        catch
        {
            return null;
        }
    }
}
