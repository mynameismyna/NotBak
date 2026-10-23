import { NextRequest, NextResponse } from "next/server";
import { jsonWithDisplayNames } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";

const DAY_NAMES_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

function getWeekStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getWeekEnd(d: Date): Date {
  const start = getWeekStart(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** Yerel tarihi YYYY-MM-DD formatında döndürür. */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Bu hafta (Pzt–Paz) bana atanmış görevler, takvim grid için tam liste. */
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

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date"); // YYYY-MM-DD formatında
    let baseDate = new Date();
    if (dateParam) {
      const parsed = new Date(dateParam + "T12:00:00");
      if (!isNaN(parsed.getTime())) baseDate = parsed;
    }
    const now = new Date();
    const weekStart = getWeekStart(baseDate);
    const weekEnd = getWeekEnd(baseDate);

    const tasks = await prisma.task.findMany({
      where: {
        OR: [{ assigneeId: session.id }, { createdById: session.id }],
        dueDate: { gte: weekStart, lte: weekEnd },
      },
      orderBy: [{ dueDate: "asc" }, { priorityRank: "desc" }, { createdAt: "desc" }],
      include: {
        assignee: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = toLocalDateString(d);
      const dayNum = d.getDate();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
      days.push({
        date: dateStr,
        dayName: DAY_NAMES_TR[i],
        dayNumber: dayNum,
        isToday,
      });
    }

    const tasksForClient = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      type: t.type,
      status: t.status,
      priority: t.priority,
      priorityRank: t.priorityRank,
      dueDate: t.dueDate.toISOString(),
      assignee: t.assignee,
      createdBy: t.createdBy,
      project: t.project,
    }));

    return jsonWithDisplayNames({
      weekStart: toLocalDateString(weekStart),
      weekEnd: toLocalDateString(weekEnd),
      days,
      tasks: tasksForClient,
    });
  } catch (error) {
    console.error("Week calendar failed:", error);
    return NextResponse.json(
      { error: "Haftalık takvim alınamadı" },
      { status: 500 }
    );
  }
}
