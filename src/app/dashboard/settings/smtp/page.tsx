"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SmtpSettingsPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    host: "",
    port: 587,
    secure: false,
    rejectUnauthorized: true,
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [debugSteps, setDebugSteps] = useState<{ step: string; status: "ok" | "fail"; message: string; detail?: string }[] | null>(null);
  const [debugSource, setDebugSource] = useState<"connection" | "send-test" | null>(null);
  const [debugOpen, setDebugOpen] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => { if (!data.canAccessSettings) router.replace("/dashboard"); })
      .catch(() => router.replace("/dashboard"));
  }, [router]);

  useEffect(() => {
    fetch("/api/settings/smtp")
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          setFormData((prev) => ({
            ...prev,
            host: data.config.host || "",
            port: typeof data.config.port === "number" ? data.config.port : 587,
            secure: data.config.secure === true,
            rejectUnauthorized: data.config.rejectUnauthorized === false ? false : true,
          }));
        }
      })
      .catch(() => setMessage({ type: "error", text: "SMTP ayarları yüklenemedi" }));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaydetme başarısız");
      setMessage({ type: "success", text: "SMTP ayarları kaydedildi" });
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
    setDebugSource(null);
    try {
      const res = await fetch("/api/settings/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setDebugSteps(data.steps ?? []);
      setDebugSource("connection");
      if (data.success) {
        setMessage({ type: "success", text: "SMTP bağlantısı başarılı. Sunucu erişilebilir." });
      } else {
        const failed = (data.steps ?? []).find((s: { status: string }) => s.status === "fail");
        const reason = failed ? (failed as { message: string; detail?: string }).message + (failed.detail ? "\n" + failed.detail : "") : data.error || "Bağlantı testi başarısız";
        setMessage({ type: "error", text: reason });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Bağlantı testi başarısız" });
      setDebugSteps([]);
      setDebugSource("connection");
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestMail = async () => {
    setSendingTest(true);
    setMessage(null);
    setDebugSteps(null);
    setDebugSource(null);
    try {
      const res = await fetch("/api/settings/smtp/send-test", { method: "POST" });
      const data = await res.json();
      setDebugSteps(data.steps ?? []);
      setDebugSource("send-test");
      if (data.success) {
        setMessage({ type: "success", text: "Deneme postası gönderildi. Giriş e-postanızı kontrol edin." });
      } else {
        const failed = (data.steps ?? []).find((s: { status: string }) => s.status === "fail");
        const reason = failed ? (failed as { message: string; detail?: string }).message + (failed.detail ? "\n" + failed.detail : "") : data.error || "Deneme postası gönderilemedi";
        setMessage({ type: "error", text: reason });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Deneme postası gönderilemedi" });
      setDebugSteps([]);
      setDebugSource("send-test");
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/settings" className="text-sm text-white/90 hover:text-white">
          ← Ayarlar
        </Link>
      </div>
      <h1 className="typo-page-title mb-6">SMTP Ayarları</h1>
      <div
        className="rounded-xl shadow-lg p-6 max-w-2xl backdrop-blur space-y-4"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <p className="text-sm text-gray-600 mb-4">
          E-postalar oturum açmış kullanıcının e-posta adresinden gönderilir; sunucu sadece relay (iletim) için kullanılır, kullanıcı adı/parola gerekmez.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Sunucu (Host)</label>
          <input
            type="text"
            value={formData.host}
            onChange={(e) => setFormData({ ...formData, host: e.target.value })}
            placeholder="Örn: smtp.şirket.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Port</label>
          <input
            type="number"
            value={formData.port}
            onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value, 10) || 587 })}
            placeholder="587"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
          />
          <p className="text-xs text-gray-500 mt-1">Genelde 587 (TLS) veya 465 (SSL)</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="secure"
            checked={formData.secure}
            onChange={(e) => setFormData({ ...formData, secure: e.target.checked })}
            className="rounded border-gray-300"
          />
          <label htmlFor="secure" className="text-sm font-medium text-gray-900">
            SSL/TLS (secure) kullan
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="rejectUnauthorized"
            checked={!formData.rejectUnauthorized}
            onChange={(e) => setFormData({ ...formData, rejectUnauthorized: !e.target.checked })}
            className="rounded border-gray-300"
          />
          <label htmlFor="rejectUnauthorized" className="text-sm font-medium text-gray-900">
            TLS sertifika doğrulamasını atla (sadece güvenilen dahili sunucular için)
          </label>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          &quot;unable to verify the first certificate&quot; hatası alıyorsanız (özel/şirket CA), bu seçeneği işaretleyin.
        </p>
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
              {debugSource === "send-test" ? "Deneme postası adımları (debug)" : "Bağlantı adımları (debug)"}
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
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {testing ? "Test ediliyor..." : "Bağlantıyı Test Et"}
          </button>
          <button
            onClick={handleSendTestMail}
            disabled={sendingTest}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {sendingTest ? "Gönderiliyor..." : "Deneme postası gönder"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Deneme postası giriş yaptığınız e-posta adresine gönderilir; gelen kutusunu kontrol edin.
        </p>
      </div>
    </div>
  );
}
