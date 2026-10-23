import { NextResponse } from "next/server";
import { jsonWithDisplayNames } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { taskAccessWhere, fetchDurationStats } from "@/lib/dashboard-metrics";

/** Haftanın Pazartesi 00:00'ını (yerel) döndürür. */
function getWeekStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Haftanın Pazar 23:59:59.999'unu (yerel) döndürür. */
function getWeekEnd(d: Date): Date {
  const start = getWeekStart(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** Dashboard özet istatistikleri: geciken görevler, bu hafta tamamlanan, son aktiviteler. */
export async function GET(request: Request) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session?.id) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = getWeekStart(now);
    const weekEnd = getWeekEnd(now);

    const accessWhere = taskAccessWhere(session.id, !!session.isAdmin);

    // Bağımsız sorgular tek seferde paralel çalıştırılır (sıralı await yerine).
    const [overdueCount, completedThisWeekCount, recentTasks, overdueTasks, durationStats] =
      await Promise.all([
        // Geciken görevler: dueDate < bugün, status != TAMAMLANDI
        prisma.task.count({
          where: {
            ...accessWhere,
            dueDate: { lt: todayStart },
            status: { not: "TAMAMLANDI" },
          },
        }),
        // Bu hafta tamamlanan görevler
        prisma.task.count({
          where: {
            ...accessWhere,
            status: "TAMAMLANDI",
            completedAt: { gte: weekStart, lte: weekEnd },
          },
        }),
        // Son aktiviteler: updatedAt'e göre (dashboard "Daha fazla" için üst sınır)
        prisma.task.findMany({
          where: accessWhere,
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: {
            assignee: { select: { id: true, displayName: true, email: true } },
            createdBy: { select: { id: true, displayName: true, email: true } },
            project: { select: { id: true, name: true } },
          },
        }),
        // Geciken kayıtlar listesi (dashboard "Daha fazla" için üst sınır)
        prisma.task.findMany({
          where: {
            ...accessWhere,
            dueDate: { lt: todayStart },
            status: { not: "TAMAMLANDI" },
          },
          orderBy: { dueDate: "asc" },
          take: 50,
          include: {
            assignee: { select: { id: true, displayName: true, email: true } },
            createdBy: { select: { id: true, displayName: true, email: true } },
            project: { select: { id: true, name: true } },
          },
        }),
        fetchDurationStats(session.id, !!session.isAdmin),
      ]);

    // Kartlar yalnızca kısa önizleme gösterir; tam metin detay endpoint'inden gelir.
    const truncate = (s: string) => (s.length > 300 ? `${s.slice(0, 300)}…` : s);

    const recentActivity = recentTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: truncate(t.description),
      type: t.type,
      status: t.status,
      priority: t.priority,
      updatedAt: t.updatedAt.toISOString(),
      dueDate: t.dueDate.toISOString(),
      assignee: t.assignee,
      createdBy: t.createdBy,
      project: t.project,
    }));

    const overdueList = overdueTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: truncate(t.description),
      type: t.type,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate.toISOString(),
      assignee: t.assignee,
      createdBy: t.createdBy,
      project: t.project,
    }));

    return jsonWithDisplayNames({
      overdueCount,
      completedThisWeekCount,
      recentActivity,
      overdueList,
      durationStats,
    });
  } catch (error) {
    console.error("Dashboard stats failed:", error);
    return NextResponse.json(
      { error: "İstatistikler alınamadı" },
      { status: 500 }
    );
  }
}
