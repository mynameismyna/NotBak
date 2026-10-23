"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LoginSnakeGame from "@/components/LoginSnakeGame";
import { caveat } from "@/lib/fonts";

const UserIcon = () => (
  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const LockIcon = () => (
  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);
const EyeIcon = () => (
  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const EyeOffIcon = () => (
  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addDebug = (msg: string) => setDebugLog((prev) => [...prev.slice(-4), msg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    addDebug(`Giriş deneniyor: ${username}`);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const text = await res.text();
      const data = text.trim() ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      if (!res.ok) {
        const errMsg = (data as { error?: string }).error || (res.status >= 500 ? "Sunucu hatası." : "Giriş başarısız");
        addDebug(`Hata: ${errMsg}`);
        throw new Error(errMsg);
      }
      addDebug("Giriş başarılı, yönlendiriliyor...");
      if ((data as { mustChangePassword?: boolean }).mustChangePassword) {
        router.push("/dashboard/settings/password");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--notbak-bg-gradient)" }}
    >
      <div
        className="rounded-2xl shadow-2xl p-8 max-w-md w-full backdrop-blur"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <LoginSnakeGame />
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="relative w-[380px] h-[120px] flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Şirket logosu"
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fallback = e.currentTarget.nextElementSibling;
                if (fallback instanceof HTMLElement) fallback.style.display = "flex";
              }}
            />
            <div
              className="hidden w-full h-full rounded-lg items-center justify-center text-gray-400 text-sm bg-gray-100/80"
              style={{ display: "none" }}
              aria-hidden
            >
              Şirket logosu
            </div>
          </div>
          <div className="relative w-[260px] h-[72px] flex items-center justify-center">
            <img
              src="/notbak_logo.png"
              alt="NotBak"
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fallback = e.currentTarget.nextElementSibling;
                if (fallback instanceof HTMLElement) fallback.style.display = "flex";
              }}
            />
            <div
              className="hidden w-full h-full rounded-lg items-center justify-center text-gray-400 text-sm bg-gray-100/80"
              style={{ display: "none" }}
              aria-hidden
            >
              NotBak
            </div>
          </div>
        </div>
        <h1 className="text-center text-gray-800 mb-6">
          <span className={`${caveat.className} font-bold text-5xl`}>NotBak</span>
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
              <UserIcon />
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Kullanıcı Adı"
              className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-[#4682B4]/30 focus:border-[#4682B4] outline-none transition"
            />
          </div>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
              <LockIcon />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Şifre"
              className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-[#4682B4]/30 focus:border-[#4682B4] outline-none transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 text-gray-500"
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-white font-medium transition hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            style={{ backgroundColor: "var(--metro-accent)" }}
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <div className="mt-6">
          <h2 className="typo-subsection-title mb-2">Debug Çıktısı</h2>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 min-h-[60px] text-sm text-gray-500">
            {debugLog.length === 0 ? (
              <span>Henüz kayıt yok</span>
            ) : (
              <ul className="space-y-1">
                {debugLog.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
