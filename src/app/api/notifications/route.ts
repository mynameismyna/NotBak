import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";

/** Kullanıcının bildirimlerini listeler (yeniden eskiye). Tablo kayıtları + bugünkü 30 dk içindeki hatırlatmalar. */
export async function GET(request: NextRequest) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get("countOnly") === "1";

    const now = new Date();
    const in30Min = new Date(now.getTime() + 30 * 60 * 1000);
    const reminderWhere = {
      assigneeId: session.id,
      dueDate: { gte: now, lte: in30Min },
      status: { not: "TAMAMLANDI" },
    };

    // countOnly (60 sn'de bir poll edilen badge) için yalnızca 2 paralel count.
    if (countOnly) {
      const [unreadDbCount, reminderCount] = await Promise.all([
        prisma.notification.count({ where: { userId: session.id, readAt: null } }),
        prisma.task.count({ where: reminderWhere }),
      ]);
      return NextResponse.json({ count: unreadDbCount + reminderCount });
    }

    const [dbNotifications, reminderTasks] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.task.findMany({
        where: reminderWhere,
        select: { id: true, title: true, dueDate: true },
      }),
    ]);

    const unreadCount = dbNotifications.filter((n) => !n.readAt).length;

    const reminderItems = reminderTasks.map((t) => ({
      id: `reminder-${t.id}`,
      type: "REMINDER" as const,
      title: `${t.dueDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}'da kayıt: ${t.title}`,
      body: null as string | null,
      link: `/dashboard/tasks/${t.id}`,
      relatedTaskId: t.id,
      readAt: null as string | null,
      createdAt: t.dueDate.toISOString(),
      isReminder: true,
    }));

    const dbItems = dbNotifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      relatedTaskId: n.relatedTaskId,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
      isReminder: false,
    }));

    const combined = [...reminderItems, ...dbItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      notifications: combined.slice(0, 50),
      unreadCount: unreadCount + reminderItems.length,
    });
  } catch (error) {
    console.error("Notifications list failed:", error);
    return NextResponse.json(
      { error: "Bildirimler alınamadı" },
      { status: 500 }
    );
  }
}
