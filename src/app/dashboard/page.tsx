"use client";

import { useState, useEffect } from "react";
import { caveat } from "@/lib/fonts";
import { CollapsibleCalendar } from "@/components/CollapsibleCalendar";
import { DashboardWidgetGrid } from "@/components/DashboardWidgetGrid";
import { DashboardDurationStats, type DurationStats } from "@/components/DashboardDurationStats";
import { DashboardTaskColumns } from "@/components/DashboardTaskColumns";
import { QuickActionButtons } from "@/components/QuickActionButtons";
import type { DashboardTaskRow } from "@/lib/dashboard-task-map";

export default function DashboardPage() {
  const [canAccessSettings, setCanAccessSettings] = useState(false);
  const [durationStats, setDurationStats] = useState<DurationStats | null>(null);
  const [overdueRows, setOverdueRows] = useState<DashboardTaskRow[]>([]);
  const [recentRows, setRecentRows] = useState<DashboardTaskRow[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setCanAccessSettings(d.canAccessSettings ?? false))
      .catch(() => {});
  }, []);

  // Ağır /api/dashboard/stats endpoint'i bir kez çağrılır; süre istatistikleri
  // ve görev sütunları aynı yanıtı paylaşır (önceden 2 ayrı istek atılıyordu).
  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d) => {
        setDurationStats(d.durationStats ?? null);
        setOverdueRows(d.overdueList ?? []);
        setRecentRows(d.recentActivity ?? []);
        setOverdueCount(d.overdueCount ?? 0);
      })
      .catch(() => {
        setDurationStats(null);
        setOverdueRows([]);
        setRecentRows([]);
        setOverdueCount(0);
      })
      .finally(() => setStatsLoading(false));
  }, []);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="typo-page-title drop-shadow">
          <span className={caveat.className}>NotBak</span> Dashboard
        </h1>
        <QuickActionButtons />
      </div>

      {/* 3x3 widget grid - sürükle-bırak, kapatma, yetki filtreleme */}
      <DashboardWidgetGrid canAccessSettings={canAccessSettings} />

      {/* Süre istatistikleri - takvimin hemen üstünde */}
      <DashboardDurationStats stats={durationStats} loading={statsLoading} />

      <CollapsibleCalendar />

      {/* Geciken kayıtlar + Son aktiviteler (Tüm Çalışmalar ile aynı kart/sütun tasarımı) */}
      <DashboardTaskColumns
        overdueRows={overdueRows}
        recentRows={recentRows}
        overdueCount={overdueCount}
        loading={statsLoading}
      />
    </div>
  );
}
