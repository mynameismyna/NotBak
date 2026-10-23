"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import { ModalShell } from "@/components/ModalShell";

const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "Acil",
  HIGH: "Yüksek",
  MEDIUM: "Orta",
  LOW: "Düşük",
};

const PRIORITY_CLASS: Record<string, string> = {
  URGENT: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  LOW: "bg-gray-100 text-gray-800",
};

interface Task {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string;
  assignee?: { displayName: string };
  project?: { name: string };
}

interface NotlarBoardProps {
  projectId?: string;
  /** Değiştiğinde liste yeniden yüklenir (örn. yeni not eklendikten sonra). */
  refreshTrigger?: number;
}

/** datetime-local input için YYYY-MM-DDTHH:mm formatı döndürür. */
function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function NotlarBoard({ projectId, refreshTrigger }: NotlarBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  /** "" = devam eden notlar, "completed" = tamamlanan notlar */
  const [view, setView] = useState<"" | "completed">("");
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completeDateTime, setCompleteDateTime] = useState("");
  const [completing, setCompleting] = useState(false);
  const toast = useToast();

  const fetchTasks = () => {
    const params = new URLSearchParams();
    params.set("type", "NOT"); // Notlar ekranında sadece notlar (görevler ve fikirler hariç)
    if (projectId) params.set("projectId", projectId);
    if (view === "completed") params.set("view", "completed");
    fetch(`/api/tasks?${params}`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .finally(() => setLoading(false));
  };

  const openCompleteModal = (task: Task) => {
    const now = new Date();
    setCompletingTaskId(task.id);
    setCompleteDateTime(formatDateTimeLocal(now));
  };

  const handleConfirmComplete = async () => {
    if (!completingTaskId || !completeDateTime) return;
    setCompleting(true);
    try {
      const selected = new Date(completeDateTime);
      const res = await fetch(`/api/tasks/${completingTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "TAMAMLANDI",
          completedAt: selected.toISOString(),
        }),
      });
      if (!res.ok) {
        let errorMessage = "Not tamamlanamadı";
        try {
          const data = await res.json();
          if (data?.error) errorMessage = data.error;
        } catch {
          // ignore
        }
        throw new Error(errorMessage);
      }
      setCompletingTaskId(null);
      setCompleting(false);
      setLoading(true);
      fetchTasks();
    } catch (err) {
      setCompleting(false);
      toast.showToast(err instanceof Error ? err.message : "Not tamamlanamadı", "error");
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTasks();
  }, [projectId, refreshTrigger, view]);

  if (loading) return <p className="typo-loading-on-card">Yükleniyor...</p>;

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          type="button"
          onClick={() => setView("")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition shadow ${view === "" ? "text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          style={view === "" ? { backgroundColor: "var(--metro-tile-notlar)" } : undefined}
        >
          Devam Eden
        </button>
        <button
          type="button"
          onClick={() => setView("completed")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition shadow ${view === "completed" ? "text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          style={view === "completed" ? { backgroundColor: "var(--metro-tile-notlar)" } : undefined}
        >
          Tamamlanan
        </button>
      </div>
      {tasks.length === 0 ? (
        <p className="typo-empty-on-card py-6 text-center">
          {view === "completed"
            ? "Tamamlanan not yok."
            : "Henüz not yok. \"Yeni\" ile ekleyebilirsiniz."}
        </p>
      ) : (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-600 font-medium">
            <th className="py-3 px-3">Başlık</th>
            <th className="py-3 px-3 max-w-[200px] hidden sm:table-cell">Açıklama</th>
            <th className="py-3 px-3 whitespace-nowrap">Durum</th>
            <th className="py-3 px-3 whitespace-nowrap">Öncelik</th>
            <th className="py-3 px-3 whitespace-nowrap">Son Tarih</th>
            <th className="py-3 px-3 whitespace-nowrap">Sorumlu</th>
            <th className="py-3 px-3 whitespace-nowrap hidden md:table-cell">Proje</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const isCompleted = task.status === "TAMAMLANDI";
            return (
            <tr
              key={task.id}
              className={`border-b border-gray-100 hover:bg-gray-50/80 transition ${isCompleted ? "text-gray-500 italic line-through" : ""}`}
            >
              <td className="py-2.5 px-3">
                <Link
                  href={`/dashboard/tasks/${task.id}`}
                  className={`typo-card-title hover:text-[var(--metro-tile-notlar)] hover:underline ${isCompleted ? "text-gray-600" : ""}`}
                >
                  {task.title}
                </Link>
              </td>
              <td className="py-2.5 px-3 max-w-[200px] truncate text-gray-500 hidden sm:table-cell" title={task.description}>
                {task.description}
              </td>
              <td className="py-2.5 px-3 whitespace-nowrap text-gray-600">
                {isCompleted ? "Tamamlandı" : "Bekleyen"}
              </td>
              <td className="py-2.5 px-3">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_CLASS[task.priority] ?? "bg-gray-100 text-gray-700"}`}>
                  {PRIORITY_LABELS[task.priority] ?? task.priority}
                </span>
              </td>
              <td className="py-2.5 px-3 whitespace-nowrap text-gray-600">
                {new Date(task.dueDate).toLocaleDateString("tr-TR")}
              </td>
              <td className="py-2.5 px-3 whitespace-nowrap text-gray-600">
                {task.assignee?.displayName ?? "—"}
              </td>
              <td className="py-2.5 px-3 whitespace-nowrap text-gray-500 hidden md:table-cell">
                {task.project?.name ?? "—"}
              </td>
              <td className="py-2.5 px-3 text-right">
                <span className="inline-flex items-center gap-2">
                  <Link
                    href={`/dashboard/tasks/${task.id}`}
                    className="inline-flex items-center bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700"
                  >
                    Aç
                  </Link>
                  {!isCompleted && (
                    <button
                      type="button"
                      onClick={() => openCompleteModal(task)}
                      className="inline-flex items-center bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Tamamla
                    </button>
                  )}
                </span>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
      )}
      <ModalShell
        open={!!completingTaskId}
        onClose={() => {
          if (!completing) setCompletingTaskId(null);
        }}
        layer="base"
        panelClassName="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6"
      >
        {completingTaskId && (
          <>
            <h3 className="typo-modal-title mb-2">Notu Tamamla</h3>
            <p className="text-sm text-gray-700 mb-3">
              Tamamlanma tarih ve saatini seçin. Varsayılan olarak şu anki zaman gelir, isterseniz değiştirebilirsiniz.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tamamlanma Tarihi ve Saati
            </label>
            <input
              type="datetime-local"
              value={completeDateTime}
              onChange={(e) => setCompleteDateTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!completing) {
                    setCompletingTaskId(null);
                  }
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleConfirmComplete}
                disabled={completing || !completeDateTime}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {completing ? "Kaydediliyor..." : "Tamamla"}
              </button>
            </div>
          </>
        )}
      </ModalShell>
    </div>
  );
}
