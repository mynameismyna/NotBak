"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { caveat } from "@/lib/fonts";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

type DebugEntry = {
  id: number;
  label: string;
  time: string;
  request?: { url: string; method: string; body: string };
  response?: { status: number; statusText: string; headers: string; raw: string; parsed: string };
  error?: { name: string; message: string; stack?: string };
};

type SelfCheckStatus = "checking" | "pass" | "fail";

interface SelfCheckItem {
  id: string;
  label: string;
  status: SelfCheckStatus;
  message: string;
  fixable: boolean;
}

interface ApiCheckResult {
  id: string;
  status: "pass" | "fail";
  message: string;
  fixable: boolean;
}

const SELF_CHECK_LABELS = [
  { id: "config", label: "Yapılandırma Dosyası" },
  { id: "env", label: "Ortam Değişkenleri (.env)" },
  { id: "dbconn", label: "Veritabanı Bağlantısı" },
  { id: "tables", label: "Veritabanı Tabloları" },
  { id: "admin", label: "Admin Kullanıcı" },
  { id: "prisma", label: "Prisma Client" },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [dbType, setDbType] = useState<"postgresql" | "sqlserver">("postgresql");
  const [formData, setFormData] = useState({
    adminPassword: "",
    adminEmail: "admin@notbak.local",
    host: "localhost",
    port: 5432,
    database: "db_notbak",
    user: "postgres",
    password: "",
    encrypt: true,
  });

  // Update port when dbType changes
  const updatePortForDbType = (type: "postgresql" | "sqlserver") => {
    setFormData((prev) => ({
      ...prev,
      port: type === "postgresql" ? 5432 : 1433,
      user: type === "postgresql" ? "postgres" : "notbak",
    }));
  };
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tablesConfirmed, setTablesConfirmed] = useState(false);
  const [tablesMissing, setTablesMissing] = useState<string[]>([]);
  const [databaseExists, setDatabaseExists] = useState(true);
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);
  const [debugOpen, setDebugOpen] = useState(true);
  const [statusChecked, setStatusChecked] = useState(false);
  const debugIdRef = useRef(0);

  const [selfCheckResults, setSelfCheckResults] = useState<SelfCheckItem[]>([]);
  const [selfCheckRunning, setSelfCheckRunning] = useState(false);
  const [selfCheckDone, setSelfCheckDone] = useState(false);
  const [selfCheckAllPassed, setSelfCheckAllPassed] = useState(false);

  // Kurulum zaten tamamsa ve tablolar varsa girişe yönlendir
  useEffect(() => {
    if (statusChecked) return;
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data: { setupComplete?: boolean; tablesExist?: boolean }) => {
        setStatusChecked(true);
        if (data.setupComplete === true && data.tablesExist === true) {
          router.replace("/login");
        }
      })
      .catch(() => setStatusChecked(true));
  }, [router, statusChecked]);

  const pushDebug = (entry: Omit<DebugEntry, "id" | "time">) => {
    debugIdRef.current += 1;
    setDebugLog((prev) => [
      ...prev.slice(-19),
      {
        ...entry,
        id: debugIdRef.current,
        time: new Date().toISOString(),
      },
    ]);
  };

  const parseJsonResponseFromText = (text: string): Record<string, unknown> => {
    if (!text.trim()) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  const handleStep1Next = () => {
    setError("");
    setStep(2);
  };

  const handleStep2Next = async () => {
    setError("");
    setLoading(true);
    const url = "/api/setup/test-connection";
    // Sunucuya bağlanmak için sistem veritabanı kullan (hedef veritabanı henüz olmayabilir)
    const body = {
      dbType,
      ...formData,
      database: dbType === "sqlserver" ? "master" : "postgres",
    };
    const bodyStr = JSON.stringify(body);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
      });
      const raw = await res.text();
      const data = parseJsonResponseFromText(raw);
      const headersStr = Array.from(res.headers.entries())
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      pushDebug({
        label: "Adım 2: Bağlantı Testi",
        request: { url, method: "POST", body: bodyStr },
        response: {
          status: res.status,
          statusText: res.statusText,
          headers: headersStr,
          raw,
          parsed: JSON.stringify(data, null, 2),
        },
      });
      if (!res.ok) throw new Error((data.error as string) || (res.status >= 500 ? "Sunucu hatası. Tekrar deneyin." : "Bağlantı başarısız"));
      setStep(3);
    } catch (err) {
      pushDebug({
        label: "Adım 2: Bağlantı Testi (HATA)",
        request: { url, method: "POST", body: bodyStr },
        error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { name: "Error", message: String(err) },
      });
      setError(err instanceof Error ? err.message : "Bağlantı testi başarısız");
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Check = async () => {
    setError("");
    setLoading(true);
    const url = "/api/setup/check-database";
    const body = { dbType, ...formData };
    const bodyStr = JSON.stringify(body);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
      });
      const raw = await res.text();
      const data = parseJsonResponseFromText(raw);
      const headersStr = Array.from(res.headers.entries())
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      pushDebug({
        label: "Adım 3: Veritabanı Kontrolü",
        request: { url, method: "POST", body: bodyStr },
        response: {
          status: res.status,
          statusText: res.statusText,
          headers: headersStr,
          raw,
          parsed: JSON.stringify(data, null, 2),
        },
      });
      if (!res.ok) throw new Error((data.error as string) || (res.status >= 500 ? "Sunucu hatası. Tekrar deneyin." : "Kontrol başarısız"));
      const dbExists = (data as { databaseExists?: boolean }).databaseExists !== false;
      setDatabaseExists(dbExists);
      const tablesMissingList = (data as { tablesMissing?: string[] }).tablesMissing;
      if (Array.isArray(tablesMissingList) && tablesMissingList.length > 0) {
        setTablesMissing(tablesMissingList);
        setTablesConfirmed(false);
        setStep(4);
      } else {
        setStep(5);
      }
    } catch (err) {
      pushDebug({
        label: "Adım 3: Veritabanı Kontrolü (HATA)",
        request: { url, method: "POST", body: bodyStr },
        error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { name: "Error", message: String(err) },
      });
      setError(err instanceof Error ? err.message : "Veritabanı kontrolü başarısız");
    } finally {
      setLoading(false);
    }
  };

  const handleTablesConfirm = () => {
    setTablesConfirmed(true);
    setStep(5);
  };

  const handleStep5Complete = async () => {
    setError("");
    setLoading(true);
    const url = "/api/setup/complete";
    const tablesAlreadyExist = tablesMissing.length === 0;
    const body = { dbType, ...formData, tablesAlreadyExist, databaseExists };
    const bodyStr = JSON.stringify(body);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
      });
      const raw = await res.text();
      const data = parseJsonResponseFromText(raw);
      const headersStr = Array.from(res.headers.entries())
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      pushDebug({
        label: "Adım 5: Kurulum Tamamla",
        request: { url, method: "POST", body: bodyStr },
        response: {
          status: res.status,
          statusText: res.statusText,
          headers: headersStr,
          raw,
          parsed: JSON.stringify(data, null, 2),
        },
      });
      if (!res.ok) {
        const errMsg = (data.error as string) || (res.status >= 500 ? "Sunucu hatası. Tekrar deneyin." : "Kurulum başarısız");
        const detail = data.detail as string | undefined;
        throw new Error(detail ? `${errMsg}\n\nAyrıntı:\n${detail}` : errMsg);
      }
      setStep(6);
      setSelfCheckResults(SELF_CHECK_LABELS.map(item => ({
        ...item, status: "checking" as SelfCheckStatus, message: "Bekliyor...", fixable: false,
      })));
      setTimeout(() => runSelfCheck(false), 200);
    } catch (err) {
      pushDebug({
        label: "Adım 5: Kurulum Tamamla (HATA)",
        request: { url, method: "POST", body: bodyStr },
        error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { name: "Error", message: String(err) },
      });
      setError(err instanceof Error ? err.message : "Kurulum tamamlanamadı");
    } finally {
      setLoading(false);
    }
  };

  const runSelfCheck = async (autoFix: boolean) => {
    setSelfCheckRunning(true);
    setSelfCheckDone(false);
    setSelfCheckAllPassed(false);
    setError("");

    const initial: SelfCheckItem[] = SELF_CHECK_LABELS.map(item => ({
      ...item, status: "checking" as SelfCheckStatus, message: "Bekliyor...", fixable: false,
    }));
    setSelfCheckResults(initial);

    const scUrl = "/api/setup/self-check";
    const scBody = JSON.stringify({ autoFix });

    try {
      const res = await fetch(scUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: scBody,
      });
      const raw = await res.text();
      const data = parseJsonResponseFromText(raw);
      const headersStr = Array.from(res.headers.entries()).map(([k, v]) => `${k}: ${v}`).join("\n");

      pushDebug({
        label: autoFix ? "Adım 6: Self-Check (Düzeltme)" : "Adım 6: Self-Check",
        request: { url: scUrl, method: "POST", body: scBody },
        response: { status: res.status, statusText: res.statusText, headers: headersStr, raw, parsed: JSON.stringify(data, null, 2) },
      });

      if (!res.ok) throw new Error((data.error as string) || "Self-check başarısız");

      const results = ((data.checks || []) as ApiCheckResult[]);
      const resultMap = new Map(results.map(r => [r.id, r]));

      for (let i = 0; i < SELF_CHECK_LABELS.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 350));
        const item = SELF_CHECK_LABELS[i];
        const result = resultMap.get(item.id);
        setSelfCheckResults(prev => prev.map(p =>
          p.id === item.id
            ? { ...p, status: (result?.status === "pass" ? "pass" : "fail") as SelfCheckStatus, message: result?.message || "Kontrol edilemedi", fixable: result?.fixable ?? false }
            : p
        ));
      }

      setSelfCheckAllPassed((data as { allPassed?: boolean }).allPassed === true);
    } catch (err) {
      pushDebug({
        label: "Adım 6: Self-Check (HATA)",
        request: { url: scUrl, method: "POST", body: scBody },
        error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { name: "Error", message: String(err) },
      });
      setError(err instanceof Error ? err.message : "Self-check başarısız");
      setSelfCheckResults(prev => prev.map(p => ({
        ...p,
        status: p.status === "checking" ? ("fail" as SelfCheckStatus) : p.status,
        message: p.status === "checking" ? "API hatası nedeniyle kontrol edilemedi" : p.message,
      })));
    } finally {
      setSelfCheckRunning(false);
      setSelfCheckDone(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="typo-page-title mb-6 text-center"><span className={caveat.className}>NotBak</span> Kurulum</h1>

        {step === 1 && (
          <div>
            <h2 className="typo-section-title mb-4">Adım 1: Veritabanı Seçimi</h2>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dbType"
                  checked={dbType === "postgresql"}
                  onChange={() => {
                    setDbType("postgresql");
                    updatePortForDbType("postgresql");
                  }}
                />
                PostgreSQL
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dbType"
                  checked={dbType === "sqlserver"}
                  onChange={() => {
                    setDbType("sqlserver");
                    updatePortForDbType("sqlserver");
                  }}
                />
                SQL Server
              </label>
            </div>
            <button
              onClick={handleStep1Next}
              className="mt-6 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Devam
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="typo-section-title mb-4">Adım 2: Sunucu Bağlantısı</h2>
            <p className="text-gray-600 text-sm mb-4">
              Önce sunucuya bağlanıyoruz. Veritabanı adını bir sonraki adımda gireceksiniz (yoksa oluşturulacak).
            </p>
            {dbType === "postgresql" && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-gray-700">
                <strong>PostgreSQL kurulu değilse:</strong> Windows servislerinde &quot;postgresql&quot; servisini başlatın veya Docker ile:{" "}
                <code className="bg-white px-1 rounded text-xs break-all">docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16</code>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Yönetici E-posta</label>
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Yönetici Parolası</label>
                <input
                  type="password"
                  value={formData.adminPassword}
                  onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sunucu</label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="localhost"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Port</label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value, 10) || (dbType === "postgresql" ? 5432 : 1433) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kullanıcı</label>
                <input
                  type="text"
                  value={formData.user}
                  onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parola</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <button
              onClick={handleStep2Next}
              disabled={loading || !formData.adminPassword || !formData.password}
              className="mt-6 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Bağlanıyor..." : "Sunucuya Bağlan"}
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="typo-section-title mb-4">Adım 3: Veritabanı</h2>
            <p className="text-gray-600 text-sm mb-4">
              NotBak için kullanılacak veritabanı. Yoksa bu isimle oluşturulacak; varsa tablolar kontrol edilecek.
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Veritabanı adı (yoksa oluşturulacak)</label>
                <input
                  type="text"
                  value={formData.database}
                  onChange={(e) => setFormData({ ...formData, database: e.target.value || "db_notbak" })}
                  placeholder="db_notbak"
                  className="w-full border rounded px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Varsayılan: db_notbak</p>
              </div>
            </div>
            <button
              onClick={handleStep3Check}
              disabled={loading || !formData.database?.trim()}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Kontrol ediliyor..." : "Kontrol Et"}
            </button>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="typo-section-title mb-4">Adım 4: Tablo Onayı</h2>
            {!databaseExists && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
                Veritabanı mevcut değil — otomatik oluşturulacak.
              </p>
            )}
            <p className="text-gray-600 text-sm mb-3">
              Aşağıdaki <strong>{tablesMissing.length}</strong> tablo oluşturulacak:
            </p>
            <div className="max-h-48 overflow-y-auto border rounded p-2 mb-4">
              <ul className="text-sm space-y-1">
                {tablesMissing.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="text-green-600">+</span>
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{t}</code>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleTablesConfirm}
                className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
              >
                Tabloları Oluştur
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
              >
                Geri
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="typo-section-title mb-4">Adım 5: Kurulumu Tamamla</h2>
            <p className="text-gray-600 mb-4">
              Tüm ayarlar kaydedilecek ve ilk admin kullanıcı oluşturulacak.
            </p>
            <button
              onClick={handleStep5Complete}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Tamamlanıyor..." : "Kurulumu Tamamla"}
            </button>
          </div>
        )}

        {step === 6 && (
          <div>
            <h2 className="typo-section-title mb-4">Adım 6: Kurulum Doğrulama</h2>
            <p className="text-gray-600 text-sm mb-4">
              {selfCheckDone
                ? selfCheckAllPassed
                  ? "Tüm kontroller başarıyla tamamlandı."
                  : "Bazı kontroller başarısız oldu."
                : "Kurulum adımları kontrol ediliyor..."}
            </p>

            {selfCheckResults.length > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    selfCheckDone && !selfCheckAllPassed ? "bg-red-500" : "bg-blue-600"
                  }`}
                  style={{
                    width: `${Math.round(
                      (selfCheckResults.filter(r => r.status !== "checking").length / selfCheckResults.length) * 100
                    )}%`,
                  }}
                />
              </div>
            )}

            <div className="space-y-2 mb-5">
              {selfCheckResults.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-300 ${
                    item.status === "checking"
                      ? "bg-gray-50 border-gray-200"
                      : item.status === "pass"
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {item.status === "checking" && (
                      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    {item.status === "pass" && (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {item.status === "fail" && (
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${
                      item.status === "checking" ? "text-gray-700" :
                      item.status === "pass" ? "text-green-800" : "text-red-800"
                    }`}>
                      {item.label}
                    </div>
                    <div className={`text-xs mt-0.5 ${
                      item.status === "checking" ? "text-gray-500" :
                      item.status === "pass" ? "text-green-600" : "text-red-600"
                    }`}>
                      {item.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selfCheckDone && selfCheckAllPassed && (
              <div className="p-4 bg-green-100 border border-green-300 rounded-lg text-center mb-4">
                <div className="text-green-800 font-semibold">Kurulum başarıyla tamamlandı!</div>
                <div className="text-green-600 text-sm mt-1">Tüm kontroller geçti. Uygulamayı kullanmaya başlayabilirsiniz.</div>
              </div>
            )}

            {selfCheckDone && !selfCheckAllPassed && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                <div className="text-red-800 font-medium text-sm">Bazı kontroller başarısız</div>
                <div className="text-red-600 text-xs mt-1">
                  Düzeltilebilir hatalar varsa otomatik düzeltmeyi deneyebilir, ardından tekrar kontrol edebilirsiniz.
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {selfCheckDone && selfCheckAllPassed && (
                <button
                  onClick={() => { router.push("/login"); router.refresh(); }}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 font-medium"
                >
                  Giriş Sayfasına Git
                </button>
              )}
              {selfCheckDone && !selfCheckAllPassed && selfCheckResults.some(r => r.fixable && r.status === "fail") && (
                <button
                  onClick={() => runSelfCheck(true)}
                  disabled={selfCheckRunning}
                  className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 text-sm font-medium disabled:opacity-50"
                >
                  {selfCheckRunning ? "Düzeltiliyor..." : "Otomatik Düzelt"}
                </button>
              )}
              {selfCheckDone && !selfCheckAllPassed && (
                <button
                  onClick={() => runSelfCheck(false)}
                  disabled={selfCheckRunning}
                  className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600 text-sm font-medium disabled:opacity-50"
                >
                  {selfCheckRunning ? "Kontrol ediliyor..." : "Tekrar Kontrol Et"}
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>
        )}

        {step > 1 && step < 4 && (
          <button
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="mt-4 w-full text-gray-600 hover:text-gray-800"
          >
            Geri
          </button>
        )}

        {/* Debug paneli - kurulum hatalarını ince ayrıntısıyla gösterir */}
        <div className="mt-6 border border-gray-300 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setDebugOpen((o) => !o)}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-left font-medium text-sm flex items-center justify-between"
          >
            <span>🐛 Debug ({debugLog.length} kayıt)</span>
            <span className="text-gray-500">{debugOpen ? "▼" : "▶"}</span>
          </button>
          {debugOpen && (
            <div className="p-3 bg-gray-50 max-h-96 overflow-y-auto">
              {debugLog.length === 0 ? (
                <p className="text-gray-500 text-sm">Henüz istek yok. Bağlantı testi veya kurulum tamamla yaptığınızda burada görünecek.</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setDebugLog([])}
                    className="mb-2 text-xs px-2 py-1 bg-gray-300 hover:bg-gray-400 rounded"
                  >
                    Temizle
                  </button>
                  <div className="space-y-4">
                    {debugLog.map((entry) => (
                      <div key={entry.id} className="border border-gray-200 rounded p-3 bg-white text-xs font-mono">
                        <div className="font-semibold text-gray-700 mb-1">
                          [{entry.time}] {entry.label}
                        </div>
                        {entry.request && (
                          <div className="mb-2">
                            <div className="text-gray-600 font-semibold mt-1">İstek:</div>
                            <pre className="whitespace-pre-wrap break-all bg-gray-100 p-2 rounded mt-0.5 overflow-x-auto">
                              {entry.request.method} {entry.request.url}
                              {"\n"}Body: {entry.request.body}
                            </pre>
                          </div>
                        )}
                        {entry.response && (
                          <div className="mb-2">
                            <div className="text-gray-600 font-semibold mt-1">Yanıt: {entry.response.status} {entry.response.statusText}</div>
                            <pre className="whitespace-pre-wrap break-all bg-gray-100 p-2 rounded mt-0.5 overflow-x-auto text-xs">
                              Headers:{"\n"}{entry.response.headers}
                              {"\n\n"}Raw body:{"\n"}{entry.response.raw || "(boş)"}
                              {"\n\n"}Parsed:{"\n"}{entry.response.parsed}
                            </pre>
                          </div>
                        )}
                        {entry.error && (
                          <div className="text-red-700">
                            <div className="font-semibold mt-1">Hata: {entry.error.name}</div>
                            <pre className="whitespace-pre-wrap break-all bg-red-50 p-2 rounded mt-0.5 overflow-x-auto">
                              {entry.error.message}
                              {entry.error.stack ? `\n\nStack:\n${entry.error.stack}` : ""}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
