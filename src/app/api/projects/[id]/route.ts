import { NextRequest, NextResponse } from "next/server";
import { jsonWithDisplayNames } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { z } from "zod";
import { projectIconKeySchema } from "@/lib/project-icons";

const updateSchema = z.object({
  name: z.string().min(1, "Proje adı gerekli").optional(),
  iconKey: projectIconKeySchema.optional(),
  ownerId: z.string().nullable().optional(),
  unitId: z.string().nullable().optional(),
  visibility: z.enum(["MEMBERS_ONLY", "EVERYONE", "UNIT_MEMBERS"]).optional(),
  allowAnyoneToAddTasks: z.boolean().optional(),
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

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        tasks: true,
        owner: { select: { id: true, displayName: true, email: true } },
        unit: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, displayName: true, email: true } } } },
        teams: { include: { members: { select: { userId: true } } } },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
    }
    const isOwner = project.ownerId === session.id;
    const isProjectManager = project.members.some(
      (m) => m.userId === session.id && m.role === "PROJE_YONETICISI"
    );
    const isProjectMember = project.members.some((m) => m.userId === session.id);
    const isTeamMember = project.teams.some((t) => t.members.some((m) => m.userId === session.id));
    const isInProjectUnit =
      project.unitId &&
      (await prisma.unitMember.findFirst({
        where: { unitId: project.unitId, userId: session.id },
        select: { unitId: true },
      }));
    const canAccessByVisibility =
      session.isAdmin ||
      project.visibility === "EVERYONE" ||
      (project.visibility === "UNIT_MEMBERS" && !!isInProjectUnit) ||
      (project.visibility === "MEMBERS_ONLY" && (isOwner || isProjectMember || isTeamMember));
    if (!canAccessByVisibility) {
      return NextResponse.json(
        { error: "Bu projeyi görüntüleme yetkiniz yok." },
        { status: 403 }
      );
    }
    const isMember = isProjectMember;
    const members = project.members.map((m) => ({
      userId: m.user.id,
      displayName: m.user.displayName,
      email: m.user.email,
      role: m.role || "EKIP_UYESI",
    }));
    const { teams: _teams, ...projectWithoutTeams } = project;
    return jsonWithDisplayNames({
      project: {
        ...projectWithoutTeams,
        members,
        isOwner,
        canManageTeam: isOwner || isProjectManager || session.isAdmin,
      },
    });
  } catch (error) {
    console.error("Project get failed:", error);
    return NextResponse.json(
      { error: "Proje alınamadı" },
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
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Geçersiz veri" },
        { status: 400 }
      );
    }
    const visibility = parsed.data.visibility ?? undefined;
    const unitId = parsed.data.unitId !== undefined ? parsed.data.unitId : undefined;
    if (visibility === "UNIT_MEMBERS" && (unitId === null || unitId === "")) {
      return NextResponse.json(
        { error: "Sadece birim kullanıcıları seçiliyse birim belirtmelisiniz" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: { ownerId: true, members: { where: { userId: session.id, role: "PROJE_YONETICISI" }, select: { userId: true } } },
    });
    if (!project) {
      return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
    }
    const isProjectManager = project.members.length > 0;
    const canEdit = session.isAdmin || project.ownerId === session.id || isProjectManager;
    if (!canEdit) {
      return NextResponse.json({ error: "Projeyi yalnızca sorumlu, proje yöneticisi veya admin düzenleyebilir" }, { status: 403 });
    }

    const updateData: {
      name?: string;
      iconKey?: string;
      ownerId?: string | null;
      unitId?: string | null;
      visibility?: string;
      allowAnyoneToAddTasks?: boolean;
    } = { ...parsed.data };
    const updated = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        unit: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, displayName: true, email: true } } } },
      },
    });
    return jsonWithDisplayNames({
      project: {
        ...updated,
        members: updated.members.map((m) => ({
          userId: m.user.id,
          displayName: m.user.displayName,
          email: m.user.email,
          role: m.role || "EKIP_UYESI",
        })),
      },
    });
  } catch (error) {
    console.error("Project update failed:", error);
    return NextResponse.json(
      { error: "Proje güncellenemedi" },
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

    const project = await prisma.project.findUnique({
      where: { id },
      select: { ownerId: true, members: { where: { userId: session.id, role: "PROJE_YONETICISI" }, select: { userId: true } } },
    });
    if (!project) {
      return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
    }
    const isProjectManager = project.members.length > 0;
    const canDelete = session.isAdmin || project.ownerId === session.id || isProjectManager;
    if (!canDelete) {
      return NextResponse.json({ error: "Projeyi yalnızca sorumlu, proje yöneticisi veya admin silebilir" }, { status: 403 });
    }

    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Project delete failed:", error);
    return NextResponse.json(
      { error: "Proje silinemedi" },
      { status: 500 }
    );
  }
}
