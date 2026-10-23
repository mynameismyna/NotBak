"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { ModalShell } from "@/components/ModalShell";
import { formatUserDisplayName } from "@/lib/display-name";
import { AppSelect } from "@/components/AppSelect";

interface User {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  isAdmin: boolean;
  globalRole: string | null;
  ldapDn: string | null;
  source?: string | null;
  lastSyncAt: string | null;
  assistantUserId: string | null;
  assistant: { id: string; email: string; displayName: string } | null;
  unitMemberships?: { unitId: string; role: string; unit: { id: string; name: string } }[];
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [addForm, setAddForm] = useState({
    email: "",
    displayName: "",
    isAdmin: false,
    isActive: true,
    role: "user" as "user" | "manager" | "admin",
    assistantUserId: "",
    unitRoles: {} as Record<string, "none" | "EKIP_UYESI" | "BIRIM_YONETICISI">,
  });
  const [addLoading, setAddLoading] = useState(false);
  const { confirm } = useConfirm();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [editForm, setEditForm] = useState<{
    displayName: string;
    isActive: boolean;
    role: "user" | "manager" | "admin";
    assistantUserId: string;
    unitRoles: Record<string, "none" | "EKIP_UYESI" | "BIRIM_YONETICISI">;
  }>({
    displayName: "",
    isActive: true,
    role: "user",
    assistantUserId: "",
    unitRoles: {},
  });
  const [showAdModal, setShowAdModal] = useState(false);
  const [adUsers, setAdUsers] = useState<{ email: string; displayName: string; ldapDn: string; samAccountName?: string }[]>([]);
  const [adEntriesFound, setAdEntriesFound] = useState<number | null>(null);
  const [adFirstEntryDebug, setAdFirstEntryDebug] = useState<{ dn: string; attributeNames: string[]; sample: Record<string, string> } | null>(null);
  const [adLoading, setAdLoading] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);
  const [adSelected, setAdSelected] = useState<Set<string>>(new Set());
  const [adAddLoading, setAdAddLoading] = useState(false);
  const [adSearchQuery, setAdSearchQuery] = useState("");
  const [adSortBy, setAdSortBy] = useState<"displayName" | "email">("displayName");
  const [adSortDir, setAdSortDir] = useState<"asc" | "desc">("asc");

  const fetchUsers = () => {
    setLoading(true);
    setMessage(null);
    fetch(`/api/users/list?filter=${filter}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setMessage({ type: "error", text: data.error });
          setUsers([]);
        } else if (Array.isArray(data.users)) {
          setUsers(data.users);
        } else {
          setUsers([]);
        }
      })
      .catch(() => setMessage({ type: "error", text: "Kullanıcılar yüklenemedi" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => { if (!data.canAccessSettings) router.replace("/dashboard"); })
      .catch(() => router.replace("/dashboard"));
  }, [router]);

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  useEffect(() => {
    fetch("/api/units")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.units)) setUnits(data.units);
      })
      .catch(() => setUnits([]));
  }, []);

  useEffect(() => {
    if (!showAddModal) return;
    setAddForm((f) => ({
      ...f,
      unitRoles: Object.fromEntries(
        units.map((u) => [u.id, "none" as const])
      ) as Record<string, "none" | "EKIP_UYESI" | "BIRIM_YONETICISI">,
    }));
  }, [showAddModal, units]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  };

  const handleActivate = async (isActive: boolean) => {
    if (selectedIds.size === 0) {
      setMessage({ type: "error", text: "Lütfen en az bir kullanıcı seçin" });
      return;
    }
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedIds), isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İşlem başarısız");
      setMessage({ type: "success", text: isActive ? "Kullanıcılar aktif edildi" : "Kullanıcılar pasif edildi" });
      setSelectedIds(new Set());
      fetchUsers();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "İşlem başarısız" });
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    const role: "user" | "manager" | "admin" = user.isAdmin
      ? "admin"
      : user.globalRole === "YONETICI"
        ? "manager"
        : "user";
    const unitRoles: Record<string, "none" | "EKIP_UYESI" | "BIRIM_YONETICISI"> = {};
    units.forEach((u) => {
      unitRoles[u.id] = (user.unitMemberships?.find((m) => m.unitId === u.id)?.role as "EKIP_UYESI" | "BIRIM_YONETICISI") ?? "none";
    });
    setEditUser(user);
    setEditForm({
      displayName: user.displayName,
      isActive: user.isActive,
      role,
      assistantUserId: user.assistantUserId ?? "",
      unitRoles,
    });
    setShowEditModal(true);
  };

  const roleLabel = (user: User) => {
    if (user.isAdmin || user.globalRole === "ADMIN") return "Admin";
    if (user.globalRole === "YONETICI") return "Yönetici";
    return "Kullanıcı";
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditLoading(true);
    setMessage(null);
    try {
      let isAdmin = false;
      let globalRole: string | null = null;
      if (editForm.role === "admin") {
        isAdmin = true;
        globalRole = "ADMIN";
      } else if (editForm.role === "manager") {
        isAdmin = false;
        globalRole = "YONETICI";
      }
      const unitMemberships = units
        .filter((u) => editForm.unitRoles[u.id] && editForm.unitRoles[u.id] !== "none")
        .map((u) => ({ unitId: u.id, role: editForm.unitRoles[u.id] as "BIRIM_YONETICISI" | "EKIP_UYESI" }));
      const body = {
        displayName: editForm.displayName.trim(),
        isActive: editForm.isActive,
        isAdmin,
        globalRole,
        assistantUserId: editForm.assistantUserId || null,
        unitMemberships,
      };
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kullanıcı güncellenemedi");
      setMessage({ type: "success", text: "Kullanıcı güncellendi" });
      setShowEditModal(false);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Kullanıcı güncellenemedi" });
    } finally {
      setEditLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editUser) return;
    const ok = await confirm({
      title: "Parolayı Sıfırla",
      message: `"${editUser.displayName}" için geçici parola oluşturulacak ve e-posta ile gönderilecek. İlk girişte parola değiştirmesi istenecek. Devam edilsin mi?`,
      confirmLabel: "Evet, sıfırla",
      cancelLabel: "Vazgeç",
    });
    if (!ok) return;
    setResetPasswordLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${editUser.id}/reset-password`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parola sıfırlanamadı");
      setMessage({ type: "success", text: data.message ?? "Parola sıfırlandı. Kullanıcıya e-posta gönderildi." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Parola sıfırlanamadı" });
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleRemoveUser = async () => {
    if (!editUser) return;
    const ok = await confirm({
      title: "Kullanıcıyı Kaldır",
      message: `"${editUser.displayName}" (${editUser.email}) kullanıcısını sistemden kaldırmak istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      confirmLabel: "Evet, kaldır",
      cancelLabel: "Vazgeç",
    });
    if (!ok) return;
    setDeleteLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${editUser.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kullanıcı kaldırılamadı");
      setMessage({ type: "success", text: "Kullanıcı kaldırıldı" });
      setShowEditModal(false);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Kullanıcı kaldırılamadı" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openAdModal = async () => {
    setShowAdModal(true);
    setAdError(null);
    setAdUsers([]);
    setAdEntriesFound(null);
    setAdFirstEntryDebug(null);
    setAdSelected(new Set());
    setAdSearchQuery("");
    setAdSortBy("displayName");
    setAdSortDir("asc");
    setAdLoading(true);
    try {
      const res = await fetch("/api/ldap/preview?all=1");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AD listesi alınamadı");
      const list = data.users ?? [];
      const entriesFound = data.entriesFound ?? 0;
      setAdUsers(list);
      setAdEntriesFound(entriesFound);
      setAdFirstEntryDebug(data.firstEntryDebug ?? null);
      if (list.length === 0) {
        if (entriesFound === 0) {
          setAdError(
            "AD'den hiç kayıt gelmedi. Search Base (DC=example,DC=local) kullanıcıların bulunduğu ağaç mı? " +
              "LDAP Ayarları'nda Bağlantıyı Test Et yeşil olsa bile, kullanıcılar farklı bir OU altında olabilir; Search Base'i OU içerecek şekilde genişletin (örn. OU=Users,DC=example,DC=local) veya kök DN ile deneyin."
          );
        } else {
          setAdError(
            `LDAP'tan ${entriesFound} kayıt geldi ancak e-posta/DN çıkarılamadı. ` +
              "Aşağıda ilk kaydın attribute'ları görünüyor; mail/userPrincipalName/sAMAccountName farklı isimle geliyorsa parser güncellenecek."
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AD listesi alınamadı";
      if (msg === "Failed to fetch" || msg.includes("fetch") || msg.includes("network")) {
        setAdError(
          "Sunucuya ulaşılamadı. Uygulama (Next.js) çalışıyor mu? Sayfayı yenileyip tekrar deneyin. Ağ/CORS hatası da olabilir."
        );
      } else {
        setAdError(msg);
      }
    } finally {
      setAdLoading(false);
    }
  };

  const adFilteredAndSorted = (() => {
    const q = adSearchQuery.trim().toLowerCase();
    let list = q
      ? adUsers.filter(
          (u) =>
            u.displayName.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q)
        )
      : [...adUsers];
    list = [...list].sort((a, b) => {
      const va = adSortBy === "displayName" ? a.displayName : a.email;
      const vb = adSortBy === "displayName" ? b.displayName : b.email;
      const c = va.localeCompare(vb, "tr");
      return adSortDir === "asc" ? c : -c;
    });
    return list;
  })();

  const toggleAdSelect = (email: string) => {
    const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return;
    setAdSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const selectAllAd = () => {
    const existingEmails = new Set(users.map((u) => u.email.toLowerCase()));
    const addable = adFilteredAndSorted.filter(
      (u) => !existingEmails.has(u.email.toLowerCase())
    );
    const addableEmails = new Set(addable.map((u) => u.email));
    const currentSelected = addable.filter((u) => adSelected.has(u.email));
    if (currentSelected.length === addable.length) {
      setAdSelected((prev) => {
        const next = new Set(prev);
        addableEmails.forEach((e) => next.delete(e));
        return next;
      });
    } else {
      setAdSelected((prev) => new Set([...prev, ...addableEmails]));
    }
  };

  const handleAddFromAd = async () => {
    if (adSelected.size === 0) {
      setMessage({ type: "error", text: "En az bir kullanıcı seçin" });
      return;
    }
    const toAdd = adUsers.filter((u) => adSelected.has(u.email));
    setAdAddLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users/from-ldap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: toAdd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eklenemedi");
      setMessage({
        type: "success",
        text: `${data.added ?? 0} kullanıcı eklendi${(data.skipped ?? 0) > 0 ? `, ${data.skipped} zaten kayıtlıydı` : ""}.`,
      });
      setShowAdModal(false);
      fetchUsers();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Eklenemedi" });
    } finally {
      setAdAddLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.email.trim() || !addForm.displayName.trim()) {
      setMessage({ type: "error", text: "E-posta ve görünen ad gerekli" });
      return;
    }
    const isAdmin = addForm.role === "admin";
    const globalRole =
      addForm.role === "admin" ? "ADMIN" : addForm.role === "manager" ? "YONETICI" : null;
    const unitMemberships = units
      .filter((u) => addForm.unitRoles[u.id] && addForm.unitRoles[u.id] !== "none")
      .map((u) => ({ unitId: u.id, role: addForm.unitRoles[u.id] as "BIRIM_YONETICISI" | "EKIP_UYESI" }));
    setAddLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: addForm.email.trim(),
          displayName: addForm.displayName.trim(),
          isAdmin,
          globalRole,
          isActive: addForm.isActive,
          assistantUserId: addForm.assistantUserId.trim() || null,
          unitMemberships,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kullanıcı eklenemedi");
      setMessage({ type: "success", text: "Manuel kullanıcı eklendi. Geçici parola e-posta ile gönderildi." });
      setShowAddModal(false);
      setAddForm({
        email: "",
        displayName: "",
        isAdmin: false,
        isActive: true,
        role: "user",
        assistantUserId: "",
        unitRoles: {},
      });
      fetchUsers();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Kullanıcı eklenemedi" });
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div>
      <h1 className="typo-page-title mb-6">Kullanıcı Yönetimi</h1>
      <p className="typo-muted-on-gradient mb-4">
        Kullanıcıları Active Directory&apos;den seçerek ekleyebilir veya manuel ekleyebilirsiniz. AD kullanıcıları varsayılan olarak pasiftir; giriş yapabilmeleri için &quot;Aktif et&quot; ile aktivasyon gerekir. Manuel eklenen kullanıcılar e-posta ve parola ile giriş yapar.
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg font-medium shadow transition ${filter === "all" ? "text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          style={filter === "all" ? { backgroundColor: "var(--btn-primary)" } : undefined}
        >
          Tümü
        </button>
        <button
          onClick={() => setFilter("active")}
          className={`px-4 py-2 rounded-lg font-medium shadow transition ${filter === "active" ? "text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          style={filter === "active" ? { backgroundColor: "var(--btn-primary)" } : undefined}
        >
          Aktif
        </button>
        <button
          onClick={() => setFilter("inactive")}
          className={`px-4 py-2 rounded-lg font-medium shadow transition ${filter === "inactive" ? "text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          style={filter === "inactive" ? { backgroundColor: "var(--btn-primary)" } : undefined}
        >
          Pasif
        </button>
        <button
          onClick={() => {
            setAddForm({
              email: "",
              displayName: "",
              isAdmin: false,
              isActive: true,
              role: "user",
              assistantUserId: "",
              unitRoles: {},
            });
            setShowAddModal(true);
          }}
          className="btn-cta-projeler px-4 py-2 rounded-lg font-medium shadow hover:opacity-95 transition"
        >
          Manuel kullanıcı ekle
        </button>
        <button
          onClick={openAdModal}
          className="btn-cta-gorevler px-4 py-2 rounded-lg font-medium shadow hover:opacity-95 transition"
        >
          Active Directory&apos;den ekle
        </button>
      </div>
      {message && (
        <div
          className={`mb-4 p-3 rounded text-sm ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}
        >
          {message.text}
        </div>
      )}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => handleActivate(true)}
            disabled={actionLoading}
            className="bg-white border-2 border-green-600 text-green-700 px-4 py-2 rounded-lg font-medium shadow hover:bg-green-50 disabled:opacity-50 transition"
          >
            Aktif et ({selectedIds.size})
          </button>
          <button
            onClick={() => handleActivate(false)}
            disabled={actionLoading}
            className="bg-white border-2 border-amber-600 text-amber-800 px-4 py-2 rounded-lg font-medium shadow hover:bg-amber-50 disabled:opacity-50 transition"
          >
            Pasif et ({selectedIds.size})
          </button>
        </div>
      )}
      {loading ? (
        <p className="typo-loading-on-gradient">Yükleniyor...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
              <tr className="whitespace-nowrap">
                <th className="px-3 py-1.5 text-left font-medium text-gray-700">
                  <input type="checkbox" checked={selectedIds.size === users.length && users.length > 0} onChange={selectAll} />
                </th>
                <th className="px-3 py-1.5 text-left font-medium text-gray-700">Ad</th>
                <th className="px-3 py-1.5 text-left font-medium text-gray-700">E-posta</th>
                <th className="px-3 py-1.5 text-left font-medium text-gray-700">Durum</th>
                <th className="px-3 py-1.5 text-left font-medium text-gray-700">Rol</th>
                <th className="px-3 py-1.5 text-left font-medium text-gray-700">Yardımcı</th>
                <th className="px-3 py-1.5 text-left font-medium text-gray-700">Kaynak</th>
                <th className="px-3 py-1.5 text-left font-medium text-gray-700" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 whitespace-nowrap">
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleSelect(user.id)}
                    />
                  </td>
                  <td className="px-3 py-1.5 max-w-[200px] truncate" title={user.displayName}>{formatUserDisplayName(user.displayName)}</td>
                  <td className="px-3 py-1.5 max-w-[180px] truncate" title={user.email}>{user.email}</td>
                  <td className="px-3 py-1.5">
                    <span className={user.isActive ? "text-green-600" : "text-gray-500"}>
                      {user.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">{roleLabel(user)}</td>
                  <td className="px-3 py-1.5 max-w-[120px] truncate" title={user.assistant ? `${user.assistant.displayName} (${user.assistant.email})` : undefined}>
                    {user.assistant ? (
                      <span className="text-gray-800">
                        {formatUserDisplayName(user.assistant.displayName)}
                        <span className="text-gray-500"> ({user.assistant.email})</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">Yok</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={
                        user.source === "MASTER"
                          ? "text-purple-600 font-medium"
                          : user.source === "LDAP"
                            ? "text-blue-600"
                            : "text-amber-600"
                      }
                    >
                      {user.source === "MASTER" ? "Master" : user.source === "LDAP" ? "LDAP" : "Manuel"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => openEditModal(user)}
                      className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-700"
                    >
                      Düzenle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="p-6 text-gray-500 text-center">Kullanıcı bulunamadı. Active Directory&apos;den ekleyin veya manuel kullanıcı ekleyin.</p>
          )}
        </div>
      )}

      <ModalShell
        open={showAdModal}
        onClose={() => setShowAdModal(false)}
        layer="base"
        panelClassName="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col p-6"
      >
        {showAdModal && (
          <>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h2 className="typo-modal-title">Active Directory&apos;den kullanıcı ekle</h2>
              <button
                type="button"
                onClick={() => setShowAdModal(false)}
                className="shrink-0 p-1 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-800"
                title="Kapat"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              AD&apos;ye bağlanıp kullanıcılar listelenir (filtre yok). Seçtiklerinizi tek tek veya toplu ekleyebilirsiniz. Zaten ekli olanlar seçilemez.
            </p>
            {adLoading ? (
              <p className="py-8 text-gray-500">AD&apos;den listeleniyor...</p>
            ) : adError ? (
              <div className="py-4">
                <p className="text-red-600 text-sm mb-2">{adError}</p>
                {adFirstEntryDebug && (
                  <div className="mt-3 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                    <p className="font-medium text-gray-700 mb-1">İlk kaydın attribute&apos;ları (debug):</p>
                    <p className="text-gray-600 mb-1">DN: {adFirstEntryDebug.dn}</p>
                    <p className="text-gray-600 mb-1">Attribute isimleri: {adFirstEntryDebug.attributeNames?.join(", ") || "-"}</p>
                    <pre className="whitespace-pre-wrap break-all">
                      {JSON.stringify(adFirstEntryDebug.sample, null, 2)}
                    </pre>
                  </div>
                )}
                <div className="flex gap-2 pt-4 mt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAdModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            ) : adUsers.length > 0 ? (
              <>
                {adEntriesFound != null && (
                  <p className="text-sm text-gray-600 mb-2">
                    LDAP&apos;tan {adEntriesFound} kayıt geldi, {adUsers.length} kullanıcı listelendi.
                  </p>
                )}
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Ad veya e-posta ile ara..."
                    value={adSearchQuery}
                    onChange={(e) => setAdSearchQuery(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={selectAllAd}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {adFilteredAndSorted.filter((u) => !users.some((x) => x.email.toLowerCase() === u.email.toLowerCase())).every((u) => adSelected.has(u.email))
                      ? "Seçimi kaldır"
                      : "Tümünü seç (filtrelenmiş)"}
                  </button>
                  <span className="text-sm text-gray-500">
                    {adSelected.size} seçili
                    {adSearchQuery.trim() && ` · ${adFilteredAndSorted.length} eşleşen`}
                  </span>
                </div>
                <div className="border rounded overflow-hidden flex-1 min-h-0 flex flex-col bg-gray-50">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b text-sm font-medium text-gray-700 shrink-0">
                    <span className="w-8 shrink-0" />
                    <span className="truncate">Adı - E Posta Adresi - Oturum Adı</span>
                  </div>
                  <ul className="overflow-y-auto flex-1 min-h-0 max-h-64 divide-y">
                    {adFilteredAndSorted.map((u) => {
                      const exists = users.some((x) => x.email.toLowerCase() === u.email.toLowerCase());
                      const line = `${formatUserDisplayName(u.displayName)} - ${u.email} - ${u.samAccountName ?? "—"}`;
                      return (
                        <li
                          key={u.ldapDn}
                          className={`flex items-center gap-2 px-3 py-1.5 text-sm whitespace-nowrap ${exists ? "bg-gray-100 text-gray-500" : "hover:bg-gray-100"}`}
                        >
                          <input
                            type="checkbox"
                            checked={adSelected.has(u.email)}
                            onChange={() => toggleAdSelect(u.email)}
                            disabled={exists}
                            className="rounded w-4 h-4 shrink-0"
                          />
                          <span className="truncate min-w-0 flex-1" title={line}>
                            {line}
                          </span>
                          {exists && <span className="text-xs text-amber-600 shrink-0">Zaten ekli</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {adFilteredAndSorted.length === 0 && adSearchQuery.trim() && (
                  <p className="text-sm text-gray-500 py-2">Arama kriterine uygun kullanıcı yok.</p>
                )}
                <div className="flex gap-2 pt-4 mt-4 border-t">
                  <button
                    type="button"
                    onClick={handleAddFromAd}
                    disabled={adSelected.size === 0 || adAddLoading}
                    className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700 disabled:opacity-50"
                  >
                    {adAddLoading ? "Ekleniyor..." : `Seçilenleri ekle (${adSelected.size})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                  >
                    Kapat
                  </button>
                </div>
              </>
            ) : (
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                >
                  Kapat
                </button>
              </div>
            )}
          </>
        )}
      </ModalShell>

      <ModalShell
        open={!!(showEditModal && editUser)}
        onClose={() => setShowEditModal(false)}
        layer="base"
        overlayClassName="overflow-y-auto"
        panelClassName="bg-white rounded-lg shadow-xl max-w-md w-full p-6 my-8"
      >
        {showEditModal && editUser && (
          <>
            <h2 className="typo-modal-title mb-4">
              Kullanıcıyı düzenle
              <span className="block typo-body font-normal">{editUser.email}</span>
            </h2>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Görünen ad</label>
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  <span className="text-sm text-gray-700">Aktif</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <div className="flex flex-col gap-1 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="user"
                      checked={editForm.role === "user"}
                      onChange={() => setEditForm((f) => ({ ...f, role: "user" }))}
                    />
                    <span>Normal Kullanıcı</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="manager"
                      checked={editForm.role === "manager"}
                      onChange={() => setEditForm((f) => ({ ...f, role: "manager" }))}
                    />
                    <span>Yönetici</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={editForm.role === "admin"}
                      onChange={() => setEditForm((f) => ({ ...f, role: "admin" }))}
                    />
                    <span>Admin</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Yardımcı kullanıcı</label>
                <AppSelect
                  value={editForm.assistantUserId}
                  onChange={(v) => setEditForm((f) => ({ ...f, assistantUserId: v }))}
                  className="w-full"
                  size="sm"
                >
                  <option value="">(Yok)</option>
                  {users
                    .filter((u) => u.id !== editUser.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {formatUserDisplayName(u.displayName)} ({u.email}) {u.isAdmin || u.globalRole === "ADMIN" ? " - Admin" : ""}
                      </option>
                    ))}
                </AppSelect>
                <p className="mt-1 text-xs text-gray-500">
                  Admin kullanıcıya yardımcı atanamaz; yardımcı da Admin olamaz. Aynı birimde olma kuralı API tarafından
                  kontrol edilir.
                </p>
              </div>
              {units.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Birimler</label>
                  <p className="text-xs text-gray-500 mb-2">Kullanıcıyı birimlere ekleyebilir veya birim içi rolünü değiştirebilirsiniz.</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                    {units.map((unit) => (
                      <div key={unit.id} className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 w-32 truncate" title={unit.name}>
                          {unit.name}
                        </span>
                        <AppSelect
                          value={editForm.unitRoles[unit.id] ?? "none"}
                          onChange={(v) =>
                            setEditForm((f) => ({
                              ...f,
                              unitRoles: {
                                ...f.unitRoles,
                                [unit.id]: v as "none" | "EKIP_UYESI" | "BIRIM_YONETICISI",
                              },
                            }))
                          }
                          size="sm"
                          className="flex-1"
                        >
                          <option value="none">Üye değil</option>
                          <option value="EKIP_UYESI">Ekip Üyesi</option>
                          <option value="BIRIM_YONETICISI">Birim Yöneticisi</option>
                        </AppSelect>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                  onClick={() => {
                    setShowEditModal(false);
                    setEditUser(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                >
                  İptal
                </button>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
                {!editUser.ldapDn && editUser.source !== "MASTER" && (
                  <>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={resetPasswordLoading}
                      className="w-full py-2 rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50 text-sm font-medium"
                    >
                      {resetPasswordLoading ? "Sıfırlanıyor..." : "Parolayı sıfırla (geçici parola e-posta ile gider)"}
                    </button>
                    <p className="text-xs text-gray-500 text-center">
                      Geçici parola oluşturulur ve kullanıcıya e-posta ile gönderilir; ilk girişte değiştirmesi istenir.
                    </p>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleRemoveUser}
                  disabled={deleteLoading}
                  className="w-full py-2 rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 text-sm font-medium"
                >
                  {deleteLoading ? "Kaldırılıyor..." : "Kullanıcıyı kaldır"}
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Bu kullanıcı sistemden kalıcı olarak silinir. Geri alınamaz.
                </p>
              </div>
            </form>
          </>
        )}
      </ModalShell>

      <ModalShell
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        layer="base"
        overlayClassName="overflow-y-auto"
        panelClassName="bg-white rounded-lg shadow-xl max-w-md w-full p-6 my-8"
      >
        {showAddModal && (
          <>
            <h2 className="typo-modal-title mb-4">Manuel kullanıcı ekle</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                  placeholder="ornek@firma.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Görünen ad</label>
                <input
                  type="text"
                  value={addForm.displayName}
                  onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                  placeholder="Ad Soyad"
                />
              </div>
              <p className="text-sm text-gray-600">
                Sistem geçici bir parola oluşturacak ve kullanıcıya e-posta ile gönderecek. İlk girişte parola değiştirmesi istenecektir.
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addForm.isActive}
                    onChange={(e) => setAddForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  <span className="text-sm text-gray-700">Aktif (giriş yapabilsin)</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <div className="flex flex-col gap-1 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="addRole"
                      checked={addForm.role === "user"}
                      onChange={() => setAddForm((f) => ({ ...f, role: "user" }))}
                    />
                    <span>Normal Kullanıcı</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="addRole"
                      checked={addForm.role === "manager"}
                      onChange={() => setAddForm((f) => ({ ...f, role: "manager" }))}
                    />
                    <span>Yönetici</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="addRole"
                      checked={addForm.role === "admin"}
                      onChange={() => setAddForm((f) => ({ ...f, role: "admin" }))}
                    />
                    <span>Admin</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Yardımcı kullanıcı</label>
                <AppSelect
                  value={addForm.assistantUserId}
                  onChange={(v) => setAddForm((f) => ({ ...f, assistantUserId: v }))}
                  className="w-full"
                  size="sm"
                >
                  <option value="">(Yok)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {formatUserDisplayName(u.displayName)} ({u.email})
                    </option>
                  ))}
                </AppSelect>
                <p className="mt-1 text-xs text-gray-500">Admin kullanıcıya yardımcı atanamaz.</p>
              </div>
              {units.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Birimler</label>
                  <p className="text-xs text-gray-500 mb-2">Kullanıcıyı birimlere ekleyebilir ve birim içi rol verebilirsiniz.</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                    {units.map((unit) => (
                      <div key={unit.id} className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 w-32 truncate" title={unit.name}>
                          {unit.name}
                        </span>
                        <AppSelect
                          value={addForm.unitRoles[unit.id] ?? "none"}
                          onChange={(v) =>
                            setAddForm((f) => ({
                              ...f,
                              unitRoles: {
                                ...f.unitRoles,
                                [unit.id]: v as "none" | "EKIP_UYESI" | "BIRIM_YONETICISI",
                              },
                            }))
                          }
                          size="sm"
                          className="flex-1"
                        >
                          <option value="none">Üye değil</option>
                          <option value="EKIP_UYESI">Ekip Üyesi</option>
                          <option value="BIRIM_YONETICISI">Birim Yöneticisi</option>
                        </AppSelect>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
    </div>
  );
}
