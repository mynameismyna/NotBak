namespace NotBak.Launcher;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.SetHighDpiMode(HighDpiMode.SystemAware);

        string projectRoot;
        try
        {
            projectRoot = ProjectPaths.FindProjectRoot();
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "NotBak Başlatıcı", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        Application.Run(new MainForm(projectRoot));
    }
}
