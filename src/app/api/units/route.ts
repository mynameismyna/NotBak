import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";

/** Tüm birimleri listele (kullanıcı ekleme/düzenleme formlarında kullanılır). */
export async function GET(request: Request) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const url = request.url ? new URL(request.url) : null;
    const mineOnly = url?.searchParams?.get("mine") === "true";

    const units = mineOnly
      ? await prisma.unit.findMany({
          where: { members: { some: { userId: session.id } } },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : await prisma.unit.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        });

    return NextResponse.json({ units });
  } catch (error) {
    console.error("Units list failed:", error);
    return NextResponse.json(
      { error: "Birim listesi alınamadı" },
      { status: 500 }
    );
  }
}

/** Yeni birim oluştur. Sadece Admin. */
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
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "Birim tanımlamak için Admin yetkisi gerekli" }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Birim adı gerekli" }, { status: 400 });
    }

    const unit = await prisma.unit.create({
      data: { name },
      select: { id: true, name: true },
    });
    return NextResponse.json({ success: true, unit });
  } catch (error) {
    console.error("Unit create failed:", error);
    return NextResponse.json(
      { error: "Birim oluşturulamadı" },
      { status: 500 }
    );
  }
}
