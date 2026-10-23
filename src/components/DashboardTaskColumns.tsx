"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaskListColumn } from "@/components/TaskListColumn";
import { RECORD_CARD_HEIGHT_CLASS } from "@/components/RecordListCard";
import { toTaskListItem, type DashboardTaskRow } from "@/lib/dashboard-task-map";

const OVERDUE_HEADER = "bg-red-50 text-red-900 border-red-200";
const RECENT_HEADER = "bg-violet-50 text-violet-900 border-violet-200";

function ColumnSkeleton({ label, headerClass }: { label: string; headerClass: string }) {
  return (
    <section className="min-w-0 flex flex-col">
      <header
        className={`rounded-t-lg border px-3 py-2 text-sm font-semibold ${headerClass}`}
      >
        {label}
      </header>
      <div
        className="rounded-b-lg border border-t-0 border-gray-200 p-2 space-y-2"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`rounded-lg bg-gray-200/60 animate-pulse ${RECORD_CARD_HEIGHT_CLASS}`}
          />
        ))}
      </div>
    </section>
  );
}

/** Veri, /api/dashboard/stats'ı bir kez çağıran üst sayfadan (dashboard) gelir. */
export function DashboardTaskColumns({
  overdueRows,
  recentRows,
  overdueCount,
  loading,
}: {
  overdueRows: DashboardTaskRow[];
  recentRows: DashboardTaskRow[];
  overdueCount: number;
  loading: boolean;
}) {
  const router = useRouter();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const overdueItems = useMemo(
    () => overdueRows.map(toTaskListItem),
    [overdueRows]
  );
  const recentItems = useMemo(() => recentRows.map(toTaskListItem), [recentRows]);

  const listResetKey = useMemo(
    () =>
      `dashboard|${overdueItems.map((t) => t.id).join(",")}|${recentItems.map((t) => t.id).join(",")}`,
    [overdueItems, recentItems]
  );

  const openDetail = (taskId: string) => router.push(`/dashboard/tasks/${taskId}`);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start mb-8">
        <ColumnSkeleton label="Geciken Kayıtlar" headerClass={OVERDUE_HEADER} />
        <ColumnSkeleton label="Son Aktiviteler" headerClass={RECENT_HEADER} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start mb-8">
      <TaskListColumn
        label="Geciken Kayıtlar"
        headerClass={OVERDUE_HEADER}
        items={overdueItems}
        listResetKey={`${listResetKey}:overdue`}
        emptyMessage="Geciken kayıt yok"
        forceOverdueAccent
        showDueBadge={false}
        menuOpenId={menuOpenId}
        setMenuOpenId={setMenuOpenId}
        onOpenDetail={openDetail}
        headerAction={
          overdueCount > 0 ? (
            <Link
              href="/dashboard/tum-kayitlar?view=overdue"
              className="text-xs font-medium text-red-700 hover:text-red-800 shrink-0"
            >
              {overdueCount} görev
            </Link>
          ) : null
        }
      />
      <TaskListColumn
        label="Son Aktiviteler"
        headerClass={RECENT_HEADER}
        items={recentItems}
        listResetKey={`${listResetKey}:recent`}
        emptyMessage="Henüz aktivite yok"
        showDueBadge
        menuOpenId={menuOpenId}
        setMenuOpenId={setMenuOpenId}
        onOpenDetail={openDetail}
        headerAction={
          <Link
            href="/dashboard/tum-kayitlar"
            className="text-xs font-medium text-violet-700 hover:text-violet-800 shrink-0"
          >
            Tümünü gör
          </Link>
        }
      />
    </div>
  );
}
