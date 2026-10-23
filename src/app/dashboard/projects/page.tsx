"use client";

import { formatUserDisplayName } from "@/lib/display-name";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { AppSelect } from "@/components/AppSelect";
import { ProjectIconPicker } from "@/components/ProjectIconPicker";
import {
  PrivateProjectCard,
  ProjectListCard,
  ProjectsEmptyCard,
} from "@/components/ProjectListCard";
import {
  DEFAULT_PROJECT_ICON_KEY,
  type ProjectIconKey,
} from "@/lib/project-icons";

type VisibilityValue = "MEMBERS_ONLY" | "EVERYONE" | "UNIT_MEMBERS";

interface Project {
  id: string;
  name: string;
  iconKey?: string | null;
  ownerId?: string | null;
  unitId?: string | null;
  owner?: { id: string; displayName: string; email: string } | null;
  unit?: { id: string; name: string } | null;
  taskCounts?: {
    total: number;
    completed: number;
    active: number;
    completionPercent: number;
  };
  canDelete?: boolean;
}

interface UserOption {
  id: string;
  displayName: string;
  email: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIconKey, setNewIconKey] = useState<ProjectIconKey>(DEFAULT_PROJECT_ICON_KEY);
  const [ownerId, setOwnerId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [visibility, setVisibility] = useState<VisibilityValue>("MEMBERS_ONLY");
  const [allowAnyoneToAddTasks, setAllowAnyoneToAddTasks] = useState(false);
  const [error, setError] = useState("");
  const [existingProject, setExistingProject] = useState<{ projectId: string; projectName: string } | null>(null);
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [filterUnitId, setFilterUnitId] = useState("");
  const [unitFilterOpen, setUnitFilterOpen] = useState(false);
  const unitFilterRef = useRef<HTMLDivElement>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const router = useRouter();
  const { confirm } = useConfirm();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (unitFilterRef.current && !unitFilterRef.current.contains(e.target as Node)) {
        setUnitFilterOpen(false);
      }
    }
    if (unitFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [unitFilterOpen]);

  const fetchProjects = (onlyMine: boolean, unitFilter: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (onlyMine) params.set("responsibleOnly", "true");
    if (unitFilter) params.set("unitId", unitFilter);
    const query = params.toString() ? `?${params.toString()}` : "";
    fetch(`/api/projects${query}`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects(showOnlyMine, filterUnitId);
  }, [showOnlyMine, filterUnitId]);

  useEffect(() => {
    fetch("/api/users/list?filter=active")
      .then((r) => r.json())
      .then((d) => (d.users ? setUsers(d.users) : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/units?mine=true")
      .then((r) => r.json())
      .then((d) => (d.units ? setUnits(d.units) : []))
      .catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setExistingProject(null);
    if (!newName.trim()) {
      setError("Proje adi gerekli");
      return;
    }
    if (visibility === "UNIT_MEMBERS" && !unitId) {
      setError("Sadece birim kullanıcıları seçiliyse birim belirtmelisiniz.");
      return;
    }
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          iconKey: newIconKey,
          ownerId: ownerId || undefined,
          unitId: unitId || undefined,
          visibility,
          allowAnyoneToAddTasks,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.exists) {
        if (data.isOwner) {
          setError("Bu projeye zaten sahipsiniz. Projeler listesinde görebilirsiniz.");
          return;
        }
        setExistingProject({ projectId: data.projectId, projectName: data.projectName });
        return;
      }
      if (!res.ok) throw new Error(data.error || "Proje olusturulamadi");
      setNewName("");
      setNewIconKey(DEFAULT_PROJECT_ICON_KEY);
      setOwnerId("");
      setUnitId("");
      setVisibility("MEMBERS_ONLY");
      setAllowAnyoneToAddTasks(false);
      setShowForm(false);
      fetchProjects(showOnlyMine, filterUnitId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Proje olusturulamadi");
    }
  };

  const handleJoinRequest = async () => {
    if (!existingProject) return;
    setError("");
    try {
      const res = await fetch(`/api/projects/${existingProject.projectId}/join-request`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Talep olusturulamadi");
      setExistingProject(null);
      setNewName("");
      setShowForm(false);
      fetchProjects(showOnlyMine, filterUnitId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Talep olusturulamadi");
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Projeyi Sil",
      message: "Bu projeyi silmek istediğinize emin misiniz?",
      confirmLabel: "Evet, sil",
      cancelLabel: "Vazgeç",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silinemedi");
      fetchProjects(showOnlyMine, filterUnitId);
    } catch {
      setError("Proje silinemedi");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="typo-page-title">Projeler</h1>
        <div className="flex flex-wrap items-center gap-3">
          {units.length > 0 && (
            <div ref={unitFilterRef} className="relative">
              <button
                type="button"
                onClick={() => setUnitFilterOpen((o) => !o)}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/5 text-white/90 focus:ring-2 focus:ring-[var(--metro-tile-projeler)] flex items-center gap-1.5 min-w-[140px] justify-between"
                aria-expanded={unitFilterOpen}
                aria-haspopup="listbox"
                aria-label="Birim filtresi"
              >
                <span>
                  {filterUnitId ? units.find((u) => u.id === filterUnitId)?.name ?? "Tüm birimler" : "Tüm birimler"}
                </span>
                <svg className={`w-4 h-4 shrink-0 transition-transform ${unitFilterOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {unitFilterOpen && (
                <div
                  className="absolute left-0 top-full mt-1 min-w-[200px] py-1 rounded-lg shadow-xl border border-gray-200 bg-white z-50 max-h-60 overflow-auto"
                  role="listbox"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={!filterUnitId}
                    onClick={() => { setFilterUnitId(""); setUnitFilterOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition ${!filterUnitId ? "bg-indigo-50 text-indigo-800 font-medium" : "text-gray-800 hover:bg-gray-100"}`}
                  >
                    Tüm birimler
                  </button>
                  {units.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      role="option"
                      aria-selected={filterUnitId === u.id}
                      onClick={() => { setFilterUnitId(u.id); setUnitFilterOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition ${filterUnitId === u.id ? "bg-indigo-50 text-indigo-800 font-medium" : "text-gray-800 hover:bg-gray-100"}`}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowOnlyMine((prev) => !prev)}
            className={`px-4 py-2 rounded-lg font-medium border transition ${
              showOnlyMine
                ? "border-[var(--metro-tile-projeler)] bg-[var(--metro-tile-projeler)] text-white shadow-md"
                : "border-white/30 bg-white/5 text-white/90 hover:bg-white/10"
            }`}
          >
            Sorumlu Olduğum Projeler
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-cta-projeler px-5 py-2.5 rounded-lg font-medium shadow-lg transition"
          >
            {showForm ? "İptal" : "Yeni Proje"}
          </button>
        </div>
      </div>
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl shadow-xl p-6 mb-6 backdrop-blur"
          style={{ backgroundColor: "var(--metro-card-bg)" }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proje adı</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Proje adı"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--metro-tile-projeler)]/40 focus:border-[var(--metro-tile-projeler)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Proje ikonu</label>
              <ProjectIconPicker value={newIconKey} onChange={setNewIconKey} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proje sorumlusu</label>
              <AppSelect
                value={ownerId}
                onChange={(v) => setOwnerId(v)}
                className="w-full"
              >
                <option value="">Seçin (opsiyonel)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {formatUserDisplayName(u.displayName)} ({u.email})
                  </option>
                ))}
              </AppSelect>
              <p className="text-xs text-gray-500 mt-1">Sorumlu, projeye ekip üyesi ekleyip çıkarabilir.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Birim</label>
              <AppSelect
                value={unitId}
                onChange={(v) => setUnitId(v)}
                className="w-full"
              >
                <option value="">Seçin (opsiyonel)</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </AppSelect>
              <p className="text-xs text-gray-500 mt-1">Projeyi bir birime bağlayabilirsiniz. &quot;Sadece birim kullanıcıları&quot; seçiliyse zorunludur.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Görünürlük</label>
              <AppSelect
                value={visibility}
                onChange={(v) => setVisibility(v as VisibilityValue)}
                className="w-full"
              >
                <option value="EVERYONE">Tüm kullanıcılar</option>
                <option value="UNIT_MEMBERS">Sadece birim kullanıcıları</option>
                <option value="MEMBERS_ONLY">Sadece ekli kişiler</option>
              </AppSelect>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAnyoneToAddTasks}
                  onChange={(e) => setAllowAnyoneToAddTasks(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Herkes bu projeye görev/not ekleyebilir</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                İşaretlenirse, üye olmayanlar da görev eklerken bu projeyi seçebilir (proje sorumlusu onayı gerekir).
              </p>
            </div>
            {existingProject && (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  Bu isimde bir proje zaten mevcut. &quot;{existingProject.projectName}&quot; projesine katılmak ister misiniz?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleJoinRequest}
                    className="px-4 py-2 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Evet, katılım talebi gönder
                  </button>
                  <button
                    type="button"
                    onClick={() => setExistingProject(null)}
                    className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Hayır
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!!existingProject}
                className="btn-cta-projeler px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                Oluştur
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setExistingProject(null);
                  setNewIconKey(DEFAULT_PROJECT_ICON_KEY);
                  setUnitId("");
                  setVisibility("MEMBERS_ONLY");
                  setAllowAnyoneToAddTasks(false);
                }}
                className="px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium"
              >
                İptal
              </button>
            </div>
          </div>
          {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
        </form>
      )}
      {loading ? (
        <p className="typo-loading-on-gradient">Yükleniyor...</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 items-start">
          <PrivateProjectCard
            onOpen={() => router.push("/dashboard/tasks?view=private")}
          />
          {projects.map((p) => (
            <ProjectListCard
              key={p.id}
              project={p}
              menuOpenId={menuOpenId}
              setMenuOpenId={setMenuOpenId}
              onDelete={handleDelete}
            />
          ))}
          {projects.length === 0 && <ProjectsEmptyCard />}
        </div>
      )}
    </div>
  );
}
