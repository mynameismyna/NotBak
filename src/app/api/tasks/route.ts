import { NextRequest, NextResponse } from "next/server";
import { formatUserDisplayName, jsonWithDisplayNames } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";
import type { TaskType, TaskStatus } from "@/types";
import { priorityRank } from "@/lib/task-list";
import { getProjectCollaboratorAllowedUserIds } from "@/lib/project-collaborators";

const createSchema = z
  .object({
    title: z.string().min(1, "Başlık gerekli"),
    description: z.string().min(1, "Açıklama gerekli"),
    type: z.enum(["GOREV", "NOT", "FIKIR"]),
    status: z.enum(["YENI", "ONAY_BEKLIYOR", "DEVAM_EDIYOR", "BEKLEMEDE", "TAMAMLANDI"]).default("YENI"),
    priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]),
    dueDate: z.string(),
    assigneeId: z.string().optional(),
    projectId: z.string().optional(),
    isPrivate: z.boolean().optional().default(false),
    collaboratorIds: z.array(z.string()).optional().default([]),
  })
  .refine(
    (data) => data.isPrivate || !!data.assigneeId,
    {
      path: ["assigneeId"],
      message: "Sorumlu gerekli (Bana Özel değilse).",
    }
  );

export async function GET(request: NextRequest) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get("projectId")?.trim();
    const assigneeId = searchParams.get("assigneeId");
    const createdById = searchParams.get("createdById")?.trim() || null;
    const status = searchParams.get("status") as TaskStatus | null;
    const view = searchParams.get("view");
    const typeParam = searchParams.get("type") as TaskType | null;

    const where: {
      projectId?: string | null;
      assigneeId?: string | { not: string };
      createdById?: string | null;
      type?: TaskType;
      status?: TaskStatus | { not: TaskStatus };
      dueDate?: { gte?: Date; lte?: Date; lt?: Date };
      isPrivate?: boolean;
      OR?: Array<{ isPrivate: boolean } | { assigneeId: string }>;
      AND?: Array<Record<string, unknown>>;
    } = {};

    // Tip filtresi: Görevler sayfası GOREV, Notlar sayfası NOT ile çağırır
    if (typeParam === "GOREV" || typeParam === "NOT" || typeParam === "FIKIR") {
      where.type = typeParam;
    }

    // Proje seçiliyse sadece o projeye ait görevler (projectId kesin eşleşme)
    if (projectIdParam) where.projectId = projectIdParam;
    if (assigneeId) where.assigneeId = assigneeId;
    if (createdById) where.createdById = createdById;
    if (status) where.status = status;

    // Admin değilse:
    // (1) Bana Özel kuralı: isPrivate görevleri sadece sahibi görür
    // (2) Proje görevleri: sadece sorumlu, ilgili kişi, proje üyesi veya proje alt ekip üyesi görür
    // (3) Projesiz genel kayıtlar: sadece sorumlusu veya işbirlikçileri görür (diğer kullanıcılar göremez)
    if (!session.isAdmin) {
      where.AND = [
        { OR: [{ isPrivate: false }, { assigneeId: session.id }] },
        {
          OR: [
            { assigneeId: session.id },
            { createdById: session.id },
            { collaborators: { some: { userId: session.id } } },
            { project: { ownerId: session.id } },
            { project: { members: { some: { userId: session.id } } } },
            { project: { teams: { some: { members: { some: { userId: session.id } } } } } },
          ],
        },
      ];
    }

    if (view === "assigned") {
      where.assigneeId = session.id;
      where.status = { not: "TAMAMLANDI" };
    } else if (view === "requested") {
      where.createdById = session.id;
    } else if (view === "private") {
      where.isPrivate = true;
      where.assigneeId = session.id;
    } else if (view === "week") {
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);
      where.dueDate = { gte: now, lte: weekEnd };
    } else if (view === "waiting") {
      where.status = "BEKLEMEDE";
    } else if (view === "completed") {
      where.status = "TAMAMLANDI";
    } else if (view === "overdue") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      where.dueDate = { lt: todayStart };
      where.status = { not: "TAMAMLANDI" };
    } else if (view === "inprogress") {
      where.status = "DEVAM_EDIYOR";
      where.assigneeId = session.id;
    } else if (view === "accept-pending") {
      where.assigneeId = session.id;
      where.status = "ONAY_BEKLIYOR";
      where.type = "GOREV";
    } else if (view === "rejected") {
      where.type = "GOREV";
      where.status = "REDDEDILDI";
      where.AND = [
        { OR: [{ isPrivate: false }, { assigneeId: session.id }] },
        { OR: [{ assigneeId: session.id }, { createdById: session.id }] },
      ];
    } else if (view === "teamOrProject") {
      // Sorumlu veya atayan olmadığım; ekip/proje üyesi olarak gördüğüm kayıtlar
      where.assigneeId = { not: session.id };
      (where.AND = where.AND ?? []).push({
        OR: [{ createdById: null }, { createdById: { not: session.id } }],
      });
    }

    // Tamamlanmış görevler sadece "Tamamlanan" görünümünde listelensin; diğer tüm görünümlerde hariç tut
    if (view !== "completed" && view !== "accept-pending" && view !== "rejected" && where.status === undefined) {
      where.status = { not: "TAMAMLANDI" };
    }

    // Üst sınır: liste yanıtının kayıt sayısıyla sınırsız büyümesini engeller.
    // İstemci ?limit= ile daha küçük bir değer isteyebilir.
    const limitParam = Number(searchParams.get("limit"));
    const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 2000) : 2000;

    // Liste kartları açıklamanın yalnızca ilk satırlarını gösterir; tam metin
    // detay endpoint'inden (/api/tasks/[id]) gelir. Uzun açıklamaları listede
    // taşımak hem DB hem JSON maliyetini ciddi artırıyordu.
    const LIST_DESCRIPTION_MAX = 300;

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { priorityRank: "desc" }, { createdAt: "desc" }],
      take,
      include: {
        assignee: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true, ownerId: true } },
        // Listede collaborator isimleri gösterilmez; yalnızca "bu kayıt bana mı
        // ait?" kontrolü için mevcut kullanıcının satırı yeterli (tam liste +
        // User join yerine tek satır → çok daha hafif sorgu).
        collaborators: { where: { userId: session.id }, select: { userId: true } },
      },
    });
    const tasksWithCollaborators = tasks.map((t) => {
      const isAssignee = t.assigneeId === session.id;
      const isCollaborator = t.collaborators.length > 0;
      const isCreatedBy = t.createdById === session.id;
      const canEdit = isAssignee || isCreatedBy;
      return {
        ...t,
        description:
          t.description.length > LIST_DESCRIPTION_MAX
            ? `${t.description.slice(0, LIST_DESCRIPTION_MAX)}…`
            : t.description,
        createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
        dueDate: t.dueDate instanceof Date ? t.dueDate.toISOString() : t.dueDate,
        statusChangedAt:
          t.statusChangedAt instanceof Date ? t.statusChangedAt.toISOString() : t.statusChangedAt,
        completedAt: t.completedAt instanceof Date ? t.completedAt.toISOString() : t.completedAt,
        collaborators: t.collaborators.map((c) => ({ userId: c.userId })),
        isAssignee,
        isAssigneeOrCollaborator: isAssignee || isCollaborator,
        canEdit,
      };
    });
    return jsonWithDisplayNames({ tasks: tasksWithCollaborators });
  } catch (error) {
    console.error("Tasks list failed:", error);
    return NextResponse.json(
      { error: "Görevler alınamadı" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Geçersiz veri" },
        { status: 400 }
      );
    }

    const dueDate = new Date(parsed.data.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    if (due.getTime() <= today.getTime()) {
      return NextResponse.json(
        { error: "Bugün ve geçmiş tarihler son tarih olamaz." },
        { status: 400 }
      );
    }
    const isPrivate = parsed.data.isPrivate ?? false;
    const now = new Date();
    const assigneeId = isPrivate ? session.id : parsed.data.assigneeId!;
    const type = parsed.data.type as TaskType;
    // Görev (GOREV) başkasına atanıyorsa önce onay bekliyor durumunda oluştur
    const status: TaskStatus =
      type === "GOREV" && assigneeId !== session.id
        ? "ONAY_BEKLIYOR"
        : ((parsed.data.status || "YENI") as TaskStatus);

    const collaboratorIds = [...new Set(parsed.data.collaboratorIds ?? [])].filter(
      (id) => id && id !== assigneeId
    );

    if (!isPrivate && parsed.data.projectId && collaboratorIds.length > 0) {
      const allowedCollaborators = await getProjectCollaboratorAllowedUserIds(parsed.data.projectId);
      const invalid = collaboratorIds.filter((id) => !allowedCollaborators.has(id));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: "İlgili kişi olarak yalnızca seçili projenin ekibindeki kullanıcılar eklenebilir." },
          { status: 400 }
        );
      }
    }

    const task = await prisma.task.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        type,
        status,
        priority: parsed.data.priority,
        priorityRank: priorityRank(parsed.data.priority),
        dueDate,
        isPrivate,
        createdAt: now,
        statusChangedAt: now,
        ...(status === "DEVAM_EDIYOR" ? { startedAt: now } : {}),
        ...(status === "TAMAMLANDI" ? { completedAt: now } : {}),
        assignee: { connect: { id: assigneeId } },
        createdBy: { connect: { id: session.id } },
        ...(!isPrivate && parsed.data.projectId
          ? { project: { connect: { id: parsed.data.projectId } } }
          : {}),
      },
      include: {
        assignee: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (assigneeId !== session.id) {
      await createNotification({
        userId: assigneeId,
        type: "TASK_ASSIGNED",
        title: status === "ONAY_BEKLIYOR" ? "Size bir görev talebi atandı" : "Size yeni bir kayıt atandı",
        body:
          status === "ONAY_BEKLIYOR"
            ? `${formatUserDisplayName(session.displayName) || "Bir kullanıcı"} "${task.title}" görevini size atadı. Kabul veya reddetmek için Talepler sayfasına gidin.`
            : `${formatUserDisplayName(session.displayName) || "Bir kullanıcı"} "${task.title}" kaydını size atadı.`,
        link: status === "ONAY_BEKLIYOR" ? "/dashboard/talepler" : `/dashboard/tasks/${task.id}`,
        relatedTaskId: task.id,
      });
    }

    for (const userId of collaboratorIds) {
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!userExists) continue;

      await prisma.taskCollaborator.upsert({
        where: { taskId_userId: { taskId: task.id, userId } },
        create: { taskId: task.id, userId },
        update: {},
      });

      if (userId !== session.id) {
        await createNotification({
          userId,
          type: "TASK_COLLABORATOR",
          title: "Bir kayda ilgili kişi olarak eklendiniz",
          body: `${formatUserDisplayName(session.displayName) || "Bir kullanıcı"} sizi "${task.title}" kaydına ilgili kişi olarak ekledi.`,
          link: `/dashboard/tasks/${task.id}`,
          relatedTaskId: task.id,
        });
      }
    }

    return jsonWithDisplayNames({ task });
  } catch (error) {
    console.error("Task create failed:", error);
    return NextResponse.json(
      { error: "Görev oluşturulamadı" },
      { status: 500 }
    );
  }
}
