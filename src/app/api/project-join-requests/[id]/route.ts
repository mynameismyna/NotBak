import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

export async function PATCH(
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

    const body = await request.json();
    const action = body.action as string; // "approve" | "reject"

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
    }

    const joinRequest = await prisma.projectJoinRequest.findUnique({
      where: { id },
      include: {
        project: {
          include: { members: { where: { userId: session.id, role: "PROJE_YONETICISI" }, select: { userId: true } } },
        },
      },
    });
    if (!joinRequest) {
      return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
    }
    if (joinRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Bu talep zaten işlenmiş" }, { status: 400 });
    }

    const isOwner = joinRequest.project.ownerId === session.id;
    const isProjectManager = joinRequest.project.members.length > 0;
    if (!isOwner && !isProjectManager && !session.isAdmin) {
      return NextResponse.json(
        { error: "Bu talebi yalnızca proje sorumlusu veya proje yöneticisi onaylayabilir" },
        { status: 403 }
      );
    }

    const now = new Date();

    if (action === "approve") {
      const existing = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: joinRequest.projectId,
            userId: joinRequest.requesterId,
          },
        },
      });
      if (!existing) {
        await prisma.projectMember.create({
          data: {
            projectId: joinRequest.projectId,
            userId: joinRequest.requesterId,
            role: "EKIP_UYESI",
          },
        });
      }
    }

    await prisma.projectJoinRequest.update({
      where: { id },
      data: { status: action === "approve" ? "APPROVED" : "REJECTED", resolvedAt: now },
    });

    await createNotification({
      userId: joinRequest.requesterId,
      type: "TASK_ASSIGNED",
      title:
        action === "approve"
          ? "Projeye katılım talebiniz onaylandı"
          : "Projeye katılım talebiniz reddedildi",
      body:
        action === "approve"
          ? `"${joinRequest.project.name}" projesine katılımınız onaylandı.`
          : `"${joinRequest.project.name}" projesine katılım talebiniz reddedildi.`,
      link: action === "approve" ? `/dashboard/projects/${joinRequest.projectId}` : "/dashboard/talepler",
    });

    return NextResponse.json({
      success: true,
      action,
    });
  } catch (error) {
    console.error("Join request patch failed:", error);
    return NextResponse.json(
      { error: "İşlem başarısız" },
      { status: 500 }
    );
  }
}
