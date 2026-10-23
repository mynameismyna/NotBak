import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";

/** Projeye ekip üyesi ekle. Sadece proje sorumlusu, proje yöneticisi veya admin. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        ownerId: true,
        members: { where: { userId: session.id, role: "PROJE_YONETICISI" }, select: { userId: true } },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
    }

    const isProjectManager = project.members.length > 0;
    const canManage = session.isAdmin || project.ownerId === session.id || isProjectManager;
    if (!canManage) {
      return NextResponse.json(
        { error: "Projeye ekip üyesi eklemek için proje sorumlusu, proje yöneticisi veya admin olmalısınız" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const userId = (body.userId || body.user_id || "").trim();
    const role = (body.role || "EKIP_UYESI").trim();
    const allowedRoles = ["EKIP_UYESI", "PROJE_YONETICISI"];
    const memberRole = allowedRoles.includes(role) ? role : "EKIP_UYESI";

    if (!userId) {
      return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
    }

    if (userId === project.ownerId) {
      return NextResponse.json(
        { error: "Proje sorumlusu zaten projede; ekip üyesi olarak eklenemez" },
        { status: 400 }
      );
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    await prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId, userId },
      },
      create: { projectId, userId, role: memberRole },
      update: { role: memberRole },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Add project member failed:", error);
    return NextResponse.json(
      { error: "Ekip üyesi eklenemedi" },
      { status: 500 }
    );
  }
}

/** Üye rolünü güncelle. Sadece proje sorumlusu veya admin. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        ownerId: true,
        members: { where: { userId: session.id, role: "PROJE_YONETICISI" }, select: { userId: true } },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
    }

    const isProjectManager = project.members.length > 0;
    const canManage = session.isAdmin || project.ownerId === session.id || isProjectManager;
    if (!canManage) {
      return NextResponse.json(
        { error: "Üye rolünü değiştirmek için proje sorumlusu, proje yöneticisi veya admin olmalısınız" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const userId = (body.userId || body.user_id || "").trim();
    const role = (body.role || "EKIP_UYESI").trim();
    const allowedRoles = ["EKIP_UYESI", "PROJE_YONETICISI"];
    const memberRole = allowedRoles.includes(role) ? role : "EKIP_UYESI";

    if (!userId) {
      return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
    }

    await prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role: memberRole },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update project member role failed:", error);
    return NextResponse.json(
      { error: "Rol güncellenemedi" },
      { status: 500 }
    );
  }
}

/** Projeden ekip üyesini çıkar. Sadece proje sorumlusu, proje yöneticisi veya admin. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        ownerId: true,
        members: { where: { userId: session.id, role: "PROJE_YONETICISI" }, select: { userId: true } },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
    }

    const isProjectManager = project.members.length > 0;
    const canManage = session.isAdmin || project.ownerId === session.id || isProjectManager;
    if (!canManage) {
      return NextResponse.json(
        { error: "Projeden ekip üyesi çıkarmak için proje sorumlusu, proje yöneticisi veya admin olmalısınız" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || searchParams.get("user_id") || "";
    if (!userId) {
      return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
    }

    await prisma.projectMember.deleteMany({
      where: { projectId, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove project member failed:", error);
    return NextResponse.json(
      { error: "Ekip üyesi çıkarılamadı" },
      { status: 500 }
    );
  }
}
