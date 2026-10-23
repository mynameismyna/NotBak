"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSelect } from "@/components/AppSelect";

interface FolderInfo {
  path: string;
  name: string;
  messages: number;
  unseen?: number;
}

export default function ImapSettingsPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    host: "",
    port: 993,
    secure: true,
    user: "",
    password: "",
    folder: "INBOX",
    pollInterval: 5,
    rejectUnauthorized: true,
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [debugSteps, setDebugSteps] = useState<{ step: string; status: "ok" | "fail"; message: string; detail?: string }[] | null>(null);
  const [debugOpen, setDebugOpen] = useState(true);
  const [pollResult, setPollResult] = useState<{ processed: number; matched: number; unknown: number; skipped: number; errors: string[] } | null>(null);
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [connectionTested, setConnectionTested] = useState(false);
  const [hasSavedConfig, setHasSavedConfig] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => { if (!data.canAccessSettings) router.replace("/dashboard"); })
      .catch(() => router.replace("/dashboard"));
  }, [router]);

  useEffect(() => {
    fetch("/api/settings/imap")
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          setFormData((prev) => ({
            ...prev,
            host: data.config.host || "",
            port: typeof data.config.port === "number" ? data.config.port : 993,
            secure: data.config.secure !== false,
            user: data.config.user || "",
            password: data.config.password || "",
            folder: data.config.folder || "INBOX",
            pollInterval: typeof data.config.pollInterval === "number" ? data.config.pollInterval : 5,
            rejectUnauthorized: data.config.rejectUnauthorized !== false,
          }));
          if (data.config.host && data.config.user) {
            setHasSavedConfig(true);
            fetchFolders(data.config);
          }
        }
      })
      .catch(() => setMessage({ type: "error", text: "IMAP ayarları yüklenemedi" }));
  }, []);

  const fetchFolders = async (config: typeof formData) => {
    setFoldersLoading(true);
    try {
      const res = await fetch("/api/settings/imap/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success && data.folders?.length > 0) {
        setFolders(data.folders);
      }
    } catch {
      // Arka plan yükleme, hata sessizce yutulur
    } finally {
      setFoldersLoading(false);
    }
  };

  const resetConnectionState = () => {
    setConnectionTested(false);
    setFolders([]);
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/imap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaydetme başarısız");
      setMessage({ type: "success", text: "IMAP ayarları kaydedildi" });
      setHasSavedConfig(true);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Kaydetme başarısız" });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    setDebugSteps(null);
    setPollResult(null);
    setFolders([]);
    setConnectionTested(false);
    try {
      const res = await fetch("/api/settings/imap/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setDebugSteps(data.steps ?? []);
      if (data.success) {
        setMessage({ type: "success", text: "IMAP bağlantısı başarılı. Aşağıdan izlenecek klasörü seçebilirsiniz." });
        setConnectionTested(true);
        if (data.folders && data.folders.length > 0) {
          setFolders(data.folders);
          const currentFolder = formData.folder;
          const folderExists = data.folders.some((f: FolderInfo) => f.path === currentFolder);
          if (!folderExists && data.folders.length > 0) {
            const inbox = data.folders.find((f: FolderInfo) => f.path.toUpperCase() === "INBOX");
            setFormData((prev) => ({ ...prev, folder: inbox ? inbox.path : data.folders[0].path }));
          }
        }
      } else {
        const failed = (data.steps ?? []).find((s: { status: string }) => s.status === "fail");
        const reason = failed ? (failed as { message: string; detail?: string }).message : data.error || "Bağlantı testi başarısız";
        setMessage({ type: "error", text: reason });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Bağlantı testi başarısız" });
      setDebugSteps([]);
    } finally {
      setTesting(false);
    }
  };

  const handlePoll = async () => {
    setPolling(true);
    setMessage(null);
    setPollResult(null);
    setDebugSteps(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 70_000);
    try {
      const res = await fetch("/api/email-records/poll", {
        method: "POST",
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yoklama başarısız");
      setPollResult(data.result);
      const r = data.result;
      setMessage({
        type: r.errors.length > 0 ? "error" : "success",
        text: `Yoklama tamamlandı: ${r.processed} işlendi, ${r.matched} eşleşti, ${r.unknown} bilinmeyen, ${r.skipped} atlandı.${r.errors.length > 0 ? ` ${r.errors.length} hata oluştu.` : ""}`,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessage({ type: "error", text: "Yoklama zaman aşımına uğradı (70 saniye). IMAP sunucusu yanıt vermiyor olabilir." });
      } else {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "Yoklama başarısız" });
      }
    } finally {
      clearTimeout(timeout);
      setPolling(false);
    }
  };

  const showPollSection = connectionTested || hasSavedConfig;

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/settings" className="text-sm text-white/90 hover:text-white">
          ← Ayarlar
        </Link>
      </div>
      <h1 className="typo-page-title mb-6">IMAP Ayarları</h1>

      {/* Bağlantı ayarları kartı */}
      <div
        className="rounded-xl shadow-lg p-6 max-w-2xl backdrop-blur space-y-4"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <p className="text-sm text-gray-600 mb-4">
          E-posta ile görev/not oluşturma özelliği için IMAP sunucu bilgilerini girin. Önce bağlantıyı test edin, ardından izlenecek klasörü seçin.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Sunucu (Host) *</label>
            <input
              type="text"
              value={formData.host}
              onChange={(e) => { setFormData({ ...formData, host: e.target.value }); resetConnectionState(); }}
              placeholder="Örn: imap.şirket.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Port</label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => { setFormData({ ...formData, port: parseInt(e.target.value, 10) || 993 }); resetConnectionState(); }}
              placeholder="993"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">Genelde 993 (SSL) veya 143 (TLS)</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Kullanıcı Adı *</label>
            <input
              type="text"
              value={formData.user}
              onChange={(e) => { setFormData({ ...formData, user: e.target.value }); resetConnectionState(); }}
              placeholder="Örn: notbak@şirket.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Şifre *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => { setFormData({ ...formData, password: e.target.value }); resetConnectionState(); }}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="imap-secure"
              checked={formData.secure}
              onChange={(e) => { setFormData({ ...formData, secure: e.target.checked }); resetConnectionState(); }}
              className="rounded border-gray-300"
            />
            <label htmlFor="imap-secure" className="text-sm font-medium text-gray-900">
              SSL/TLS kullan
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="imap-reject"
              checked={!formData.rejectUnauthorized}
              onChange={(e) => { setFormData({ ...formData, rejectUnauthorized: !e.target.checked }); resetConnectionState(); }}
              className="rounded border-gray-300"
            />
            <label htmlFor="imap-reject" className="text-sm font-medium text-gray-900">
              Sertifika doğrulamasını atla
            </label>
          </div>
        </div>

        <div>
          <button
            onClick={handleTest}
            disabled={testing}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {testing ? "Test ediliyor..." : "Bağlantıyı Test Et"}
          </button>
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${
              message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {debugSteps && debugSteps.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            <button
              type="button"
              onClick={() => setDebugOpen(!debugOpen)}
              className="w-full px-4 py-2 text-left font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 flex items-center justify-between"
            >
              Bağlantı adımları (debug)
              <span className="text-gray-500">{debugOpen ? "▼" : "▶"}</span>
            </button>
            {debugOpen && (
              <div className="p-4 space-y-3">
                {debugSteps.map((s, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded border text-sm ${s.status === "ok" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <span className={s.status === "ok" ? "text-green-600" : "text-red-600"}>
                        {s.status === "ok" ? "✓" : "✗"}
                      </span>
                      <span>{s.step}</span>
                    </div>
                    <p className="mt-1 text-gray-700">{s.message}</p>
                    {s.detail && (
                      <pre className="mt-2 text-xs bg-white/80 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                        {s.detail}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!showPollSection && !testing && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-500 italic">
              Klasör seçimi ve kaydetme seçenekleri bağlantı testi başarılı olduktan sonra görünecektir.
            </p>
          </div>
        )}
      </div>

      {/* Yoklama ayarları kartı — kayıtlı config varsa veya test başarılıysa görünür */}
      {showPollSection && (
        <div
          className="rounded-xl shadow-lg p-6 max-w-2xl backdrop-blur space-y-4 mt-4"
          style={{ backgroundColor: "var(--metro-card-bg)" }}
        >
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            {connectionTested ? (
              <><span className="text-green-600">✓</span> Bağlantı başarılı — Yoklama ayarları</>
            ) : (
              <><span className="text-blue-600">⚙</span> Yoklama ayarları</>
            )}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">İzlenecek Klasör *</label>
              {foldersLoading ? (
                <div className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-500 bg-gray-50 flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Klasörler yükleniyor...
                </div>
              ) : folders.length > 0 ? (
                <AppSelect
                  value={formData.folder}
                  onChange={(v) => setFormData({ ...formData, folder: v })}
                  className="w-full"
                >
                  {folders.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.path}
                      {f.messages >= 0 ? ` (${f.messages} mesaj${f.unseen !== undefined ? `, ${f.unseen} okunmamış` : ""})` : ""}
                    </option>
                  ))}
                </AppSelect>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.folder}
                    onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                    placeholder="INBOX"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => fetchFolders(formData)}
                    disabled={foldersLoading}
                    className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-gray-700 transition whitespace-nowrap"
                  >
                    Klasörleri Yükle
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {folders.length > 0
                  ? "Gelen e-postaların kontrol edileceği klasör"
                  : "Bağlantıyı test ederek veya yukarıdaki butona tıklayarak klasör listesini yükleyebilirsiniz"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Kontrol Sıklığı (dk)</label>
              <input
                type="number"
                value={formData.pollInterval}
                onChange={(e) => setFormData({ ...formData, pollInterval: parseInt(e.target.value, 10) || 5 })}
                min={1}
                max={60}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">Kaç dakikada bir kontrol edilsin (1-60)</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <button
              onClick={handlePoll}
              disabled={polling}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {polling ? "Yoklanıyor..." : "Şimdi E-postaları Yokla"}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            &quot;Şimdi E-postaları Yokla&quot; ile seçili klasördeki okunmamış mailleri anında kontrol edebilirsiniz.
          </p>

          {pollResult && pollResult.errors.length > 0 && (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <p className="font-medium text-red-800 mb-2">Yoklama Hataları:</p>
              {pollResult.errors.map((err, i) => (
                <p key={i} className="text-sm text-red-700">{err}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
