"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ApprovalDetail {
  id: string;
  projectId: string;
  projectName: string;
  requester: { displayName: string; email: string } | null;
  assignee: { displayName: string; email: string } | null;
  items: Array<{
    title: string;
    description: string;
    type: string;
    priority: string;
    dueDate: string;
    status: string;
  }>;
  createdAt: string;
}

const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "Acil",
  HIGH: "Yüksek",
  MEDIUM: "Orta",
  LOW: "Düşük",
};

export default function ImportApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [approval, setApproval] = useState<ApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [addAsMember, setAddAsMember] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch(`/api/import-approvals/${id}`)
      .then((r) => r.json())
      .then((d) => setApproval(d.approval))
      .catch(() => setApproval(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: "approve" | "reject") => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/import-approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          addAsMember: action === "approve" ? addAsMember : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İşlem başarısız");
      setMessage({
        type: "success",
        text:
          action === "approve"
            ? `${data.created} kayıt oluşturuldu. ${addAsMember ? "Kullanıcı projeye eklendi." : "Kullanıcıya sadece bu kayıtlarda yetki verildi."}`
            : `${data.created} kayıt projesiz oluşturuldu.`,
      });
      setTimeout(() => router.push("/dashboard/import-approvals"), 1500);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "İşlem başarısız",
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <p className="typo-loading-on-gradient">Yükleniyor...</p>;
  if (!approval) return <p className="typo-muted-on-gradient">Talep bulunamadı.</p>;

  return (
    <div>
      <Link href="/dashboard/import-approvals" className="text-gray-300 hover:text-white text-sm mb-4 inline-block">
        ← Bekleyen Talepler
      </Link>
      <div
        className="rounded-xl shadow-xl p-6 backdrop-blur"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <h1 className="typo-page-title-on-card mb-4">Proje Üyeliği Onay Talebi</h1>
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
        <div className="space-y-2 mb-6">
          <p>
            <span className="font-medium text-gray-700">Proje:</span> {approval.projectName}
          </p>
          <p>
            <span className="font-medium text-gray-700">Talep eden:</span>{" "}
            {approval.requester?.displayName} ({approval.requester?.email})
          </p>
          <p>
            <span className="font-medium text-gray-700">Atanacak:</span>{" "}
            {approval.assignee?.displayName} ({approval.assignee?.email}) — projede değil
          </p>
        </div>

        <h2 className="typo-section-title mb-2">Kayıtlar ({approval.items.length} adet)</h2>
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600 font-medium">
                <th className="py-2 px-2">Başlık</th>
                <th className="py-2 px-2 max-w-[200px] hidden sm:table-cell">Açıklama</th>
                <th className="py-2 px-2">Öncelik</th>
                <th className="py-2 px-2">Son Tarih</th>
                <th className="py-2 px-2 hidden md:table-cell">Durum</th>
              </tr>
            </thead>
            <tbody>
              {approval.items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2 px-2 font-medium text-gray-800">{item.title}</td>
                  <td className="py-2 px-2 max-w-[200px] truncate text-gray-500 hidden sm:table-cell" title={item.description}>
                    {item.description}
                  </td>
                  <td className="py-2 px-2 text-gray-600">{PRIORITY_LABELS[item.priority] || item.priority}</td>
                  <td className="py-2 px-2 text-gray-600">{new Date(item.dueDate).toLocaleDateString("tr-TR")}</td>
                  <td className="py-2 px-2 text-gray-600 hidden md:table-cell">{item.status || "Yeni"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={addAsMember}
              onChange={(e) => setAddAsMember(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              {approval.assignee?.displayName || "Kullanıcıyı"} projeye üye olarak ekle
            </span>
          </label>
          <p className="text-xs text-gray-500">
            İşaretlenmezse: Kullanıcı projeye eklenmez, sadece bu kayıtlarda görüntüleme + yorum yetkisi verilir.
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => handleAction("approve")}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {actionLoading ? "İşleniyor..." : "Onayla"}
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
            >
              Reddet (projesiz kaydet)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
