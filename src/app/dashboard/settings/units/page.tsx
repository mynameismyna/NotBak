"use client";

import { formatUserDisplayName } from "@/lib/display-name";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ModalShell } from "@/components/ModalShell";
import { useRouter } from "next/navigation";
import { AppSelect } from "@/components/AppSelect";

interface Unit {
  id: string;
  name: string;
}

interface UnitMember {
  userId: string;
  displayName: string;
  email: string;
  role: string;
}

interface UnitWithMembers {
  id: string;
  name: string;
  members: UnitMember[];
}

interface ListUser {
  id: string;
  displayName: string;
  email: string;
}

export default function UnitsPage() {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteUnit, setDeleteUnit] = useState<Unit | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [membersUnit, setMembersUnit] = useState<UnitWithMembers | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [users, setUsers] = useState<ListUser[]>([]);
  const [addMemberUserId, setAddMemberUserId] = useState("");
  const [addMemberRole, setAddMemberRole] = useState<"EKIP_UYESI" | "BIRIM_YONETICISI">("EKIP_UYESI");
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [roleChangeLoading, setRoleChangeLoading] = useState<string | null>(null);
  const [removeMemberLoading, setRemoveMemberLoading] = useState<string | null>(null);

  const fetchUnits = () => {
    setLoading(true);
    setMessage(null);
    fetch("/api/units")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setMessage({ type: "error", text: data.error });
          setUnits([]);
        } else if (Array.isArray(data.units)) {
          setUnits(data.units);
        } else {
          setUnits([]);
        }
      })
      .catch(() => setMessage({ type: "error", text: "Birimler yüklenemedi" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => { if (!data.canAccessSettings) router.replace("/dashboard"); })
      .catch(() => router.replace("/dashboard"));
  }, [router]);

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = addName.trim();
    if (!name) {
      setMessage({ type: "error", text: "Birim adı gerekli" });
      return;
    }
    setAddLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Birim eklenemedi");
      setMessage({ type: "success", text: "Birim eklendi" });
      setShowAddModal(false);
      setAddName("");
      fetchUnits();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Birim eklenemedi" });
    } finally {
      setAddLoading(false);
    }
  };

  const openEdit = (unit: Unit) => {
    setEditUnit(unit);
    setEditName(unit.name);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUnit) return;
    const name = editName.trim();
    if (!name) {
      setMessage({ type: "error", text: "Birim adı gerekli" });
      return;
    }
    setEditLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/units/${editUnit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Birim güncellenemedi");
      setMessage({ type: "success", text: "Birim güncellendi" });
      setEditUnit(null);
      setEditName("");
      fetchUnits();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Birim güncellenemedi" });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUnit) return;
    setDeleteLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/units/${deleteUnit.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Birim silinemedi");
      setMessage({ type: "success", text: "Birim silindi" });
      setDeleteUnit(null);
      fetchUnits();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Birim silinemedi" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openMembersModal = async (unit: Unit) => {
    setMembersUnit(null);
    setAddMemberUserId("");
    setAddMemberRole("EKIP_UYESI");
    setMembersLoading(true);
    try {
      const [unitRes, usersRes] = await Promise.all([
        fetch(`/api/units/${unit.id}`),
        fetch("/api/users/list?filter=all"),
      ]);
      const unitData = await unitRes.json();
      const usersData = await usersRes.json();
      if (!unitRes.ok) throw new Error(unitData.error || "Birim alınamadı");
      if (unitData.unit) setMembersUnit(unitData.unit);
      if (Array.isArray(usersData.users)) setUsers(usersData.users);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Birim üyeleri yüklenemedi" });
      setMembersUnit(null);
    } finally {
      setMembersLoading(false);
    }
  };

  const fetchUnitMembers = async () => {
    if (!membersUnit) return;
    try {
      const res = await fetch(`/api/units/${membersUnit.id}`);
      const data = await res.json();
      if (res.ok && data.unit) setMembersUnit(data.unit);
    } catch {
      // ignore
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membersUnit || !addMemberUserId.trim()) return;
    setAddMemberLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/units/${membersUnit.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addMemberUserId.trim(), role: addMemberRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Üye eklenemedi");
      setMessage({ type: "success", text: "Üye eklendi" });
      setAddMemberUserId("");
      setAddMemberRole("EKIP_UYESI");
      await fetchUnitMembers();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Üye eklenemedi" });
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "EKIP_UYESI" | "BIRIM_YONETICISI") => {
    if (!membersUnit) return;
    setRoleChangeLoading(userId);
    try {
      const res = await fetch(`/api/units/${membersUnit.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rol güncellenemedi");
      await fetchUnitMembers();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Rol güncellenemedi" });
    } finally {
      setRoleChangeLoading(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!membersUnit) return;
    setRemoveMemberLoading(userId);
    try {
      const res = await fetch(`/api/units/${membersUnit.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Üye çıkarılamadı");
      setMessage({ type: "success", text: "Üye birimden çıkarıldı" });
      await fetchUnitMembers();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Üye çıkarılamadı" });
    } finally {
      setRemoveMemberLoading(null);
    }
  };

  const membersAlreadyInUnit = new Set((membersUnit?.members ?? []).map((m) => m.userId));
  const usersNotInUnit = users.filter((u) => !membersAlreadyInUnit.has(u.id));

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/settings"
          className="text-gray-600 hover:text-gray-900 text-sm"
        >
          ← Ayarlar
        </Link>
      </div>
      <h1 className="typo-page-title mb-6">Birim Tanımları</h1>
      <p className="typo-muted-on-gradient mb-4">
        Birimleri buradan tanımlayın; her birimin altında &quot;Üyeleri yönet&quot; ile o birime kullanıcı ekleyip birim içi yetkilerini (Birim Yöneticisi / Ekip Üyesi) atayabilirsiniz.
      </p>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => {
            setAddName("");
            setShowAddModal(true);
          }}
          className="btn-cta-projeler px-4 py-2 rounded-lg font-medium shadow transition"
        >
          Yeni birim ekle
        </button>
      </div>
      {message && (
        <div
          className={`mb-4 p-3 rounded text-sm ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}
        >
          {message.text}
        </div>
      )}
      {loading ? (
        <p className="typo-loading-on-gradient">Yükleniyor...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Birim adı</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {units.map((unit) => (
                <tr key={unit.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{unit.name}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openMembersModal(unit)}
                      className="text-sm px-3 py-1.5 rounded-lg font-medium shadow mr-2 text-white transition"
                      style={{ backgroundColor: "var(--btn-primary)" }}
                    >
                      Üyeleri yönet
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(unit)}
                      className="text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-700 mr-2"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteUnit(unit)}
                      className="text-sm px-3 py-1 rounded border border-red-200 hover:bg-red-50 text-red-700"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {units.length === 0 && (
            <p className="p-6 text-gray-500 text-center">
              Henüz birim tanımlanmamış. &quot;Yeni birim ekle&quot; ile ekleyebilirsiniz.
            </p>
          )}
        </div>
      )}

      <ModalShell
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        layer="base"
        panelClassName="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
      >
        {showAddModal && (
          <>
            <h2 className="typo-modal-title mb-4">Yeni birim ekle</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Birim adı</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                  placeholder="Örn: Yazılım, İnsan Kaynakları"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  {addLoading ? "Ekleniyor..." : "Ekle"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                >
                  İptal
                </button>
              </div>
            </form>
          </>
        )}
      </ModalShell>

      <ModalShell
        open={!!editUnit}
        onClose={() => {
          setEditUnit(null);
          setEditName("");
        }}
        layer="base"
        panelClassName="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
      >
        {editUnit && (
          <>
            <h2 className="typo-modal-title mb-4">Birimi düzenle</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Birim adı</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {editLoading ? "Kaydediliyor..." : "Kaydet"}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditUnit(null); setEditName(""); }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                >
                  İptal
                </button>
              </div>
            </form>
          </>
        )}
      </ModalShell>

      <ModalShell
        open={!!deleteUnit}
        onClose={() => setDeleteUnit(null)}
        layer="base"
        panelClassName="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
      >
        {deleteUnit && (
          <>
            <h2 className="typo-modal-title mb-2">Birimi sil</h2>
            <p className="text-gray-600 mb-4">
              <strong>{deleteUnit.name}</strong> birimini silmek istediğinize emin misiniz? Bu birime bağlı üyelikler de kaldırılır.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? "Siliniyor..." : "Evet, sil"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteUnit(null)}
                disabled={deleteLoading}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                İptal
              </button>
            </div>
          </>
        )}
      </ModalShell>

      <ModalShell
        open={membersLoading && !membersUnit}
        onClose={() => {}}
        layer="base"
        closeOnBackdrop={false}
        closeOnEscape={false}
        panelClassName="bg-white rounded-lg shadow p-6"
      >
        <p className="typo-loading-on-card">Yükleniyor...</p>
      </ModalShell>

      <ModalShell
        open={!!membersUnit}
        onClose={() => setMembersUnit(null)}
        layer="base"
        overlayClassName="overflow-y-auto"
        panelClassName="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8"
      >
        {membersUnit && (
          <>
            <div className="flex items-start justify-between gap-2 mb-4">
              <h2 className="typo-modal-title">
                Birim üyeleri: {membersUnit.name}
              </h2>
              <button
                type="button"
                onClick={() => setMembersUnit(null)}
                className="shrink-0 p-1 rounded hover:bg-gray-200 text-gray-600"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Kayıtlı üyeler</h3>
              {membersUnit.members.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">Bu birimde henüz üye yok. Aşağıdan ekleyebilirsiniz.</p>
              ) : (
                <ul className="border border-gray-200 rounded divide-y bg-gray-50">
                  {membersUnit.members.map((m) => (
                    <li key={m.userId} className="flex items-center gap-2 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900">{formatUserDisplayName(m.displayName)}</span>
                        <span className="text-gray-500 text-sm ml-1">({m.email})</span>
                      </div>
                      <AppSelect
                        value={m.role}
                        onChange={(v) => handleRoleChange(m.userId, v as "EKIP_UYESI" | "BIRIM_YONETICISI")}
                        disabled={roleChangeLoading === m.userId}
                        size="sm"
                        className="w-40"
                      >
                        <option value="EKIP_UYESI">Ekip Üyesi</option>
                        <option value="BIRIM_YONETICISI">Birim Yöneticisi</option>
                      </AppSelect>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.userId)}
                        disabled={removeMemberLoading === m.userId}
                        className="text-sm px-2 py-1 rounded border border-red-200 hover:bg-red-50 text-red-700 disabled:opacity-50"
                      >
                        {removeMemberLoading === m.userId ? "..." : "Çıkar"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Üye ekle</h3>
              <form onSubmit={handleAddMember} className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs text-gray-500 mb-0.5">Kullanıcı</label>
                  <AppSelect
                    value={addMemberUserId}
                    onChange={(v) => setAddMemberUserId(v)}
                    size="sm"
                    className="w-full"
                  >
                    <option value="">Seçin...</option>
                    {usersNotInUnit.map((u) => (
                      <option key={u.id} value={u.id}>
                        {formatUserDisplayName(u.displayName)} ({u.email})
                      </option>
                    ))}
                  </AppSelect>
                </div>
                <div className="w-40">
                  <label className="block text-xs text-gray-500 mb-0.5">Rol</label>
                  <AppSelect
                    value={addMemberRole}
                    onChange={(v) => setAddMemberRole(v as "EKIP_UYESI" | "BIRIM_YONETICISI")}
                    size="sm"
                    className="w-full"
                  >
                    <option value="EKIP_UYESI">Ekip Üyesi</option>
                    <option value="BIRIM_YONETICISI">Birim Yöneticisi</option>
                  </AppSelect>
                </div>
                <button
                  type="submit"
                  disabled={!addMemberUserId.trim() || addMemberLoading}
                  className="bg-emerald-600 text-white px-4 py-2 rounded text-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {addMemberLoading ? "Ekleniyor..." : "Ekle"}
                </button>
              </form>
              {usersNotInUnit.length === 0 && users.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">Tüm kullanıcılar zaten bu birimde.</p>
              )}
            </div>
          </>
        )}
      </ModalShell>
    </div>
  );
}
