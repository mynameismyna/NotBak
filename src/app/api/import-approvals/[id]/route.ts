import { NextRequest, NextResponse } from "next/server";
import { formatUserDisplayName, jsonWithDisplayNames } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

export async function GET(
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

    const approval = await prisma.importPendingApproval.findUnique({
      where: { id },
      include: {
        project: {
          include: { members: { where: { userId: session.id, role: "PROJE_YONETICISI" }, select: { userId: true } } },
        },
      },
    });
    if (!approval) {
      return NextResponse.json({ error: "Onay talebi bulunamadı" }, { status: 404 });
    }
    if (approval.status !== "PENDING") {
      return NextResponse.json({ error: "Bu talep zaten işlenmiş" }, { status: 400 });
    }

    const isOwner = approval.project.ownerId === session.id;
    const isProjectManager = approval.project.members.length > 0;
    if (!isOwner && !isProjectManager && !session.isAdmin) {
      return NextResponse.json({ error: "Bu talebi yalnızca proje sorumlusu, proje yöneticisi veya admin onaylayabilir" }, { status: 403 });
    }

    const items = JSON.parse(approval.items) as Array<{
      title: string;
      description: string;
      type: string;
      priority: string;
      dueDate: string;
      status: string;
    }>;

    const requester = await prisma.user.findUnique({
      where: { id: approval.requesterId },
      select: { displayName: true, email: true },
    });
    const assignee = await prisma.user.findUnique({
      where: { id: approval.assigneeId },
      select: { displayName: true, email: true },
    });

    return jsonWithDisplayNames({
      approval: {
        id: approval.id,
        projectId: approval.project.id,
        projectName: approval.project.name,
        requester: requester
          ? { displayName: requester.displayName, email: requester.email }
          : null,
        assignee: assignee
          ? { displayName: assignee.displayName, email: assignee.email }
          : null,
        items,
        createdAt: approval.createdAt,
      },
    });
  } catch (error) {
    console.error("Import approval get failed:", error);
    return NextResponse.json(
      { error: "Talep alınamadı" },
      { status: 500 }
    );
  }
}

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
    const addAsMember = !!body.addAsMember;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
    }

    const approval = await prisma.importPendingApproval.findUnique({
      where: { id },
      include: {
        project: {
          include: { members: { where: { userId: session.id, role: "PROJE_YONETICISI" }, select: { userId: true } } },
        },
      },
    });
    if (!approval) {
      return NextResponse.json({ error: "Onay talebi bulunamadı" }, { status: 404 });
    }
    if (approval.status !== "PENDING") {
      return NextResponse.json({ error: "Bu talep zaten işlenmiş" }, { status: 400 });
    }

    const isOwner = approval.project.ownerId === session.id;
    const isProjectManager = approval.project.members.length > 0;
    if (!isOwner && !isProjectManager && !session.isAdmin) {
      return NextResponse.json({ error: "Bu talebi yalnızca proje sorumlusu, proje yöneticisi veya admin onaylayabilir" }, { status: 403 });
    }

    const now = new Date();
    const items = JSON.parse(approval.items) as Array<{
      title: string;
      description: string;
      type: string;
      priority: string;
      dueDate: string;
      status: string;
    }>;

    if (action === "reject") {
      for (const item of items) {
        const titleWithProject = `[${approval.project.name}] ${item.title}`;
        const description =
          item.description +
          `\n\n[Bu kayıt ${approval.project.name} projesi ile ilişkilidir - proje sorumlusu tarafından reddedildi]`;
        const dueDate = new Date(item.dueDate);
        const status = (item.status || "YENI") as "YENI" | "DEVAM_EDIYOR" | "BEKLEMEDE" | "TAMAMLANDI";

        await prisma.task.create({
          data: {
            title: titleWithProject,
            description,
            type: item.type as "GOREV" | "NOT" | "FIKIR",
            status,
            priority: item.priority,
            dueDate,
            assigneeId: approval.assigneeId,
            createdById: session.id,
            isPrivate: false,
            statusChangedAt: now,
            ...(status === "DEVAM_EDIYOR" ? { startedAt: now } : {}),
            ...(status === "TAMAMLANDI" ? { completedAt: now } : {}),
          },
        });
      }
      await prisma.importPendingApproval.update({
        where: { id },
        data: { status: "REJECTED", resolvedAt: now },
      });
      await createNotification({
        userId: approval.requesterId,
        type: "TASK_ASSIGNED",
        title: "Toplu yükleme talebi reddedildi",
        body: `"${approval.project.name}" projesi için ${items.length} kayıt projesiz olarak oluşturuldu.`,
        link: "/dashboard/tasks",
      });
      return NextResponse.json({ success: true, action: "rejected", created: items.length });
    }

    if (addAsMember) {
      const existing = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: { projectId: approval.projectId, userId: approval.assigneeId },
        },
      });
      if (!existing) {
        await prisma.projectMember.create({
          data: {
            projectId: approval.projectId,
            userId: approval.assigneeId,
            role: "EKIP_UYESI",
          },
        });
      }
    }

    for (const item of items) {
      const dueDate = new Date(item.dueDate);
      const status = (item.status || "YENI") as "YENI" | "DEVAM_EDIYOR" | "BEKLEMEDE" | "TAMAMLANDI";

      const taskData = {
        title: item.title,
        description: item.description,
        type: item.type as "GOREV" | "NOT" | "FIKIR",
        status,
        priority: item.priority,
        dueDate,
        assigneeId: approval.assigneeId,
        createdById: session.id,
        isPrivate: false,
        statusChangedAt: now,
        ...(status === "DEVAM_EDIYOR" ? { startedAt: now } : {}),
        ...(status === "TAMAMLANDI" ? { completedAt: now } : {}),
      };

      if (addAsMember) {
        await prisma.task.create({
          data: {
            ...taskData,
            projectId: approval.projectId,
          },
        });
      } else {
        const titleWithProject = `[${approval.project.name}] ${item.title}`;
        const description =
          item.description +
          `\n\n[Bu kayıt ${approval.project.name} projesi ile ilişkilidir - sadece görüntüleme ve yorum yetkisi]`;
        const task = await prisma.task.create({
          data: {
            ...taskData,
            title: titleWithProject,
            description,
          },
        });
        await prisma.taskCollaborator.create({
          data: {
            taskId: task.id,
            userId: approval.assigneeId,
            permission: "READ_ONLY",
          },
        });
      }
    }

    await prisma.importPendingApproval.update({
      where: { id },
      data: { status: "APPROVED", resolvedAt: now },
    });

    await createNotification({
      userId: approval.requesterId,
      type: "TASK_ASSIGNED",
      title: "Toplu yükleme talebi onaylandı",
      body: `"${approval.project.name}" projesi için ${items.length} kayıt ${addAsMember ? "projeye eklendi" : "projesiz oluşturuldu (görüntüleme + yorum yetkisi verildi)"}.`,
      link: "/dashboard/tasks",
    });

    if (approval.assigneeId !== session.id) {
      await createNotification({
        userId: approval.assigneeId,
        type: "TASK_ASSIGNED",
        title: "Size yeni kayıtlar atandı",
        body: `${formatUserDisplayName(session.displayName) || "Proje sorumlusu"} "${approval.project.name}" için ${items.length} kayıt oluşturdu.`,
        link: "/dashboard/tasks",
      });
    }

    return NextResponse.json({
      success: true,
      action: "approved",
      addAsMember,
      created: items.length,
    });
  } catch (error) {
    console.error("Import approval patch failed:", error);
    return NextResponse.json(
      { error: "İşlem başarısız" },
      { status: 500 }
    );
  }
}
