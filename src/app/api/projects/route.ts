import { NextRequest, NextResponse } from "next/server";
import { jsonWithDisplayNames } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { taskAccessWhere } from "@/lib/dashboard-metrics";
import {
  aggregateCountsByProject,
  emptyProjectTaskCounts,
} from "@/lib/project-task-stats";
import { z } from "zod";
import { projectIconKeySchema } from "@/lib/project-icons";

/** Görünürlük: Tüm kullanıcılar | Sadece birim kullanıcıları | Sadece ekli kişiler */
const createSchema = z.object({
  name: z.string().min(1, "Proje adı gerekli"),
  iconKey: projectIconKeySchema.optional(),
  ownerId: z.string().optional(),
  unitId: z.string().optional(),
  visibility: z.enum(["MEMBERS_ONLY", "EVERYONE", "UNIT_MEMBERS"]).optional().default("MEMBERS_ONLY"),
  allowAnyoneToAddTasks: z.boolean().optional().default(false),
});

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

    const responsibleOnly = request.nextUrl.searchParams.get("responsibleOnly") === "true";
    const unitIdParam = request.nextUrl.searchParams.get("unitId")?.trim() || null;

    const visibilityOr =
      session.isAdmin
        ? undefined
        : {
            OR: [
              { visibility: "EVERYONE" },
              {
                visibility: "UNIT_MEMBERS",
                unitId: { not: null },
                unit: { members: { some: { userId: session.id } } },
              },
              {
                visibility: "MEMBERS_ONLY",
                OR: [
                  { ownerId: session.id },
                  { members: { some: { userId: session.id } } },
                  { teams: { some: { members: { some: { userId: session.id } } } } },
                ],
              },
            ],
          };

    const whereClause = responsibleOnly
      ? { ownerId: session.id, ...(unitIdParam ? { unitId: unitIdParam } : {}) }
      : session.isAdmin
        ? (unitIdParam ? { unitId: unitIdParam } : {})
        : unitIdParam
          ? { unitId: unitIdParam, ...visibilityOr }
          : visibilityOr;

    const projects = await prisma.project.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        unit: { select: { id: true, name: true } },
        // Liste kartı üye listesini göstermez; canDelete için yalnızca mevcut
        // kullanıcının üyelik satırı yeterli (tam üye listesi + User join yerine).
        members: { where: { userId: session.id }, select: { userId: true, role: true } },
      },
    });

    const projectIds = projects.map((p) => p.id);
    const accessWhere = taskAccessWhere(session.id, !!session.isAdmin);
    const taskGroupRows =
      projectIds.length > 0
        ? await prisma.task.groupBy({
            by: ["projectId", "status"],
            where: {
              projectId: { in: projectIds },
              ...accessWhere,
            },
            _count: { _all: true },
          })
        : [];
    const countsByProject = aggregateCountsByProject(taskGroupRows);

    const projectsWithOwnerAndMembers = projects.map((p) => {
      const isOwner = p.ownerId === session.id;
      const isProjectManager = p.members.some((m) => m.role === "PROJE_YONETICISI");
      const canDelete = session.isAdmin || isOwner || isProjectManager;
      const taskCounts = countsByProject.get(p.id) ?? emptyProjectTaskCounts();
      return {
        ...p,
        members: undefined,
        owner: p.owner,
        canDelete,
        taskCounts,
      };
    });
    return jsonWithDisplayNames({ projects: projectsWithOwnerAndMembers });
  } catch (error) {
    console.error("Projects list failed:", error);
    return NextResponse.json(
      { error: "Projeler alınamadı" },
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

    const nameTrimmed = parsed.data.name.trim();
    if (parsed.data.visibility === "UNIT_MEMBERS" && !parsed.data.unitId) {
      return NextResponse.json(
        { error: "Sadece birim kullanıcıları seçiliyse birim belirtmelisiniz" },
        { status: 400 }
      );
    }

    // İsim tekilliği: tüm projeleri belleğe çekmek yerine DB'de tek sorgu.
    // SQL Server varsayılan collation'ı büyük/küçük harf duyarsızdır.
    const existing = await prisma.project.findFirst({
      where: { name: nameTrimmed },
      select: { id: true, name: true, ownerId: true },
    });

    if (existing) {
      const isOwner = existing.ownerId === session.id;
      return NextResponse.json(
        {
          exists: true,
          projectId: existing.id,
          projectName: existing.name,
          isOwner,
          message: isOwner
            ? "Bu projeye zaten sahipsiniz."
            : "Bu isimde bir proje zaten mevcut. Projeye katılmak ister misiniz?",
        },
        { status: 409 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: nameTrimmed,
        iconKey: parsed.data.iconKey,
        ownerId: parsed.data.ownerId || undefined,
        unitId: parsed.data.unitId || undefined,
        visibility: parsed.data.visibility,
        allowAnyoneToAddTasks: parsed.data.allowAnyoneToAddTasks,
      },
    });

    // Projeyi başlatan kişiyi, sorumlu seçmediyse veya başkasını seçtiyse Proje Yöneticisi olarak ekle
    const creatorIsOwner = project.ownerId === session.id;
    if (!creatorIsOwner) {
      await prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: session.id,
          role: "PROJE_YONETICISI",
        },
      });
    }

    return jsonWithDisplayNames({ project });
  } catch (error) {
    console.error("Project create failed:", error);
    return NextResponse.json(
      { error: "Proje oluşturulamadı" },
      { status: 500 }
    );
  }
}
