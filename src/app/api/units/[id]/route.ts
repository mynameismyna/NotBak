import { NextRequest, NextResponse } from "next/server";
import { jsonWithDisplayNames } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";

/** Birim detayı ve üyeleri. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const { id } = await params;
    const unit = await prisma.unit.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        members: {
          select: {
            userId: true,
            role: true,
            user: { select: { id: true, email: true, displayName: true } },
          },
        },
      },
    });
    if (!unit) {
      return NextResponse.json({ error: "Birim bulunamadı" }, { status: 404 });
    }

    return jsonWithDisplayNames({
      unit: {
        id: unit.id,
        name: unit.name,
        members: unit.members.map((m) => ({
          userId: m.userId,
          role: m.role,
          displayName: m.user.displayName,
          email: m.user.email,
        })),
      },
    });
  } catch (error) {
    console.error("Unit get failed:", error);
    return NextResponse.json(
      { error: "Birim alınamadı" },
      { status: 500 }
    );
  }
}

/** Birim güncelle. Sadece Admin. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "Birim düzenlemek için Admin yetkisi gerekli" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Birim adı gerekli" }, { status: 400 });
    }

    const unit = await prisma.unit.update({
      where: { id },
      data: { name },
      select: { id: true, name: true },
    });
    return NextResponse.json({ success: true, unit });
  } catch (error) {
    console.error("Unit update failed:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Birim bulunamadı" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Birim güncellenemedi" },
      { status: 500 }
    );
  }
}

/** Birim sil. Sadece Admin. Üyelikler (UnitMember) cascade ile silinir. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "Birim silmek için Admin yetkisi gerekli" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.unit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unit delete failed:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Birim bulunamadı" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Birim silinemedi" },
      { status: 500 }
    );
  }
}
