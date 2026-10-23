"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ModalShell } from "@/components/ModalShell";
import { TaskForm } from "@/components/TaskForm";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { ExcelImportButton } from "@/components/ExcelImportButton";
import { TaskImportPreviewModal, type PreviewRow } from "@/components/TaskImportPreviewModal";
import { useConfirm } from "@/components/ConfirmProvider";
import { ListFilterBar } from "@/components/ListFilterBar";
import { DropdownMenu } from "@/components/DropdownMenu";
import { OVERLAY_Z } from "@/lib/overlay-layer";
import { TaskList } from "@/components/TaskList";
import { ProjectRecordsStatsPanel } from "@/components/ProjectRecordsStatsPanel";
import { ProjectStatsModal } from "@/components/ProjectStatsModal";
import { AppSelect } from "@/components/AppSelect";
import { type TaskListItem, type TaskTypeFilter } from "@/lib/task-list";

type RecordsLayoutMode = "columns" | "list" | "table";
const RECORDS_LAYOUT_STORAGE_KEY = "notbak-all-records-layout";

export default function AllRecordsPage() {
  const searchParams = useSearchParams();
  const { confirm } = useConfirm();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; ownerId?: string | null }[]>([]);
  const [users, setUsers] = useState<{ id: string; displayName: string; email: string }[]>([]);
  const [projectId, setProjectId] = useState<string>(() => searchParams.get("projectId") ?? "");
  const [typeFilter, setTypeFilter] = useState<TaskTypeFilter>(() => {
    const initial = searchParams.get("type") as TaskTypeFilter | null;
    return initial === "GOREV" || initial === "NOT" || initial === "FIKIR" ? initial : "";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [newTaskType, setNewTaskType] = useState<string>("GOREV");
  const [newTaskPrivate, setNewTaskPrivate] = useState<boolean>(true);
  const [importPreview, setImportPreview] = useState<{
    open: boolean;
    rows: PreviewRow[];
    currentUserId: string;
  }>({ open: false, rows: [], currentUserId: "" });
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsRefresh, setStatsRefresh] = useState(0);
  const [layoutMode, setLayoutMode] = useState<RecordsLayoutMode>("columns");

  useEffect(() => {
    const storedLayout = window.localStorage.getItem(RECORDS_LAYOUT_STORAGE_KEY);
    if (storedLayout === "columns" || storedLayout === "list" || storedLayout === "table") {
      setLayoutMode(storedLayout);
    }
  }, []);

  const handleLayoutModeChange = (mode: RecordsLayoutMode) => {
    setLayoutMode(mode);
    window.localStorage.setItem(RECORDS_LAYOUT_STORAGE_KEY, mode);
  };

  const bumpProjectStats = () => setStatsRefresh((n) => n + 1);

  const fetchTasks = (refreshStats = false) => {
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (projectId) params.set("projectId", projectId);
    fetch(`/api/tasks?${params}`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .finally(() => {
        setLoading(false);
        if (refreshStats) bumpProjectStats();
      });
  };

  const selectedProjectName =
    projects.find((p) => p.id === projectId)?.name ?? "Proje";

  const loadProjects = () => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  };

  const loadUsers = () => {
    fetch("/api/users/list?filter=active")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {});
  };

  useEffect(() => {
    const urlProjectId = searchParams.get("projectId") ?? "";
    const urlType = searchParams.get("type") as TaskTypeFilter | null;
    setProjectId((prev) => (urlProjectId !== prev ? urlProjectId : prev));
    if (urlType && (urlType === "GOREV" || urlType === "NOT" || urlType === "FIKIR")) {
      setTypeFilter(urlType);
    }
  }, [searchParams]);

  // Proje ve kullanıcı listeleri nadiren değişir; yalnızca ilk yüklemede çekilir.
  useEffect(() => {
    loadProjects();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, typeFilter]);

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Kaydı Sil",
      message: "Bu kaydı silmek istediğinize emin misiniz?",
      confirmLabel: "Evet, sil",
      cancelLabel: "Vazgeç",
    });
    if (!ok) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (detailTaskId === id) setDetailTaskId(null);
    fetchTasks(true);
  };

  return (
    <div>
      <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="typo-page-title">
          {projectId ? `Tüm Kayıtlar - ${selectedProjectName}` : "Tüm Kayıtlar"}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <ExcelImportButton
            type="GOREV"
            onSuccess={() => fetchTasks(true)}
            mode="controller"
            onPreviewResult={(result) =>
              setImportPreview({
                open: true,
                rows: result.rows.map((r) => {
                  if (!projectId) return r;
                  const proj = projects.find((p) => p.id === projectId);
                  return {
                    ...r,
                    projectId,
                    isPrivate: false,
                    ...(proj?.ownerId ? { assigneeId: proj.ownerId } : {}),
                  };
                }),
                currentUserId: result.currentUser.id,
              })
            }
          >
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
                      Yeni Kayıt Ekle
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

      <ProjectRecordsStatsPanel
        projectId={projectId || null}
        projectName={projectId ? selectedProjectName : "Tüm Kayıtlar"}
        refreshKey={statsRefresh}
        onOpenDetail={() => setStatsModalOpen(true)}
      />

      <ListFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        projectId={projectId}
        onProjectIdChange={setProjectId}
        projects={projects}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        showTypeFilter
        showViewFilter={false}
        showQuickViews={false}
      />

      <ProjectStatsModal
        open={statsModalOpen}
        projectId={projectId || null}
        projectName={projectId ? selectedProjectName : "Tüm Kayıtlar"}
        onClose={() => setStatsModalOpen(false)}
      />

      <TaskImportPreviewModal
        open={importPreview.open}
        rows={importPreview.rows}
        users={users}
        projects={projects.map((p) => ({ id: p.id, name: p.name, ownerId: p.ownerId ?? null }))}
        currentUserId={importPreview.currentUserId}
        onClose={() => setImportPreview((prev) => ({ ...prev, open: false }))}
        onConfirm={async (rows) => {
          await fetch("/api/tasks/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows }),
          });
          setImportPreview((prev) => ({ ...prev, open: false }));
          fetchTasks(true);
        }}
      />

      <TaskDetailModal
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
        onUpdate={() => fetchTasks(true)}
      />

      <ModalShell
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setNewTaskPrivate(false);
        }}
        layer="base"
        ariaLabelledBy="all-records-new-modal-title"
        panelClassName="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl shadow-xl bg-white"
      >
        {showForm && (
          <>
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 flex-wrap shrink-0">
              <h2 id="all-records-new-modal-title" className="typo-modal-title shrink-0">
                Yeni Kayıt
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
                fetchTasks(true);
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
        showCreatedBy
        layoutMode={layoutMode}
        onLayoutModeChange={handleLayoutModeChange}
        emptyMessage='Henüz kayıt yok. Yeni eklemek için "Yeni" butonuna tıklayın.'
        emptyHint={
          projects.length === 0
            ? "Önce bir proje oluşturmanız gerekebilir. Projeler menüsünden ekleyebilirsiniz."
            : undefined
        }
        onOpenDetail={setDetailTaskId}
        onDelete={handleDelete}
        defaultSortKey="dueDate"
        defaultSortDir="asc"
      />
    </div>
  );
}
