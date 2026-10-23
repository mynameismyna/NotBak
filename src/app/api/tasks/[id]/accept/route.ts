import { NextRequest, NextResponse } from "next/server";
import { formatUserDisplayName } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

/**
 * Sorumlu (assignee) görevi kabul eder. Sadece type=GOREV ve status=ONAY_BEKLIYOR iken çalışır.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, assigneeId: true, createdById: true, type: true, status: true, title: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    if (task.assigneeId !== session.id) {
      return NextResponse.json(
        { error: "Bu görevi yalnızca sorumlu kabul edebilir" },
        { status: 403 }
      );
    }

    if (task.type !== "GOREV" || task.status !== "ONAY_BEKLIYOR") {
      return NextResponse.json(
        { error: "Bu kayıt onay bekleyen bir görev değil" },
        { status: 400 }
      );
    }

    await prisma.task.update({
      where: { id },
      data: { status: "YENI" },
    });

    if (task.createdById && task.createdById !== session.id) {
      await createNotification({
        userId: task.createdById,
        type: "TASK_ASSIGNED",
        title: "Görev kabul edildi",
        body: `${formatUserDisplayName(session.displayName) || "Sorumlu"} "${task.title}" görevini kabul etti.`,
        link: `/dashboard/tasks/${id}`,
        relatedTaskId: id,
      });
    }

    return NextResponse.json({ success: true, status: "YENI" });
  } catch (error) {
    console.error("Task accept failed:", error);
    return NextResponse.json(
      { error: "Kabul işlemi başarısız" },
      { status: 500 }
    );
  }
}
