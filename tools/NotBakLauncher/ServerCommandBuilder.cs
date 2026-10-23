namespace NotBak.Launcher;

/// <summary>
/// Yayin komutlari scripts\*.bat uzerinden calisir; CMD icinde %HOSTNAME% genislemesi sorunu olmaz.
/// </summary>
internal static class ServerCommandBuilder
{
    public static string DevCommand() => "call scripts\\notbak-dev.bat";

    public static string DevDebugCommand() => "call scripts\\notbak-dev-debug.bat";

    public static string SetupDevCommand() => "call scripts\\notbak-setup-dev.bat";

    public static string ProductionBuildAndStart() => "call scripts\\notbak-go-live.bat";
}
