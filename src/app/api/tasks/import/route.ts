import { NextRequest, NextResponse } from "next/server";
import { formatUserDisplayName } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import type { TaskStatus, Priority, TaskType } from "@/types";

interface ImportRow {
  title: string;
  description: string;
  type: TaskType;
  priority: Priority;
  dueDate: string;
  status: TaskStatus;
  isPrivate: boolean;
  assigneeId: string;
  projectId: string | null;
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

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Bu uç nokta artık sadece önizleme sonrası JSON veri kabul ediyor." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as { rows?: ImportRow[] };
    const rows = body.rows ?? [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Yüklenecek kayıt bulunamadı" }, { status: 400 });
    }
    // Önizleme ile aynı üst sınır; endpoint'e doğrudan istekle sınırın aşılmasını engeller.
    if (rows.length > 500) {
      return NextResponse.json({ error: "En fazla 500 satır yüklenebilir" }, { status: 400 });
    }

    const projects = await prisma.project.findMany({
      include: {
        members: { select: { userId: true } },
        teams: { include: { members: { select: { userId: true } } } },
      },
    });
    const projectById = new Map(projects.map((p) => [p.id, p]));

    function isProjectMember(project: (typeof projects)[0], userId: string): boolean {
      if (project.ownerId === userId) return true;
      if (project.members.some((m) => m.userId === userId)) return true;
      if (project.teams.some((t) => t.members.some((m) => m.userId === userId))) return true;
      return false;
    }

    const created: string[] = [];
    const pendingApprovalIds: string[] = [];

    for (const row of rows) {
      const now = new Date();
      let dueDate = new Date(row.dueDate);
      if (isNaN(dueDate.getTime()) || dueDate.getFullYear() < 2000 || dueDate.getFullYear() > 2100) {
        dueDate = new Date();
        dueDate.setHours(0, 0, 0, 0);
      }
      const status = row.status as TaskStatus;
      const priority = row.priority as Priority;
      const effectiveAssigneeId = row.assigneeId || session.id;
      const isPrivate = !!row.isPrivate && !row.projectId;

      if (isPrivate) {
        const task = await prisma.task.create({
          data: {
            title: row.title,
            description: row.description,
            type: row.type,
            status,
            priority,
            dueDate,
            assigneeId: effectiveAssigneeId,
            createdById: session.id,
            isPrivate: true,
            statusChangedAt: now,
            ...(status === "DEVAM_EDIYOR" ? { startedAt: now } : {}),
            ...(status === "TAMAMLANDI" ? { completedAt: now } : {}),
          },
        });
        created.push(task.id);
        continue;
      }

      if (!row.projectId) {
        const task = await prisma.task.create({
          data: {
            title: row.title,
            description: row.description,
            type: row.type,
            status,
            priority,
            dueDate,
            assigneeId: effectiveAssigneeId,
            createdById: session.id,
            isPrivate: false,
            statusChangedAt: now,
            ...(status === "DEVAM_EDIYOR" ? { startedAt: now } : {}),
            ...(status === "TAMAMLANDI" ? { completedAt: now } : {}),
          },
        });
        created.push(task.id);
        if (effectiveAssigneeId !== session.id) {
          await createNotification({
            userId: effectiveAssigneeId,
            type: "TASK_ASSIGNED",
            title: "Size yeni bir kayıt atandı",
            body: `${formatUserDisplayName(session.displayName) || "Bir kullanıcı"} "${row.title}" kaydını size atadı.`,
            link: `/dashboard/tasks/${task.id}`,
            relatedTaskId: task.id,
          });
        }
        continue;
      }

      const project = projectById.get(row.projectId);
      if (!project) {
        const task = await prisma.task.create({
          data: {
            title: row.title,
            description: row.description,
            type: row.type,
            status,
            priority,
            dueDate,
            assigneeId: effectiveAssigneeId,
            createdById: session.id,
            isPrivate: false,
            statusChangedAt: now,
            ...(status === "DEVAM_EDIYOR" ? { startedAt: now } : {}),
            ...(status === "TAMAMLANDI" ? { completedAt: now } : {}),
          },
        });
        created.push(task.id);
        continue;
      }

      const isMember = isProjectMember(project, effectiveAssigneeId);
      if (isMember) {
        const task = await prisma.task.create({
          data: {
            title: row.title,
            description: row.description,
            type: row.type,
            status,
            priority,
            dueDate,
            assigneeId: effectiveAssigneeId,
            createdById: session.id,
            projectId: project.id,
            isPrivate: false,
            statusChangedAt: now,
            ...(status === "DEVAM_EDIYOR" ? { startedAt: now } : {}),
            ...(status === "TAMAMLANDI" ? { completedAt: now } : {}),
          },
        });
        created.push(task.id);
        if (effectiveAssigneeId !== session.id) {
          await createNotification({
            userId: effectiveAssigneeId,
            type: "TASK_ASSIGNED",
            title: "Size yeni bir kayıt atandı",
            body: `${formatUserDisplayName(session.displayName) || "Bir kullanıcı"} "${row.title}" kaydını size atadı.`,
            link: `/dashboard/tasks/${task.id}`,
            relatedTaskId: task.id,
          });
        }
        continue;
      }

      // Üye değil: Proje sorumlusu onayı her zaman gerekir (allowAnyoneToAddTasks'dan bağımsız)
      const itemsForApproval = [
        {
          title: row.title,
          description: row.description,
          type: row.type,
          priority,
          dueDate: row.dueDate,
          status,
        },
      ];

      const existingPending = await prisma.importPendingApproval.findFirst({
        where: {
          projectId: project.id,
          assigneeId: effectiveAssigneeId,
          requesterId: session.id,
          status: "PENDING",
        },
      });

      let approvalId: string;
      if (existingPending) {
        const existingItems = JSON.parse(existingPending.items) as typeof itemsForApproval;
        const merged = [...existingItems, ...itemsForApproval];
        await prisma.importPendingApproval.update({
          where: { id: existingPending.id },
          data: { items: JSON.stringify(merged) },
        });
        approvalId = existingPending.id;
      } else {
        const approval = await prisma.importPendingApproval.create({
          data: {
            projectId: project.id,
            requesterId: session.id,
            assigneeId: effectiveAssigneeId,
            items: JSON.stringify(itemsForApproval),
            status: "PENDING",
          },
        });
        approvalId = approval.id;

        const ownerId = project.ownerId;
        const assigneeDisplay = "Bilinmeyen";
        const notifBody = `${formatUserDisplayName(session.displayName) || "Bir kullanıcı"}, "${project.name}" projesine ${itemsForApproval.length} kayıt eklemek istiyor. Sorumlu: ${assigneeDisplay} (projede değil).`;
        if (ownerId) {
          await prisma.notification.create({
            data: {
              userId: ownerId,
              type: "IMPORT_APPROVAL_REQUEST",
              title: "Proje üyeliği onay talebi",
              body: notifBody,
              link: `/dashboard/import-approvals/${approvalId}`,
              relatedImportApprovalId: approvalId,
            },
          });
        } else {
          const admins = await prisma.user.findMany({
            where: { isAdmin: true, isActive: true },
            select: { id: true },
          });
          for (const admin of admins) {
            await prisma.notification.create({
              data: {
                userId: admin.id,
                type: "IMPORT_APPROVAL_REQUEST",
                title: "Proje üyeliği onay talebi (sorumlu yok)",
                body: notifBody,
                link: `/dashboard/import-approvals/${approvalId}`,
                relatedImportApprovalId: approvalId,
              },
            });
          }
        }
      }
      if (!pendingApprovalIds.includes(approvalId)) pendingApprovalIds.push(approvalId);
    }

    return NextResponse.json({
      created: created.length,
      createdIds: created,
      pendingCount: pendingApprovalIds.length,
      pendingIds: [...new Set(pendingApprovalIds)],
    });
  } catch (error) {
    console.error("Import failed:", error);
    return NextResponse.json(
      { error: "İçe aktarma başarısız" },
      { status: 500 }
    );
  }
}

