"use client";

import { formatUserDisplayName } from "@/lib/display-name";
import { formatAppDate, formatAppDateTime, parseAppDate, toDateInputValue } from "@/lib/parse-date";

import { useState, useEffect, useRef } from "react";
import { TaskForm } from "@/components/TaskForm";
import { ModalShell } from "@/components/ModalShell";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { AppSelect } from "@/components/AppSelect";
import { toYmdLocal, tomorrowYmdLocal } from "@/lib/date-input";

interface Collaborator {
  userId: string;
  displayName: string;
  email: string;
}

interface AssignmentHistoryEntry {
  id: string;
  createdAt: string;
  fromUser: { id: string; displayName: string };
  toUser: { id: string; displayName: string };
  comment?: { id: string; content: string } | null;
}

interface Task {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string;
  assigneeId: string;
  projectId: string;
  createdAt?: string;
  statusChangedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  isAssignee?: boolean;
  isAssigneeOrCollaborator?: boolean;
  canEdit?: boolean;
  assignee: { id: string; displayName: string; email: string };
  createdBy?: { id: string; displayName: string; email: string } | null;
  project: { id: string; name: string };
  collaborators?: Collaborator[];
  comments: { id: string; content: string; createdAt: string; author: { displayName: string } }[];
  assignmentHistory?: AssignmentHistoryEntry[];
}

const STATUS_LABELS: Record<string, string> = {
  YENI: "Yeni",
  ONAY_BEKLIYOR: "Onay Bekliyor",
  DEVAM_EDIYOR: "Devam Ediyor",
  BEKLEMEDE: "Beklemede",
  TAMAMLANDI: "Tamamlandı",
  REDDEDILDI: "Reddedildi",
};

const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "Acil",
  HIGH: "Yüksek",
  MEDIUM: "Orta",
  LOW: "Düşük",
};

function daysUntil(dateStr: string): number | null {
  const d = parseAppDate(dateStr);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function daysAgo(dateStr: string | null | undefined): number | null {
  const d = parseAppDate(dateStr);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function TaskDetailModal({ taskId, onClose, onUpdate }: TaskDetailModalProps) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [users, setUsers] = useState<{ id: string; displayName: string; email: string }[]>([]);
  const [selectedRelatedUserIds, setSelectedRelatedUserIds] = useState<string[]>([]);
  const [relatedDropdownOpen, setRelatedDropdownOpen] = useState(false);
  const [collaboratorLoading, setCollaboratorLoading] = useState(false);
  const commentFormRef = useRef<HTMLFormElement>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showStatusReasonModal, setShowStatusReasonModal] = useState(false);
  const [statusReason, setStatusReason] = useState("");
  const [statusReasonError, setStatusReasonError] = useState("");
  const [delegateWithComment, setDelegateWithComment] = useState(false);
  const [delegateToUserId, setDelegateToUserId] = useState("");
  const [delegateNewStatus, setDelegateNewStatus] = useState("");
  const [deferWithComment, setDeferWithComment] = useState(false);
  const [deferMode, setDeferMode] = useState<"DAYS" | "DATE">("DAYS");
  const [deferDays, setDeferDays] = useState(1);
  const [deferToDate, setDeferToDate] = useState("");

  const fetchTask = () => {
    if (!taskId) return;
    setLoading(true);
    fetch(`/api/tasks/${taskId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setTask(d.task);
        if (d.task && !d.task.canEdit) setEditing(false);
      })
      .catch(() => setTask(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (taskId) {
      fetchTask();
      setEditing(false);
    } else {
      setTask(null);
    }
  }, [taskId]);

  useEffect(() => {
    fetch("/api/users/list?filter=active&sort=hierarchy")
      .then((r) => r.json())
      .then((d) => (d.users ? setUsers(d.users) : []))
      .catch(() => {});
  }, []);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !taskId) return;
    if (delegateWithComment && !delegateToUserId) {
      return;
    }
    if (deferWithComment) {
      if (deferMode === "DATE" && !deferToDate.trim()) {
        toast.showToast("Erteleme için tarih seçin.", "error");
        return;
      }
    }
    setSubmittingComment(true);
    try {
      const body: {
        content: string;
        taskId: string;
        delegateToUserId?: string;
        newStatus?: string;
        deferEnabled?: boolean;
        deferMode?: "DAYS" | "DATE";
        deferDays?: number;
        deferToDate?: string;
      } = {
        content: commentText.trim(),
        taskId,
      };
      if (delegateWithComment && delegateToUserId) {
        body.delegateToUserId = delegateToUserId;
        if (delegateNewStatus) body.newStatus = delegateNewStatus;
      }
      if (deferWithComment) {
        body.deferEnabled = true;
        body.deferMode = deferMode;
        if (deferMode === "DAYS") body.deferDays = deferDays;
        else body.deferToDate = deferToDate.trim();
      }
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yorum eklenemedi");
      const created = data.comment as { id: string; content: string; createdAt: string; author: { displayName: string } };
      const newComment = {
        id: created.id,
        content: created.content,
        createdAt: typeof created.createdAt === "string" ? created.createdAt : new Date(created.createdAt).toISOString(),
        author: { displayName: created.author?.displayName ?? "Kullanıcı" },
      };
      setTask((prev) => (prev ? { ...prev, comments: [newComment, ...prev.comments] } : null));
      setCommentText("");
      const didDelegate = delegateWithComment && !!delegateToUserId;
      const didDefer = deferWithComment;
      if (didDelegate) {
        setDelegateWithComment(false);
        setDelegateToUserId("");
        setDelegateNewStatus("");
      }
      if (didDefer) {
        setDeferWithComment(false);
        setDeferMode("DAYS");
        setDeferDays(1);
        setDeferToDate("");
      }
      if (didDelegate || didDefer) {
        fetchTask();
        onUpdate();
      }
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : "Yorum eklenemedi", "error");
    } finally {
      setSubmittingComment(false);
    }
  };

  const updateStatus = async (nextStatus: string, reason?: string) => {
    if (!taskId) return;
    setActionLoading(true);
    try {
      const body: Record<string, unknown> = { status: nextStatus };
      if (reason) body.statusReason = reason;
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Görev güncellenemedi");
      fetchTask();
      onUpdate();
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : "Görev güncellenemedi", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    const ok = await confirm({
      title: "Görevi Sil",
      message: "Bu görevi silmek istediğinize emin misiniz?",
      confirmLabel: "Evet, sil",
      cancelLabel: "Vazgeç",
    });
    if (!ok) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      onClose();
      onUpdate();
    }
  };

  const saveSelectedCollaborators = async () => {
    if (!taskId || selectedRelatedUserIds.length === 0) return;
    setCollaboratorLoading(true);
    try {
      for (const userId of selectedRelatedUserIds) {
        const res = await fetch(`/api/tasks/${taskId}/collaborators`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "İlgili kişi(ler) eklenemedi");
        }
      }
      setSelectedRelatedUserIds([]);
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : "İlgili kişi(ler) eklenemedi", "error");
    } finally {
      setCollaboratorLoading(false);
    }
  };

  const handleSendToCalendar = async () => {
    if (!taskId) return;
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

  const handleStartTask = async () => {
    if (!taskId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Görev başlatılamadı");
      fetchTask();
      onUpdate();
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : "Görev başlatılamadı", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!taskId) return;
    await updateStatus("TAMAMLANDI");
    setShowCompleteConfirm(false);
  };

  const handleStatusChange = (nextStatus: string) => {
    if (!task || !taskId) return;
    if (nextStatus === task.status) return;
    if (!task.isAssigneeOrCollaborator) return;

    if (nextStatus === "BEKLEMEDE") {
      setStatusReason("");
      setStatusReasonError("");
      setShowStatusReasonModal(true);
      return;
    }

    if (nextStatus === "TAMAMLANDI") {
      setShowCompleteConfirm(true);
      return;
    }

    void updateStatus(nextStatus);
  };

  const handleConfirmWaitingStatus = async () => {
    if (!statusReason.trim()) {
      setStatusReasonError("Beklemede durumuna geçerken gerekçe zorunludur.");
      return;
    }
    await updateStatus("BEKLEMEDE", statusReason.trim());
    setShowStatusReasonModal(false);
  };

  const canManageCollaborators = task?.isAssignee;
  const addCollaboratorOptions = users.filter(
    (u) =>
      u.id !== task?.assigneeId &&
      !task?.collaborators?.some((c) => c.userId === u.id)
  );

  const handleRemoveCollaborator = async (userId: string) => {
    if (!taskId) return;
    const ok = await confirm({
      title: "İlgili Kişiyi Kaldır",
      message: "Bu kişiyi görevden çıkarmak istediğinize emin misiniz?",
      confirmLabel: "Evet, kaldır",
      cancelLabel: "Vazgeç",
    });
    if (!ok) return;
    setCollaboratorLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/collaborators?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Çıkarma başarısız");
      fetchTask();
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : "Ekip üyesi çıkarılamadı", "error");
    } finally {
      setCollaboratorLoading(false);
    }
  };

  const handleAddMultipleCollaborators = async () => {
    if (!taskId || selectedRelatedUserIds.length === 0) return;
    setCollaboratorLoading(true);
    try {
      for (const userId of selectedRelatedUserIds) {
        const res = await fetch(`/api/tasks/${taskId}/collaborators`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Ekleme başarısız");
        }
      }
      setSelectedRelatedUserIds([]);
      fetchTask();
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : "İlgili kişi(ler) eklenemedi", "error");
    } finally {
      setCollaboratorLoading(false);
    }
  };

  if (!taskId) return null;

  const showStartButton = task?.type !== "NOT" && task?.status === "YENI";
  const showCompleteButton =
    task?.type === "NOT"
      ? task?.status !== "TAMAMLANDI"
      : task?.status === "DEVAM_EDIYOR" || task?.status === "BEKLEMEDE";
  const canStartOrComplete = !!task?.isAssigneeOrCollaborator;

  return (
    <>
      <ModalShell
        open={!!taskId}
        onClose={onClose}
        layer="base"
        panelClassName="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="typo-modal-title">
            {loading ? "Yükleniyor..." : task?.title ?? "Görev"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4">
          {loading ? (
            <p className="typo-loading-on-card">Yükleniyor...</p>
          ) : !task ? (
            <p className="text-gray-500">Görev bulunamadı.</p>
          ) : editing ? (
            <div className="py-2">
              <h3 className="typo-section-title mb-4">Görevi Düzenle</h3>
              <TaskForm
                taskId={taskId}
                initialData={{
                  title: task.title,
                  description: task.description,
                  type: task.type,
                  status: task.status,
                  priority: task.priority,
                  dueDate: toDateInputValue(task.dueDate),
                  assigneeId: task.assigneeId || "",
                  projectId: task.projectId || "",
                }}
                onSuccess={async () => {
                  await saveSelectedCollaborators();
                  setEditing(false);
                  fetchTask();
                  onUpdate();
                }}
                onCancel={() => setEditing(false)}
              />
              {/* İlgili Kişi ekleme - sadece Düzenle modunda */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">İlgili Kişi Ekle</h3>
                <ul className="text-sm text-gray-600 space-y-1 mb-3">
                  <li className="flex items-center gap-2">
                    <span>{task.assignee?.displayName}</span>
                    <span className="text-gray-400">(Sorumlu)</span>
                  </li>
                  {task.collaborators?.map((c) => (
                    <li key={c.userId} className="flex items-center gap-2">
                      <span>{c.displayName}</span>
                      {canManageCollaborators && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCollaborator(c.userId)}
                          disabled={collaboratorLoading}
                          className="text-red-600 hover:underline text-xs disabled:opacity-50"
                        >
                          Çıkar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {canManageCollaborators && addCollaboratorOptions.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setRelatedDropdownOpen((v) => !v)}
                      className="w-full sm:w-auto min-w-[200px] flex items-center justify-between gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 text-left"
                    >
                      <span className="text-gray-700 truncate">
                        {selectedRelatedUserIds.length === 0
                          ? "İlgili kişi seçin..."
                          : `${selectedRelatedUserIds.length} kişi seçili`}
                      </span>
                      <span className="text-gray-400 shrink-0">{relatedDropdownOpen ? "▲" : "▼"}</span>
                    </button>
                    {relatedDropdownOpen && (
                      <>
                        <div
                          className="absolute inset-0 z-10"
                          aria-hidden
                          onClick={() => setRelatedDropdownOpen(false)}
                        />
                        <div className="absolute left-0 bottom-full mb-1 z-20 w-full sm:min-w-[280px] max-h-60 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg py-1">
                          {addCollaboratorOptions.map((u) => (
                            <label
                              key={u.id}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={selectedRelatedUserIds.includes(u.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRelatedUserIds((prev) => [...prev, u.id]);
                                  } else {
                                    setSelectedRelatedUserIds((prev) => prev.filter((id) => id !== u.id));
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                              <span className="text-gray-800">{formatUserDisplayName(u.displayName)}</span>
                              <span className="text-gray-500 text-xs truncate">({u.email})</span>
                            </label>
                          ))}
                          {selectedRelatedUserIds.length > 0 && (
                            <div className="border-t border-gray-100 px-3 py-2 flex gap-2 flex-wrap items-center justify-between">
                              <p className="text-xs text-gray-500">
                                Seçtiğiniz kişiler, <strong>Güncelle</strong> dediğinizde ilgili kişi olarak kaydedilecektir.
                              </p>
                              <button
                                type="button"
                                onClick={() => setSelectedRelatedUserIds([])}
                                className="text-gray-600 hover:underline text-sm"
                              >
                                Seçimi temizle
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Başlat / Tamamla düğmesi - her zaman görünür, yetkisizse devre dışı */}
              <div className="mb-4 flex flex-wrap gap-2">
                {showStartButton && (
                  <button
                    type="button"
                    onClick={handleStartTask}
                    disabled={actionLoading || !canStartOrComplete}
                    title={!canStartOrComplete ? "Sadece sorumlu veya ekip üyesi görevi başlatabilir." : undefined}
                    className="px-4 py-2 rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow"
                  >
                    {actionLoading ? "İşleniyor..." : "Görevi Başlat"}
                  </button>
                )}
                {showCompleteButton && (
                  <button
                    type="button"
                    onClick={() => setShowCompleteConfirm(true)}
                    disabled={actionLoading || !canStartOrComplete}
                    title={!canStartOrComplete ? "Sadece sorumlu veya ekip üyesi görevi tamamlayabilir." : undefined}
                    className="px-4 py-2 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 shadow"
                  >
                    {actionLoading ? "İşleniyor..." : "Görevi Tamamla"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSendToCalendar}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-blue-600 font-medium hover:bg-gray-50"
                >
                  Takvime ekle
                </button>
                {task.canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-4 py-2 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50"
                    >
                      Sil
                    </button>
                  </>
                )}
              </div>

              <p className="text-gray-500 text-sm">{task.project?.name}</p>
              <p className="mt-2 text-gray-700">{task.description}</p>
              <div className="flex gap-4 mt-3 text-sm flex-wrap">
                <div className="flex items-center gap-1">
                  <span>Durum:</span>
                  <AppSelect
                    value={
                      task.type === "NOT"
                        ? task.status === "TAMAMLANDI"
                          ? "TAMAMLANDI"
                          : "YENI"
                        : task.status
                    }
                    onChange={(v) => handleStatusChange(v)}
                    disabled={!canStartOrComplete || actionLoading}
                    size="sm"
                    aria-label="Durum"
                  >
                    {(task.type === "NOT"
                      ? [
                          { value: "YENI", label: "Bekleyen" },
                          { value: "TAMAMLANDI", label: "Tamamlandı" },
                        ]
                      : Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
                    ).map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </AppSelect>
                </div>
                <span>Öncelik: {PRIORITY_LABELS[task.priority]}</span>
                <span>Son Tarih: {formatAppDate(task.dueDate)}</span>
                <span>Sorumlu: {task.assignee?.displayName}</span>
                {task.createdBy && <span>Ekleyen: {task.createdBy.displayName}</span>}
              </div>
              <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {task.status !== "TAMAMLANDI" && (
                    <div>
                      <span className="text-gray-500">Kalan gün:</span>{" "}
                      {daysUntil(task.dueDate) ?? "—"}
                    </div>
                  )}
                  {task.startedAt && (
                    <div>
                      <span className="text-gray-500">Başlatılma:</span>{" "}
                      {daysAgo(task.startedAt) !== null
                        ? daysAgo(task.startedAt) === 0
                          ? "Bugün"
                          : `${daysAgo(task.startedAt)} gün önce`
                        : "—"}
                    </div>
                  )}
                  {task.status === "TAMAMLANDI" && task.completedAt && (
                    <div className="text-gray-600">
                      <span className="text-gray-500">Tamamlanma tarihi:</span>{" "}
                      {formatAppDateTime(task.completedAt)}
                    </div>
                  )}
                </div>
              </div>

              {/* İlgili Kişi - görüntüleme: Ekleyen/Sorumlu aynı kişiyse tek satır (Ekleyen & Sorumlu); diğer ilgili kişiler */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">İlgili Kişi</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  {(() => {
                    const assigneeId = task.assignee?.id;
                    const createdById = task.createdBy?.id;
                    const isSamePerson = assigneeId && createdById && assigneeId === createdById;
                    const items: React.ReactNode[] = [];
                    if (isSamePerson && task.assignee) {
                      items.push(
                        <li key="creator-assignee" className="flex items-center gap-2">
                          <span>{task.assignee.displayName}</span>
                          <span className="text-gray-400">(Ekleyen & Sorumlu)</span>
                        </li>
                      );
                    } else {
                      if (task.createdBy) {
                        items.push(
                          <li key="creator" className="flex items-center gap-2">
                            <span>{task.createdBy.displayName}</span>
                            <span className="text-gray-400">(Ekleyen)</span>
                          </li>
                        );
                      }
                      if (task.assignee) {
                        items.push(
                          <li key="assignee" className="flex items-center gap-2">
                            <span>{task.assignee.displayName}</span>
                            <span className="text-gray-400">(Sorumlu)</span>
                          </li>
                        );
                      }
                    }
                    (task.collaborators ?? []).forEach((c) => {
                      items.push(
                        <li key={c.userId} className="flex items-center gap-2">
                          <span>{c.displayName}</span>
                        </li>
                      );
                    });
                    if (items.length === 0) {
                      items.push(<li key="none" className="text-gray-400">Sadece sorumlu atanmış.</li>);
                    }
                    return items;
                  })()}
                </ul>
              </div>

              {/* Devir geçmişi */}
              {task.assignmentHistory && task.assignmentHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="typo-section-title mb-2">Devir geçmişi</h3>
                  <ul className="space-y-2">
                    {task.assignmentHistory.map((h) => (
                      <li key={h.id} className="border-l-2 border-blue-200 pl-3 py-1.5 text-sm">
                        <p className="text-gray-800 font-medium">
                          {h.fromUser?.displayName ?? "—"} → {h.toUser?.displayName ?? "—"}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatAppDateTime(h.createdAt)}
                        </p>
                        {h.comment?.content && (
                          <p className="text-xs text-gray-600 mt-1 italic">&quot;{h.comment.content}&quot;</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Yorumlar */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="typo-section-title mb-2">Yorumlar</h3>
                <form ref={commentFormRef} onSubmit={handleAddComment} className="mb-3">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.altKey && e.key === "Enter") {
                        e.preventDefault();
                        commentFormRef.current?.requestSubmit();
                      }
                    }}
                    placeholder="Yorum ekleyin... (Alt+Enter ile gönder)"
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={delegateWithComment}
                        onChange={(e) => {
                          setDelegateWithComment(e.target.checked);
                          if (!e.target.checked) setDelegateToUserId("");
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-700">Yorumla birlikte devret</span>
                    </label>
                    {delegateWithComment && (
                      <>
                        <AppSelect
                          value={delegateToUserId}
                          onChange={(v) => setDelegateToUserId(v)}
                          size="sm"
                          aria-label="Yeni sorumlu"
                        >
                          <option value="">Yeni sorumlu seçin</option>
                          {users
                            .filter((u) => u.id !== task?.assigneeId)
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {formatUserDisplayName(u.displayName)}
                              </option>
                            ))}
                        </AppSelect>
                        <AppSelect
                          value={delegateNewStatus}
                          onChange={(v) => setDelegateNewStatus(v)}
                          disabled={deferWithComment}
                          size="sm"
                          aria-label={
                            deferWithComment
                              ? "Erteleme açıkken durum Beklemede olur"
                              : "Yeni durum (isteğe bağlı)"
                          }
                        >
                          <option value="">Durum değiştirme</option>
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </AppSelect>
                      </>
                    )}
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deferWithComment}
                        disabled={task.status === "TAMAMLANDI"}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setDeferWithComment(on);
                          if (!on) {
                            setDeferToDate("");
                            setDeferDays(1);
                            setDeferMode("DAYS");
                          }
                        }}
                        className="rounded border-gray-300 disabled:opacity-50"
                      />
                      <span className="text-xs text-gray-700">Yorumla birlikte ertele</span>
                    </label>
                    {deferWithComment && (
                      <div className="w-full flex flex-wrap items-center gap-2 mt-1 pl-0 sm:pl-0">
                        <AppSelect
                          value={deferMode}
                          onChange={(mode) => {
                            setDeferMode(mode as "DAYS" | "DATE");
                            if (mode === "DATE" && task?.dueDate) {
                              const duePlus1 = parseAppDate(task.dueDate) ?? new Date();
                              duePlus1.setHours(0, 0, 0, 0);
                              duePlus1.setDate(duePlus1.getDate() + 1);
                              const tom = new Date();
                              tom.setHours(0, 0, 0, 0);
                              tom.setDate(tom.getDate() + 1);
                              const pick =
                                duePlus1.getTime() >= tom.getTime() ? duePlus1 : tom;
                              setDeferToDate(toYmdLocal(pick));
                            }
                          }}
                          size="sm"
                          aria-label="Erteleme şekli"
                        >
                          <option value="DAYS">X gün ertele</option>
                          <option value="DATE">Tarih seç</option>
                        </AppSelect>
                        {deferMode === "DAYS" ? (
                          <AppSelect
                            value={String(deferDays)}
                            onChange={(v) => setDeferDays(Number(v))}
                            size="sm"
                            aria-label="Gün sayısı (mevcut son tarihe eklenir, en fazla 30)"
                          >
                            {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {n} gün
                              </option>
                            ))}
                          </AppSelect>
                        ) : (
                          <input
                            type="date"
                            value={deferToDate}
                            onChange={(e) => setDeferToDate(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                            title="Yeni son tarih (bugün ve öncesi seçilemez)"
                            min={tomorrowYmdLocal()}
                          />
                        )}
                        <span className="typo-caption w-full sm:w-auto">
                          Durum <strong>Beklemede</strong> olur. Seçilen veya hesaplanan tarih aynen uygulanır.
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={
                      submittingComment ||
                      !commentText.trim() ||
                      (delegateWithComment && !delegateToUserId) ||
                      (deferWithComment && deferMode === "DATE" && !deferToDate.trim())
                    }
                    className="mt-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {deferWithComment && delegateWithComment && delegateToUserId
                      ? "Yorumu ekle, devret ve ertele"
                      : deferWithComment
                        ? "Yorumu ekle ve ertele"
                        : delegateWithComment && delegateToUserId
                          ? "Yorumu ekle ve devret"
                          : "Yorum Ekle"}
                  </button>
                  <span className="ml-2 text-xs text-gray-500">Alt+Enter</span>
                </form>
                <div className="space-y-2">
                  {task.comments?.map((c) => (
                    <div key={c.id} className="border-l-2 border-gray-200 pl-3 py-1 text-sm">
                      <p className="text-gray-700">{c.content}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.author?.displayName} - {formatAppDateTime(c.createdAt)}
                      </p>
                    </div>
                  ))}
                  {(!task.comments || task.comments.length === 0) && (
                    <p className="text-gray-500 text-sm">Henüz yorum yok.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </ModalShell>
      <ModalShell
        open={showStatusReasonModal}
        onClose={() => {
          setShowStatusReasonModal(false);
          setStatusReasonError("");
        }}
        layer="nested"
        panelClassName="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6"
      >
        {showStatusReasonModal && (
          <>
              <h3 className="typo-modal-title mb-2">Durumu Beklemede Yap</h3>
              <p className="text-sm text-gray-700 mb-3">
                Görevin neden <strong>Beklemede</strong> durumuna alındığını kısaca yazın. Bu metin yorumlara kaydedilecektir.
              </p>
              <textarea
                value={statusReason}
                onChange={(e) => {
                  setStatusReason(e.target.value);
                  if (statusReasonError) setStatusReasonError("");
                }}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Örn: Öncelik değişti, başka bir görev tamamlanana kadar beklemede."
              />
              {statusReasonError && (
                <p className="mt-1 text-xs text-red-600">{statusReasonError}</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowStatusReasonModal(false);
                    setStatusReasonError("");
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmWaitingStatus}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  Kaydet
                </button>
              </div>
          </>
        )}
      </ModalShell>
      <ModalShell
        open={showCompleteConfirm}
        onClose={() => setShowCompleteConfirm(false)}
        layer="nested"
        panelClassName="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6"
      >
        {showCompleteConfirm && (
          <>
              <h3 className="typo-modal-title mb-2">Görevi Tamamla</h3>
              <p className="text-sm text-gray-700 mb-4">
                Bu görevi <strong>tamamlandı</strong> olarak işaretlemek istediğinize emin misiniz?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompleteConfirm(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleCompleteTask}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                >
                  Evet, Tamamla
                </button>
              </div>
          </>
        )}
      </ModalShell>
    </>
  );
}
