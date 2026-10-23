import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";
import { UNIT_ROLE } from "@/lib/authz";

/** Birime üye ekle veya rol güncelle. Sadece Admin. */
export async function POST(
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
      return NextResponse.json({ error: "Birim üyesi eklemek için Admin yetkisi gerekli" }, { status: 403 });
    }

    const { id: unitId } = await params;
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const role = body.role === UNIT_ROLE.BIRIM_YONETICISI ? UNIT_ROLE.BIRIM_YONETICISI : UNIT_ROLE.EKIP_UYESI;

    if (!userId) {
      return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
    }

    const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } });
    if (!unit) {
      return NextResponse.json({ error: "Birim bulunamadı" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    await prisma.unitMember.upsert({
      where: { unitId_userId: { unitId, userId } },
      create: { unitId, userId, role },
      update: { role },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unit member add failed:", error);
    return NextResponse.json(
      { error: "Üye eklenemedi" },
      { status: 500 }
    );
  }
}

/** Birimden üye çıkar. Sadece Admin. */
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
      return NextResponse.json({ error: "Birim üyesi çıkarmak için Admin yetkisi gerekli" }, { status: 403 });
    }

    const { id: unitId } = await params;
    const body = await request.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";

    if (!userId) {
      return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
    }

    await prisma.unitMember.delete({
      where: { unitId_userId: { unitId, userId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unit member remove failed:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Üyelik bulunamadı" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Üye çıkarılamadı" },
      { status: 500 }
    );
  }
}
