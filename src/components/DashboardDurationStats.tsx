"use client";

import { useState } from "react";
import Link from "next/link";

export interface DurationStats {
  avgActualDays: number | null;
  avgPlannedDays: number | null;
  completedCount: number;
  pendingCount: number;
  pendingNotesCount?: number;
}

function formatDays(days: number): string {
  const totalMinutes = days * 24 * 60;
  const totalHours = days * 24;

  if (totalHours < 1) {
    return `${Math.round(totalMinutes)} dk`;
  }
  if (days < 1) {
    return `${totalHours.toFixed(1)} saat`;
  }
  if (days < 7) {
    return `${days.toFixed(1)} gün`;
  }
  if (days < 28) {
    const weeks = Math.floor(days / 7);
    const remainder = days % 7;
    if (remainder < 0.5) return `${weeks} hafta`;
    return `${weeks} hafta ${remainder.toFixed(0)} gün`;
  }
  const months = days / 30;
  return `${months.toFixed(1)} ay`;
}

/** Veri, /api/dashboard/stats'ı bir kez çağıran üst sayfadan (dashboard) gelir. */
export function DashboardDurationStats({
  stats,
  loading,
}: {
  stats: DurationStats | null;
  loading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);

  const hasData =
    stats &&
    (stats.avgActualDays !== null ||
      stats.avgPlannedDays !== null ||
      (stats.completedCount ?? 0) > 0 ||
      (stats.pendingCount ?? 0) > 0 ||
      (stats.pendingNotesCount ?? 0) > 0);

  const renderHeader = () => (
    <div className="flex items-center justify-between gap-2">
      <h3 className="typo-section-title">⏱️ Süre İstatistikleri</h3>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
        aria-label={isOpen ? "Kapat" : "Göster"}
        title={isOpen ? "Kapat" : "Göster"}
      >
        {isOpen ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div
        className="rounded-xl shadow-lg p-6 mb-8 backdrop-blur border border-gray-200"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        {renderHeader()}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mt-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-200/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div
        className="rounded-xl shadow-lg p-6 mb-8 backdrop-blur border border-gray-200"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        {renderHeader()}
        <p className="text-gray-500 text-sm mt-2">Henüz yeterli veri yok. Görevler tamamlandıkça istatistikler görünecek.</p>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div
        className="rounded-xl shadow-lg p-3 mb-8 backdrop-blur border border-gray-200"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between gap-2 text-left py-1 px-2 rounded-lg hover:bg-gray-50 transition"
        >
          <span className="text-sm font-medium text-gray-700">⏱️ Süre İstatistikleri</span>
          <span className="text-xs text-gray-500">Görmek için tıklayın</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl shadow-lg p-6 mb-8 backdrop-blur border border-gray-200"
      style={{ backgroundColor: "var(--metro-card-bg)" }}
    >
      <div className="mb-4">{renderHeader()}</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg p-4 bg-gray-50/80 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ortalama Tamamlanma Süresi</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {stats.avgActualDays !== null ? formatDays(stats.avgActualDays) : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">Oluşturma → Tamamlama</p>
        </div>
        <div className="rounded-lg p-4 bg-gray-50/80 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bekleyen Görevler (Planlanan)</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {stats.avgPlannedDays !== null ? formatDays(stats.avgPlannedDays) : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">Ort. planlanan süre</p>
        </div>
        <div className="rounded-lg p-4 bg-gray-50/80 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tamamlanan Görevler</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.completedCount}</p>
          <p className="text-xs text-gray-500 mt-1">Toplam tamamlanan</p>
        </div>
        <div className="rounded-lg p-4 bg-gray-50/80 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bekleyen Görevler</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.pendingCount}</p>
          <p className="text-xs text-gray-500 mt-1">
            <Link href="/dashboard/tasks" className="text-indigo-600 hover:underline">
              Görevlere git →
            </Link>
          </p>
        </div>
        <div className="rounded-lg p-4 bg-gray-50/80 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bekleyen Notlar</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.pendingNotesCount ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">
            <Link href="/dashboard/board" className="text-indigo-600 hover:underline">
              Notlara git →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
