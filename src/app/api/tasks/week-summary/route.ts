import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";

const DAY_NAMES_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

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

/** Bu hafta için gün gün özet: bana atanmış görevler, güne göre sayı. */
export async function GET(request: NextRequest) {
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
    const weekStart = getWeekStart(now);
    const weekEnd = getWeekEnd(now);

    const tasks = await prisma.task.findMany({
      where: {
        OR: [{ assigneeId: session.id }, { createdById: session.id }],
        dueDate: { gte: weekStart, lte: weekEnd },
      },
      select: { dueDate: true, status: true },
    });

    const dayCounts: Record<string, { total: number; completed: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayCounts[key] = { total: 0, completed: 0 };
    }

    for (const t of tasks) {
      const key = new Date(t.dueDate).toISOString().slice(0, 10);
      if (dayCounts[key]) {
        dayCounts[key].total += 1;
        if (t.status === "TAMAMLANDI") dayCounts[key].completed += 1;
      }
    }

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = DAY_NAMES_TR[i];
      const shortDate = d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
      const { total, completed } = dayCounts[dateStr] ?? { total: 0, completed: 0 };
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      days.push({
        date: dateStr,
        dayName,
        shortDate,
        taskCount: total,
        completedCount: completed,
        isToday,
      });
    }

    return NextResponse.json({
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      days,
    });
  } catch (error) {
    console.error("Week summary failed:", error);
    return NextResponse.json(
      { error: "Haftalık özet alınamadı" },
      { status: 500 }
    );
  }
}
