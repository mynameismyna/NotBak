using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;

namespace NotBak.Launcher;

internal enum ServiceState
{
    NotInstalled,
    Stopped,
    StartPending,
    StopPending,
    Running,
    Unknown,
}

/// <summary>
/// NotBak production sunucusunu Windows servisi olarak yönetir (NSSM sarmalayıcısıyla).
/// Durum sorgulama yönetici yetkisi istemez; kur/başlat/durdur/kaldır işlemleri
/// tek seferlik UAC onayıyla yükseltilmiş gizli bir cmd betiği üzerinden yürür.
/// </summary>
internal static class ServiceManager
{
    public const string ServiceName = "NotBak";
    private const string FirewallRuleName = "NotBak Server";

    public static string GetNssmPath(string projectRoot) =>
        Path.Combine(projectRoot, "tools", "nssm", "nssm.exe");

    public static bool IsNssmAvailable(string projectRoot) => File.Exists(GetNssmPath(projectRoot));

    /// <summary>sc.exe query çıktısındaki sayısal STATE kodu ile durum okur (dil bağımsız, admin gerektirmez).</summary>
    public static ServiceState GetState()
    {
        try
        {
            var psi = new ProcessStartInfo("sc.exe", $"query {ServiceName}")
            {
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var p = Process.Start(psi);
            if (p == null)
                return ServiceState.Unknown;
            var output = p.StandardOutput.ReadToEnd();
            p.WaitForExit(5000);
            if (p.ExitCode == 1060) // ERROR_SERVICE_DOES_NOT_EXIST
                return ServiceState.NotInstalled;

            var m = Regex.Match(output, @"STATE\s*:\s*(\d+)");
            if (!m.Success)
                return ServiceState.Unknown;
            return m.Groups[1].Value switch
            {
                "1" => ServiceState.Stopped,
                "2" => ServiceState.StartPending,
                "3" => ServiceState.StopPending,
                "4" => ServiceState.Running,
                "5" => ServiceState.Running,     // CONTINUE_PENDING
                "6" => ServiceState.StopPending, // PAUSE_PENDING
                "7" => ServiceState.Stopped,     // PAUSED
                _ => ServiceState.Unknown,
            };
        }
        catch
        {
            return ServiceState.Unknown;
        }
    }

    public static string DescribeState(ServiceState state) => state switch
    {
        ServiceState.NotInstalled => "kurulu değil",
        ServiceState.Stopped => "durduruldu",
        ServiceState.StartPending => "başlatılıyor...",
        ServiceState.StopPending => "durduruluyor...",
        ServiceState.Running => "çalışıyor",
        _ => "bilinmiyor",
    };

    /// <summary>
    /// Servisi kurar (yoksa), tüm ayarlarını günceller (node yolu, port/bind, loglar,
    /// otomatik başlama, çökmede yeniden başlatma, güvenlik duvarı) ve yeniden başlatır.
    /// </summary>
    public static async Task<bool> InstallOrUpdateAndRestartAsync(
        string projectRoot,
        PublishConfig config,
        NodeEnvironment node,
        Action<string> log)
    {
        var nssm = GetNssmPath(projectRoot);
        if (!File.Exists(nssm))
        {
            log("[HATA] tools\\nssm\\nssm.exe bulunamadı; servis kurulamıyor.");
            return false;
        }
        if (node.NodeExe == null)
        {
            log("[HATA] node.exe bulunamadı; servis kurulamıyor.");
            return false;
        }

        var host = PublishSettings.GetBindHost(config.BindMode);
        var logsDir = Path.Combine(projectRoot, "logs");
        Directory.CreateDirectory(logsDir);

        var sb = new StringBuilder();
        sb.AppendLine("@echo off");
        sb.AppendLine($"set \"NSSM={nssm}\"");
        sb.AppendLine($"\"%NSSM%\" status {ServiceName} >nul 2>&1 || \"%NSSM%\" install {ServiceName} \"{node.NodeExe}\" \".next\\standalone\\server.js\"");
        sb.AppendLine("if errorlevel 1 exit /b 1");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} Application \"{node.NodeExe}\"");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} AppParameters \".next\\standalone\\server.js\"");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} AppDirectory \"{projectRoot}\"");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} DisplayName \"NotBak Sunucu\"");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} Description \"NotBak - Ekip Gorev ve Not Yonetim Sistemi (arka plan web sunucusu)\"");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} Start SERVICE_AUTO_START");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} AppEnvironmentExtra HOSTNAME={host} PORT={config.Port}");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} AppStdout \"{Path.Combine(logsDir, "app.log")}\"");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} AppStderr \"{Path.Combine(logsDir, "app_error.log")}\"");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} AppRotateFiles 1");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} AppRotateOnline 1");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} AppRotateBytes 10485760");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} AppExit Default Restart");
        sb.AppendLine($"\"%NSSM%\" set {ServiceName} AppThrottle 5000");
        sb.AppendLine($"netsh advfirewall firewall delete rule name=\"{FirewallRuleName}\" >nul 2>&1");
        if (config.BindMode == BindMode.Network)
            sb.AppendLine($"netsh advfirewall firewall add rule name=\"{FirewallRuleName}\" dir=in action=allow protocol=TCP localport={config.Port} >nul");
        sb.AppendLine($"\"%NSSM%\" stop {ServiceName} >nul 2>&1");
        // Servis dışında aynı portu tutan eski süreçleri (örn. eski bat sunucusu) temizle
        sb.AppendLine($"for /f \"tokens=5\" %%a in ('netstat -ano ^| findstr \":{config.Port} \" ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1");
        sb.AppendLine($"\"%NSSM%\" start {ServiceName}");
        sb.AppendLine("exit /b %errorlevel%");

        var exit = await RunElevatedScriptAsync(sb.ToString(), log);
        if (exit == null)
            return false; // UAC reddedildi veya süreç başlatılamadı

        // Çıkış kodu güvenilir değil (ör. atlanan nssm stop'un errorlevel'ı sızabilir);
        // asıl doğrulama servis durumu üzerinden yapılır.
        var state = await WaitForStateAsync(ServiceState.Running, TimeSpan.FromSeconds(25));
        if (state != ServiceState.Running)
        {
            log($"[HATA] Servis başlatılamadı (durum: {DescribeState(state)}). logs\\app_error.log dosyasına bakın.");
            return false;
        }

        log("[OK] NotBak servisi çalışıyor (otomatik başlama + çökmede yeniden başlatma etkin).");
        return true;
    }

    public static Task<bool> StartAsync(string projectRoot, Action<string> log) =>
        RunSimpleCommandAsync(projectRoot, log, $"start {ServiceName}", ServiceState.Running);

    public static Task<bool> StopAsync(string projectRoot, Action<string> log) =>
        RunSimpleCommandAsync(projectRoot, log, $"stop {ServiceName}", ServiceState.Stopped);

    public static Task<bool> RestartAsync(string projectRoot, Action<string> log) =>
        RunSimpleCommandAsync(projectRoot, log, $"restart {ServiceName}", ServiceState.Running);

    public static async Task<bool> RemoveAsync(string projectRoot, Action<string> log)
    {
        var nssm = GetNssmPath(projectRoot);
        var sb = new StringBuilder();
        sb.AppendLine("@echo off");
        if (File.Exists(nssm))
        {
            sb.AppendLine($"\"{nssm}\" stop {ServiceName} >nul 2>&1");
            sb.AppendLine($"\"{nssm}\" remove {ServiceName} confirm");
        }
        else
        {
            sb.AppendLine($"sc stop {ServiceName} >nul 2>&1");
            sb.AppendLine($"sc delete {ServiceName}");
        }
        sb.AppendLine("set ERR=%errorlevel%");
        sb.AppendLine($"netsh advfirewall firewall delete rule name=\"{FirewallRuleName}\" >nul 2>&1");
        sb.AppendLine("exit /b %ERR%");

        var exit = await RunElevatedScriptAsync(sb.ToString(), log);
        if (exit == null)
            return false;

        var state = await WaitForStateAsync(ServiceState.NotInstalled, TimeSpan.FromSeconds(10));
        return state == ServiceState.NotInstalled;
    }

    private static async Task<bool> RunSimpleCommandAsync(
        string projectRoot,
        Action<string> log,
        string nssmArgs,
        ServiceState desired)
    {
        var nssm = GetNssmPath(projectRoot);
        var sb = new StringBuilder();
        sb.AppendLine("@echo off");
        if (File.Exists(nssm))
            sb.AppendLine($"\"{nssm}\" {nssmArgs}");
        else
            sb.AppendLine($"sc {nssmArgs.Replace("restart", "start")}");
        sb.AppendLine("exit /b %errorlevel%");

        var exit = await RunElevatedScriptAsync(sb.ToString(), log);
        if (exit == null)
            return false;

        var state = await WaitForStateAsync(desired, TimeSpan.FromSeconds(25));
        return state == desired;
    }

    public static async Task<ServiceState> WaitForStateAsync(ServiceState desired, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        var state = await Task.Run(GetState);
        while (state != desired && DateTime.UtcNow < deadline)
        {
            await Task.Delay(500);
            state = await Task.Run(GetState);
        }
        return state;
    }

    /// <summary>
    /// Betiği geçici .cmd dosyasına yazıp UAC yükseltmesiyle gizli pencerede çalıştırır.
    /// null: UAC reddedildi veya süreç başlatılamadı; aksi halde exit code döner.
    /// </summary>
    private static async Task<int?> RunElevatedScriptAsync(string scriptBody, Action<string> log)
    {
        var tmp = Path.Combine(Path.GetTempPath(), $"notbak-service-{Guid.NewGuid():N}.cmd");
        await File.WriteAllTextAsync(tmp, scriptBody, Encoding.ASCII);
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/c \"\"{tmp}\"\"",
                UseShellExecute = true,
                Verb = "runas",
                WindowStyle = ProcessWindowStyle.Hidden,
            };
            log("Yönetici onayı bekleniyor (UAC)...");
            using var p = Process.Start(psi);
            if (p == null)
                return null;

            using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(3));
            try
            {
                await p.WaitForExitAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                log("[HATA] Servis işlemi zaman aşımına uğradı.");
                return null;
            }
            return p.ExitCode;
        }
        catch (System.ComponentModel.Win32Exception)
        {
            log("[IPTAL] Yönetici onayı verilmedi; işlem yapılmadı.");
            return null;
        }
        finally
        {
            try { File.Delete(tmp); } catch { /* geçici dosya */ }
        }
    }
}
