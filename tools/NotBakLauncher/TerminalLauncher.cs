using System.Diagnostics;

namespace NotBak.Launcher;

/// <summary>
/// Tüm konsol pencerelerinin başlığında "NotBak" geçer; diğer terminallerle karışmaz.
/// </summary>
internal static class TerminalLauncher
{
    private static readonly object TerminalLock = new();
    private static readonly List<int> TrackedTerminalPids = new();

    private const string MenuTitle = "NotBak - Ekip Gorev ve Not Yonetim Sistemi";
    private static readonly string[] TerminalProcessNames = ["cmd", "WindowsTerminal", "wt"];

    public static Process StartVisible(string windowTitle, string projectRoot, string commandLine, NodeEnvironment node)
    {
        var fullTitle = EnsureNotBakInTitle(windowTitle);
        var cmd = BuildCmdK(projectRoot, fullTitle, commandLine, node);
        var proc = Process.Start(new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = cmd,
            WorkingDirectory = projectRoot,
            UseShellExecute = true,
        })!;

        lock (TerminalLock)
        {
            PruneTracked();
            TrackedTerminalPids.Add(proc.Id);
        }

        return proc;
    }

    public static void StartHidden(string projectRoot, string arguments, NodeEnvironment node)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = arguments,
            WorkingDirectory = projectRoot,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };
        var path = node.AugmentedPath(Environment.GetEnvironmentVariable("PATH") ?? "");
        psi.Environment["PATH"] = path;
        Process.Start(psi);
    }

    public static Process StartHiddenProduction(string projectRoot, NodeEnvironment node)
    {
        var script = Path.Combine(projectRoot, "scripts", "run-production-hidden.bat");
        if (File.Exists(script))
        {
            StartHidden(projectRoot, $"/c \"\"{script}\"\"", node);
            return new Process();
        }

        var logsDir = Path.Combine(projectRoot, "logs");
        Directory.CreateDirectory(logsDir);
        var port = ProjectPaths.ReadPort(projectRoot);
        var logOut = Path.Combine(logsDir, "app.log");
        var logErr = Path.Combine(logsDir, "app_error.log");
        var inner = $"title NotBak - Canli (arka plan) & cd /d \"{projectRoot}\" & set PORT={port} & npm run start >> \"{logOut}\" 2>> \"{logErr}\"";
        StartHidden(projectRoot, $"/c \"{inner}\"", node);
        return new Process();
    }

    public static string BuildCmdK(string projectRoot, string windowTitle, string bodyCommands, NodeEnvironment node)
    {
        var path = node.AugmentedPath(Environment.GetEnvironmentVariable("PATH") ?? "");
        var escapedRoot = projectRoot.Replace("\"", "\"\"");
        return $"/k \"title {windowTitle} & cd /d \"{escapedRoot}\" & set PATH={path} & {bodyCommands}\"";
    }

    private static string EnsureNotBakInTitle(string title)
    {
        if (title.Contains("NotBak", StringComparison.OrdinalIgnoreCase))
            return title;
        return $"NotBak - {title}";
    }

    /// <summary>
    /// Test/Debug/Canlı vb. NotBak başlatıcı terminallerini kapatır; ana menü (NotBak.bat / GUI) açık kalır.
    /// </summary>
    public static int CloseApplicationTerminals(Action<string>? log = null)
    {
        var closedPids = new HashSet<int>();
        var closed = 0;

        closed += CloseTrackedTerminals(log, closedPids);
        closed += CloseByWindowTitle(log, closedPids);
        closed += CloseByCommandLine(log, closedPids);

        return closed;
    }

    private static int CloseTrackedTerminals(Action<string>? log, HashSet<int> closedPids)
    {
        var closed = 0;
        List<int> snapshot;
        lock (TerminalLock)
        {
            PruneTracked();
            snapshot = TrackedTerminalPids.ToList();
        }

        foreach (var pid in snapshot)
        {
            if (!closedPids.Add(pid))
                continue;
            if (TryKillTerminalProcess(pid, log))
                closed++;
        }

        lock (TerminalLock)
        {
            TrackedTerminalPids.RemoveAll(pid => closedPids.Contains(pid) || !IsProcessAlive(pid));
        }

        return closed;
    }

    private static int CloseByWindowTitle(Action<string>? log, HashSet<int> closedPids)
    {
        var closed = 0;

        foreach (var processName in TerminalProcessNames)
        {
            foreach (var proc in Process.GetProcessesByName(processName))
            {
                try
                {
                    if (proc.HasExited || !closedPids.Add(proc.Id))
                        continue;

                    proc.Refresh();
                    var title = proc.MainWindowTitle;
                    if (!IsNotBakApplicationTerminalTitle(title))
                        continue;

                    log?.Invoke($"      Terminal kapatılıyor: {title}");
                    proc.Kill(entireProcessTree: true);
                    closed++;
                }
                catch
                {
                    // Pencere kapanmış veya yetki yok
                }
                finally
                {
                    proc.Dispose();
                }
            }
        }

        return closed;
    }

    private static int CloseByCommandLine(Action<string>? log, HashSet<int> closedPids)
    {
        var closed = 0;
        try
        {
            const string script = """
                $menu = 'NotBak - Ekip Gorev ve Not Yonetim Sistemi'
                $names = @('cmd','WindowsTerminal','wt')
                foreach ($name in $names) {
                  Get-CimInstance Win32_Process -Filter "Name='$name.exe'" -ErrorAction SilentlyContinue |
                    Where-Object {
                      $_.CommandLine -and
                      $_.CommandLine -match 'title NotBak - ' -and
                      $_.CommandLine -notmatch [regex]::Escape($menu)
                    } |
                    ForEach-Object {
                      try {
                        Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
                        Write-Output $_.ProcessId
                      } catch {}
                    }
                }
                """;

            var escaped = script.Replace("\"", "`\"");
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"{escaped}\"",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var p = Process.Start(psi);
            if (p == null)
                return 0;

            while (p.StandardOutput.ReadLine() is { } line)
            {
                if (!int.TryParse(line.Trim(), out var pid) || !closedPids.Add(pid))
                    continue;
                log?.Invoke($"      Terminal kapatılıyor (PID {pid})");
                closed++;
            }

            p.WaitForExit(15000);
        }
        catch
        {
            // PowerShell yoksa veya yetki yoksa yoksay
        }

        return closed;
    }

    private static bool TryKillTerminalProcess(int pid, Action<string>? log)
    {
        try
        {
            using var proc = Process.GetProcessById(pid);
            if (proc.HasExited)
                return false;

            proc.Refresh();
            var title = proc.MainWindowTitle;
            if (!string.IsNullOrWhiteSpace(title))
                log?.Invoke($"      Terminal kapatılıyor: {title}");
            else
                log?.Invoke($"      Terminal kapatılıyor (PID {pid})");

            proc.Kill(entireProcessTree: true);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static bool IsNotBakApplicationTerminalTitle(string? title)
    {
        if (string.IsNullOrWhiteSpace(title))
            return false;
        if (!title.Contains("NotBak", StringComparison.OrdinalIgnoreCase))
            return false;
        if (title.Equals(MenuTitle, StringComparison.OrdinalIgnoreCase))
            return false;
        if (title.Contains("Baslatici", StringComparison.OrdinalIgnoreCase) ||
            title.Contains("Başlatıcı", StringComparison.OrdinalIgnoreCase) ||
            title.Contains("Launcher", StringComparison.OrdinalIgnoreCase))
            return false;
        return true;
    }

    private static void PruneTracked()
    {
        TrackedTerminalPids.RemoveAll(pid => !IsProcessAlive(pid));
    }

    private static bool IsProcessAlive(int pid)
    {
        try
        {
            using var proc = Process.GetProcessById(pid);
            return !proc.HasExited;
        }
        catch
        {
            return false;
        }
    }
}
