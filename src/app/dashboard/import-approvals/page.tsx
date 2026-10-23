"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Approval {
  id: string;
  projectId: string;
  projectName: string;
  requester: { displayName: string; email: string } | null;
  assignee: { displayName: string; email: string } | null;
  itemCount: number;
  createdAt: string;
}

export default function ImportApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/import-approvals")
      .then((r) => r.json())
      .then((d) => setApprovals(d.approvals || []))
      .catch(() => setApprovals([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="text-gray-300 hover:text-white text-sm">
          ← Dashboard
        </Link>
        <h1 className="typo-page-title">Bekleyen Talepler</h1>
      </div>
      {loading ? (
        <p className="typo-loading-on-gradient">Yükleniyor...</p>
      ) : approvals.length === 0 ? (
        <div
          className="rounded-xl shadow-xl p-8 text-center text-gray-600 backdrop-blur"
          style={{ backgroundColor: "var(--metro-card-bg)" }}
        >
          <p>Onay bekleyen talep yok.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((a) => (
            <div
              key={a.id}
              className="rounded-xl shadow-lg p-4 backdrop-blur border-l-4"
              style={{
                backgroundColor: "var(--metro-card-bg)",
                borderLeftColor: "var(--metro-tile-projeler)",
              }}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="typo-card-title">{a.projectName}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {a.requester?.displayName || "Bilinmeyen"} → {a.itemCount} kayıt
                  </p>
                  <p className="text-sm text-gray-500">
                    Sorumlu: {a.assignee?.displayName || a.assignee?.email || "Bilinmeyen"} (projede değil)
                  </p>
                </div>
                <Link
                  href={`/dashboard/import-approvals/${a.id}`}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition"
                  style={{ backgroundColor: "var(--metro-tile-projeler)" }}
                >
                  İncele / Onayla
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
