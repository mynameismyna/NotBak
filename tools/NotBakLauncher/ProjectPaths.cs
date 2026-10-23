namespace NotBak.Launcher;

internal static class ProjectPaths
{
    public static string FindProjectRoot()
    {
        var dir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        for (var i = 0; i < 6; i++)
        {
            if (File.Exists(Path.Combine(dir, "package.json")))
                return dir;
            var parent = Directory.GetParent(dir);
            if (parent == null)
                break;
            dir = parent.FullName;
        }

        throw new InvalidOperationException(
            "Proje kökü bulunamadı (package.json yok). NotBak-GUI.exe dosyasını NotBak proje klasörüne koyun.");
    }

    public static int ReadPort(string projectRoot)
    {
        var portFile = Path.Combine(projectRoot, "config", "port.txt");
        if (!File.Exists(portFile))
            return 3001;

        foreach (var line in File.ReadAllLines(portFile))
        {
            var trimmed = line.Trim();
            if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith('#'))
                continue;
            if (int.TryParse(trimmed, out var port) && port > 0 && port < 65536)
                return port;
        }

        return 3001;
    }

    public static void SavePort(string projectRoot, int port)
    {
        var configDir = Path.Combine(projectRoot, "config");
        Directory.CreateDirectory(configDir);
        File.WriteAllText(Path.Combine(configDir, "port.txt"), port.ToString());
    }
}
