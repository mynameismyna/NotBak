using System.Text;

namespace NotBak.Launcher;

internal sealed class MainForm : Form
{
    private readonly string _projectRoot;
    private readonly NodeEnvironment _node = new();
    private readonly TextBox _log;
    private readonly Label _statusLabel;
    private RadioButton _rdbLocal = null!;
    private RadioButton _rdbNetwork = null!;
    private NumericUpDown _numPort = null!;
    private Label _lblUrls = null!;
    private bool _prerequisitesOk;

    private Label _lblServiceState = null!;
    private Label _lblHealth = null!;
    private Button _btnSvcStart = null!;
    private Button _btnSvcStop = null!;
    private Button _btnSvcRestart = null!;
    private Button _btnSvcRemove = null!;
    private ComboBox _cmbLogFile = null!;
    private CheckBox _chkTail = null!;
    private System.Windows.Forms.Timer _statusTimer = null!;
    private System.Windows.Forms.Timer _tailTimer = null!;
    private long _tailPos = -1;
    private string? _tailPath;
    private bool _statusRefreshBusy;
    private bool _actionBusy;
    // 1.8s çok kısaydı: DB yavaşlığı / digest / yeniden başlama anında yanlış "yanıt yok" yanıp sönüyordu.
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(5) };

    public MainForm(string projectRoot)
    {
        _projectRoot = projectRoot;
        Text = "NotBak - Başlatıcı";
        MinimumSize = new Size(600, 880);
        Size = new Size(620, 960);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 9.75f);
        BackColor = Color.FromArgb(250, 248, 245);

        var header = new Label
        {
            Text = "NotBak – Ekip Görev ve Not Yönetimi",
            Dock = DockStyle.Top,
            Height = 48,
            TextAlign = ContentAlignment.MiddleCenter,
            Font = new Font("Segoe UI", 11f, FontStyle.Bold),
            ForeColor = Color.FromArgb(55, 48, 107),
        };

        _statusLabel = new Label
        {
            Text = $"Proje: {_projectRoot}",
            Dock = DockStyle.Top,
            Height = 32,
            Padding = new Padding(12, 4, 12, 0),
            ForeColor = Color.FromArgb(80, 80, 90),
        };

        var publishPanel = BuildPublishPanel();
        publishPanel.Dock = DockStyle.Top;

        var servicePanel = BuildServicePanel();
        servicePanel.Dock = DockStyle.Top;

        var buttonPanel = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            Padding = new Padding(16, 4, 16, 8),
        };

        AddActionButton(buttonPanel, "1. Canlıya Geçiş", "Penceresiz derleme + Windows servisi olarak yayın", BtnProduction_Click);
        AddActionButton(buttonPanel, "2. Test Ortamı", "npm run dev (NotBak terminali)", BtnTest_Click);
        AddActionButton(buttonPanel, "3. Debug Ortamı", "npm run dev:debug", BtnDebug_Click);
        AddActionButton(buttonPanel, "4. Çalışan Uygulamayı Kapat", "Servisi durdur + port + terminalleri kapat", BtnStop_Click);
        AddActionButton(buttonPanel, "5. Yeniden Kurulum", "Kurulum verilerini sıfırla (3 onay)", BtnResetSetup_Click);
        AddActionButton(buttonPanel, "6. Bağımlılıkları Yeniden Yükle", "node_modules + .next sil", BtnReinstall_Click);

        var bottomPanel = new Panel { Dock = DockStyle.Bottom, Height = 40, Padding = new Padding(12, 6, 12, 6) };
        var btnRefresh = new Button
        {
            Text = "Gereksinimleri yenile",
            Dock = DockStyle.Left,
            AutoSize = true,
            FlatStyle = FlatStyle.Flat,
        };
        btnRefresh.Click += async (_, _) => await RunPrerequisitesAsync();
        var btnOpenFolder = new Button
        {
            Text = "Proje klasörünü aç",
            Dock = DockStyle.Right,
            AutoSize = true,
            FlatStyle = FlatStyle.Flat,
        };
        btnOpenFolder.Click += (_, _) =>
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(_projectRoot) { UseShellExecute = true });
        };
        bottomPanel.Controls.Add(btnOpenFolder);
        bottomPanel.Controls.Add(btnRefresh);

        _log = new TextBox
        {
            Dock = DockStyle.Fill,
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Vertical,
            BackColor = Color.FromArgb(32, 32, 36),
            ForeColor = Color.FromArgb(220, 220, 210),
            Font = new Font("Consolas", 9f),
            BorderStyle = BorderStyle.None,
        };

        var logHost = new Panel { Dock = DockStyle.Fill, Padding = new Padding(16, 0, 16, 12) };
        logHost.Controls.Add(_log);

        Controls.Add(logHost);
        Controls.Add(bottomPanel);
        Controls.Add(buttonPanel);
        Controls.Add(servicePanel);
        Controls.Add(publishPanel);
        Controls.Add(_statusLabel);
        Controls.Add(header);

        LoadPublishSettingsIntoUi();

        _statusTimer = new System.Windows.Forms.Timer { Interval = 4000 };
        _statusTimer.Tick += async (_, _) => await RefreshServiceStatusAsync();
        _statusTimer.Start();

        _tailTimer = new System.Windows.Forms.Timer { Interval = 1000 };
        _tailTimer.Tick += (_, _) => TailTick();

        Shown += async (_, _) =>
        {
            await RunPrerequisitesAsync();
            await RefreshServiceStatusAsync();
        };
    }

    private GroupBox BuildServicePanel()
    {
        var box = new GroupBox
        {
            Text = "Canlı Sunucu (Windows Servisi)",
            Padding = new Padding(12, 8, 12, 8),
            Height = 132,
            Margin = new Padding(12, 4, 12, 0),
        };

        _lblServiceState = new Label
        {
            Left = 16,
            Top = 24,
            Width = 280,
            Text = "Servis: kontrol ediliyor...",
            Font = new Font("Segoe UI", 9.75f, FontStyle.Bold),
        };
        _lblHealth = new Label
        {
            Left = 300,
            Top = 24,
            Width = 240,
            Text = "HTTP: —",
            ForeColor = Color.FromArgb(90, 90, 100),
        };

        _btnSvcStart = MakeSmallButton("Başlat", 16, 52, 86);
        _btnSvcStop = MakeSmallButton("Durdur", 108, 52, 86);
        _btnSvcRestart = MakeSmallButton("Yeniden Başlat", 200, 52, 118);
        _btnSvcRemove = MakeSmallButton("Servisi Kaldır", 324, 52, 110);
        _btnSvcStart.Click += async (_, _) => await RunServiceActionAsync(() => ServiceManager.StartAsync(_projectRoot, Log), "Servis başlatılıyor...");
        _btnSvcStop.Click += async (_, _) => await RunServiceActionAsync(() => ServiceManager.StopAsync(_projectRoot, Log), "Servis durduruluyor...");
        _btnSvcRestart.Click += async (_, _) => await RunServiceActionAsync(() => ServiceManager.RestartAsync(_projectRoot, Log), "Servis yeniden başlatılıyor...");
        _btnSvcRemove.Click += async (_, _) =>
        {
            if (MessageBox.Show(
                    "NotBak servisi kaldırılacak (uygulama dosyalarına dokunulmaz).\nDevam?",
                    "NotBak",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question) != DialogResult.Yes)
                return;
            await RunServiceActionAsync(() => ServiceManager.RemoveAsync(_projectRoot, Log), "Servis kaldırılıyor...");
        };

        var lblLog = new Label { Text = "Log:", Left = 16, Top = 94, AutoSize = true };
        _cmbLogFile = new ComboBox
        {
            Left = 56,
            Top = 90,
            Width = 150,
            DropDownStyle = ComboBoxStyle.DropDownList,
        };
        _cmbLogFile.Items.AddRange(new object[] { "app.log", "app_error.log", "build.log" });
        _cmbLogFile.SelectedIndex = 0;
        _cmbLogFile.SelectedIndexChanged += (_, _) => ResetTail();

        _chkTail = new CheckBox { Text = "Canlı izle", Left = 220, Top = 92, AutoSize = true };
        _chkTail.CheckedChanged += (_, _) =>
        {
            if (_chkTail.Checked)
            {
                ResetTail();
                _tailTimer.Start();
                Log($"[Log] {SelectedLogName()} canlı izleniyor.");
            }
            else
            {
                _tailTimer.Stop();
            }
        };

        var btnOpenLog = MakeSmallButton("Dosyayı aç", 324, 88, 110);
        btnOpenLog.Click += (_, _) =>
        {
            var path = SelectedLogPath();
            if (File.Exists(path))
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(path) { UseShellExecute = true });
            else
                Log($"[Log] {SelectedLogName()} henüz oluşmamış.");
        };

        box.Controls.AddRange(new Control[]
        {
            _lblServiceState, _lblHealth,
            _btnSvcStart, _btnSvcStop, _btnSvcRestart, _btnSvcRemove,
            lblLog, _cmbLogFile, _chkTail, btnOpenLog,
        });
        return box;
    }

    private static Button MakeSmallButton(string text, int left, int top, int width) => new()
    {
        Text = text,
        Left = left,
        Top = top,
        Width = width,
        Height = 28,
        FlatStyle = FlatStyle.Flat,
    };

    private string SelectedLogName() => _cmbLogFile.SelectedItem?.ToString() ?? "app.log";

    private string SelectedLogPath() => Path.Combine(_projectRoot, "logs", SelectedLogName());

    private async Task RunServiceActionAsync(Func<Task<bool>> action, string message)
    {
        if (_actionBusy)
            return;
        _actionBusy = true;
        try
        {
            Log(message);
            var ok = await action();
            Log(ok ? "[OK] Servis işlemi tamamlandı." : "[UYARI] Servis işlemi beklenen duruma ulaşmadı.");
        }
        finally
        {
            _actionBusy = false;
            await RefreshServiceStatusAsync();
        }
    }

    private async Task RefreshServiceStatusAsync()
    {
        if (_statusRefreshBusy || IsDisposed)
            return;
        _statusRefreshBusy = true;
        try
        {
            var state = await Task.Run(ServiceManager.GetState);
            var port = (int)_numPort.Value;

            string health = "HTTP: —";
            var healthColor = Color.FromArgb(90, 90, 100);
            if (state == ServiceState.Running)
            {
                try
                {
                    // / yerine /login: dashboard redirect + oturum/DB yükü yok; yanlış "yanıt yok" azalır.
                    using var resp = await Http.GetAsync($"http://localhost:{port}/login");
                    health = $"HTTP {(int)resp.StatusCode} – yayında (port {port})";
                    healthColor = Color.FromArgb(30, 130, 60);
                }
                catch
                {
                    health = $"HTTP: yanıt yok (port {port})";
                    healthColor = Color.FromArgb(180, 60, 50);
                }
            }

            if (IsDisposed)
                return;
            _lblServiceState.Text = $"Servis: {ServiceManager.DescribeState(state)}";
            _lblServiceState.ForeColor = state switch
            {
                ServiceState.Running => Color.FromArgb(30, 130, 60),
                ServiceState.Stopped => Color.FromArgb(180, 60, 50),
                ServiceState.NotInstalled => Color.FromArgb(90, 90, 100),
                _ => Color.FromArgb(180, 130, 40),
            };
            _lblHealth.Text = health;
            _lblHealth.ForeColor = healthColor;

            var busyOrPending = _actionBusy || state is ServiceState.StartPending or ServiceState.StopPending or ServiceState.Unknown;
            _btnSvcStart.Enabled = !busyOrPending && state == ServiceState.Stopped;
            _btnSvcStop.Enabled = !busyOrPending && state == ServiceState.Running;
            _btnSvcRestart.Enabled = !busyOrPending && state == ServiceState.Running;
            _btnSvcRemove.Enabled = !busyOrPending && state is ServiceState.Running or ServiceState.Stopped;
        }
        finally
        {
            _statusRefreshBusy = false;
        }
    }

    private void ResetTail()
    {
        _tailPath = SelectedLogPath();
        _tailPos = -1;
    }

    private void TailTick()
    {
        try
        {
            var path = _tailPath ?? SelectedLogPath();
            if (!File.Exists(path))
                return;

            using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            if (_tailPos < 0 || _tailPos > fs.Length)
                _tailPos = Math.Max(0, fs.Length - 4096); // ilk açılışta/rotasyonda son ~4 KB göster

            if (fs.Length == _tailPos)
                return;

            fs.Seek(_tailPos, SeekOrigin.Begin);
            using var reader = new StreamReader(fs, Encoding.UTF8);
            var chunk = reader.ReadToEnd();
            _tailPos = fs.Length;

            var name = Path.GetFileName(path);
            foreach (var line in chunk.Split('\n'))
            {
                var trimmed = line.TrimEnd('\r');
                if (trimmed.Length > 0)
                    AppendLog($"[{name}] {trimmed}");
            }
        }
        catch
        {
            // dosya kilitli olabilir; bir sonraki tikte tekrar dene
        }
    }

    private GroupBox BuildPublishPanel()
    {
        var box = new GroupBox
        {
            Text = "Yayın ayarları",
            Padding = new Padding(12, 8, 12, 8),
            Height = 168,
            Margin = new Padding(12, 4, 12, 0),
        };

        _rdbLocal = new RadioButton
        {
            Text = "Yerel (yalnızca bu bilgisayar – 127.0.0.1)",
            Left = 16,
            Top = 24,
            AutoSize = true,
            Checked = true,
        };
        _rdbNetwork = new RadioButton
        {
            Text = "Ağ (LAN – diğer cihazlar erişebilir – 0.0.0.0)",
            Left = 16,
            Top = 48,
            AutoSize = true,
        };
        _rdbLocal.CheckedChanged += (_, _) => RefreshUrlPreview();
        _rdbNetwork.CheckedChanged += (_, _) => RefreshUrlPreview();

        var lblPort = new Label { Text = "Port:", Left = 16, Top = 82, AutoSize = true };
        _numPort = new NumericUpDown
        {
            Left = 56,
            Top = 78,
            Width = 72,
            Minimum = 1,
            Maximum = 65535,
            Value = 3001,
        };
        _numPort.ValueChanged += (_, _) => RefreshUrlPreview();

        var btnAutoPort = new Button
        {
            Text = "Boş port bul",
            Left = 140,
            Top = 76,
            Width = 100,
            FlatStyle = FlatStyle.Flat,
        };
        btnAutoPort.Click += BtnAutoPort_Click;

        var btnSave = new Button
        {
            Text = "Kaydet",
            Left = 250,
            Top = 76,
            Width = 72,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(88, 72, 140),
            ForeColor = Color.White,
        };
        btnSave.FlatAppearance.BorderSize = 0;
        btnSave.Click += BtnSavePublish_Click;

        var btnOpenBrowser = new Button
        {
            Text = "Tarayıcıda aç",
            Left = 330,
            Top = 76,
            Width = 110,
            FlatStyle = FlatStyle.Flat,
        };
        btnOpenBrowser.Click += BtnOpenBrowser_Click;

        _lblUrls = new Label
        {
            Left = 16,
            Top = 112,
            Width = 520,
            Height = 44,
            ForeColor = Color.FromArgb(60, 60, 75),
            Text = "",
        };

        box.Controls.AddRange(new Control[]
        {
            _rdbLocal, _rdbNetwork, lblPort, _numPort, btnAutoPort, btnSave, btnOpenBrowser, _lblUrls,
        });

        return box;
    }

    private void LoadPublishSettingsIntoUi()
    {
        var cfg = PublishSettings.Load(_projectRoot);
        _numPort.Value = Math.Clamp(cfg.Port, (int)_numPort.Minimum, (int)_numPort.Maximum);
        if (cfg.BindMode == BindMode.Network)
            _rdbNetwork.Checked = true;
        else
            _rdbLocal.Checked = true;
        RefreshUrlPreview();
    }

    private PublishConfig ReadConfigFromUi()
    {
        return new PublishConfig
        {
            BindMode = _rdbNetwork.Checked ? BindMode.Network : BindMode.Local,
            Port = (int)_numPort.Value,
        };
    }

    private void RefreshUrlPreview()
    {
        var cfg = ReadConfigFromUi();
        var inUse = PublishSettings.IsPortInUse(cfg.Port);
        var portNote = inUse ? " (port şu an kullanımda!)" : "";
        var lines = PublishSettings.GetAccessUrls(cfg);
        _lblUrls.Text = "Adresler: " + string.Join("   ", lines) + portNote;
    }

    private void BtnAutoPort_Click(object? sender, EventArgs e)
    {
        try
        {
            var start = (int)_numPort.Value;
            if (PublishSettings.IsPortInUse(start))
                start = 3001;
            var free = PublishSettings.FindFreePort(start);
            _numPort.Value = Math.Clamp(free, (int)_numPort.Minimum, (int)_numPort.Maximum);
            Log($"Boş port bulundu: {free}");
            RefreshUrlPreview();
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "NotBak", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }

    private void BtnSavePublish_Click(object? sender, EventArgs e)
    {
        var cfg = ReadConfigFromUi();
        PublishSettings.Save(_projectRoot, cfg);
        Log($"Yayın ayarları kaydedildi ({(cfg.BindMode == BindMode.Network ? "Ağ" : "Yerel")}, port {cfg.Port}).");
        if (cfg.BindMode == BindMode.Network)
            Log("  .env içindeki APP_URL güncellendi (varsa).");
        RefreshUrlPreview();
    }

    private void BtnOpenBrowser_Click(object? sender, EventArgs e)
    {
        var url = PublishSettings.GetPrimaryUrl(ReadConfigFromUi());
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Tarayıcı açılamadı: {ex.Message}", "NotBak", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }

    private void AddActionButton(FlowLayoutPanel panel, string title, string hint, EventHandler click)
    {
        var row = new Panel { Width = 520, Height = 52, Margin = new Padding(0, 0, 0, 6) };
        var btn = new Button
        {
            Text = title,
            Width = 220,
            Height = 44,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(88, 72, 140),
            ForeColor = Color.White,
            TextAlign = ContentAlignment.MiddleLeft,
            Padding = new Padding(10, 0, 0, 0),
            Cursor = Cursors.Hand,
        };
        btn.FlatAppearance.BorderSize = 0;
        btn.Click += click;
        var lbl = new Label
        {
            Text = hint,
            Left = 228,
            Top = 12,
            AutoSize = true,
            ForeColor = Color.FromArgb(90, 90, 100),
        };
        row.Controls.Add(lbl);
        row.Controls.Add(btn);
        panel.Controls.Add(row);
    }

    private void Log(string message)
    {
        var line = $"[{DateTime.Now:HH:mm:ss}] {message}";
        if (_log.InvokeRequired)
        {
            _log.Invoke(() => AppendLog(line));
            return;
        }
        AppendLog(line);
    }

    private void AppendLog(string line)
    {
        _log.AppendText(line + Environment.NewLine);
    }

    private async Task RunPrerequisitesAsync()
    {
        Log("--- Gereksinim kontrolü ---");
        _prerequisitesOk = await ProjectActions.EnsurePrerequisitesAsync(_projectRoot, _node, Log, CancellationToken.None);
        _statusLabel.Text = _prerequisitesOk
            ? $"Proje: {_projectRoot}  |  Hazır"
            : $"Proje: {_projectRoot}  |  Eksik gereksinim var";
        RefreshUrlPreview();
    }

    private bool GuardReady()
    {
        if (_prerequisitesOk)
            return true;
        var r = MessageBox.Show(
            "Gereksinimler tamamlanmamış görünüyor. Yine de devam edilsin mi?",
            "NotBak",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Warning);
        return r == DialogResult.Yes;
    }

    private PublishConfig PrepareConfigForRun(bool skipBusyPortPrompt = false)
    {
        var cfg = ReadConfigFromUi();
        if (!skipBusyPortPrompt && PublishSettings.IsPortInUse(cfg.Port))
        {
            var ans = MessageBox.Show(
                $"Port {cfg.Port} şu an kullanımda.\n\nBoş bir port otomatik seçilsin mi?",
                "NotBak",
                MessageBoxButtons.YesNoCancel,
                MessageBoxIcon.Question);
            if (ans == DialogResult.Cancel)
                throw new OperationCanceledException();
            if (ans == DialogResult.Yes)
            {
                cfg.Port = PublishSettings.FindFreePort();
                _numPort.Value = cfg.Port;
                Log($"Otomatik port atandı: {cfg.Port}");
            }
        }

        PublishSettings.Save(_projectRoot, cfg);
        RefreshUrlPreview();
        return cfg;
    }

    private async void BtnProduction_Click(object? sender, EventArgs e)
    {
        if (!GuardReady()) return;
        if (_actionBusy)
        {
            Log("[BILGI] Devam eden bir işlem var; bitmesini bekleyin.");
            return;
        }
        try
        {
            // Servis zaten çalışıyorsa portu bizim sunucu tutuyordur; "port dolu" sorusunu atla.
            var serviceActive = ServiceManager.GetState() is ServiceState.Running or ServiceState.StartPending;
            var cfg = PrepareConfigForRun(skipBusyPortPrompt: serviceActive);

            _actionBusy = true;
            Log("--- Canlıya Geçiş (Windows servisi) ---");
            await ProjectActions.RunProductionServiceAsync(_projectRoot, cfg, _node, Log, CancellationToken.None);
        }
        catch (OperationCanceledException)
        {
            // user cancelled
        }
        finally
        {
            _actionBusy = false;
            await RefreshServiceStatusAsync();
        }
    }

    private void BtnTest_Click(object? sender, EventArgs e)
    {
        if (!GuardReady()) return;
        try
        {
            ProjectActions.RunTest(_projectRoot, PrepareConfigForRun(), _node, Log);
        }
        catch (OperationCanceledException)
        {
            // cancelled
        }
    }

    private void BtnDebug_Click(object? sender, EventArgs e)
    {
        if (!GuardReady()) return;
        try
        {
            ProjectActions.RunDebug(_projectRoot, PrepareConfigForRun(), _node, Log);
        }
        catch (OperationCanceledException)
        {
            // cancelled
        }
    }

    private async void BtnStop_Click(object? sender, EventArgs e)
    {
        if (_actionBusy)
        {
            Log("[BILGI] Devam eden bir işlem var; bitmesini bekleyin.");
            return;
        }
        _actionBusy = true;
        try
        {
            await ProjectActions.StopApplicationsAsync(_projectRoot, ReadConfigFromUi(), Log);
        }
        finally
        {
            _actionBusy = false;
            await RefreshServiceStatusAsync();
        }
    }

    private void BtnResetSetup_Click(object? sender, EventArgs e)
    {
        if (MessageBox.Show(
                "Yeniden kurulum yapılacak. Kurulum verileri silinecek.\n\n1. onay – Devam?",
                "NotBak - Yeniden Kurulum",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning) != DialogResult.Yes)
            return;
        if (MessageBox.Show("2. onay – Emin misiniz?", "NotBak", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes)
            return;
        if (MessageBox.Show("3. onay – Son kez onaylıyor musunuz?", "NotBak", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes)
            return;

        var start = MessageBox.Show(
            "Kurulum sayfasını açmak için geliştirme sunucusu başlatılsın mı?",
            "NotBak",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question) == DialogResult.Yes;

        Log("--- Yeniden kurulum ---");
        try
        {
            ProjectActions.ResetSetup(_projectRoot, PrepareConfigForRun(), start, _node, Log);
        }
        catch (OperationCanceledException)
        {
            // cancelled
        }
    }

    private void BtnReinstall_Click(object? sender, EventArgs e)
    {
        if (!GuardReady()) return;
        if (MessageBox.Show(
                "node_modules ve .next silinecek, ardından npm install çalışacak.\nDevam?",
                "NotBak",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question) != DialogResult.Yes)
            return;
        ProjectActions.ReinstallDependencies(_projectRoot, _node, Log);
    }
}
