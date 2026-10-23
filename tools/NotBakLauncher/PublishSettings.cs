using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text.RegularExpressions;

namespace NotBak.Launcher;

internal enum BindMode
{
    Local,
    Network,
}

internal sealed class PublishConfig
{
    public BindMode BindMode { get; set; } = BindMode.Local;
    public int Port { get; set; } = 3001;
}

internal static class PublishSettings
{
    private const int DefaultPort = 3001;
    private const int PortScanMax = 3100;

    public static PublishConfig Load(string projectRoot)
    {
        var config = new PublishConfig
        {
            Port = ProjectPaths.ReadPort(projectRoot),
            BindMode = ReadBindMode(projectRoot),
        };
        return config;
    }

    public static void Save(string projectRoot, PublishConfig config)
    {
        ProjectPaths.SavePort(projectRoot, config.Port);
        SaveBindMode(projectRoot, config.BindMode);
        TryUpdateAppUrlInEnv(projectRoot, config);
    }

    /// <summary>Next.js -H parametresi: ağ için 0.0.0.0, yerel için 127.0.0.1</summary>
    public static string GetBindHost(BindMode mode) =>
        mode == BindMode.Network ? "0.0.0.0" : "127.0.0.1";

    public static string GetPrimaryUrl(PublishConfig config)
    {
        if (config.BindMode == BindMode.Local)
            return $"http://localhost:{config.Port}";

        var lan = GetPrimaryLanAddress();
        return lan != null
            ? $"http://{lan}:{config.Port}"
            : $"http://localhost:{config.Port}";
    }

    public static IReadOnlyList<string> GetAccessUrls(PublishConfig config)
    {
        var urls = new List<string> { $"http://localhost:{config.Port}" };
        if (config.BindMode == BindMode.Network)
        {
            foreach (var ip in GetLanAddresses())
            {
                var u = $"http://{ip}:{config.Port}";
                if (!urls.Contains(u, StringComparer.OrdinalIgnoreCase))
                    urls.Add(u);
            }
        }

        return urls;
    }

    public static int FindFreePort(int startPort = DefaultPort, int maxPort = PortScanMax)
    {
        for (var port = startPort; port <= maxPort; port++)
        {
            if (!IsPortInUse(port))
                return port;
        }

        throw new InvalidOperationException($"{startPort}-{maxPort} aralığında boş port bulunamadı.");
    }

    public static bool IsPortInUse(int port)
    {
        if (IsPortListeningOnIp(port, IPAddress.Loopback))
            return true;
        if (IsPortListeningOnIp(port, IPAddress.Any))
            return true;
        return false;
    }

    private static bool IsPortListeningOnIp(int port, IPAddress address)
    {
        try
        {
            using var listener = new TcpListener(address, port);
            listener.Start();
            listener.Stop();
            return false;
        }
        catch (SocketException)
        {
            return true;
        }
    }

    private static BindMode ReadBindMode(string projectRoot)
    {
        var bindFile = Path.Combine(projectRoot, "config", "bind.txt");
        if (!File.Exists(bindFile))
            return BindMode.Local;

        foreach (var line in File.ReadAllLines(bindFile))
        {
            var v = line.Trim().ToLowerInvariant();
            if (v is "network" or "ag" or "lan" or "0.0.0.0")
                return BindMode.Network;
            if (v is "local" or "yerel" or "localhost" or "127.0.0.1")
                return BindMode.Local;
        }

        return BindMode.Local;
    }

    private static void SaveBindMode(string projectRoot, BindMode mode)
    {
        var configDir = Path.Combine(projectRoot, "config");
        Directory.CreateDirectory(configDir);
        var value = mode == BindMode.Network ? "network" : "local";
        File.WriteAllText(Path.Combine(configDir, "bind.txt"), value + Environment.NewLine);
    }

    private static string? GetPrimaryLanAddress()
    {
        var list = GetLanAddresses();
        return list.Count > 0 ? list[0] : null;
    }

    private static List<string> GetLanAddresses()
    {
        var result = new List<string>();
        try
        {
            foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != OperationalStatus.Up)
                    continue;
                if (ni.NetworkInterfaceType is NetworkInterfaceType.Loopback
                    or NetworkInterfaceType.Tunnel)
                    continue;

                foreach (var addr in ni.GetIPProperties().UnicastAddresses)
                {
                    if (addr.Address.AddressFamily != AddressFamily.InterNetwork)
                        continue;
                    var ip = addr.Address.ToString();
                    if (ip.StartsWith("169.254.", StringComparison.Ordinal))
                        continue;
                    if (!result.Contains(ip))
                        result.Add(ip);
                }
            }
        }
        catch
        {
            // ignore
        }

        return result;
    }

    private static void TryUpdateAppUrlInEnv(string projectRoot, PublishConfig config)
    {
        var envFile = Path.Combine(projectRoot, ".env");
        if (!File.Exists(envFile))
            return;

        var primary = GetPrimaryUrl(config);
        var content = File.ReadAllText(envFile);
        if (Regex.IsMatch(content, @"^\s*APP_URL\s*=", RegexOptions.Multiline))
        {
            content = Regex.Replace(
                content,
                @"^\s*APP_URL\s*=.*$",
                $"APP_URL=\"{primary}\"",
                RegexOptions.Multiline);
        }
        else
        {
            content = content.TrimEnd() + Environment.NewLine + $"APP_URL=\"{primary}\"" + Environment.NewLine;
        }

        File.WriteAllText(envFile, content);
    }
}
