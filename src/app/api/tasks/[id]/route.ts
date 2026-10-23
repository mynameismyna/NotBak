import { NextRequest, NextResponse } from "next/server";
import { formatDisplayNamesInPayload, formatUserDisplayName, jsonWithDisplayNames } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";
import type { TaskType, TaskStatus, Priority } from "@/types";
import { priorityRank } from "@/lib/task-list";

const updateSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    type: z.enum(["GOREV", "NOT", "FIKIR"]).optional(),
    status: z.enum(["YENI", "ONAY_BEKLIYOR", "DEVAM_EDIYOR", "BEKLEMEDE", "TAMAMLANDI", "REDDEDILDI"]).optional(),
    priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).optional(),
    dueDate: z.string().optional(),
    assigneeId: z.string().optional(),
    projectId: z.string().nullable().optional(),
    statusReason: z.string().optional(),
    completedAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "BEKLEMEDE" && !data.statusReason?.trim()) {
      ctx.addIssue({
        path: ["statusReason"],
        code: z.ZodIssueCode.custom,
        message: "Beklemede durumuna geçerken yorumlara bir gerekçe yazmanız zorunludur.",
      });
    }
  });

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

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
        project: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            members: { select: { userId: true } },
            teams: { include: { members: { select: { userId: true } } } },
          },
        },
        collaborators: {
          include: { user: { select: { id: true, displayName: true, email: true } } },
        },
        comments: {
          include: { author: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!task) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    let assignmentHistory: Array<{
      id: string;
      createdAt: Date;
      fromUser: { id: string; displayName: string };
      toUser: { id: string; displayName: string };
      comment: { id: string; content: string } | null;
    }> = [];
    try {
      assignmentHistory = await prisma.taskAssignmentHistory.findMany({
        where: { taskId: id },
        orderBy: { createdAt: "desc" },
        include: {
          fromUser: { select: { id: true, displayName: true } },
          toUser: { select: { id: true, displayName: true } },
          comment: { select: { id: true, content: true } },
        },
      });
    } catch (historyErr) {
      console.error("Task assignment history fetch failed:", historyErr);
    }
    // Bana Özel: Sadece sahip (assignee) veya admin görebilir
    if (task.isPrivate && task.assigneeId !== session.id && !session.isAdmin) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }
    // Proje görevi: Sadece proje sorumlusu, proje üyesi, ekip üyesi, sorumlu, işbirlikçi veya oluşturan görebilir
    if (!session.isAdmin && task.projectId && task.project) {
      const proj = task.project as { ownerId: string | null; members: { userId: string }[]; teams: { members: { userId: string }[] }[] };
      const isProjectOwner = proj.ownerId === session.id;
      const isProjectMember = proj.members.some((m) => m.userId === session.id);
      const isTeamMember = proj.teams.some((t) => t.members.some((m) => m.userId === session.id));
      const canAccessProject = isProjectOwner || isProjectMember || isTeamMember || task.assigneeId === session.id || task.createdById === session.id || task.collaborators.some((c) => c.userId === session.id);
      if (!canAccessProject) {
        return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
      }
    }
    // Projesiz görev: Sadece sorumlu, işbirlikçi veya oluşturan görebilir (Bana Özel zaten yukarıda ele alındı)
    if (!session.isAdmin && !task.projectId) {
      const canAccess = task.assigneeId === session.id || task.createdById === session.id || task.collaborators.some((c) => c.userId === session.id);
      if (!canAccess) {
        return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
      }
    }
    const isAssignee = session.id === task.assigneeId;
    const isCollaborator = task.collaborators.some((c) => c.userId === session.id);
    const isCreatedBy = task.createdById === session.id;
    const canEdit = isAssignee || isCreatedBy;
    const collaborators = task.collaborators.map((c) => ({
      userId: c.user.id,
      displayName: c.user.displayName,
      email: c.user.email,
    }));
    const { project: projectFull, ...taskRest } = task;
    const projectSafe = projectFull ? { id: projectFull.id, name: projectFull.name } : null;
    const canComplete = true;
    const res = NextResponse.json(
      formatDisplayNamesInPayload({
        task: {
          ...taskRest,
          project: projectSafe,
          collaborators,
          assignmentHistory,
          isAssignee,
          isAssigneeOrCollaborator: isAssignee || isCollaborator,
          canComplete,
          canEdit,
        },
      })
    );
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  } catch (error) {
    console.error("Task get failed:", error);
    return NextResponse.json(
      { error: "Görev alınamadı" },
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

    const existingTask = await prisma.task.findUnique({
      where: { id },
      select: { assigneeId: true, createdById: true },
    });
    if (!existingTask) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }
    const canEdit = existingTask.assigneeId === session.id || existingTask.createdById === session.id;
    if (!canEdit) {
      return NextResponse.json(
        { error: "Bu görevi veya notu sadece sorumlu veya ekleyen düzenleyebilir." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Geçersiz veri" },
        { status: 400 }
      );
    }

    // Geçmişe yönelik son tarih güncellemesini engelle
    if (parsed.data.dueDate !== undefined) {
      const newDue = new Date(parsed.data.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueOnly = newDue;
      dueOnly.setHours(0, 0, 0, 0);
      if (dueOnly.getTime() <= today.getTime()) {
        return NextResponse.json(
          { error: "Bugün ve geçmiş tarihler son tarih olamaz." },
          { status: 400 }
        );
      }
    }

    // Runtime client sadece ilişki formatını kabul ediyor (assignee, project); skalar assigneeId/statusChangedAt kabul etmiyor
    const data: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.type !== undefined) data.type = parsed.data.type;
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
    if (parsed.data.priority !== undefined) data.priorityRank = priorityRank(parsed.data.priority);
    if (parsed.data.dueDate !== undefined) data.dueDate = new Date(parsed.data.dueDate);
    const previousTask =
      parsed.data.assigneeId !== undefined
        ? await prisma.task.findUnique({
            where: { id },
            select: { assigneeId: true, title: true, type: true, createdById: true, status: true },
          })
        : null;
    if (parsed.data.assigneeId !== undefined && parsed.data.assigneeId) {
      (data as Record<string, unknown>).assignee = { connect: { id: parsed.data.assigneeId } };
      // Görev başkasına atanıyorsa veya reddedilmiş görev farklı kişiye tekrar atanıyorsa onay bekliyor yap
      const isReassign =
        previousTask &&
        previousTask.assigneeId !== parsed.data.assigneeId &&
        previousTask.type === "GOREV" &&
        parsed.data.assigneeId !== previousTask.createdById;
      const isReassignFromRejected =
        previousTask?.status === "REDDEDILDI" &&
        previousTask.type === "GOREV" &&
        previousTask.assigneeId !== parsed.data.assigneeId;
      if (isReassign || isReassignFromRejected) {
        (data as Record<string, unknown>).status = "ONAY_BEKLIYOR";
      }
    }
    if (parsed.data.projectId !== undefined) {
      (data as Record<string, unknown>).project =
        parsed.data.projectId === null || parsed.data.projectId === ""
          ? { disconnect: true }
          : { connect: { id: parsed.data.projectId } };
    }

    const task = await prisma.task.update({
      where: { id },
      data: data as Parameters<typeof prisma.task.update>[0]["data"],
      include: {
        assignee: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (previousTask && parsed.data.assigneeId && parsed.data.assigneeId !== session.id && previousTask.assigneeId !== parsed.data.assigneeId) {
      await createNotification({
        userId: parsed.data.assigneeId,
        type: "TASK_ASSIGNED",
        title: "Size bir kayıt atandı",
        body: `${formatUserDisplayName(session.displayName) || "Bir kullanıcı"} "${previousTask.title}" kaydını size atadı.`,
        link: `/dashboard/tasks/${id}`,
        relatedTaskId: id,
      });
    }

    // statusChangedAt ve completedAt: runtime client kabul etmiyorsa raw SQL ile güncelle (veritabanında sütun varsa)
    if (parsed.data.status !== undefined) {
      try {
        const now = new Date();
        await prisma.$executeRaw`UPDATE [Task] SET statusChangedAt = ${now} WHERE id = ${id}`;
        if (parsed.data.status === "TAMAMLANDI") {
          const completedAt =
            parsed.data.completedAt !== undefined
              ? new Date(parsed.data.completedAt)
              : now;
          const safeCompletedAt =
            completedAt instanceof Date && !Number.isNaN(completedAt.getTime())
              ? completedAt
              : now;
          await prisma.$executeRaw`UPDATE [Task] SET completedAt = ${safeCompletedAt} WHERE id = ${id}`;
          // Otomatik yorum: görev tamamlandı
          try {
            await prisma.comment.create({
              data: {
                content: "Tamamlandı",
                task: { connect: { id } },
                author: { connect: { id: session.id } },
              },
            });
          } catch {
            // Yorum eklenemese bile ana işlem başarılı sayılır
          }
        }
        if (parsed.data.status === "BEKLEMEDE" && parsed.data.statusReason?.trim()) {
          // Beklemede gerekçesini yorum olarak kaydet
          try {
            await prisma.comment.create({
              data: {
                content: parsed.data.statusReason.trim(),
                task: { connect: { id } },
                author: { connect: { id: session.id } },
              },
            });
          } catch {
            // Yorum eklenemese bile ana işlem başarılı sayılır
          }
        }
      } catch {
        // Sütun yoksa veya hata olursa sessizce geç (görev güncellemesi zaten başarılı)
      }
    }
    return jsonWithDisplayNames({ task });
  } catch (error) {
    console.error("Task update failed:", error);
    return NextResponse.json(
      { error: "Görev güncellenemedi" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const existingTask = await prisma.task.findUnique({
      where: { id },
      select: { assigneeId: true, createdById: true },
    });
    if (!existingTask) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }
    const canEdit = existingTask.assigneeId === session.id || existingTask.createdById === session.id;
    if (!canEdit) {
      return NextResponse.json(
        { error: "Bu görevi veya notu sadece sorumlu veya ekleyen silebilir." },
        { status: 403 }
      );
    }

    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Task delete failed:", error);
    return NextResponse.json(
      { error: "Görev silinemedi" },
      { status: 500 }
    );
  }
}
