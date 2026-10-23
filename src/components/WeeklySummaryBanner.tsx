"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DaySummary {
  date: string;
  dayName: string;
  shortDate: string;
  taskCount: number;
  completedCount: number;
  isToday: boolean;
}

interface WeekSummaryResponse {
  weekStart: string;
  weekEnd: string;
  days: DaySummary[];
}

export function WeeklySummaryBanner() {
  const [data, setData] = useState<WeekSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks/week-summary")
      .then((r) => r.json())
      .then((d) => {
        if (d.days) setData(d);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-xl shadow-lg p-4 mb-6 backdrop-blur"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <div className="flex items-center justify-center gap-3 py-4 text-gray-500">
          <span className="animate-pulse">Haftalık özet yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (!data?.days?.length) {
    return (
      <div
        className="rounded-xl shadow-lg p-4 mb-6 backdrop-blur"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="typo-subsection-title text-gray-700">Bu hafta</h2>
          <p className="text-sm text-gray-500">Bu hafta için atanmış görev yok.</p>
          <Link
            href="/dashboard/tasks?view=week"
            className="text-sm font-medium"
            style={{ color: "var(--metro-tile-gorevler)" }}
          >
            Görevlere git →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl shadow-lg p-4 mb-6 backdrop-blur border border-white/30"
      style={{ backgroundColor: "var(--metro-card-bg)" }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="typo-subsection-title text-gray-700">Haftalık özet</h2>
        <Link
          href="/dashboard/tasks?view=week"
          className="text-xs font-medium hover:underline"
          style={{ color: "var(--metro-tile-gorevler)" }}
        >
          Bu haftanın görevleri →
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {data.days.map((day) => (
          <Link
            key={day.date}
            href={`/dashboard/tasks?view=week`}
            className={`flex flex-col items-center rounded-lg py-3 px-2 transition border ${
              day.isToday
                ? "border-[var(--metro-tile-gorevler)] shadow-md"
                : "border-transparent hover:border-gray-200 hover:bg-gray-50/80"
            }`}
            style={
              day.isToday
                ? { backgroundColor: "rgba(126, 107, 184, 0.12)" }
                : undefined
            }
          >
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {day.dayName}
            </span>
            <span
              className={`text-sm font-semibold mt-0.5 ${
                day.isToday ? "text-[var(--metro-tile-gorevler)]" : "text-gray-700"
              }`}
            >
              {day.shortDate}
            </span>
            <span
              className={`mt-1.5 min-w-[1.75rem] h-7 px-1.5 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                day.taskCount > 0
                  ? "bg-[var(--metro-tile-gorevler)] text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {day.taskCount}
            </span>
            {day.taskCount > 0 && day.completedCount > 0 && (
              <span className="typo-caption mt-0.5">
                {day.completedCount}/{day.taskCount} tamamlandı
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
