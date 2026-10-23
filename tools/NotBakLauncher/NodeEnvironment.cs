namespace NotBak.Launcher;

internal sealed class NodeEnvironment
{
    public string? NodeExe { get; private set; }
    public string? NodeVersion { get; private set; }
    public string PathPrefix { get; private set; } = "";

    public bool IsReady => NodeExe != null;

    public string AugmentedPath(string basePath)
    {
        if (string.IsNullOrEmpty(PathPrefix))
            return basePath;
        return PathPrefix + basePath;
    }

    public void Detect()
    {
        NodeExe = null;
        NodeVersion = null;
        PathPrefix = "";

        var candidates = new List<string>();
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("PATH")))
        {
            foreach (var segment in Environment.GetEnvironmentVariable("PATH")!.Split(';'))
            {
                if (string.IsNullOrWhiteSpace(segment))
                    continue;
                var node = Path.Combine(segment.Trim(), "node.exe");
                if (File.Exists(node))
                    candidates.Add(node);
            }
        }

        foreach (var path in new[]
                 {
                     Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe"),
                     Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "nodejs", "node.exe"),
                     Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "nodejs", "node.exe"),
                 })
        {
            if (File.Exists(path) && !candidates.Contains(path, StringComparer.OrdinalIgnoreCase))
                candidates.Add(path);
        }

        foreach (var nodeExe in candidates)
        {
            if (!TryGetMajorVersion(nodeExe, out var major) || major < 20)
                continue;
            NodeExe = nodeExe;
            NodeVersion = RunVersion(nodeExe);
            var dir = Path.GetDirectoryName(nodeExe)!;
            PathPrefix = dir + ";";
            return;
        }
    }

    private static string RunVersion(string nodeExe)
    {
        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo(nodeExe, "-v")
            {
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var p = System.Diagnostics.Process.Start(psi);
            if (p == null)
                return "?";
            var output = p.StandardOutput.ReadToEnd().Trim();
            p.WaitForExit(5000);
            return output;
        }
        catch
        {
            return "?";
        }
    }

    private static bool TryGetMajorVersion(string nodeExe, out int major)
    {
        major = 0;
        try
        {
            var ver = RunVersion(nodeExe);
            var match = System.Text.RegularExpressions.Regex.Match(ver, @"v(\d+)");
            if (!match.Success)
                return false;
            major = int.Parse(match.Groups[1].Value);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
