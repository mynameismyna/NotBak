"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function GeneralSettingsPage() {
  const [appUrl, setAppUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/app-url")
      .then((r) => r.json())
      .then(async (data) => {
        if (data.error) {
          setMessage({ type: "error", text: data.error });
          return;
        }
        const stored = (data.appUrl ?? "").trim();
        setAppUrl(stored);
        if (!stored && typeof window !== "undefined") {
          const origin = window.location.origin;
          const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
          if (origin && !isLocalhost) {
            try {
              const res = await fetch("/api/settings/app-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ appUrl: origin }),
              });
              const saveData = await res.json();
              if (res.ok) {
                setAppUrl(origin);
                setMessage({ type: "success", text: "Uygulama URL'si otomatik algılandı ve kaydedildi." });
              }
            } catch {
              setAppUrl(origin);
            }
          } else if (origin) {
            setAppUrl(origin);
          }
        }
      })
      .catch(() => setMessage({ type: "error", text: "Ayar yüklenemedi" }));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/app-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appUrl: appUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaydetme başarısız");
      setMessage({ type: "success", text: "Uygulama URL'si kaydedildi. E-postalardaki giriş linki bu adresi kullanacak." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Kaydetme başarısız" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/settings" className="text-sm text-white/90 hover:text-white">
          ← Ayarlar
        </Link>
      </div>
      <h1 className="typo-page-title mb-4">Genel Ayarlar</h1>
      <div
        className="rounded-xl shadow-lg p-6 max-w-xl backdrop-blur"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <p className="text-gray-300 text-sm mb-4">
          E-postalarda (hoş geldiniz, parola sıfırlama, günlük özet vb.) kullanılacak giriş ve sayfa linkleri bu adrese göre oluşturulur. Kayıtlı değilse tarayıcı adresiniz otomatik algılanıp kaydedilir; kullanıcı eklerken de isteğin geldiği adres (Host) kullanılır.
        </p>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Uygulama URL&apos;si</label>
            <input
              type="url"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder="https://notbak.sirketiniz.com"
              className="w-full border border-gray-500 rounded px-3 py-2 bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Boş bırakırsanız e-postalardaki link, kullanıcı ekleme/sıfırlama isteğinin geldiği adresten (Host) veya Genel Ayarlar sayfası açıldığında algılanan adresten otomatik türetilir.
            </p>
          </div>
          {message && (
            <div
              className={`p-3 rounded text-sm ${message.type === "success" ? "bg-green-900/40 text-green-200" : "bg-red-900/40 text-red-200"}`}
            >
              {message.text}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </form>
      </div>
    </div>
  );
}
