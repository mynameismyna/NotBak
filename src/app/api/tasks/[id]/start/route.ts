import { NextRequest, NextResponse } from "next/server";
import { formatUserDisplayName } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * Sorumlu kişi görevi başlatır: durum "Devam ediyor" olur ve otomatik yorum eklenir.
 * Sadece görevin atandığı kullanıcı (assignee) bu işlemi yapabilir.
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
      include: {
        collaborators: { select: { userId: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    const isAssignee = task.assigneeId === session.id;
    const isCollaborator = task.collaborators.some((c) => c.userId === session.id);
    if (!isAssignee && !isCollaborator) {
      return NextResponse.json(
        { error: "Bu görevi yalnızca sorumlu veya ekip üyesi başlatabilir" },
        { status: 403 }
      );
    }

    if (task.status === "ONAY_BEKLIYOR") {
      return NextResponse.json(
        { error: "Önce görevi Kayıtlar → Talepler sayfasından kabul etmelisiniz." },
        { status: 400 }
      );
    }
    if (task.status === "DEVAM_EDIYOR") {
      return NextResponse.json(
        { error: "Görev zaten devam ediyor" },
        { status: 400 }
      );
    }

    const displayName = formatUserDisplayName(session.displayName) || session.email || "Kullanıcı";
    const commentContent = `Bu görev ${displayName} tarafından başlatıldı.`;

    const now = new Date();
    // Sadece status ile güncelle; statusChangedAt/startedAt runtime client'ta "Invalid" verebiliyor, raw SQL ile set ediyoruz
    await prisma.$transaction([
      prisma.task.update({
        where: { id },
        data: { status: "DEVAM_EDIYOR" },
      }),
      prisma.comment.create({
        data: {
          content: commentContent,
          taskId: id,
          authorId: session.id,
        },
      }),
    ]);
    try {
      await prisma.$executeRaw`
        UPDATE [Task] SET statusChangedAt = ${now}, startedAt = ${now} WHERE id = ${id}
      `;
    } catch {
      // Sütun yoksa sessizce geç (görev zaten devam ediyor yapıldı)
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Task start failed:", error);
    return NextResponse.json(
      { error: "Görev başlatılamadı" },
      { status: 500 }
    );
  }
}
