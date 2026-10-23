"use client";

import { formatUserDisplayName } from "@/lib/display-name";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useConfirm } from "@/components/ConfirmProvider";
import { AppSelect } from "@/components/AppSelect";
import { ProjectIcon } from "@/components/ProjectIcon";
import { ProjectIconPicker } from "@/components/ProjectIconPicker";
import {
  DEFAULT_PROJECT_ICON_KEY,
  normalizeProjectIconKey,
  type ProjectIconKey,
} from "@/lib/project-icons";

const MEMBER_ROLE_LABELS: Record<string, string> = {
  PROJE_YONETICISI: "Proje Yöneticisi",
  EKIP_UYESI: "Ekip Üyesi",
};

type VisibilityValue = "MEMBERS_ONLY" | "EVERYONE" | "UNIT_MEMBERS";

interface ProjectDetail {
  id: string;
  name: string;
  iconKey?: string | null;
  ownerId: string | null;
  unitId?: string | null;
  visibility?: string;
  allowAnyoneToAddTasks?: boolean;
  owner: { id: string; displayName: string; email: string } | null;
  unit?: { id: string; name: string } | null;
  members: { userId: string; displayName: string; email: string; role?: string }[];
  tasks?: unknown[];
  isOwner?: boolean;
  canManageTeam?: boolean;
}

interface UserOption {
  id: string;
  displayName: string;
  email: string;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editIconKey, setEditIconKey] = useState<ProjectIconKey>(DEFAULT_PROJECT_ICON_KEY);
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editUnitId, setEditUnitId] = useState("");
  const [editVisibility, setEditVisibility] = useState<VisibilityValue>("MEMBERS_ONLY");
  const [editAllowAnyoneToAddTasks, setEditAllowAnyoneToAddTasks] = useState(false);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addMemberRole, setAddMemberRole] = useState<string>("EKIP_UYESI");
  const [memberLoading, setMemberLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { confirm } = useConfirm();

  const fetchProject = () => {
    setLoading(true);
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.project) {
          setProject(d.project);
          setEditName(d.project.name);
          setEditIconKey(normalizeProjectIconKey(d.project.iconKey));
          setEditOwnerId(d.project.ownerId || "");
          setEditUnitId(d.project.unitId || "");
          setEditVisibility((d.project.visibility as VisibilityValue) || "MEMBERS_ONLY");
          setEditAllowAnyoneToAddTasks(!!d.project.allowAnyoneToAddTasks);
        } else setProject(null);
      })
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  useEffect(() => {
    fetch("/api/users/list?filter=active")
      .then((r) => r.json())
      .then((d) => (d.users ? setUsers(d.users) : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/units")
      .then((r) => r.json())
      .then((d) => (d.units ? setUnits(d.units) : []))
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.canManageTeam) return;
    if (editVisibility === "UNIT_MEMBERS" && !editUnitId) {
      setMessage({ type: "error", text: "Sadece birim kullanıcıları seçiliyse birim belirtmelisiniz." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          iconKey: editIconKey,
          ownerId: editOwnerId || null,
          unitId: editUnitId || null,
          visibility: editVisibility,
          allowAnyoneToAddTasks: editAllowAnyoneToAddTasks,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Güncellenemedi");
      setMessage({ type: "success", text: "Proje güncellendi." });
      fetchProject();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Güncellenemedi" });
    } finally {
      setSaving(false);
    }
  };

  const addMemberOptions = users.filter(
    (u) =>
      u.id !== project?.ownerId &&
      !project?.members?.some((m) => m.userId === u.id)
  );

  const handleAddMember = async () => {
    if (!addUserId) return;
    setMemberLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addUserId, role: addMemberRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eklenemedi");
      setMessage({ type: "success", text: "Ekip üyesi eklendi." });
      setAddUserId("");
      fetchProject();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Ekip üyesi eklenemedi." });
    } finally {
      setMemberLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    setMemberLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rol güncellenemedi");
      setMessage({ type: "success", text: "Rol güncellendi." });
      fetchProject();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Rol güncellenemedi." });
    } finally {
      setMemberLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const ok = await confirm({
      title: "Ekip Üyesini Çıkar",
      message: "Bu kişiyi projeden çıkarmak istediğinize emin misiniz?",
      confirmLabel: "Evet, çıkar",
      cancelLabel: "Vazgeç",
    });
    if (!ok) return;
    setMemberLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${id}/members?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Çıkarılamadı");
      setMessage({ type: "success", text: "Ekip üyesi çıkarıldı." });
      fetchProject();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Çıkarılamadı." });
    } finally {
      setMemberLoading(false);
    }
  };

  if (loading) return <p className="typo-loading-on-gradient">Yükleniyor...</p>;
  if (!project) return <p className="typo-muted-on-gradient">Proje bulunamadı.</p>;

  return (
    <div>
      <Link
        href="/dashboard/projects"
        className="text-gray-300 hover:text-white mb-4 inline-block text-sm"
      >
        ← Projeler
      </Link>
      <div
        className="rounded-xl shadow-xl p-6 mb-6 backdrop-blur"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <div className="flex items-center gap-3 mb-1">
          <ProjectIcon
            iconKey={normalizeProjectIconKey(project.iconKey)}
            className="w-6 h-6"
            boxClassName="w-11 h-11"
          />
          <h1 className="typo-page-title-on-card">{project.name}</h1>
        </div>
        {project.unit && (
          <p className="text-sm text-gray-600 mb-4">Birim: {project.unit.name}</p>
        )}
        {!project.unit && <div className="mb-4" />}
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-100 text-green-800 border border-green-300"
                : "bg-red-100 text-red-800 border border-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Ayarlar */}
        {project.canManageTeam && (
          <form onSubmit={handleSave} className="mb-6">
            <h2 className="typo-section-title border-b border-gray-200 pb-2 mb-4">Ayarlar</h2>
            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proje adı</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border border-gray-400/50 rounded-lg px-3 py-2 bg-white/95 text-gray-800 focus:ring-2 focus:ring-[var(--metro-tile-projeler)]/40 focus:border-[var(--metro-tile-projeler)]"
                    placeholder="Proje adı"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proje sorumlusu</label>
                  <AppSelect
                    value={editOwnerId}
                    onChange={(v) => setEditOwnerId(v)}
                    className="w-full"
                  >
                    <option value="">Seçin (opsiyonel)</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {formatUserDisplayName(u.displayName)} ({u.email})
                      </option>
                    ))}
                  </AppSelect>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Proje ikonu</label>
                <ProjectIconPicker
                  value={editIconKey}
                  onChange={setEditIconKey}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Birim</label>
                <AppSelect
                  value={editUnitId}
                  onChange={(v) => setEditUnitId(v)}
                  className="w-full sm:max-w-xs"
                >
                  <option value="">Seçin (opsiyonel)</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </AppSelect>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Görünürlük</label>
                <AppSelect
                  value={editVisibility}
                  onChange={(v) => setEditVisibility(v as VisibilityValue)}
                  className="w-full sm:max-w-xs"
                >
                  <option value="EVERYONE">Tüm kullanıcılar</option>
                  <option value="UNIT_MEMBERS">Sadece birim kullanıcıları</option>
                  <option value="MEMBERS_ONLY">Sadece ekli kişiler</option>
                </AppSelect>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/80 border border-gray-200/80">
                <input
                  type="checkbox"
                  id="allowAnyone"
                  checked={editAllowAnyoneToAddTasks}
                  onChange={(e) => setEditAllowAnyoneToAddTasks(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <label htmlFor="allowAnyone" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Herkes görev/not ekleyebilir
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Üye olmayanlar da ekleyebilir (proje sorumlusu onayı gerekir)
                  </p>
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="btn-cta-projeler px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        )}
        {!project.canManageTeam && project.owner && (
          <div className="mb-6">
            <h2 className="typo-section-title mb-1">Proje sorumlusu</h2>
            <p className="text-gray-600">
              {project.owner.displayName} ({project.owner.email})
            </p>
          </div>
        )}

        {/* Ekip */}
        <div className="border-t border-gray-200 pt-6">
          <h2 className="typo-section-title border-b border-gray-200 pb-2 mb-2">Ekip</h2>
          <p className="typo-caption mb-4">
            Proje sorumlusu veya admin, projeye ekip üyeleri ekleyebilir, rol atayabilir veya çıkarabilir.
          </p>
          <ul className="space-y-2 mb-6">
            {project.owner && (
              <li
                className="flex items-center gap-3 py-2 px-3 rounded-lg text-gray-800 bg-gray-100"
              >
                <span className="font-medium">{project.owner.displayName}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/30 text-amber-900 font-medium">Sorumlu</span>
              </li>
            )}
            {project.members?.map((m) => (
              <li
                key={m.userId}
                className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg text-gray-800 bg-gray-100"
              >
                <span className="font-medium">{m.displayName}</span>
                {project.canManageTeam ? (
                  <>
                    <AppSelect
                      value={m.role || "EKIP_UYESI"}
                      onChange={(v) => handleRoleChange(m.userId, v)}
                      disabled={memberLoading}
                      size="sm"
                    >
                      <option value="EKIP_UYESI">{MEMBER_ROLE_LABELS.EKIP_UYESI}</option>
                      <option value="PROJE_YONETICISI">{MEMBER_ROLE_LABELS.PROJE_YONETICISI}</option>
                    </AppSelect>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.userId)}
                      disabled={memberLoading}
                      className="text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
                    >
                      Çıkar
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-gray-600">
                    {MEMBER_ROLE_LABELS[m.role || "EKIP_UYESI"] || m.role}
                  </span>
                )}
              </li>
            ))}
            {(!project.members || project.members.length === 0) && project.owner && (
              <li className="text-gray-600 text-sm py-2">Henüz ek ekip üyesi yok.</li>
            )}
            {!project.owner && (!project.members || project.members.length === 0) && (
              <li className="text-gray-600 text-sm py-2">
                Proje sorumlusu atandığında buradan ekip ekleyebilirsiniz.
              </li>
            )}
          </ul>

          {project.canManageTeam && addMemberOptions.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg bg-gray-50/80 border border-gray-200/80">
              <AppSelect
                value={addUserId}
                onChange={(v) => setAddUserId(v)}
                size="sm"
                className="flex-1 sm:max-w-[240px]"
              >
                <option value="">Kişi seçin</option>
                {addMemberOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {formatUserDisplayName(u.displayName)} ({u.email})
                  </option>
                ))}
              </AppSelect>
              <AppSelect
                value={addMemberRole}
                onChange={(v) => setAddMemberRole(v)}
                size="sm"
                className="sm:w-[180px]"
              >
                <option value="EKIP_UYESI">{MEMBER_ROLE_LABELS.EKIP_UYESI}</option>
                <option value="PROJE_YONETICISI">{MEMBER_ROLE_LABELS.PROJE_YONETICISI}</option>
              </AppSelect>
              <button
                type="button"
                onClick={handleAddMember}
                disabled={memberLoading || !addUserId}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition shrink-0"
              >
                Ekip üyesi ekle
              </button>
            </div>
          )}
        </div>
      </div>

      <Link
        href={`/dashboard/tasks?projectId=${id}`}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition shadow-sm"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <span>Bu projenin görevlerine git</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
