import { NextRequest, NextResponse } from "next/server";
import { formatUserDisplayName } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

/** Göreve ekip üyesi (collaborator) ekle. Sorumlu veya admin yapabilir. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, assigneeId: true, createdById: true, title: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    const canEdit = session.isAdmin || task.assigneeId === session.id || task.createdById === session.id;
    if (!canEdit) {
      return NextResponse.json(
        { error: "Bu göreve ekip üyesi eklemek için sorumlu, oluşturan veya admin olmalısınız" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const userId = (body.userId || body.user_id || "").trim();
    if (!userId) {
      return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
    }

    if (userId === task.assigneeId) {
      return NextResponse.json(
        { error: "Sorumlu zaten görevde; ekip üyesi olarak eklenemez" },
        { status: 400 }
      );
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    await prisma.taskCollaborator.upsert({
      where: {
        taskId_userId: { taskId, userId },
      },
      create: { taskId, userId },
      update: {},
    });

    if (userId !== session.id) {
      await createNotification({
        userId,
        type: "TASK_COLLABORATOR",
        title: "Bir kayda ilgili kişi olarak eklendiniz",
        body: `${formatUserDisplayName(session.displayName) || "Bir kullanıcı"} sizi "${task.title}" kaydına ilgili kişi olarak ekledi.`,
        link: `/dashboard/tasks/${taskId}`,
        relatedTaskId: taskId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Add collaborator failed:", error);
    return NextResponse.json(
      { error: "Ekip üyesi eklenemedi" },
      { status: 500 }
    );
  }
}

/** Görevden ekip üyesini çıkar. Sorumlu veya admin yapabilir. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, assigneeId: true, createdById: true, title: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    const canEdit = session.isAdmin || task.assigneeId === session.id || task.createdById === session.id;
    if (!canEdit) {
      return NextResponse.json(
        { error: "Bu görevden ekip üyesi çıkarmak için sorumlu, oluşturan veya admin olmalısınız" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || searchParams.get("user_id") || "";
    if (!userId) {
      return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
    }

    await prisma.taskCollaborator.deleteMany({
      where: { taskId, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove collaborator failed:", error);
    return NextResponse.json(
      { error: "Ekip üyesi çıkarılamadı" },
      { status: 500 }
    );
  }
}
