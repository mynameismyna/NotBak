"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ProjectStatsPayload } from "@/lib/project-task-stats";

type Props = {
  /** Doluysa proje kapsamı; boşsa tüm erişilebilir kayıtlar. */
  projectId?: string | null;
  projectName: string;
  /** Sayılar değişince paneli yeniden çekmek için (ör. kayıt silme/tamamlama). */
  refreshKey?: number;
  onOpenDetail?: () => void;
};

function StatCard({
  label,
  value,
  hint,
  action,
}: {
  label: string;
  value: string | number;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg p-4 bg-gray-50/80 border border-gray-100">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      {action && <p className="text-xs text-gray-500 mt-1">{action}</p>}
    </div>
  );
}

export function ProjectRecordsStatsPanel({
  projectId,
  projectName,
  refreshKey = 0,
  onOpenDetail,
}: Props) {
  const [stats, setStats] = useState<ProjectStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    setLoading(true);
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    fetch(`/api/tasks/stats${query}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "İstatistikler alınamadı");
        setStats(d.stats ?? null);
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [projectId, refreshKey]);

  const counts = stats?.counts;
  const panelTitle = projectId
    ? `${projectName} — Proje İstatistikleri`
    : "Tüm Kayıtlar — Kayıt İstatistikleri";
  const gorevCount = stats?.byType.find((t) => t.type === "GOREV")?.count ?? 0;
  const notCount = stats?.byType.find((t) => t.type === "NOT")?.count ?? 0;
  const fikirCount = stats?.byType.find((t) => t.type === "FIKIR")?.count ?? 0;

  const renderHeader = () => (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <h3 className="typo-section-title truncate">📊 {panelTitle}</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Filtrelerden bağımsız; tüm kayıt tiplerini kapsar.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition shrink-0"
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
        className="rounded-xl shadow-lg p-6 mb-6 backdrop-blur border border-gray-200"
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

  if (!counts) {
    return (
      <div
        className="rounded-xl shadow-lg p-6 mb-6 backdrop-blur border border-gray-200"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        {renderHeader()}
        <p className="text-gray-500 text-sm mt-2">Kayıt istatistikleri yüklenemedi.</p>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div
        className="rounded-xl shadow-lg p-3 mb-6 backdrop-blur border border-gray-200"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between gap-2 text-left py-1 px-2 rounded-lg hover:bg-gray-50 transition"
        >
          <span className="text-sm font-medium text-gray-700 truncate">
            📊 {panelTitle}
          </span>
          <span className="text-xs text-gray-500 shrink-0">Görmek için tıklayın</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl shadow-lg p-6 mb-6 backdrop-blur border border-gray-200"
      style={{ backgroundColor: "var(--metro-card-bg)" }}
    >
      <div className="mb-4">{renderHeader()}</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Tamamlanmamış"
          value={counts.active}
          hint="Devam eden kayıtlar"
        />
        <StatCard
          label="Tamamlanan"
          value={counts.completed}
          hint="Toplam tamamlanan"
        />
        <StatCard
          label="Toplam Kayıt"
          value={counts.total}
          hint="Görev, not ve fikir"
        />
        <StatCard
          label="Tamamlanma Oranı"
          value={`%${counts.completionPercent}`}
          hint="Tamamlanan / Toplam"
        />
        <StatCard
          label="Kayıt Tipleri"
          value={`${gorevCount} / ${notCount} / ${fikirCount}`}
          hint="Görev / Not / Fikir"
          action={
            onOpenDetail ? (
              <button
                type="button"
                onClick={onOpenDetail}
                className="text-indigo-600 hover:underline"
              >
                {projectId ? "Proje özetine git →" : "Detaylı özeti gör →"}
              </button>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
