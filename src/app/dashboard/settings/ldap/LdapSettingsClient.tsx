"use client";

import { useState, useEffect } from "react";

export default function LdapSettingsClient() {
  const [formData, setFormData] = useState({
    url: "ldap://localhost:389",
    bindDn: "",
    bindPassword: "",
    searchBase: "",
    searchFilter: "(sAMAccountName={{username}})",
    groupFilter: "",
    preferredEmailDomain: "",
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [debugSteps, setDebugSteps] = useState<{ step: string; status: "ok" | "fail"; message: string; detail?: string }[] | null>(null);
  const [debugOpen, setDebugOpen] = useState(true);

  useEffect(() => {
    fetch("/api/ldap/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          setFormData((prev) => ({
            ...prev,
            url: data.config.url || prev.url,
            bindDn: data.config.bindDn || "",
            searchBase: data.config.searchBase || "",
            searchFilter: data.config.searchFilter || prev.searchFilter,
            groupFilter: data.config.groupFilter || "",
            preferredEmailDomain: data.config.preferredEmailDomain || "",
          }));
        }
      })
      .catch(() => setMessage({ type: "error", text: "Ayarlar yüklenemedi" }));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ldap/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaydetme başarısız");
      setMessage({ type: "success", text: "LDAP ayarları kaydedildi" });
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
    try {
      const res = await fetch("/api/ldap/test-debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setDebugSteps(data.steps ?? []);
      if (data.success) {
        setMessage({ type: "success", text: "LDAP bağlantısı başarılı. Tüm adımlar tamamlandı." });
      } else {
        const failed = (data.steps ?? []).find((s: { status: string }) => s.status === "fail");
        const reason = failed ? (failed as { message: string; detail?: string }).message + (failed.detail ? "\n" + failed.detail : "") : data.error || "Bağlantı testi başarısız";
        setMessage({ type: "error", text: reason });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Bağlantı testi başarısız" });
      setDebugSteps([]);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <h1 className="typo-page-title mb-6">LDAP Ayarları</h1>
      <div className="bg-white rounded-lg shadow p-6 max-w-2xl space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">LDAP URL</label>
          <input
            type="text"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="ldap://sunucu:389 veya ldaps://sunucu:636"
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bind DN</label>
          <input
            type="text"
            value={formData.bindDn}
            onChange={(e) => setFormData({ ...formData, bindDn: e.target.value })}
            placeholder="CN=admin,DC=example,DC=local"
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bind Parolası</label>
          <input
            type="password"
            value={formData.bindPassword}
            onChange={(e) => setFormData({ ...formData, bindPassword: e.target.value })}
            placeholder="Boş bırakırsanız mevcut parola korunur"
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Kaydet: parola boşsa mevcut korunur. Bağlantıyı Test Et: parola boşsa son kaydedilen parola kullanılır.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Search Base (Base DN)</label>
          <input
            type="text"
            value={formData.searchBase}
            onChange={(e) => setFormData({ ...formData, searchBase: e.target.value })}
            placeholder="DC=example,DC=local"
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Kullanıcı Filtresi</label>
          <input
            type="text"
            value={formData.searchFilter}
            onChange={(e) => setFormData({ ...formData, searchFilter: e.target.value })}
            placeholder="(sAMAccountName={{username}})"
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">Active Directory: sAMAccountName veya userPrincipalName kullanın</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Grup Filtresi (Opsiyonel)</label>
          <input
            type="text"
            value={formData.groupFilter}
            onChange={(e) => setFormData({ ...formData, groupFilter: e.target.value })}
            placeholder="Örn: CN=MyGroup,OU=Groups,DC=example,DC=local — boş = tüm kullanıcılar"
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">Giriş için kullanılır. Kullanıcı eklerken &quot;Kullanıcılar&quot; sayfasından AD listesi filtre olmadan çekilir.</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tercih edilen e-posta domain (Exchange)</label>
          <input
            type="text"
            value={formData.preferredEmailDomain}
            onChange={(e) => setFormData({ ...formData, preferredEmailDomain: e.target.value })}
            placeholder="Örn: example.com"
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">Exchange kullanıyorsanız: proxyAddresses içinden bu domain ile biten e-posta kullanılır (örn. user@example.com). Boş bırakırsanız mail/userPrincipalName kullanılır.</p>
        </div>
        {message && (
          <div
            className={`p-3 rounded text-sm whitespace-pre-wrap ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}
          >
            {message.text}
          </div>
        )}
        {debugSteps && debugSteps.length > 0 && (
          <div className="border rounded-lg overflow-hidden bg-gray-50">
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
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {testing ? "Test ediliyor..." : "Bağlantıyı Test Et"}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          AD kullanıcılarını eklemek için <strong>Ayarlar → Kullanıcılar</strong> sayfasındaki &quot;Active Directory&apos;den ekle&quot; butonunu kullanın.
        </p>
      </div>
    </div>
  );
}
