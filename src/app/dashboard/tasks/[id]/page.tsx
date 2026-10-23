"use client";

import { formatUserDisplayName } from "@/lib/display-name";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TaskForm } from "@/components/TaskForm";
import { normalizeTaskTitleForDisplay, normalizeTaskDescriptionForDisplay } from "@/lib/task-display";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { ModalShell } from "@/components/ModalShell";
import { toYmdLocal, tomorrowYmdLocal } from "@/lib/date-input";
import { AppSelect } from "@/components/AppSelect";

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
  canComplete?: boolean;
  canEdit?: boolean;
  assignee: { id: string; displayName: string; email: string };
  createdBy?: { id: string; displayName: string; email: string } | null;
  project: { id: string; name: string };
  collaborators?: Collaborator[];
  comments: { id: string; content: string; createdAt: string; author: { displayName: string } }[];
  assignmentHistory?: AssignmentHistoryEntry[];
  rejectionReason?: string | null;
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

/** Bugünden tarihe kalan gün (pozitif: gelecek). */
function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/** Tarihten bugüne geçen gün sayısı (pozitif: geçmiş). */
function daysAgo(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
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

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();
  const id = params.id as string;
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [startingTask, setStartingTask] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeDateTime, setCompleteDateTime] = useState("");
  const [completingTask, setCompletingTask] = useState(false);
  const [acceptingTask, setAcceptingTask] = useState(false);
  const [rejectingTask, setRejectingTask] = useState(false);
  const [users, setUsers] = useState<{ id: string; displayName: string; email: string }[]>([]);
  const [addCollaboratorUserId, setAddCollaboratorUserId] = useState("");
  const [collaboratorLoading, setCollaboratorLoading] = useState(false);
  const [delegateWithComment, setDelegateWithComment] = useState(false);
  const [delegateToUserId, setDelegateToUserId] = useState("");
  const [delegateNewStatus, setDelegateNewStatus] = useState("");
  const [deferWithComment, setDeferWithComment] = useState(false);
  const [deferMode, setDeferMode] = useState<"DAYS" | "DATE">("DAYS");
  const [deferDays, setDeferDays] = useState(1);
  const [deferToDate, setDeferToDate] = useState("");
  const [undoRejectLoading, setUndoRejectLoading] = useState(false);
  const commentFormRef = useRef<HTMLFormElement>(null);

  const fetchTask = () => {
    fetch(`/api/tasks/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTask(d.task))
      .catch(() => setTask(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTask();
  }, [id]);

  useEffect(() => {
    fetch("/api/users/list?filter=active")
      .then((r) => r.json())
      .then((d) => (d.users ? setUsers(d.users) : []))
      .catch(() => {});
  }, []);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (delegateWithComment && !delegateToUserId) {
      toast.showToast("Devret seçeneği işaretli; lütfen yeni sorumlu seçin.", "error");
      return;
    }
    if (deferWithComment && deferMode === "DATE" && !deferToDate.trim()) {
      toast.showToast("Erteleme için tarih seçin.", "error");
      return;
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
        taskId: id,
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
      }
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : "Yorum eklenemedi", "error");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Görevi Sil",
      message: "Bu görevi silmek istediğinize emin misiniz?",
      confirmLabel: "Evet, sil",
      cancelLabel: "Vazgeç",
    });
    if (!ok) return;
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard/tasks");
  };

  const handleSendToCalendar = async () => {
    try {
      const res = await fetch(`/api/tasks/${id}/send-to-calendar`, { method: "POST" });
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

  const handleAcceptTask = async () => {
    setAcceptingTask(true);
    try {
      const res = await fetch(`/api/tasks/${id}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kabul başarısız");
      fetchTask();
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : "Kabul başarısız", "error");
    } finally {
      setAcceptingTask(false);
    }
  };

  const handleRejectTask = async () => {
    setRejectingTask(true);
    try {
      const res = await fetch(`/api/tasks/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Red başarısız");
      fetchTask();
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : "Red başarısız", "error");
    } finally {
      setRejectingTask(false);
    }
  };

  const handleStartTask = async () => {
    setStartingTask(true);
    try {
      const res = await fetch(`/api/tasks/${id}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Görev başlatılamadı");
      fetchTask();
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : "Görev başlatılamadı", "error");
    } finally {
      setStartingTask(false);
    }
  };

  const openCompleteModal = () => {
    const now = new Date();
    setCompleteDateTime(formatDateTimeLocal(now));
    setShowCompleteModal(true);
  };

  const handleCompleteTask = async () => {
    if (!completeDateTime) return;
    setCompletingTask(true);
    try {
      const selected = new Date(completeDateTime);
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "TAMAMLANDI",
          completedAt: selected.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Görev tamamlanamadı");
      setShowCompleteModal(false);
      fetchTask();
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : "Görev tamamlanamadı", "error");
    } finally {
      setCompletingTask(false);
    }
  };

  const canManageCollaborators = task?.isAssignee;
  const addCollaboratorOptions = users.filter(
    (u) =>
      u.id !== task?.assigneeId &&
      !task?.collaborators?.some((c) => c.userId === u.id)
  );

  const handleAddCollaborator = async () => {
    if (!addCollaboratorUserId) return;
    setCollaboratorLoading(true);
    try {
      const res = await fetch(`/api/tasks/${id}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addCollaboratorUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ekleme başarısız");
      setAddCollaboratorUserId("");
      fetchTask();
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : "Ekip üyesi eklenemedi", "error");
    } finally {
      setCollaboratorLoading(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    const ok = await confirm({
      title: "İlgili Kişiyi Kaldır",
      message: "Bu kişiyi görevden çıkarmak istediğinize emin misiniz?",
      confirmLabel: "Evet, kaldır",
      cancelLabel: "Vazgeç",
    });
    if (!ok) return;
    setCollaboratorLoading(true);
    try {
      const res = await fetch(`/api/tasks/${id}/collaborators?userId=${encodeURIComponent(userId)}`, {
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

  const handleUndoReject = async () => {
    setUndoRejectLoading(true);
    try {
      const res = await fetch(`/api/tasks/${id}/undo-reject`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reddi geri alınamadı");
      toast.showToast("Reddi geri aldınız; görev tekrar sizin üzerinizde.", "success");
      fetchTask();
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : "İşlem başarısız", "error");
    } finally {
      setUndoRejectLoading(false);
    }
  };

  if (loading) return <p className="typo-loading-on-gradient">Yükleniyor...</p>;
  if (!task) return <p>Görev bulunamadı.</p>;

  const isNote = task.type === "NOT";
  const isRejected = task.status === "REDDEDILDI";
  const isPendingApproval = task.type === "GOREV" && task.status === "ONAY_BEKLIYOR";
  const displayStatus =
    isNote && task.status !== "TAMAMLANDI"
      ? "Bekleyen"
      : STATUS_LABELS[task.status] ?? task.status;

  return (
    <div>
      <Link href="/dashboard/tasks" className="text-blue-600 hover:underline mb-4 inline-block">
        Geri
      </Link>
      {editing ? (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="typo-section-title mb-4">Görevi Düzenle</h2>
          <TaskForm
            taskId={id}
            initialData={{
              title: task.title,
              description: task.description,
              type: task.type,
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDate.slice(0, 10),
              assigneeId: task.assigneeId || "",
              projectId: task.projectId || "",
            }}
            onSuccess={() => {
              setEditing(false);
              fetchTask();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="typo-page-title-on-card">{normalizeTaskTitleForDisplay(task.title)}</h1>
              <p className="text-gray-500 mt-1">{task.project?.name || (task.title && /^\[Proje\s*Adı\s*\(opsiyonel\)\]/i.test(task.title) ? "Proje adı" : null)}</p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {isRejected && task.rejectionReason && (
                <div className="w-full mb-2 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                  <strong>Red gerekçesi:</strong> {task.rejectionReason}
                </div>
              )}
              {isRejected && task.isAssigneeOrCollaborator && (
                <button
                  onClick={handleUndoReject}
                  disabled={undoRejectLoading}
                  className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 disabled:opacity-50"
                >
                  {undoRejectLoading ? "İşleniyor..." : "Reddi geri al"}
                </button>
              )}
              {isRejected && task.canEdit && !task.isAssignee && (
                <button
                  onClick={() => setEditing(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Tekrar ata
                </button>
              )}
              {!isRejected &&
                !isNote &&
                !isPendingApproval &&
                task.status === "YENI" &&
                task.isAssigneeOrCollaborator && (
                <button
                  onClick={handleStartTask}
                  disabled={startingTask}
                  className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  {startingTask ? "Başlatılıyor..." : "Görevi başlat"}
                </button>
              )}
              {!isRejected && isPendingApproval && task.isAssigneeOrCollaborator && (
                <>
                  <button
                    onClick={handleAcceptTask}
                    disabled={acceptingTask || rejectingTask}
                    className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {acceptingTask ? "İşleniyor..." : "Kabul Et"}
                  </button>
                  <button
                    onClick={handleRejectTask}
                    disabled={acceptingTask || rejectingTask}
                    className="bg-red-100 text-red-700 px-4 py-2 rounded hover:bg-red-200 disabled:opacity-50"
                  >
                    {rejectingTask ? "İşleniyor..." : "Reddet"}
                  </button>
                </>
              )}
              {!isRejected &&
                !isPendingApproval &&
                task.status !== "TAMAMLANDI" &&
                (task.canComplete ?? task.isAssigneeOrCollaborator) && (
                <button
                  onClick={openCompleteModal}
                  disabled={completingTask}
                  className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  {completingTask ? "Kaydediliyor..." : isNote ? "Notu Tamamla" : "Görevi Tamamla"}
                </button>
              )}
              <button
                onClick={handleSendToCalendar}
                className="text-blue-600 hover:underline"
              >
                Takvime ekle
              </button>
              {task.canEdit && (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-blue-600 hover:underline"
                  >
                    Düzenle
                  </button>
                  <button onClick={handleDelete} className="text-red-600 hover:underline">
                    Sil
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="mt-4 text-gray-700 whitespace-pre-wrap">{normalizeTaskDescriptionForDisplay(task.description)}</p>
          <div className="flex gap-4 mt-4 text-sm flex-wrap">
            <span>Durum: {displayStatus}</span>
            <span>Öncelik: {PRIORITY_LABELS[task.priority]}</span>
            <span>Son Tarih: {new Date(task.dueDate).toLocaleDateString("tr-TR")}</span>
            <span>Sorumlu: {task.assignee?.displayName}</span>
            {task.createdBy && <span>Ekleyen: {task.createdBy.displayName}</span>}
          </div>
          <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {task.status !== "TAMAMLANDI" && (
                <div>
                  <span className="text-gray-500">Kalan gün:</span>{" "}
                  {daysUntil(task.dueDate) > 0
                    ? `${daysUntil(task.dueDate)} gün`
                    : daysUntil(task.dueDate) === 0
                      ? "Bugün"
                      : `${Math.abs(daysUntil(task.dueDate))} gün gecikmiş`}
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
                  {new Date(task.completedAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                </div>
              )}
            </div>
          </div>
          {((task.collaborators?.length ?? 0) > 0 || canManageCollaborators || task.createdBy || task.assignee) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Ekip</h3>
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
                    );
                  });
                  return items;
                })()}
              </ul>
              {canManageCollaborators && addCollaboratorOptions.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap items-center">
                  <AppSelect
                    value={addCollaboratorUserId}
                    onChange={(v) => setAddCollaboratorUserId(v)}
                    size="sm"
                    aria-label="İlgili kişi seçin"
                  >
                    <option value="">Kisi secin</option>
                    {addCollaboratorOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {formatUserDisplayName(u.displayName)} ({u.email})
                      </option>
                    ))}
                  </AppSelect>
                  <button
                    type="button"
                    onClick={handleAddCollaborator}
                    disabled={collaboratorLoading || !addCollaboratorUserId}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Ekle
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <ModalShell
        open={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        layer="base"
        panelClassName="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6"
      >
        <h3 className="typo-section-title mb-2">
          {isNote ? "Notu Tamamla" : "Görevi Tamamla"}
        </h3>
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
            onClick={() => setShowCompleteModal(false)}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleCompleteTask}
            disabled={completingTask || !completeDateTime}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {completingTask ? "Kaydediliyor..." : "Tamamla"}
          </button>
        </div>
      </ModalShell>
      {task.assignmentHistory && task.assignmentHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="typo-section-title mb-4">Devir geçmişi</h2>
          <ul className="space-y-3">
            {task.assignmentHistory.map((h) => (
              <li key={h.id} className="border-l-2 border-blue-200 pl-4 py-2">
                <p className="text-gray-800 font-medium">
                  {h.fromUser?.displayName ?? "—"} → {h.toUser?.displayName ?? "—"}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {new Date(h.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {h.comment?.content && (
                  <p className="text-sm text-gray-600 mt-1 italic">&quot;{h.comment.content}&quot;</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="typo-section-title mb-4">Yorumlar</h2>
        <form ref={commentFormRef} onSubmit={handleAddComment} className="mb-4">
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
            rows={3}
            className="w-full border rounded px-3 py-2"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={delegateWithComment}
                onChange={(e) => {
                  setDelegateWithComment(e.target.checked);
                  if (!e.target.checked) setDelegateToUserId("");
                }}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Yorumla birlikte devret</span>
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
            <label className="inline-flex items-center gap-2 cursor-pointer">
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
              <span className="text-sm text-gray-700">Yorumla birlikte ertele</span>
            </label>
            {deferWithComment && (
              <div className="w-full flex flex-wrap items-center gap-2 mt-1">
                <AppSelect
                  value={deferMode}
                  onChange={(mode) => {
                    setDeferMode(mode as "DAYS" | "DATE");
                    if (mode === "DATE" && task?.dueDate) {
                      const duePlus1 = new Date(task.dueDate);
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
                    aria-label="Mevcut son tarihe eklenecek gün (en fazla 30)"
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
                    className="border rounded px-3 py-1.5 text-sm"
                    title="Yeni son tarih (bugün ve öncesi seçilemez)"
                    min={tomorrowYmdLocal()}
                  />
                )}
                <span className="text-xs text-gray-500 w-full">
                  Durum <strong>Beklemede</strong> olur. Tarih seçimi veya hesaplama olduğu gibi uygulanır.
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
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {deferWithComment && delegateWithComment && delegateToUserId
              ? "Yorumu ekle, devret ve ertele"
              : deferWithComment
                ? "Yorumu ekle ve ertele"
                : delegateWithComment && delegateToUserId
                  ? "Yorumu ekle ve devret"
                  : "Yorum Ekle"}
          </button>
          <span className="ml-2 text-sm text-gray-500">Alt+Enter</span>
        </form>
        <div className="space-y-3">
          {task.comments?.map((c) => (
            <div key={c.id} className="border-l-2 border-gray-200 pl-4 py-2">
              <p className="text-gray-700">{c.content}</p>
              <p className="text-sm text-gray-500 mt-1">
                {c.author?.displayName} - {new Date(c.createdAt).toLocaleString("tr-TR")}
              </p>
            </div>
          ))}
          {(!task.comments || task.comments.length === 0) && (
            <p className="text-gray-500">Henuz yorum yok.</p>
          )}
        </div>
      </div>
    </div>
  );
}
