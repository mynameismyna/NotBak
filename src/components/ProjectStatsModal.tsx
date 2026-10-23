"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ModalShell } from "@/components/ModalShell";
import type { ProjectStatsPayload } from "@/lib/project-task-stats";

type Props = {
  open: boolean;
  projectId: string | null;
  projectName: string;
  onClose: () => void;
};

function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  return (
    <div className={`h-1.5 rounded-full bg-gray-100 overflow-hidden ${className ?? ""}`}>
      <div
        className="h-full rounded-full bg-indigo-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export function ProjectStatsModal({ open, projectId, projectName, onClose }: Props) {
  const router = useRouter();
  const [stats, setStats] = useState<ProjectStatsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setStats(null);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    fetch(`/api/tasks/stats${query}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "İstatistikler alınamadı");
        setStats(d.stats ?? null);
      })
      .catch((err) => {
        setStats(null);
        setError(err instanceof Error ? err.message : "İstatistikler alınamadı");
      })
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const counts = stats?.counts;
  const titleId = "project-stats-modal-title";
  const modalTitle = projectId
    ? `${projectName} — Proje Özeti`
    : `${projectName} — Kayıt Özeti`;

  const openRecords = () => {
    onClose();
    if (projectId) {
      router.push(`/dashboard/tum-kayitlar?projectId=${projectId}`);
    }
  };

  const openSettings = () => {
    if (!projectId) return;
    onClose();
    router.push(`/dashboard/projects/${projectId}`);
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      ariaLabelledBy={titleId}
      panelClassName="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-xl p-6 bg-white"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 id={titleId} className="typo-modal-title">
          {modalTitle}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 shrink-0"
          aria-label="Kapat"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {loading && <p className="typo-loading-on-card text-sm">Yükleniyor...</p>}

      {error && !loading && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && counts && (
        <div className="space-y-5">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-indigo-50/60 border border-indigo-100">
            <div
              className="relative flex shrink-0 items-center justify-center w-16 h-16 rounded-full border-4 border-indigo-200"
              style={{
                background: `conic-gradient(#6366f1 ${counts.completionPercent * 3.6}deg, #e0e7ff 0deg)`,
              }}
            >
              <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white text-sm font-bold text-indigo-800">
                %{counts.completionPercent}
              </span>
            </div>
            <div className="min-w-0 text-sm text-gray-700 space-y-0.5">
              <p>
                <span className="font-semibold text-gray-900">{counts.total}</span> toplam kayıt
              </p>
              <p>
                <span className="font-semibold text-emerald-700">{counts.completed}</span> tamamlanan
                {" · "}
                <span className="font-semibold text-indigo-700">{counts.active}</span> tamamlanmamış
              </p>
            </div>
          </div>

          <section>
            <h3 className="typo-subsection-title text-gray-800 mb-2">Duruma Göre</h3>
            <ul className="space-y-2">
              {stats.byStatus
                .filter((item) => item.count > 0)
                .map((item) => (
                  <li key={item.status}>
                    <div className="flex items-center justify-between gap-2 text-sm mb-0.5">
                      <span className="text-gray-700">{item.label}</span>
                      <span className="text-gray-600 shrink-0">
                        {item.count}{" "}
                        <span className="text-gray-400">(%{item.percent})</span>
                      </span>
                    </div>
                    <ProgressBar percent={item.percent} />
                  </li>
                ))}
              {stats.byStatus.every((item) => item.count === 0) && (
                <li className="text-sm text-gray-500">Kayıt yok</li>
              )}
            </ul>
          </section>

          {stats.byType.length > 0 && (
            <section>
              <h3 className="typo-subsection-title text-gray-800 mb-2">Tipe Göre</h3>
              <ul className="space-y-3">
                {stats.byType.map((typeItem) => (
                  <li
                    key={typeItem.type}
                    className="rounded-lg border border-gray-100 p-3 bg-gray-50/50"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm font-medium text-gray-800 mb-2">
                      <span>
                        {typeItem.label} ({typeItem.count})
                      </span>
                      <span className="text-gray-500 font-normal">%{typeItem.percent}</span>
                    </div>
                    {typeItem.byStatus.length > 0 ? (
                      <ul className="space-y-1.5">
                        {typeItem.byStatus.map((s) => (
                          <li
                            key={s.status}
                            className="flex items-center justify-between text-xs text-gray-600"
                          >
                            <span>{s.label}</span>
                            <span>
                              {s.count} (%{s.percent})
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={openRecords}
              className="btn-cta-gorevler px-4 py-2 rounded-lg text-sm font-medium"
            >
              {projectId ? "Kayıtları aç" : "Listeye dön"}
            </button>
            {projectId && (
              <button
                type="button"
                onClick={openSettings}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                Ekip / Ayarlar
              </button>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
