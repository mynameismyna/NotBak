import { NextRequest, NextResponse } from "next/server";
import { jsonWithDisplayNames } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";

/** Kullanıcının erişebildiği görevler için where koşulu (admin değilse). */
function taskAccessWhere(sessionId: string, isAdmin: boolean) {
  if (isAdmin) return {};
  return {
    AND: [
      { OR: [{ isPrivate: false }, { assigneeId: sessionId }] },
      {
        OR: [
          { assigneeId: sessionId },
          { collaborators: { some: { userId: sessionId } } },
          { project: { ownerId: sessionId } },
          { project: { members: { some: { userId: sessionId } } } },
          { project: { teams: { some: { members: { some: { userId: sessionId } } } } } },
        ],
      },
    ],
  };
}

/** Proje erişim kontrolü.
 * Admin: tüm projeler. Normal: owner, member veya team member.
 */
function projectAccessWhere(sessionId: string, isAdmin: boolean) {
  if (isAdmin) return {};
  return {
    OR: [
      { ownerId: sessionId },
      { members: { some: { userId: sessionId } } },
      { teams: { some: { members: { some: { userId: sessionId } } } } },
    ],
  };
}

/** Global arama: görevler, notlar, projeler. */
export async function GET(request: NextRequest) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session?.id) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ tasks: [], projects: [] });
    }

    const searchTerm = `%${q}%`;
    const accessWhere = taskAccessWhere(session.id, !!session.isAdmin);
    const projectWhere = projectAccessWhere(session.id, !!session.isAdmin);

    // Görevler: title veya description'da ara
    const tasks = await prisma.task.findMany({
      where: {
        ...accessWhere,
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 15,
      include: {
        assignee: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    // Projeler: name'de ara
    const projects = await prisma.project.findMany({
      where: {
        ...projectWhere,
        name: { contains: q },
      },
      orderBy: { name: "asc" },
      take: 10,
      select: { id: true, name: true },
    });

    const taskResults = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      status: t.status,
      dueDate: t.dueDate.toISOString(),
      assignee: t.assignee,
      createdBy: t.createdBy,
      project: t.project,
    }));

    return jsonWithDisplayNames({
      tasks: taskResults,
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json(
      { error: "Arama yapılamadı" },
      { status: 500 }
    );
  }
}
