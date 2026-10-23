"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ImportApproval {
  id: string;
  type: "import";
  projectId: string;
  projectName: string;
  itemCount?: number;
  requester?: { displayName: string; email: string } | null;
  assignee?: { displayName: string; email: string } | null;
  status?: string;
  createdAt: string;
  resolvedAt?: string | null;
}

interface JoinRequest {
  id: string;
  type: "join";
  projectId: string;
  projectName: string;
  requester?: { displayName: string; email: string } | null;
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
}

interface TaskRequest {
  id: string;
  type: string;
  title: string;
  dueDate: string;
  createdBy?: { id: string; displayName: string; email: string } | null;
  assignee?: { id: string; displayName: string; email: string } | null;
  project?: { name: string } | null;
  rejectionReason?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Beklemede",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
};

export default function TaleplerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "sent" ? "sent" : tabParam === "rejected" ? "rejected" : "received";
  const [tab, setTab] = useState<"received" | "sent" | "rejected">(initialTab);

  useEffect(() => {
    const t = searchParams.get("tab");
    const urlTab = t === "sent" ? "sent" : t === "rejected" ? "rejected" : "received";
    setTab(urlTab);
  }, [searchParams]);
  const [importApprovals, setImportApprovals] = useState<ImportApproval[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [taskRequests, setTaskRequests] = useState<TaskRequest[]>([]);
  const [rejectedTasks, setRejectedTasks] = useState<TaskRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReceived = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/import-approvals").then((r) => r.json()),
      fetch("/api/project-join-requests?filter=received").then((r) => r.json()),
      fetch("/api/tasks?view=accept-pending&type=GOREV").then((r) => r.json()),
    ])
      .then(([importData, joinData, tasksData]) => {
        setImportApprovals(importData.approvals || []);
        setJoinRequests(
          (joinData.joinRequests || []).map((j: JoinRequest) => ({ ...j, type: "join" }))
        );
        setTaskRequests((tasksData.tasks || []).map((t: TaskRequest) => ({ ...t, type: "GOREV" })));
      })
      .catch(() => {
        setImportApprovals([]);
        setJoinRequests([]);
        setTaskRequests([]);
      })
      .finally(() => setLoading(false));
  };

  const fetchSent = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/import-approvals?filter=sent").then((r) => r.json()),
      fetch("/api/project-join-requests?filter=sent").then((r) => r.json()),
    ])
      .then(([importData, joinData]) => {
        setImportApprovals(importData.approvals || []);
        setJoinRequests(
          (joinData.joinRequests || []).map((j: JoinRequest) => ({ ...j, type: "join" }))
        );
      })
      .catch(() => {
        setImportApprovals([]);
        setJoinRequests([]);
      })
      .finally(() => setLoading(false));
  };

  const fetchRejected = () => {
    setLoading(true);
    fetch("/api/tasks?view=rejected&type=GOREV")
      .then((r) => r.json())
      .then((data) => {
        setRejectedTasks((data.tasks || []).map((t: TaskRequest) => ({ ...t, type: "GOREV" })));
      })
      .catch(() => setRejectedTasks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === "received") fetchReceived();
    else if (tab === "sent") fetchSent();
    else if (tab === "rejected") fetchRejected();
  }, [tab]);

  const handleJoinAction = async (id: string, action: "approve" | "reject") => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/project-join-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("İşlem başarısız");
      fetchReceived();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const receivedImportCount = importApprovals.filter((a) => a.type === "import").length;
  const receivedJoinCount = joinRequests.length;
  const receivedTaskCount = taskRequests.length;
  const receivedTotal = receivedImportCount + receivedJoinCount + receivedTaskCount;

  const handleTaskAccept = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/accept`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Kabul başarısız");
      }
      fetchReceived();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleTaskReject = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Red başarısız");
      }
      fetchReceived();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="text-gray-300 hover:text-white text-sm">
          ← Dashboard
        </Link>
        <h1 className="typo-page-title">Gelen Talepler</h1>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {
            setTab("received");
            router.replace("/dashboard/talepler");
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "received"
              ? "text-white"
              : "bg-white/10 text-white/90 hover:bg-white/20"
          }`}
          style={tab === "received" ? { backgroundColor: "var(--metro-tile-projeler)" } : undefined}
        >
          Bana gelen
          {tab === "received" && receivedTotal > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-white/30 text-xs">
              {receivedTotal}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setTab("sent");
            router.replace("/dashboard/talepler?tab=sent");
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "sent"
              ? "text-white"
              : "bg-white/10 text-white/90 hover:bg-white/20"
          }`}
          style={tab === "sent" ? { backgroundColor: "var(--metro-tile-projeler)" } : undefined}
        >
          Gönderdiğim
        </button>
        <button
          onClick={() => {
            setTab("rejected");
            router.replace("/dashboard/talepler?tab=rejected");
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "rejected"
              ? "text-white"
              : "bg-white/10 text-white/90 hover:bg-white/20"
          }`}
          style={tab === "rejected" ? { backgroundColor: "var(--metro-tile-projeler)" } : undefined}
        >
          Reddedilen
          {tab === "rejected" && rejectedTasks.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-white/30 text-xs">
              {rejectedTasks.length}
            </span>
          )}
        </button>
      </div>

      <div
        className="rounded-xl shadow-xl p-6 backdrop-blur"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        {loading ? (
          <p className="typo-loading-on-card">Yükleniyor...</p>
        ) : tab === "rejected" ? (
          <>
            {rejectedTasks.length === 0 ? (
              <p className="typo-empty-on-card">Reddedilen görev talebi yok.</p>
            ) : (
              <div className="space-y-4">
                {rejectedTasks.map((t) => (
                  <div
                    key={`rejected-${t.id}`}
                    className="p-4 rounded-lg border-l-4 bg-gray-50/80 border-l-red-400"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="typo-card-title">Reddedilen görev - {t.title}</h3>
                        <p className="typo-body mt-1">
                          {t.createdBy?.displayName || "Bir kullanıcı"} → Sorumlu:{" "}
                          {t.assignee?.displayName || t.assignee?.email || "—"}
                          {t.project?.name ? ` · ${t.project.name}` : ""}
                        </p>
                        {t.rejectionReason && (
                          <p className="text-sm text-red-700 mt-1 italic">
                            Gerekçe: {t.rejectionReason}
                          </p>
                        )}
                        <p className="typo-caption mt-1">
                          Son tarih: {new Date(t.dueDate).toLocaleDateString("tr-TR")}
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/tasks/${t.id}`}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 shrink-0"
                      >
                        Detay
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : tab === "received" ? (
          <>
            {importApprovals.length === 0 && joinRequests.length === 0 && taskRequests.length === 0 ? (
              <p className="typo-empty-on-card">Onay bekleyen talep yok.</p>
            ) : (
              <div className="space-y-4">
                {taskRequests.map((t) => (
                  <div
                    key={`task-${t.id}`}
                    className="p-4 rounded-lg border-l-4 bg-gray-50/80"
                    style={{ borderLeftColor: "var(--metro-tile-gorevler)" }}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="typo-card-title">Görev talebi - {t.title}</h3>
                        <p className="typo-body mt-1">
                          {t.createdBy?.displayName || "Bir kullanıcı"} size bu görevi atadı
                          {t.project?.name ? ` · ${t.project.name}` : ""}
                        </p>
                        <p className="typo-caption mt-1">
                          Son tarih: {new Date(t.dueDate).toLocaleDateString("tr-TR")}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Link
                          href={`/dashboard/tasks/${t.id}`}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-700"
                        >
                          Detay
                        </Link>
                        <button
                          onClick={() => handleTaskAccept(t.id)}
                          disabled={actionLoading === t.id}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                        >
                          Kabul et
                        </button>
                        <button
                          onClick={() => handleTaskReject(t.id)}
                          disabled={actionLoading === t.id}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-100 hover:bg-red-200 text-red-700 disabled:opacity-50"
                        >
                          Reddet
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {importApprovals.map((a) => (
                  <div
                    key={`import-${a.id}`}
                    className="p-4 rounded-lg border-l-4 bg-gray-50/80"
                    style={{ borderLeftColor: "var(--metro-tile-projeler)" }}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="typo-card-title">
                          Import talebi - {a.projectName}
                        </h3>
                        <p className="typo-body mt-1">
                          {a.requester?.displayName} → {a.itemCount} kayıt (Sorumlu:{" "}
                          {a.assignee?.displayName || a.assignee?.email})
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/import-approvals/${a.id}`}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white shrink-0"
                        style={{ backgroundColor: "var(--metro-tile-projeler)" }}
                      >
                        İncele / Onayla
                      </Link>
                    </div>
                  </div>
                ))}
                {joinRequests.map((j) => (
                  <div
                    key={`join-${j.id}`}
                    className="p-4 rounded-lg border-l-4 bg-gray-50/80"
                    style={{ borderLeftColor: "var(--metro-tile-projeler)" }}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="typo-card-title">
                          Projeye katılım talebi - {j.projectName}
                        </h3>
                        <p className="typo-body mt-1">
                          {j.requester?.displayName} ({j.requester?.email}) katılmak istiyor
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleJoinAction(j.id, "approve")}
                          disabled={actionLoading === j.id}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                        >
                          Onayla
                        </button>
                        <button
                          onClick={() => handleJoinAction(j.id, "reject")}
                          disabled={actionLoading === j.id}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50"
                        >
                          Reddet
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {importApprovals.length === 0 && joinRequests.length === 0 ? (
              <p className="typo-empty-on-card">Gönderdiğiniz talep yok.</p>
            ) : (
              <div className="space-y-4">
                {importApprovals.map((a) => (
                  <div
                    key={`import-${a.id}`}
                    className="p-4 rounded-lg border-l-4 bg-gray-50/80"
                    style={{ borderLeftColor: "var(--metro-tile-projeler)" }}
                  >
                    <h3 className="typo-card-title">
                      Import talebi - {a.projectName} ({a.itemCount} kayıt)
                    </h3>
                    <p className="typo-body mt-1">
                      Durum: {STATUS_LABELS[a.status || "PENDING"]}
                    </p>
                    <p className="typo-caption mt-1">
                      {new Date(a.createdAt).toLocaleString("tr-TR")}
                    </p>
                  </div>
                ))}
                {joinRequests.map((j) => (
                  <div
                    key={`join-${j.id}`}
                    className="p-4 rounded-lg border-l-4 bg-gray-50/80"
                    style={{ borderLeftColor: "var(--metro-tile-projeler)" }}
                  >
                    <h3 className="typo-card-title">
                      Projeye katılım talebi - {j.projectName}
                    </h3>
                    <p className="typo-body mt-1">
                      Durum: {STATUS_LABELS[j.status]}
                    </p>
                    <p className="typo-caption mt-1">
                      {new Date(j.createdAt).toLocaleString("tr-TR")}
                    </p>
                    {j.status === "APPROVED" && (
                      <Link
                        href={`/dashboard/projects/${j.projectId}`}
                        className="inline-block mt-2 text-sm font-medium text-blue-600 hover:underline"
                      >
                        Projeye git →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
