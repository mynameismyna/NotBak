"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PasswordChangeForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Yeni parola ve tekrarı eşleşmiyor.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Yeni parola en az 6 karakter olmalı.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Parola değiştirilemedi.");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1500);
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 bg-green-50 text-green-800 rounded-lg border border-green-200">
        Parolanız güncellendi. Ana sayfaya yönlendiriliyorsunuz...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mevcut parola</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800"
          placeholder="••••••"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Yeni parola (en az 6 karakter)</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800"
          placeholder="••••••"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Yeni parola (tekrar)</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800"
          placeholder="••••••"
        />
      </div>
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded text-sm border border-red-100">{error}</div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Kaydediliyor..." : "Parolayı güncelle"}
      </button>
    </form>
  );
}
