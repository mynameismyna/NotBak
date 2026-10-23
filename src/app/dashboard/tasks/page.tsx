"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ModalShell } from "@/components/ModalShell";
import { TaskForm } from "@/components/TaskForm";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { ExcelImportButton } from "@/components/ExcelImportButton";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { ListFilterBar } from "@/components/ListFilterBar";
import { DropdownMenu } from "@/components/DropdownMenu";
import { OVERLAY_Z } from "@/lib/overlay-layer";
import { TaskList } from "@/components/TaskList";
import { AppSelect } from "@/components/AppSelect";
import { VIEW_OPTIONS_TASKS, type TaskListItem } from "@/lib/task-list";

export default function TasksPage() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [view, setView] = useState<string>(() => searchParams.get("view") ?? "");
  const [projectId, setProjectId] = useState<string>(() => searchParams.get("projectId") ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [newTaskType, setNewTaskType] = useState<string>("GOREV");
  const [newTaskPrivate, setNewTaskPrivate] = useState<boolean>(true);
  const [showNewMenu, setShowNewMenu] = useState(false);

  const fetchTasks = () => {
    const params = new URLSearchParams();
    if (view !== "overdue") params.set("type", "GOREV");
    if (view) params.set("view", view);
    if (projectId) params.set("projectId", projectId);
    fetch(`/api/tasks?${params}`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .finally(() => setLoading(false));
  };

  const loadProjects = () => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  };

  useEffect(() => {
    const urlView = searchParams.get("overdue") === "1" ? "overdue" : (searchParams.get("view") ?? "");
    const urlProjectId = searchParams.get("projectId") ?? "";
    setView((prev) => (urlView !== prev ? urlView : prev));
    setProjectId((prev) => (urlProjectId !== prev ? urlProjectId : prev));
  }, [searchParams]);

  // Projeler nadiren değişir; yalnızca ilk yüklemede çekilir (her filtre
  // değişiminde tekrar çekmemek için ayrı effect).
  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, projectId]);

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Görevi Sil",
      message: "Bu görevi silmek istediğinize emin misiniz?",
      confirmLabel: "Evet, sil",
      cancelLabel: "Vazgeç",
    });
    if (!ok) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (detailTaskId === id) setDetailTaskId(null);
    fetchTasks();
  };

  const handleSendToCalendar = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/send-to-calendar`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.showToast(data.message ?? "Takvim davetiyesi e-postanıza gönderildi.", "success");
      } else {
        toast.showToast(data.error ?? "Gönderilemedi.", "error");
      }
    } catch {
      toast.showToast("Gönderilemedi.", "error");
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="typo-page-title">Görevler</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <ExcelImportButton type="GOREV" onSuccess={fetchTasks} mode="controller">
            {({ downloadTemplate, openFileDialog, uploading }) => (
              <div
                className="relative"
                style={showNewMenu ? { zIndex: OVERLAY_Z.dropdownMenu } : undefined}
              >
                <button
                  type="button"
                  onClick={() => setShowNewMenu((prev) => !prev)}
                  className="btn-cta-gorevler btn-focus-clean px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg transition inline-flex items-center gap-1"
                  aria-expanded={showNewMenu}
                >
                  Yeni
                  <span aria-hidden>▾</span>
                </button>
                <DropdownMenu
                  open={showNewMenu}
                  onClose={() => setShowNewMenu(false)}
                  menuClassName="absolute right-0 mt-2 w-56 rounded-lg shadow-xl bg-white ring-1 ring-black/10 py-1"
                >
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(true);
                        setNewTaskPrivate(!projectId);
                        setShowNewMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 outline-none focus:outline-none focus-visible:bg-gray-100"
                    >
                      Yeni Görev Ekle
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        downloadTemplate();
                        setShowNewMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 outline-none focus:outline-none focus-visible:bg-gray-100"
                    >
                      Toplu Excel Şablonu İndir
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openFileDialog();
                        setShowNewMenu(false);
                      }}
                      disabled={uploading}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-white outline-none focus:outline-none focus-visible:bg-gray-100"
                    >
                      {uploading ? "Excel Şablonu Yükleniyor..." : "Toplu Excel Şablon Yükle"}
                    </button>
                </DropdownMenu>
              </div>
            )}
          </ExcelImportButton>
        </div>
      </div>

      <ListFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        view={view}
        onViewChange={setView}
        viewOptions={VIEW_OPTIONS_TASKS}
        projectId={projectId}
        onProjectIdChange={setProjectId}
        projects={projects}
      />

      <TaskDetailModal
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
        onUpdate={fetchTasks}
      />

      <ModalShell
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setNewTaskPrivate(false);
        }}
        layer="base"
        ariaLabelledBy="new-task-modal-title"
        panelClassName="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl shadow-xl bg-white"
      >
        {showForm && (
          <>
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 flex-wrap shrink-0">
              <h2 id="new-task-modal-title" className="typo-modal-title shrink-0">
                Yeni
              </h2>
              <AppSelect
                value={newTaskType}
                onChange={(v) => setNewTaskType(v)}
                size="sm"
                aria-label="Tip"
              >
                <option value="GOREV">Görev</option>
                <option value="NOT">Not</option>
                <option value="FIKIR">Fikir</option>
              </AppSelect>
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={newTaskPrivate}
                  onChange={(e) => setNewTaskPrivate(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  aria-label="Bana Özel"
                />
                <span className="text-sm font-medium text-gray-700">Bana Özel</span>
              </label>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setNewTaskPrivate(false);
                }}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 shrink-0"
                aria-label="Kapat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <TaskForm
              defaultProjectId={projectId || undefined}
              taskId={undefined}
              initialData={undefined}
              type={newTaskType}
              onTypeChange={setNewTaskType}
              isPrivate={newTaskPrivate}
              onPrivateChange={setNewTaskPrivate}
              onSuccess={() => {
                setShowForm(false);
                setNewTaskPrivate(false);
                fetchTasks();
              }}
              onCancel={() => {
                setShowForm(false);
                setNewTaskPrivate(false);
              }}
            />
            </div>
          </>
        )}
      </ModalShell>

      <TaskList
        tasks={tasks}
        loading={loading}
        searchQuery={searchQuery}
        emptyMessage='Henüz görev yok. Yeni eklemek için "Yeni" butonuna tıklayın.'
        emptyHint={
          projects.length === 0
            ? "Önce bir proje oluşturmanız gerekiyor. Projeler menüsünden ekleyebilirsiniz."
            : undefined
        }
        onOpenDetail={setDetailTaskId}
        onDelete={handleDelete}
        onSendToCalendar={handleSendToCalendar}
        defaultSortKey="dueDate"
        defaultSortDir="asc"
      />
    </div>
  );
}
