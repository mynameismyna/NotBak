using System.Diagnostics;
using System.Text;

namespace NotBak.Launcher;

/// <summary>
/// npm run build işlemini penceresiz çalıştırır; çıktıyı hem logs\build.log dosyasına
/// hem de GUI log paneline satır satır akıtır.
/// </summary>
internal static class BuildRunner
{
    public static async Task<bool> RunBuildAsync(
        string projectRoot,
        NodeEnvironment node,
        Action<string> log,
        CancellationToken ct)
    {
        var logsDir = Path.Combine(projectRoot, "logs");
        Directory.CreateDirectory(logsDir);
        var buildLogPath = Path.Combine(logsDir, "build.log");

        await using var writer = new StreamWriter(buildLogPath, append: false, Encoding.UTF8) { AutoFlush = true };
        var writeLock = new object();

        void Emit(string line)
        {
            lock (writeLock)
                writer.WriteLine(line);
            log(line);
        }

        Emit($"=== NotBak derleme başladı: {DateTime.Now:yyyy-MM-dd HH:mm:ss} ===");

        var psi = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = "/d /s /c \"npm run build\"",
            WorkingDirectory = projectRoot,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        psi.Environment["PATH"] = node.AugmentedPath(Environment.GetEnvironmentVariable("PATH") ?? "");
        // Pipe üzerinden okunduğu için renk kaçış kodlarını kapat (log dosyası temiz kalsın)
        psi.Environment["NO_COLOR"] = "1";
        psi.Environment["FORCE_COLOR"] = "0";

        using var p = new Process { StartInfo = psi };
        p.OutputDataReceived += (_, e) => { if (e.Data != null) Emit(e.Data); };
        p.ErrorDataReceived += (_, e) => { if (e.Data != null) Emit(e.Data); };

        try
        {
            if (!p.Start())
            {
                Emit("[HATA] Derleme süreci başlatılamadı.");
                return false;
            }
        }
        catch (Exception ex)
        {
            Emit($"[HATA] Derleme başlatılamadı: {ex.Message}");
            return false;
        }

        p.BeginOutputReadLine();
        p.BeginErrorReadLine();
        await p.WaitForExitAsync(ct);
        p.WaitForExit(); // yönlendirilen akışların tamamen boşalmasını garanti eder

        Emit($"=== Derleme bitti (çıkış kodu {p.ExitCode}): {DateTime.Now:HH:mm:ss} ===");
        return p.ExitCode == 0;
    }
}
