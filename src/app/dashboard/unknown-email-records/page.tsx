"use client";

import { formatUserDisplayName } from "@/lib/display-name";

import { ModalShell } from "@/components/ModalShell";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppSelect } from "@/components/AppSelect";

interface EmailRecord {
  id: string;
  fromEmail: string;
  subject: string;
  bodyText: string | null;
  status: string;
  receivedAt: string;
  convertedTaskId: string | null;
}

type ConvertAction = "task" | "note" | null;

export default function UnknownEmailRecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("PENDING");
  const [converting, setConverting] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<{ record: EmailRecord; action: ConvertAction } | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "GOREV",
    priority: "MEDIUM",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    assigneeId: "",
    projectId: "",
  });
  const [users, setUsers] = useState<{ id: string; displayName: string; email: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.canAccessSettings) router.replace("/dashboard");
        else setIsAdmin(true);
      })
      .catch(() => router.replace("/dashboard"));
  }, [router]);

  const fetchRecords = useCallback(() => {
    setLoading(true);
    const url = filter ? `/api/unknown-email-records?status=${filter}` : "/api/unknown-email-records";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setRecords(d.records ?? []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    if (isAdmin) fetchRecords();
  }, [isAdmin, fetchRecords]);

  useEffect(() => {
    fetch("/api/users/list?filter=active")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {});
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const openConvertModal = (record: EmailRecord, action: ConvertAction) => {
    setShowModal({ record, action });
    setFormData({
      title: record.subject,
      description: record.bodyText || "",
      type: action === "note" ? "NOT" : "GOREV",
      priority: "MEDIUM",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      assigneeId: "",
      projectId: "",
    });
    setError("");
  };

  const handleConvert = async () => {
    if (!showModal) return;
    setConverting(showModal.record.id);
    setError("");
    try {
      const res = await fetch(`/api/email-records/${showModal.record.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: showModal.action,
          ...formData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İşlem başarısız");
      setShowModal(null);
      fetchRecords();
      if (data.taskId) {
        router.push(`/dashboard/tasks/${data.taskId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setConverting(null);
    }
  };

  const handleIgnore = async (id: string) => {
    setConverting(id);
    try {
      const res = await fetch(`/api/email-records/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ignore" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "İşlem başarısız");
      }
      fetchRecords();
    } catch {
      // ignore
    } finally {
      setConverting(null);
    }
  };

  const handleRestore = async (id: string) => {
    setConverting(id);
    try {
      const res = await fetch(`/api/email-records/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Geri alma başarısız");
      }
      fetchRecords();
    } catch {
      // ignore
    } finally {
      setConverting(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "PENDING": return "Bekliyor";
      case "CONVERTED_TASK": return "Göreve Dönüştürüldü";
      case "CONVERTED_NOTE": return "Nota Dönüştürüldü";
      case "IGNORED": return "Yoksayıldı";
      default: return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-amber-100 text-amber-800";
      case "CONVERTED_TASK": return "bg-green-100 text-green-800";
      case "CONVERTED_NOTE": return "bg-blue-100 text-blue-800";
      case "IGNORED": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  if (!isAdmin) return null;

  return (
    <div>
      <h1 className="typo-page-title mb-6">Bilinmeyen Kayıtlar</h1>
      <p className="typo-muted-on-gradient mb-4">
        Sistemde kayıtlı olmayan e-posta adreslerinden gelen kayıtlar burada listelenir. Yalnızca admin görebilir.
      </p>

      <div className="flex gap-2 mb-4">
        {["PENDING", "", "CONVERTED_TASK", "CONVERTED_NOTE", "IGNORED"].map((f) => (
          <button
            key={f || "all"}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === f
                ? "bg-white text-gray-900 shadow"
                : "text-white/80 hover:bg-white/10"
            }`}
          >
            {f === "" ? "Tümü" : f === "PENDING" ? "Bekleyenler" : f === "CONVERTED_TASK" ? "Görev" : f === "CONVERTED_NOTE" ? "Not" : "Yoksayılan"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl shadow-lg p-6 backdrop-blur" style={{ backgroundColor: "var(--metro-card-bg)" }}>
            <p className="typo-loading-on-card">Yükleniyor...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-xl shadow-lg p-6 backdrop-blur" style={{ backgroundColor: "var(--metro-card-bg)" }}>
            <p className="typo-empty-on-card">Bilinmeyen kayıt bulunamadı.</p>
          </div>
        ) : (
          records.map((r) => (
            <div
              key={r.id}
              className="rounded-xl shadow-lg p-5 backdrop-blur"
              style={{ backgroundColor: "var(--metro-card-bg)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">✉</span>
                    <h3 className="typo-card-title truncate">{r.subject}</h3>
                  </div>
                  <p className="text-xs text-amber-700 font-medium mb-1">
                    Gönderen: {r.fromEmail}
                  </p>
                  {r.bodyText && (
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1">{r.bodyText}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-400">{formatDate(r.receivedAt)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                  </div>
                </div>
                {r.status === "PENDING" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openConvertModal(r, "task")}
                      disabled={converting === r.id}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      Görev Yap
                    </button>
                    <button
                      onClick={() => openConvertModal(r, "note")}
                      disabled={converting === r.id}
                      className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      Not Yap
                    </button>
                    <button
                      onClick={() => handleIgnore(r.id)}
                      disabled={converting === r.id}
                      className="bg-gray-400 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-500 disabled:opacity-50 transition"
                    >
                      Yoksay
                    </button>
                  </div>
                )}
                {r.status === "IGNORED" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleRestore(r.id)}
                      disabled={converting === r.id}
                      className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50 transition"
                    >
                      {converting === r.id ? "Geri alınıyor..." : "Geri Al"}
                    </button>
                  </div>
                )}
                {r.convertedTaskId && (
                  <button
                    onClick={() => router.push(`/dashboard/tasks/${r.convertedTaskId}`)}
                    className="text-blue-600 text-sm hover:underline shrink-0"
                  >
                    Kaydı Görüntüle →
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ModalShell
        open={!!showModal}
        onClose={() => setShowModal(null)}
        layer="base"
        panelClassName="rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 bg-white"
      >
        {showModal && (
          <div>
            <h2 className="typo-modal-title mb-4">
              {showModal.action === "note" ? "Not Olarak Kaydet" : "Görev Olarak Kaydet"}
            </h2>
            <p className="text-xs text-amber-700 font-medium mb-3">
              Gönderen: {showModal.record.fromEmail}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Başlık *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Açıklama *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Öncelik</label>
                  <AppSelect
                    value={formData.priority}
                    onChange={(v) => setFormData({ ...formData, priority: v })}
                    className="w-full"
                  >
                    <option value="URGENT">Acil</option>
                    <option value="HIGH">Yüksek</option>
                    <option value="MEDIUM">Orta</option>
                    <option value="LOW">Düşük</option>
                  </AppSelect>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Son Tarih</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Sorumlu</label>
                  <AppSelect
                    value={formData.assigneeId}
                    onChange={(v) => setFormData({ ...formData, assigneeId: v })}
                    className="w-full"
                  >
                    <option value="">Ben (varsayılan)</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{formatUserDisplayName(u.displayName)} ({u.email})</option>
                    ))}
                  </AppSelect>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Proje</label>
                  <AppSelect
                    value={formData.projectId}
                    onChange={(v) => setFormData({ ...formData, projectId: v })}
                    className="w-full"
                  >
                    <option value="">Projesiz</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </AppSelect>
                </div>
              </div>
              {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleConvert}
                  disabled={!!converting}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {converting ? "Kaydediliyor..." : "Kaydet"}
                </button>
                <button
                  onClick={() => setShowModal(null)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}
      </ModalShell>
    </div>
  );
}
