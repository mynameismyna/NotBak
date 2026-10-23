"use client";

import { formatUserDisplayName } from "@/lib/display-name";

import { useState, useEffect } from "react";
import { AppSelect } from "@/components/AppSelect";
import { RelatedPersonMultiSelect } from "@/components/RelatedPersonMultiSelect";
import { tomorrowYmdLocal } from "@/lib/date-input";

interface User {
  id: string;
  displayName: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
  ownerId?: string | null;
  owner?: { id: string; displayName: string; email: string } | null;
}

interface TaskFormProps {
  defaultProjectId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: {
    title: string;
    description: string;
    type: string;
    status: string;
    priority: string;
    dueDate: string;
    assigneeId: string;
    projectId: string;
  };
  taskId?: string;
  /** Tip dışarıdan verildiğinde (örn. modal başlık satırında) formda Tip alanı gösterilmez. */
  type?: string;
  onTypeChange?: (value: string) => void;
  /** Bana Özel: sadece sahibi ve adminler görebilir. */
  isPrivate?: boolean;
  onPrivateChange?: (value: boolean) => void;
}

const TASK_TYPES = [
  { value: "GOREV", label: "Görev" },
  { value: "NOT", label: "Not" },
  { value: "FIKIR", label: "Fikir" },
];

const TASK_STATUSES = [
  { value: "YENI", label: "Yeni" },
  { value: "ONAY_BEKLIYOR", label: "Onay Bekliyor" },
  { value: "DEVAM_EDIYOR", label: "Devam Ediyor" },
  { value: "BEKLEMEDE", label: "Beklemede" },
  { value: "TAMAMLANDI", label: "Tamamlandı" },
  { value: "REDDEDILDI", label: "Reddedildi" },
];

const PRIORITIES = [
  { value: "URGENT", label: "Acil" },
  { value: "HIGH", label: "Yüksek" },
  { value: "MEDIUM", label: "Orta" },
  { value: "LOW", label: "Düşük" },
];

export function TaskForm(props: TaskFormProps) {
  const { defaultProjectId, onSuccess, onCancel, initialData, taskId, type: externalType, onTypeChange, isPrivate: externalPrivate, onPrivateChange } = props;
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    type: initialData?.type || "GOREV",
    status: initialData?.status || "YENI",
    priority: initialData?.priority || "MEDIUM",
    dueDate: initialData?.dueDate || tomorrowYmdLocal(),
    assigneeId: initialData?.assigneeId || "",
    projectId: initialData?.projectId || defaultProjectId || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedRelatedUserIds, setSelectedRelatedUserIds] = useState<string[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [projectRelatedUsers, setProjectRelatedUsers] = useState<User[]>([]);
  const [projectRelatedLoading, setProjectRelatedLoading] = useState(false);

  const isNewOnly = !taskId;
  const isPrivate = isNewOnly && !!externalPrivate;

  // Bana Özel seçildiğinde proje ve sorumlu alanlarını sıfırla; backend zaten oturum sahibini atayacak.
  useEffect(() => {
    if (isPrivate) {
      setFormData((prev) => ({
        ...prev,
        projectId: "",
        assigneeId: "",
      }));
    }
  }, [isPrivate]);

  // Sorumlu kişi ilgili kişi listesinde olamaz
  useEffect(() => {
    const assigneeId = isPrivate ? currentUserId : formData.assigneeId;
    if (!assigneeId) return;
    setSelectedRelatedUserIds((prev) => prev.filter((id) => id !== assigneeId));
  }, [isPrivate, formData.assigneeId, currentUserId]);

  // Proje seçiliyken ilgili kişi listesi yalnızca proje ekibinden gelir
  useEffect(() => {
    if (!isNewOnly || isPrivate || !formData.projectId) {
      setProjectRelatedUsers([]);
      setProjectRelatedLoading(false);
      return;
    }
    let cancelled = false;
    setProjectRelatedLoading(true);
    fetch(`/api/projects/${formData.projectId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const project = d.project;
        if (!project) {
          setProjectRelatedUsers([]);
          return;
        }
        const byId = new Map<string, User>();
        if (project.owner) {
          byId.set(project.owner.id, {
            id: project.owner.id,
            displayName: project.owner.displayName,
            email: project.owner.email,
          });
        }
        (project.members || []).forEach(
          (m: { userId: string; displayName: string; email: string }) => {
            byId.set(m.userId, {
              id: m.userId,
              displayName: m.displayName,
              email: m.email,
            });
          }
        );
        setProjectRelatedUsers(Array.from(byId.values()));
      })
      .catch(() => {
        if (!cancelled) setProjectRelatedUsers([]);
      })
      .finally(() => {
        if (!cancelled) setProjectRelatedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.projectId, isNewOnly, isPrivate]);

  useEffect(() => {
    if (isPrivate || !formData.projectId) return;
    const allowed = new Set(projectRelatedUsers.map((u) => u.id));
    setSelectedRelatedUserIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [formData.projectId, isPrivate, projectRelatedUsers]);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setCurrentUserId(d.user?.id ?? null))
      .catch(() => {});
    fetch("/api/users/list?filter=active")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {})
      .finally(() => setUsersLoaded(true));
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.projects || []);
        if (defaultProjectId && !isPrivate) {
          const proj = d.projects?.find((p: Project) => p.id === defaultProjectId);
          if (proj?.owner?.id) {
            setFormData((prev) => {
              const projectId = prev.projectId || defaultProjectId;
              const isDefaultProject = projectId === defaultProjectId;
              return {
                ...prev,
                projectId,
                assigneeId: isDefaultProject ? proj.owner!.id : prev.assigneeId,
              };
            });
          }
        }
      })
      .catch(() => {});
  }, [defaultProjectId, isPrivate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      // Bugün ve önceki günler son tarih olamaz (yarın ve sonrası)
      const selected = new Date(formData.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selected.setHours(0, 0, 0, 0);
      if (selected.getTime() <= today.getTime()) {
        setError("Bugün ve geçmiş tarihler son tarih olarak seçilemez.");
        return;
      }

      if (!isNewOnly && formData.status === "BEKLEMEDE" && !statusReason.trim()) {
        setError("Beklemede durumuna geçerken yorumlara bir gerekçe yazmanız gerekiyor.");
        return;
      }
      setLoading(true);
      const url = taskId ? `/api/tasks/${taskId}` : "/api/tasks";
      const method = taskId ? "PATCH" : "POST";
      const body = {
        title: formData.title,
        description: formData.description,
        type: externalType ?? formData.type,
        status: isNewOnly ? "YENI" : formData.status,
        priority: formData.priority,
        dueDate: formData.dueDate,
        // Bana Özel kayıtlarda backend sorumluyu oturum açan kullanıcıya zorunlu atar.
        assigneeId: isPrivate ? undefined : formData.assigneeId,
        ...(!isPrivate && formData.projectId ? { projectId: formData.projectId } : {}),
        ...(isNewOnly && externalPrivate !== undefined ? { isPrivate: externalPrivate } : {}),
        ...(isNewOnly && selectedRelatedUserIds.length > 0
          ? { collaboratorIds: selectedRelatedUserIds }
          : {}),
        ...(!isNewOnly && formData.status === "BEKLEMEDE" && statusReason.trim()
          ? { statusReason: statusReason.trim() }
          : {}),
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İşlem başarısız");
      if (isNewOnly) setSelectedRelatedUserIds([]);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setLoading(false);
    }
  };

  const showTipInForm = externalType === undefined;
  const effectiveAssigneeId = isPrivate ? currentUserId : formData.assigneeId || null;
  const usesProjectTeam = !isPrivate && !!formData.projectId;
  const relatedPersonUsers = usesProjectTeam ? projectRelatedUsers : users;
  const relatedPersonLoading = usesProjectTeam
    ? projectRelatedLoading || !usersLoaded
    : !usersLoaded;
  const relatedEmptyMessage = usesProjectTeam
    ? "Seçili projede eklenebilecek başka kişi bulunmuyor."
    : "Eklenebilecek başka aktif kullanıcı bulunmuyor.";
  const selectedProjectName = projects.find((p) => p.id === formData.projectId)?.name;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Başlık *</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          className="w-full border rounded px-3 py-2"
          maxLength={200}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Açıklama *</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          required
          rows={3}
          className="w-full border rounded px-3 py-2"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Öncelik *</label>
          <AppSelect
            value={formData.priority}
            onChange={(v) => setFormData({ ...formData, priority: v })}
            required
            className="w-full"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </AppSelect>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Son Tarih *</label>
          <input
            type="date"
            value={formData.dueDate}
            min={tomorrowYmdLocal()}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Sorumlu *</label>
          <AppSelect
            value={formData.assigneeId}
            onChange={(v) => setFormData({ ...formData, assigneeId: v })}
            required={!isPrivate}
            disabled={!!formData.projectId || isPrivate}
            className="w-full"
          >
            <option value="">Seçin</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{formatUserDisplayName(u.displayName)} ({u.email})</option>
            ))}
          </AppSelect>
          {isPrivate && (
            <p className="text-xs text-gray-500 mt-1">
              Bana Özel seçildiğinde sorumlu otomatik olarak kaydı oluşturan kişi olur.
            </p>
          )}
          {!isPrivate && formData.projectId && (
            <p className="text-xs text-gray-500 mt-1">Proje seçili olduğunda sorumlu, proje sorumlusu olarak kilitlenir.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Proje</label>
          <AppSelect
            value={formData.projectId}
            onChange={(projectId) => {
              const proj = projects.find((p) => p.id === projectId);
              setFormData((prev) => ({
                ...prev,
                projectId,
                assigneeId: proj?.owner?.id ? proj.owner.id : prev.assigneeId,
              }));
              setSelectedRelatedUserIds([]);
            }}
            disabled={isPrivate}
            className="w-full"
          >
            <option value="">Seçin (opsiyonel)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </AppSelect>
          {isPrivate ? (
            <p className="text-xs text-gray-500 mt-1">Bana Özel görevlerde proje seçilemez.</p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">Proje seçilirse, proje sorumlusu otomatik Sorumlu olarak atanır.</p>
          )}
        </div>
      </div>
      {isNewOnly && (
        <div>
          <label className="block text-sm font-medium mb-1">İlgili Kişiler</label>
          <p className="text-xs text-gray-500 mb-2">
            {usesProjectTeam
              ? `"${selectedProjectName || "Seçili proje"}" projesinin ekibinden ilgili kişi seçebilirsiniz (opsiyonel).`
              : "Kayıtla birlikte bilgilendirilmesini istediğiniz kişileri seçebilirsiniz (opsiyonel)."}
          </p>
          <RelatedPersonMultiSelect
            users={relatedPersonUsers}
            selectedIds={selectedRelatedUserIds}
            onChange={setSelectedRelatedUserIds}
            excludeUserIds={effectiveAssigneeId ? [effectiveAssigneeId] : []}
            loading={relatedPersonLoading}
            emptyMessage={relatedEmptyMessage}
            placeholder="İlgili kişiler seçin..."
          />
        </div>
      )}
      {showTipInForm && (
        <div>
          <label className="block text-sm font-medium mb-1">Tip</label>
          <AppSelect
            value={formData.type}
            onChange={(v) => setFormData({ ...formData, type: v })}
            className="w-full"
          >
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </AppSelect>
        </div>
      )}
      {!isNewOnly && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">Durum</label>
            <AppSelect
              value={formData.status}
              onChange={(v) => setFormData({ ...formData, status: v })}
              className="w-full"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </AppSelect>
          </div>
          {formData.status === "BEKLEMEDE" && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Beklemede Gerekçesi <span className="text-red-500">*</span>
              </label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={2}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Örn: Öncelik değişti, başka bir görevin tamamlanması bekleniyor."
              />
              <p className="mt-1 text-xs text-gray-500">
                Bu metin, görev yorumlarına otomatik olarak eklenecektir.
              </p>
            </div>
          )}
        </>
      )}
      {error && <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Kaydediliyor..." : taskId ? "Güncelle" : "Oluştur"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">
            İptal
          </button>
        )}
      </div>
    </form>
  );
}
