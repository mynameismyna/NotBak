import { NextRequest, NextResponse } from "next/server";
import { formatUserDisplayName } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, ownerId: true, members: { select: { userId: true } } },
    });
    if (!project) {
      return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
    }

    const isAlreadyMember =
      project.ownerId === session.id ||
      project.members.some((m) => m.userId === session.id);
    if (isAlreadyMember) {
      return NextResponse.json(
        { error: "Zaten bu projenin üyesisiniz" },
        { status: 400 }
      );
    }

    const existing = await prisma.projectJoinRequest.findFirst({
      where: { projectId, requesterId: session.id, status: "PENDING" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Bu projeye zaten katılım talebiniz bekliyor", joinRequestId: existing.id },
        { status: 400 }
      );
    }

    const joinRequest = await prisma.projectJoinRequest.create({
      data: { projectId, requesterId: session.id, status: "PENDING" },
      include: { project: { select: { name: true } } },
    });

    if (project.ownerId) {
      await createNotification({
        userId: project.ownerId,
        type: "PROJECT_JOIN_REQUEST",
        title: "Projeye katılım talebi",
        body: `${formatUserDisplayName(session.displayName) || "Bir kullanıcı"} "${project.name}" projesine katılmak istiyor.`,
        link: `/dashboard/talepler`,
        relatedProjectJoinRequestId: joinRequest.id,
      });
    }

    return NextResponse.json({
      joinRequest: {
        id: joinRequest.id,
        projectId: joinRequest.projectId,
        projectName: joinRequest.project.name,
        status: joinRequest.status,
        createdAt: joinRequest.createdAt,
      },
    });
  } catch (error) {
    console.error("Join request create failed:", error);
    return NextResponse.json(
      { error: "Talep oluşturulamadı" },
      { status: 500 }
    );
  }
}
