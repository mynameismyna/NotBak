import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";
import { APP_URL_KEY } from "@/lib/app-url";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "Bu ayarlara sadece Admin erişebilir" }, { status: 403 });
    }
    if (!getSetupConfig()?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const row = await prisma.appSetting.findUnique({
      where: { key: APP_URL_KEY },
    });
    return NextResponse.json({
      appUrl: row?.value?.trim() ?? "",
    });
  } catch (error) {
    console.error("App URL get failed:", error);
    return NextResponse.json(
      { error: "Ayar alınamadı" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "Bu ayarlara sadece Admin erişebilir" }, { status: 403 });
    }
    if (!getSetupConfig()?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const body = await request.json();
    const appUrl = typeof body.appUrl === "string" ? body.appUrl.trim() : "";

    const value = appUrl ? appUrl.replace(/\/$/, "") : "";
    await prisma.appSetting.upsert({
      where: { key: APP_URL_KEY },
      create: { id: `app-url-${Date.now()}`, key: APP_URL_KEY, value },
      update: { value },
    });

    return NextResponse.json({ success: true, appUrl: value || null });
  } catch (error) {
    console.error("App URL save failed:", error);
    return NextResponse.json(
      { error: "Ayar kaydedilemedi" },
      { status: 500 }
    );
  }
}
