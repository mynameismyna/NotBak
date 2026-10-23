namespace NotBak.Launcher;

internal static class PromptDialog
{
    public static string Show(string message, string title, string defaultValue = "")
    {
        using var form = new Form
        {
            Text = title,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            StartPosition = FormStartPosition.CenterParent,
            MinimizeBox = false,
            MaximizeBox = false,
            ClientSize = new Size(360, 120),
        };
        var label = new Label { Left = 12, Top = 12, Width = 336, Text = message };
        var textBox = new TextBox { Left = 12, Top = 36, Width = 336, Text = defaultValue };
        var ok = new Button { Text = "Tamam", Left = 184, Width = 80, Top = 72, DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "İptal", Left = 268, Width = 80, Top = 72, DialogResult = DialogResult.Cancel };
        form.Controls.AddRange(new Control[] { label, textBox, ok, cancel });
        form.AcceptButton = ok;
        form.CancelButton = cancel;
        return form.ShowDialog() == DialogResult.OK ? textBox.Text : defaultValue;
    }
}
