import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { buildIcsForTask } from "@/lib/ical";
import { sendTaskCalendarMail } from "@/lib/email";

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
        title: true,
        description: true,
        dueDate: true,
        isPrivate: true,
        projectId: true,
        assigneeId: true,
        createdById: true,
        project: {
          select: {
            ownerId: true,
            members: { select: { userId: true } },
            teams: { include: { members: { select: { userId: true } } } },
          },
        },
        collaborators: { select: { userId: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    if (task.isPrivate && task.assigneeId !== session.id && !session.isAdmin) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    if (!session.isAdmin && task.projectId && task.project) {
      const proj = task.project as {
        ownerId: string | null;
        members: { userId: string }[];
        teams: { members: { userId: string }[] }[];
      };
      const isProjectOwner = proj.ownerId === session.id;
      const isProjectMember = proj.members.some((m) => m.userId === session.id);
      const isTeamMember = proj.teams.some((t) => t.members.some((m) => m.userId === session.id));
      const canAccess =
        isProjectOwner ||
        isProjectMember ||
        isTeamMember ||
        task.assigneeId === session.id ||
        task.createdById === session.id ||
        task.collaborators.some((c) => c.userId === session.id);
      if (!canAccess) {
        return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
      }
    }
    if (!session.isAdmin && !task.projectId) {
      const canAccess =
        task.assigneeId === session.id ||
        task.createdById === session.id ||
        task.collaborators.some((c) => c.userId === session.id);
      if (!canAccess) {
        return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!user?.email) {
      return NextResponse.json(
        { error: "Kayıtlı e-posta adresiniz bulunamadı. Profilinizi kontrol edin." },
        { status: 400 }
      );
    }

    const icsContent = buildIcsForTask({
      id: task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
    });

    const result = await sendTaskCalendarMail({
      toEmail: user.email,
      taskTitle: task.title,
      icsContent,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "E-posta gönderilemedi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Takvim davetiyesi e-postanıza gönderildi.",
    });
  } catch (error) {
    console.error("Send to calendar failed:", error);
    return NextResponse.json(
      { error: "İşlem başarısız." },
      { status: 500 }
    );
  }
}
