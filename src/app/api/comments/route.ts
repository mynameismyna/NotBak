import { NextRequest, NextResponse } from "next/server";
import { formatUserDisplayName, jsonWithDisplayNames } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { taskAccessWhere } from "@/lib/dashboard-metrics";
import { z } from "zod";

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addCalendarDays(d: Date, days: number): Date {
  const x = startOfLocalDay(d);
  x.setDate(x.getDate() + days);
  return x;
}

function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  const dt = new Date(y, mo - 1, da);
  dt.setHours(0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== da) return null;
  return dt;
}

function calendarDaysBetween(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime();
  const b = startOfLocalDay(to).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

const createSchema = z
  .object({
    content: z.string().min(1, "Yorum icerigi gerekli"),
    taskId: z.string().min(1, "Görev ID gerekli"),
    delegateToUserId: z.string().optional(),
    newStatus: z.enum(["YENI", "ONAY_BEKLIYOR", "DEVAM_EDIYOR", "BEKLEMEDE", "TAMAMLANDI"]).optional(),
    deferEnabled: z.boolean().optional(),
    deferMode: z.enum(["DAYS", "DATE"]).optional(),
    deferDays: z.coerce.number().int().min(1).max(30).optional(),
    deferToDate: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deferEnabled === true) {
      if (!data.deferMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Erteleme modu gerekli (gun veya tarih).",
          path: ["deferMode"],
        });
        return;
      }
      if (data.deferMode === "DAYS") {
        if (data.deferDays == null || data.deferDays < 1 || data.deferDays > 30) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "1 ile 30 gun arasi secin.",
            path: ["deferDays"],
          });
        }
      } else {
        if (!data.deferToDate?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Yeni son tarih secin.",
            path: ["deferToDate"],
          });
        }
      }
    }
  });

async function notifyTaskDeferred(params: {
  taskId: string;
  title: string;
  assigneeId: string;
  createdById: string | null;
  collaboratorUserIds: string[];
  actorId: string;
  newDueLabel: string;
  actorDisplayName: string;
}): Promise<void> {
  const ids = new Set<string>();
  ids.add(params.assigneeId);
  if (params.createdById) ids.add(params.createdById);
  for (const uid of params.collaboratorUserIds) ids.add(uid);
  ids.delete(params.actorId);

  const body = `${params.actorDisplayName} "${params.title}" kaydini erteledi. Yeni son tarih: ${params.newDueLabel}. Durum: Beklemede.`;

  for (const userId of ids) {
    await createNotification({
      userId,
      type: "TASK_DEFERRED",
      title: "Kayit ertelendi",
      body,
      link: `/dashboard/tasks/${params.taskId}`,
      relatedTaskId: params.taskId,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamis" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum acmaniz gerekiyor" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Gecersiz veri" },
        { status: 400 }
      );
    }

    const { content, taskId, delegateToUserId, newStatus, deferEnabled, deferMode, deferDays, deferToDate } =
      parsed.data;

    const wantsDelegate = !!delegateToUserId;
    const wantsDefer = deferEnabled === true;

    if (!wantsDelegate && !wantsDefer) {
      // IDOR koruması: kullanıcı yalnızca görme yetkisi olduğu göreve yorum ekleyebilir.
      const accessibleTask = await prisma.task.findFirst({
        where: { id: taskId, ...taskAccessWhere(session.id, session.isAdmin === true) },
        select: { id: true },
      });
      if (!accessibleTask) {
        return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
      }
      const comment = await prisma.comment.create({
        data: {
          content,
          taskId,
          authorId: session.id,
        },
        include: {
          author: { select: { id: true, displayName: true, email: true } },
        },
      });
      return jsonWithDisplayNames({
        comment: {
          ...comment,
          createdAt: comment.createdAt.toISOString?.() ?? comment.createdAt,
        },
      });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        assigneeId: true,
        createdById: true,
        title: true,
        dueDate: true,
        status: true,
        type: true,
        projectId: true,
        project: {
          select: {
            ownerId: true,
            members: { select: { userId: true } },
            teams: { include: { members: { select: { userId: true } } } },
          },
        },
        collaborators: { select: { userId: true, permission: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    const isAssignee = task.assigneeId === session.id;
    const isAdmin = session.isAdmin === true;
    const isFullCollaborator = task.collaborators.some(
      (c) => c.userId === session.id && c.permission === "FULL"
    );
    const canAct = isAssignee || isAdmin || isFullCollaborator;
    if (!canAct) {
      return NextResponse.json(
        {
          error:
            "Bu islemi yalnizca sorumlu, tam yetkili ilgili kisi veya yonetici yapabilir.",
        },
        { status: 403 }
      );
    }

    if (wantsDefer && task.status === "TAMAMLANDI") {
      return NextResponse.json(
        { error: "Tamamlanan kayit ertelenemez." },
        { status: 400 }
      );
    }

    let newDueDate: Date | undefined;
    if (wantsDefer) {
      const oldDue = startOfLocalDay(new Date(task.dueDate));
      const today = startOfLocalDay(new Date());

      if (deferMode === "DAYS") {
        newDueDate = addCalendarDays(oldDue, deferDays!);
      } else {
        const parsedDate = parseYmdLocal(deferToDate!.trim());
        if (!parsedDate) {
          return NextResponse.json({ error: "Gecersiz tarih formati." }, { status: 400 });
        }
        newDueDate = parsedDate;
      }

      const newDueDay = startOfLocalDay(newDueDate);
      if (newDueDay.getTime() <= today.getTime()) {
        return NextResponse.json(
          { error: "Bugün ve geçmiş tarihler son tarih olamaz." },
          { status: 400 }
        );
      }

      const diff = calendarDaysBetween(oldDue, newDueDay);
      if (diff < 1 || diff > 30) {
        return NextResponse.json(
          {
            error:
              "Ertelenen son tarih, mevcut son tarihten en az 1 en fazla 30 gun ileride olmalidir.",
          },
          { status: 400 }
        );
      }
    }

    if (wantsDelegate) {
      if (delegateToUserId === task.assigneeId) {
        return NextResponse.json(
          { error: "Görev zaten bu kullanıcıya atanmış." },
          { status: 400 }
        );
      }
      const targetUser = await prisma.user.findUnique({
        where: { id: delegateToUserId },
        select: { id: true, isActive: true },
      });
      if (!targetUser || !targetUser.isActive) {
        return NextResponse.json(
          { error: "Gecersiz veya pasif kullanici secildi." },
          { status: 400 }
        );
      }
    }

    const previousAssigneeId = task.assigneeId;
    const collaboratorIds = task.collaborators.map((c) => c.userId);

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          content,
          taskId,
          authorId: session.id,
        },
        include: {
          author: { select: { id: true, displayName: true, email: true } },
        },
      });

      const updateData: Record<string, unknown> = {};
      if (wantsDelegate) {
        updateData.assigneeId = delegateToUserId;
      }
      if (wantsDefer && newDueDate) {
        updateData.dueDate = newDueDate;
        updateData.status = "BEKLEMEDE";
      } else if (wantsDelegate && newStatus) {
        updateData.status = newStatus;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.task.update({
          where: { id: taskId },
          data: updateData as Parameters<typeof tx.task.update>[0]["data"],
        });
      }

      if (wantsDelegate) {
        await tx.taskAssignmentHistory.create({
          data: {
            taskId,
            fromUserId: previousAssigneeId,
            toUserId: delegateToUserId!,
            commentId: created.id,
          },
        });
      }

      return created;
    });

    const finalAssigneeId = wantsDelegate ? delegateToUserId! : task.assigneeId;

    try {
      const now = new Date();
      if (wantsDefer || (wantsDelegate && newStatus)) {
        await prisma.$executeRaw`UPDATE [Task] SET statusChangedAt = ${now} WHERE id = ${taskId}`;
      }
    } catch {
      // Sutun yoksa veya hata: yorum ve gorev guncellemesi yine de basarili
    }

    if (wantsDelegate) {
      await createNotification({
        userId: delegateToUserId!,
        type: "TASK_DELEGATED",
        title: "Size bir kayıt devredildi",
        body: `${formatUserDisplayName(session.displayName) || "Bir kullanıcı"} "${task.title}" kaydını size devretti.`,
        link: `/dashboard/tasks/${taskId}`,
        relatedTaskId: taskId,
      });
    }

    if (wantsDefer && newDueDate) {
      const newDueLabel = newDueDate.toLocaleDateString("tr-TR");
      await notifyTaskDeferred({
        taskId,
        title: task.title,
        assigneeId: finalAssigneeId,
        createdById: task.createdById,
        collaboratorUserIds: collaboratorIds,
        actorId: session.id,
        newDueLabel,
        actorDisplayName: formatUserDisplayName(session.displayName) || "Bir kullanici",
      });
    }

    return jsonWithDisplayNames({
      comment: {
        ...comment,
        createdAt: comment.createdAt.toISOString?.() ?? comment.createdAt,
      },
    });
  } catch (error) {
    console.error("Comment create failed:", error);
    return NextResponse.json(
      { error: "Yorum olusturulamadi" },
      { status: 500 }
    );
  }
}
