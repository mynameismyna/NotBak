import { NextRequest, NextResponse } from "next/server";
import { jsonWithDisplayNames } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { taskAccessWhere } from "@/lib/dashboard-metrics";
import { buildProjectStatsPayload } from "@/lib/project-task-stats";

async function canAccessProject(
  projectId: string,
  session: { id: string; isAdmin?: boolean },
): Promise<{ ok: true; name: string } | { ok: false; status: number; error: string }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      visibility: true,
      ownerId: true,
      unitId: true,
      members: { where: { userId: session.id }, select: { userId: true } },
      teams: { include: { members: { where: { userId: session.id }, select: { userId: true } } } },
    },
  });

  if (!project) {
    return { ok: false, status: 404, error: "Proje bulunamadı" };
  }

  if (session.isAdmin) {
    return { ok: true, name: project.name };
  }

  const isOwner = project.ownerId === session.id;
  const isProjectMember = project.members.length > 0;
  const isTeamMember = project.teams.some((t) => t.members.length > 0);
  const isInProjectUnit =
    project.unitId &&
    (await prisma.unitMember.findFirst({
      where: { unitId: project.unitId, userId: session.id },
      select: { unitId: true },
    }));

  const canAccessByVisibility =
    project.visibility === "EVERYONE" ||
    (project.visibility === "UNIT_MEMBERS" && !!isInProjectUnit) ||
    (project.visibility === "MEMBERS_ONLY" && (isOwner || isProjectMember || isTeamMember));

  if (!canAccessByVisibility) {
    return { ok: false, status: 403, error: "Bu projeyi görüntüleme yetkiniz yok." };
  }

  return { ok: true, name: project.name };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    const access = await canAccessProject(id, session);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const accessWhere = taskAccessWhere(session.id, !!session.isAdmin);
    const rows = await prisma.task.groupBy({
      by: ["status", "type"],
      where: {
        projectId: id,
        ...accessWhere,
      },
      _count: { _all: true },
    });

    const stats = buildProjectStatsPayload(id, access.name, rows);
    return jsonWithDisplayNames({ stats });
  } catch (error) {
    console.error("Project stats failed:", error);
    return NextResponse.json({ error: "Proje istatistikleri alınamadı" }, { status: 500 });
  }
}
