using System.Diagnostics;
using System.Text.RegularExpressions;

namespace NotBak.Launcher;

internal static class ProjectActions
{
    public static async Task<bool> EnsurePrerequisitesAsync(
        string projectRoot,
        NodeEnvironment node,
        Action<string> log,
        CancellationToken ct)
    {
        node.Detect();
        if (!node.IsReady)
        {
            log("[HATA] Node.js 20+ bulunamadı. https://nodejs.org adresinden kurun veya NotBak.bat ile otomatik kurulumu deneyin.");
            return false;
        }

        log($"[OK] Node.js {node.NodeVersion}");

        var npm = FindOnPath("npm.cmd", node) ?? FindOnPath("npm", node);
        if (npm == null)
        {
            log("[HATA] npm bulunamadı.");
            return false;
        }

        log("[OK] npm yüklü");

        var nodeModules = Path.Combine(projectRoot, "node_modules");
        if (!Directory.Exists(nodeModules))
        {
            log("[BILGI] node_modules yok; npm install başlatılıyor...");
            var ok = await RunNpmInTerminalAsync(projectRoot, "install", "NotBak - npm install", node, log, ct);
            if (!ok)
                return false;
            log("[OK] Bağımlılıklar yüklendi.");
        }
        else
        {
            log("[OK] node_modules mevcut");
        }

        var envFile = Path.Combine(projectRoot, ".env");
        if (!File.Exists(envFile))
        {
            var example = Path.Combine(projectRoot, ".env.example");
            if (File.Exists(example))
            {
                File.Copy(example, envFile);
                log("[BILGI] .env dosyası .env.example'dan oluşturuldu.");
            }
            else
            {
                log("[UYARI] .env.example bulunamadı.");
            }
        }
        else
        {
            log("[OK] .env mevcut");
        }

        return true;
    }

    public static void RunTest(string projectRoot, PublishConfig config, NodeEnvironment node, Action<string> log)
    {
        PublishSettings.Save(projectRoot, config);
        TerminalLauncher.StartVisible(
            "NotBak - Test Ortamı",
            projectRoot,
            ServerCommandBuilder.DevCommand(),
            node);
        LogUrls(config, log, "Test terminali");
    }

    public static void RunDebug(string projectRoot, PublishConfig config, NodeEnvironment node, Action<string> log)
    {
        PublishSettings.Save(projectRoot, config);
        TerminalLauncher.StartVisible(
            "NotBak - Debug Ortamı",
            projectRoot,
            ServerCommandBuilder.DevDebugCommand(),
            node);
        LogUrls(config, log, "Debug terminali");
    }

    /// <summary>
    /// Canlıya geçiş: penceresiz build (log akışlı) + standalone dosya kopyaları +
    /// NotBak Windows servisinin kurulumu/yeniden başlatılması.
    /// </summary>
    public static async Task<bool> RunProductionServiceAsync(
        string projectRoot,
        PublishConfig config,
        NodeEnvironment node,
        Action<string> log,
        CancellationToken ct)
    {
        PublishSettings.Save(projectRoot, config);
        log("[BILGI] Yayın ayarları kaydedildi. Derleme arka planda başlıyor (çıktı: logs\\build.log)...");

        var ok = await BuildRunner.RunBuildAsync(projectRoot, node, log, ct);
        if (!ok)
        {
            log("[HATA] Derleme başarısız; servis güncellenmedi. Ayrıntılar: logs\\build.log");
            return false;
        }

        var serverJs = Path.Combine(projectRoot, ".next", "standalone", "server.js");
        if (!File.Exists(serverJs))
        {
            log("[HATA] .next\\standalone\\server.js bulunamadı (next.config.mjs içinde output: \"standalone\" olmalı).");
            return false;
        }

        CopyStandaloneAssets(projectRoot, log);

        var started = await ServiceManager.InstallOrUpdateAndRestartAsync(projectRoot, config, node, log);
        if (!started)
            return false;

        LogUrls(config, log, "Canlı yayın (Windows servisi)");
        log("[BILGI] Sunucu penceresizdir; oturum kapansa ve Windows yeniden başlasa da çalışır. Log: logs\\app.log");
        return true;
    }

    /// <summary>Standalone sunucunun ihtiyaç duyduğu public/.next\static/config kopyaları (eski bat ile birebir).</summary>
    private static void CopyStandaloneAssets(string projectRoot, Action<string> log)
    {
        var standalone = Path.Combine(projectRoot, ".next", "standalone");
        try
        {
            CopyDirectory(Path.Combine(projectRoot, "public"), Path.Combine(standalone, "public"));
            CopyDirectory(Path.Combine(projectRoot, ".next", "static"), Path.Combine(standalone, ".next", "static"));
            CopyDirectory(Path.Combine(projectRoot, "config"), Path.Combine(standalone, "config"));
            log("[OK] Standalone dosyaları kopyalandı (public, static, config).");
        }
        catch (Exception ex)
        {
            log($"[UYARI] Standalone kopyalama sorunu: {ex.Message}");
        }
    }

    private static void CopyDirectory(string source, string target)
    {
        if (!Directory.Exists(source))
            return;
        Directory.CreateDirectory(target);
        foreach (var dir in Directory.GetDirectories(source, "*", SearchOption.AllDirectories))
            Directory.CreateDirectory(Path.Combine(target, Path.GetRelativePath(source, dir)));
        foreach (var file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
            File.Copy(file, Path.Combine(target, Path.GetRelativePath(source, file)), overwrite: true);
    }

    public static async Task StopApplicationsAsync(string projectRoot, PublishConfig config, Action<string> log)
    {
        var state = ServiceManager.GetState();
        if (state is ServiceState.Running or ServiceState.StartPending)
        {
            log("[Kapat] NotBak servisi durduruluyor...");
            var stopped = await ServiceManager.StopAsync(projectRoot, log);
            log(stopped ? "[OK] Servis durduruldu." : "[UYARI] Servis durdurulamadı; port üzerinden kapatma denenecek.");
        }
        else if (state == ServiceState.Stopped)
        {
            log("[Kapat] NotBak servisi zaten durdurulmuş.");
        }

        log($"[Kapat] Port {config.Port} dinleyen işlemler aranıyor...");
        var killed = KillProcessesOnPort(config.Port);
        if (killed == 0)
            log($"Port {config.Port}'de çalışan uygulama bulunamadı.");
        else
            log($"[OK] {killed} işlem sonlandırıldı.");

        log("[Kapat] NotBak terminal pencereleri kapatılıyor...");
        var terminalsClosed = TerminalLauncher.CloseApplicationTerminals(log);
        if (terminalsClosed == 0)
            log("Açık NotBak terminali bulunamadı.");
        else
            log($"[OK] {terminalsClosed} terminal penceresi kapatıldı.");
    }

    public static void ResetSetup(
        string projectRoot,
        PublishConfig config,
        bool startDev,
        NodeEnvironment node,
        Action<string> log)
    {
        var setupJson = Path.Combine(projectRoot, "config", "setup.json");
        if (File.Exists(setupJson))
        {
            File.Delete(setupJson);
            log("  - config/setup.json silindi");
        }

        var envFile = Path.Combine(projectRoot, ".env");
        if (File.Exists(envFile))
        {
            var content = File.ReadAllText(envFile);
            content = Regex.Replace(content, @"SETUP_COMPLETE\s*=\s*""?true""?", "SETUP_COMPLETE=false", RegexOptions.IgnoreCase);
            File.WriteAllText(envFile, content);
            log("  - .env içinde SETUP_COMPLETE=false yapıldı");
        }

        var nextDir = Path.Combine(projectRoot, ".next");
        if (Directory.Exists(nextDir))
        {
            try
            {
                Directory.Delete(nextDir, true);
                log("  - .next klasörü silindi");
            }
            catch (Exception ex)
            {
                log($"  - .next silinemedi: {ex.Message}");
            }
        }

        PublishSettings.Save(projectRoot, config);
        log($"[OK] Yayın ayarları kaydedildi (port {config.Port}, {config.BindMode}).");

        if (startDev)
        {
            TerminalLauncher.StartVisible(
                "NotBak - Kurulum",
                projectRoot,
                ServerCommandBuilder.SetupDevCommand(),
                node);
            log("Kurulum terminali açıldı.");
            var url = $"{PublishSettings.GetPrimaryUrl(config)}/setup";
            Task.Delay(5000).ContinueWith(_ =>
            {
                try
                {
                    Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                }
                catch
                {
                    // ignore
                }
            });
        }
    }

    public static void ReinstallDependencies(string projectRoot, NodeEnvironment node, Action<string> log)
    {
        log("[BILGI] node_modules ve .next siliniyor; npm install terminali açılıyor...");
        var nm = Path.Combine(projectRoot, "node_modules");
        var next = Path.Combine(projectRoot, ".next");
        TryDelete(nm);
        TryDelete(next);
        TerminalLauncher.StartVisible(
            "NotBak - Bağımlılıkları Yeniden Yükle",
            projectRoot,
            "call npm install & echo. & echo [Bitti] Pencereyi kapatabilirsiniz. & pause",
            node);
    }

    private static void LogUrls(PublishConfig config, Action<string> log, string prefix)
    {
        var mode = config.BindMode == BindMode.Network ? "Ağ (LAN)" : "Yerel";
        log($"[OK] {prefix} – {mode}, port {config.Port}");
        foreach (var url in PublishSettings.GetAccessUrls(config))
            log($"     → {url}");
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path))
                File.Delete(path);
            else if (Directory.Exists(path))
                Directory.Delete(path, true);
        }
        catch
        {
            // ignore
        }
    }

    private static int KillProcessesOnPort(int port)
    {
        var killed = 0;
        var seen = new HashSet<int>();
        try
        {
            var psi = new ProcessStartInfo("netstat", "-ano")
            {
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var p = Process.Start(psi);
            if (p == null)
                return 0;
            var output = p.StandardOutput.ReadToEnd();
            p.WaitForExit(10000);
            var needle = $":{port} ";
            foreach (var line in output.Split('\n'))
            {
                if (!line.Contains(needle, StringComparison.Ordinal) || !line.Contains("LISTENING", StringComparison.OrdinalIgnoreCase))
                    continue;
                var parts = line.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length < 5)
                    continue;
                if (!int.TryParse(parts[^1], out var pid) || pid <= 0 || !seen.Add(pid))
                    continue;
                try
                {
                    var proc = Process.GetProcessById(pid);
                    proc.Kill(true);
                    killed++;
                }
                catch
                {
                    // ignore
                }
            }
        }
        catch
        {
            // ignore
        }

        return killed;
    }

    private static string? FindOnPath(string name, NodeEnvironment node)
    {
        var path = node.AugmentedPath(Environment.GetEnvironmentVariable("PATH") ?? "");
        foreach (var segment in path.Split(';'))
        {
            if (string.IsNullOrWhiteSpace(segment))
                continue;
            var full = Path.Combine(segment.Trim(), name);
            if (File.Exists(full))
                return full;
        }
        return null;
    }

    private static Task<bool> RunNpmInTerminalAsync(
        string projectRoot,
        string npmArgs,
        string title,
        NodeEnvironment node,
        Action<string> log,
        CancellationToken ct)
    {
        TerminalLauncher.StartVisible(title, projectRoot, $"call npm {npmArgs}", node);
        log("npm install terminalinde tamamlanmasını bekleyin, ardından işlemi tekrar deneyin.");
        return Task.FromResult(false);
    }
}
