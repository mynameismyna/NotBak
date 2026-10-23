import { NextRequest, NextResponse } from "next/server";
import { formatUserDisplayName } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";

const bodySchema = z.object({
  reason: z.string().max(2000).optional(),
});

/**
 * Sorumlu (assignee) görevi reddeder. Görev REDDEDILDI kalır, assignee değişmez;
 * hem atayan (createdBy) hem atanan (assignee) Reddedilen listesinde görebilir.
 * Sadece type=GOREV ve status=ONAY_BEKLIYOR iken çalışır.
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
      select: {
        id: true,
        assigneeId: true,
        createdById: true,
        type: true,
        status: true,
        title: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    if (task.assigneeId !== session.id) {
      return NextResponse.json(
        { error: "Bu görevi yalnızca sorumlu reddedebilir" },
        { status: 403 }
      );
    }

    if (task.type !== "GOREV" || task.status !== "ONAY_BEKLIYOR") {
      return NextResponse.json(
        { error: "Bu kayıt onay bekleyen bir görev değil" },
        { status: 400 }
      );
    }

    let reason: string | undefined;
    try {
      const body = await request.json();
      const parsed = bodySchema.safeParse(body);
      if (parsed.success && parsed.data.reason?.trim()) {
        reason = parsed.data.reason.trim();
      }
    } catch {
      // body yok veya geçersiz, reason olmadan devam et
    }

    await prisma.task.update({
      where: { id },
      data: {
        status: "REDDEDILDI",
        rejectionReason: reason ?? null,
      },
    });

    if (task.createdById && task.createdById !== session.id) {
      await createNotification({
        userId: task.createdById,
        type: "TASK_ASSIGNED",
        title: "Görev reddedildi",
        body: `${formatUserDisplayName(session.displayName) || "Sorumlu"} "${task.title}" görevini reddetti.${reason ? ` Gerekçe: ${reason}` : ""}`,
        link: `/dashboard/tasks/${id}`,
        relatedTaskId: id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Task reject failed:", error);
    return NextResponse.json(
      { error: "Red işlemi başarısız" },
      { status: 500 }
    );
  }
}
