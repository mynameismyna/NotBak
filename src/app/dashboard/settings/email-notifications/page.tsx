"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AppSelect } from "@/components/AppSelect";

/** "08:30" gibi değeri saat ve dakikaya parse eder. */
function parseDigestTime(s: string): { hour: number; minute: number } {
  const t = (s || "08:00").trim();
  const match = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hour: 8, minute: 0 };
  const hour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minute = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return { hour, minute };
}

/** Saat ve dakikayı "HH:mm" formatında birleştirir. */
function formatDigestTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTimeDiff(minutes: number): string {
  if (minutes === 0) return "aynı";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const parts = [];
  if (h) parts.push(`${h} saat`);
  if (m) parts.push(`${m} dk`);
  const str = parts.join(" ");
  return minutes > 0 ? `Sunucu sizin saatinden ${str} ileride` : `Sizin saatiniz sunucudan ${str} ileride`;
}

/** Sunucu saati UTC timestamp + offset ile HH:mm:ss formatında hesaplar (canlı güncelleme için). */
function formatServerTimeFromUtc(utcMs: number, offsetMinutes: number): string {
  const totalSeconds =
    ((Math.floor(utcMs / 1000) + offsetMinutes * 60) % 86400 + 86400) % 86400;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function EmailNotificationsSettingsPage() {
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(true);
  const [dailyDigestTime, setDailyDigestTime] = useState("08:00");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [serverTime, setServerTime] = useState<{
    serverOffsetLabel: string;
    serverOffsetMinutes: number;
  } | null>(null);
  const [liveServerTimeLabel, setLiveServerTimeLabel] = useState("");
  const serverClockRef = useRef<{ serverTimeMs: number; clientFetchTime: number } | null>(null);
  const [userTimeLabel, setUserTimeLabel] = useState("");
  const [timeDiffText, setTimeDiffText] = useState<string | null>(null);
  const [sendingDigest, setSendingDigest] = useState(false);

  useEffect(() => {
    fetch("/api/users/me/digest-preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.dailyDigestEnabled !== undefined) setDailyDigestEnabled(data.dailyDigestEnabled);
        if (data.dailyDigestTime) setDailyDigestTime(data.dailyDigestTime);
      })
      .catch(() => setMessage({ type: "error", text: "Tercihler yüklenemedi." }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/server-time")
      .then((r) => r.json())
      .then((data) => {
        const serverTimeMs = new Date(data.serverTimeIso).getTime();
        const clientFetchTime = Date.now();
        serverClockRef.current = { serverTimeMs, clientFetchTime };
        setServerTime({
          serverOffsetLabel: data.serverOffsetLabel,
          serverOffsetMinutes: data.serverOffsetMinutes,
        });
        setLiveServerTimeLabel(
          formatServerTimeFromUtc(serverTimeMs, data.serverOffsetMinutes)
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setUserTimeLabel(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
      );
      const ref = serverClockRef.current;
      if (ref && serverTime) {
        const elapsed = Date.now() - ref.clientFetchTime;
        const serverTimeNow = ref.serverTimeMs + elapsed;
        setLiveServerTimeLabel(
          formatServerTimeFromUtc(serverTimeNow, serverTime.serverOffsetMinutes)
        );
        const userOffset = -now.getTimezoneOffset();
        const diffMin = serverTime.serverOffsetMinutes - userOffset;
        setTimeDiffText(formatTimeDiff(diffMin));
      }
    };
    updateClocks();
    const t = setInterval(updateClocks, 1000);
    return () => clearInterval(t);
  }, [serverTime]);

  const save = async (enabled: boolean, time: string) => {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/users/me/digest-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyDigestEnabled: enabled, dailyDigestTime: time }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage({ type: "ok", text: "Tercihler kaydedildi." });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: "error", text: data.error || "Kaydedilemedi." });
    }
    setSaving(false);
  };

  const handleEnabledChange = (enabled: boolean) => {
    setDailyDigestEnabled(enabled);
  };

  const handleTimeChange = (time: string) => {
    setDailyDigestTime(time);
  };

  const handleSaveClick = () => {
    save(dailyDigestEnabled, dailyDigestTime);
  };

  const handleSendNow = async () => {
    setSendingDigest(true);
    setMessage(null);
    const res = await fetch("/api/users/me/send-digest-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: window.location.origin }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage({ type: "ok", text: data.message || "Özet e-postası gönderildi." });
      setTimeout(() => setMessage(null), 5000);
    } else {
      setMessage({ type: "error", text: data.error || "Gönderilemedi." });
    }
    setSendingDigest(false);
  };

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-white/90 hover:text-white">
            ← Ana Sayfa
          </Link>
        </div>
        <p className="typo-loading-on-gradient">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-white/90 hover:text-white">
          ← Ana Sayfa
        </Link>
      </div>
      <h1 className="typo-page-title mb-4">E-posta bilgilendirme</h1>
      <div
        className="rounded-xl shadow-lg p-6 max-w-md backdrop-blur"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <p className="text-gray-600 text-sm mb-6">
          Günlük e-posta özeti: size atanan görevler, bugünkü görevler ve son tamamlanan kayıtlar tek bir e-postada özetlenir.
        </p>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={dailyDigestEnabled}
              onChange={(e) => handleEnabledChange(e.target.checked)}
              disabled={saving}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-800 font-medium">Günlük e-posta özeti açık</span>
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="digest-hour" className="block text-sm font-medium text-gray-700 mb-1">
                Gönderim saati (yerel sunucu saati)
              </label>
              <div className="flex items-center gap-2">
                <AppSelect
                  id="digest-hour"
                  value={String(parseDigestTime(dailyDigestTime).hour)}
                  onChange={(v) =>
                    handleTimeChange(
                      formatDigestTime(Number(v), parseDigestTime(dailyDigestTime).minute)
                    )
                  }
                  disabled={saving || !dailyDigestEnabled}
                  size="sm"
                  className="max-w-[72px]"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}
                    </option>
                  ))}
                </AppSelect>
                <span className="text-gray-600 font-medium">:</span>
                <AppSelect
                  id="digest-minute"
                  value={String(parseDigestTime(dailyDigestTime).minute)}
                  onChange={(v) =>
                    handleTimeChange(
                      formatDigestTime(parseDigestTime(dailyDigestTime).hour, Number(v))
                    )
                  }
                  disabled={saving || !dailyDigestEnabled}
                  size="sm"
                  className="max-w-[72px]"
                >
                  {Array.from({ length: 60 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}
                    </option>
                  ))}
                </AppSelect>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:pointer-events-none transition"
            >
              {saving ? "Kaydediliyor…" : "Tercihleri kaydet"}
            </button>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleSendNow}
              disabled={sendingDigest}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none transition"
            >
              {sendingDigest ? "Gönderiliyor…" : "Özeti şimdi gönder"}
            </button>
            <p className="text-xs text-gray-500 mt-1.5">
              Günlük özeti hemen e-posta adresinize gönderir (test veya manuel kullanım).
            </p>
          </div>

          {(serverTime || userTimeLabel) && (
            <div className="pt-4 mt-4 border-t border-gray-200 space-y-1.5 text-sm text-gray-600">
              <p className="font-medium text-gray-700">Saat karşılaştırması</p>
              {serverTime && (
                <p>
                  <span className="text-gray-500">Sunucu saati:</span>{" "}
                  <span className="font-mono">{liveServerTimeLabel || "—"}</span>{" "}
                  <span className="text-gray-500">({serverTime.serverOffsetLabel})</span>
                </p>
              )}
              {userTimeLabel && (
                <p>
                  <span className="text-gray-500">Sizin saat:</span>{" "}
                  <span className="font-mono">{userTimeLabel}</span>{" "}
                  <span className="text-gray-500">
                    (UTC{(-new Date().getTimezoneOffset()) / 60 >= 0 ? "+" : ""}
                    {(-new Date().getTimezoneOffset()) / 60})
                  </span>
                </p>
              )}
              {timeDiffText && (
                <p className="text-blue-700 font-medium">{timeDiffText}</p>
              )}
            </div>
          )}
        </div>

        {message && (
          <p
            className={`mt-4 text-sm ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
